# 前端样式迁移示例

> 展示如何从旧样式迁移到新的设计系统

---

## 目录

1. [按钮迁移](#按钮迁移)
2. [卡片迁移](#卡片迁移)
3. [状态迁移](#状态迁移)
4. [完整组件迁移](#完整组件迁移)

---

## 按钮迁移

### 示例 1: 基础按钮

**旧代码**:
```html
<button class="button">点击我</button>
<button class="button active">激活状态</button>
```

**新代码**:
```html
<button class="btn">点击我</button>
<button class="btn is-active">激活状态</button>
```

**变化说明**:
- `.button` → `.btn`
- `active` → `is-active` (使用状态修饰符)

---

### 示例 2: 日期快速选择按钮组

**旧代码**:
```html
<div class="date-quick-btn-group">
    <button class="date-quick-btn active">近7天</button>
    <button class="date-quick-btn">近30天</button>
    <button class="date-quick-btn">近90天</button>
</div>
```

**新代码**:
```html
<div class="btn-group">
    <button class="btn is-active">近7天</button>
    <button class="btn">近30天</button>
    <button class="btn">近90天</button>
</div>
```

**变化说明**:
- `.date-quick-btn-group` → `.btn-group`
- `.date-quick-btn` → `.btn`
- `active` → `is-active`

---

### 示例 3: 操作按钮（主要/次要）

**旧代码**:
```html
<button class="btn-primary">确认</button>
<button class="btn-secondary">取消</button>
<button class="btn-outline">导出</button>
```

**新代码**:
```html
<button class="btn btn--primary">确认</button>
<button class="btn btn--secondary">取消</button>
<button class="btn btn--outline">导出</button>
```

**变化说明**:
- 旧样式: 单独的类名（`.btn-primary`）
- 新样式: 基础类 + 变体修饰符（`.btn.btn--primary`）
- 保持 BEM 命名规范的一致性

---

### 示例 4: 不同尺寸的按钮

**旧代码**:
```html
<button class="btn-small">小按钮</button>
<button class="button">默认按钮</button>
<button class="btn-large">大按钮</button>
```

**新代码**:
```html
<button class="btn btn--sm">小按钮</button>
<button class="btn">默认按钮</button>
<button class="btn btn--lg">大按钮</button>
```

**变化说明**:
- `.btn-small` → `.btn.btn--sm`
- `.btn-large` → `.btn.btn--lg`
- 统一使用 `--` 作为尺寸修饰符前缀

---

## 卡片迁移

### 示例 1: 基础卡片

**旧代码**:
```html
<div class="section-card">
    <h3 class="section-title">标题</h3>
    <div class="section-body">
        内容...
    </div>
</div>
```

**新代码**:
```html
<div class="card">
    <div class="card__header">
        <h3 class="card__title">标题</h3>
    </div>
    <div class="card__body">
        内容...
    </div>
</div>
```

**变化说明**:
- `.section-card` → `.card`
- `.section-title` → `.card__title` (BEM Element)
- `.section-body` → `.card__body` (BEM Element)
- 添加 `.card__header` 结构层

---

### 示例 2: 筛选器卡片

**旧代码**:
```html
<div class="filter-card">
    <div class="filter-body">
        <div class="date-quick-btn-group">
            <button class="date-quick-btn active">近7天</button>
            <button class="date-quick-btn">近30天</button>
        </div>
    </div>
    <div class="filter-actions">
        <button class="btn-secondary">重置</button>
        <button class="btn-primary">查询</button>
    </div>
</div>
```

**新代码**:
```html
<div class="card card--filter">
    <div class="card__body">
        <div class="btn-group">
            <button class="btn is-active">近7天</button>
            <button class="btn">近30天</button>
        </div>
    </div>
    <div class="card__footer">
        <button class="btn btn--secondary">重置</button>
        <button class="btn btn--primary">查询</button>
    </div>
</div>
```

**变化说明**:
- `.filter-card` → `.card.card--filter`
- `.filter-body` → `.card__body`
- `.filter-actions` → `.card__footer`
- 统一按钮样式

---

### 示例 3: 图表卡片

**旧代码**:
```html
<div class="chart-card">
    <div class="chart-header">
        <h3 class="chart-title">花费趋势</h3>
        <div class="chart-actions">
            <button class="icon-btn">刷新</button>
        </div>
    </div>
    <div class="chart-body">
        <div id="chart" style="width: 100%; height: 300px;"></div>
    </div>
</div>
```

**新代码**:
```html
<div class="card card--chart">
    <div class="card__header">
        <h3 class="card__title">花费趋势</h3>
        <div class="card__actions">
            <button class="btn btn--sm btn--ghost">刷新</button>
        </div>
    </div>
    <div class="card__body">
        <div id="chart" style="width: 100%; height: 300px;"></div>
    </div>
</div>
```

**变化说明**:
- `.chart-card` → `.card.card--chart`
- `.chart-*` → `.card__*` (统一命名)
- `.icon-btn` → `.btn.btn--sm.btn--ghost`

---

### 示例 4: 指标卡片

**旧代码**:
```html
<div class="metric-card">
    <h4 class="metric-label">总花费</h4>
    <p class="metric-value">¥1,234,567</p>
    <p class="metric-trend up">↑ 12.5%</p>
</div>
```

**新代码**:
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

**变化说明**:
- `.metric-card` → `.card.card--metric`
- 使用状态修饰符 `.is-primary`, `.is-success` 代替自定义类
- 更灵活的样式定制

---

## 状态迁移

### 示例 1: 激活状态

**旧代码**:
```html
<!-- 方式1: 使用 active 类 -->
<button class="button active">按钮</button>

<!-- 方式2: 使用自定义激活类 -->
<div class="tab-item active-item">标签</div>
```

**新代码**:
```html
<!-- 统一使用 is-active -->
<button class="btn is-active">按钮</button>
<div class="tab-item is-active">标签</div>
```

**变化说明**:
- 统一使用 `.is-active` 状态修饰符
- 可应用于任何组件

---

### 示例 2: 禁用状态

**旧代码**:
```html
<!-- 方式1: 使用 disabled 属性 -->
<button class="button" disabled>按钮</button>

<!-- 方式2: 使用自定义禁用类 -->
<div class="item disabled">禁用项</div>
```

**新代码**:
```html
<!-- 统一使用 is-disabled -->
<button class="btn is-disabled">按钮</button>
<div class="item is-disabled">禁用项</div>
```

**变化说明**:
- 统一使用 `.is-disabled` 状态修饰符
- 50% 透明度 + 禁止交互

---

### 示例 3: 颜色状态

**旧代码**:
```html
<p class="text-primary">主要文字</p>
<p class="text-success">成功文字</p>
<p class="text-warning">警告文字</p>
<p class="text-error">错误文字</p>

<div class="bg-primary">蓝色背景</div>
<div class="border-success">绿色边框</div>
```

**新代码**:
```html
<p class="is-primary">主要文字</p>
<p class="is-success">成功文字</p>
<p class="is-warning">警告文字</p>
<p class="is-error">错误文字</p>

<div class="has-primary-bg">蓝色背景</div>
<div class="has-success-border">绿色边框</div>
```

**变化说明**:
- 文字颜色: `.is-{color}`
- 背景颜色: `.has-{color}-bg`
- 边框颜色: `.has-{color}-border`
- 语义化命名规范

---

## 完整组件迁移

### ConfigManagement 组件迁移

#### 迁移前 (旧样式):

```html
<!-- 分类筛选 -->
<div class="section-card">
    <div class="category-filter">
        <button class="category-btn active" data-category="all">
            <span class="category-icon">⚙️</span>
            <span>全部配置</span>
        </button>
        <button class="category-btn" data-category="general">
            <span class="category-icon">🔧</span>
            <span>通用设置</span>
        </button>
    </div>
</div>

<!-- 配置列表 -->
<div class="section-card">
    <div class="section-header">
        <h3 class="section-title">配置列表</h3>
        <button id="addConfigBtn" class="btn btn-primary">
            <i class="icon-plus"></i>
            添加配置
        </button>
    </div>
    <div id="configList" class="config-list">
        <!-- 配置项 -->
    </div>
</div>
```

**JavaScript 事件处理**:
```javascript
// 更新按钮状态
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
});
```

---

#### 迁移后 (新样式):

```html
<!-- 分类筛选 -->
<div class="card card--filter">
    <div class="btn-group">
        <button class="btn is-active" data-category="all">
            <span>⚙️ 全部配置</span>
        </button>
        <button class="btn" data-category="general">
            <span>🔧 通用设置</span>
        </button>
    </div>
</div>

<!-- 配置列表 -->
<div class="card">
    <div class="card__header">
        <h3 class="card__title">配置列表</h3>
        <div class="card__actions">
            <button id="addConfigBtn" class="btn btn--primary btn--sm">
                + 添加配置
            </button>
        </div>
    </div>
    <div id="configList" class="card__body">
        <!-- 配置项 -->
    </div>
</div>
```

**JavaScript 事件处理**:
```javascript
// 更新按钮状态
document.querySelectorAll('.btn[data-category]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.category === category);
});
```

---

#### 迁移要点总结:

1. **卡片结构**:
   - `.section-card` → `.card` / `.card.card--filter`
   - `.section-header` → `.card__header`
   - `.section-title` → `.card__title`
   - 添加 `.card__actions` 容器

2. **按钮样式**:
   - `.category-btn` → `.btn`
   - `.category-filter` → `.btn-group`
   - `active` → `is-active`

3. **JavaScript 选择器**:
   - `.category-btn` → `.btn[data-category]`
   - `active` → `is-active`

4. **视觉改进**:
   - 减少不必要的嵌套 (`.category-icon`)
   - 统一按钮间距和对齐
   - 清晰的 BEM 结构

---

## 迁移检查清单

在完成样式迁移后,请检查以下项目:

### 视觉检查
- [ ] 按钮悬停效果正常 (蓝色边框 + 蓝色文字)
- [ ] 按钮激活状态正常 (蓝色背景 + 白色文字)
- [ ] 按钮禁用状态正常 (50% 透明度)
- [ ] 卡片边框和间距一致
- [ ] 卡片悬停效果正常 (如有交互)

### 功能检查
- [ ] 所有按钮点击事件正常触发
- [ ] 状态切换 (激活/禁用) 正常
- [ ] 表单提交功能正常
- [ ] 弹窗/对话框显示正常

### 代码检查
- [ ] 移除了所有旧样式类名引用
- [ ] JavaScript 选择器已更新
- [ ] CSS 文件中无冗余旧样式
- [ ] 遵循 BEM 命名规范

### 兼容性检查
- [ ] Chrome 浏览器显示正常
- [ ] Firefox 浏览器显示正常
- [ ] Safari 浏览器显示正常 (如有 Mac)
- [ ] 移动端响应式正常 (如有需要)

---

## 迁移最佳实践

### 1. 渐进式迁移

不要一次性修改所有文件,建议按以下顺序:

1. **第一阶段**: 统一按钮样式
   - 替换所有 `.button`, `.date-btn` 等 → `.btn`
   - 更新激活状态 `active` → `is-active`

2. **第二阶段**: 统一卡片样式
   - 替换 `.section-card`, `.filter-card` 等 → `.card`
   - 添加 BEM 结构 (`.card__header`, `.card__body`)

3. **第三阶段**: 清理旧样式
   - 移除未使用的旧 CSS 类
   - 更新 JavaScript 选择器
   - 测试所有功能

### 2. 保留向后兼容

在迁移过程中,可以保留旧样式类名的别名:

```css
/* 临时保留旧类名 */
.button {
    /* 继承新样式 */
    @extend .btn;
}
```

待所有组件迁移完成后,再统一删除。

### 3. 使用代码搜索

使用编辑器的全局搜索功能,快速定位需要修改的位置:

```
搜索: class="button"
替换: class="btn"

搜索: class="active"
替换: class="is-active"
```

**注意**: 需要人工审核每个替换,避免误操作。

### 4. 分支测试

在 Git 分支上进行迁移:

```bash
# 创建迁移分支
git checkout -b feature/design-system-migration

# 完成迁移后
git add .
git commit -m "迁移到新设计系统"

# 测试无误后合并
git checkout master
git merge feature/design-system-migration
```

---

## 常见问题

### Q: 旧样式类名会被立即删除吗?

**A**: 不会。为了平滑过渡,旧样式类名会保留一段时间,直到所有组件完成迁移。

### Q: 迁移过程中可以使用新旧样式混用吗?

**A**: 可以,但不建议。混用会导致样式不一致,应尽快完成整个组件的迁移。

### Q: 如果新样式不满足需求怎么办?

**A**: 可以在统一样式基础上添加自定义样式:

```html
<!-- 基础样式 + 自定义 -->
<button class="btn is-active" style="width: 200px;">
    自定义宽度按钮
</button>
```

或添加新的变体修饰符 (`.btn--custom`)

### Q: 如何确保迁移没有破坏功能?

**A**:
1. 迁移前进行完整测试
2. 在迁移分支上工作
3. 逐个组件迁移并测试
4. 使用 Git 对比查看变化

---

## 下一步

完成 ConfigManagement 组件的迁移后,可以继续迁移以下组件:

1. **优先级高**:
   - [ ] DataImport.js (数据导入)
   - [ ] AccountManagementReport.js (账号管理)
   - [ ] DashboardReport.js (数据概览)

2. **优先级中**:
   - [ ] AgencyAnalysisReport.js (厂商分析)
   - [ ] LeadsDetailReport.js (线索明细)
   - [ ] ConversionFunnelReport.js (转化漏斗)

3. **优先级低**:
   - [ ] XhsNotesOperationReport.js (运营分析)
   - [ ] XhsNotesCreationReport.js (创作分析)

---

**更新时间**: 2026-01-16
**版本**: v1.0.0
