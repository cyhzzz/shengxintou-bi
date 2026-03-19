# 新旧前端功能对比测试报告

**测试日期**: 2026-03-16
**旧前端地址**: http://127.0.0.1:5000 (原生 JavaScript)
**新前端地址**: http://localhost:5173 (React + TypeScript)
**测试范围**: 12个主要功能页面

---

## 问题严重等级定义

| 等级 | 说明 | 处理优先级 |
|------|------|-----------|
| **P0** | 致命问题 - 功能完全缺失或无法使用 | 立即修复 |
| **P1** | 严重问题 - 核心功能异常或数据错误 | 高优先级 |
| **P2** | 一般问题 - 次要功能缺失或体验不佳 | 中优先级 |
| **P3** | 轻微问题 - 样式或交互小问题 | 低优先级 |

---

## 问题汇总

| 序号 | 页面 | 问题描述 | 严重等级 | 状态 |
|------|------|---------|---------|------|
| 1 | 员工转化周报 | 整个页面功能缺失 | **P0** | 待修复 |
| 2 | 线索明细 | 缺少29个数据字段 | **P1** | 待修复 |
| 3 | 厂商分析 | API字段命名不一致 | **P1** | 待验证 |
| 4 | 报告生成 | 两端均未实现 | **P2** | 计划中 |
| 5 | 账号管理 | 功能完整 | - | 通过 |
| 6 | 简称管理 | 功能完整 | - | 通过 |
| 7 | 小红书运营分析 | 功能完整 | - | 通过 |
| 8 | 小红书笔记列表 | 功能完整 | - | 通过 |
| 9 | 数据概览 | 功能完整 | - | 通过 |
| 10 | 转化漏斗 | 功能完整 | - | 通过 |
| 11 | 数据导入 | 功能完整 | - | 通过 |
| 12 | 转化报表 | 功能完整 | - | 通过 |

---

## 详细问题分析

### 1. 员工转化周报 (P0 - 致命)

**问题**: 新前端完全缺失此功能页面

**旧前端功能** (`EmployeeConversionWeekly.js`):
- 周报配置：日期范围选择（默认上周一到上周日）
- 平台多选：小红书、腾讯、抖音
- 榜单人数：TOP 5/10/20
- 生成周报：文本格式的周报内容
- 复制报告：一键复制周报文本
- 导出Word：生成Word文档
- 导出Excel：生成Excel表格
- **海报导出**：
  - 小红书海报（红色渐变样式）
  - 腾讯海报（蓝色渐变样式）
  - 抖音海报（黑色渐变样式）
  - 使用html2canvas生成图片

**新前端状态**:
- 搜索 `**/Employee*Weekly*.{tsx,ts}` 无结果
- 搜索 `**/Weekly*.{tsx,ts}` 无相关页面
- 路由配置中无此页面

**影响范围**: 完整的周报生成工作流不可用

**建议修复**:
```typescript
// 需要创建: src/pages/EmployeeConversion/Weekly.tsx
// 功能包括:
// 1. 日期范围选择器
// 2. 平台多选组件
// 3. TOP N 选择
// 4. 周报生成逻辑
// 5. 复制/导出Word/导出Excel功能
// 6. 海报生成组件（使用html2canvas）
```

---

### 2. 线索明细 (P1 - 严重)

**问题**: 新前端表格缺少大量数据字段

**旧前端字段** (`LeadsDetailReport.js` - 40个字段):

