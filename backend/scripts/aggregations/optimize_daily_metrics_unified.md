# Daily Metrics Unified 表优化方案

## 更新时间
2026-01-19

## 目标

优化 `daily_metrics_unified` 统一聚合表，使其成为支持转化漏斗和厂商分析的核心中间表。

## 数据源

1. **广告数据表**（3张）：
   - `raw_ad_data_tencent` (腾讯广告)
   - `raw_ad_data_douyin` (抖音广告)
   - `raw_ad_data_xiaohongshu` (小红书广告)

2. **后端转化表**（1张）：
   - `backend_conversions` (线索明细表)

3. **映射表**：
   - `account_agency_mapping` (账号代理商映射)

## 当前表结构问题

### 现有字段 (v2.3)
```python
class DailyMetricsUnified(db.Model):
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False, index=True)
    platform = Column(String(50), nullable=False, index=True)
    account_id = Column(String(50), nullable=False)
    account_name = Column(String(200))
    agency = Column(String(100), nullable=False, index=True)
    business_model = Column(String(50), nullable=False, index=True)

    # 广告指标
    cost = Column(Numeric(10, 2), default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    leads = Column(Integer, default=0)
    new_accounts = Column(Integer, default=0)

    extra_data = Column(JSON)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

### 问题
1. **缺少转化相关字段**：没有开口数、有效数、有效户数等
2. **没有点击人数**：只有点击次数（clicks），无法计算点击去重人数
3. **缺少线索人数**：线索数（leads）和线索人数混淆
4. **无法支持完整转化漏斗**：缺少中间层数据

## 优化后的表结构 (v2.4)

### 新增字段说明

| 字段名 | 类型 | 说明 | 数据来源 |
|-------|------|------|---------|
| `click_users` | Integer | 点击人数（去重） | 转化表去重 count |
| `lead_users` | Integer | 线索人数（去重） | is_valid_lead=true 去重 count |
| `customer_mouth_users` | Integer | 开口人数（去重） | is_customer_mouth=true 去重 count |
| `valid_lead_users` | Integer | 有效线索人数（去重） | is_valid_lead=true 去重 count |
| `customer_users` | Integer | 成单人数（去重） | is_customer=true 去重 count |
| `opened_account_users` | Integer | 开户人数（去重） | is_opened_account=true 去重 count |
| `valid_customer_users` | Integer | 有效户人数（去重） | is_valid_customer=true 去重 count |

### 完整表结构 (v2.4)

```python
class DailyMetricsUnified(db.Model):
    """统一日级指标聚合表 v2.4

    聚合维度：
    - date: 日期
    - platform: 平台（腾讯/抖音/小红书）
    - agency: 代理商
    - business_model: 业务模式（直播/信息流/搜索）

    广告指标（从广告数据表聚合）：
    - cost: 花费
    - impressions: 曝光次数
    - clicks: 点击次数
    - leads: 线索数（广告侧）
    - new_accounts: 新开户数（广告侧）

    转化指标（从后端转化表聚合）：
    - click_users: 点击人数（去重）
    - lead_users: 线索人数（去重，is_valid_lead=true）
    - customer_mouth_users: 开口人数（去重，is_customer_mouth=true）
    - valid_lead_users: 有效线索人数（去重，is_valid_lead=true）
    - customer_users: 成单人数（去重，is_customer=true）
    - opened_account_users: 开户人数（去重，is_opened_account=true）
    - valid_customer_users: 有效户人数（去重，is_valid_customer=true）
    """
    __tablename__ = 'daily_metrics_unified'

    # 主键
    id = Column(Integer, primary_key=True, autoincrement=True)

    # ===== 聚合维度 =====
    date = Column(Date, nullable=False, index=True, comment='日期')
    platform = Column(String(50), nullable=False, index=True, comment='平台：腾讯/抖音/小红书')
    account_id = Column(String(50), nullable=False, comment='账号ID')
    account_name = Column(String(200), comment='账号名称')
    agency = Column(String(100), nullable=False, index=True, comment='代理商')
    business_model = Column(String(50), nullable=False, index=True, comment='业务模式：直播/信息流/搜索')

    # ===== 广告指标（从广告数据表聚合） =====
    cost = Column(Numeric(10, 2), default=0, comment='花费（元）')
    impressions = Column(Integer, default=0, comment='曝光次数')
    clicks = Column(Integer, default=0, comment='点击次数')
    leads = Column(Integer, default=0, comment='线索数（广告侧）')
    new_accounts = Column(Integer, default=0, comment='新开户数（广告侧）')

    # ===== 转化指标（从后端转化表聚合） =====
    click_users = Column(Integer, default=0, comment='点击人数（去重）')
    lead_users = Column(Integer, default=0, comment='线索人数（去重，is_valid_lead=true）')
    customer_mouth_users = Column(Integer, default=0, comment='开口人数（去重，is_customer_mouth=true）')
    valid_lead_users = Column(Integer, default=0, comment='有效线索人数（去重，is_valid_lead=true）')
    customer_users = Column(Integer, default=0, comment='成单人数（去重，is_customer=true）')
    opened_account_users = Column(Integer, default=0, comment='开户人数（去重，is_opened_account=true）')
    valid_customer_users = Column(Integer, default=0, comment='有效户人数（去重，is_valid_customer=true）')

    # ===== 扩展字段 =====
    extra_data = Column(JSON, comment='扩展数据（JSON格式）')

    # ===== 元数据 =====
    created_at = Column(DateTime, default=datetime.now, comment='创建时间')
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

    # ===== 复合索引 =====
    __table_args__ = (
        # 复合唯一索引：确保同一维度只有一条记录
        Index('idx_unique_metrics', 'date', 'platform', 'agency', 'business_model', unique=True),

        # 复合索引：优化常见查询
        Index('idx_date_platform', 'date', 'platform'),
        Index('idx_date_agency', 'date', 'agency'),
        Index('idx_platform_bm', 'platform', 'business_model'),
    )
