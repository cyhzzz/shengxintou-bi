# Daily Metrics Unified 表重新设计方案

## 更新时间
2026-01-19

## 版本
v3.0

## 问题分析

### 当前问题
1. **字段冗余**：leads（广告侧线索）和 lead_users（转化侧线索人数）重复
2. **字段混乱**：clicks（点击次数）和 click_users（点击人数）概念不清
3. **空字段**：部分字段无数据来源
4. **关联复杂**：代理商和业务模式映射逻辑不清晰

## 新表结构设计

### 聚合维度（4个字段）

| 字段名 | 类型 | 说明 | 来源 |
|-------|------|------|------|
| `date` | Date | 日期 | 所有数据 |
| `platform` | String(50) | 平台：腾讯/抖音/小红书 | 所有数据 |
| `agency` | String(100) | 代理商（可为空） | 映射表或转化表 |
| `business_model` | String(50) | 业务模式：直播/信息流（可为空） | 根据 customer_source 推断 |

### 广告指标（3个字段）

来自3张广告数据表（raw_ad_data_tencent, raw_ad_data_douyin, raw_ad_data_xiaohongshu）

| 字段名 | 类型 | 说明 | 数据来源 |
|-------|------|------|---------|
| `cost` | Numeric(10,2) | 花费（元） | SUM(广告表.cost) |
| `impressions` | Integer | 展示次数 | SUM(广告表.impressions) |
| `click_users` | Integer | 点击人数（去重） | 独立计算，详见下方 |

### 转化指标（6个字段）

来自 backend_conversions 表

| 字段名 | 类型 | 说明 | 数据来源 | 计算逻辑 |
|-------|------|------|----------|---------|
| `lead_users` | Integer | 线索人数（去重） | COUNT(DISTINCT user_identifier) | 所有线索 |
| `potential_customers` | Integer | 潜客人数（去重） | COUNT(DISTINCT user_identifier) | WHERE is_existing_customer = 0 |
| `customer_mouth_users` | Integer | 开口人数（去重） | COUNT(DISTINCT user_identifier) | WHERE is_customer_mouth = true |
| `valid_lead_users` | Integer | 有效人数（去重） | COUNT(DISTINCT user_identifier) | WHERE is_valid_lead = true |
| `opened_account_users` | Integer | 开户人数（去重） | COUNT(DISTINCT user_identifier) | WHERE is_opened_account = true（按线索时点） |
| `valid_customer_users` | Integer | 有效户人数（去重） | COUNT(DISTINCT user_identifier) | WHERE is_valid_customer = true |

**注意**：
- user_identifier = CONCAT(platform_source, '\|', COALESCE(wechat_nickname, ''), '\|', COALESCE(capital_account, ''), '\|', COALESCE(platform_user_id, ''))
- 所有转化指标都是去重人数

### 辅助字段（2个字段）

| 字段名 | 类型 | 说明 | 用途 |
|-------|------|------|------|
| `account_id` | String(50) | 账号ID | 仅用于广告数据关联，不作为聚合维度 |
| `account_name` | String(200) | 账号名称 | 仅用于广告数据关联，不作为聚合维度 |

## 数据关联逻辑

### 1. 广告数据关联

**数据源**：
- raw_ad_data_tencent（腾讯广告）
- raw_ad_data_douyin（抖音广告）
- raw_ad_data_xiaohongshu（小红书广告）

**聚合维度**：date + platform + agency + business_model

**关联方式**：
```sql
SELECT
    ad.date,
    ad.platform,
    COALESCE(mapping.agency, '未分配') as agency,
    COALESCE(mapping.business_model, '未知') as business_model,
    SUM(ad.cost) as cost,
    SUM(ad.impressions) as impressions,
    0 as click_users  -- 需要单独计算
FROM ad_table ad
LEFT JOIN account_agency_mapping mapping
    ON mapping.account_id = ad.account_id
    AND mapping.platform = ad.platform
GROUP BY date, platform, agency, business_model
```

**点击人数计算**：
- 从 backend_conversions 表计算
- 维度：date + platform + agency + business_model

### 2. 转化数据关联

**数据源**：backend_conversions（线索明细表）

**聚合维度**：lead_date + platform_source + agency + business_model

**代理商关联逻辑**：

| 平台 | 关联字段 | 映射方式 | 未能关联 |
|-----|---------|---------|---------|
| 小红书 | ad_account | 关联 account_agency_mapping.account_name | agency = '' |
| 腾讯 | ad_account | 关联 account_agency_mapping.account_id | agency = '' |
| 抖音 | agency | 直接使用或关联 account_agency_mapping.agency | agency = '' |

