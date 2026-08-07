# -*- coding: utf-8 -*-
"""核心报表数值口径回归测试（v3.7.x）

目标：把 anchor-clusters 已有的 totals=Σitems 对账模式扩展到核心报表，
     拦截"聚合/展示数值虚高"这类问题（如重复行、漏字段映射导致的指标错位）。

覆盖端点：
  - agency-analysis  厂商分析：合计行(is_total) = 明细行之和
  - investment-review 投放评审：每个厂商桶内 总计(is_total) = 各月度行之和

设计原则（与 test_anchor_clusters_calibration 一致）：
  - 零新增依赖（unittest + Flask test_client）
  - 不写数据库（只读）
  - 验证数值口径，而非仅结构存在性
  - 无数据时 skipTest（CI 空库不失败）

运行：
  - 全部：   python -m unittest discover -s tests/api -v
  - 单文件： python -m unittest tests.api.test_numeric_calibration -v
"""

import os
import sys
import unittest
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import logging
logging.disable(logging.CRITICAL)

from app import app  # noqa: E402

SAMPLE_START = '2025-01-01'
SAMPLE_END = '2026-12-31'


class NumericCalibrationTest(unittest.TestCase):
    """核心报表数值口径验证。"""

    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()

    def _post(self, path, payload=None):
        return self.client.post(
            path,
            data=json.dumps(payload or {}),
            content_type='application/json',
        )

    def _ok(self, resp, path):
        self.assertEqual(resp.status_code, 200,
                         f'{path} => {resp.status_code}: {resp.data[:300]}')
        data = resp.get_json()
        self.assertIsNotNone(data, f'{path} => 非 JSON 响应')
        if isinstance(data, dict) and 'data' in data and 'success' in data:
            return data['data']
        return data

    def _payload(self):
        return {
            'filters': {
                'start_date': SAMPLE_START,
                'end_date': SAMPLE_END,
                'platforms': [],
                'agencies': [],
                'business_models': [],
            }
        }

    # ============================================================
    #  厂商分析：合计(is_total) = 明细行之和
    # ============================================================

    def test_agency_analysis_total_equals_items_sum(self):
        """厂商分析合计行的各指标 = 明细行（非小计/非合计）对应指标之和。"""
        data = self._ok(
            self._post('/api/v1/agency-analysis', self._payload()),
            '/agency-analysis')
        summary = data.get('summary', [])
        detail_rows = [r for r in summary if not r.get('is_subtotal') and not r.get('is_total')]
        total_rows = [r for r in summary if r.get('is_total')]

        if not detail_rows:
            self.skipTest('无明细数据，跳过口径验证')

        self.assertEqual(len(total_rows), 1, '厂商分析应恰好有 1 个合计行')

        total = total_rows[0]['metrics']
        metrics_keys = ['cost', 'impressions', 'clicks', 'lead_users',
                        'opened_account_users', 'valid_customer_users',
                        'opened_account_assets', 'existing_customer_assets',
                        'app_activation_users']

        for key in metrics_keys:
            items_sum = round(sum(r['metrics'].get(key, 0) for r in detail_rows), 2)
            total_val = total.get(key, 0)
            self.assertAlmostEqual(
                total_val, items_sum, places=1,
                msg=f'厂商分析合计 metrics.{key}({total_val}) ≠ Σ 明细({items_sum})')

    # ============================================================
    #  投放评审：每个厂商桶内 总计(is_total) = 各月度行之和
    # ============================================================

    def test_investment_review_total_equals_monthly_sum(self):
        """投放评审每个厂商的 is_total 行 = 该厂商各月度行之和。"""
        data = self._ok(
            self._post('/api/v1/investment-review', self._payload()),
            '/investment-review')
        monthly = data.get('monthly', {})
        agencies = data.get('agencies', [])

        if not agencies:
            self.skipTest('无厂商数据，跳过口径验证')

        checked = 0
        for agency in agencies:
            rows = monthly.get(agency, [])
            month_rows = [r for r in rows if not r.get('is_total')]
            total_rows = [r for r in rows if r.get('is_total')]
            if not month_rows or not total_rows:
                continue
            checked += 1
            total = total_rows[0]
            for key in ['cost', 'leads', 'opened_conversation', 'opened_account', 'app_activation']:
                month_sum = round(sum(r.get(key, 0) for r in month_rows), 2)
                total_val = total.get(key, 0)
                self.assertAlmostEqual(
                    total_val, month_sum, places=1,
                    msg=f'投放评审 厂商[{agency}] {key}({total_val}) ≠ Σ 月度({month_sum})')

        if checked == 0:
            self.skipTest('所有厂商均无 总计行 可对账，跳过')


if __name__ == '__main__':
    unittest.main(verbosity=2)