| 序号 | 字段名 | 中文名称 | 类型 | 新前端状态 |
|------|--------|---------|------|-----------|
| 1 | wechat_nickname | 微信昵称 | string | 存在 |
| 2 | capital_account | 资金账号 | string | **缺失** |
| 3 | opening_branch | 开户营业部 | string | **缺失** |
| 4 | customer_gender | 客户性别 | string | **缺失** |
| 5 | platform_source | 平台来源 | string | 存在 |
| 6 | traffic_type | 流量类型 | string | **缺失** |
| 7 | customer_source | 客户来源 | string | **缺失** |
| 8 | is_customer_mouth | 是否客户开口 | boolean | **缺失** |
| 9 | is_valid_lead | 是否有效线索 | boolean | **缺失** |
| 10 | is_open_account_interrupted | 是否开户中断 | boolean | **缺失** |
| 11 | open_account_interrupted_date | 开户中断日期 | date | **缺失** |
| 12 | is_opened_account | 是否开户 | boolean | 存在(筛选器) |
| 13 | is_valid_customer | 是否为有效户 | boolean | **缺失** |
| 14 | is_existing_customer | 是否为存量客户 | boolean | **缺失** |
| 15 | is_existing_valid_customer | 是否为存量有效户 | boolean | **缺失** |
| 16 | is_delete_enterprise_wechat | 是否删除企微 | boolean | **缺失** |
| 17 | lead_date | 线索日期 | date | 存在 |
| 18 | first_contact_time | 首次触达时间 | datetime | **缺失** |
| 19 | last_contact_time | 最近互动时间 | datetime | **缺失** |
| 20 | interaction_count | 互动次数 | number | **缺失** |
| 21 | sales_interaction_count | 营销人员互动次数 | number | **缺失** |
| 22 | add_employee_no | 添加员工号 | string | **缺失** |
| 23 | add_employee_name | 添加员工姓名 | string | **缺失** |
| 24 | account_opening_time | 开户时间 | datetime | **缺失** |
| 25 | wechat_verify_status | 微信认证状态 | string | **缺失** |
| 26 | wechat_verify_time | 微信认证时间 | datetime | **缺失** |
| 27 | valid_customer_time | 有效户时间 | datetime | **缺失** |
| 28 | assets | 资产 | currency | **缺失** |
| 29 | customer_contribution | 客户贡献 | currency | **缺失** |
| 30 | ad_account | 广告账号 | string | 存在 |
| 31 | agency | 代理商 | string | 存在 |
| 32 | ad_id | 广告ID | string | **缺失** |
| 33 | creative_id | 创意ID | string | **缺失** |
| 34 | note_id | 笔记ID | string | **缺失** |
| 35 | note_title | 笔记名称 | string | **缺失** |
| 36 | platform_user_id | 平台用户ID | string | **缺失** |
| 37 | platform_user_nickname | 平台用户昵称 | string | **缺失** |
| 38 | ad_click_date | 广告点击日期 | date | **缺失** |
| 39 | producer | 生产者 | string | **缺失** |
| 40 | enterprise_wechat_tags | 企微标签 | string | **缺失** |

**新前端现有字段** (`LeadsDetail/index.tsx`):
- lead_date (线索日期)
- platform_source (平台)
- ad_account (广告账号)
- agency (代理商)
- wechat_nickname (微信昵称)
- is_opened_account (筛选器中使用)
- is_customer (筛选器中使用)
- 详情弹窗中的字段

**新增功能（新前端独有）**:
- 详情弹窗查看完整记录
- Ant Design Table组件（更好的交互体验）

**影响范围**: 数据分析维度严重不足，无法查看完整的客户转化路径

**建议修复**:
1. 在表格中增加可配置列显示
2. 或在详情弹窗中展示所有40个字段
3. 增加CSV导出功能（旧前端有，新前端显示"开发中"）

---

### 3. 厂商分析 (P1 - 严重)

**问题**: API响应字段名称与前端期望不一致

**字段命名对比**:

| 功能 | 旧前端字段 | 新前端字段 | API实际返回 |
|------|-----------|-----------|------------|
| 线索数 | `lead_users` | `leads` | 待验证 |
| 开户数 | `opened_account_users` | `opened_accounts` | 待验证 |
| 有效户数 | `valid_customer_users` | `valid_customers` | 待验证 |

**代码位置**:
- 新前端: `AgencyAnalysis/index.tsx` 第76-99行
- 表格列定义使用 `leads`, `opened_accounts`, `valid_customers`

**潜在影响**: 如果API返回的字段名与新前端不一致，会导致数据显示为空或undefined

**建议修复**:
1. 检查后端API实际返回的字段名
2. 如API返回 `lead_users`，需在前端做字段映射
3. 或修改API返回格式统一