**关联SQL**：
```sql
SELECT
    lead_date as date,
    platform_source as platform,
    CASE
        WHEN platform_source = '小红书' THEN mapping.account_name
        WHEN platform_source = '腾讯' THEN mapping.account_id
        WHEN platform_source = '抖音' THEN COALESCE(mapping.agency, bc.agency)
        ELSE ''
    END as agency,
    CASE
        WHEN customer_source LIKE '%引流%' THEN '直播'
        WHEN customer_source IS NOT NULL AND customer_source != '' THEN '信息流'
        ELSE ''
    END as business_model,
    COUNT(DISTINCT user_identifier) as lead_users,
    ...
FROM backend_conversions bc
LEFT JOIN account_agency_mapping mapping ON (
    (platform_source = '小红书' AND mapping.account_name = bc.ad_account)
    OR (platform_source = '腾讯' AND mapping.account_id = bc.ad_account)
    OR (platform_source = '抖音' AND mapping.agency = bc.agency)
)
GROUP BY date, platform, agency, business_model
```

### 3. 未能关联的数据处理

**规则**：
- 代理商关联失败的：agency = ''
- 业务模式推断失败的：business_model = ''
- 广告指标：cost = 0, impressions = 0, click_users = 0
- 转化指标：正常统计

**示例**：
```
date         platform  agency  business_model  cost  impressions  click_users  lead_users  ...
2025-01-15   抖音      (空)    (空)           0     0            0           150         ...
```

## 新表结构（完整）

```sql
CREATE TABLE daily_metrics_unified_v3 (
    -- 主键
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 聚合维度
    date DATE NOT NULL,
    platform VARCHAR(50) NOT NULL,
    agency VARCHAR(100),
    business_model VARCHAR(50),

    -- 广告指标
    cost DECIMAL(10, 2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    click_users INTEGER DEFAULT 0,

    -- 转化指标
    lead_users INTEGER DEFAULT 0,
    potential_customers INTEGER DEFAULT 0,
    customer_mouth_users INTEGER DEFAULT 0,
    valid_lead_users INTEGER DEFAULT 0,
    opened_account_users INTEGER DEFAULT 0,
    valid_customer_users INTEGER DEFAULT 0,

    -- 辅助字段（用于数据关联）
    account_id VARCHAR(50),
    account_name VARCHAR(200),

    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 复合唯一索引
CREATE UNIQUE INDEX idx_unique_metrics_v3
ON daily_metrics_unified_v3(date, platform, COALESCE(agency, ''), COALESCE(business_model, ''));

-- 常用查询索引
CREATE INDEX idx_date_platform_v3 ON daily_metrics_unified_v3(date, platform);
CREATE INDEX idx_date_agency_v3 ON daily_metrics_unified_v3(date, agency);
CREATE INDEX idx_platform_bm_v3 ON daily_metrics_unified_v3(platform, business_model);
```

## 字段对比（v2.4 vs v3.0）

| 保留字段 | v2.4 名称 | v3.0 名称 | 说明 |
|---------|----------|-----------|------|
| ✅ | date | date | 日期 |
| ✅ | platform | platform | 平台 |
| ✅ | agency | agency | 代理商（可为空） |
| ✅ | business_model | business_model | 业务模式（可为空） |
| ✅ | cost | cost | 花费 |
| ✅ | impressions | impressions | 展示 |
| ✅ | click_users | click_users | 点击人数 |
| ✅ | lead_users | lead_users | 线索人数 |
| ✅ | customer_mouth_users | customer_mouth_users | 开口人数 |
| ✅ | valid_lead_users | valid_lead_users | 有效人数 |
| ✅ | opened_account_users | opened_account_users | 开户人数 |
| ✅ | valid_customer_users | valid_customer_users | 有效户人数 |
| ➕ | - | potential_customers | **新增**：潜客人数 |

| 删除字段 | 原因 |
|---------|------|
| account_id (作为维度) | 改为辅助字段，不作为聚合维度 |
| account_name (作为维度) | 改为辅助字段，不作为聚合维度 |
| clicks | 点击次数，业务上不需要 |
| leads | 广告侧线索，与 lead_users 重复 |
| new_accounts | 广告侧开户，与 opened_account_users 重复 |
| customer_users | 成单人数，概念不清，已被其他字段覆盖 |
| extra_data | 扩展字段，实际未使用 |

## 数据迁移策略

### 方案 A：重建表（推荐）

1. 重命名旧表：`daily_metrics_unified` → `daily_metrics_unified_v2.4_backup`
2. 创建新表：`daily_metrics_unified_v3`
3. 重命名新表：`daily_metrics_unified_v3` → `daily_metrics_unified`
4. 运行新聚合脚本填充数据

### 方案 B：渐进式迁移（适用于生产环境）

1. 添加新字段：potential_customers
2. 删除旧字段：clicks, leads, new_accounts, customer_users, extra_data
3. 更新聚合脚本
4. 逐步清理数据

## 后续步骤

1. ✅ 创建表结构设计文档（本文档）
2. ⏳ 创建新的数据库迁移脚本
3. ⏳ 更新数据聚合脚本
4. ⏳ 更新前端报表（转化漏斗、厂商分析）
5. ⏳ 测试数据聚合
6. ⏳ 性能测试
