# -*- coding: utf-8 -*-
"""诊断引擎 content_evidence 证据包测试（内存 SQLite 合成数据，不依赖真实库与 Flask app）"""
import json
import sys
import unittest
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import logging

logging.disable(logging.CRITICAL)

from flask import Flask
from sqlalchemy.pool import StaticPool

import config  # noqa: F401  与 test_smoke 一致：确保 config 可导入
from backend.database import db
from backend.models_v2 import FactConvContent
from backend.utils.diagnosis import metrics
from backend.utils.diagnosis import engine as engine_mod
from backend.utils.diagnosis import rules
from backend.utils import llm as llm_mod


def _lead(day, platform='抖音', interaction=None, opened=1, valid=1, stock=0):
    return {'线索日期': '2026-08-%02d' % day, '平台来源': platform, '互动次数': interaction,
            '是否客户开口': opened, '是否有效线索': valid, '是否为存量客户': stock}


class SyntheticDbTest(unittest.TestCase):
    """内存 SQLite 基类：create_all 一次性建全部 models_v2 表，用例只操作 FactConvContent"""

    @classmethod
    def setUpClass(cls):
        cls.flask_app = Flask(__name__)
        cls.flask_app.config.update({
            'SQLALCHEMY_DATABASE_URI': 'sqlite://',
            'SQLALCHEMY_TRACK_MODIFICATIONS': False,
            'SQLALCHEMY_ENGINE_OPTIONS': {'poolclass': StaticPool, 'connect_args': {'check_same_thread': False}},
        })
        db.init_app(cls.flask_app)
        with cls.flask_app.app_context():
            db.create_all()

    @classmethod
    def tearDownClass(cls):
        with cls.flask_app.app_context():
            db.session.remove()
            db.drop_all()

    def setUp(self):
        with self.flask_app.app_context():
            db.session.rollback()
            db.session.query(FactConvContent).delete()
            db.session.commit()

    def _insert(self, rows):
        with self.flask_app.app_context():
            for index, row in enumerate(rows, start=1):
                db.session.add(FactConvContent(id=index, **row))
            db.session.commit()


class FetchMonthlyZeroTest(SyntheticDbTest):
    """fetch_content_monthly / fetch_content_daily 输出零互动计数 zero（flag 门控非存量）"""

    def test_monthly_zero_counts(self):
        self._insert([
            _lead(1, interaction=0, opened=0),
            _lead(2, interaction=None, opened=0),
            _lead(3, interaction=3, opened=1),
        ])
        with self.flask_app.app_context():
            result = metrics.fetch_content_monthly(['2026-08'])
        month = result['2026-08']
        self.assertEqual(month['total'], 3)
        self.assertEqual(month['opened'], 1)
        self.assertEqual(month['zero'], 2)

    def test_daily_zero_gated_on_non_stock(self):
        self._insert([
            _lead(1, interaction=0),
            _lead(1, interaction=2, stock=1),
            _lead(2, interaction=1),
        ])
        with self.flask_app.app_context():
            rows = metrics.fetch_content_daily('2026-08')
        by_date = {row['date'].isoformat(): row for row in rows}
        self.assertEqual(by_date['2026-08-01']['zero'], 1)
        self.assertEqual(by_date['2026-08-02']['zero'], 0)


