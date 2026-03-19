# 省心投 BI - 前端迁移对照检查报告

> **生成日期**: 2026-03-13
> **目的**: 系统性对比新旧前端报表页面，识别缺失功能，指导迁移工作

---

## 一、整体迁移状态概览

### 1.1 页面对照表

| 序号 | 旧前端页面 | 新前端页面 | 迁移状态 | 完成度 |
|-----|-----------|-----------|---------|--------|
| 1 | DashboardReport.js | Dashboard/index.tsx | ✅ 已迁移 | 95% |
| 2 | AgencyAnalysisReport.js | AgencyAnalysis/index.tsx | ✅ 已迁移 | 待评估 |
| 3 | XhsNotesListReport.js | XhsNotes/List.tsx | ✅ 已迁移 | 80% |
| 4 | XhsNotesOperationReport.js | XhsNotes/Operation.tsx | ✅ 已迁移 | 待评估 |
| 5 | LeadsDetailReport.js | LeadsDetail/index.tsx | ✅ 已迁移 | 待评估 |
| 6 | ConversionFunnelReport.js | ConversionFunnel/index.tsx | ✅ 已迁移 | 待评估 |
| 7 | EmployeeConversionAnalysis.js | EmployeeConversion/Analysis.tsx | ✅ 已迁移 | 70% |
| 8 | EmployeeConversionWeekly.js | EmployeeConversion/Weekly/index.tsx | ✅ 已迁移 | 60% |
| 9 | AccountManagementReport.js | System/AccountManagement.tsx | ✅ 已迁移 | 待评估 |
| 10 | CostAnalysisReport.js | - | ❌ 未迁移 | 0% |
| 11 | ExternalDataAnalysisReport.js | - | ❌ 未迁移 | 0% |
| 12 | XhsNotesReport.js (父级) | - | ⏭️ 跳过 | 仅菜单 |

### 1.2 统计摘要

- **总页面数**: 11个功能性报表页面
- **已迁移**: 9个 (82%)
- **未迁移**: 2个 (18%)
- **部分功能缺失**: 3个页面存在功能差距

---

## 二、详细功能差距分析

### 2.1 XhsNotes/List (小红书笔记列表)

**新前端文件**: `frontend-react/src/pages/XhsNotes/List.tsx` (506行)

**功能对比**:

| 功能项 | 旧前端 | 新前端 | 状态 |
|-------|--------|--------|------|
| 基础表格 | ✅ 13列 | ✅ 12列 | ⚠️ 缺少1列 |
| 日期筛选 | ✅ 快速选择按钮 | ✅ RangePicker | ✅ 已实现 |
| 创作者筛选 | ✅ 多选下拉 | ✅ 多选下拉 | ✅ 已实现 |
| 内容类型筛选 | ✅ 多选 | ✅ 多选 | ✅ 已实现 |
| 广告策略筛选 | ✅ 多选 | ✅ 多选 | ✅ 已实现 |
| 账号筛选 | ✅ 单选下拉 | ❌ 缺失 | 需补充 |
| 分页 | ✅ | ✅ | ✅ 已实现 |
| 导出CSV | ✅ | ✅ | ✅ 已实现 |
| 行内编辑 | ✅ 点击编辑 | ❌ 缺失 | 需补充 |

**缺失功能**:
1. **账号筛选器**: 旧前端有按发布账号筛选功能
2. **行内编辑**: 旧前端支持点击笔记标题直接编辑
3. **表格列**: 缺少"数据来源"列 (如需要)

---

### 2.2 EmployeeConversion/Weekly (员工转化周报)

**新前端文件**: `frontend-react/src/pages/EmployeeConversion/Weekly/index.tsx` (389行)

**功能对比**:

| 功能项 | 旧前端 | 新前端 | 状态 |
|-------|--------|--------|------|
| 日期选择 | ✅ 周一/周日独立选择 | ✅ | ✅ 已实现 |
| 平台选择 | ✅ 多选 | ✅ | ✅ 已实现 |
| 榜单人数 | ✅ TOP 5/10/20 | ✅ | ✅ 已实现 |
| 周报生成 | ✅ | ✅ | ✅ 已实现 |
| 复制报告 | ✅ | ✅ | ✅ 已实现 |
| 导出Word | ✅ | ✅ | ✅ 已实现 |
| 导出Excel | ✅ | ✅ | ✅ 已实现 |
| **海报导出** | ✅ 完整实现 | ❌ TODO占位符 | **缺失** |

**海报导出功能缺失详情**:

旧前端实现位置: `frontend/js/reports/EmployeeConversionWeekly.js:467-621`

