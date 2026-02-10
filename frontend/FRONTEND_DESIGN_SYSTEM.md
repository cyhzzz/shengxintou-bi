# 省心投 BI - 前端设计系统规范

> 基于 XhsNotesListReport 线框卡片样式的统一设计系统
>
> 版本: v1.0.0
> 更新时间: 2026-01-16

---

## 📋 目录

1. [设计原则](#设计原则)
2. [页面布局结构](#页面布局结构)
3. [CSS 变量系统](#css-变量系统)
4. [按钮组件](#按钮组件)
5. [卡片组件](#卡片组件)
6. [状态修饰符](#状态修饰符)
7. [使用示例](#使用示例)
8. [迁移指南](#迁移指南)

---

## 设计原则

### 1. 一致性优先
- 所有交互元素使用统一的激活/禁用/悬停状态
- 统一的视觉层次和间距系统
- 统一的命名规范

### 2. 线框美学
- 基于 XhsNotesListReport 的设计风格
- 清晰的边框定义内容区域
- 适当的留白和间距

### 3. 渐进增强
- 保持向后兼容
- 遗留样式逐步迁移
- 新功能强制使用新系统

---

## 页面布局结构

### 整体布局层次

```
.app-container (全屏容器)
├── .sidebar (左侧导航栏, 200px 宽, 固定定位)
│   ├── .sidebar-header (Logo 区域, 48px 高)
│   └── .sidebar-nav (导航菜单)
│       └── .nav-list
│           ├── .nav-item (一级菜单项)
│           └── .submenu (二级菜单)
│
└── .main-container (主内容区, margin-left: 200px)
    ├── .topbar (顶部栏, 48px 高, 固定顶部)
    │   ├── .topbar-left (面包屑导航)
    │   └── .topbar-right (操作按钮)
    │
    └── .content-area (内容区域, 可滚动)
        ├── .filter-bar (筛选器区域)
        ├── .metrics-cards (指标卡片区域)
        └── #mainContent (主内容区)
            └── .card (线框卡片包裹的报表内容)
```

### 布局模块说明

#### 1. 左侧导航栏 (`.sidebar`)

**尺寸**: 200px 宽, 100vh 高
**定位**: fixed, left: 0, top: 0
**背景色**: `#FFFFFF`
**层级**: z-index: 1000

**结构**:
```html
<aside class="sidebar">
    <div class="sidebar-header">
        <div class="logo-container">
            <img src="icon/LOGO.svg" class="logo-image" alt="LOGO">
            <span class="logo-text">· 省心投</span>
        </div>
    </div>

    <nav class="sidebar-nav">
        <ul class="nav-list">
            <li class="nav-item active" data-report="dashboard">
                <img src="icon/主页.svg" class="nav-icon" alt="数据概览">
                <span>数据概览</span>
            </li>
        </ul>
    </nav>
</aside>
```

---

#### 2. 顶部栏 (`.topbar`)

**尺寸**: 48px 高, 宽度 auto (left: 200px, right: 0)
**定位**: fixed, top: 0, left: 200px
**背景色**: `#FFFFFF`
**层级**: z-index: 999

**结构**:
```html
<header class="topbar">
    <div class="topbar-left">
        <div class="breadcrumb-container">
            <span class="breadcrumb-brand">省心投</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-current" id="currentReport">数据概览</span>
        </div>
    </div>

    <div class="topbar-right">
        <button class="theme-toggle" id="themeToggle" title="切换主题">
            <i class="icon-moon"></i>
        </button>
        <button class="help-btn" title="帮助">
            <i class="icon-help"></i>
        </button>
    </div>
</header>
```

---

#### 3. 筛选器区域 (`.filter-bar`)

**位置**: `.content-area` 顶部
**最大宽度**: 1154px
**居中对齐**: margin: 0 auto
**内边距**: 16px
**最小高度**: 64px

**结构示例**:
```html
<section class="filter-bar">
    <div class="filter-group">
        <label class="filter-label">日期范围:</label>
        <div class="btn-group">
            <button class="btn is-active" data-days="7">近7天</button>
            <button class="btn" data-days="30">近30天</button>
        </div>
    </div>

    <div class="filter-actions">
        <button class="btn btn--secondary">重置</button>
        <button class="btn btn--primary">查询</button>
    </div>
</section>
```

**重要**: 筛选器按钮 MUST 使用统一的 `.btn` 系统

---

#### 4. 报表内容区域 (`#mainContent`)

**位置**: `.content-area` 内部
**最大宽度**: 1154px
**居中对齐**: margin: 0 auto

**结构示例**:
```html
<div id="mainContent">
    <div class="page-header">
        <h2>报表标题</h2>
        <p class="page-description">报表描述</p>
    </div>

    <!-- 筛选卡片 -->
    <div class="card card--filter">
        <div class="card__body">
            <!-- 筛选器内容 -->
        </div>
        <div class="card__footer">
            <button class="btn btn--secondary">重置</button>
            <button class="btn btn--primary">查询</button>
        </div>
    </div>

    <!-- 图表卡片 -->
    <div class="card card--chart">
        <div class="card__header">
            <h3 class="card__title">图表标题</h3>
        </div>
        <div class="card__body">
            <div id="chart" style="width: 100%; height: 300px;"></div>
        </div>
    </div>
</div>
```

**重要**: 所有报表内容 MUST 使用线框卡片 (`.card`) 包裹

---

### 布局尺寸速查表

| 元素                | 宽度    | 高度                 | 定位                      |
| ----------------- | ----- | ------------------ | ----------------------- |
| `.sidebar`        | 200px | 100vh              | fixed                   |
| `.sidebar-header` | 200px | 48px               | fixed                   |
| `.topbar`         | auto  | 48px               | fixed, left: 200px      |
| `.content-area`   | auto  | calc(100vh - 48px) | padding-top: 68px       |
| `.filter-bar`     | auto  | 最小 64px            | 居中                      |
| `.card`           | auto  | auto               | 居中, margin-bottom: 20px |

---

### 模块间距规范

| 位置 | 间距值 | 用途 |
|------|--------|------|
| `.content-area` padding-top | 68px (48px + 20px) | 为固定顶部栏留出空间 |
| `.card` margin-bottom | 20px (`var(--spacing-lg)`) | 卡片之间的垂直间距 |
| `.card` padding | 16px-20px | 卡片内部内边距 |
| `.btn-group` gap | 8px (`var(--spacing-sm)`) | 按钮之间的间距 |
| `.filter-group` gap | 16px (`var(--spacing)`) | 筛选器组之间的间距 |

---

## CSS 变量系统

### 颜色变量

```css
/* 主色调 */
--primary-color: #1890ff;      /* 主要品牌色 */
--primary-hover: #40a9ff;      /* 悬停状态 */
--primary-active: #096dd9;     /* 激活状态 */

/* 功能色 */
--success-color: #52c41a;      /* 成功 */
--warning-color: #faad14;      /* 警告 */
--error-color: #f5222d;        /* 错误 */
--info-color: #1890ff;         /* 信息 */

/* 文字颜色 */
--text-primary: #333333;       /* 主要文字 */
--text-secondary: #666666;     /* 次要文字 */
--text-tertiary: #999999;      /* 辅助文字 */
--text-disabled: #bfbfbf;      /* 禁用文字 */

/* 背景颜色 */
--bg-page: #f0f2f5;           /* 页面背景 */
--bg-sidebar: #f5f7fa;         /* 侧边栏背景 */
--bg-content: #ffffff;         /* 内容背景 */
--bg-hover: #f5f7fa;           /* 悬停背景 */
--bg-selected: #e6f7ff;        /* 选中背景 */

/* 边框颜色 */
--border-color: #eeeeee;      /* 默认边框 */
--border-color-light: #f0f2f5; /* 浅色边框 */
--border-color-dark: #d9d9d9;  /* 深色边框 */
```

### 间距变量

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing: 16px;
--spacing-lg: 20px;
--spacing-xl: 24px;
```

### 圆角变量

```css
--border-radius-sm: 2px;
--border-radius: 4px;
--border-radius-lg: 8px;
```

### 阴影变量

```css
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.08);    /* 卡片阴影 */
--shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.12);   /* 悬停阴影 */
```

---

## 按钮组件

### 基础按钮

```html
<button class="btn">默认按钮</button>
<button class="btn is-active">激活状态</button>
<button class="btn is-disabled">禁用状态</button>
```

### 按钮尺寸

```html
<button class="btn btn--sm">小按钮</button>
<button class="btn">默认按钮</button>
<button class="btn btn--lg">大按钮</button>
```

### 按钮变体

```html
<!-- 主要按钮（填充样式） -->
<button class="btn btn--primary">主要操作</button>

<!-- 次要按钮（灰色背景） -->
<button class="btn btn--secondary">次要操作</button>

<!-- 轮廓按钮（透明背景） -->
<button class="btn btn--outline">轮廓按钮</button>

<!-- 幽灵按钮（无边框） -->
<button class="btn btn--ghost">幽灵按钮</button>

<!-- 文字按钮 -->
<button class="btn btn--text">文字链接</button>
```

### 按钮组

```html
<div class="btn-group">
    <button class="btn">选项1</button>
    <button class="btn">选项2</button>
    <button class="btn">选项3</button>
</div>
```

### 按钮交互状态

| 状态 | CSS 类 | 视觉效果 |
|------|--------|----------|
| 默认 | `.btn` | 灰色边框，次要文字颜色 |
| 悬停 | `.btn:hover` | 蓝色边框，蓝色文字 |
| 激活 | `.btn.is-active` | 蓝色背景，白色文字 |
| 禁用 | `.btn.is-disabled` | 50%透明度，不可点击 |

### 按钮命名规范

**旧样式（不推荐）**:
- `.button`
- `.date-btn`
- `.date-quick-btn`
- `.tab-btn`

**新样式（推荐）**:
- `.btn` - 基础类
- `.btn--{variant}` - 变体修饰符
- `.is-{state}` - 状态修饰符

---

## 卡片组件

### 基础卡片

```html
<div class="card">
    <div class="card__header">
        <h3 class="card__title">卡片标题</h3>
        <div class="card__actions">
            <button class="btn btn--sm">操作</button>
        </div>
    </div>
    <div class="card__body">
        卡片内容...
    </div>
    <div class="card__footer">
        <button class="btn btn--secondary">取消</button>
        <button class="btn btn--primary">确认</button>
    </div>
</div>
```

### 卡片变体

```html
<!-- 筛选卡片（推荐用于筛选器区域） -->
<div class="card card--filter">
    <!-- 筛选器内容 -->
</div>

<!-- 指标卡片（带有左侧彩色边框） -->
<div class="card card--metric">
    <!-- 指标内容 -->
</div>

<!-- 图表卡片 -->
<div class="card card--chart">
    <!-- 图表内容 -->
</div>

<!-- 可交互卡片（悬停效果） -->
<div class="card card--interactive">
    <!-- 可点击内容 -->
</div>
```

### 卡片结构说明

```
.card
├── .card__header (可选)
│   ├── .card__title
│   └── .card__actions
├── .card__body
│   └── .card__body--padded (可选)
└── .card__footer (可选)
    └── 按钮/操作
```

### 空状态卡片

```html
<div class="card">
    <div class="card__empty">
        <div class="card__empty-icon">📭</div>
        <p>暂无数据</p>
    </div>
</div>
```

---

## 业务指标组件

> **版本**: v1.0.0
> **更新时间**: 2026-01-26
> **组件文件**: `frontend/js/components/BusinessMetrics.js`

业务指标组件提供三种专业的数据展示卡片，专为 BI 分析场景设计，支持动态颜色编码和交互反馈。

### 组件类型

#### 1. 紧凑型指标卡片 (Compact Card)

**用途**: 展示基础指标（第一行），如新增笔记数、投放笔记数、投放金额

**特点**:
- 半透明彩色背景 + 左侧彩色边框
- 悬停时向上浮动 + 彩色阴影
- 紧凑布局，适合横向排列

**使用示例**:
```javascript
// JavaScript 调用
BusinessMetrics.renderCompactCard(
    '新增笔记数',
    '782',
    '篇',
    '#6366F1'  // 紫色
)

// 或者直接使用 HTML
<div class="compact-card" style="
    background: #6366F115;
    border-left: 3px solid #6366F1;
    padding: 14px 16px;
    border-radius: 6px;
">
    <div style="font-size: 11px; color: #6366F1; font-weight: 600; margin-bottom: 6px;">
        新增笔记数
    </div>
    <div style="font-size: 24px; font-weight: 700; color: #171A23;">
        782
    </div>
    <div style="font-size: 11px; color: #8A8D99; margin-top: 2px;">
        篇
    </div>
</div>
```

**交互效果**:
- 悬停: `transform: translateY(-2px)` + 彩色阴影
- 过渡: `transition: all 0.2s ease`

---

#### 2. 漏斗指标卡片 (Funnel Card)

**用途**: 展示业务转化漏斗的各个节点（第二行）

**特点**:
- 柔和彩色背景 + 圆形步骤标号（左上角）
- 悬停时放大效果 + 彩色阴影
- 清晰的转化流程可视化

**颜色方案**:
- 曝光量: 蓝色 `#E8F4FF` / `#1890FF`
- 点击量: 橙色 `#FFF7E6` / `#FA8C16`
- 私信进线: 粉色 `#FFF0F6` / `#C41D7F`
- 加企微: 绿色 `#F6FFED` / `#52C41A`
- 开户数: 紫色 `#F9F0FF` / `#722ED1`

**使用示例**:
```javascript
// JavaScript 调用
BusinessMetrics.renderFunnelCard(
    '曝光量',
    '13,017,458',
    '#E8F4FF',  // 背景色
    '#1890FF',  // 主题色
    1          // 步骤序号
)

// 或者直接使用 HTML
<div class="funnel-card" style="
    background: #E8F4FF;
    border-radius: 6px;
    padding: 12px;
    text-align: center;
    position: relative;
">
    <div class="funnel-card__badge" style="
        position: absolute;
        top: 8px;
        left: 8px;
        width: 18px;
        height: 18px;
        background: #1890FF;
        color: white;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
    ">1</div>
    <div style="font-size: 10px; color: #1890FF; font-weight: 600; margin-bottom: 4px;">
        曝光量
    </div>
    <div style="font-size: 20px; font-weight: 700; color: #171A23;">
        13,017,458
    </div>
</div>
```

**交互效果**:
- 悬停: `transform: scale(1.05)` + 彩色阴影
- 过渡: `transition: all 0.2s ease`

---

#### 3. 转化率卡片 (Rate Card)

**用途**: 展示业务转化率指标（第三行），支持智能颜色编码

**特点**:
- 白色背景 + 灰色边框
- 智能颜色编码（根据数值自动变色）
- 小字副标题显示转化路径
- 悬停时边框变色 + 软阴影

**颜色编码规则**:
- 🟢 **绿色** (`#52C41A`): ≥10% - 优秀
- 🔵 **蓝色** (`#1890FF`): 5-10% - 良好
- 🟠 **橙色** (`#FA8C16`): 2-5% - 一般
- 🔴 **红色** (`#F5222D`): <2% - 待优化

**使用示例**:
```javascript
// JavaScript 调用
BusinessMetrics.renderRateCard(
    '曝光点击率',
    8.6,
    '%',
    '曝光 → 点击'  // 转化路径
)

// 或者直接使用 HTML
<div class="rate-card" style="
    background: white;
    border: 1px solid #E8E9EB;
    border-radius: 6px;
    padding: 12px;
    text-align: center;
">
    <div style="font-size: 10px; color: #8A8D99; margin-bottom: 4px;">
        曝光 → 点击
    </div>
    <div style="font-size: 11px; color: #5A5C66; font-weight: 600; margin-bottom: 6px;">
        曝光点击率
    </div>
    <div style="font-size: 22px; font-weight: 700; color: #FA8C16;">
        8.6<span style="font-size: 12px;">%</span>
    </div>
</div>
```

**交互效果**:
- 悬停: `borderColor` 变为数值颜色 + 软阴影
- 过渡: `transition: all 0.2s ease`

---

#### 4. 成本效率卡片 (Cost Card)

**用途**: 展示成本类指标（第四行），支持智能成本颜色编码

**特点**:
- 彩色背景 + 左侧彩色边框
- 智能成本颜色编码
- 悬停时向右滑动效果
- 清晰的成本单位显示

**颜色编码规则**（默认阈值）:
- 🟢 **绿色** (`#F6FFED` / `#52C41A`): <100元 - 成本优秀
- 🔵 **蓝色** (`#E8F4FF` / `#1890FF`): 100-500元 - 成本良好
- 🟠 **橙色** (`#FFF7E6` / `#FA8C16`): 500-1000元 - 成本中等偏高
- 🔴 **红色** (`#FFF1F0` / `#F5222D`): ≥1000元 - 成本高，需优化

**使用示例**:
```javascript
// JavaScript 调用（使用默认阈值）
BusinessMetrics.renderCostCard(
    '千次曝光成本',
    130.18,
    '元/千次'
)

// JavaScript 调用（自定义阈值）
BusinessMetrics.renderCostCard(
    '单开户成本',
    850,
    '元/户',
    {
        thresholds: {
            good: 200,     // <200: 绿色
            medium: 500,   // 200-500: 蓝色
            high: 1000     // 500-1000: 橙色，>=1000: 红色
        }
    }
)

// 或者直接使用 HTML
<div class="cost-card" style="
    background: #E8F4FF;
    border-left: 3px solid #1890FF;
    border-radius: 6px;
    padding: 12px;
">
    <div style="font-size: 11px; color: #1890FF; font-weight: 600; margin-bottom: 6px;">
        千次曝光成本
    </div>
    <div style="font-size: 22px; font-weight: 700; color: #171A23;">
        130.18
        <span style="font-size: 12px; margin-left: 4px; color: #8A8D99;">元/千次</span>
    </div>
</div>
```

**交互效果**:
- 悬停: `transform: translateX(4px)` + 彩色阴影
- 过渡: `transition: all 0.2s ease`

---

### 布局组合示例

#### 四行业务指标布局

```html
<div class="card">
    <div class="card__header">
        <h3 class="card__title">核心运营数据</h3>
    </div>
    <div class="card__body">
        <!-- 第一行：基础指标（3个紧凑卡片） -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
            ${BusinessMetrics.renderCompactCard('新增笔记数', '782', '篇', '#6366F1')}
            ${BusinessMetrics.renderCompactCard('投放笔记数', '650', '篇', '#8B5CF6')}
            ${BusinessMetrics.renderCompactCard('投放金额', '1,694,608.62', '元', '#F59E0B')}
        </div>

        <!-- 第二行：转化漏斗（5个漏斗卡片） -->
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: #5A5C66; margin-bottom: 10px;">
                业务转化漏斗
            </div>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
                ${BusinessMetrics.renderFunnelCard('曝光量', '13,017,458', '#E8F4FF', '#1890FF', 1)}
                ${BusinessMetrics.renderFunnelCard('点击量', '525,292', '#FFF7E6', '#FA8C16', 2)}
                ${BusinessMetrics.renderFunnelCard('私信进线', '26,125', '#FFF0F6', '#C41D7F', 3)}
                ${BusinessMetrics.renderFunnelCard('加企微', '2,247', '#F6FFED', '#52C41A', 4)}
                ${BusinessMetrics.renderFunnelCard('开户数', '412', '#F9F0FF', '#722ED1', 5)}
            </div>
        </div>

        <!-- 第三行：转化率指标（4个转化率卡片） -->
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: #5A5C66; margin-bottom: 10px;">
                转化率指标
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                ${BusinessMetrics.renderRateCard('曝光点击率', 8.6, '%', '曝光 → 点击')}
                ${BusinessMetrics.renderRateCard('点击进线率', 4.97, '%', '点击 → 私信')}
                ${BusinessMetrics.renderRateCard('进线加微率', 8.6, '%', '私信 → 加微')}
                ${BusinessMetrics.renderRateCard('线索开户率', 18.34, '%', '加微 → 开户')}
            </div>
        </div>

        <!-- 第四行：成本效率指标（4个成本卡片） -->
        <div>
            <div style="font-size: 12px; font-weight: 600; color: #5A5C66; margin-bottom: 10px;">
                成本效率指标
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                ${BusinessMetrics.renderCostCard('千次曝光成本', 130.18, '元/千次')}
                ${BusinessMetrics.renderCostCard('点击成本', 3.23, '元/次')}
                ${BusinessMetrics.renderCostCard('单企微成本', 754.52, '元/人')}
                ${BusinessMetrics.renderCostCard('单开户成本', 4113.13, '元/户')}
            </div>
        </div>
    </div>
</div>
```

---

### 设计原则

#### 1. 层次分明
- **第一行**: 基础指标（输入）- 使用紧凑型卡片
- **第二行**: 业务转化漏斗（过程）- 使用漏斗卡片，步骤可视化
- **第三行**: 转化率指标（效率）- 与第二行一一对应
- **第四行**: 成本效率指标（产出）- 单位成本分析

#### 2. 颜色语义
- **绿色**: 优秀/低成本
- **蓝色**: 良好/中等成本
- **橙色**: 一般/中等偏高成本
- **红色**: 待优化/高成本

#### 3. 交互反馈
- 所有卡片支持悬停交互
- 过渡时间统一为 0.2s ease
- 阴影颜色与主题色一致（透明度 30%）
- 交互方向各异（上浮/放大/右滑），增强可玩性

#### 4. 数据可读性
- 数值字体大小: 20-24px（较大，突出）
- 标题字体大小: 10-11px（较小，不抢眼）
- 单位字体大小: 11-12px（清晰可见）
- 行高: 1.2（紧凑但可读）

---

## 状态修饰符

### 通用状态类

可应用于任何组件的状态类：

```html
<!-- 激活状态 -->
<div class="is-active">内容</div>
<button class="btn is-active">按钮</button>

<!-- 禁用状态 -->
<div class="is-disabled">内容</div>
<button class="btn is-disabled">按钮</button>

<!-- 加载状态 -->
<div class="is-loading">加载中...</div>

<!-- 隐藏/显示 -->
<div class="is-hidden">隐藏内容</div>
<div class="is-visible">显示内容</div>
```

### 文本状态

```html
<!-- 文本截断 -->
<div class="is-truncated" style="max-width: 200px;">
    这段文本过长时会被截断...
</div>
```

### 位置状态

```html
<!-- 粘性定位（固定在顶部） -->
<div class="is-sticky">
    粘性导航栏
</div>
```

### 颜色变体

```html
<!-- 文字颜色 -->
<p class="is-primary">主要文字</p>
<p class="is-success">成功文字</p>
<p class="is-warning">警告文字</p>
<p class="is-error">错误文字</p>

<!-- 背景颜色 -->
<div class="has-primary-bg">蓝色背景</div>
<div class="has-success-bg">绿色背景</div>
<div class="has-warning-bg">橙色背景</div>
<div class="has-error-bg">红色背景</div>

<!-- 边框颜色 -->
<div class="has-primary-border">蓝色边框</div>
<div class="has-success-border">绿色边框</div>
<div class="has-warning-border">橙色边框</div>
<div class="has-error-border">红色边框</div>
```

---

## 使用示例

### 示例 1: 筛选器卡片（推荐样式）

```html
<div class="card card--filter">
    <div class="card__body">
        <!-- 日期快速选择 -->
        <div class="btn-group">
            <button class="btn is-active">近7天</button>
            <button class="btn">近30天</button>
            <button class="btn">近90天</button>
        </div>

        <!-- 操作按钮 -->
        <div class="card__footer">
            <button class="btn btn--secondary">重置</button>
            <button class="btn btn--primary">查询</button>
            <button class="btn btn--outline">导出</button>
        </div>
    </div>
</div>
```

### 示例 2: 指标卡片

```html
<div class="card card--metric">
    <div class="card__body">
        <h4>总花费</h4>
        <p class="is-primary" style="font-size: 24px; font-weight: bold;">
            ¥1,234,567
        </p>
        <p class="is-success">↑ 12.5%</p>
    </div>
</div>
```

### 示例 3: 图表卡片

```html
<div class="card card--chart">
    <div class="card__header">
        <h3 class="card__title">花费趋势</h3>
        <div class="card__actions">
            <button class="btn btn--sm btn--ghost">刷新</button>
            <button class="btn btn--sm btn--ghost">导出</button>
        </div>
    </div>
    <div class="card__body">
        <div id="chart" style="width: 100%; height: 300px;"></div>
    </div>
</div>
```

---

## 迁移指南

### 从旧样式迁移到新样式

#### 1. 按钮迁移

**旧代码**:
```html
<button class="button active">点击我</button>
<button class="date-btn">近7天</button>
<button class="tab-btn">标签</button>
```

**新代码**:
```html
<button class="btn is-active">点击我</button>
<button class="btn">近7天</button>
<button class="btn">标签</button>
```

#### 2. 卡片迁移

**旧代码**:
```html
<div class="section-card">
    <h3>标题</h3>
    <div class="section-body">内容</div>
</div>
```

**新代码**:
```html
<div class="card">
    <div class="card__header">
        <h3 class="card__title">标题</h3>
    </div>
    <div class="card__body">
        内容
    </div>
</div>
```

#### 3. 状态迁移

**旧代码**:
```css
.custom-element.active {
    background-color: var(--primary-color);
    color: white;
}

.custom-element:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

**新代码**:
```html
<div class="custom-element is-active">内容</div>
<div class="custom-element is-disabled">内容</div>
```

---

## 最佳实践

### 1. 命名规范

**组件类**: 使用 BEM 命名
- `.card` - Block
- `.card__header` - Element
- `.card--filter` - Modifier

**状态类**: 使用 `is-` 前缀
- `.is-active`
- `.is-disabled`
- `.is-loading`

**工具类**: 使用语义化前缀
- `.has-primary-bg`
- `.is-truncated`

### 2. 组件组合

```html
<!-- ✅ 推荐: 明确的嵌套 -->
<div class="card">
    <div class="card__body">
        <button class="btn btn--primary">确定</button>
    </div>
</div>

<!-- ❌ 避免: 混乱的类名 -->
<div class="card card-filter p-4 mt-2">
    <button class="btn-primary large">确定</button>
</div>
```

### 3. 响应式设计

所有新组件应考虑移动端适配：

```css
@media (max-width: 768px) {
    .btn-group {
        flex-direction: column;
        width: 100%;
    }

    .btn {
        width: 100%;
    }
}
```

---

## 文件结构

```
frontend/css/
├── variables.css           # CSS 变量定义
├── components.css          # 统一组件系统（新增部分）
│   ├── 按钮系统
│   ├── 卡片系统
│   └── 状态修饰符
├── reset.css              # CSS 重置
├── layout.css             # 布局样式
├── themes.css             # 主题切换
└── enhanced-interactions.css  # 高级动画
```

---

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 更新日志

### v1.0.0 (2026-01-16)
- ✅ 创建统一按钮系统 (`.btn`)
- ✅ 创建统一卡片系统 (`.card`)
- ✅ 创建状态修饰符 (`.is-active`, `.is-disabled`, etc.)
- ✅ 基于 XhsNotesListReport 的线框卡片样式
- ✅ 保持向后兼容性

---

## 联系与反馈

如有问题或建议，请联系前端开发团队。
