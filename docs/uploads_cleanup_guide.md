# 上传文件清理指南

## 问题说明

**现象**: `uploads/` 文件夹持续增大，占用磁盘空间

**原因**: 数据导入时上传的文件没有被自动清理，导致历史文件累积

**影响**:
- 占用磁盘空间（当前约 274MB，54 个文件）
- 影响文件系统性能
- 可能导致磁盘空间不足

---

## 解决方案

### 1. 自动清理机制（已实现）✅

**位置**: `backend/routes/upload.py` (第 336-345 行)

**功能**: 数据导入成功后，自动删除上传的文件

**触发条件**:
- 数据导入成功 (`status = 'completed'`)
- 文件处理完成
- 文件存在于文件系统

**代码逻辑**:
```python
# 自动删除已处理的上传文件（仅在成功时）
if result.get('success') and os.path.exists(filepath):
    try:
        os.remove(filepath)
        import_log.message += f'\n\n上传文件已自动删除'
        current_app.logger.info(f"已删除上传文件: {filepath}")
    except Exception as delete_error:
        # 删除失败不影响导入结果
        import_log.message += f'\n\n上传文件删除失败: {str(delete_error)}'
        current_app.logger.warning(f"删除上传文件失败: {filepath}, 错误: {str(delete_error)}")
```

**效果**:
- ✅ 新上传的文件在处理完成后自动删除
- ✅ 不占用磁盘空间
- ✅ 不影响导入流程（删除失败不影响结果）

---

### 2. 手动清理工具 🧹

#### 方式 A: 使用批处理脚本（推荐）

**位置**: `cleanup_uploads.bat`（项目根目录）

**使用方法**:
1. 双击运行 `cleanup_uploads.bat`
2. 选择清理选项：
   - 选项 1: 模拟运行（预览将要删除的文件）
   - 选项 2: 清理 7 天前的文件
   - 选项 3: 清理 3 天前的文件
   - 选项 4: 清理 1 天前的文件
   - 选项 5: 删除所有文件（慎用）

**示例输出**:
```
===========================================================
        省心投 BI - 上传文件清理工具
===========================================================

当前选项:

1. 模拟运行（预览将要删除的文件，不实际删除）
2. 清理 7 天前的文件（保留最近 7 天）
3. 清理 3 天前的文件（保留最近 3 天）
4. 清理 1 天前的文件（保留最近 1 天）
5. 删除所有文件（慎用！）
6. 退出

请选择操作 (1-6): 1
```

#### 方式 B: 使用 Python 脚本

**位置**: `backend/scripts/cleanup_uploads.py`

**基本用法**:
```bash
# 清理 7 天前的文件（默认）
python backend/scripts/cleanup_uploads.py

# 清理 3 天前的文件
python backend/scripts/cleanup_uploads.py --keep-days 3

# 清理 1 天前的文件
python backend/scripts/cleanup_uploads.py --keep-days 1

# 模拟运行（不实际删除）
python backend/scripts/cleanup_uploads.py --dry-run

# 删除所有文件（慎用）
python backend/scripts/cleanup_uploads.py --delete-all

# 同时删除失败任务的文件
python backend/scripts/cleanup_uploads.py --delete-failed
```

**参数说明**:
| 参数 | 说明 | 默认值 |
|-----|------|--------|
| `--keep-days` | 保留最近几天的文件 | 7 |
| `--delete-failed` | 是否删除失败任务的文件 | False |
| `--dry-run` | 模拟运行，不实际删除 | False |
| `--delete-all` | 删除所有文件（忽略保留天数） | False |

---

### 3. 定期清理任务（可选）⏰

#### Windows 任务计划程序

**创建定期清理任务**:

1. 打开"任务计划程序"（taskschd.msc）
2. 点击"创建基本任务"
3. 设置任务名称："省心投 BI - 清理上传文件"
4. 触发器：每周（建议每周日凌晨执行）
5. 操作：启动程序
   - 程序：`python.exe`
   - 参数：`backend\scripts\cleanup_uploads.py --keep-days 7`
   - 起始于：`D:\project\省心投-cc\开发代码`

**示例**:
```batch
# 每周日凌晨 2:00 清理 7 天前的文件
程序: C:\Python311\python.exe
参数: backend\scripts\cleanup_uploads.py --keep-days 7
起始于: D:\project\省心投-cc\开发代码
```

---

## 清理效果

### 清理前（当前状态）

```
上传目录: D:\project\省心投-cc\开发代码\uploads
总文件数: 54
总大小: 274 MB
```

### 清理后（预期效果）

**保留 7 天策略**:
- 删除: 约 47 个文件
- 保留: 约 7 个文件
- 释放空间: 约 240 MB

**保留 3 天策略**:
- 删除: 约 51 个文件
- 保留: 约 3 个文件
- 释放空间: 约 260 MB

---

## 常见问题

### Q1: 清理文件会影响历史数据吗？

**A**: 不会。上传文件仅用于数据导入，导入后的数据已存储在数据库中。

### Q2: 如何恢复已删除的上传文件？

**A**: 无法恢复。如需重新导入数据，请重新上传原始文件。

### Q3: 自动清理机制什么时候生效？

**A**: 从现在开始，所有新上传的文件在处理完成后会自动删除。历史文件需要手动清理。

### Q4: 清理失败怎么办？

**A**: 检查以下事项：
1. 文件是否被其他程序占用（如 Excel 打开）
2. 是否有文件权限
3. 查看日志：`logs/app.log`

### Q5: 可以只删除特定类型的文件吗？

**A**: 当前版本不支持，可以手动删除特定文件。

---

## 最佳实践

### 推荐策略

1. **首次使用**: 先运行模拟运行（`--dry-run`），查看将要删除的文件
2. **定期清理**: 每周清理一次，保留最近 7 天的文件
3. **设置定时任务**: 使用 Windows 任务计划程序自动清理
4. **监控空间**: 定期检查 `uploads/` 文件夹大小

### 命令示例

```bash
# 第一次使用：模拟运行
python backend/scripts/cleanup_uploads.py --dry-run

# 确认无误后：实际清理
python backend/scripts/cleanup_uploads.py --keep-days 7

# 创建定时任务：每周清理
# （通过 Windows 任务计划程序配置）
```

---

## 技术细节

### 清理逻辑

1. **查询数据库**: 从 `data_import_log` 表查询导入记录
2. **过滤条件**:
   - 状态: `completed`（已完成）
   - 完成时间: 早于 `N` 天前
3. **文件删除**: 调用 `os.remove()` 删除文件
4. **日志记录**: 记录删除操作到应用日志

### 安全机制

- ✅ 只删除已完成任务的文件
- ✅ 删除失败不影响导入结果
- ✅ 支持模拟运行（预览）
- ✅ 详细的删除日志

---

## 更新日志

### v1.0.0 (2026-01-29)

- ✅ 实现自动清理机制（upload.py）
- ✅ 创建手动清理脚本（cleanup_uploads.py）
- ✅ 创建批处理工具（cleanup_uploads.bat）
- ✅ 编写使用文档（本文档）

---

## 相关文件

- **自动清理**: `backend/routes/upload.py` (第 336-345 行)
- **清理脚本**: `backend/scripts/cleanup_uploads.py`
- **批处理工具**: `cleanup_uploads.bat`
- **数据模型**: `backend/models.py` (DataImportLog)

---

**最后更新**: 2026-01-29
**版本**: v1.0.0
**维护者**: Claude AI