```

## 数据聚合逻辑

### 1. 去重用户标识的确定

**问题**：`backend_conversions` 表没有唯一的用户标识字段（如 user_id）

**解决方案**：使用以下字段的组合作为唯一标识：
- `platform_source` (平台)
- `lead_date` (线索日期)
- `wechat_nickname` (微信昵称，如果存在)
- `capital_account` (资金账号，如果存在)
- `platform_user_id` (平台用户ID，如果存在)

**去重逻辑**：
```python
# 使用 CONCAT_WS 创建唯一标识
# MySQL: CONCAT_WS('|', platform_source, wechat_nickname, capital_account, platform_user_id)
# SQLite: platform_source || '|' || COALESCE(wechat_nickname, '') || '|' || COALESCE(capital_account, '') || '|' || COALESCE(platform_user_id, '')
user_identifier = func.concat(
    BackendConversions.platform_source, '|',
    func.coalesce(BackendConversions.wechat_nickname, ''), '|',
    func.coalesce(BackendConversions.capital_account, ''), '|',
    func.coalesce(BackendConversions.platform_user_id, '')
)
```

### 2. 广告数据聚合

**数据源**：
- `raw_ad_data_tencent`
- `raw_ad_data_douyin`
- `raw_ad_data_xiaohongshu`

**聚合逻辑**：
```sql
-- 1. 腾讯广告数据
INSERT INTO daily_metrics_unified (date, platform, account_id, account_name, agency, business_model, cost, impressions, clicks, leads, new_accounts)
SELECT
    date,
    '腾讯' as platform,
    account_id,
    account_name,
    mapping.agency,
    mapping.business_model,
    SUM(cost) as cost,
    SUM(impressions) as impressions,
    SUM(clicks) as clicks,
    SUM(leads) as leads,
    SUM(new_accounts) as new_accounts
FROM raw_ad_data_tencent t
LEFT JOIN account_agency_mapping mapping
    ON t.account_id = mapping.account_id
    AND mapping.platform = '腾讯'