```javascript
// 旧前端海报导出核心逻辑
handleExportPoster(platform) {
    // 1. 创建新窗口预览
    const previewWindow = window.open('', '_blank');

    // 2. 生成HTML模板
    const posterHTML = this.generatePosterHTML(platform);

    // 3. 写入预览窗口
    previewWindow.document.write(posterHTML);

    // 4. 使用html2canvas生成图片
    previewWindow.html2canvas(previewWindow.document.body).then(canvas => {
        // 5. 下载PNG图片
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `员工转化周报_${platform}_${this.dateRange[0]}.png`;
        link.click();
    });
}

// HTML模板系统
generatePosterHTML(platform) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                /* 海报样式定义 */
                .poster-container { /* ... */ }
                .poster-header { /* ... */ }
                .poster-ranking { /* ... */ }
            </style>
        </head>
        <body>
            <!-- 海报结构 -->
            <div class="poster-container">
                <div class="poster-header">...</div>
                <div class="poster-ranking">...</div>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
        </body>
        </html>
    `;
}
```

新前端当前状态: `PosterExportButtons.tsx:22-34`

```typescript
const handleExportPoster = async (platform: string) => {
    setExportingPlatform(platform);
    try {
        // TODO: 实现海报导出逻辑
        // 这里可以使用 html2canvas 或其他库生成海报
        message.info(`${platform}平台海报导出功能开发中...`);
    } catch (error) {
        console.error('导出海报失败:', error);
        message.error('导出海报失败，请重试');
    } finally {
        setExportingPlatform(null);
    }
};
```

**迁移建议**:
1. 安装 html2canvas 依赖: `npm install html2canvas`
2. 创建海报模板组件
3. 实现新窗口预览机制
4. 实现图片生成和下载逻辑

---

### 2.3 EmployeeConversion/Analysis (员工转化分析)

**新前端文件**: `frontend-react/src/pages/EmployeeConversion/Analysis.tsx` (549行)

**功能对比**:

| 功能项 | 旧前端 | 新前端 | 状态 |
|-------|--------|--------|------|
| 日期范围筛选 | ✅ | ✅ | ✅ 已实现 |
| 平台筛选 | ✅ 多选 | ✅ 多选 | ✅ 已实现 |
| 员工筛选 | ✅ 多选 | ✅ 多选 | ✅ 已实现 |
| 线索类型筛选 | ✅ | ✅ | ✅ 已实现 |
| 核心指标卡片 | ✅ 4个 | ✅ 4个 | ✅ 已实现 |
| 转化趋势图 | ✅ 4指标柱状图 | ⚠️ 2指标 | 部分缺失 |
| 员工转化率走势 | ✅ 多员工系列 | ⚠️ 单系列 | 部分缺失 |
| 排行榜表格 | ✅ | ✅ | ✅ 已实现 |
| 导出CSV | ✅ | ✅ | ✅ 已实现 |

**图表功能差距详情**:

**旧前端转化趋势图 (4个指标)**:
- 加微数 (lead_users)
- 开口客户数 (customer_mouth_users)
- 有效线索数 (valid_lead_users)
- 开户数 (opened_account_users)

**新前端转化趋势图 (2个指标)**:
- 加微数 (lead_users)
- 开户数 (opened_account_users)

**缺失指标**: 开口客户数、有效线索数

**旧前端员工转化率走势**:
```javascript
// 支持多条曲线，按 employee_name 区分
series: data.map(item => ({
    date: item.week,
    value: item.opening_rate,
    category: item.employee_name  // 每个员工一条曲线
}))
```

**新前端当前状态**: 仅支持单一数据系列，未按员工分组

---

### 2.4 Dashboard (数据概览)

**新前端文件**: `frontend-react/src/pages/Dashboard/index.tsx` (439行)

**功能对比**:

| 功能项 | 旧前端 | 新前端 | 状态 |
|-------|--------|--------|------|
| 平台筛选 | ✅ 多选 | ✅ 多选 | ✅ 已实现 |
| 代理商筛选 | ✅ 多选 | ✅ 多选 | ✅ 已实现 |
| 业务模式筛选 | ✅ 多选 | ✅ 多选 | ✅ 已实现 |
| 日期筛选 | ✅ 快速按钮 | ✅ RangePicker | ✅ 已实现 |
| 指标卡片 | ✅ 12个 | ✅ 12个 | ✅ 已实现 |
| 环比变化 | ✅ | ✅ | ✅ 已实现 |
| 趋势图 | ✅ ECharts | ✅ @ant-design/charts | ✅ 已实现 |
| 指标切换 | ✅ | ✅ | ✅ 已实现 |
| 粒度切换 | ✅ daily/weekly/monthly | ✅ | ✅ 已实现 |
| 数据新鲜度指示器 | ✅ | ⚠️ 需确认 | 待验证 |

**业务层级分组**:
- ✅ 前端投放: 投入金额、展示数、点击数、线索数
- ✅ 后端转化: 新开客户、有效户、客户资产、贡献、存量资产
- ✅ 运营效率: 单线索成本、单开户成本、单有效户成本

**迁移完成度**: 95% (基本功能已完成)

---

## 三、完全缺失的页面

### 3.1 CostAnalysisReport (成本分析)

**旧前端文件**: `frontend/js/reports/CostAnalysisReport.js`

**功能说明**: 各代理商成本分析报表

**迁移优先级**: 中等

**建议**:
1. 创建 `frontend-react/src/pages/CostAnalysis/index.tsx`
2. 复用 Dashboard 和 AgencyAnalysis 的组件模式

---

### 3.2 ExternalDataAnalysisReport (外部数据分析)

**旧前端文件**: `frontend/js/reports/ExternalDataAnalysisReport.js`

**功能说明**: 外部数据源分析报表

**迁移优先级**: 低 (可能为可选功能)

**建议**:
1. 评估该功能的使用频率
2. 如需迁移，创建 `frontend-react/src/pages/ExternalDataAnalysis/index.tsx`

---

## 四、技术栈差异对比

### 4.1 架构对比

| 维度 | 旧前端 | 新前端 |
|-----|--------|--------|
| 框架 | 原生 JavaScript | React 19 + TypeScript |
| 组件模式 | 类组件 (ES6 Class) | 函数式组件 + Hooks |
| 状态管理 | 实例属性 | useState/useCallback |
| UI库 | 自定义组件 + CSS | Ant Design 6.3.2 |
| 图表库 | ECharts 5.x | @ant-design/charts 2.6.7 |
| 样式 | CSS Modules/变量 | SCSS Modules |
| 类型 | 无 | TypeScript |

### 4.2 组件复用建议

| 旧组件 | 新组件 | 复用方式 |
|-------|--------|---------|
| MultiSelectForm | Select mode="multiple" | 使用 Ant Design |
| FilterBar | FilterBar 组件 | 已封装复用 |
| ChartCard | ChartCard 组件 | 已封装复用 |
| DataFreshnessIndicator | DataFreshness 组件 | 已迁移 |

---

## 五、迁移优先级建议

### 高优先级 (P0)
1. **EmployeeConversion/Weekly 海报导出功能** - 功能完全缺失
2. **XhsNotes/List 账号筛选器** - 基础筛选功能缺失

### 中优先级 (P1)
1. **EmployeeConversion/Analysis 图表指标补全** - 图表功能不完整
2. **CostAnalysis 页面迁移** - 完整页面缺失

### 低优先级 (P2)
1. **XhsNotes/List 行内编辑功能** - 可选增强功能
2. **ExternalDataAnalysis 页面评估** - 需确认使用频率

---

## 六、迁移行动项

### 阶段一: 功能补全 (预计 2-3 天)

- [ ] 实现 EmployeeConversion/Weekly 海报导出功能
  - [ ] 安装 html2canvas 依赖
  - [ ] 创建海报模板组件
  - [ ] 实现预览和导出逻辑

- [ ] 补充 XhsNotes/List 账号筛选器
  - [ ] 添加账号下拉组件
  - [ ] 集成筛选逻辑

### 阶段二: 图表优化 (预计 1-2 天)

- [ ] 补全 EmployeeConversion/Analysis 图表指标
  - [ ] 添加开口客户数、有效线索数指标
  - [ ] 实现多员工系列曲线

### 阶段三: 缺失页面迁移 (预计 3-5 天)

- [ ] 迁移 CostAnalysis 页面
- [ ] 评估 ExternalDataAnalysis 需求

---

## 七、验收标准

### 功能验收
- [ ] 所有筛选器功能正常
- [ ] 图表数据正确渲染
- [ ] 导出功能完整可用
- [ ] 分页加载正常

### 性能验收
- [ ] 页面加载时间 < 2s
- [ ] 图表渲染时间 < 500ms
- [ ] 筛选响应时间 < 300ms

### UI验收
- [ ] 遵循 Ant Design 设计规范
- [ ] 响应式布局正常
- [ ] 深色模式支持 (如需要)

---

**报告生成**: Claude AI
**最后更新**: 2026-03-13