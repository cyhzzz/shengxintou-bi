# 省心投 BI 前端 UI 优化规划 PRD

> 版本：v1.0 | 日期：2026-07-09 | 状态：待审阅

---

## 一、背景与目标

### 1.1 现状

省心投 BI 前端经过 v2 库表重构、v3.1 报表重梳，功能层面已基本完善。但 UI 层面积累了大量技术债：

- 设计 token 体系断裂（`variables.scss` 定义了变量但无模块引用，全靠硬编码）
- 样式大量复制粘贴（`.cardHeader` 等模式在 6+ 文件中重复）
- 文本溢出、颜色不一致、阴影不统一等视觉 bug
- 24 处 `!important`、14 处 `:global()` 覆盖 Ant Design 内部类
- 不支持日/夜模式切换

### 1.2 目标

1. **建立统一的设计 token 体系**，所有颜色/间距/圆角/阴影/字体通过 CSS 自定义属性管理
2. **修复所有已知的视觉 bug**（文本溢出、颜色冲突、阴影不一致等）
3. **消除样式复制粘贴**，通过共享 mixin 和 class 统一卡片/筛选栏/表格等组件样式
4. **支持日/夜模式切换**，为后续实现暗色主题奠定基础
5. **对齐 TRAE Work 设计规范**的间距/圆角/阴影/字体层级体系（品牌色保留蓝色）

### 1.3 不做什么

- **不更换品牌色**：保留 `#1890ff` 蓝色作为主品牌色
- **不替换 Ant Design 组件**：继续使用 Ant Design 5，通过 ConfigProvider 定制
- **不改动 PosterModal 海报设计系统**：该子系统自包含且独立，不在本次优化范围
- **不做响应式全面改造**：仅修复明显的布局溢出问题，不做移动端适配
- **不重构业务逻辑**：纯 UI 层面优化，不涉及数据流和 API 调用

---

## 二、问题全景

### 2.1 结构性问题（P0）

| 编号 | 问题 | 影响 | 涉及文件 |
|------|------|------|----------|
| S-01 | `variables.scss` 设计变量未被任何 module.scss 引用 | token 体系名存实亡，所有模块硬编码颜色 | 全部 31 个 module.scss |
| S-02 | ConfigProvider `siderBg: #f5f7fa` 被 MainLayout `background: #fff !important` 覆盖 | 主题配置形同虚设 | `MainLayout.module.scss` |
| S-03 | Menu 选中色 `#165dff`（飞书蓝）与品牌主色 `#1890ff` 不一致 | 侧边栏与页面主色调割裂 | `App.tsx` |
| S-04 | `.cardHeader` / `.cardTitle` / `.cardDesc` 在 6 个文件中完全重复 | 修改一处需改 6 处，维护成本高 | Dashboard / ConversionFunnel / Analysis / AgencyAnalysis / DataImport / ReportGeneration |

### 2.2 视觉一致性问题（P1）

| 编号 | 问题 | 现状 | 期望 |
|------|------|------|------|
| V-01 | 阴影 alpha 值 4 种混用 | 0.06 / 0.08 / 0.10 / 0.15 | 统一为 1 种 |
| V-02 | 边框颜色 4 种混用 | `#eee` / `#f0f0f0` / `#e8e8e8` / `#d9d9d9` | 统一为 1 种 |
| V-03 | 字体大小出现非标准尺寸 | 13px / 15px 散落在 ConversionFunnel | 仅使用 12 / 14 / 16 / 18 / 20 / 24px |
| V-04 | 卡片标题与描述文字同层级 | 标题 12px = 描述 12px | 标题 14px 600 + 描述 12px 400 |
| V-05 | `text-transform: uppercase` 对中文无效 | 所有 `.cardTitle` 都有此属性 | 移除 |
| V-06 | ReportGeneration 混入 Element UI 色值 | `#303133` / `#909399` / `#c0c4cc` | 替换为项目色值 |
| V-07 | Statistic 组件跨页面不一致 | Dashboard 14px/24px vs AgencyAnalysis 13px/20px | 统一为 14px/24px |
| V-08 | 卡片间距 12/16/20px 不统一 | 各页面随意取值 | 统一为 16px |

### 2.3 功能性问题（P1）

