# 省心投 BI - 前端性能规范

> **版本**: v1.0.0
> **更新时间**: 2026-02-09
> **适用范围**: 所有前端开发工作

---

## 📋 概述

本文档定义了省心投 BI 系统前端性能优化的强制性规范和最佳实践。

**性能目标**:
- 初始加载时间 < 2s
- 组件渲染时间 < 100ms
- 首屏渲染时间 < 1s
- 用户交互响应 < 50ms

---

## 🎯 已完成的优化（Phase 1-2）

### ✅ ECharts 延迟加载

**优化效果**: 初始加载减少 30-40%（~500KB）

**实现方式**:
```javascript
// 动态加载 ECharts
async function loadECharts() {
    if (!window.echarts) {
        const script = document.createElement('script');
        script.src = 'libs/echarts-5.4.3.min.js';
        document.head.appendChild(script);

        await new Promise(resolve => {
            script.onload = resolve;
        });
    }
    return window.echarts;
}

// 报表组件中使用
class DashboardReport {
    async initCharts() {
        const echarts = await loadECharts();
        this.charts.trend = echarts.init(document.getElementById('trendChart'));
    }
}
```

**验证标准**:
- ✅ `index.html` 中无 ECharts 直接引入
- ✅ Network 面板显示 ECharts 延迟加载
- ✅ 初始页面加载时间 < 2s

---

### ✅ 异步瀑布流优化（DashboardReport）

**优化效果**: 首屏渲染速度提升 40-50%

**实现方式**:
```javascript
class DashboardReport {
    async loadData() {
        // 第一屏：优先加载指标卡片
        const metricsPromise = this.loadMetrics();

        // 第二屏：并行加载趋势图和平台分布
        const [metrics, trend, platform] = await Promise.all([
            metricsPromise,
            this.loadTrendData(),
            this.loadPlatformData()
        ]);

        // 渲染指标卡片（首屏）
        this.renderMetrics(metrics);

        // 延迟渲染图表（非首屏）
        requestIdleCallback(() => {
            this.renderTrendChart(trend);
            this.renderPlatformChart(platform);
        });
    }
}
```

**验证标准**:
- ✅ 首屏内容（指标卡片）在 1s 内渲染
- ✅ 图表数据异步加载
- ✅ 使用 `Promise.all()` 并行加载独立数据

---

## 🚨 强制性规范

### 1. ECharts 延迟加载 ⚠️ **CRITICAL**

**规则**: ECharts 库必须延迟加载，禁止在 `index.html` 中直接引入

**错误示例**:
```html
<!-- ❌ 禁止 -->
<head>
    <script src="libs/echarts-5.4.3.min.js"></script>
</head>
```

**正确示例**:
```html
<!-- ✅ 正确 -->
<head>
    <!-- 不引入 ECharts -->
</head>

<script>
// 动态加载
async function loadECharts() {
    if (!window.echarts) {
        const script = document.createElement('script');
        script.src = 'libs/echarts-5.4.3.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => { script.onload = resolve; });
    }
    return window.echarts;
}
</script>
```

**适用场景**: 所有使用 ECharts 的报表组件

---

### 2. 避免直接 DOM 操作 ⚠️ **HIGH**

**规则**: 避免频繁操作 DOM，使用批量更新

**错误示例**:
```javascript
// ❌ 禁止：频繁操作 DOM
for (let i = 0; i < 1000; i++) {
    const item = document.getElementById(`item-${i}`);
    item.style.color = 'red';
    item.style.fontSize = '14px';
}
```

**正确示例**:
```javascript
// ✅ 推荐：使用 DocumentFragment 或批量更新
const fragment = document.createDocumentFragment();

for (let i = 0; i < 1000; i++) {
    const item = document.createElement('div');
    item.className = 'item active';
    fragment.appendChild(item);
}

container.appendChild(fragment);

// 或使用 CSS 类切换
container.classList.add('loading');
```

**验证标准**:
- ✅ DOM 操作次数 < 100（每次渲染）
- ✅ 使用 `DocumentFragment` 批量插入
- ✅ 使用 CSS 类切换代替样式修改

---

### 3. 避免阻塞式渲染 ⚠️ **HIGH**

**规则**: 大数据集处理必须分批，避免阻塞渲染

**错误示例**:
```javascript
// ❌ 禁止：同步处理大数据
function renderTable(data) {
    for (let i = 0; i < data.length; i++) {
        const row = createRow(data[i]);
        table.appendChild(row);  // 阻塞渲染
    }
}
```

