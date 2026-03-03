# 厂商分析报表增加资产字段设计文档

> **创建日期**: 2026-03-03
> **状态**: 已批准
> **实现优先级**: 中等

---

## 概述

在厂商分析报表（AgencyAnalysisReport）中增加"新增资产"和"服务存量资产"两个列字段，展示开户客户资产和存量客户资产的汇总金额。

---

## 需求

### 业务背景

聚合表 `daily_metrics_unified` 已包含资产相关字段，但厂商分析报表尚未展示这些数据。需要在报表中呈现资产数据，帮助业务人员了解各代理商的资金转化效果。

### 需求确认

| 项目 | 决策 |
|------|------|
| 新增资产 | `opened_account_assets` - 开户客户资产（is_opened_account=True 的 assets 总和） |
| 服务存量资产 | `existing_customer_assets` - 存量客户资产（is_opened_account=False 且 assets>0 的 assets 总和） |
| 展示方式 | 仅展示金额 |
| 列位置 | 放在转化指标（有效户）之后，CTR 之前 |

---

## 设计方案

### 改动范围

| 层级 | 文件 | 改动内容 |
|------|------|---------|
| **后端** | `backend/routes/data/agency_analysis.py` | 查询新增 `opened_account_assets` 和 `existing_customer_assets` 字段 |
| **前端** | `frontend/js/reports/AgencyAnalysisReport.js` | 表格新增"新增资产"和"服务存量资产"两列 |
| **数据库** | 无需修改 | 字段已存在于 `daily_metrics_unified` 表 |

### 后端实现

**文件**: `backend/routes/data/agency_analysis.py`

在查询语句中添加资产字段：

```python
summary_query = db.session.query(
    DailyMetricsUnified.platform,
    DailyMetricsUnified.business_model,
    DailyMetricsUnified.agency,
    func.sum(DailyMetricsUnified.cost).label('total_cost'),
    func.sum(DailyMetricsUnified.impressions).label('total_impressions'),
    func.sum(DailyMetricsUnified.click_users).label('total_click_users'),
    func.sum(DailyMetricsUnified.lead_users).label('total_lead_users'),
    func.sum(DailyMetricsUnified.opened_account_users).label('total_opened_account_users'),
    func.sum(DailyMetricsUnified.valid_customer_users).label('total_valid_customer_users'),
    func.sum(DailyMetricsUnified.opened_account_assets).label('total_opened_account_assets'),  # 新增
    func.sum(DailyMetricsUnified.existing_customer_assets).label('total_existing_customer_assets')  # 新增
)
```

在返回数据中添加资产字段：

```python
return jsonify({
    'success': True,
    'data': {
        'summary': [{
            # ... 现有字段 ...
            'opened_account_assets': float(row.total_opened_account_assets or 0),
            'existing_customer_assets': float(row.total_existing_customer_assets or 0),
        } for row in results]
    }
})
```

### 前端实现

**文件**: `frontend/js/reports/AgencyAnalysisReport.js`

在表格列定义中添加资产列（在"有效户"之后）：

```javascript
const columns = [
    // ... 现有列 ...
    { field: 'valid_customer_users', title: '有效户', width: 80, formatter: this.formatNumber },
    // 新增资产列
    { field: 'opened_account_assets', title: '新增资产', width: 120, formatter: this.formatMoney },
    { field: 'existing_customer_assets', title: '服务存量资产', width: 120, formatter: this.formatMoney },
    // ... 计算列 ...
];
```

### 表格最终列顺序

| 序号 | 列名 | 字段 | 格式 |
|------|------|------|------|
| 1 | 平台 | platform | 文本 |
| 2 | 业务模式 | business_model | 文本 |
| 3 | 代理商 | agency | 文本 |
| 4 | 花费 | cost | ¥1,234.56 |
| 5 | 曝光 | impressions | 1,234 |
| 6 | 点击 | click_users | 1,234 |
| 7 | 线索 | lead_users | 1,234 |
| 8 | 开户 | opened_account_users | 1,234 |
| 9 | 有效户 | valid_customer_users | 1,234 |
| **10** | **新增资产** | **opened_account_assets** | **¥1,234.56** |
| **11** | **服务存量资产** | **existing_customer_assets** | **¥1,234.56** |
| 12 | CTR | ctr | 12.34% |
| 13 | 线索成本 | lead_cost | ¥123.45 |
| 14 | 开户成本 | account_cost | ¥1,234.56 |

---

## 风险评估

| 风险类型 | 评估 | 说明 |
|---------|------|------|
| 数据库迁移 | ✅ 无风险 | 字段已存在，无需迁移 |
| 向后兼容 | ✅ 兼容 | 新增字段不影响现有功能 |
| 数据完整性 | ✅ 已就绪 | 聚合表已包含资产数据 |
| 改动范围 | ✅ 最小 | 仅修改前后端，不涉及数据库 |

---

## 测试计划

1. **后端测试**
   - 验证 API 返回数据包含资产字段
   - 验证数据计算正确（与数据库原始数据对比）

2. **前端测试**
   - 验证表格显示新增列
   - 验证数据格式化正确（金额格式）
   - 验证排序和筛选功能正常

3. **集成测试**
   - 验证前后端数据一致性
   - 验证不同筛选条件下的数据准确性

---

## 实现计划

1. 修改后端 API 查询逻辑
2. 修改前端表格列定义
3. 测试验证
4. 提交代码

---

## 审批记录

- **设计审批**: 2026-03-03 - 用户批准
- **实现审批**: 待定