# -*- coding: utf-8 -*-
"""同步状态「最新数据日期」的合理性过滤测试

v4.3.1：上游 Excel 解析可能把数字误转成脏日期（如 '2996-05-22'），
会使 MAX(日期) 得到的"最新数据日期"变成未来年份，导致本地/云端同步状态
误判「日期一致、无需同步」，掩盖真实的不同步。`_plausible_business_date`
过滤此类异常日期，仅采纳 2000~当年的合理日期。

运行：
  python -m unittest tests.api.test_webdav_sync_date -v
"""
import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.routes.webdav_backup import _plausible_business_date  # noqa: E402


class PlausibleBusinessDateTest(unittest.TestCase):

    def test_valid_dates(self):
        self.assertTrue(_plausible_business_date('2026-09-10'))
        self.assertTrue(_plausible_business_date('2026-09-10 00:00:00'))  # 带时间戳取前 10 位
        self.assertTrue(_plausible_business_date('2026-05-22'))

    def test_dirty_future_dates(self):
        # 本次报告的核心脏数据：Excel 把数字误转成日期得到的未来年份
        self.assertFalse(_plausible_business_date('2996-05-22'))
        self.assertFalse(_plausible_business_date('2027-01-01'))  # 次年也过滤
        self.assertFalse(_plausible_business_date('3000-01-01'))

    def test_impossible_past_dates(self):
        # 券商业务数据不会早于 2000 年
        self.assertFalse(_plausible_business_date('1999-12-31'))
        self.assertFalse(_plausible_business_date('0999-01-01'))

    def test_empty_and_invalid(self):
        self.assertFalse(_plausible_business_date(None))
        self.assertFalse(_plausible_business_date(''))
        self.assertFalse(_plausible_business_date('not-a-date'))
        self.assertFalse(_plausible_business_date('2026-13-01'))  # 无效月份


if __name__ == '__main__':
    unittest.main()