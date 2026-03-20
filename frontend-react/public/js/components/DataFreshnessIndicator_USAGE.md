# DataFreshnessIndicator 组件使用说明

## 概述

`DataFreshnessIndicator` 是一个数据新鲜度状态指示器组件，用于显示所有数据源的最新更新状态，并提示用户更新过期的数据。

## 功能特性

✅ **实时数据状态监控**: 显示 6 个数据源的最新更新日期和新鲜度状态
✅ **智能状态分级**: 根据数据新鲜度自动分级（正常/警告/严重）
✅ **折叠/展开交互**: 默认折叠，点击摘要行切换显示详情
✅ **自动展开提示**: 如果有严重状态，自动展开详情列表
✅ **快速操作**: 一键跳转到数据导入页面更新过期数据
✅ **自动刷新**: 每 5 分钟自动刷新状态（可配置）
✅ **响应式设计**: 支持桌面和移动端显示

## 安装

### 1. 引入 CSS 文件

在 `index.html` 的 `<head>` 中添加：

```html
<link rel="stylesheet" href="css/data-freshness-indicator.css">
```

### 2. 引入 JavaScript 文件

在 `index.html` 的 `</body>` 之前添加：

```html
<script src="js/components/DataFreshnessIndicator.js"></script>
```

## 基础用法

### 方式 1: 默认配置

```javascript
// 创建组件实例（使用默认配置）
const indicator = new DataFreshnessIndicator();

// 组件会自动：
// 1. 查找 id="data-freshness-indicator" 的容器
// 2. 加载数据并渲染
// 3. 启动自动刷新（5 分钟间隔）
```

在 HTML 中添加容器：

```html
<div id="data-freshness-indicator"></div>
```

### 方式 2: 自定义配置

```javascript
// 创建组件实例（自定义配置）
const indicator = new DataFreshnessIndicator({
    containerId: 'my-freshness-indicator',  // 自定义容器 ID
    refreshInterval: 10 * 60 * 1000,       // 10 分钟刷新一次
    onUpdateClick: () => {                 // 自定义更新按钮行为
        console.log('跳转到数据导入页面');
        window.location.hash = 'data-import';
    }
});
```

## 配置选项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `containerId` | string | `'data-freshness-indicator'` | 容器元素的 ID |
| `refreshInterval` | number | `300000` (5 分钟) | 自动刷新间隔（毫秒） |
| `onUpdateClick` | function | `null` | 点击"立即更新"按钮的回调函数 |

## 组件结构

```
data-freshness-indicator
├── freshness-summary (摘要行，可点击)
│   ├── freshness-icon (图标: 📊)
│   ├── freshness-text (文本: 数据状态: X 个数据源)
│   ├── freshness-warning (警告: (X 项建议更新))
│   ├── freshness-status-icon (状态图标: 🟢/🟡/🔴)
│   └── freshness-toggle (展开/折叠: ▼/▲)
│
└── freshness-details (详情列表，默认折叠)
    ├── freshness-list (数据项列表)
    │   └── freshness-item (单个数据项)
    │       ├── item-status (状态图标: ✅/⚠️/❌)
    │       ├── item-info (信息区)
    │       │   ├── item-name (数据源名称)
    │       │   └── item-date (最后更新日期)
    │       └── item-meta (元数据)
    │           ├── item-days-ago (X 天前)
    │           └── item-status-label (状态标签)
    │
    └── freshness-actions (操作按钮)
        ├── btnUpdateData (立即更新过期的数据)
        └── btnCloseDetails (关闭)
```

## 状态分级

| 状态 | 天数 | 图标 | 标签 | 颜色 | 说明 |
|------|------|------|------|------|------|
| `normal` | 0-3 天 | ✅ | 正常 | 绿色 | 数据新鲜 |
| `warning` | 4-7 天 | ⚠️ | 建议更新 | 黄色 | 数据略旧 |
| `critical` | 8+ 天 | ❌ | 急需更新 | 红色 | 数据严重过期 |

## 数据源列表

| 数据源 | 说明 |
|--------|------|
| `tencent_ads` | 腾讯广告 |
| `douyin_ads` | 抖音广告 |
| `xiaohongshu_ads` | 小红书广告 |
| `xhs_notes_daily` | 小红书笔记投放 |
| `xhs_notes_content_daily` | 小红书笔记运营 |
| `backend_conversions` | 后端转化数据 |

## API 接口

### 获取数据新鲜度状态

