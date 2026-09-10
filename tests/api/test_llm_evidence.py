# -*- coding: utf-8 -*-
"""AI 报告业务证据包测试（内存 SQLite 合成数据，不依赖真实库与 Flask app）。

覆盖口径：
- vendor：月×厂商×平台聚合、当月 vs 前 3 月、脏日期排除、成本派生；
- note：衰退判定（前 3 月月均开口 ≥10 且当月跌破 30%）、非存量口径、
  无笔记归属行排除、停投候选、内容类型聚合、当月新笔记；
- appmarket：仅互联网引流（合作机构行必须排除）、「是否新开户」作为漏斗
  末段计数而不做 WHERE 过滤、版位 JOIN、户均派生。
"""
import sys
import unittest
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
from backend.models_v2 import (
    AggVendorDaily,
    AggXhsNote,
    DimAdPlanClass,
    FactConvAppmarket,
    FactConvContent,
)
from backend.utils import llm_evidence

MONTH = '2026-08'
PREV = ['2026-05', '2026-06', '2026-07']
MONTHS = PREV + [MONTH]


class SyntheticDbTest(unittest.TestCase):
    """内存 SQLite 基类：create_all 一次性建全部 models_v2 表"""

    TABLES = ()

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
            for model in self.TABLES:
                db.session.query(model).delete()
            db.session.commit()

    def _add_all(self, rows):
        """显式赋自增 id（SQLite 内存库 BigInteger 主键不自动赋值，与既有测试一致）"""
        for index, row in enumerate(rows, start=1):
            row.id = index
        db.session.add_all(rows)
        db.session.commit()


class VendorEvidenceTest(SyntheticDbTest):
    TABLES = (AggVendorDaily,)

    @staticmethod
    def _vendor_row(day, vendor, platform, **kw):
        row = {'日期': day, '厂商': vendor, '平台': platform, '业务模式': kw.pop('mode', '信息流')}
        row.update(kw)
        return AggVendorDaily(**row)

    def _seed(self):
        rows = []
        # 量子：小红书，当月 + 前 3 月各一月
        rows.append(self._vendor_row('2026-08-10', '量子', '小红书',
                                     花费=1000, 线索数=100, 开口人数=60, 有效线索数=30,
                                     开户人数=10, 有效户人数=5, 客户资产=50000, 客户创收=2000))
        for month in PREV:
            rows.append(self._vendor_row('%s-10' % month, '量子', '小红书',
                                         花费=1000, 线索数=100, 开口人数=60, 有效线索数=30,
                                         开户人数=10, 有效户人数=5, 客户资产=50000, 客户创收=2000))
        # 绩牛：抖音，当月花费更高
        rows.append(self._vendor_row('2026-08-11', '绩牛', '抖音',
                                     花费=2000, 线索数=80, 开口人数=20, 有效线索数=10,
                                     开户人数=4, 有效户人数=2, 客户资产=20000, 客户创收=500))
        # 应用市场侧厂商（APP 下载模式）
        rows.append(self._vendor_row('2026-08-12', '有米', 'oppo', mode='APP下载',
                                     花费=500, APP下载数=400, APP激活人数=300))
        # 历史脏日期：月份 IN 过滤天然排除
        rows.append(self._vendor_row('1990-01-01', '量子', '小红书', 花费=999999, 线索数=999))
        self._add_all(rows)

    def test_vendor_aggregation_and_ranking(self):
        with self.flask_app.app_context():
            self._seed()
            rows = llm_evidence.fetch_vendor_monthly(MONTHS)
            out = llm_evidence.build_vendor_evidence(MONTH, rows)
        self.assertEqual(len(out), 3)  # 脏日期行不进聚合
        self.assertEqual([v['vendor'] for v in out], ['绩牛', '量子', '有米'])  # 当月花费降序
        quantum = next(v for v in out if v['vendor'] == '量子')
        self.assertEqual(quantum['current']['leads'], 100)
        self.assertEqual(quantum['prev3']['leads'], 300)
        self.assertEqual(quantum['current']['open_rate'], 0.6)
        self.assertEqual(quantum['current']['lead_cost'], 10.0)
        self.assertEqual(quantum['current']['eff_account_cost'], 200.0)
        self.assertEqual(quantum['platforms_current'][0]['platform'], '小红书')
        youmi = next(v for v in out if v['vendor'] == '有米')
        self.assertEqual(youmi['current']['app_downloads'], 400)
        self.assertEqual(youmi['current']['leads'], 0)
        self.assertIsNone(youmi['current']['lead_cost'])  # 分母为 0 → None


