# Daily Metrics Unified 表优化完成报告

## 更新时间
2026-01-19

## 状态
✅ **已完成**

## 完成内容

### 1. 数据库模型更新 ✅

**文件**: `backend/models.py`

**更新内容**:
- 在 `DailyMetricsUnified` 模型中添加了 7 个转化相关字段
- 更新了类的 docstring，详细说明每个字段的含义

**新增字段**:
```python
click_users = Column(Integer, default=0)  # 点击人数（去重）
lead_users = Column(Integer, default=0)  # 线索人数（去重）
customer_mouth_users = Column(Integer, default=0)  # 开口人数（去重）
valid_lead_users = Column(Integer, default=0)  # 有效线索人数（去重）
customer_users = Column(Integer, default=0)  # 成单人数（去重）
opened_account_users = Column(Integer, default=0)  # 开户人数（去重）
valid_customer_users = Column(Integer, default=0)  # 有效户人数（去重）
```

### 2. 数据库迁移完成 ✅

**迁移结果**:
```
Checking existing fields...
Existing columns: [..., 'click_users']

Found 6 missing fields
Starting migration...
1. Adding lead_users field...            [OK]
2. Adding customer_mouth_users field...    [OK]
3. Adding valid_lead_users field...       [OK]
4. Adding customer_users field...          [OK]
5. Adding opened_account_users field...    [OK]
6. Adding valid_customer_users field...    [OK]

[SUCCESS] Migration completed! Added 6 fields
```

**创建的索引**:
```
idx_date_platform  [OK]  - 日期+平台复合索引
idx_date_agency     [OK]  - 日期+代理商复合索引
idx_platform_bm      [OK]  - 平台+业务模式复合索引
```

### 3. 数据聚合脚本创建完成 ✅

**文件**: `backend/scripts/aggregations/update_daily_metrics_unified.py`

**功能**:
- 从 3 张广告数据表聚合数据到 `daily_metrics_unified`
- 从后端转化表聚合转化指标（去重人数）
- 支持指定日期范围或默认最近30天
- 智能处理不同平台的数据差异

**使用方式**:
```bash
# 更新最近30天
python backend/scripts/aggregations/update_daily_metrics_unified.py

# 更新指定范围
python backend/scripts/aggregations/update_daily_metrics_unified.py 2025-01-01 2025-01-15
```

## 支持的报表功能

### 1. 厂商分析报表

**接口**: `POST /api/v1/agency-analysis`

**支持指标**:
- 花费 (cost)
- 曝光 (impressions)
- 点击次数 (clicks)
- **点击人数 (click_users)** ⭐ 新增
- **线索人数 (lead_users)** ⭐ 新增
- 线索数 (leads)
- **开口人数 (customer_mouth_users)** ⭐ 新增
- **有效线索人数 (valid_lead_users)** ⭐ 新增
- **成单人数 (customer_users)** ⭐ 新增
- **开户人数 (opened_account_users)** ⭐ 新增
- 新开户数 (new_accounts)
- **有效户人数 (valid_customer_users)** ⭐ 新增

**查询示例**:
```python
POST /api/v1/agency-analysis
{
  "filters": {
    "platforms": ["腾讯", "抖音"],
    "business_models": ["直播", "信息流"],
    "agencies": ["量子", "众联"],
    "date_range": ["2025-01-01", "2025-01-15"]
  }
}
```

### 2. 转化漏斗报表

**接口**: `POST /api/v1/conversion-funnel`

**完整漏斗层级**:
1. 曝光 (impressions)
2. 点击次数 (clicks)
3. **点击人数 (click_users)** ⭐ 新增
4. **线索人数 (lead_users)** ⭐ 新增
5. **开口人数 (customer_mouth_users)** ⭐ 新增
6. **有效人数 (valid_lead_users)** ⭐ 新增
7. **成单人数 (customer_users)** ⭐ 新增
8. **开户人数 (opened_account_users)** ⭐ 新增
9. **有效户人数 (valid_customer_users)** ⭐ 新增

**查询示例**:
```python
POST /api/v1/conversion-funnel
{
  "filters": {
    "platforms": ["腾讯", "抖音"],
    "agencies": ["量子", "众联"],
    "business_models": ["直播", "信息流"],
    "date_range": ["2025-01-01", "2025-01-15"]
  }
}
```

## 数据更新方式

### 初始数据填充

```bash
# 更新最近30天的数据
python backend/scripts/aggregations/update_daily_metrics_unified.py
```

**预期输出**:
```
开始更新 daily_metrics_unified: 2025-01-01 到 2025-01-15

1. 聚合广告数据...
   1.1 聚合腾讯广告数据...
      找到 X 条腾讯广告数据
   1.2 聚合抖音广告数据...
      找到 X 条抖音广告数据
   1.3 聚合小红书广告数据...
      找到 X 条小红书广告数据
   [OK] 广告数据聚合完成

2. 聚合转化数据...
   需要更新 X 条记录的转化数据
   [OK] 转化数据聚合完成

[SUCCESS] 完成！更新了 X 条记录
```

### 自动更新（生产环境）

建议在 `backend/routes/upload.py` 中添加自动更新逻辑：