| 编号 | 问题 | 影响 | 位置 |
|------|------|------|------|
| F-01 | MetricCard 标题和数值缺少文本溢出处理 | 长文本撑开卡片 | `MetricCard.tsx` / `MetricCard.module.scss` |
| F-02 | 线索明细表部分列缺少 `ellipsis: true` | 长文本溢出列宽 | `LeadsDetail/index.tsx` |
| F-03 | 图表高度硬编码 4 种（300/350/360/500px） | 不同页面图表高度不一 | Dashboard / ConversionFunnel / Analysis / AgencyAnalysis |
| F-04 | `ReportGeneration` 使用 `calc(100vh - 140px)` 魔数 | 布局依赖固定像素 | `ReportGeneration/index.module.scss` |
| F-05 | `metricsRow` grid 4 列无响应式处理 | 窄屏下内容挤压 | `Analysis.module.scss` |

### 2.4 代码质量问题（P2）

| 编号 | 问题 | 数量 | 处理方式 |
|------|------|------|----------|
| C-01 | `!important` 滥用 | 24 处 | 通过正确选择器或 ConfigProvider token 替代 |
| C-02 | `:global()` 覆盖 Ant Design 内部类 | 14 处 | 通过 ConfigProvider 组件 token 或 `styles` prop 替代 |
| C-03 | 内联 `style={{}}` | 204 处 | 逐步迁移到 SCSS class（优先处理非动态样式） |
| C-04 | ConversionFunnel 重复变量声明 | 2 处 | 删除重复 |
| C-05 | `global.scss` 中存在旧版前端遗留的全局类 | 约 10 个 | 确认无引用后删除 |

---

## 三、设计方案

### 3.1 技术方案：CSS 自定义属性 + ConfigProvider 双轨

#### 核心思路

建立 `:root` 层的 CSS 自定义属性作为"单一事实来源"（Single Source of Truth），同时 ConfigProvider 从同一套值读取，消除双份维护。

#### 文件结构（新增/修改）

```
frontend-react/src/styles/
├── tokens.css              # [新增] CSS 自定义属性定义（日间 + 夜间变量）
├── variables.scss          # [重构] 删除旧变量，改为 @forward tokens.css 的 SCSS 映射（仅保留 SCSS 语法需要的部分，如断点）
├── mixins.scss             # [新增] 共享 SCSS mixin（cardHeader / filterGroup / textEllipsis 等）
├── global.scss             # [重构] 移除旧全局类，引入 tokens.css
└── index.css               # [保持] 入口 reset
```

#### tokens.css 结构设计

```css
/* ===== 日间模式 ===== */
:root {
  /* 品牌色（保留蓝色） */
  --color-brand: #1890ff;
  --color-brand-hover: #40a9ff;
  --color-brand-active: #096dd9;
  --color-brand-bg: rgba(24, 144, 255, 0.08);
  --color-brand-border: rgba(24, 144, 255, 0.3);

  /* 文字色（对齐 TRAE Work 语义） */
  --color-text-primary: #171717;      /* 主文字 */
  --color-text-secondary: #525252;    /* 次级文字 */
  --color-text-tertiary: #737373;     /* 三级/占位符 */
  --color-text-disabled: #A1A1A1;     /* 禁用 */
  --color-text-brand: #1890ff;        /* 品牌色文字 */

  /* 背景色 */
  --bg-page: #F5F5F5;                 /* 页面底色 */
  --bg-content: #FFFFFF;              /* 内容区/卡片 */
  --bg-secondary: #F5F5F5;            /* 次级面板/侧边栏 */
  --bg-hover: rgba(115, 115, 115, 0.06);  /* 悬停覆盖 */
  --bg-selected: rgba(24, 144, 255, 0.08); /* 选中覆盖 */

  /* 边框色（统一为 1 种） */
  --border-default: rgba(115, 115, 115, 0.12);
  --border-strong: rgba(115, 115, 115, 0.24);
  --border-focus: #000000;            /* 聚焦边框（对齐 TRAE Work） */

  /* 间距系统（对齐 TRAE Work spacer scale） */
  --spacer-2: 2px;
  --spacer-4: 4px;
  --spacer-6: 6px;
  --spacer-8: 8px;
  --spacer-12: 12px;
  --spacer-16: 16px;
  --spacer-20: 20px;
  --spacer-24: 24px;
  --spacer-32: 32px;
  --spacer-48: 48px;

  /* 圆角系统（对齐 TRAE Work） */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;                   /* 默认容器/按钮 */
  --radius-xl: 12px;                  /* 卡片/弹窗 */

  /* 阴影系统（统一为 1 种） */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
  --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.14), 0 4px 16px rgba(0, 0, 0, 0.08);

  /* 字体系统（对齐 TRAE Work） */
  --font-family: "SF Pro Text", "PingFang SC", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-family-metric: "Inter", "SF Pro Text", "PingFang SC", system-ui, sans-serif;
  --font-family-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* 字号层级 */
  --text-xs: 10px;
  --text-sm: 12px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 18px;
  --text-2xl: 20px;
  --text-3xl: 24px;

  /* 行高 */
  --leading-sm: 16px;
  --leading-base: 20px;
  --leading-lg: 28px;

  /* 字重 */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* 功能色 */
  --color-success: #15A877;
  --color-warning: #E27900;
  --color-error: #E8463A;
  --color-info: #2F74FF;

  /* 图表色板（对齐 TRAE Work viz-series） */
  --chart-color-1: #1890ff;
  --chart-color-2: #52c41a;
  --chart-color-3: #faad14;
  --chart-color-4: #f5222d;
  --chart-color-5: #722ed1;
  --chart-color-6: #13c2c2;
  --chart-color-7: #fa8c16;
  --chart-color-8: #eb2f96;

  /* 布局尺寸 */
  --sidebar-width: 200px;
  --header-height: 48px;
}

/* ===== 夜间模式 ===== */
[data-theme="dark"] {
  --color-text-primary: #F5F5F5;
  --color-text-secondary: #A1A1A1;
  --color-text-tertiary: #737373;
  --color-text-disabled: #525252;
  --color-text-brand: #6A9FFF;

  --bg-page: #0A0A0A;
  --bg-content: #171717;
  --bg-secondary: #0A0A0A;
  --bg-hover: rgba(255, 255, 255, 0.06);
  --bg-selected: rgba(24, 144, 255, 0.15);

  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.24);
  --border-focus: #F5F5F5;

  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2);
  --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3);

  --color-brand-bg: rgba(24, 144, 255, 0.15);
  --color-brand-border: rgba(24, 144, 255, 0.4);

  --color-success: #2FB287;
  --color-warning: #F39A35;
  --color-error: #EA574C;
  --color-info: #4C88FF;
}
```