class NoteEvidenceTest(SyntheticDbTest):
    TABLES = (FactConvContent, AggXhsNote)

    @staticmethod
    def _lead(day, note_id, note_name, opened, stock=0):
        return FactConvContent(
            线索日期=day, 平台来源='小红书', 笔记ID=note_id, 笔记名称=note_name,
            是否客户开口=opened, 是否有效线索=1 if opened else 0, 是否为存量客户=stock,
            是否开户=0, 互动次数=1 if opened else None,
        )

    def _seed(self):
        leads = []
        # 笔记A：前 3 月每月 20 条线索、15 开口；当月 10 条、仅 2 开口 → 衰退
        for month in PREV:
            for i in range(20):
                leads.append(self._lead('%s-%02d' % (month, i + 1), 'noteA', 'AAA 高股息选题', 1 if i < 15 else 0))
        for i in range(10):
            leads.append(self._lead('2026-08-%02d' % (i + 1), 'noteA', 'AAA 高股息选题', 1 if i < 2 else 0))
        # 笔记B：当月 30 条、20 开口 → watch top；另有 1 条存量行必须被排除
        for i in range(30):
            leads.append(self._lead('2026-08-%02d' % (i + 1), 'noteB', 'BBB 打新科普', 1 if i < 20 else 0))
        leads.append(self._lead('2026-08-15', 'noteB', 'BBB 打新科普', 1, stock=1))
        # 无笔记归属行：不进转化侧聚合
        leads.append(self._lead('2026-08-16', None, None, 1))
        notes = [
            AggXhsNote(笔记ID='noteB', 笔记标题='BBB 打新科普', 内容类型='图文笔记',
                       发布时间='2026-07-01 00:00:00', 总展现量=100000, 总点击率=0.05,
                       私信进线人数=80, 企微成功添加人数=25, 加微成本=12.5,
                       开户人数=8, 消费金额=500),
            AggXhsNote(笔记ID='noteStop', 笔记标题='CCC 无效投放笔记', 内容类型='视频笔记',
                       发布时间='2026-06-01 00:00:00', 总展现量=50000, 总点击率=0.01,
                       私信进线人数=0, 企微成功添加人数=0, 加微成本=None,
                       开户人数=0, 消费金额=2000),
            AggXhsNote(笔记ID='noteNew', 笔记标题='DDD 当月新笔记', 内容类型='图文笔记',
                       发布时间='2026-08-15 00:00:00', 总展现量=8000, 总点击率=0.08,
                       私信进线人数=10, 企微成功添加人数=5, 加微成本=20.0,
                       开户人数=1, 消费金额=100),
        ]
        self._add_all(leads)
        self._add_all(notes)

    def test_note_layering(self):
        with self.flask_app.app_context():
            self._seed()
            evidence = llm_evidence.build_note_evidence(
                MONTH,
                llm_evidence.fetch_note_conversion_monthly(MONTHS),
                llm_evidence.fetch_note_snapshot(),
            )
        # watch top：BBB 当月开口 20（存量行不计入）
        self.assertEqual(evidence['watch_top'][0]['note'], 'BBB 打新科普')
        self.assertEqual(evidence['watch_top'][0]['opened'], 20)
        self.assertEqual(evidence['watch_top'][0]['snapshot']['adds'], 25)
        # 衰退：AAA 前 3 月月均 15，当月 2 ≤ 15*0.3
        self.assertEqual(len(evidence['declining']), 1)
        decline = evidence['declining'][0]
        self.assertEqual(decline['note'], 'AAA 高股息选题')
        self.assertEqual(decline['prev3_avg_opened'], 15.0)
        self.assertEqual(decline['current_opened'], 2)
        # 停投候选：CCC 消费 2000 且加微 0
        self.assertEqual(len(evidence['stop_candidates']), 1)
        self.assertEqual(evidence['stop_candidates'][0]['cost'], 2000.0)
        # 新笔记：DDD 当月发布
        self.assertEqual(len(evidence['new_notes']), 1)
        self.assertEqual(evidence['new_notes'][0]['note'], 'DDD 当月新笔记')
        # 类型聚合：图文 2 篇、视频 1 篇，按加微降序
        types = {t['type']: t for t in evidence['content_types']}
        self.assertEqual(types['图文笔记']['notes'], 2)
        self.assertEqual(types['视频笔记']['notes'], 1)
        self.assertEqual([t['type'] for t in evidence['content_types']][0], '图文笔记')
        self.assertEqual(evidence['snapshot_note_count'], 3)
        self.assertEqual(evidence['conversion_tracked_note_count'], 2)  # 无笔记行排除


