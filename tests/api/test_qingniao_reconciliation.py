# -*- coding: utf-8 -*-
"""抖音青鸟对账多级匹配回归测试（v3.3.11）

背景：全渠道匹配会把小红书/腾讯/财联社等同昵称 + 同日期的线索误匹配进抖音青鸟对账。
修复：多级匹配——优先「平台来源=抖音」的候选；无抖音候选时兜底其他平台候选
（防止平台系统自动打标丢失导致漏匹）。

本测试只测纯函数 _select_match_pool，不依赖数据库（与 tests/api 只读原则一致）。

运行：
  - 全部：   python -m unittest discover -s tests/api -v
  - 单文件： python -m unittest tests.api.test_qingniao_reconciliation -v
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import logging
logging.disable(logging.CRITICAL)

from backend.routes.data.data_reconciliation import _select_match_pool  # noqa: E402


class QingniaoMatchPoolTest(unittest.TestCase):
    """多级匹配候选池选择：抖音优先，无抖音兜底。"""

    @staticmethod
    def _c(platform):
        """构造系统侧候选 dict（仅包含 _select_match_pool 用到的字段）。"""
        return {'平台来源': platform}

    def test_prefers_douyin_when_exists(self):
        pool = _select_match_pool([
            self._c('小红书'),
            self._c('抖音'),
            self._c('腾讯'),
        ])
        self.assertEqual(pool, [self._c('抖音')])

    def test_fallback_when_no_douyin(self):
        pool = _select_match_pool([
            self._c('小红书'),
            self._c('财联社'),
            self._c(None),
        ])
        self.assertEqual(len(pool), 3)
        self.assertIn(self._c('小红书'), pool)

    def test_all_douyin_kept(self):
        pool = _select_match_pool([self._c('抖音'), self._c('抖音')])
        self.assertEqual(len(pool), 2)

    def test_empty(self):
        self.assertEqual(_select_match_pool([]), [])


if __name__ == '__main__':
    unittest.main()
