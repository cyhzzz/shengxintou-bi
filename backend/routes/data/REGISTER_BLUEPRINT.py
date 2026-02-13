# ============================================
# 更新 app.py 的注册代码
# ============================================

# 将以下代码替换 app.py 中原有的 data.bp 注册：
# 原代码（约第210行）：
#     app.register_blueprint(data.bp, url_prefix=API_PREFIX)

# 新代码：
from backend.routes.data import (
    query,
    dashboard,
    trend,
    agency_analysis,
    xhs_notes,
    cost_analysis,
    external_analysis,
    leads,
    account_mapping,
    abbreviation_mapping,
    xhs_operation
)

# 注册所有拆分后的Blueprint（保留相同的URL前缀）
app.register_blueprint(query.bp, url_prefix=API_PREFIX)
app.register_blueprint(dashboard.bp, url_prefix=API_PREFIX)
app.register_blueprint(trend.bp, url_prefix=API_PREFIX)
app.register_blueprint(agency_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_notes.bp, url_prefix=API_PREFIX)
app.register_blueprint(cost_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(external_analysis.bp, url_prefix=API_PREFIX)
app.register_blueprint(leads.bp, url_prefix=API_PREFIX)
app.register_blueprint(account_mapping.bp, url_prefix=API_PREFIX)
app.register_blueprint(abbreviation_mapping.bp, url_prefix=API_PREFIX)
app.register_blueprint(xhs_operation.bp, url_prefix=API_PREFIX)

# ============================================
# 备份方案：如果想保持向后兼容
# ============================================

# 如果你想保持原来的导入方式不变，可以在 __init__.py 中创建一个主 Blueprint：
# 在 backend/routes/data/__init__.py 中添加：

# from . import (
#     query, dashboard, trend, agency_analysis, xhs_notes,
#     cost_analysis, external_analysis, leads, account_mapping,
#     abbreviation_mapping, xhs_operation
# )
#
# 创建主Blueprint用于兼容
# bp = Blueprint('data', __name__)
#
# 注册所有子Blueprint到主Blueprint（通过URL前缀）
# 注意：这种方式需要调整子模块的注册逻辑
