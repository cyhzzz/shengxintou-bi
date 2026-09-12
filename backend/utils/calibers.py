# -*- coding: utf-8 -*-
"""业务口径常量中心（唯一权威源）

跨报表/导入层共享的可执行口径常量只在此定义，各处一律 import，禁止再内联副本。
口径的业务解释见 docs/rules/business-invariants.md。
"""
from sqlalchemy import or_

from backend.models_v2 import FactConvAppmarket, FactConvContent

# 应用市场白名单：7 大市场；OPPO/VIVO 源表大写，导入层落库前统一 .lower()
APP_MARKET_PLATFORMS = ['oppo', 'vivo', '荣耀', '小米', '华为', '鸿蒙', '苹果']

# 应用市场「广告开户」复合条件（v3.5.7 口径修正后的权威定义）：
# 资金账号创建完成 且 渠道类型=互联网引流 且 属于新开户
AD_ACCOUNT_CONDITIONS = (
    (FactConvAppmarket.是否创建完资金账号 == 1)
    & (FactConvAppmarket.渠道类型 == '互联网引流')
    & (FactConvAppmarket.是否新开户 == 1)
)

# 内容平台「非存量客户」条件（业务不变式：是否为存量客户 == 0 OR IS NULL）
CONTENT_NON_STOCK = or_(FactConvContent.是否为存量客户.is_(None), FactConvContent.是否为存量客户 == 0)
