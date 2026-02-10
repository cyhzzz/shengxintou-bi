# Structured Clarity Design System - 组件 API 文档

> **版本**: v1.1.0
> **更新时间**: 2026-01-26
> **设计哲学**: Precision through restraint (通过克制实现精确)

---

## 📖 目录

1. [设计令牌 (Design Tokens)](#设计令牌)
2. [基础组件](#基础组件)
3. [表单组件](#表单组件)
4. [数据展示](#数据展示)
5. [反馈组件](#反馈组件)
6. [导航组件](#导航组件)
7. [覆盖层组件](#覆盖层组件)
8. [其他组件](#其他组件)

---

## 🎨 设计令牌

### CSS 变量

#### 间距系统 (Spacing)

```css
--space-xs: 4px;      /* 极小间距 */
--space-sm: 8px;      /* 小间距 */
--space-md: 16px;     /* 默认间距 */
--space-lg: 20px;     /* 大间距 */
--space-xl: 24px;     /* 超大间距 */
--space-2xl: 32px;    /* 2倍超大间距 */
--space-3xl: 40px;    /* 3倍超大间距 */
--space-4xl: 48px;    /* 4倍超大间距 */
```

#### 排版系统 (Typography)

```css
/* 字体大小 */
--font-size-xs: 11px;
--font-size-sm: 12px;
--font-size-base: 14px;
--font-size-md: 16px;
--font-size-lg: 18px;
--font-size-xl: 20px;
--font-size-2xl: 24px;
--font-size-3xl: 28px;
--font-size-4xl: 32px;

/* 字重 */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* 行高 */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

#### 颜色系统 (Colors)

```css
/* 语义化颜色 */
--color-primary: #1890FF;      /* 主色 */
--color-success: #52C41A;      /* 成功 */
--color-warning: #FAAD14;      /* 警告 */
--color-error: #F5222D;        /* 错误 */
--color-info: #1890FF;         /* 信息 */

/* 文字颜色 */
--color-text-primary: #171A23;   /* 主要文字 */
--color-text-secondary: #5A5C66; /* 次要文字 */
--color-text-tertiary: #8A8D99;  /* 辅助文字 */
--color-text-disabled: #BDBFC7;  /* 禁用文字 */

/* 背景颜色 */
--color-bg-primary: #FFFFFF;   /* 主背景 */
--color-bg-secondary: #F4F5F7; /* 次要背景 */
--color-bg-tertiary: #E8EAED;  /* 第三背景 */

/* 边框颜色 */
--color-border-light: #E1E4E8;
--color-border-medium: #D2D6E1;
--color-border-dark: #BDBFC7;
```

#### Z-Index 层级

```css
--z-base: 1;
--z-dropdown: 100;
--z-dropdown-backdrop: 99;
--z-sticky: 200;
--z-modal-backdrop: 999;
--z-modal: 1000;
--z-popover: 1010;
--z-tooltip: 1020;
--z-toast: 1100;
--z-max: 9999;
```

#### 响应式断点

```css
--breakpoint-xs: 480px;
--breakpoint-sm: 576px;
--breakpoint-md: 768px;
--breakpoint-lg: 992px;
--breakpoint-xl: 1200px;
--breakpoint-xxl: 1600px;
```

---

## 🧩 基础组件

### Button (按钮)

#### 基础类名
```html
<button class="btn">默认按钮</button>
```

#### 变体 (Modifiers)

| 类名 | 说明 | 用途 |
|-----|------|------|
| `.btn--primary` | 主要按钮（蓝色）| 提交、确认、查询等主要操作 |
| `.btn--secondary` | 次要按钮（灰色）| 取消、关闭等次要操作 |
| `.btn--outline` | 轮廓按钮（透明背景+边框）| 导出、刷新等辅助操作 |
| `.btn--ghost` | 幽灵按钮（无边框）| 表格中的编辑、删除操作 |
| `.btn--success` | 成功按钮 | 成功相关的操作 |
| `.btn--warning` | 警告按钮 | 警告相关的操作 |
| `.btn--error` | 错误按钮 | 危险操作（删除等） |

#### 尺寸 (Sizes)

| 类名 | 高度 | 字体大小 | 用途 |
|-----|------|---------|------|
| `.btn--sm` | 24px | 12px | 紧凑布局 |
| 默认 | 32px | 14px | 标准按钮 |
| `.btn--lg` | 40px | 16px | 突出显示 |

#### 状态 (States)

| 类名 | 说明 |
|-----|------|
| `.is-active` | 激活状态（蓝色背景，白色文字）|
| `.is-disabled` | 禁用状态（50%透明度）|
| `.is-loading` | 加载状态（显示spinner）|

#### 按钮组

```html
<div class="btn-group">
  <button class="btn is-active">选项1</button>
  <button class="btn">选项2</button>
  <button class="btn">选项3</button>
</div>
```

#### 完整示例

```html
<!-- 主要按钮 -->
<button class="btn btn--primary">提交</button>
<button class="btn btn--primary is-disabled">禁用</button>

<!-- 次要按钮 -->
<button class="btn btn--secondary">取消</button>

<!-- 轮廓按钮 -->
<button class="btn btn--outline">导出</button>

<!-- 危险操作 -->
<button class="btn btn--error">删除</button>

<!-- 按钮尺寸 -->
<button class="btn btn--sm">小按钮</button>
<button class="btn">标准按钮</button>
<button class="btn btn--lg">大按钮</button>

<!-- 按钮组 -->
<div class="btn-group">
  <button class="btn is-active">近7天</button>
  <button class="btn">近30天</button>
  <button class="btn">近90天</button>
</div>
```

---

### Card (卡片)

#### 基础类名

```html
<div class="card">
  <div class="card__header">...</div>
  <div class="card__body">...</div>
  <div class="card__footer">...</div>
</div>
```

#### 变体 (Modifiers)

| 类名 | 说明 | 用途 |
|-----|------|------|
| `.card--filter` | 筛选卡片（灰色边框，无左侧蓝色条）| 筛选器区域 |
| `.card--chart` | 图表卡片（最小高度350px）| 图表容器 |
| `.card--metric` | 指标卡片（紧凑内边距）| 指标展示 |
| `.card--full-width` | 全宽卡片（width: 100%）| 数据列表、管理类报表 |
| `.card--interactive` | 交互卡片（悬停效果）| 可点击内容 |

#### BEM 结构

```html
<div class="card">
  <!-- 可选：头部 -->
  <div class="card__header">
    <h3 class="card__title">卡片标题</h3>
    <div class="card__actions">
      <button class="btn btn--sm">操作</button>
    </div>
  </div>

  <!-- 必须：主体内容 -->
  <div class="card__body">
    卡片内容...
  </div>

  <!-- 可选：底部操作区 -->
  <div class="card__footer">
    <button class="btn btn--secondary">取消</button>
    <button class="btn btn--primary">确认</button>
  </div>
</div>
```

#### 完整示例

```html
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
    <h3 class="card__title">花费趋势</h3>
    <div class="card__actions">
      <button class="btn btn--sm btn--ghost">刷新</button>
    </div>
  </div>
  <div class="card__body">
    <div id="chart" style="height: 350px;"></div>
  </div>
</div>

<!-- 指标卡片 -->
<div class="card card--metric">
  <div style="font-size: 28px; font-weight: 600;">¥1,234,567</div>
  <div style="font-size: 13px; color: #5A5C66;">总花费</div>
  <div style="font-size: 12px; color: #52C41A; margin-top: 8px;">↑ 12.5%</div>
</div>
```

---

### Divider (分隔线)

#### 基础类名

```html
<hr class="divider">
```

#### 变体 (Modifiers)

| 类名 | 说明 |
|-----|------|
| `.divider--thick` | 粗线（1.5px）|
| `.divider--dashed` | 虚线 |
| `.divider--with-text` | 带文字的分隔线 |

#### 完整示例

```html
<!-- 细线（默认） -->
<hr class="divider">

<!-- 粗线 -->
<hr class="divider divider--thick">

<!-- 虚线 -->
<hr class="divider divider--dashed">

<!-- 带文字的分隔线 -->
<div class="divider divider--with-text">
  <span>OR</span>
</div>
```

---

## 📝 表单组件

### Form Control (表单控件)

#### Input (输入框)

```html
<div class="form-group">
  <label class="form-label" for="inputId">
    标签文字 <span class="form-required">*</span>
  </label>
  <input type="text"
         id="inputId"
         class="form-control"
         placeholder="请输入...">
  <small class="form-hint">提示文字</small>
</div>
```

#### Select (下拉框)

```html
<select class="form-control">
  <option>请选择</option>
  <option>选项1</option>
  <option>选项2</option>
</select>
```

#### Textarea (多行文本)

```html
<textarea class="form-control" rows="3" placeholder="请输入..."></textarea>
```

#### Checkbox (复选框)

```html
<label class="checkbox">
  <input type="checkbox">
  <span class="checkbox__label">记住我</span>
</label>
```

#### Radio (单选框)

```html
<label class="radio">
  <input type="radio" name="group" value="1">
  <span class="radio__label">选项1</span>
</label>
<label class="radio">
  <input type="radio" name="group" value="2">
  <span class="radio__label">选项2</span>
</label>
```

#### Switch (开关)

```html
<label class="switch">
  <input type="checkbox" class="switch__input">
  <span class="switch__slider"></span>
</label>
```

#### 状态 (States)

| 类名 | 说明 |
|-----|------|
| `.is-focus` | 聚焦状态 |
| `.is-disabled` | 禁用状态 |
| `.is-error` | 错误状态（红色边框）|
| `.required` | 必填标记（红色星号）|

---

## 📊 数据展示

### Data Table (数据表格)

#### 基础结构

```html
<div class="table-container">
  <table class="data-table">
    <thead>
      <tr>
        <th class="sortable">列1</th>
        <th>列2</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>数据1</td>
        <td>数据2</td>
        <td>
          <button class="btn btn--sm btn--ghost">编辑</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

#### 可排序表头

```html
<th class="sortable">日期</th>
<th class="sortable" style="text-align: right;">花费</th>
```

#### 空状态

```html
<tbody>
  <tr>
    <td colspan="5">
      <div class="table-empty">
        <div class="table-empty__icon">📭</div>
        <p>暂无数据</p>
      </div>
    </td>
  </tr>
</tbody>
```

#### 完整示例

```html
<div class="table-container">
  <table class="data-table">
    <thead>
      <tr>
        <th class="sortable">日期</th>
        <th class="sortable">平台</th>
        <th class="sortable" style="text-align: right;">花费</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>2026-01-23</td>
        <td>腾讯</td>
        <td style="text-align: right;">¥12,345.67</td>
        <td><span class="tag tag--success">Active</span></td>
        <td>
          <button class="btn btn--sm btn--ghost">编辑</button>
          <button class="btn btn--sm btn--ghost is-error">删除</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

### Tag & Badge (标签与徽章)

#### Tag (标签)

```html
<!-- 基础标签 -->
<span class="tag">默认</span>

<!-- 语义化标签 -->
<span class="tag tag--primary">Primary</span>
<span class="tag tag--success">成功</span>
<span class="tag tag--warning">警告</span>
<span class="tag tag--error">错误</span>
<span class="tag tag--info">信息</span>

<!-- 禁用状态 -->
<span class="tag" style="opacity: 0.6;">禁用</span>

<!-- 可关闭标签 -->
<span class="tag tag--close">
  标签文字
  <button class="tag__close">&times;</button>
</span>
```

#### Badge (徽章)

```html
<!-- 数字徽章 -->
<span class="badge">5</span>
<span class="badge">99+</span>

<!-- 圆点徽章 -->
<span class="badge badge--dot"></span>

<!-- 语义化徽章 -->
<span class="badge badge--primary">New</span>
<span class="badge badge--success">OK</span>

<!-- 按钮上的徽章 -->
<button class="btn btn--primary">
  消息
  <span class="badge" style="position: absolute; top: -8px; right: -8px;">5</span>
</button>
```

---

### Progress & Steps (进度指示)

#### Progress Bar (进度条)

```html
<!-- 基础进度条 -->
<div class="progress">
  <div class="progress-bar" style="width: 50%;"></div>
</div>

<!-- 带标签的进度条 -->
<div>
  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
    <span>上传中...</span>
    <span>75%</span>
  </div>
  <div class="progress">
    <div class="progress-bar" style="width: 75%;"></div>
  </div>
</div>

<!-- 语义化进度条 -->
<div class="progress">
  <div class="progress-bar progress-bar--success" style="width: 100%;"></div>
</div>

<div class="progress">
  <div class="progress-bar progress-bar--warning" style="width: 60%;"></div>
</div>

<div class="progress">
  <div class="progress-bar progress-bar--error" style="width: 30%;"></div>
</div>
```

#### Steps (步骤条)

```html
<div class="steps">
  <div class="step is-completed">
    <div class="step-circle">✓</div>
    <div class="step-label">步骤1</div>
  </div>
  <div class="step-line"></div>
  <div class="step is-active">
    <div class="step-circle">2</div>
    <div class="step-label">步骤2</div>
  </div>
  <div class="step-line"></div>
  <div class="step">
    <div class="step-circle">3</div>
    <div class="step-label">步骤3</div>
  </div>
</div>
```

---

## 🔔 反馈组件

### Toast (通知)

#### 基础结构

```html
<div class="toast-container">
  <div class="toast toast--success">
    <div class="toast__icon">✓</div>
    <div class="toast__content">
      <div class="toast__title">成功</div>
      <div class="toast__message">操作成功完成！</div>
    </div>
    <button class="toast__close">&times;</button>
  </div>
</div>
```

#### 类型

| 类名 | 说明 |
|-----|------|
| `.toast--success` | 成功通知（绿色左边框）|
| `.toast--error` | 错误通知（红色左边框）|
| `.toast--warning` | 警告通知（橙色左边框）|
| `.toast--info` | 信息通知（蓝色左边框）|

#### JavaScript 示例

```javascript
function showToast(type, title, message) {
  const container = document.querySelector('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <div class="toast__icon">${type === 'success' ? '✓' : 'ℹ'}</div>
    <div class="toast__content">
      <div class="toast__title">${title}</div>
      <div class="toast__message">${message}</div>
    </div>
    <button class="toast__close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 5000);
}
```

---

### Loading (加载状态)

#### Spinner (旋转加载)

```html
<!-- 小尺寸 -->
<div class="spinner" style="width: 24px; height: 24px;"></div>

<!-- 标准尺寸 -->
<div class="spinner"></div>

<!-- 大尺寸 -->
<div class="spinner" style="width: 40px; height: 40px;"></div>
```

#### Skeleton (骨架屏)

```html
<div class="skeleton" style="width: 100%; height: 20px;"></div>

<div class="skeleton" style="width: 60%; height: 24px; margin-bottom: 16px;"></div>

<!-- 完整卡片骨架屏 -->
<div class="card">
  <div class="card__body">
    <div class="skeleton" style="width: 60%; height: 24px; margin-bottom: 16px;"></div>
    <div class="skeleton" style="width: 100%; height: 16px; margin-bottom: 8px;"></div>
    <div class="skeleton" style="width: 100%; height: 16px; margin-bottom: 8px;"></div>
    <div class="skeleton" style="width: 80%; height: 16px;"></div>
  </div>
</div>
```

---

### Tooltip (工具提示)

#### 基础用法

```html
<!-- 顶部提示（默认）-->
<span class="tooltip" data-tooltip="这是提示文字">
  <button class="btn">悬停查看</button>
</span>

<!-- 右侧提示 -->
<span class="tooltip tooltip--right" data-tooltip="右侧提示">
  <button class="btn">悬停查看</button>
</span>

<!-- 底部提示 -->
<span class="tooltip tooltip--bottom" data-tooltip="底部提示">
  <button class="btn">悬停查看</button>
</span>

<!-- 左侧提示 -->
<span class="tooltip tooltip--left" data-tooltip="左侧提示">
  <button class="btn">悬停查看</button>
</span>
```

---

## 🗂️ 覆盖层组件

### Modal (模态框)

#### 基础结构

```html
<div class="modal-overlay" id="modalId">
  <div class="modal-container">
    <!-- 头部 -->
    <div class="modal-header">
      <h3 class="modal-title">模态框标题</h3>
      <button class="modal-close" onclick="document.getElementById('modalId').classList.remove('is-active')">&times;</button>
    </div>

    <!-- 主体 -->
    <div class="modal-body">
      模态框内容...
    </div>

    <!-- 底部 -->
    <div class="modal-footer">
      <button class="btn btn--secondary">取消</button>
      <button class="btn btn--primary">确认</button>
    </div>
  </div>
</div>
```

#### 激活模态框

```javascript
// 打开模态框
document.getElementById('modalId').classList.add('is-active');

// 关闭模态框
document.getElementById('modalId').classList.remove('is-active');

// 点击遮罩层关闭
<div class="modal-overlay" onclick="if(event.target === this) this.classList.remove('is-active')">
```

#### 变体 (Modifiers)

| 类名 | 说明 |
|-----|------|
| `.modal--sm` | 小尺寸（max-width: 400px）|
| `.modal--lg` | 大尺寸（max-width: 800px）|
| `.modal--fullscreen` | 全屏模态框 |

---

## 🎯 使用指南

### 布局规范

#### 卡片间距

```html
<!-- 垂直排列的卡片 -->
<div class="card">卡片1</div>
<div class="card">卡片2</div>
<!-- 相邻卡片自动有 20px 间距 -->

<!-- 网格布局的卡片 -->
<div style="display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
  <div class="card">卡片1</div>
  <div class="card">卡片2</div>
  <div class="card">卡片3</div>
</div>
```

#### 筛选器布局

```html
<div class="card card--filter">
  <div class="card__body">
    <!-- 使用 flex + wrap 实现自动换行 -->
    <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
      <div class="form-group">
        <label class="form-label">平台</label>
        <select class="form-control">...</select>
      </div>

      <div class="form-group">
        <label class="form-label">代理商</label>
        <select class="form-control">...</select>
      </div>

      <!-- 操作按钮靠右对齐 -->
      <div style="margin-left: auto; display: flex; gap: 8px;">
        <button class="btn btn--secondary">重置</button>
        <button class="btn btn--primary">查询</button>
      </div>
    </div>
  </div>
</div>
```

### 状态修饰符

#### 通用状态

```html
<!-- 激活状态 -->
<div class="is-active">内容</div>

<!-- 禁用状态 -->
<div class="is-disabled">内容</div>

<!-- 加载状态 -->
<div class="is-loading">加载中...</div>

<!-- 隐藏/显示 -->
<div class="is-hidden">隐藏内容</div>
<div class="is-visible">显示内容</div>
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
```

---

## 📐 设计原则

### 1. 边界即秩序

- **线条定义信息空间**: 1px 细线用于分隔，1.5px 粗线用于强调
- **从不装饰**: 所有线条都服务于信息层级，而非装饰
- **一致的边框**: 所有组件使用统一的边框颜色和粗细

### 2. 空间即呼吸

- **4mm 模块化节奏**: 使用 4px 倍数（4, 8, 16, 20, 24, 32...）
- **统一的间距**: 所有组件遵循相同的间距系统
- **留白创造层次**: 通过间距而非装饰来建立视觉层次

### 3. 色彩即信号

- **功能性语义配色**: 颜色传达状态（成功、警告、错误）
- **绝不装饰**: 不使用纯装饰性的颜色
- **一致性优先**: 相同状态始终使用相同颜色

### 4. 精确即信任

- **每个像素传达专业性**: 对齐精确，间距统一
- **细节体现品质**: 字体、圆角、阴影都经过精确设计
- **一致性创造信任**: 整个系统保持高度一致性

---

## 🚀 最佳实践

### DO's ✅

1. **使用统一的类名**
   ```html
   ✅ <button class="btn btn--primary">提交</button>
   ```

2. **遵循 BEM 命名规范**
   ```html
   ✅ <div class="card">
        <div class="card__header">...</div>
        <div class="card__body">...</div>
      </div>
   ```

3. **使用 CSS 变量**
   ```css
   ✅ padding: var(--space-md);
      color: var(--color-text-primary);
   ```

4. **保持一致性**
   ```html
   ✅ 所有按钮使用 .btn 基础类
   ✅ 所有卡片使用 .card 基础类
   ✅ 所有状态使用 .is-* 修饰符
   ```

### DON'Ts ❌

1. **不要使用旧组件类**
   ```html
   ❌ <button class="date-btn">近7天</button>
   ❌ <div class="section-card">...</div>
   ❌ <div class="metric-card">...</div>
   ```

2. **不要使用内联样式**
   ```html
   ❌ <div style="padding: 16px; color: #333;">...</div>
   ```

3. **不要使用 `active` 类**
   ```html
   ❌ <button class="btn active">激活</button>
   ✅ <button class="btn is-active">激活</button>
   ```

4. **不要嵌套卡片**
   ```html
   ❌ <div class="card">
        <div class="card">
          <div class="card__body">...</div>
        </div>
      </div>
   ```

---

## 📱 响应式设计

### 断点使用

```css
/* 超小屏幕 (手机) */
@media (max-width: 480px) {
  .card { padding: var(--space-sm); }
}

/* 小屏幕 (平板竖屏) */
@media (max-width: 576px) {
  .btn-group { flex-direction: column; }
}

/* 中等屏幕 (平板横屏) */
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
}

/* 大屏幕 (桌面) */
@media (min-width: 992px) {
  .container { max-width: 960px; }
}
```

---

## 🔗 相关文档

- **设计哲学**: `STRUCTURED_CLARITY_GUIDE.md`
- **视觉规范**: `Structured_Clarity_Design_System_Refined.pdf`
- **CSS组件**: `css/structured-clarity-components.css`
- **JS组件API**: `js/StructuredClarityComponents.js`
- **交互演示**: `demo-structured-clarity.html`

---

## 📝 版本历史

### v1.1.0 (2026-01-26)
- ✅ 添加7个新组件系统（Table, Tag/Badge, Modal, Toast, Loading, Progress, Tooltip）
- ✅ 扩展CSS变量系统（80+ 设计令牌）
- ✅ 修复视觉一致性问题（移除卡片蓝色边框）
- ✅ 创建完整的组件 API 文档

### v1.0.0 (2026-01-22)
- ✅ 初始版本
- ✅ 基础组件系统（按钮、卡片、表单）
- ✅ 设计令牌系统（间距、颜色、排版）

---

**文档维护**: 本文档随组件库更新而更新。如有疑问，请参考 `demo-structured-clarity.html` 中的实际演示。