class AppmarketEvidenceTest(SyntheticDbTest):
    TABLES = (FactConvAppmarket, DimAdPlanClass)

    @staticmethod
    def _download(day, store, activated=0, registered=0, funded=0, opened=0,
                  new_account=0, deposited=0, eff=0, asset=0.0, channel='互联网引流',
                  plan_id=1001):
        return FactConvAppmarket(
            下载日期=day, 应用市场=store.upper(), 渠道类型=channel, 广告计划ID=plan_id,
            是否激活APP=activated, 是否开户注册=registered, 是否创建完资金账号=funded,
            是否开户成功=opened, 是否新开户=new_account, 是否入金=deposited,
            是否有效户=eff, 总资产=float(asset),
        )

    def _seed(self):
        rows = [
            # oppo 当月：10 下载（含 1 行存量新开户，验证新开户不做 WHERE 过滤）
            DimAdPlanClass(应用市场='oppo', 广告分组ID=1001, 广告分组名称='oppo搜索A', 版位='搜索', 出价='CPD'),
            DimAdPlanClass(应用市场='vivo', 广告分组ID=1002, 广告分组名称='vivo推荐B', 版位='推荐', 出价='ocpd付费'),
        ]
        oppo_specs = [
            dict(activated=1, registered=1, funded=1, opened=1, new_account=1, deposited=1, eff=1, asset=5000),
            dict(activated=1, registered=1, funded=1, opened=1, new_account=1, deposited=0, eff=0, asset=3000),
            dict(activated=1, registered=1, funded=0, opened=0, new_account=0, asset=0),
            dict(activated=1, registered=0, asset=0),
            dict(activated=1, registered=0, asset=0),
            dict(activated=0, asset=0), dict(activated=0, asset=0), dict(activated=0, asset=0),
            dict(activated=0, asset=0), dict(activated=0, asset=0),
        ]
        for spec in oppo_specs:
            rows.append(self._download('2026-08-%02d' % (len(rows) + 1), 'oppo', **spec))
        # vivo 当月：5 下载、1 新开户
        for i in range(5):
            rows.append(self._download('2026-08-%02d' % (i + 1), 'vivo', plan_id=1002,
                                       activated=1 if i < 2 else 0,
                                       new_account=1 if i == 0 else 0, asset=2000 if i == 0 else 0))
        # oppo 前 3 月基线：8 下载
        for month in PREV:
            for i in range(8):
                rows.append(self._download('%s-%02d' % (month, i + 1), 'oppo'))
        # 合作机构渠道：必须整体排除
        for i in range(9):
            rows.append(self._download('2026-08-%02d' % (i + 1), 'oppo', channel='合作机构',
                                       activated=1, new_account=1, asset=99999))
        self._add_all(rows)

    def test_store_funnel_and_channel_filter(self):
        with self.flask_app.app_context():
            self._seed()
            out = llm_evidence.build_appmarket_evidence(
                MONTH,
                llm_evidence.fetch_appmarket_store_monthly(MONTHS),
                llm_evidence.fetch_appmarket_placement(MONTH),
                llm_evidence.fetch_appmarket_plans_top(MONTH),
            )
        stores = {s['store']: s for s in out['stores']}
        self.assertEqual(set(stores), {'oppo', 'vivo'})  # 合作机构行不产生商店外新键
        oppo = stores['oppo']
        # 合作机构 9 行被排除：当月下载 = 10 而非 19
        self.assertEqual(oppo['current']['downloads'], 10)
        self.assertEqual(oppo['prev3']['downloads'], 24)
        self.assertEqual(oppo['current']['activated'], 5)
        self.assertEqual(oppo['current']['new_accounts'], 2)
        self.assertEqual(oppo['current']['activation_rate'], 0.5)
        # 新开户不做 WHERE 过滤：末段值直接来自 flag 求和
        self.assertEqual(oppo['current']['asset'], 8000.0)
        self.assertEqual(oppo['current']['asset_per_new_account'], 4000.0)
        vivo = stores['vivo']
        self.assertEqual(vivo['current']['downloads'], 5)
        self.assertEqual(vivo['current']['new_accounts'], 1)
        # 版位：oppo 搜索 10 下载 2 新开户；vivo 推荐 5 下载 1 新开户
        placements = {(p['store'], p['placement']): p for p in
                      out['placement_potential'] + out['placement_watchlist']}
        self.assertIn(('oppo', '搜索'), placements)
        self.assertEqual(placements[('oppo', '搜索')]['new_accounts'], 2)
        self.assertEqual(placements[('vivo', '推荐')]['downloads'], 5)
        # 计划 TOP：按下载降序
        self.assertEqual(out['plans_top'][0]['store'], 'oppo')
        self.assertEqual(out['plans_top'][0]['plan'], 'oppo搜索A')


if __name__ == '__main__':
    unittest.main()
