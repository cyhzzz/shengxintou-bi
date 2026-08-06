# -*- coding: utf-8 -*-
"""anchor-clusters 口径验证测试

目标：验证主播聚类端点的数值口径与业务不变式一致。
设计原则：
  - 零新增依赖（unittest + Flask test_client）
  - 不写数据库（只读）
  - 验证数值口径，而非仅结构存在性
  - 容忍浮点舍入误差（round to 2 decimals）

口径依据（leads.py get_anchor_clusters）：
  - 存量剔除：是否为存量客户 == 0 OR IS NULL
  - new_opened = 是否开户==1 AND 非存量
  - new_valid = 是否为有效户==1 AND 非存量
  - new_assets = 非存量记录的资产之和
  - existing_assets = 存量记录的资产之和
  - assets = new_assets + existing_assets（总量）
  - opening_rate = new_opened / leads * 100
  - valid_rate = new_valid / leads * 100

运行：
  - 全部：   python -m unittest discover -s tests/api -v
  - 单文件： python -m unittest tests.api.test_anchor_clusters_calibration -v
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


class AnchorClustersCalibrationTest(unittest.TestCase):
    """anchor-clusters 数值口径验证。"""

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

    def _fetch_clusters(self, filters=None, top_n=200):
        payload = {
            'filters': filters or {
                'start_date': '2026-01-01',
                'end_date': '2026-12-31',
            },
            'top_n': top_n,
        }
        return self._ok(
            self._post('/api/v1/leads-detail/anchor-clusters', payload),
            '/leads-detail/anchor-clusters')

    # ============================================================
    #  口径 1: totals 汇总 = items 逐项求和
    # ============================================================

    def test_totals_match_items_sum(self):
        """totals 的各汇总字段必须等于 items 逐项求和。"""
        data = self._fetch_clusters()
        items = data.get('items', [])
        totals = data.get('totals', {})

        if not items:
            self.skipTest('无数据，跳过口径验证')

        sum_leads = sum(i['leads'] for i in items)
        sum_new_leads = sum(i['new_leads'] for i in items)
        sum_opened = sum(i['opened'] for i in items)
        sum_new_opened = sum(i['new_opened'] for i in items)
        sum_valid = sum(i['valid'] for i in items)
        sum_new_valid = sum(i['new_valid'] for i in items)
        sum_new_assets = round(sum(i['new_assets'] for i in items), 2)
        sum_existing_assets = round(sum(i['existing_assets'] for i in items), 2)
        sum_assets = round(sum(i['assets'] for i in items), 2)

        self.assertEqual(totals['total_leads'], sum_leads,
                         'total_leads ≠ Σ items.leads')
        self.assertEqual(totals['total_new_leads'], sum_new_leads,
                         'total_new_leads ≠ Σ items.new_leads')
        self.assertEqual(totals['total_opened'], sum_opened,
                         'total_opened ≠ Σ items.opened')
        self.assertEqual(totals['total_new_opened'], sum_new_opened,
                         'total_new_opened ≠ Σ items.new_opened')
        self.assertEqual(totals['total_valid'], sum_valid,
                         'total_valid ≠ Σ items.valid')
        self.assertEqual(totals['total_new_valid'], sum_new_valid,
                         'total_new_valid ≠ Σ items.new_valid')
        self.assertAlmostEqual(totals['total_new_assets'], sum_new_assets, places=1,
                               msg='total_new_assets ≠ Σ items.new_assets')
        self.assertAlmostEqual(totals['total_existing_assets'], sum_existing_assets, places=1,
                               msg='total_existing_assets ≠ Σ items.existing_assets')
        self.assertAlmostEqual(totals['total_assets'], sum_assets, places=1,
                               msg='total_assets ≠ Σ items.assets')

    # ============================================================
    #  口径 2: 资产拆分不变式 new_assets + existing_assets ≈ assets
    # ============================================================

    def test_asset_split_invariant(self):
        """每个主播聚类项：new_assets + existing_assets ≈ assets（允许 ±1% 舍入）。"""
        data = self._fetch_clusters()
        items = data.get('items', [])

        if not items:
            self.skipTest('无数据，跳过口径验证')

        for item in items:
            assets = item['assets']
            if assets == 0:
                continue
            split_sum = item['new_assets'] + item['existing_assets']
            diff_ratio = abs(split_sum - assets) / max(assets, 0.01)
            self.assertLess(
                diff_ratio, 0.01,
                f"主播 {item['anchor']}: new_assets({item['new_assets']}) + "
                f"existing_assets({item['existing_assets']}) = {split_sum} "
                f"≠ assets({assets}), 偏差 {diff_ratio:.4f}"
            )

    # ============================================================
    #  口径 3: 子集不变式 new_opened ≤ opened, new_valid ≤ valid
    # ============================================================

    def test_subset_invariant(self):
        """新开户 ≤ 总开户，新有效户 ≤ 总有效户（新口径是总量的子集）。"""
        data = self._fetch_clusters()
        items = data.get('items', [])

        if not items:
            self.skipTest('无数据，跳过口径验证')

        for item in items:
            self.assertLessEqual(
                item['new_opened'], item['opened'],
                f"主播 {item['anchor']}: new_opened({item['new_opened']}) > opened({item['opened']})")
            self.assertLessEqual(
                item['new_valid'], item['valid'],
                f"主播 {item['anchor']}: new_valid({item['new_valid']}) > valid({item['valid']})")
            self.assertLessEqual(
                item['new_leads'], item['leads'],
                f"主播 {item['anchor']}: new_leads({item['new_leads']}) > leads({item['leads']})")

    # ============================================================
    #  口径 4: 转化率计算正确
    # ============================================================

    def test_rate_calculation(self):
        """opening_rate = new_opened / leads * 100, valid_rate = new_valid / leads * 100。"""
        data = self._fetch_clusters()
        items = data.get('items', [])

        if not items:
            self.skipTest('无数据，跳过口径验证')

        for item in items:
            leads = item['leads']
            if leads > 0:
                expected_opening_rate = round(item['new_opened'] / leads * 100, 2)
                expected_valid_rate = round(item['new_valid'] / leads * 100, 2)
                self.assertAlmostEqual(
                    item['opening_rate'], expected_opening_rate, places=2,
                    msg=f"主播 {item['anchor']}: opening_rate 计算不一致")
                self.assertAlmostEqual(
                    item['valid_rate'], expected_valid_rate, places=2,
                    msg=f"主播 {item['anchor']}: valid_rate 计算不一致")
            else:
                self.assertEqual(item['opening_rate'], 0, 'leads=0 时 opening_rate 应为 0')
                self.assertEqual(item['valid_rate'], 0, 'leads=0 时 valid_rate 应为 0')

    # ============================================================
    #  口径 5: live_type_breakdown 汇总一致性
    # ============================================================

    def test_live_type_breakdown_consistency(self):
        """live_type_breakdown 各类型的 leads 之和 = totals.total_leads。"""
        data = self._fetch_clusters()
        items = data.get('items', [])
        breakdown = data.get('live_type_breakdown', [])
        totals = data.get('totals', {})

        if not items:
            self.skipTest('无数据，跳过口径验证')

        breakdown_leads = sum(b['leads'] for b in breakdown)
        # breakdown 按 primary live_type 分组，每个 item 只归入一个类型
        # 因此 breakdown leads 之和应等于 items leads 之和
        self.assertEqual(
            breakdown_leads, totals['total_leads'],
            f'live_type_breakdown leads 之和({breakdown_leads}) ≠ total_leads({totals["total_leads"]})')

        # anchors 之和应等于 total_anchors
        breakdown_anchors = sum(b['anchors'] for b in breakdown)
        self.assertEqual(
            breakdown_anchors, totals['total_anchors'],
            f'live_type_breakdown anchors 之和({breakdown_anchors}) ≠ total_anchors({totals["total_anchors"]})')

    # ============================================================
    #  口径 6: 存量/非存量线索拆分
    # ============================================================

    def test_existing_new_leads_split(self):
        """每个主播：existing_leads + new_leads ≈ leads（允许 ±2 的舍入误差）。"""
        data = self._fetch_clusters()
        items = data.get('items', [])

        if not items:
            self.skipTest('无数据，跳过口径验证')

        for item in items:
            leads = item['leads']
            split = item['existing_leads'] + item['new_leads']
            # 由于 Python 端 round() 均分，允许小量误差
            self.assertLessEqual(
                abs(split - leads), 2,
                f"主播 {item['anchor']}: existing_leads({item['existing_leads']}) + "
                f"new_leads({item['new_leads']}) = {split} ≠ leads({leads})"
            )

    # ============================================================
    #  口径 7: existing_opened / existing_valid 派生字段一致性
    # ============================================================

    def test_derived_existing_fields(self):
        """existing_opened = opened - new_opened, existing_valid = valid - new_valid。"""
        data = self._fetch_clusters()
        items = data.get('items', [])

        if not items:
            self.skipTest('无数据，跳过口径验证')

        for item in items:
            self.assertEqual(
                item['existing_opened'], item['opened'] - item['new_opened'],
                f"主播 {item['anchor']}: existing_opened 派生不一致")
            self.assertEqual(
                item['existing_valid'], item['valid'] - item['new_valid'],
                f"主播 {item['anchor']}: existing_valid 派生不一致")


if __name__ == '__main__':
    unittest.main(verbosity=2)
