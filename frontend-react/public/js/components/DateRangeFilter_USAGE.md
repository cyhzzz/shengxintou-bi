# DateRangeFilter 使用指南

> **版本**: v1.0.0
> **更新时间**: 2026-01-22
> **组件类型**: 日期筛选器组件

---

## 功能说明

**DateRangeFilter** 是标准的日期筛选器组件，符合统一设计规范。

### 布局结构

```
┌─────────────────────────────────────────────────────────┐
│  日期范围:                                             │
│  ┌────────────┬────────────────────┬─────────────────┐ │
│  │ 日期选择器  │  快速选择按钮      │                 │ │
│  │            │                  │                 │ │
│  │ 开始日期    │ [全部] [近7天]    │                 │ │
│    至         │  [近30天] [今年以来]│                 │ │
│  │ 结束日期    │                  │                 │ │
│  └────────────┴────────────────────┴─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**布局说明**：
- **左侧**：日期自定义选择的时间区间（开始日期 - 结束日期）
- **右侧**：快速选择按钮（全部、近7天、近30天、今年以来）

---

## 快速开始

### 1. HTML 容器

在报表筛选器区域添加容器：

```html
<div class="card card--filter">
    <div class="card__body">
        <!-- 日期筛选器容器 -->
        <div id="dateRangeFilterContainer"></div>

        <!-- 其他筛选器... -->
    </div>
    <div class="card__footer">
        <button class="btn btn--secondary" id="resetBtn">重置</button>
        <button class="btn btn--primary" id="queryBtn">查询</button>
    </div>
</div>
```

### 2. 初始化组件

```javascript
class MyReport {
    async init() {
        // 创建日期筛选器
        this.dateFilter = new DateRangeFilter({
            containerId: 'dateRangeFilterContainer',
            startDateInputId: 'startDate',        // 可选，默认 'startDate'
            endDateInputId: 'endDate',            // 可选，默认 'endDate'
            defaultRange: 'all',                  // 可选：'all', 7, 30, 'ytd'，默认 'all'
            onChange: (dateRange) => {
                console.log('日期变化:', dateRange);
                // 日期变化回调（不自动触发查询）
                // 需要用户点击"查询"按钮才执行查询
            }
        });

        // 绑定查询按钮事件
        document.getElementById('queryBtn').addEventListener('click', () => {
            this.handleQuery();
        });

        // 绑定重置按钮事件
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.dateFilter.reset();
            this.handleQuery();
        });
    }

    handleQuery() {
        const dateRange = this.dateFilter.getDateRange();
        console.log('查询日期范围:', dateRange);

        // dateRange 格式：
        // {
        //   start: '2025-01-15',  // 开始日期（选择"全部"时为 null）
        //   end: '2025-01-22',    // 结束日期（选择"全部"时为 null）
        //   range: 'all'          // 范围类型：'all', 7, 30, 'ytd', 'custom'
        // }

        // 执行查询...
        this.loadData(dateRange);
    }

    async loadData(dateRange) {
        // 构建查询参数
        const params = {};

        // 只有当选择了具体日期范围时才传递日期参数
        if (dateRange.start && dateRange.end) {
            params.start_date = dateRange.start;
            params.end_date = dateRange.end;
        }
        // 如果选择"全部"，不传日期参数，后端返回所有数据

        // 执行 API 请求
        const response = await API.post('/api/v1/endpoint', params);
        // ...
    }
}
```

---

## 配置选项

### constructor(options)

| 参数 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `containerId` | String | **必需** | 容器元素的 ID |
| `startDateInputId` | String | `'startDate'` | 开始日期输入框的 ID |
| `endDateInputId` | String | `'endDate'` | 结束日期输入框的 ID |
| `defaultRange` | String\|Number | `'all'` | 默认日期范围：`'all'`, `7`, `30`, `'ytd'` |
| `onChange` | Function | `() => {}` | 日期变化回调函数 |

---

## API 方法

### getDateRange()

获取当前选择的日期范围。

**返回值**：
```javascript
{
    start: '2025-01-15',  // 开始日期（选择"全部"时为 null）
    end: '2025-01-22',    // 结束日期（选择"全部"时为 null）
    range: 'all'          // 范围类型
}
```

**range 类型说明**：
- `'all'`: 全部数据（日期为空）
- `7`: 近7天
- `30`: 近30天
- `'ytd'`: 今年以来
- `'custom'`: 自定义日期（用户手动修改日期输入框）

---

### setDateRange(days)

设置日期范围（近N天）。

**参数**：
- `days` (Number): 天数

**示例**：
```javascript
// 设置为近7天
this.dateFilter.setDateRange(7);
```

---

### setDateRangeYTD()

设置日期范围（今年以来）。

**示例**：
```javascript
// 设置为今年以来
this.dateFilter.setDateRangeYTD();
```

---

### reset()

重置为默认状态。

**示例**：
```javascript
// 重置日期筛选器
this.dateFilter.reset();
```

---

### destroy()

销毁组件，清理 DOM 和事件监听器。

**示例**：
```javascript
// 销毁日期筛选器
this.dateFilter.destroy();
```

---

## 使用场景

### 场景 1: 数据概览报表

```javascript
class DashboardReport {
    async init() {
        // 创建日期筛选器（默认"全部"）
        this.dateFilter = new DateRangeFilter({
            containerId: 'dateRangeFilterContainer',
            defaultRange: 'all',  // 默认显示所有数据
            onChange: (dateRange) => {
                // 不自动触发查询
            }
        });

        // 绑定查询按钮
        document.getElementById('queryBtn').addEventListener('click', () => {
            const dateRange = this.dateFilter.getDateRange();
            this.loadData(dateRange);
        });
    }

