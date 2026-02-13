# -*- coding: utf-8 -*-
"""
数据查询API路由模块
自动注册所有Blueprint
"""

from flask import Blueprint

# 导入所有子模块
from . import query
from . import dashboard
from . import trend
from . import agency_analysis
from . import xhs_notes
from . import cost_analysis
from . import external_analysis
from . import leads
from . import account_mapping
from . import abbreviation_mapping
from . import xhs_operation

# 汇总Blueprint（为了兼容性，创建一个主Blueprint）
# 实际使用时需要分别注册各个Blueprint
__all__ = [
    'query',
    'dashboard',
    'trend',
    'agency_analysis',
    'xhs_notes',
    'cost_analysis',
    'external_analysis',
    'leads',
    'account_mapping',
    'abbreviation_mapping',
    'xhs_operation',
]