WHERE date >= :start_date AND date <= :end_date
GROUP BY date, account_id, mapping.agency, mapping.business_model
ON DUPLICATE KEY UPDATE
    cost = VALUES(cost),
    impressions = VALUES(impressions),
    clicks = VALUES(clicks),
    leads = VALUES(leads),
    new_accounts = VALUES(new_accounts);

-- 2. 抖音广告数据（类似）
-- 3. 小红书广告数据（类似）
```

### 3. 转化数据聚合

**数据源**：`backend_conversions`

**聚合逻辑**：
```sql
-- 更新转化指标
UPDATE daily_metrics_unified d
SET
    click_users = (
        SELECT COUNT(DISTINCT
            platform_source || '|' ||
            COALESCE(wechat_nickname, '') || '|' ||
            COALESCE(capital_account, '') || '|' ||
            COALESCE(platform_user_id, '')
        )
        FROM backend_conversions c
        WHERE c.lead_date = d.date
          AND c.platform_source = d.platform
          AND c.agency = d.agency
    ),
    lead_users = (
        SELECT COUNT(DISTINCT
            platform_source || '|' ||
            COALESCE(wechat_nickname, '') || '|' ||
            COALESCE(capital_account, '') || '|' ||
            COALESCE(platform_user_id, '')
        )
        FROM backend_conversions c
        WHERE c.lead_date = d.date
          AND c.platform_source = d.platform
          AND c.agency = d.agency
          AND c.is_valid_lead = 1
    ),
    customer_mouth_users = (
        SELECT COUNT(DISTINCT
            platform_source || '|' ||
            COALESCE(wechat_nickname, '') || '|' ||
            COALESCE(capital_account, '') || '|' ||
            COALESCE(platform_user_id, '')
        )
        FROM backend_conversions c
        WHERE c.lead_date = d.date
          AND c.platform_source = d.platform
          AND c.agency = d.agency
          AND c.is_customer_mouth = 1
    ),
    valid_lead_users = (
        SELECT COUNT(DISTINCT
            platform_source || '|' ||
            COALESCE(wechat_nickname, '') || '|' ||
            COALESCE(capital_account, '') || '|' ||
            COALESCE(platform_user_id, '')
        )
        FROM backend_conversions c
        WHERE c.lead_date = d.date
          AND c.platform_source = d.platform
          AND c.agency = d.agency
          AND c.is_valid_lead = 1
    ),
    customer_users = (
        SELECT COUNT(DISTINCT
            platform_source || '|' ||
            COALESCE(wechat_nickname, '') || '|' ||
            COALESCE(capital_account, '') || '|' ||
            COALESCE(platform_user_id, '')
        )
        FROM backend_conversions c
        WHERE c.lead_date = d.date
          AND c.platform_source = d.platform
          AND c.agency = d.agency
          AND c.is_customer = 1
    ),
    opened_account_users = (
        SELECT COUNT(DISTINCT
            platform_source || '|' ||
            COALESCE(wechat_nickname, '') || '|' ||
            COALESCE(capital_account, '') || '|' ||
            COALESCE(platform_user_id, '')
        )
        FROM backend_conversions c
        WHERE c.lead_date = d.date
          AND c.platform_source = d.platform
          AND c.agency = d.agency
          AND c.is_opened_account = 1
    ),
    valid_customer_users = (
        SELECT COUNT(DISTINCT
            platform_source || '|' ||
            COALESCE(wechat_nickname, '') || '|' ||
            COALESCE(capital_account, '') || '|' ||
            COALESCE(platform_user_id, '')
        )
        FROM backend_conversions c
        WHERE c.lead_date = d.date
          AND c.platform_source = d.platform
          AND c.agency = d.agency
          AND c.is_valid_customer = 1
    )