> **注**：夜间模式色值在实施阶段会进一步调优，此处给出的是基础框架。Ant Design 5 的 `theme.darkAlgorithm` 可处理组件级暗色适配，自定义样式的暗色通过 `[data-theme="dark"]` 选择器覆盖。

#### mixins.scss 结构设计

```scss
// ===== 卡片区块标题 =====
// 替代 6 个文件中重复的 .cardHeader / .cardTitle / .cardDesc
@mixin card-section-header {
  display: flex;
  align-items: baseline;
  gap: var(--spacer-12);
  margin-bottom: var(--spacer-12);
  padding-bottom: var(--spacer-8);
  border-bottom: 1px solid var(--border-default);
}

@mixin card-section-title {
  font-size: var(--text-base);       // 14px（从 12px 提升，区分层级）
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0;                 // 移除 text-transform: uppercase
  text-transform: none;
}

@mixin card-section-desc {
  font-size: var(--text-sm);         // 12px
  color: var(--color-text-tertiary);
}

// ===== 筛选栏 =====
// 替代重复的 .filterGroup / .filterLabel / .filterActions
@mixin filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-16);
  align-items: center;
}

@mixin filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacer-8);
}

@mixin filter-label {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

// ===== 文本截断 =====
@mixin text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@mixin text-ellipsis-multi($lines: 2) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: $lines;
  overflow: hidden;
}

// ===== 卡片基础 =====
@mixin card-base {
  background: var(--bg-content);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
}

// ===== 表格标题 =====
@mixin table-section-title {
  font-size: var(--text-lg);         // 16px
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacer-16);
}
```

### 3.2 日/夜模式切换机制

#### 实现方式

1. 在 `:root` 定义日间变量，在 `[data-theme="dark"]` 定义夜间变量（见 3.1 tokens.css）
2. 在 `<html>` 或 `<body>` 元素上添加/移除 `data-theme="dark"` 属性
3. 通过 zustand store (`useAppStore`) 管理主题状态，持久化到 `localStorage`
4. Ant Design 5 通过 ConfigProvider 的 `theme.algorithm` 切换 `defaultAlgorithm` / `darkAlgorithm`
5. 所有自定义样式通过 `var(--xxx)` 自动跟随切换

#### 切换入口

在 MainLayout 的顶部 Header 区域添加主题切换按钮（使用 Ant Design 的 `Switch` 或图标按钮），存储用户偏好。

### 3.3 ConfigProvider token 对齐

#### 修复的问题