---

### 4. 报告生成 (P2 - 计划中)

**状态**: 两端均未实现

**旧前端**: 无对应文件
**新前端**: 无对应文件

**建议**: 作为新功能规划实现

---

## 功能对比详情

### 5. 账号管理 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 账号列表展示 | DataTable | Ant Design Table | 相当 |
| 筛选功能 | 平台/代理商筛选 | 平台/代理商筛选 | 相当 |
| 添加账号 | Modal表单 | Ant Design Modal | 相当 |
| 编辑账号 | Modal表单 | Ant Design Modal | 相当 |
| 删除账号 | 确认对话框 | Popconfirm | 新前端更好 |
| 批量导入 | 支持 | 支持 | 相当 |

### 6. 简称管理 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 列表展示 | DataTable | Ant Design Table | 相当 |
| 类型筛选 | Select | Select | 相当 |
| 状态筛选 | Select | Select | 相当 |
| 添加映射 | Modal表单 | Ant Design Modal | 相当 |
| 编辑映射 | Modal表单 | Ant Design Modal | 相当 |
| 删除映射 | 确认对话框 | Popconfirm | 新前端更好 |
| 启用/禁用 | Toggle | Switch | 相当 |

### 7. 小红书运营分析 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 核心指标卡片 | 12个 | 12个 | 相当 |
| 创作者内容分析 | Table + 图表 | Table + 图表 | 相当 |
| 笔记Top榜 | Table | Table | 相当 |
| 创作者年度数据 | Table | Table | 相当 |
| 代理商数据 | Table | Table | 相当 |
| 员工转化排名 | Table | Table | 相当 |
| 趋势图表 | ECharts | @ant-design/charts | 相当 |
| 日期筛选 | RangePicker | DateRangePicker | 相当 |
| CSV导出 | 各模块独立导出 | 各模块独立导出 | 相当 |

### 8. 小红书笔记列表 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 笔记列表展示 | DataTable | Ant Design Table | 相当 |
| 数据时间筛选 | RangePicker | RangePicker | 相当 |
| 发布时间筛选 | RangePicker | RangePicker | 相当 |
| 创作者筛选 | MultiSelect | Select多选 | 相当 |
| 内容类型筛选 | Select | Select | 相当 |
| 广告策略筛选 | MultiSelect | Select多选 | 相当 |
| 快速日期选择 | 近7天/30天/90天 | 近7天/30天/90天 | 相当 |
| CSV导出 | 支持 | 支持 | 相当 |
| 分页 | 支持 | Ant Design Pagination | 相当 |

### 9. 数据概览 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 核心指标卡片 | 4个 | 4个 | 相当 |
| 趋势图表 | ECharts折线图 | LineChart | 相当 |
| 平台对比 | 饼图/柱图 | 多图表 | 相当 |
| 筛选功能 | FilterBar | FilterBar | 相当 |

### 10. 转化漏斗 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 漏斗图 | ECharts | FunnelChart | 相当 |
| 转化率数据表 | 自定义Table | Card + 自定义样式 | 相当 |
| 合并转化率 | 显示 | 显示 | 相当 |
| 平台对比表 | DataTable | 自定义Table | 相当 |
| 维度切换 | 平台/代理商/业务模式 | 平台/代理商/业务模式 | 相当 |
| 核心指标卡片 | 无 | 4个 | 新前端更好 |

### 11. 数据导入 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 数据类型选择 | 卡片网格 | 卡片网格 | 相当 |
| 文件上传 | 拖拽+点击 | Upload组件 | 新前端更好 |
| 进度显示 | 自定义 | Ant Design Progress | 相当 |
| 数据新鲜度指示 | 支持 | 支持 | 相当 |
| 导入指南 | 角标访问 | 角标访问 | 相当 |

### 12. 转化报表/员工转化 (通过)

| 功能项 | 旧前端 | 新前端 | 状态 |
|--------|--------|--------|------|
| 员工列表展示 | DataTable | Ant Design Table | 相当 |
| 筛选功能 | 平台/日期 | 平台/日期 | 相当 |
| 排序 | 支持 | 支持 | 相当 |

