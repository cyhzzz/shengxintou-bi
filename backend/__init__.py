# -*- coding: utf-8 -*-
"""
省心投 BI - 后端模块
"""
import os
import sys

# 确保可导入
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 注册 v2 ORM 模型到 SQLAlchemy metadata（让 db.create_all 等场景能识别）
from backend import models_v2  # noqa: F401