| 当前问题 | 修复方式 |
|----------|----------|
| `siderBg: #f5f7fa` 被 `!important` 覆盖 | 删除 `!important`，让 ConfigProvider token 生效 |
| Menu 选中色 `#165dff` 与品牌色不一致 | 统一为 `#1890ff` |
| `Card.boxShadow` 与实际使用不一致 | 统一 token，SCSS 也引用 `var(--shadow-card)` |
| `Table.headerBg: #f5f7fa` 与 AgencyAnalysis 覆盖的 `#fafafa` 冲突 | 统一为 `var(--bg-secondary)` |

#### ConfigProvider 重写后的核心 token

```typescript
const themeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorBgContainer: '#FFFFFF',           // var(--bg-content)
    colorBgLayout: '#F5F5F5',              // var(--bg-page)
    colorBorder: 'rgba(115, 115, 115, 0.12)', // var(--border-default)
    colorBorderSecondary: 'rgba(115, 115, 115, 0.24)',
    colorText: '#171717',                  // var(--color-text-primary)
    colorTextSecondary: '#525252',         // var(--color-text-secondary)
    colorTextTertiary: '#737373',          // var(--color-text-tertiary)
    colorTextDisabled: '#A1A1A1',          // var(--color-text-disabled)
    borderRadiusLG: 12,                    // var(--radius-xl)
    borderRadius: 8,                       // var(--radius-lg)
    fontSize: 14,                          // var(--text-base)
    fontFamily: '"SF Pro Text", "PingFang SC", system-ui, sans-serif',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  },
  components: {
    Layout: {
      siderBg: '#F5F5F5',                 // var(--bg-secondary)
      headerBg: '#FFFFFF',                // var(--bg-content)
      bodyBg: '#F5F5F5',                  // var(--bg-page)
    },
    Menu: {
      itemSelectedColor: '#1890ff',        // 与品牌色统一
      itemHoverColor: '#1890ff',
      itemSelectedBg: 'rgba(24, 144, 255, 0.08)',
    },
    Card: {
      borderRadiusLG: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    },
    Table: {
      headerBg: '#F5F5F5',                 // var(--bg-secondary)
      headerColor: '#525252',              // var(--color-text-secondary)
      borderColor: 'rgba(115, 115, 115, 0.12)',
    },
  },
};
```

### 3.4 组件样式统一规范

#### 卡片（Card）

| 属性 | 当前值 | 目标值 | 对齐来源 |
|------|--------|--------|----------|
| 背景 | `#fff` | `var(--bg-content)` | tokens.css |
| 圆角 | `8px` | `var(--radius-xl)` = 12px | TRAE Work 卡片圆角 |
| 阴影 | `rgba(0,0,0,0.06/0.08/0.10/0.15)` | `var(--shadow-card)` | 统一为 1 种 |
| 边框 | 无 / `#f0f0f0` | `1px solid var(--border-default)` | TRAE Work 用边框而非阴影表达层级 |
| 内边距 | `12px 16px` / `16px` / `16px 20px` | `var(--spacer-20)` = 20px | 统一内边距 |

#### 筛选栏（FilterBar）

| 属性 | 当前值 | 目标值 |
|------|--------|--------|
| 容器间距 | `gap: 16px` | `var(--spacer-16)` |
| 标签字号 | `14px #666` | `var(--text-base) var(--color-text-secondary)` |
| 卡片内边距 | `12px 16px` | `var(--spacer-12) var(--spacer-16)` |

#### 指标卡片（MetricCard）

| 属性 | 当前值 | 目标值 |
|------|--------|--------|
| 标题溢出 | 无处理 | `@include text-ellipsis; max-width: 100%` |
| 数值溢出 | 无处理 | `@include text-ellipsis; max-width: 100%` |
| 标题字号 | `14px #333` | `var(--text-base) var(--color-text-primary)` |
| 数值字号 | `24px` | `var(--text-3xl) var(--color-text-primary)` + `var(--font-family-metric)` |
| 环比字号 | `12px` | `var(--text-sm) var(--color-text-tertiary)` |
| 阴影 | `rgba(0,0,0,0.1)` | `var(--shadow-card)` |

#### 表格（Table）

| 属性 | 当前值 | 目标值 |
|------|--------|--------|
| 表头背景 | `#f5f7fa` / `#fafafa` 混用 | `var(--bg-secondary)` |
| 表头文字 | `#666` / `#8A8D99` | `var(--color-text-secondary)` |
| 代理商列 | 无 ellipsis | 添加 `ellipsis: true` |
| 资本账号列 | 无 ellipsis | 添加 `ellipsis: true` |

