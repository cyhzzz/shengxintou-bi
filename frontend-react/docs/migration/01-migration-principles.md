# 迁移原则

## 核心目标

1. **功能对等**: 迁移后的功能必须与原有功能完全一致
2. **类型安全**: 充分利用 TypeScript 的类型系统
3. **组件复用**: 提取可复用组件，减少代码重复
4. **渐进迁移**: 保持系统可用，逐步完成迁移

---

## ⚠️ 迁移前必读：常见问题检查清单

> **经验教训**: 数据概览迁移中发现的问题，必须在后续迁移中避免。

### 1. API 参数完整性检查

**问题描述**: 迁移时容易遗漏 API 参数，导致功能缺失。

**典型案例**: 趋势数据 API 支持 `granularity` 参数（日/周/月），但 React 前端未传递该参数。

**检查清单**:

- [ ] 对比旧版前端 API 调用参数与新版是否一致
- [ ] 检查可选参数是否都有对应的状态和回调
- [ ] 确认 TypeScript 类型定义是否包含所有 API 参数
- [ ] 测试所有交互功能是否正常触发 API 调用

**修复方法**:

```typescript
// ❌ 错误：遗漏 granularity 参数
const response = await getDashboardTrendData({
  start_date: filters.start_date,
  end_date: filters.end_date,
  platforms: filters.platforms,
  metric_type: trendMetricType,
  // 缺少 granularity 参数！
});

// ✅ 正确：包含所有参数
const response = await getDashboardTrendData({
  start_date: filters.start_date,
  end_date: filters.end_date,
  platforms: filters.platforms,
  metric_type: trendMetricType,
  granularity: trendGranularity,  // 添加粒度参数
});
```

**验证步骤**:
1. 打开浏览器 Network 面板
2. 执行所有用户交互（切换粒度、筛选、指标）
3. 检查每个 API 请求的参数是否完整

---

### 2. 筛选器选项验证

**问题描述**: 筛选器选项可能与后端返回的元数据不一致。

**典型案例**: BusinessModelFilter 显示了"未归因"选项，但后端元数据返回的是"直播、信息流、搜索"。

**检查清单**:

- [ ] 筛选器选项来源：硬编码 vs API 元数据
- [ ] 对比旧版前端筛选器的完整选项列表
- [ ] 确认筛选器组件的 `options` prop 格式正确
- [ ] 测试筛选器的默认值和初始选中状态

**正确做法**:

```typescript
// ✅ 从 API 元数据获取筛选选项
const { data: metadata } = useMetadata();

// BusinessModelFilter 组件
<BusinessModelFilter
  options={metadata?.business_models || []}  // 从 API 获取
  value={businessModels}
  onChange={setBusinessModels}
/>

// ❌ 错误：硬编码选项
<BusinessModelFilter
  options={['直播', '信息流', '未归因']}  // 硬编码可能不正确
  value={businessModels}
  onChange={setBusinessModels}
/>
```

**验证步骤**:
1. 打开旧版前端，记录所有筛选器的选项
2. 打开新版前端，对比每个筛选器的选项
3. 确认筛选后的数据请求参数正确

---

### 3. 图表组件完整性验证

**问题描述**: 图表组件可能缺少标题、工具栏、切换按钮等交互元素。

**典型案例**: TrendChart 组件缺少左上角的"趋势分析"标题，以及日/周/月粒度切换。

**检查清单**:

- [ ] 图表标题是否显示
- [ ] 图表工具栏（刷新、导出、切换）是否完整
- [ ] 图表切换按钮（指标切换、粒度切换）是否功能正常
- [ ] 图表 loading 状态和空状态是否处理

**组件结构模板**:

```tsx
// TrendChart 完整结构示例
<div className={styles.chartCard}>
  {/* 左上角标题 */}
  <div className={styles.chartHeader}>
    <h3 className={styles.chartTitle}>{title || '趋势分析'}</h3>
  </div>

  {/* 右上角工具栏 */}
  <div className={styles.chartToolbar}>
    {/* 指标切换 */}
    <Segmented
      options={metricOptions}
      value={metricType}
      onChange={onMetricTypeChange}
    />
    {/* 粒度切换 */}
    {onGranularityChange && (
      <Segmented
        options={[
          { label: '日', value: 'daily' },
          { label: '周', value: 'weekly' },
          { label: '月', value: 'monthly' },
        ]}
        value={granularity}
        onChange={onGranularityChange}
      />
    )}
  </div>

  {/* 图表主体 */}
  <div ref={chartRef} className={styles.chartContainer} />
</div>
```