WHERE d.date BETWEEN :start_date AND :end_date;
```

### 4. 转化漏斗层级定义

根据代码中的定义，转化漏斗包含以下层级：

| 层级 | 指标 | 字段 | 数据来源 |
|-----|------|------|---------|
| 1 | 曝光 | impressions | 广告数据表 |
| 2 | 点击 | clicks / click_users | 广告数据表 / 转化表去重 |
| 3 | 线索 | lead_users | 转化表（is_valid_lead=true） |
| 4 | 开口 | customer_mouth_users | 转化表（is_customer_mouth=true） |
| 5 | 有效 | valid_lead_users | 转化表（is_valid_lead=true） |
| 6 | 成单 | customer_users | 转化表（is_customer=true） |
| 7 | 开户 | opened_account_users | 转化表（is_opened_account=true） |
| 8 | 有效户 | valid_customer_users | 转化表（is_valid_customer=true） |

**注意**：用户要求的转化漏斗是"曝光、点击、线索、开口、有效、开户、有效户"，共7层。

## 实现步骤

### 步骤 1: 更新数据库模型

修改 `backend/models.py`，添加新字段。

### 步骤 2: 创建数据库迁移脚本

创建 `backend/migrations/add_daily_metrics_fields_v2.4.py`：

```python
"""
添加 daily_metrics_unified 表的转化相关字段
版本: v2.4
日期: 2026-01-19
"""

def upgrade():
    from backend.database import db

    # 添加新字段
    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        ADD COLUMN click_users INTEGER DEFAULT 0 COMMENT '点击人数（去重）';
    """)

    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        ADD COLUMN lead_users INTEGER DEFAULT 0 COMMENT '线索人数（去重，is_valid_lead=true）';
    """)

    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        ADD COLUMN customer_mouth_users INTEGER DEFAULT 0 COMMENT '开口人数（去重，is_customer_mouth=true）';
    """)

    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        ADD COLUMN valid_lead_users INTEGER DEFAULT 0 COMMENT '有效线索人数（去重）';
    """)

    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        ADD COLUMN customer_users INTEGER DEFAULT 0 COMMENT '成单人数（去重，is_customer=true）';
    """)

    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        ADD COLUMN opened_account_users INTEGER DEFAULT 0 COMMENT '开户人数（去重，is_opened_account=true）';
    """)

    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        ADD COLUMN valid_customer_users INTEGER DEFAULT 0 COMMENT '有效户人数（去重，is_valid_customer=true）';
    """)

    # 创建索引
    db.session.execute("""
        CREATE UNIQUE INDEX idx_unique_metrics
        ON daily_metrics_unified(date, platform, agency, business_model);
    """)

    db.session.commit()

def downgrade():
    from backend.database import db

    # 删除字段
    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        DROP COLUMN click_users;
    """)

    db.session.execute("""
        ALTER TABLE daily_metrics_unified
        DROP COLUMN lead_users;
    """)

    # ... 其他字段

    db.session.commit()
```

### 步骤 3: 创建数据聚合脚本

创建 `backend/scripts/aggregations/update_daily_metrics_unified.py`：

```python
"""
更新 daily_metrics_unified 聚合表
从广告数据表和后端转化表聚合数据
"""

