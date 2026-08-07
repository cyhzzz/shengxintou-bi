# -*- coding: utf-8 -*-
"""分支KOS转化周报口径单测（v3.8.0）

数据口径：fact_conv_content.笔记ID 关联 agg_xhs_note.创作者（分支KOS投顾名单）。
本测试只测纯函数（名单匹配 / 聚合 / 榜单口径 / 趋势 / 默认周），不依赖数据库。

运行：
  - 全部：   python -m unittest discover -s tests/api -v
  - 单文件： python -m unittest tests.api.test_xhs_kos_weekly -v
"""

import os
import sys
import unittest
from datetime import date

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import logging
logging.disable(logging.CRITICAL)

from backend.routes.data.xhs_kos_weekly import (  # noqa: E402
    KOS_ROSTER,
    _aggregate,
    _build_rankings,
    _build_trend,
    _latest_kos_week_range,
    is_kos_creator,
    kos_name_of,
)


def _lead(kos, d='2026-07-01', opened=0, valid=0, cunliang=0, open_time=None, mouth=0, valid_lead=0, assets=0.0):
    return {
        'kos': kos,
        '线索日期': d,
        '线索日期_obj': date.fromisoformat(d),
        '开户时间_obj': date.fromisoformat(open_time) if open_time else None,
        '是否客户开口': mouth,
        '是否有效线索': valid_lead,
        '是否开户': opened,
        '是否为有效户': valid,
        '是否为存量客户': cunliang,
        '资产': assets,
    }


class KosCreatorMatchTest(unittest.TestCase):
    """名单匹配：精确名 + 轮岗（赵茜）等带前缀写法。"""

    def test_exact_names_all_match(self):
        for name in KOS_ROSTER:
            self.assertTrue(is_kos_creator(name), f'{name} 应命中')
            self.assertEqual(kos_name_of(name), name)

    def test_rotation_wrapper(self):
        self.assertTrue(is_kos_creator('轮岗（赵茜）'))
        self.assertEqual(kos_name_of('轮岗（赵茜）'), '赵茜')

    def test_non_kos_creator(self):
        for creator in ('总部（周乐意）', '量子（代理）', '投教基地', None, ''):
            self.assertFalse(is_kos_creator(creator), repr(creator))
            self.assertIsNone(kos_name_of(creator))


class KosAggregateTest(unittest.TestCase):
    """聚合：固定名单补齐 0、开户率/有效户率、按开户率降序。"""

    def test_pad_and_rates(self):
        leads = [
            _lead('赵茜', opened=1, valid=1),
            _lead('赵茜', opened=0),
        ]
        items = _aggregate(leads)
        by_name = {i['kos_name']: i for i in items}
        self.assertEqual(len(items), 10)
        self.assertEqual(by_name['赵茜']['total_leads'], 2)
        self.assertEqual(by_name['赵茜']['opened_count'], 1)
        self.assertEqual(by_name['赵茜']['opening_rate'], 50.0)
        self.assertEqual(by_name['赵茜']['valid_customer_rate'], 100.0)
        self.assertEqual(by_name['何慧敏']['total_leads'], 0, '无数据成员应补 0')

    def test_sorted_by_opening_rate_desc(self):
        leads = [_lead('赵茜', opened=1), _lead('何慧敏', opened=0), _lead('黄天平', opened=1)]
        items = _aggregate(leads)
        rates = [i['opening_rate'] for i in items]
        self.assertEqual(rates, sorted(rates, reverse=True), '应按开户率降序')


class KosRankingCaliberTest(unittest.TestCase):
    """榜单口径：total/existing/new/existing_new_open。"""

    def test_total_cumulative_until_end(self):
        leads = [
            _lead('赵茜', '2026-05-10', opened=1),
            _lead('赵茜', '2026-07-15', opened=0),
            _lead('赵茜', '2026-08-01', opened=0),  # 超过 end_date，不计入
        ]
        r = _build_rankings(leads, '2026-07-01', '2026-07-31')
        total = {i['kos_name']: i for i in r['total']}
        self.assertEqual(total['赵茜']['total_leads'], 2, 'total 应累计到 end_date')

    def test_new_excludes_cunliang(self):
        leads = [
            _lead('赵茜', '2026-07-10', cunliang=0),
            _lead('赵茜', '2026-07-12', cunliang=1),
            _lead('赵茜', '2026-07-14', cunliang=0),
        ]
        r = _build_rankings(leads, '2026-07-01', '2026-07-31')
        new = {i['kos_name']: i for i in r['new']}
        existing = {i['kos_name']: i for i in r['existing']}
        self.assertEqual(new['赵茜']['total_leads'], 2, 'new = 区间内非存量')
        self.assertEqual(existing['赵茜']['total_leads'], 1, 'existing = 区间内存量客户')

    def test_existing_new_open(self):
        leads = [
            _lead('赵茜', '2026-06-20', opened=1, open_time='2026-07-10'),  # 老线索本周开户
            _lead('赵茜', '2026-07-10', opened=1, open_time='2026-07-10'),  # 新线索不算存量新开户
        ]
        r = _build_rankings(leads, '2026-07-01', '2026-07-31')
        eno = {i['kos_name']: i for i in r['existing_new_open']}
        self.assertEqual(eno['赵茜']['total_leads'], 1, '存量线索总数=线索日期<start 的老线索数')
        self.assertEqual(eno['赵茜']['opened_count'], 1, '本周开户的存量线索数')


class KosMiscTest(unittest.TestCase):
    def test_trend_monthly(self):
        leads = [
            _lead('赵茜', '2026-05-01', opened=1),
            _lead('赵茜', '2026-05-20', opened=0),
            _lead('赵茜', '2026-06-05', opened=0),
        ]
        trend = _build_trend(leads, '2026-05-01', '2026-06-30')
        self.assertEqual([t['period'] for t in trend], ['2026-05', '2026-06'])
        self.assertEqual(trend[0]['leads'], 2)
        self.assertEqual(trend[0]['opened'], 1)

    def test_latest_week_range(self):
        leads = [_lead('赵茜', '2026-07-30')]  # 周四
        r = _latest_kos_week_range(leads)
        self.assertEqual(r['latest_date'], '2026-07-30')
        self.assertEqual(r['default_week_start'], '2026-07-27')  # 所在周周一
        self.assertEqual(r['default_week_end'], '2026-08-02')


if __name__ == '__main__':
    unittest.main()