class XunSummaryTest(unittest.TestCase):
    """旬级划分与聚合（纯函数）"""

    def test_xun_of_day_boundaries(self):
        self.assertEqual(metrics.xun_of_day(1), '上旬')
        self.assertEqual(metrics.xun_of_day(10), '上旬')
        self.assertEqual(metrics.xun_of_day(11), '中旬')
        self.assertEqual(metrics.xun_of_day(20), '中旬')
        self.assertEqual(metrics.xun_of_day(21), '下旬')
        self.assertEqual(metrics.xun_of_day(31), '下旬')

    def test_summarize_sorted_by_platform_and_xun(self):
        rows = [
            {'platform': '腾讯', 'date': date(2026, 8, 15), 'leads': 10, 'opened': 5, 'zero': 2},
            {'platform': '抖音', 'date': date(2026, 8, 3), 'leads': 10, 'opened': 8, 'zero': 1},
            {'platform': '抖音', 'date': date(2026, 8, 25), 'leads': 10, 'opened': 2, 'zero': 6},
        ]
        result = metrics.summarize_xun_rows(rows)
        self.assertEqual([(item['platform'], item['xun']) for item in result],
                         [('抖音', '上旬'), ('抖音', '下旬'), ('腾讯', '中旬')])
        self.assertEqual(result[0]['leads'], 10)
        self.assertEqual(result[0]['open_rate'], 0.8)
        self.assertEqual(result[0]['zero_interaction_rate'], 0.1)
        self.assertEqual(result[1]['open_rate'], 0.2)
        self.assertEqual(result[2]['open_rate'], 0.5)

    def test_summarize_empty(self):
        self.assertEqual(metrics.summarize_xun_rows([]), [])


class XunFetchTest(SyntheticDbTest):
    """fetch_content_xun_breakdown：平台 × 旬聚合，零互动门控非存量"""

    def test_xun_breakdown(self):
        self._insert([
            _lead(5, '抖音', interaction=0),
            _lead(15, '抖音', interaction=2),
            _lead(15, '抖音', interaction=1, stock=1),
            _lead(25, '腾讯', interaction=1),
        ])
        with self.flask_app.app_context():
            rows = metrics.fetch_content_xun_breakdown('2026-08')
        by_key = {(row['platform'], row['xun']): row for row in rows}
        self.assertEqual(len(rows), 3)
        douyin_early = by_key[('抖音', '上旬')]
        self.assertEqual(douyin_early['leads'], 1)
        self.assertEqual(douyin_early['zero_interaction_rate'], 1.0)
        self.assertEqual(by_key[('抖音', '中旬')]['leads'], 1)
        self.assertEqual(by_key[('腾讯', '下旬')]['open_rate'], 1.0)


class PlatformFetchTest(SyntheticDbTest):
    """fetch_content_platform_daily / fetch_content_platform_monthly：平台口径 coalesce(nullif())"""

    def test_daily_coalesce_and_non_stock_gate(self):
        self._insert([
            _lead(1, platform=None),
            _lead(1, platform=''),
            _lead(3, platform='抖音', stock=1),
        ])
        with self.flask_app.app_context():
            rows = metrics.fetch_content_platform_daily('2026-08')
        by_platform = {row['platform']: row for row in rows}
        self.assertEqual(set(by_platform), {'未知'})
        self.assertEqual(by_platform['未知']['leads'], 2)
        self.assertEqual(by_platform['未知']['opened'], 2)

    def test_monthly_grouped_by_platform_and_month(self):
        self._insert([
            _lead(1),
            {'线索日期': '2026-07-01', '平台来源': '抖音', '互动次数': 1,
             '是否客户开口': 1, '是否有效线索': 1, '是否为存量客户': 0},
        ])
        with self.flask_app.app_context():
            rows = metrics.fetch_content_platform_monthly(['2026-07', '2026-08'])
        by_key = {(row['platform'], row['month']): row for row in rows}
        self.assertEqual(set(by_key), {('抖音', '2026-07'), ('抖音', '2026-08')})
        self.assertEqual(by_key[('抖音', '2026-07')]['leads'], 1)
        self.assertEqual(by_key[('抖音', '2026-08')]['leads'], 1)


def _monthly_row(platform, month, leads, opened, zero):
    return {'platform': platform, 'month': month, 'leads': leads, 'opened': opened, 'zero': zero}


def _daily_row(platform, day, leads, opened, zero=0):
    return {'platform': platform, 'date': date(2026, 8, day), 'leads': leads, 'opened': opened, 'zero': zero}