def update_daily_metrics(start_date=None, end_date=None):
    """
    更新日级指标聚合表

    参数:
        start_date: 开始日期（YYYY-MM-DD），默认为最近30天
        end_date: 结束日期（YYYY-MM-DD），默认为今天
    """
    from backend.database import db
    from backend.models import (
        DailyMetricsUnified,
        TencentAdData,
        DouyinAdData,
        XiaohongshuAdData,
        BackendConversions,
        AccountAgencyMapping
    )
    from sqlalchemy import func, and_
    from datetime import datetime, timedelta

    # 默认日期范围：最近30天
    if not end_date:
        end_date = datetime.now().date()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    print(f"开始更新 daily_metrics_unified: {start_date} 到 {end_date}")

    # ===== 1. 聚合广告数据 =====
    print("1. 聚合广告数据...")

    # 1.1 腾讯广告数据
    tencent_ads = db.session.query(
        TencentAdData.date,
        TencentAdData.account_id,
        TencentAdData.account_name,
        AccountAgencyMapping.agency,
        AccountAgencyMapping.business_model,
        func.sum(TencentAdData.cost).label('cost'),
        func.sum(TencentAdData.impressions).label('impressions'),
        func.sum(TencentAdData.clicks).label('clicks'),
        func.sum(TencentAdData.leads).label('leads'),
        func.sum(TencentAdData.new_accounts).label('new_accounts')
    ).outerjoin(
        AccountAgencyMapping,
        and_(
            AccountAgencyMapping.account_id == TencentAdData.account_id,
            AccountAgencyMapping.platform == '腾讯'
        )
    ).filter(
        and_(
            TencentAdData.date >= start_date,
            TencentAdData.date <= end_date
        )
    ).group_by(
        TencentAdData.date,
        TencentAdData.account_id,
        TencentAdData.account_name,
        AccountAgencyMapping.agency,
        AccountAgencyMapping.business_model
    ).all()

    # 1.2 抖音广告数据（类似）
    # 1.3 小红书广告数据（类似）

    # 保存广告数据
    for ad in tencent_ads:
        # 查找或创建记录
        metric = DailyMetricsUnified.query.filter_by(
            date=ad.date,
            platform='腾讯',
            account_id=ad.account_id,
            agency=ad.agency or '未分配',
            business_model=ad.business_model or '未知'
        ).first()

        if not metric:
            metric = DailyMetricsUnified(
                date=ad.date,
                platform='腾讯',
                account_id=ad.account_id,
                account_name=ad.account_name,
                agency=ad.agency or '未分配',
                business_model=ad.business_model or '未知'
            )

        # 更新广告指标
        metric.cost = ad.cost or 0
        metric.impressions = ad.impressions or 0
        metric.clicks = ad.clicks or 0
        metric.leads = ad.leads or 0
        metric.new_accounts = ad.new_accounts or 0

        db.session.add(metric)

    # ... 处理抖音和小红书数据

    db.session.commit()

    # ===== 2. 聚合转化数据 =====
    print("2. 聚合转化数据...")

    # 获取所有需要更新的记录
    metrics = DailyMetricsUnified.query.filter(
        and_(
            DailyMetricsUnified.date >= start_date,
            DailyMetricsUnified.date <= end_date
        )
    ).all()

    for metric in metrics:
        # 构建用户标识去重的表达式
        user_identifier = func.concat(
            BackendConversions.platform_source, '|',
            func.coalesce(BackendConversions.wechat_nickname, ''), '|',
            func.coalesce(BackendConversions.capital_account, ''), '|',
            func.coalesce(BackendConversions.platform_user_id, '')
        )

        # 点击人数
        click_users = db.session.query(
            func.count(func.distinct(user_identifier))
        ).filter(
            and_(
                BackendConversions.lead_date == metric.date,
                BackendConversions.platform_source == metric.platform,
                BackendConversions.agency == metric.agency
            )
        ).scalar() or 0

        # 线索人数（有效线索）
        lead_users = db.session.query(
            func.count(func.distinct(user_identifier))
        ).filter(
            and_(
                BackendConversions.lead_date == metric.date,
                BackendConversions.platform_source == metric.platform,
                BackendConversions.agency == metric.agency,
                BackendConversions.is_valid_lead == True
            )
        ).scalar() or 0

        # 开口人数
        customer_mouth_users = db.session.query(
            func.count(func.distinct(user_identifier))
        ).filter(
            and_(
                BackendConversions.lead_date == metric.date,
                BackendConversions.platform_source == metric.platform,
                BackendConversions.agency == metric.agency,
                BackendConversions.is_customer_mouth == True
            )
        ).scalar() or 0

        # 有效线索人数（与 lead_users 相同）
        valid_lead_users = lead_users

        # 成单人数
        customer_users = db.session.query(
            func.count(func.distinct(user_identifier))
        ).filter(
            and_(
                BackendConversions.lead_date == metric.date,
                BackendConversions.platform_source == metric.platform,
                BackendConversions.agency == metric.agency,
                BackendConversions.is_customer == True
            )
        ).scalar() or 0

        # 开户人数
        opened_account_users = db.session.query(
            func.count(func.distinct(user_identifier))
        ).filter(
            and_(
                BackendConversions.lead_date == metric.date,
                BackendConversions.platform_source == metric.platform,
                BackendConversions.agency == metric.agency,
                BackendConversions.is_opened_account == True
            )
        ).scalar() or 0

        # 有效户人数
        valid_customer_users = db.session.query(
            func.count(func.distinct(user_identifier))
        ).filter(
            and_(
                BackendConversions.lead_date == metric.date,
                BackendConversions.platform_source == metric.platform,
                BackendConversions.agency == metric.agency,
                BackendConversions.is_valid_customer == True
            )
        ).scalar() or 0

        # 更新转化指标
        metric.click_users = click_users
        metric.lead_users = lead_users
        metric.customer_mouth_users = customer_mouth_users
        metric.valid_lead_users = valid_lead_users
        metric.customer_users = customer_users
        metric.opened_account_users = opened_account_users
        metric.valid_customer_users = valid_customer_users

        db.session.add(metric)

    db.session.commit()

    print(f"✅ 完成！更新了 {len(metrics)} 条记录")


