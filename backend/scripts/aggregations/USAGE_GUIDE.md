# Daily Metrics Unified 表优化 - 使用指南

## 版本信息
- 版本: v2.4
- 日期: 2026-01-19
- 兼容性: 向后兼容 v2.3

## 快速开始

### 1. 运行数据库迁移

首先需要添加新字段到数据库：

```bash
# Windows
python backend\migrations\add_daily_metrics_fields_v2.4.py

# Linux/Mac
python backend/migrations/add_daily_metrics_fields_v2.4.py
```

**预期输出**：
```
开始执行数据库迁移 v2.4...
1. 添加 click_users 字段...
   ✅ click_users 字段添加成功
2. 添加 lead_users 字段...
   ✅ lead_users 字段添加成功
...
8. 创建索引...
   ✅ 复合唯一索引创建成功
   ✅ 日期+平台索引创建成功
   ✅ 日期+代理商索引创建成功
   ✅ 平台+业务模式索引创建成功

✅ 数据库迁移 v2.4 完成！
```

### 2. 更新聚合数据

迁移完成后，运行数据聚合脚本填充数据：

```bash
# Windows - 更新最近30天的数据
python backend\scripts\aggregations\update_daily_metrics_unified.py

# Linux/Mac
python backend/scripts/aggregations/update_daily_metrics_unified.py
```

**指定日期范围**：
```bash
# 更新 2025-01-01 到 2025-01-15 的数据
python backend/scripts/aggregations/update_daily_metrics_unified.py 2025-01-01 2025-01-15
```

**预期输出**：
```
开始更新 daily_metrics_unified: 2025-01-01 到 2025-01-15

1. 聚合广告数据...
   1.1 聚合腾讯广告数据...
      找到 150 条腾讯广告数据
   1.2 聚合抖音广告数据...
      找到 120 条抖音广告数据
   1.3 聚合小红书广告数据...
      找到 80 条小红书广告数据
   ✅ 广告数据聚合完成

2. 聚合转化数据...
   需要更新 350 条记录的转化数据
   进度: 100/350
   进度: 200/350
   进度: 300/350
   ✅ 转化数据聚合完成

✅ 完成！更新了 350 条记录
```

## 新增字段说明

### 字段列表

| 字段名 | 类型 | 说明 | 数据来源 |
|-------|------|------|---------|
| `click_users` | Integer | 点击人数（去重） | backend_conversions |
| `lead_users` | Integer | 线索人数（去重，is_valid_lead=true） | backend_conversions |
| `customer_mouth_users` | Integer | 开口人数（去重，is_customer_mouth=true） | backend_conversions |
| `valid_lead_users` | Integer | 有效线索人数（去重） | backend_conversions |
| `customer_users` | Integer | 成单人数（去重，is_customer=true） | backend_conversions |
| `opened_account_users` | Integer | 开户人数（去重，is_opened_account=true） | backend_conversions |
| `valid_customer_users` | Integer | 有效户人数（去重，is_valid_customer=true） | backend_conversions |

### 去重逻辑

由于 `backend_conversions` 表没有唯一的用户标识字段，使用以下字段的组合作为唯一标识：

```
platform_source + '|' + wechat_nickname + '|' + capital_account + '|' + platform_user_id
```

**示例**：
```
腾讯|张三|123456789|wechat_123
```

## 数据查询示例

### 厂商分析查询

```sql
-- 查询指定日期范围、平台、代理商、业务模式的汇总数据
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
GROUP BY platform, business_model, agency
ORDER BY platform, agency, business_model;
```

### 转化漏斗查询

```sql
-- 查询完整转化漏斗
SELECT
    SUM(impressions) as impressions,  -- 曝光
    SUM(clicks) as clicks,  -- 点击次数
    SUM(click_users) as click_users,  -- 点击人数
    SUM(lead_users) as lead_users,  -- 线索
    SUM(customer_mouth_users) as customer_mouth_users,  -- 开口
    SUM(valid_lead_users) as valid_lead_users,  -- 有效
    SUM(customer_users) as customer_users,  -- 成单
    SUM(opened_account_users) as opened_account_users,  -- 开户
    SUM(valid_customer_users) as valid_customer_users  -- 有效户
FROM daily_metrics_unified
WHERE date >= '2025-01-01' AND date <= '2025-01-15'
  AND platform IN ('腾讯', '抖音')
  AND agency IN ('量子', '众联')
  AND business_model IN ('直播', '信息流');
```

### 日级趋势查询

```sql
-- 查询日级趋势数据
SELECT
    date,
    platform,
    agency,
    business_model,
    cost,
    impressions,
    clicks,
    click_users,  -- 新增
    lead_users,  -- 新增
    customer_mouth_users,  -- 新增
    valid_lead_users,  -- 新增
    customer_users,  -- 新增
    opened_account_users,  -- 新增
    valid_customer_users  -- 新增
FROM daily_metrics_unified
WHERE date >= '2025-01-01' AND date <= '2025-01-15'
  AND platform = '腾讯'
  AND agency = '量子'
  AND business_model = '直播'
ORDER BY date;
```

