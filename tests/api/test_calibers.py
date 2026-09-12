# -*- coding: utf-8 -*-
"""口径中心回归测试：锁定 backend/utils/calibers.py 三常量的字面量与 SQL 编译形态，防止口径被无意改动。"""
import os
import sys
import logging
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

logging.disable(logging.CRITICAL)

from sqlalchemy.dialects import sqlite

from backend.utils.calibers import AD_ACCOUNT_CONDITIONS, APP_MARKET_PLATFORMS, CONTENT_NON_STOCK


class TestCalibers(unittest.TestCase):
    def test_app_market_platforms_whitelist(self):
        """白名单字面量锁定：7 大市场，顺序即展示顺序。"""
        self.assertEqual(
            APP_MARKET_PLATFORMS,
            ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果'],
        )

    def test_ad_account_conditions_sql(self):
        """广告开户复合条件 = 资金账号 AND 互联网引流 AND 新开户（literal_binds 渲染字面量）。"""
        sql = str(AD_ACCOUNT_CONDITIONS.compile(
            dialect=sqlite.dialect(), compile_kwargs={'literal_binds': True}))
        self.assertIn('是否创建完资金账号', sql)
        self.assertIn('渠道类型', sql)
        self.assertIn('互联网引流', sql)
        self.assertIn('是否新开户', sql)

    def test_content_non_stock_sql(self):
        """内容平台非存量条件 = IS NULL OR = 0（业务不变式）。"""
        sql = str(CONTENT_NON_STOCK.compile(
            dialect=sqlite.dialect(), compile_kwargs={'literal_binds': True}))
        self.assertIn('是否为存量客户', sql)
        self.assertIn('IS NULL', sql.upper())
        self.assertIn('= 0', sql)


if __name__ == '__main__':
    unittest.main()