if __name__ == '__main__':
    import sys
    from datetime import datetime

    start_date = sys.argv[1] if len(sys.argv) > 1 else None
    end_date = sys.argv[2] if len(sys.argv) > 2 else None

    update_daily_metrics(start_date, end_date)
```

### 步骤 4: 更新厂商分析接口

修改 `backend/routes/data.py` 中的 `/agency-analysis` 接口，使用新字段：

```python
@bp.route('/agency-analysis', methods=['POST'])
def get_agency_analysis():
    """代理商投放分析"""
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 获取汇总数据
        summary_query = db.session.query(
            DailyMetricsUnified.platform,
            DailyMetricsUnified.business_model,
            DailyMetricsUnified.agency,
            func.sum(DailyMetricsUnified.cost).label('total_cost'),
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.clicks).label('total_clicks'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),  # 新增
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),  # 新增
            func.sum(DailyMetricsUnified.leads).label('total_leads'),
            func.sum(DailyMetricsUnified.customer_mouth_users).label('total_customer_mouth_users'),  # 新增
            func.sum(DailyMetricsUnified.valid_lead_users).label('total_valid_lead_users'),  # 新增
            func.sum(DailyMetricsUnified.customer_users).label('total_customer_users'),  # 新增
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),  # 新增
            func.sum(DailyMetricsUnified.new_accounts).label('total_new_accounts'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users')  # 新增
        )

        # ... 应用筛选条件

        summary_results = summary_query.all()

        # ... 返回结果