**验证步骤**:
1. 截图旧版前端的图表区域
2. 截图新版前端的图表区域
3. 对比两个截图，确认所有 UI 元素都存在

---

### 4. 布局一致性验证

**问题描述**: 卡片布局可能不一致，导致视觉差异。

**典型案例**:
- 后端转化区域 5 个卡片换行显示，应在一行
- 运营效率区域 3 个卡片未填满一行
- 客户资产卡片使用 `variant="asset"` 导致样式不一致

**检查清单**:

- [ ] 对比旧版前端的布局（卡片数量、行列关系）
- [ ] 确认卡片使用统一的样式变体
- [ ] 验证响应式布局（不同屏幕宽度）
- [ ] 检查卡片高度是否一致

**布局决策指南**:

| 卡片数量 | 推荐布局 | 示例 |
|---------|---------|------|
| 1 个 | `span={24}` | 单个核心指标 |
| 2 个 | 各 `span={12}` | 对比指标 |
| 3 个 | 各 `span={8}` | 效率指标组 |
| 4 个 | 各 `span={6}` | 投放指标组 |
| 5+ 个 | Flex 均分 | 转化指标组 |

```tsx
// ✅ 5 个卡片使用 Flex 布局
<div className={styles.metricsFlexRow}>
  {cards.map(card => (
    <MetricCard key={card.title} {...card} />
  ))}
</div>

// CSS
.metricsFlexRow {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;

  > * {
    flex: 1 1 calc(20% - 16px);  // 5 个卡片均分
    min-width: 180px;
  }
}
```

---

### 5. TypeScript 类型定义验证

**问题描述**: 自动生成的 API 类型可能不完整。

**典型案例**: `PostDashboardTrendDataBody` 类型缺少 `granularity` 字段。

**检查清单**:

- [ ] 对比后端 API 文档/代码与 TypeScript 类型定义
- [ ] 检查可选字段是否标记为可选（`?`）
- [ ] 确认枚举类型是否完整
- [ ] 验证类型扩展是否正确

**类型修复方法**:

```typescript
// types/api.schemas.ts

// ❌ 原始类型（缺少 granularity）
export type PostDashboardTrendDataBody = {
  start_date: string;
  end_date: string;
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
  metric_type?: PostDashboardTrendDataBodyMetricType;
  // 缺少 granularity！
};

// ✅ 修复后的类型
export type PostDashboardTrendDataBody = {
  start_date: string;
  end_date: string;
  platforms?: string[];
  agencies?: string[];
  business_models?: string[];
  metric_type?: PostDashboardTrendDataBodyMetricType;
  granularity?: 'daily' | 'weekly' | 'monthly';  // 添加粒度参数
};
```

---

## 迁移原则

### 1. 逐一迁移，保持功能对等

每个报表页面独立迁移，确保功能完整：

```
原生 JS 报表 → React 组件
├── 功能检查清单
│   ├── 数据加载
│   ├── 筛选器功能
│   ├── 图表渲染
│   ├── 表格展示
│   └── 导出功能
└── 验证测试
```

### 2. 组件优先级

按照以下优先级迁移组件：

1. **基础组件** - 按钮、输入框、选择器
2. **业务组件** - 筛选器、图表卡片、数据表格
3. **页面组件** - 各报表页面
4. **布局组件** - 侧边栏、顶部栏

### 3. 状态管理策略

使用 Zustand 进行状态管理：

```typescript
// stores/useFilterStore.ts
import { create } from 'zustand';

interface FilterState {
  platforms: string[];
  dateRange: [string, string];
  setPlatforms: (platforms: string[]) => void;
  setDateRange: (range: [string, string]) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  platforms: [],
  dateRange: ['', ''],
  setPlatforms: (platforms) => set({ platforms }),
  setDateRange: (dateRange) => set({ dateRange }),
  reset: () => set({ platforms: [], dateRange: ['', ''] }),
}));
```

### 4. 样式迁移规范

- 使用 SCSS 模块化样式
- 保持与原设计系统一致
- 支持 CSS 变量主题切换