    async loadData(dateRange) {
        const params = { platforms: ['腾讯', '抖音'] };

        // 只有选择了具体日期才传递日期参数
        if (dateRange.start && dateRange.end) {
            params.start_date = dateRange.start;
            params.end_date = dateRange.end;
        }

        const data = await API.post('/api/v1/summary', params);
        // ...
    }
}
```

---

### 场景 2: 厂商分析报表

```javascript
class AgencyAnalysisReport {
    async init() {
        // 创建日期筛选器（默认"近30天"）
        this.dateFilter = new DateRangeFilter({
            containerId: 'agencyDateRangeFilter',
            defaultRange: 30,  // 默认近30天
            onChange: (dateRange) => {
                // 不自动触发查询
            }
        });

        // 创建平台筛选器
        this.platformFilter = new MultiSelectDropdown({
            // ...
        });

        // 创建代理商筛选器
        this.agencyFilter = new MultiSelectDropdown({
            // ...
        });

        // 绑定查询按钮
        document.getElementById('agencyQueryBtn').addEventListener('click', () => {
            this.handleQuery();
        });
    }

    handleQuery() {
        const dateRange = this.dateFilter.getDateRange();
        const platforms = this.platformFilter.getSelectedValues();
        const agencies = this.agencyFilter.getSelectedValues();

        const filters = {
            platforms: platforms,
            agencies: agencies
        };

        // 只有选择了具体日期才传递日期参数
        if (dateRange.start && dateRange.end) {
            filters.date_range = [dateRange.start, dateRange.end];
        }

        this.loadAgencyData(filters);
    }
}
```

---

### 场景 3: 线索明细报表

```javascript
class LeadsDetailReport {
    async init() {
        // 创建日期筛选器（默认"今年以来"）
        this.dateFilter = new DateRangeFilter({
            containerId: 'leadsDateRangeFilter',
            defaultRange: 'ytd',  // 默认今年以来
            onChange: (dateRange) => {
                // 不自动触发查询
            }
        });

        // 其他筛选器...
    }
}
```

---

## 样式规范

### 统一设计系统

DateRangeFilter 遵循以下设计规范：

**按钮样式**：
- 使用统一的 `.btn` 类
- 激活状态：`.is-active` 类
- 变体：`.btn--primary`, `.btn--secondary`, `.btn--outline`

**表单组件**：
- 使用统一的 `.form-control` 类
- 日期输入框宽度：140px
- 间距：8px

**布局**：
- 使用 flexbox 布局
- 左右分隔线：`border-right: 1px solid var(--border-color)`
- 分隔线间距：`padding-right: 16px`

**间距**：
- 筛选器组之间：8px
- 按钮组之间：8px
- 左右区域分隔：16px

---

## 注意事项

### 1. 日期筛选器行为

**重要**：DateRangeFilter 遵循以下设计原则：

1. **初始化不触发查询**：组件初始化时设置默认值，但不自动触发查询
2. **快速选择不触发查询**：点击快速选择按钮时，只更新日期输入框，不触发查询
3. **手动修改不触发查询**：用户手动修改日期输入框时，不触发查询
4. **查询按钮触发**：只有点击"查询"按钮时才执行查询

### 2. "全部"选项的处理

当用户选择"全部"时：
- 日期输入框被清空（`value = ''`）
- `getDateRange()` 返回 `{ start: null, end: null, range: 'all' }`
- 前端不传 `start_date` 和 `end_date` 参数
- 后端返回所有数据（不受日期限制）

### 3. 日期格式

- 组件内部使用：`YYYY-MM-DD` 格式（如 `2025-01-22`）
- `<input type="date">` 原生控件自动处理格式转换

### 4. 跨日期筛选

确保 `start` 日期不晚于 `end` 日期。如需验证，可在 `onChange` 回调中添加：

```javascript
onChange: (dateRange) => {
    if (dateRange.start && dateRange.end) {
        if (dateRange.start > dateRange.end) {
            // 显示错误提示
            showError('开始日期不能晚于结束日期');
            return;
        }
    }
}
```

---

## 完整示例

### HTML 结构

```html
<div id="mainContent">
    <!-- 筛选器卡片 -->
    <div class="card card--filter">
        <div class="card__body">
            <div class="filter-bar-content" style="
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                align-items: center;
            ">
                <!-- 日期筛选器 -->
                <div id="dateRangeFilterContainer"></div>

                <!-- 平台筛选器 -->
                <div id="platformFilterContainer"></div>

                <!-- 代理商筛选器 -->
                <div id="agencyFilterContainer"></div>
            </div>
        </div>
        <div class="card__footer">
            <button class="btn btn--secondary" id="resetBtn">重置</button>
            <button class="btn btn--primary" id="queryBtn">查询</button>
        </div>
    </div>

    <!-- 数据卡片 -->
    <div class="card">
        <div class="card__header">
            <h3 class="card__title">数据明细</h3>
        </div>
        <div class="card__body">
            <!-- 内容 -->
        </div>
    </div>
