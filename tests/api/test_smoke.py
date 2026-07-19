# -*- coding: utf-8 -*-
"""省心投 BI - 后端 API 冒烟测试

目标：快速验证核心接口返回 200 + 响应结构合法。
设计原则：
  - 零新增依赖（unittest + Flask test_client）
  - 快：< 10 秒跑完
  - 不写数据库（只读）
  - 只验证"能正常响应"，不验证业务数值正确性

运行：
  - 全部：   python -m unittest discover -s tests/api -v
  - 单文件： python -m unittest tests.api.test_smoke -v
"""

import os
import sys
import unittest
import json

# 确保项目根目录在 sys.path 中
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# 关闭启动日志噪音
import logging
logging.disable(logging.CRITICAL)

from app import app  # noqa: E402

SAMPLE_START = '2026-06-01'
SAMPLE_END = '2026-06-30'


def _is_blank(v):
    return v is None or v == '' or v == [] or v == {}


class ApiSmokeTest(unittest.TestCase):
    """核心 API 冒烟测试。"""

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
        # 统一解包 { success: true, data: ... } 格式
        if isinstance(data, dict) and 'data' in data and 'success' in data:
            return data['data']
        return data

    def _dash_payload(self):
        return {
            'start_date': SAMPLE_START,
            'end_date': SAMPLE_END,
            'platforms': [],
            'agencies': [],
            'business_models': [],
        }

    # ============================================================
    #  基础 GET 接口
    # ============================================================

    def test_01_health(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)

    def test_02_version_local(self):
        data = self._ok(self.client.get('/api/v1/version/local'), '/version/local')
        self.assertIn('version', data)

    def test_03_metadata(self):
        data = self._ok(self.client.get('/api/v1/metadata'), '/metadata')
        # 至少包含平台 / 代理商 / 业务模式之一
        self.assertTrue(
            any(k in data for k in ['platforms', 'agencies', 'channels']),
            f'metadata 缺少关键字段: {list(data.keys())[:6]}')

    def test_04_data_freshness(self):
        data = self._ok(self.client.get('/api/v1/data-freshness'), '/data-freshness')
        # 返回 { 表名: { status, latest_date, ... } } 的 dict
        self.assertIsInstance(data, dict)
        self.assertGreater(len(data), 0, 'data-freshness 返回空')

    def test_05_employees(self):
        data = self._ok(self.client.get('/api/v1/employees'), '/employees')
        self.assertIsInstance(data, list)

    def test_06_account_mapping(self):
        data = self._ok(self.client.get('/api/v1/account-mapping'), '/account-mapping')
        self.assertIsInstance(data, list)

    def test_07_upload_data_types(self):
        data = self._ok(self.client.get('/api/v1/data-types'), '/data-types')
        # 可能是 list 或 dict，只要有数据就行
        self.assertIsInstance(data, (list, dict))

    def test_08_upload_history(self):
        data = self._ok(self.client.get('/api/v1/history'), '/history')
        self.assertIsInstance(data, (list, dict))

    # ============================================================
    #  Dashboard 三大核心接口
    # ============================================================

    def test_00_dashboard_core_metrics(self):
        data = self._ok(
            self._post('/api/v1/dashboard/core-metrics', self._dash_payload()),
            '/dashboard/core-metrics')
        # 不同版本字段名可能不同，只要是 dict 且非空即可
        self.assertIsInstance(data, dict)
        self.assertGreater(len(data), 0, 'core-metrics 返回空')

    def test_01_dashboard_trend_data(self):
        payload = dict(self._dash_payload(), metrics=['opened', 'cost'], period='day')
        data = self._ok(
            self._post('/api/v1/dashboard/trend-data', payload),
            '/dashboard/trend-data')
        self.assertIsInstance(data, dict)
        self.assertGreater(len(data), 0, 'trend-data 返回空')

    def test_02_dashboard_accounts(self):
        data = self._ok(
            self._post('/api/v1/dashboard/accounts', self._dash_payload()),
            '/dashboard/accounts')
        # 可能返回 list 或 dict（带分页）
        self.assertIsInstance(data, (list, dict))

    # ============================================================
    #  趋势 / 转化漏斗 / 厂商分析 / 成本分析
    # ============================================================

    def test_20_trend(self):
        data = self._ok(self._post('/api/v1/trend', self._dash_payload()), '/trend')
        self.assertIsInstance(data, dict)

    def test_21_conversion_funnel(self):
        data = self._ok(
            self._post('/api/v1/conversion-funnel', self._dash_payload()),
            '/conversion-funnel')
        self.assertIsInstance(data, dict)

    def test_22_conversion_funnel_split(self):
        data = self._ok(
            self._post('/api/v1/conversion-funnel/split', self._dash_payload()),
            '/conversion-funnel/split')
        self.assertIsInstance(data, dict)

    def test_23_agency_analysis(self):
        data = self._ok(
            self._post('/api/v1/agency-analysis', self._dash_payload()),
            '/agency-analysis')
        self.assertIsInstance(data, (list, dict))

    def test_24_cost_analysis(self):
        data = self._ok(
            self._post('/api/v1/cost-analysis', self._dash_payload()),
            '/cost-analysis')
        self.assertIsInstance(data, (list, dict))

    # ============================================================
    #  数据周报
    # ============================================================

    def test_30_weekly_periods(self):
        data = self._ok(
            self.client.get('/api/v1/reports/weekly/periods'),
            '/reports/weekly/periods')
        # 返回的是 list（周次数组）
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0, '周次列表为空')

    def test_31_weekly_data_by_week(self):
        payload = {'report_year': 2026, 'report_week': 23}
        data = self._ok(
            self._post('/api/v1/reports/weekly/data', payload),
            '/reports/weekly/data (week)')
        self.assertIn('current_week', data)
        self.assertIn('channels', data)

    def test_32_weekly_data_by_dates(self):
        payload = {'start_date': '2026-06-01', 'end_date': '2026-06-07'}
        data = self._ok(
            self._post('/api/v1/reports/weekly/data', payload),
            '/reports/weekly/data (dates)')
        self.assertIn('current_week', data)

    # ============================================================
    #  全渠道报告 / 应用市场报告
    # ============================================================

    def test_40_omni_channel_summary(self):
        payload = {'start_date': SAMPLE_START, 'end_date': SAMPLE_END}
        data = self._ok(
            self._post('/api/v1/reports/omni-channel/summary', payload),
            '/reports/omni-channel/summary')
        self.assertIsInstance(data, dict)

    def test_41_omni_channel_daily_calendar(self):
        payload = {'days': 90}
        data = self._ok(
            self._post('/api/v1/reports/omni-channel/daily-calendar', payload),
            '/reports/omni-channel/daily-calendar')
        self.assertIsInstance(data, list)

    def test_42_omni_channel_filter_options(self):
        data = self._ok(
            self.client.get('/api/v1/reports/omni-channel/filter-options'),
            '/reports/omni-channel/filter-options')
        self.assertIsInstance(data, dict)

    def test_43_app_market_summary(self):
        payload = {'start_date': SAMPLE_START, 'end_date': SAMPLE_END}
        data = self._ok(
            self._post('/api/v1/reports/app-market/summary', payload),
            '/reports/app-market/summary')
        self.assertIsInstance(data, dict)

    def test_44_app_market_funnel(self):
        payload = {'start_date': SAMPLE_START, 'end_date': SAMPLE_END}
        data = self._ok(
            self._post('/api/v1/reports/app-market/funnel', payload),
            '/reports/app-market/funnel')
        self.assertIsInstance(data, dict)

    def test_45_app_market_filter_options(self):
        data = self._ok(
            self.client.get('/api/v1/reports/app-market/filter-options'),
            '/reports/app-market/filter-options')
        self.assertIsInstance(data, dict)

    # ============================================================
    #  员工转化 / 线索明细 / 小红书
    # ============================================================

    def test_50_employee_conversion_analysis(self):
        payload = {'start_date': SAMPLE_START, 'end_date': SAMPLE_END}
        data = self._ok(
            self._post('/api/v1/employee-conversion/analysis', payload),
            '/employee-conversion/analysis')
        self.assertIsInstance(data, dict)

    def test_51_employee_conversion_employees(self):
        data = self._ok(
            self.client.get('/api/v1/employee-conversion/employees'),
            '/employee-conversion/employees')
        self.assertIsInstance(data, list)

    def test_52_leads_detail_filter_options(self):
        data = self._ok(
            self.client.get('/api/v1/leads-detail/filter-options'),
            '/leads-detail/filter-options')
        self.assertIsInstance(data, dict)

    def test_53_xhs_notes_filter_options(self):
        data = self._ok(
            self.client.get('/api/v1/xhs-notes/filter-options'),
            '/xhs-notes/filter-options')
        self.assertIsInstance(data, dict)

    def test_54_xhs_notes_list(self):
        data = self._ok(
            self.client.get('/api/v1/xhs-notes/list'),
            '/xhs-notes/list')
        # 返回的是带 list/pagination 的 dict 也 OK
        self.assertIsInstance(data, (list, dict))

    # ============================================================
    #  v3.3.0: 主播聚类 live_type（映射表由 JSON 同步到 DB，无独立 CRUD API）
    # ============================================================

    def test_62_anchor_clusters_with_live_type(self):
        payload = {
            'filters': {
                'start_date': '2026-01-01',
                'end_date': '2026-12-31',
            },
            'top_n': 50,
        }
        data = self._ok(
            self._post('/api/v1/leads-detail/anchor-clusters', payload),
            '/leads-detail/anchor-clusters')
        self.assertIsInstance(data, dict)
        self.assertIn('items', data)
        self.assertIn('live_types', data)
        self.assertIn('live_type_breakdown', data)
        # 至少应有一项带 live_type 标签（配置表已种子化）
        if data['items']:
            item = data['items'][0]
            self.assertIn('live_type', item)
            self.assertIn('live_types', item)
            self.assertIn('secondary_live_types', item)

    def test_63_anchor_clusters_live_type_filter(self):
        # 仅看「带货直播」：应只剩 3 位带货主播
        payload = {
            'filters': {
                'start_date': '2026-01-01',
                'end_date': '2026-12-31',
                'live_types': ['带货直播'],
            },
            'top_n': 50,
        }
        data = self._ok(
            self._post('/api/v1/leads-detail/anchor-clusters', payload),
            '/leads-detail/anchor-clusters (live_types=带货直播)')
        items = data.get('items', [])
        self.assertLessEqual(len(items), 3, '带货直播主播应≤3位')

    # ============================================================
    #  边界：空 payload 不应 500
    # ============================================================

    def test_90_dashboard_empty_not_500(self):
        resp = self._post('/api/v1/dashboard/core-metrics', {})
        self.assertNotEqual(resp.status_code, 500,
                            f'空 payload 500: {resp.data[:300]}')

    def test_91_weekly_data_empty_not_500(self):
        resp = self._post('/api/v1/reports/weekly/data', {})
        self.assertNotEqual(resp.status_code, 500,
                            f'空 payload 500: {resp.data[:300]}')

    def test_92_omni_channel_empty_not_500(self):
        resp = self._post('/api/v1/reports/omni-channel/summary', {})
        self.assertNotEqual(resp.status_code, 500,
                            f'空 payload 500: {resp.data[:300]}')


if __name__ == '__main__':
    unittest.main(verbosity=2)