```

### 步骤 5: 更新转化漏斗接口

修改 `backend/routes/data.py` 中的 `/conversion-funnel` 接口，使用新字段：

```python
@bp.route('/conversion-funnel', methods=['POST'])
def get_conversion_funnel():
    """转化漏斗监测"""
    from backend.database import db

    data = request.get_json()
    filters = data.get('filters', {})

    try:
        # 从统一聚合表获取所有数据
        funnel_query = db.session.query(
            func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
            func.sum(DailyMetricsUnified.clicks).label('total_clicks'),
            func.sum(DailyMetricsUnified.click_users).label('total_click_users'),  # 新增
            func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
            func.sum(DailyMetricsUnified.customer_mouth_users).label('total_customer_mouth_users'),
            func.sum(DailyMetricsUnified.valid_lead_users).label('total_valid_lead_users'),
            func.sum(DailyMetricsUnified.customer_users).label('total_customer_users'),
            func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
            func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users'),
            func.sum(DailyMetricsUnified.cost).label('total_cost')
        )

        # ... 应用筛选条件

        result = funnel_query.first()

        # 构建漏斗数据
        funnel = [
            {'stage': '曝光', 'count': int(result.total_impressions or 0), 'rate': 100},
            {'stage': '点击', 'count': int(result.total_clicks or 0), 'rate': calculate_rate(result.total_clicks, result.total_impressions)},
            {'stage': '点击人数', 'count': int(result.total_click_users or 0), 'rate': calculate_rate(result.total_click_users, result.total_impressions)},  # 新增
            {'stage': '线索', 'count': int(result.total_lead_users or 0), 'rate': calculate_rate(result.total_lead_users, result.total_click_users)},
            {'stage': '开口', 'count': int(result.total_customer_mouth_users or 0), 'rate': calculate_rate(result.total_customer_mouth_users, result.total_lead_users)},
            {'stage': '有效', 'count': int(result.total_valid_lead_users or 0), 'rate': calculate_rate(result.total_valid_lead_users, result.total_lead_users)},
            {'stage': '成单', 'count': int(result.total_customer_users or 0), 'rate': calculate_rate(result.total_customer_users, result.total_valid_lead_users)},
            {'stage': '开户', 'count': int(result.total_opened_account_users or 0), 'rate': calculate_rate(result.total_opened_account_users, result.total_customer_users)},
            {'stage': '有效户', 'count': int(result.total_valid_customer_users or 0), 'rate': calculate_rate(result.total_valid_customer_users, result.total_opened_account_users)},
        ]

        return jsonify({
            'success': True,
            'data': {
                'funnel': funnel,
                'total_cost': float(result.total_cost or 0)
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

## 使用场景

### 场景 1: 厂商分析报表

**需求**：
- 支持花费、曝光、点击、线索、开户、有效户的多指标切换
- 聚合数据计算

**SQL 查询**：
```sql
SELECT
    platform,
    business_model,
    agency,
    SUM(cost) as total_cost,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(click_users) as total_click_users,  -- 新增：点击人数
    SUM(lead_users) as total_lead_users,  -- 新增：线索人数
    SUM(leads) as total_leads,
    SUM(customer_mouth_users) as total_customer_mouth_users,  -- 新增：开口人数
    SUM(valid_lead_users) as total_valid_lead_users,  -- 新增：有效线索人数
    SUM(customer_users) as total_customer_users,  -- 新增：成单人数
    SUM(opened_account_users) as total_opened_account_users,  -- 新增：开户人数
    SUM(new_accounts) as total_new_accounts,
    SUM(valid_customer_users) as total_valid_customer_users  -- 新增：有效户人数
FROM daily_metrics_unified
WHERE date >= '2025-01-01' AND date <= '2025-01-15'
  AND platform IN ('腾讯', '抖音')
  AND agency IN ('量子', '众联')
  AND business_model IN ('直播', '信息流')
GROUP BY platform, business_model, agency;
```

### 场景 2: 转化漏斗报表

**需求**：
- 灵活筛选日期、平台、厂商、业务模式
- 从曝光 → 点击 → 线索 → 开口 → 有效 → 成单 → 开户 → 有效户的完整漏斗

**SQL 查询**：
```sql
SELECT
    SUM(impressions) as impressions,
    SUM(clicks) as clicks,
    SUM(click_users) as click_users,  -- 点击人数
    SUM(lead_users) as lead_users,  -- 线索人数
    SUM(customer_mouth_users) as customer_mouth_users,  -- 开口人数
    SUM(valid_lead_users) as valid_lead_users,  -- 有效人数
    SUM(customer_users) as customer_users,  -- 成单人数
    SUM(opened_account_users) as opened_account_users,  -- 开户人数
    SUM(valid_customer_users) as valid_customer_users  -- 有效户人数
FROM daily_metrics_unified
WHERE date >= '2025-01-01' AND date <= '2025-01-15'
  AND platform IN ('腾讯', '抖音')
  AND agency IN ('量子', '众联')
  AND business_model IN ('直播', '信息流');
```

**漏斗层级**：
1. 曝光：impressions
2. 点击：clicks
3. 点击人数：click_users
4. 线索：lead_users
5. 开口：customer_mouth_users
6. 有效：valid_lead_users
7. 成单：customer_users
8. 开户：opened_account_users
9. 有效户：valid_customer_users

## 数据更新时机

### 1. 自动更新（推荐）

在数据导入完成后自动触发聚合更新：

修改 `backend/routes/upload.py`，在导入成功后调用聚合脚本：

```python
@bp.route('/upload', methods=['POST'])
def upload_file():
    # ... 处理文件上传和数据导入

    # 导入成功后，更新聚合表
    if response['success']:
        from backend.scripts.aggregations.update_daily_metrics_unified import update_daily_metrics

        # 获取导入数据的日期范围
        # ... 从导入结果中提取日期范围

        # 更新聚合表
        try:
            update_daily_metrics(start_date, end_date)
            print(f"✅ 已更新聚合表: {start_date} 到 {end_date}")
        except Exception as e:
            print(f"❌ 更新聚合表失败: {str(e)}")
            # 不影响主流程，记录错误即可

    return jsonify(response)
```

### 2. 定时更新（可选）

使用 Celery 或 APScheduler 定时任务，每天凌晨更新前一天的聚合数据。

### 3. 手动更新（调试用）

```bash
# 更新最近30天的数据
python backend/scripts/aggregations/update_daily_metrics_unified.py

# 更新指定日期范围
python backend/scripts/aggregations/update_daily_metrics_unified.py 2025-01-01 2025-01-15
```

## 性能优化

### 1. 索引优化

已创建的索引：
- `idx_unique_metrics`: 复合唯一索引（date, platform, agency, business_model）
- `idx_date_platform`: 日期 + 平台复合索引
- `idx_date_agency`: 日期 + 代理商复合索引
- `idx_platform_bm`: 平台 + 业务模式复合索引

### 2. 批量插入

使用批量插入而非逐条插入，提升性能：

```python
# 收集所有需要更新的记录
metrics_to_update = []

for metric in metrics:
    # ... 计算转化指标
    metrics_to_update.append(metric)

# 批量更新
db.session.bulk_save_objects(metrics_to_update)
db.session.commit()
```

### 3. 增量更新

只更新有变化的日期，而不是全量更新：

```python
# 获取有新数据的日期
new_dates = db.session.query(
    distinct(TencentAdData.date)
).filter(
    TencentAdData.date > last_update_date
).all()

# 只更新这些日期的数据
for date in new_dates:
    update_daily_metrics_for_date(date)
```

## 测试计划

### 1. 单元测试

创建 `backend/tests/test_daily_metrics_unified.py`：

```python
def test_aggregate_ad_data():
    """测试广告数据聚合"""
    pass

def test_aggregate_conversion_data():
    """测试转化数据聚合"""
    pass

def test_agency_analysis_query():
    """测试厂商分析查询"""
    pass

def test_conversion_funnel_query():
    """测试转化漏斗查询"""
    pass

def test_user_deduplication():
    """测试用户去重逻辑"""
    pass
```

### 2. 集成测试

1. 导入测试数据（广告数据 + 转化数据）
2. 运行聚合脚本
3. 验证 `daily_metrics_unified` 表中的数据
4. 测试厂商分析和转化漏斗接口

### 3. 性能测试

- 测试聚合 1000 天数据的时间
- 测试厂商分析查询的响应时间
- 测试转化漏斗查询的响应时间

## 回滚方案

如果新版本有问题，可以回滚：

```python
# 1. 恢复旧模型代码
# 2. 删除新字段
ALTER TABLE daily_metrics_unified
    DROP COLUMN click_users,
    DROP COLUMN lead_users,
    DROP COLUMN customer_mouth_users,
    DROP COLUMN valid_lead_users,
    DROP COLUMN customer_users,
    DROP COLUMN opened_account_users,
    DROP COLUMN valid_customer_users;

# 3. 恢复旧版 API 代码
```

## 版本信息

- **当前版本**: v2.4
- **发布日期**: 2026-01-19
- **兼容性**: 向后兼容 v2.3
- **破坏性变更**: 无（新增字段，不影响现有查询）