class BuildContentEvidenceTest(unittest.TestCase):
    """build_content_evidence：加权基线 / 恢复判定 epsilon 边界 / 输出结构"""

    def _base_platform_monthly(self):
        return [
            _monthly_row('抖音', '2026-05', 100, 40, 20),
            _monthly_row('抖音', '2026-06', 100, 45, 20),
            _monthly_row('抖音', '2026-07', 100, 45, 20),
            _monthly_row('抖音', '2026-08', 100, 30, 40),
            _monthly_row('腾讯', '2026-08', 50, 25, 5),
        ]

    def test_weighted_baseline_and_new_platform(self):
        evidence = engine_mod.build_content_evidence(
            month='2026-08',
            platform_monthly=self._base_platform_monthly(),
            platform_daily=[_daily_row('抖音', 31, 20, 4)],
        )
        self.assertEqual(evidence['month'], '2026-08')
        self.assertEqual(evidence['baseline_months'], ['2026-05', '2026-06', '2026-07'])
        by_platform = {row['platform']: row for row in evidence['platform_monthly']}
        douyin = by_platform['抖音']
        self.assertEqual(douyin['open_rate'], 0.3)
        self.assertEqual(douyin['zero_interaction_rate'], 0.4)
        self.assertEqual(douyin['prev3_open_rate'], 0.4333)
        self.assertEqual(douyin['prev3_zero_interaction_rate'], 0.2)
        tencent = by_platform['腾讯']
        self.assertEqual(tencent['prev3_open_rate'], None)
        recovery = evidence['recovery']
        self.assertEqual(recovery['open_rate'], 0.2)

    def test_recovery_epsilon_boundary(self):
        daily = [_daily_row('抖音', day, 25, 2) for day in (27, 28, 29, 30, 31)]
        evidence = engine_mod.build_content_evidence(
            month='2026-08',
            platform_monthly=[
                _monthly_row('抖音', '2026-07', 1000, 100, 0),
                _monthly_row('抖音', '2026-08', 125, 10, 0),
            ],
            platform_daily=daily,
        )
        recovery = evidence['recovery']
        self.assertEqual(recovery['open_rate'], 0.08)
        self.assertEqual(recovery['prev3_open_rate'], 0.1)
        self.assertEqual(recovery['window'], '月末最后 5 天')
        self.assertTrue(recovery['recovered'])

    def test_recovery_below_threshold(self):
        daily = [_daily_row('抖音', day, 100, 7) for day in (27, 28, 29, 30, 31)]
        evidence = engine_mod.build_content_evidence(
            month='2026-08',
            platform_monthly=[
                _monthly_row('抖音', '2026-07', 1000, 100, 0),
                _monthly_row('抖音', '2026-08', 500, 35, 0),
            ],
            platform_daily=daily,
        )
        self.assertFalse(evidence['recovery']['recovered'])

    def test_recovery_no_data(self):
        evidence = engine_mod.build_content_evidence(
            month='2026-08',
            platform_monthly=[_monthly_row('抖音', '2026-07', 1000, 100, 0)],
            platform_daily=[],
        )
        recovery = evidence['recovery']
        self.assertEqual(recovery['window'], '无数据')
        self.assertEqual(recovery['dates'], [])
        self.assertFalse(recovery['recovered'])

    def test_daily_output_sorted_isoformat(self):
        evidence = engine_mod.build_content_evidence(
            month='2026-08',
            platform_monthly=[],
            platform_daily=[
                _daily_row('抖音', 5, 10, 5),
                _daily_row('腾讯', 2, 10, 3),
                _daily_row('抖音', 2, 10, 8),
            ],
        )
        daily = evidence['daily']
        self.assertEqual(
            [(row['platform'], row['date']) for row in daily],
            [('抖音', '2026-08-02'), ('抖音', '2026-08-05'), ('腾讯', '2026-08-02')],
        )