#### 图表（Chart）

| 属性 | 当前值 | 目标值 |
|------|--------|--------|
| 高度 | 300/350/360/500px 硬编码 | 统一为 `height: 100%`，由父容器控制 |
| 容器 | 无固定最小高度 | 父容器 `min-height: 300px` |

#### 文字层级体系

对齐 TRAE Work 的字体层级，建立清晰的视觉层次：

| 层级 | 字号 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| 页面标题 | 20px | 600 | 28px | 页面顶部 H1（当前缺失） |
| 区块标题 | 16px | 600 | 24px | 图表/表格卡片的标题 |
| 卡片标签标题 | 14px | 600 | 20px | MetricCard 标题、筛选分组标题 |
| 正文 | 14px | 400 | 20px | 默认文字 |
| 辅助说明 | 12px | 400 | 16px | 卡片描述、脚注、环比变化 |
| 指标数值 | 24px | 600 | 32px | MetricCard 数值（使用 metric 字体） |
| 表头文字 | 12px | 500 | 16px | 表格表头 |

---

## 四、实施分阶段规划

### Phase 0：基础设施（预计 0.5 天）

| 任务 | 说明 |
|------|------|
| 创建 `tokens.css` | 定义日间 + 夜间全套 CSS 自定义属性 |
| 创建 `mixins.scss` | 提取共享 mixin（cardHeader / filterBar / textEllipsis / cardBase / tableTitle） |
| 重构 `variables.scss` | 删除旧变量，仅保留 SCSS 专用的断点变量，`@use` 引入 tokens.css |
| 重构 `global.scss` | 引入 `tokens.css`，删除旧全局遗留类（`.app-layout` / `.sidebar` 等已由 MainLayout.module.scss 接管） |
| 重写 `ConfigProvider` token | 对齐 3.3 中的 token 值，修复 siderBg / Menu 选中色冲突 |

### Phase 1：修复 P0 问题（预计 1 天）

| 任务 | 涉及文件 | 说明 |
|------|----------|------|
| 删除 MainLayout 的 `!important` | `MainLayout.module.scss` | 7 处 `!important`，让 ConfigProvider token 生效 |
| 删除所有 `.cardTitle` 的 `!important` | 6 个页面 module.scss | 6 处，改为通过 ConfigProvider Typography token 控制颜色 |
| 修复 Menu 选中色 | `App.tsx` | `#165dff` -> `#1890ff` |
| 删除 ConversionFunnel 重复变量声明 | `ConversionFunnel/index.tsx` | 第 99-101 行 |

### Phase 2：统一组件样式（预计 2 天）

按组件类型逐个迁移，每个组件：删除旧硬编码 -> 引用 `var(--xxx)` 和 `@include mixin` -> 修复溢出。

| 顺序 | 组件 | 涉及文件数 | 核心改动 |
|------|------|-----------|----------|
| 2.1 | 共享组件 | 3 | FilterBar / ChartCard / DataFreshness -- 替换硬编码色值为 `var()`，应用 `@include card-section-header` |
| 2.2 | MainLayout | 1 | 侧边栏 / 顶部栏样式对齐 token，删除 `:global` 覆盖 |
| 2.3 | MetricCard | 2 | 添加文本溢出处理，数值使用 metric 字体 |
| 2.4 | Dashboard | 2 | 应用 mixin，统一间距，移除 `:global` 覆盖 Statistic |
| 2.5 | ConversionFunnel | 1 | 移除 13/15px 非标准字号，统一图表高度，移除 uppercase |
| 2.6 | EmployeeConversion | 3 | Analysis / Weekly / 子组件 -- 统一 Statistic 样式，修复 grid 响应式 |
| 2.7 | AgencyAnalysis | 1 | 移除全面 Statistic `:global` 覆盖，使用 ConfigProvider 定制，添加列 ellipsis |
| 2.8 | LeadsDetail | 1 | 添加列 ellipsis，应用 mixin |
| 2.9 | XhsNotes | 2 | List / Operation -- 清理内联 style（Operation 73 处） |
| 2.10 | AppMarket 4 子页 | 4 | Funnel / Comparison / Detail / Creative |
| 2.11 | System 页面 | 5 | DataImport / AccountManagement / AbbreviationManagement / DatabaseBackup / 子组件 |
| 2.12 | ReportGeneration | 1 | 替换 Element UI 色值，修复魔数布局 |
| 2.13 | Live / AnchorCluster | 2 | Funnel 占位页 / 聚类页 |