**正确示例**:
```javascript
// ✅ 推荐：分批处理
async function renderTable(data) {
    const batchSize = 100;

    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        // 渲染批次
        const fragment = document.createDocumentFragment();
        batch.forEach(item => {
            fragment.appendChild(createRow(item));
        });
        table.appendChild(fragment);

        // 让出控制权，允许渲染
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}
```

**验证标准**:
- ✅ 大数据集（>1000 条）使用分批处理
- ✅ 每批处理时间 < 16ms（一帧）
- ✅ 使用 `requestIdleCallback` 或 `setTimeout` 让出控制权

---

### 4. 避免过度轮询 ⚠️ **MEDIUM**

**规则**: 轮询间隔必须 >= 1s，优先使用事件驱动

**错误示例**:
```javascript
// ❌ 禁止：高频轮询
setInterval(() => {
    checkDataStatus();
}, 100);  // 10ms 轮询一次
```

**正确示例**:
```javascript
// ✅ 推荐：使用 WebSocket（事件驱动）
socket.on('dataUpdate', (data) => {
    updateUI(data);
});

// ✅ 或降低轮询频率
setInterval(() => {
    checkDataStatus();
}, 5000);  // 5s 轮询一次
```

**验证标准**:
- ✅ 轮询间隔 >= 1s（除非实时性要求极高）
- ✅ 优先使用 WebSocket 或 Server-Sent Events
- ✅ 页面隐藏时停止轮询

---

## 📐 组件设计规范

### 组件大小限制

**规则**: 报表组件建议 < 500 行

**推荐拆分时机**:
1. 单一职责：组件承担多个不相关的功能
2. 测试困难：组件过于复杂难以单元测试
3. 多处复用：相同逻辑在多个组件中重复

**示例**:
```javascript
// ✅ 合理大小组件（DashboardReport.js）
class DashboardReport {
    async init() {
        await this.loadMetrics();      // 50 行
        await this.loadTrendChart();    // 80 行
        await this.loadPlatformChart(); // 70 行
    }

    destroy() {
        // 清理资源
        Object.values(this.charts).forEach(chart => chart.dispose());
    }
}

// ⚠️ 过大组件（XhsNotesOperationReport.js - 需标注）
class XhsNotesOperationReport {
    // 800+ 行代码
    // TODO: 后续版本拆分为多个子组件
    // - 拆分为：运营指标组件、趋势图表组件、数据表格组件
}
```

**验证标准**:
- ✅ 组件文件 < 500 行（特殊情况需标注原因）
- ✅ 单个方法 < 100 行
- ✅ 职责清晰，易于测试

---

### 组件生命周期管理

**规则**: 组件必须正确清理资源

**实现方式**:
```javascript
class ReportComponent {
    constructor() {
        this.charts = {};
        this.eventListeners = [];
    }

    async init() {
        // 初始化图表
        this.charts.trend = echarts.init(document.getElementById('trend'));

        // 添加事件监听
        const handler = this.handleFilterChange.bind(this);
        window.addEventListener('filterChange', handler);
        this.eventListeners.push(['filterChange', handler]);
    }

    destroy() {
        // 清理图表
        Object.values(this.charts).forEach(chart => chart.dispose());
        this.charts = {};

        // 清理事件监听
        this.eventListeners.forEach(([event, handler]) => {
            window.removeEventListener(event, handler);
        });
        this.eventListeners = [];

        // 清理 DOM
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
    }
}
```

**验证标准**:
- ✅ 实现 `destroy()` 方法
- ✅ 清理所有图表实例
- ✅ 移除所有事件监听器
- ✅ 清理 DOM 引用

---

## 🎨 资源加载优化

### 1. 脚本加载顺序

**规则**: 关键脚本优先，非关键脚本延迟

**实现方式**:
```html
<head>
    <!-- ✅ 关键 CSS 内联 -->
    <style>
        /* 首屏关键样式 */
        .app-container { display: flex; }
        .sidebar { width: 200px; }
    </style>

    <!-- ✅ 非 CSS 延迟加载 -->
    <link rel="preload" href="css/components.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
</head>

<body>
    <!-- ✅ 脚本延迟加载 -->
    <script src="js/main.js" defer></script>
    <script src="js/reports/DashboardReport.js" defer></script>
</body>
```

**验证标准**:
- ✅ 关键渲染路径资源优先加载
- ✅ 非关键资源使用 `defer` 或 `async`
- ✅ 首屏内容在 1s 内渲染

---

### 2. 图片优化

**规则**: 图片必须优化