## API 接口更新

### 厂商分析接口

**接口**: `POST /api/v1/agency-analysis`

**新增返回字段**：
```json
{
  "success": true,
  "data": {
    "summary": [
      {
        "platform": "腾讯",
        "business_model": "直播",
        "agency": "量子",
        "total_cost": 100000,
        "total_impressions": 1000000,
        "total_clicks": 100000,
        "total_click_users": 50000,  // 新增
        "total_lead_users": 5000,  // 新增
        "total_leads": 5000,
        "total_customer_mouth_users": 3000,  // 新增
        "total_valid_lead_users": 4000,  // 新增
        "total_customer_users": 2000,  // 新增
        "total_opened_account_users": 1000,  // 新增
        "total_new_accounts": 1000,
        "total_valid_customer_users": 500  // 新增
      }
    ]
  }
}
```

### 转化漏斗接口

**接口**: `POST /api/v1/conversion-funnel`

**返回漏斗层级**：
```json
{
  "success": true,
  "data": {
    "funnel": [
      {"stage": "曝光", "count": 1000000, "rate": 100},
      {"stage": "点击", "count": 100000, "rate": 10},
      {"stage": "点击人数", "count": 50000, "rate": 5},  // 新增
      {"stage": "线索", "count": 5000, "rate": 10},
      {"stage": "开口", "count": 3000, "rate": 60},
      {"stage": "有效", "count": 4000, "rate": 80},
      {"stage": "成单", "count": 2000, "rate": 50},
      {"stage": "开户", "count": 1000, "rate": 50},
      {"stage": "有效户", "count": 500, "rate": 50}
    ]
  }
}
```

## 数据更新时机

### 方式 1: 手动更新（推荐用于初始数据填充）

```bash
# 更新最近30天
python backend/scripts/aggregations/update_daily_metrics_unified.py

# 更新指定范围
python backend/scripts/aggregations/update_daily_metrics_unified.py 2025-01-01 2025-01-15
```

### 方式 2: 自动更新（推荐用于生产环境）

在 `backend/routes/upload.py` 的文件上传接口中，添加自动更新逻辑：

```python
# 在文件导入成功后
if response['success']:
    from backend.scripts.aggregations.update_daily_metrics_unified import update_daily_metrics

    try:
        # 获取导入数据的日期范围（从导入结果中提取）
        start_date = extracted_start_date
        end_date = extracted_end_date

        # 异步更新聚合表
        # 注意：这里应该使用 Celery 或其他异步任务队列
        # update_daily_metrics(start_date, end_date)

        print(f"✅ 已将聚合表更新加入队列: {start_date} 到 {end_date}")
    except Exception as e:
        print(f"⚠️  更新聚合表失败: {str(e)}")
```

### 方式 3: 定时任务（可选）

使用 Celery Beat 或 APScheduler 设置定时任务，每天凌晨更新前一天的聚合数据。

**APScheduler 示例**：
```python
from apscheduler.schedulers.background import BackgroundScheduler
from backend.scripts.aggregations.update_daily_metrics_unified import update_daily_metrics
from datetime import datetime, timedelta

scheduler = BackgroundScheduler()

# 每天凌晨 2:00 执行
@scheduler.scheduled_job('cron', hour=2, minute=0)
def update_daily_aggregation():
    yesterday = datetime.now().date() - timedelta(days=1)
    update_daily_metrics(yesterday, yesterday)
    print(f"✅ 已更新 {yesterday} 的聚合数据")

scheduler.start()
```

## 性能优化建议

### 1. 批量插入

当前脚本使用逐条插入，对于大量数据可以考虑优化为批量插入。

### 2. 增量更新

只更新有变化的日期，而不是每次都更新全部数据。

### 3. 数据库连接池

确保数据库连接池配置合理，避免连接耗尽。

### 4. 异步处理

使用 Celery 或其他异步任务队列，将聚合更新放到后台执行。

## 故障排查

### 问题 1: 迁移脚本执行失败

**错误**: `no such table: daily_metrics_unified`

**解决**: 先运行 `python init_db.py` 初始化数据库。

### 问题 2: 聚合脚本执行失败

**错误**: `AttributeError: 'BackendConversions' has no attribute 'is_customer'`

**解决**: 检查 `backend/models.py` 中的 `BackendConversions` 模型，确认字段名是否正确。

### 问题 3: 转化数据为 0

**原因**:
- `backend_conversions` 表没有数据
- `agency` 字段不匹配
- `lead_date` 没有值

