# 省心投 BI - 后端测试包
# ================================
# 测试规范文档: .claude/rules/testing-standards.md
# ================================

import pytest
import sys
import os

# 确保项目路径在 sys.path 中
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)