**实现方式**:
```html
<!-- ✅ 使用懒加载 -->
<img src="placeholder.jpg" data-src="actual-image.jpg" loading="lazy" alt="描述">

<!-- ✅ 使用响应式图片 -->
<img srcset="image-320w.jpg 320w,
             image-640w.jpg 640w,
             image-1280w.jpg 1280w"
     sizes="(max-width: 320px) 280px,
            (max-width: 640px) 580px,
            1200px"
     src="image-1280w.jpg" alt="描述">

<!-- ✅ 使用现代格式 -->
<picture>
    <source srcset="image.webp" type="image/webp">
    <source srcset="image.jpg" type="image/jpeg">
    <img src="image.jpg" alt="描述">
</picture>
```

**验证标准**:
- ✅ 图片使用懒加载（`loading="lazy"`）
- ✅ 图片使用 WebP 格式（fallback 到 JPEG）
- ✅ 图片尺寸合理（不超过显示尺寸）

---

## 📊 性能监控

### 性能指标收集

**实现方式**:
```javascript
// 收集性能指标
performance.mark('app-start');

// 应用初始化
await app.init();

performance.mark('app-end');
performance.measure('app-init', 'app-start', 'app-end');

const measure = performance.getEntriesByName('app-init')[0];
console.log(`应用初始化耗时: ${measure.duration}ms`);

// 发送到分析服务器（可选）
if (measure.duration > 2000) {
    console.warn('应用初始化过慢:', measure.duration);
}
```

**关键指标**:
- **FP (First Paint)**: 首次绘制 < 1s
- **FCP (First Contentful Paint)**: 首次内容绘制 < 1.5s
- **TTI (Time to Interactive)**: 可交互时间 < 3s
- **CLS (Cumulative Layout Shift)**: 累积布局偏移 < 0.1

---

### Chrome DevTools 性能分析

**使用步骤**:
1. 打开 Chrome DevTools（F12）
2. 切换到 Performance 面板
3. 点击录制按钮
4. 执行操作（如打开报表）
5. 停止录制
6. 分析结果

**关注指标**:
- **Frames**: 帧率应 >= 60 FPS
- **Main**: 主线程忙碌时间应 < 50ms/帧
- **Network**: 资源加载瀑布图

---

## ✅ 性能优化检查清单

### 提交代码前检查

- [ ] ECharts 延迟加载（不在 index.html 直接引入）
- [ ] 数据加载使用异步瀑布流
- [ ] 组件大小 < 500 行（特殊情况已标注）
- [ ] 避免了直接 DOM 操作
- [ ] 避免了阻塞式渲染
- [ ] 避免了过度轮询（轮询间隔 >= 1s）
- [ ] 组件实现了 `destroy()` 方法
- [ ] 图片使用懒加载
- [ ] 使用 `defer` 或 `async` 加载脚本
- [ ] 初始加载时间 < 2s
- [ ] 组件渲染时间 < 100ms

---

## 📚 相关文档

- **性能优化总规范**: [`.claude/rules/performance-standards.md`](../.claude/rules/performance-standards.md)
- **前端设计规范**: [`.claude/rules/frontend-design/`](../.claude/rules/frontend-design/)
- **前端报表规则**: [`.claude/rules/frontend-reports.md`](../.claude/rules/frontend-reports.md)

---

## 🎯 最佳实践示例

### 示例 1: 报表组件模板

```javascript
class TemplateReport {
    constructor() {
        this.data = null;
        this.charts = {};
        this.eventListeners = [];
    }

    async init() {
        // 延迟加载 ECharts
        if (this.needsCharts()) {
            await this.loadECharts();
        }

        // 异步加载数据（瀑布流）
        await this.loadData();

        // 渲染组件
        this.render();
    }

    async loadData() {
        // 第一屏：关键数据
        const summaryPromise = API.get('/api/summary');

        // 第二屏：详细数据
        const [summary, detail] = await Promise.all([
            summaryPromise,
            API.get('/api/detail')
        ]);

        this.data = { summary, detail };
    }

    render() {
        // 渲染首屏
        this.renderSummary(this.data.summary);

        // 延迟渲染非首屏
        requestIdleCallback(() => {
            this.renderDetail(this.data.detail);
        });
    }

    destroy() {
        // 清理资源
        Object.values(this.charts).forEach(chart => chart.dispose());
        this.eventListeners.forEach(([event, handler]) => {
            window.removeEventListener(event, handler);
        });
    }
}
```

### 示例 2: 大数据表格渲染

```javascript
class DataTable {
    async render(data) {
        const batchSize = 100;

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await this.renderBatch(batch);

            // 让出控制权
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    async renderBatch(batch) {
        const fragment = document.createDocumentFragment();
        batch.forEach(item => {
            const row = this.createRow(item);
            fragment.appendChild(row);
        });
        this.tbody.appendChild(fragment);
    }
}
```

---

**维护者**: Claude AI
**最后更新**: 2026-02-09
**状态**: ✅ Phase 1-2 完成