class EngineWiringTest(SyntheticDbTest):
    """run_diagnosis 顶层输出 content_evidence；空库输出 None"""

    def test_run_diagnosis_attaches_evidence(self):
        self._insert([
            _lead(1, interaction=0),
            _lead(2, interaction=1, opened=0),
            _lead(2, platform='腾讯', interaction=2),
        ])
        with self.flask_app.app_context():
            result = engine_mod.run_diagnosis('2026-08')
        evidence = result['content_evidence']
        self.assertIsNotNone(evidence)
        self.assertEqual(evidence['month'], '2026-08')
        self.assertEqual(evidence['baseline_months'], ['2026-05', '2026-06', '2026-07'])
        by_platform = {row['platform']: row for row in evidence['platform_monthly']}
        self.assertEqual(by_platform['抖音']['leads'], 2)
        self.assertEqual(by_platform['抖音']['open_rate'], 0.5)
        self.assertEqual(by_platform['腾讯']['leads'], 1)
        self.assertEqual(evidence['recovery']['window'], '月末最后 2 天')
        self.assertIn('items', result)
        self.assertIn('summary', result)

    def test_empty_db_returns_none_evidence(self):
        with self.flask_app.app_context():
            result = engine_mod.run_diagnosis('2026-08')
        self.assertIsNone(result['content_evidence'])


def _collapse_ctx():
    return {
        'month': '2026-08',
        'eval_cutoff': date(2026, 8, 20),
        'content_daily': [
            {'date': date(2026, 8, 1), 'total': 10, 'opened': 6, 'valid': 2, 'zero': 3},
            {'date': date(2026, 8, 18), 'total': 10, 'opened': 1, 'valid': 0, 'zero': 9},
            {'date': date(2026, 8, 19), 'total': 10, 'opened': 1, 'valid': 0, 'zero': 9},
            {'date': date(2026, 8, 20), 'total': 10, 'opened': 1, 'valid': 0, 'zero': 9},
        ],
        'content_monthly': {
            '2026-08': {'total': 40, 'opened': 9, 'valid': 2, 'stock': 0, 'zero': 30},
            '2026-05': {'total': 100, 'opened': 50, 'valid': 20, 'stock': 0, 'zero': 10},
            '2026-06': {'total': 100, 'opened': 50, 'valid': 20, 'stock': 0, 'zero': 10},
            '2026-07': {'total': 100, 'opened': 50, 'valid': 20, 'stock': 0, 'zero': 10},
        },
        'baseline_months': ['2026-05', '2026-06', '2026-07'],
    }


class RulesCollapseTest(unittest.TestCase):
    """collapse 规则 evidence 追加零互动占比对比（当月评估窗 vs 前 3 月基线）"""

    def test_collapse_evidence_includes_zero_rate(self):
        item = rules.rule_open_rate_collapse(_collapse_ctx())
        self.assertIsNotNone(item)
        self.assertIn('零互动占比 75.0%', item['evidence'])
        self.assertIn('前 3 月基线 10.0%', item['evidence'])
        self.assertIn('归因', item['detail'])
        self.assertIn('证据', item['suggestion'])


class RulesLevelTest(unittest.TestCase):
    """level 与 valid_quality 规则 evidence 追加零互动占比对比（vs 上期同窗口）"""

    def test_level_error_includes_zero_rate(self):
        ctx = {
            'month': '2026-08',
            'prev_month': '2026-07',
            'cur_mature': {'total': 30, 'opened': 3, 'valid': 0, 'zero': 27},
            'prev_window': {'total': 30, 'opened': 18, 'valid': 6, 'zero': 9},
        }
        item = rules.rule_open_rate_level(ctx)
        self.assertIsNotNone(item)
        self.assertEqual(item['level'], 'error')
        self.assertIn('零互动占比 90.0%', item['evidence'])

    def test_valid_quality_includes_zero_rate(self):
        ctx = {
            'month': '2026-08',
            'prev_month': '2026-07',
            'cur_mature': {'total': 30, 'opened': 10, 'valid': 5, 'zero': 20},
            'prev_window': {'total': 30, 'opened': 15, 'valid': 20, 'zero': 5},
        }
        item = rules.rule_valid_lead_quality(ctx)
        self.assertIsNotNone(item)
        self.assertIn('零互动占比 66.7%', item['evidence'])