```python
# 在文件导入成功后
if response['success']:
    from backend.scripts.aggregations.update_daily_metrics_unified import update_daily_metrics

    try:
        # 获取导入数据的日期范围
        start_date = ...
        end_date = ...

        # 异步更新聚合表
        # 注意：这里应该使用 Celery 或其他异步任务队列
        update_daily_metrics(start_date, end_date)

        print(f"[OK] Aggregation table updated: {start_date} to {end_date}")
    except Exception as e:
        print(f"[WARNING] Failed to update aggregation table: {str(e)}")
```

## 数据验证

### 验证聚合数据正确性

创建验证脚本检查数据一致性：

```python
# 验证广告数据聚合
original_cost = db.session.query(func.sum(TencentAdData.cost)).filter(...).scalar()
aggregated_cost = db.session.query(func.sum(DailyMetricsUnified.cost)).filter(...).scalar()

assert original_cost == aggregated_cost, f"Cost mismatch: {original_cost} != {aggregated_cost}"

# 验证转化数据聚合
original_leads = db.session.query(func.count(distinct(...))).filter(...).scalar()
aggregated_leads = db.session.query(func.sum(DailyMetricsUnified.lead_users)).filter(...).scalar()

# 注意：转化数据可能因为代理商映射不完整而略有差异
```

## 技术细节

### 去重逻辑

由于 `backend_conversions` 表没有唯一的用户标识字段，使用以下字段的组合作为去重标识：

```python
user_identifier = concat(
    BackendConversions.platform_source, '|',
    coalesce(BackendConversions.wechat_nickname, ''), '|',
    coalesce(BackendConversions.capital_account, ''), '|',
    coalesce(BackendConversions.platform_user_id, '')
)
```

**示例**:
```
腾讯|张三|123456789|wechat_123
```

### 聚合维度

数据按以下维度聚合：
- **date** (日期)
- **platform** (平台：腾讯/抖音/小红书)
- **agency** (代理商)
- **business_model** (业务模式：直播/信息流/搜索)

### 数据来源

**广告数据**（3张表）:
- `raw_ad_data_tencent` (腾讯广告)
- `raw_ad_data_douyin` (抖音广告)
- `raw_ad_data_xiaohongshu` (小红书广告)

**转化数据**（1张表）:
- `backend_conversions` (线索明细表)

**映射数据**（1张表）:
- `account_agency_mapping` (账号代理商映射)

## 性能优化

### 索引优化

已创建以下索引提升查询性能：

```sql
-- 复合唯一索引（确保数据唯一性）
CREATE UNIQUE INDEX idx_unique_metrics
ON daily_metrics_unified(date, platform, agency, business_model);

-- 日期+平台索引（优化日期范围+平台筛选）
CREATE INDEX idx_date_platform
ON daily_metrics_unified(date, platform);

-- 日期+代理商索引（优化日期范围+代理商筛选）
CREATE INDEX idx_date_agency
ON daily_metrics_unified(date, agency);

-- 平台+业务模式索引（优化平台+业务模式筛选）
CREATE INDEX idx_platform_bm
ON daily_metrics_unified(platform, business_model);
```

### 查询优化

使用聚合表后，报表查询从：
- **原方案**: 需要关联 4 张表（3张广告表 + 1张转化表）
- **新方案**: 只查询 1 张聚合表

**性能提升**:
- 减少表关联开销
- 利用索引加速查询
- 预聚合数据，无需实时计算

## 后续优化建议

### 1. 实现增量更新

当前脚本全量更新指定日期范围，可以优化为：
- 只更新有变化的日期
- 监控广告数据和转化数据的变化
- 触发式更新而非定时全量更新

### 2. 添加异步任务队列

使用 Celery 实现后台异步更新：
```python
@celery.task
def update_aggregation_task(start_date, end_date):
    update_daily_metrics(start_date, end_date)
```

### 3. 添加数据质量检查

- 验证聚合数据的准确性
- 检测数据异常（如负数、空值）
- 记录聚合日志（更新时间、数据范围、耗时）

### 4. 优化去重逻辑

当前使用简单的字段拼接作为用户标识，可以优化为：
- 添加用户唯一标识字段到 `backend_conversions` 表
- 使用 UUID 或 hash 作为唯一标识
- 支持跨平台用户识别

## 文档清单

1. **优化方案**: `backend/scripts/aggregations/optimize_daily_metrics_unified.md`
2. **使用指南**: `backend/scripts/aggregations/USAGE_GUIDE.md`
3. **迁移脚本**: `backend/migrations/add_daily_metrics_fields_v2.4.py`
4. **智能迁移**: `backend/migrations/add_missing_fields_v2.4.py`
5. **聚合脚本**: `backend/scripts/aggregations/update_daily_metrics_unified.py`
6. **数据模型**: `backend/models.py` (DailyMetricsUnified 类)

## 版本信息

- **当前版本**: v2.4
- **发布日期**: 2026-01-19
- **兼容性**: 向后兼容 v2.3
- **破坏性变更**: 无（新增字段，不影响现有查询）

## 总结

✅ **数据库模型已更新**
✅ **数据库迁移已完成**
✅ **聚合脚本已创建**
✅ **索引已优化**
✅ **文档已完善**

**下一步**:
1. 运行聚合脚本填充初始数据
2. 测试厂商分析和转化漏斗接口
3. 根据实际使用情况优化性能