---

## UI/UX 对比

### 组件对比

| 组件类型 | 旧前端 | 新前端 | 评价 |
|---------|--------|--------|------|
| 表格 | DataTable.js | Ant Design Table | 新前端更强大 |
| 筛选器 | FilterBar.js | FilterBar组件 | 相当 |
| 多选下拉 | MultiSelectDropdown.js | Select mode="multiple" | 新前端更稳定 |
| 日期选择 | 自定义DateRangePicker | Ant Design RangePicker | 新前端更一致 |
| 弹窗 | 自定义Modal | Ant Design Modal | 新前端更美观 |
| 按钮 | .btn系统 | Ant Design Button | 相当 |
| 卡片 | .card系统 | Ant Design Card | 相当 |
| 图表 | ECharts | @ant-design/charts | 新前端集成更好 |

### 样式一致性

| 方面 | 旧前端 | 新前端 | 状态 |
|------|--------|--------|------|
| 设计系统 | CSS Variables + BEM | Ant Design | 统一 |
| 配色方案 | 定义在variables.css | Ant Design默认主题 | 一致 |
| 响应式 | 媒体查询 | Ant Design Grid | 相当 |
| 暗色主题 | 支持 | 待实现 | 旧前端更好 |

---

## 建议修复优先级

### 第一优先级 (P0 - 立即修复)

1. **员工转化周报页面**
   - 创建 `src/pages/EmployeeConversion/Weekly.tsx`
   - 实现完整的周报生成工作流
   - 包括海报导出功能

### 第二优先级 (P1 - 高优先级)

2. **线索明细字段补全**
   - 方案A: 增加表格可配置列
   - 方案B: 详情弹窗展示所有字段
   - 增加CSV导出功能

3. **厂商分析字段验证**
   - 确认API返回字段名
   - 必要时增加字段映射

### 第三优先级 (P2 - 中优先级)

4. **报告生成功能规划**
   - 作为新功能设计实现

---

## 测试环境

- **测试浏览器**: Chrome 134.0
- **后端服务**: http://127.0.0.1:5000
- **数据库**: SQLite (shengxintou.db)
- **测试数据**: 生产数据副本

---

## 附录

### 文件路径对照表

| 功能 | 旧前端文件 | 新前端文件 |
|------|-----------|-----------|
| 数据概览 | `frontend/js/reports/DashboardReport.js` | `frontend-react/src/pages/Dashboard/index.tsx` |
| 厂商分析 | `frontend/js/reports/AgencyAnalysisReport.js` | `frontend-react/src/pages/AgencyAnalysis/index.tsx` |
| 小红书列表 | `frontend/js/reports/XhsNotesListReport.js` | `frontend-react/src/pages/XhsNotes/List.tsx` |
| 小红书运营 | `frontend/js/reports/XhsNotesOperationReport.js` | `frontend-react/src/pages/XhsNotes/Operation.tsx` |
| 线索明细 | `frontend/js/reports/LeadsDetailReport.js` | `frontend-react/src/pages/LeadsDetail/index.tsx` |
| 转化漏斗 | `frontend/js/reports/ConversionFunnelReport.js` | `frontend-react/src/pages/ConversionFunnel/index.tsx` |
| 员工转化 | `frontend/js/reports/EmployeeConversionReport.js` | `frontend-react/src/pages/EmployeeConversion/index.tsx` |
| 员工周报 | `frontend/js/reports/EmployeeConversionWeekly.js` | **缺失** |
| 账号管理 | `frontend/js/reports/AccountManagementReport.js` | `frontend-react/src/pages/System/AccountManagement/index.tsx` |
| 简称管理 | `frontend/js/reports/AbbreviationManagement.js` | `frontend-react/src/pages/System/AbbreviationManagement/index.tsx` |
| 数据导入 | `frontend/js/reports/DataImport.js` | `frontend-react/src/pages/System/DataImport/index.tsx` |

---

**报告生成**: Claude AI
**生成时间**: 2026-03-16 16:00