class LlmPromptTest(unittest.TestCase):
    """SYSTEM_PROMPT 降维改造：白话角色设定、疑似归因指引、固定章节、版本升级"""

    def test_prompt_version_bumped(self):
        self.assertEqual(llm_mod.PROMPT_VERSION, 3)

    def test_prompt_plain_language_sections(self):
        prompt = llm_mod.SYSTEM_PROMPT
        for marker in (
            '## 总体判断',
            '## 分链路解读（内容平台 / 应用市场）',
            '## 跨月趋势对比',
            '## 需要人工核对的事项',
            '## 行动建议',
        ):
            self.assertIn(marker, prompt)
        self.assertIn('疑似', prompt)
        self.assertIn('零互动', prompt)
        self.assertIn('置信度', prompt)


def _result(month, evidence=None):
    result = {
        'month': month,
        'snapshot_dates': [],
        'summary': {},
        'items': [{
            'id': 'x', 'chain': 'xhs', 'level': 'warn', 'title': 't',
            'detail': 'd', 'evidence': 'e', 'suggestion': 's', 'extra': '多余键',
        }],
    }
    if evidence is not None:
        result['content_evidence'] = evidence
    return result


def _evidence():
    return {
        'month': '2026-08',
        'baseline_months': ['2026-05', '2026-06', '2026-07'],
        'platform_monthly': [{
            'platform': '抖音', 'leads': 10, 'open_rate': 0.5, 'zero_interaction_rate': 0.1,
            'prev3_open_rate': 0.6, 'prev3_zero_interaction_rate': 0.05,
        }],
        'daily': [
            {'platform': '抖音', 'date': '2026-08-%02d' % (day % 31 + 1),
             'leads': 1, 'open_rate': 0.5, 'zero_interaction_rate': 0.1}
            for day in range(310)
        ],
        'xun': [],
        'recovery': {'window': '月末最后 5 天', 'dates': [], 'open_rate': 0.08,
                     'prev3_open_rate': 0.1, 'recovered': True},
    }


class LlmPayloadTest(unittest.TestCase):
    """payload 瘦身：仅最后月带证据、daily 截断、多余键裁剪、hash 覆盖证据"""

    def test_only_last_month_carries_evidence(self):
        slim = llm_mod._slim_results([
            _result('2026-07', evidence=_evidence()),
            _result('2026-08', evidence=_evidence()),
        ])
        self.assertNotIn('content_evidence', slim[0])
        self.assertIn('content_evidence', slim[1])

    def test_slim_result_without_evidence_key_tolerates(self):
        slim = llm_mod._slim_result(_result('2026-08'), include_evidence=True)
        self.assertNotIn('content_evidence', slim)

    def test_item_keys_trimmed(self):
        slim = llm_mod._slim_result(_result('2026-08'))
        self.assertEqual(
            set(slim['items'][0]),
            {'id', 'chain', 'level', 'title', 'detail', 'evidence', 'suggestion'},
        )

    def test_daily_truncated(self):
        slim = llm_mod._slim_result(_result('2026-08', evidence=_evidence()), include_evidence=True)
        self.assertEqual(len(slim['content_evidence']['daily']), llm_mod.EVIDENCE_DAILY_LIMIT)

    def test_signals_hash_covers_evidence(self):
        base = [_result('2026-08', evidence=_evidence())]
        raw = _evidence()
        flipped = [_result('2026-08', evidence={
            **raw, 'recovery': {**raw['recovery'], 'recovered': False},
        })]
        self.assertNotEqual(llm_mod._signals_hash(base), llm_mod._signals_hash(flipped))

    def test_build_user_prompt_includes_evidence(self):
        prompt = llm_mod.build_user_prompt([_result('2026-08', evidence=_evidence())])
        payload = json.loads(prompt)
        self.assertIn('content_evidence', payload[0])


if __name__ == '__main__':
    unittest.main()