### Phase 3：日/夜模式实现（预计 1 天）

| 任务 | 说明 |
|------|------|
| zustand store 添加 `theme` 状态 | `useAppStore` 中添加 `theme: 'light' | 'dark'`，持久化到 localStorage |
| Header 添加切换按钮 | 在面包屑右侧放置日/夜切换图标按钮 |
| ConfigProvider 动态切换 algorithm | 根据 store 中的 theme 切换 `defaultAlgorithm` / `darkAlgorithm` |
| `<html>` 添加 `data-theme` 属性 | 在 App.tsx 或 MainLayout 中根据 store 值设置 |
| 夜间模式色值调优 | 在真实页面上检查暗色效果，微调 tokens.css 中 `[data-theme="dark"]` 的值 |

### Phase 4：收尾与验证（预计 0.5 天）

| 任务 | 说明 |
|------|------|
| 全局搜索残留硬编码色值 | `grep -r '#1890ff\|#333\|#666\|#999\|#f0f0f0' frontend-react/src/` 确认无遗漏 |
| 验证所有页面 | 逐页面检查日间/夜间模式下的视觉效果 |
| 性能检查 | 确认 CSS 自定义属性没有引入不必要的重绘 |
| 清理 `global.scss` 旧类 | 确认 `.app-layout` / `.sidebar` 等无引用后删除 |

---

## 五、不涉及的页面/组件

| 排除项 | 原因 |
|--------|------|
| `PosterModal.module.scss`（1084 行） | 独立的海报设计子系统，有自己的颜色/动画体系，不在本次优化范围 |
| `WeeklyReportPreview.module.scss` | 海报预览组件，同上 |
| `PosterExportButtons.module.scss` | 海报导出按钮，同上 |
| ECharts 图表内部配色 | ECharts 通过 JS option 配色，不在 CSS token 体系内。后续可单独建立图表色板常量文件 |
| Playwright E2E 测试 | 测试脚本中如有颜色/样式断言需同步更新，但不作为本次 PRD 的范围 |

---

## 六、验收标准

1. **零硬编码**：`frontend-react/src/` 下的 `.scss` 文件中不出现 `#1890ff` / `#333` / `#666` / `#999` / `#f0f0f0` / `#eee` 等硬编码色值（图表 JS option 除外）
2. **零 !important**：`.module.scss` 文件中不出现 `!important`
3. **零 :global() Ant Design 覆盖**：不通过 `:global { .ant-xxx { ... } }` 覆盖 Ant Design 组件内部样式
4. **文本零溢出**：所有表格列和卡片标题在正常数据长度下不溢出容器
5. **样式零重复**：`.cardHeader` / `.cardTitle` / `.cardDesc` / `.filterGroup` 等模式通过 mixin 引用，不在多个文件中重复定义
6. **日/夜可切换**：点击切换按钮后，所有页面和组件（包括 Ant Design 组件和自定义样式）正确切换主题
7. **品牌色统一**：侧边栏选中色、链接色、按钮色均为 `#1890ff`，无 `#165dff` 或其他蓝色混入
8. **阴影/边框/间距统一**：所有卡片使用相同的阴影、边框和内边距 token

---

## 七、风险与注意事项

1. **Ant Design 组件 class 名变更**：Ant Design 5 使用 CSS-in-JS，class 名带有 hash，`!important` 和 `:global()` 覆盖在版本升级时本身就脆弱。本次优化通过 ConfigProvider 和 `styles` prop 替代，反而提高了升级稳定性。
2. **CSS 自定义属性性能**：现代浏览器对 CSS 自定义属性有良好支持（IE 除外，本项目不需要考虑 IE）。变量变更仅触发使用该变量的元素重绘，不会导致全页重排。
3. **PosterModal 不动**：该组件 1084 行样式是独立的设计体系，强行对齐会破坏海报导出效果。如果后续需要优化，应单独立项。
4. **向后兼容**：CSS 自定义属性和 SCSS mixin 的引入是增量式的，可以逐文件迁移，不存在"大爆炸"切换风险。
5. **ConfigProvider token vs CSS var 的关系**：ConfigProvider 控制 Ant Design 组件的渲染输出，CSS var 控制自定义样式。两者需要使用相同的色值，但不自动同步。维护方式是在 `tokens.css` 中定义权威值，ConfigProvider 中引用这些值（通过 JS 常量文件或直接硬编码同一值）。