</div>
```

### JavaScript 实现

```javascript
class MyReport {
    constructor() {
        this.dateFilter = null;
        this.platformFilter = null;
        this.agencyFilter = null;
        this.currentData = null;

        this.init();
    }

    async init() {
        // 初始化筛选器
        this.initFilters();

        // 绑定事件
        this.bindEvents();

        // 加载初始数据（使用默认筛选条件）
        await this.loadData();
    }

    initFilters() {
        // 创建日期筛选器
        this.dateFilter = new DateRangeFilter({
            containerId: 'dateRangeFilterContainer',
            defaultRange: 30,  // 默认近30天
            onChange: () => {
                // 不自动触发查询
            }
        });

        // 创建平台筛选器
        this.platformFilter = new MultiSelectDropdown({
            id: 'platformFilter',
            label: '平台',
            placeholder: '全部平台',
            options: [],
            onChange: () => {
                // 不自动触发查询
            }
        });

        // 创建代理商筛选器
        this.agencyFilter = new MultiSelectDropdown({
            id: 'agencyFilter',
            label: '代理商',
            placeholder: '全部代理商',
            options: [],
            onChange: () => {
                // 不自动触发查询
            }
        });
    }

    bindEvents() {
        // 查询按钮
        document.getElementById('queryBtn').addEventListener('click', () => {
            this.loadData();
        });

        // 重置按钮
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.reset();
        });
    }

    async loadData() {
        try {
            // 显示加载状态
            this.showLoading();

            // 获取筛选条件
            const filters = this.getFilters();

            // 执行 API 请求
            const response = await API.post('/api/v1/data', filters);

            // 保存数据
            this.currentData = response.data;

            // 渲染数据
            this.render();

        } catch (error) {
            console.error('加载数据失败:', error);
            showError('加载数据失败，请重试');
        } finally {
            this.hideLoading();
        }
    }

    getFilters() {
        const dateRange = this.dateFilter.getDateRange();
        const platforms = this.platformFilter.getSelectedValues();
        const agencies = this.agencyFilter.getSelectedValues();

        const filters = {
            platforms: platforms,
            agencies: agencies
        };

        // 只有选择了具体日期才传递日期参数
        if (dateRange.start && dateRange.end) {
            filters.date_range = [dateRange.start, dateRange.end];
        }

        return filters;
    }

    reset() {
        // 重置日期筛选器
        this.dateFilter.reset();

        // 重置平台筛选器
        this.platformFilter.selectAll(true);

        // 重置代理商筛选器
        this.agencyFilter.selectAll(true);

        // 重新加载数据
        this.loadData();
    }

    render() {
        // 渲染数据...
    }

    destroy() {
        if (this.dateFilter) this.dateFilter.destroy();
        if (this.platformFilter) this.platformFilter.destroy();
        if (this.agencyFilter) this.agencyFilter.destroy();
    }
}

// 导出
window.MyReport = MyReport;
```

---

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**依赖**：
- 原生 `<input type="date">` 控件
- CSS Variables (用于主题颜色)
- ES6+ JavaScript (class, arrow functions, const/let)

---

## 更新日志

### v1.0.0 (2026-01-22)
- ✅ 创建标准日期筛选器组件
- ✅ 支持左侧日期选择 + 右侧快速选择布局
- ✅ 支持全部、近7天、近30天、今年以来
- ✅ 符合统一设计系统规范
- ✅ 支持自定义配置和事件回调

---

**文档版本**: v1.0.0
**最后更新**: 2026-01-22
