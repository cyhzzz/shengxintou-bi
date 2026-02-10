# 转化数据去重逻辑修复

## 问题描述

**发现时间**：2026-01-21
**影响范围**：`daily_metrics_unified` 表的转化指标（lead_users, potential_customers, customer_mouth_users, valid_lead_users, opened_account_users, valid_customer_users）

### 原始错误的逻辑

```python
# 错误：使用 user_identifier 去重
user_identifier = func.concat(
    BackendConversions.platform_source, '|',
    func.coalesce(BackendConversions.wechat_nickname, ''), '|',  # ❌ 微信昵称可能重复
    func.coalesce(BackendConversions.capital_account, ''), '|',
    func.coalesce(BackendConversions.platform_user_id, '')
)

func.count(func.distinct(user_identifier)).label('lead_users')
```

**问题**：
- `wechat_nickname` 相同 ≠ 同一个人（可能只是同名）
- `backend_conversions` 表本身已经是天然去重的（外部导入时已去重）
- 导致统计结果偏小：162条原始记录 → 161个线索（错误地合并了2个微信昵称相同的用户）

### 修复后的逻辑

```python
# ✅ 正确：直接使用 id 字段计数（每条记录代表一个独立的线索）
func.count(BackendConversions.id).label('lead_users')

# 带条件的计数（使用 CASE WHEN + id）
func.count(
    case(
        (BackendConversions.is_existing_customer == False, BackendConversions.id),
        else_=None
    )
).label('potential_customers')
```

## 修改内容

### 文件：`backend/scripts/aggregations/update_daily_metrics_unified.py`

#### 修改1：删除 user_identifier 定义（第420-426行）

```diff
-    # 构建用户标识去重的表达式
-    user_identifier = func.concat(
-        BackendConversions.platform_source, '|',
-        func.coalesce(BackendConversions.wechat_nickname, ''), '|',
-        func.coalesce(BackendConversions.capital_account, ''), '|',
-        func.coalesce(BackendConversions.platform_user_id, '')
-    )
```

#### 修改2：腾讯转化数据查询（第444-502行）

```diff
     tencent_conversions = db.session.query(
         BackendConversions.lead_date.label('date'),
         func.coalesce(AccountAgencyMapping.agency, '').label('agency'),
         func.coalesce(business_model_mapping, '').label('business_model'),
-        func.count(func.distinct(user_identifier)).label('lead_users'),
+        # 直接使用 id 计数（每条记录代表一个独立的线索）
+        func.count(BackendConversions.id).label('lead_users'),
-        func.count(
-            func.distinct(
-                case(
-                    (BackendConversions.is_existing_customer == False, user_identifier),
-                    else_=None
-                )
-            )
-        ).label('potential_customers'),
+        # 带条件的计数（使用 CASE WHEN + id）
+        func.count(
+            case(
+                (BackendConversions.is_existing_customer == False, BackendConversions.id),
+                else_=None
+            )
+        ).label('potential_customers'),
         ...（其他字段类似修改）
```

#### 修改3：其他平台转化数据查询（第522-560行）

抖音、小红书、yj、高德平台的查询逻辑使用相同的修改方式。

## 影响的字段

以下所有转化指标字段均已修复：

| 字段名 | 原逻辑 | 新逻辑 |
|--------|--------|--------|
| `lead_users` | `COUNT(DISTINCT user_identifier)` | `COUNT(id)` |
| `potential_customers` | `COUNT(DISTINCT CASE WHEN ...)` | `COUNT(CASE WHEN ... id)` |
| `customer_mouth_users` | `COUNT(DISTINCT CASE WHEN ...)` | `COUNT(CASE WHEN ... id)` |
| `valid_lead_users` | `COUNT(DISTINCT CASE WHEN ...)` | `COUNT(CASE WHEN ... id)` |
| `opened_account_users` | `COUNT(DISTINCT CASE WHEN ...)` | `COUNT(CASE WHEN ... id)` |
| `valid_customer_users` | `COUNT(DISTINCT CASE WHEN ...)` | `COUNT(CASE WHEN ... id)` |

## 验证方法

### 1. 验证原始数据

```sql
-- 查看 backend_conversions 表的记录数
SELECT COUNT(*) as total_records
FROM backend_conversions
WHERE lead_date = '2025-07-23';
-- 应该是：162

-- 查看按平台分组的记录数
SELECT platform_source, COUNT(*) as count
FROM backend_conversions
WHERE lead_date = '2025-07-23'
GROUP BY platform_source;
```

### 2. 重新运行聚合脚本

```bash
# 更新2025-07-23的数据
python backend/scripts/aggregations/update_daily_metrics_unified.py 2025-07-23 2025-07-23
```

### 3. 验证聚合结果

```sql
-- 查看 daily_metrics_unified 表的线索人数
SELECT
    date,
    platform,
    SUM(lead_users) as total_leads
FROM daily_metrics_unified
WHERE date = '2025-07-23'
GROUP BY date, platform;
-- 应该是：162（而不是之前的161）
```

## 重要说明

### 为什么不需要去重？

1. **外部数据已去重**：
   - `backend_conversions` 表的数据从外部系统导入
   - 外部系统在导入时已经进行了去重处理
   - 每条记录代表一个独立的线索

2. **微信昵称不唯一**：
   - `wechat_nickname` 只是用户的显示名称
   - 不同的人可能有相同的微信昵称（例如：小明、张三）
   - 不能使用微信昵称作为用户唯一标识

3. **主键保证唯一性**：
   - `backend_conversions.id` 是自增主键
   - 每条记录的 id 都是唯一的
   - 使用 `COUNT(id)` 能够正确统计记录数

### 修复后的预期变化

- **修复前**：线索人数 = 161（错误，将2个微信昵称相同的用户合并）
- **修复后**：线索人数 = 162（正确，每条记录都独立计数）

## 相关文档

- 数据处理规则：`.claude/rules/data-rules.md`
- 数据库架构：`.claude/rules/database-architecture.md`
- 聚合表设计：`backend/scripts/aggregations/REDESIGN_DAILY_METRICS.md`

## 版本历史

### v1.0 (2026-01-21)
- ✅ 删除 `user_identifier` 去重逻辑
- ✅ 改用 `COUNT(id)` 直接计数
- ✅ 修改腾讯平台查询
- ✅ 修改抖音、小红书、yj、高德平台查询
- ✅ 更新文档说明

---

**修复人员**：Claude Code
**审核状态**：待用户验证
**下一步**：重新运行聚合脚本更新所有历史数据