**解决**:
1. 检查 `backend_conversions` 表是否有数据
2. 确认 `agency` 字段值与广告数据一致
3. 确认 `lead_date` 字段已填充

### 问题 4: 去重人数异常

**原因**: 用户标识组合不唯一

**解决**: 调整 `_calculate_conversion_metrics` 函数中的 `user_identifier` 表达式，增加更多唯一字段。

## 数据验证

### 验证脚本

创建 `backend/scripts/validations/validate_daily_metrics_unified.py`：

```python
"""验证 daily_metrics_unified 数据的正确性"""

def validate_aggregation():
    """验证聚合数据的正确性"""
    from backend import create_app
    from backend.database import db
    from backend.models import DailyMetricsUnified, TencentAdData, BackendConversions
    from sqlalchemy import func, and_

    app = create_app()

    with app.app_context():
        # 1. 验证广告数据聚合
        print("1. 验证广告数据聚合...")

        # 从原始表聚合
        original_cost = db.session.query(
            func.sum(TencentAdData.cost)
        ).filter(
            and_(
                TencentAdData.date >= '2025-01-01',
                TencentAdData.date <= '2025-01-15'
            )
        ).scalar() or 0

        # 从聚合表查询
        aggregated_cost = db.session.query(
            func.sum(DailyMetricsUnified.cost)
        ).filter(
            and_(
                DailyMetricsUnified.date >= '2025-01-01',
                DailyMetricsUnified.date <= '2025-01-15',
                DailyMetricsUnified.platform == '腾讯'
            )
        ).scalar() or 0

        if original_cost == aggregated_cost:
            print(f"   ✅ 广告数据聚合正确（花费: {original_cost}）")
        else:
            print(f"   ❌ 广告数据聚合不一致！原始: {original_cost}, 聚合: {aggregated_cost}")

        # 2. 验证转化数据聚合
        print("2. 验证转化数据聚合...")

        # 从原始表聚合
        original_leads = db.session.query(
            func.count(func.distinct(
                func.concat(
                    BackendConversions.platform_source, '|',
                    func.coalesce(BackendConversions.wechat_nickname, ''), '|',
                    func.coalesce(BackendConversions.capital_account, '')
                )
            ))
        ).filter(
            and_(
                BackendConversions.lead_date >= '2025-01-01',
                BackendConversions.lead_date <= '2025-01-15',
                BackendConversions.is_valid_lead == True
            )
        ).scalar() or 0

        # 从聚合表查询
        aggregated_leads = db.session.query(
            func.sum(DailyMetricsUnified.lead_users)
        ).filter(
            and_(
                DailyMetricsUnified.date >= '2025-01-01',
                DailyMetricsUnified.date <= '2025-01-15'
            )
        ).scalar() or 0

        if original_leads == aggregated_leads:
            print(f"   ✅ 转化数据聚合正确（线索人数: {original_leads}）")
        else:
            print(f"   ⚠️  转化数据聚合可能不一致（原始: {original_leads}, 聚合: {aggregated_leads}）")
            print(f"      注意：这可能是因为代理商映射不完整")

if __name__ == '__main__':
    validate_aggregation()
```

### 运行验证

```bash
python backend/scripts/validations/validate_daily_metrics_unified.py
```

## 回滚方案

如果新版本有问题，需要回滚：

### 方案 1: 使用迁移脚本的回滚功能

```bash
python backend/migrations/add_daily_metrics_fields_v2.4.py --rollback
```

**注意**: SQLite 不支持 `DROP COLUMN`，会提示需要手动回滚。

### 方案 2: 手动回滚（SQLite）

```bash
# 1. 备份数据库
cp database/shengxintou.db database/shengxintou.db.backup

# 2. 删除表
sqlite3 database/shengxintou.db "DROP TABLE daily_metrics_unified;"

# 3. 重建表
python init_db.py

# 4. 如果有备份，恢复数据（手动从备份导出和导入）
```

### 方案 3: 代码回滚

1. 恢复 `backend/models.py` 到旧版本
2. 重启应用
3. 新字段会被忽略，不影响现有功能

## 下一步优化

1. **添加增量更新逻辑**：只更新有变化的日期，提升性能
2. **实现异步更新**：使用 Celery 实现后台异步更新
3. **添加数据质量检查**：验证聚合数据的准确性
4. **优化去重逻辑**：使用更精确的用户唯一标识
5. **添加聚合历史记录**：记录每次更新的时间和范围

## 相关文档

- 优化方案: `backend/scripts/aggregations/optimize_daily_metrics_unified.md`
- 数据库模型: `backend/models.py`
- API 接口: `backend/routes/data.py`

## 技术支持

如有问题，请查看：
1. 控制台错误日志
2. `logs/app.log` 应用日志
3. 数据库迁移脚本输出