```
GET /api/v1/data-freshness
```

**响应格式**:

```json
{
  "success": true,
  "data": {
    "tencent_ads": {
      "name": "腾讯广告",
      "latest_date": "2026-01-30",
      "days_ago": 5,
      "status": "normal"
    },
    "douyin_ads": {
      "name": "抖音广告",
      "latest_date": "2026-01-25",
      "days_ago": 10,
      "status": "critical"
    },
    ...
  }
}
```

## 公共方法

### `refresh()`

手动刷新数据状态。

```javascript
await indicator.refresh();
```

### `expand()`

展开详情列表。

```javascript
indicator.expand();
```

### `collapse()`

折叠详情列表。

```javascript
indicator.collapse();
```

### `destroy()`

销毁组件实例，清理定时器和 DOM。

```javascript
indicator.destroy();
```

## 使用场景

### 场景 1: 在仪表盘页面显示

```javascript
// 在 DashboardReport.js 中
class DashboardReport {
    async init() {
        // 渲染其他内容...

        // 初始化数据新鲜度指示器
        this.freshnessIndicator = new DataFreshnessIndicator({
            containerId: 'dashboard-freshness',
            refreshInterval: 5 * 60 * 1000
        });
    }

    destroy() {
        if (this.freshnessIndicator) {
            this.freshnessIndicator.destroy();
        }
    }
}
```

在 HTML 中：

```html
<div id="dashboard-freshness"></div>
```

### 场景 2: 在所有页面顶部显示（全局）

在 `main.js` 中：

```javascript
// 全局初始化数据新鲜度指示器
const globalFreshnessIndicator = new DataFreshnessIndicator({
    containerId: 'global-freshness-indicator',
    onUpdateClick: () => {
        // 跳转到数据导入页面
        window.location.hash = 'data-import';
    }
});
```

在 `index.html` 的顶部栏中：

```html
<header class="topbar">
    <div class="topbar-left">...</div>
    <div class="topbar-right">
        <!-- 数据新鲜度指示器 -->
        <div id="global-freshness-indicator"></div>
        <!-- 其他按钮 -->
    </div>
</header>
```

### 场景 3: 配合主题切换

```javascript
class ThemedDashboard {
    init() {
        this.freshnessIndicator = new DataFreshnessIndicator({
            containerId: 'themed-freshness'
        });

        // 切换主题时刷新组件样式
        this.themeToggle = document.getElementById('themeToggle');
        this.themeToggle.addEventListener('click', () => {
            // 主题切换逻辑...
            // 重新渲染组件以应用新主题
            this.freshnessIndicator.refresh();
        });
    }
}
```

## 样式自定义

### CSS 变量

组件使用以下 CSS 变量，可以在全局或局部覆盖：

```css
:root {
    /* 组件容器 */
    --freshness-bg: #ffffff;
    --freshness-border: #e8e8e8;
    --freshness-border-radius: 8px;
    --freshness-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

    /* 状态颜色 */
    --status-normal: #52c41a;
    --status-warning: #faad14;
    --status-critical: #f5222d;
}
```

### BEM 命名规范

组件遵循 BEM 命名规范，可以精确控制样式：

```css
/* 修改摘要行样式 */
.freshness-summary {
    /* 自定义样式 */
}

/* 修改数据项样式 */
.freshness-item {
    /* 自定义样式 */
}

/* 修改警告状态样式 */
.freshness-item.status-warning {
    /* 自定义样式 */
}
```

## 注意事项

1. **容器 ID 必须唯一**: 确保页面上只有一个指定 ID 的容器
2. **API 接口必须可用**: 确保 `/api/v1/data-freshness` 接口正常工作
3. **定时器清理**: 在组件销毁时调用 `destroy()` 方法清理定时器
4. **响应式布局**: 组件已适配移动端，但建议在桌面端使用

## 浏览器兼容性

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 示例代码

完整示例请参考：

- **JavaScript**: `frontend/js/components/DataFreshnessIndicator.js`
- **CSS**: `frontend/css/data-freshness-indicator.css`
- **实施计划**: `docs/plans/2026-02-04-data-freshness-indicator.md`

## 更新日志

### v1.0.0 (2026-02-04)

- ✅ 初始版本
- ✅ 支持数据新鲜度状态显示
- ✅ 支持折叠/展开交互
- ✅ 支持自动刷新
- ✅ 支持快速跳转到数据导入页面

## 技术支持

如有问题，请联系开发团队。