```scss
// Dashboard.module.scss
.container {
  padding: 20px;
}

.metricsGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
```

### 5. API 调用封装

统一使用 HTTP 客户端：

```typescript
// services/dataService.ts
import { http } from './http';

export const dataService = {
  getDashboardCoreMetrics: (filters) =>
    http.post('/api/v1/dashboard/core-metrics', { filters }),

  getAgencyAnalysis: (filters) =>
    http.post('/api/v1/agency-analysis', { filters }),
};
```

---

## 迁移流程

### 阶段 1: 准备工作

1. ✅ 创建 React 项目结构
2. ✅ 配置 TypeScript
3. ✅ 配置 Ant Design 主题
4. ✅ 创建基础布局组件

### 阶段 2: 核心组件迁移

1. ✅ 侧边栏导航
2. ✅ 筛选器组件
3. ✅ 图表组件
4. ✅ 数据表格组件

### 阶段 3: 页面迁移

1. ✅ 数据概览
2. ✅ 厂商分析
3. ✅ 小红书报表
4. ✅ 线索明细
5. ✅ 转化漏斗
6. ✅ 员工转化报表
7. ✅ 系统配置页面

### 阶段 4: 功能完善

1. ⏳ API 类型自动生成
2. ⏳ 单元测试
3. ⏳ E2E 测试
4. ⏳ 性能优化

---

## 验证标准

### 功能验证

- [ ] 所有数据加载正常
- [ ] 筛选器功能正常
- [ ] 图表渲染正确
- [ ] 表格排序/分页正常
- [ ] 导出功能正常

### 性能验证

- [ ] 首屏加载 < 2s
- [ ] 页面切换 < 500ms
- [ ] 图表渲染 < 1s

### 类型安全验证

- [ ] 无 TypeScript 编译错误
- [ ] API 调用类型正确
- [ ] 状态管理类型完整

---

## 页面迁移检查清单模板

> 每个页面迁移完成后，必须完成以下检查。

### 页面名称: _______________

#### 1. API 参数检查

| API 端点 | 旧版参数 | 新版参数 | 状态 |
|---------|---------|---------|------|
| | | | ✅/❌ |
| | | | ✅/❌ |

#### 2. 筛选器检查

| 筛选器 | 旧版选项 | 新版选项 | 状态 |
|-------|---------|---------|------|
| | | | ✅/❌ |
| | | | ✅/❌ |

#### 3. 图表检查

| 图表 | 标题 | 工具栏 | 切换功能 | 状态 |
|-----|------|-------|---------|------|
| | | | | ✅/❌ |

#### 4. 布局检查

| 区域 | 卡片数量 | 布局方式 | 状态 |
|-----|---------|---------|------|
| | | | ✅/❌ |

#### 5. TypeScript 类型检查

- [ ] API 类型定义完整
- [ ] 无编译错误
- [ ] 类型推导正确

---

## 附录：数据概览迁移问题记录

### 问题 1: 趋势图粒度切换无效

**原因**: `granularity` 状态未传递给 API 调用。

**修复**:
1. 添加 `trendGranularity` 状态
2. 传递 `onGranularityChange` 回调给 TrendChart
3. 更新 API 调用，添加 `granularity` 参数

**文件**:
- `src/pages/Dashboard/index.tsx`
- `src/types/api.schemas.ts`

### 问题 2: 业务模式筛选器选项错误

**原因**: BusinessModelFilter 组件硬编码了选项，未从 API 元数据获取。

**修复**: 从 `useMetadata()` 获取 `business_models` 选项。

**文件**:
- `src/pages/Dashboard/index.tsx`

### 问题 3: 趋势图缺少标题

**原因**: TrendChart 组件未显示标题。

**修复**: 在图表卡片左上角添加标题显示。

**文件**:
- `src/pages/Dashboard/components/TrendChart.tsx`

### 问题 4: 卡片布局不一致

**原因**: 使用 Ant Design Grid 时，卡片宽度计算不合理。

**修复**:
- 5 个卡片改用 Flex 布局
- 3 个卡片使用 `lg={8}` 而非 `lg={6}`
- 移除 `variant="asset"` 统一卡片样式

**文件**:
- `src/pages/Dashboard/index.tsx`
- `src/pages/Dashboard/Dashboard.module.scss`

---

**最后更新**: 2026-03-13
**维护者**: Claude AI