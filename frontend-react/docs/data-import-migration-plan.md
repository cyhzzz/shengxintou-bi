# 数据导入页面迁移计划

## 背景
新前端的数据导入页面需要更好地遵循旧版设计：
1. 数据类型选择应为卡片网格，每个卡片角标有 `?` 图标，点击打开对应 markdown 指南
2. 覆盖模式默认应为开启（覆盖更新而非跳过）
3. 导入指南应以弹窗形式展示 markdown 内容

## 任务列表

### 任务 1: 重构 DataTypeSelector 组件
**目标**: 将单选列表改为卡片网格布局，每个卡片带角标指南图标

**步骤**:
1. 修改组件结构：从 Radio.Group 改为网格卡片布局
2. 为每个卡片添加角标 `?` 按钮（position: absolute）
3. 添加 `onGuideClick` 回调属性，点击角标时触发
4. 添加卡片选中状态样式（边框高亮、背景色变化）
5. 添加悬停效果

**验证**:
- 可视化检查：卡片网格布局正确
- 点击卡片选择数据类型正常
- 点击角标不触发卡片选择
- 角标悬停有高亮效果

### 任务 2: 创建 GuideModal 组件
**目标**: 创建一个可复用的 markdown 渲染弹窗

**步骤**:
1. 创建 `src/components/GuideModal/index.tsx`
2. 使用 Ant Design Modal 组件
3. 使用 react-markdown 渲染 markdown 内容
4. 添加加载状态和错误处理
5. 添加必要的 markdown 样式

**验证**:
- 弹窗正确显示标题
- markdown 内容正确渲染
- 加载状态正确显示
- 错误状态正确处理

### 任务 3: 添加指南文件映射
**目标**: 建立数据类型到指南文件的映射关系

**步骤**:
1. 在 `src/types/api.schemas.ts` 或组件中添加映射
2. 映射关系：
   - tencent_ads → tencent_ads_guide.md
   - douyin_ads → douyin_ads_guide.md
   - xiaohongshu_ads → xiaohongshu_ads_guide.md
   - xhs_notes_list → xhs_notes_list_guide.md
   - xhs_notes_daily → xhs_notes_daily_guide.md
   - xhs_notes_content → xhs_notes_content_guide.md
   - conversion → backend_conversion_guide.md

**验证**:
- 每种数据类型都有对应的指南文件
- 文件路径正确

### 任务 4: 更新 FileUploader 组件
**目标**: 将覆盖模式默认值改为 true，调整说明文字

**步骤**:
1. 将 `overwrite` state 默认值从 `false` 改为 `true`
2. 调整说明文字：`开启后同一天数据会覆盖更新` 或类似表述
3. 可选：改用 Checkbox 替代 Switch，更符合旧版设计

**验证**:
- 默认状态为开启
- 说明文字准确

### 任务 5: 更新 DataImport 页面布局
**目标**: 调整页面布局以匹配旧版风格

**步骤**:
1. 移除左侧单独的"导入指南"卡片（Collapse 组件）
2. 整合 DataTypeSelector 和 GuideModal
3. 调整两列布局比例

**验证**:
- 页面布局清晰
- 指南通过角标弹窗访问
- 响应式布局正常

## 文件清单

### 新建文件
- `src/components/GuideModal/index.tsx` - Markdown 指南弹窗组件
- `src/components/GuideModal/index.module.scss` - 弹窗样式

### 修改文件
- `src/pages/System/DataImport/index.tsx` - 页面主组件
- `src/pages/System/DataImport/components/DataTypeSelector.tsx` - 数据类型选择器
- `src/pages/System/DataImport/components/DataTypeSelector.module.scss` - 选择器样式
- `src/pages/System/DataImport/components/FileUploader.tsx` - 文件上传组件
- `src/components/index.ts` - 导出 GuideModal

## 设计参考
- 旧版文件：`frontend/js/components/DataImport.js`
- 关键元素：
  - `.type-grid` - 卡片网格布局
  - `.doc-btn` - 角标按钮（圆形，带 `?` 符号）
  - `overwriteMode` - 覆盖模式复选框（默认选中）