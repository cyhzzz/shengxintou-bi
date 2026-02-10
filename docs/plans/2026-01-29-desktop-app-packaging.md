# 省心投 BI 桌面应用打包计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个独立的桌面应用程序（.exe），双击启动后打开嵌入式浏览器窗口运行前端界面，关闭时自动关闭服务端和前端。

**Architecture:**
- 使用 pywebview 创建嵌入式浏览器窗口
- Flask 后端服务器在后台线程运行
- PyInstaller 打包为单个可执行文件
- 修复 Python 3.13 兼容性问题

**Tech Stack:**
- Python 3.11（降级以解决 PyInstaller 兼容性）
- pywebview 4.0+（嵌入式浏览器）
- Flask 3.x（后端API）
- PyInstaller 6.x（打包工具）

---

## 问题分析

### 当前问题
1. ❌ Python 3.13.5 太新，PyInstaller 6.18.0 无法正确打包
2. ❌ `requirements.txt` 缺少 `pywebview` 依赖
3. ❌ 打包后的 exe 无法加载 Python DLL

### 解决方案
1. ✅ 降级到 Python 3.11（PyInstaller 完全支持）
2. ✅ 添加 pywebview 到 requirements.txt
3. ✅ 创建优化的 PyInstaller 配置
4. ✅ 添加依赖清理，减小包体积

---

## Task 1: 降级 Python 版本

**问题**: Python 3.13 不被 PyInstaller 6.18 完全支持

**解决方案**: 降级到 Python 3.11.9（稳定版本）

**Step 1: 安装 Python 3.11.9**

下载并安装 Python 3.11.9:
- 下载地址: https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
- 安装时勾选 "Add Python to PATH"
- 安装到: `C:\Python311`

**Step 2: 验证安装**

```bash
# 打开新的命令行窗口
python --version
# 预期输出: Python 3.11.9
```

**Step 3: 创建虚拟环境**

```bash
cd "D:\project\省心投-cc\开发代码"
# 使用 Python 3.11 创建虚拟环境
C:\Python311\python.exe -m venv venv311

# 激活虚拟环境
venv311\Scripts\activate
```

---

## Task 2: 更新依赖配置

**文件**:
- Modify: `requirements.txt`

**Step 1: 添加 pywebview 依赖**

在 `requirements.txt` 末尾添加:

```txt
# Desktop Application (新增)
pywebview>=4.0.0
```

**Step 2: 安装依赖**

```bash
# 确保虚拟环境已激活
pip install --upgrade pip

# 安装所有依赖
pip install -r requirements.txt

# 安装 PyInstaller
pip install pyinstaller==6.3.0
```

**Step 3: 验证 pywebview 安装**

```bash
python -c "import webview; print(webview.__version__)"
# 预期输出: 4.x.x
```

---

## Task 3: 优化应用启动逻辑

**文件**:
- Modify: `app.py:32-45`

**Step 1: 修改 pywebview 检测逻辑**

当前代码在 `app.py:32-45`，修改为:

```python
# 尝试导入 pywebview（打包时使用）
# 开发模式下可通过设置环境变量 DEV_MODE=1 禁用 pywebview
DEV_MODE = os.environ.get('DEV_MODE', '0') == '1'

try:
    import webview
    USE_WEBVIEW = True
    if DEV_MODE:
        logger.info("开发模式（DEV_MODE=1）：使用标准Flask服务器模式")
        USE_WEBVIEW = False
    else:
        logger.info("检测到 pywebview，将使用嵌入式浏览器模式")
except ImportError:
    USE_WEBVIEW = False
    logger.info("未检测到 pywebview，将使用标准Flask服务器模式")
    if not DEV_MODE:
        logger.warning("建议安装 pywebview 以获得更好的桌面应用体验")
```

**Step 2: 添加优雅关闭处理**

在 `app.py:150-159` 修改 `run_flask_server` 函数:

```python
def run_flask_server():
    """在后台线程运行Flask服务器"""
    # 设置 shutdown_event 以支持优雅关闭
    import shutdown
    shutdown.init(app)

    app.run(
        host=HOST,
        port=PORT,
        debug=False,  # 后台运行时禁用debug模式
        use_reloader=False  # 禁用自动重载
    )
```

**Step 3: 创建 shutdown.py 工具模块**

**Create:** `shutdown.py`

```python
"""Flask 优雅关闭工具"""
import os
import threading

shutdown_event = threading.Event()

def init(app):
    """初始化关闭处理"""
    global shutdown_event

    @app.route('/api/shutdown', methods=['POST'])
    def shutdown_server():
        """关闭服务器"""
        shutdown_event.set()
        return jsonify({'status': 'shutting_down'})

    return shutdown_event
```

---

## Task 4: 创建优化的 PyInstaller 配置

**文件**:
- Create: `build_desktop.spec`

**Step 1: 创建桌面应用打包配置**

```python
# -*- mode: python ; coding: utf-8 -*-
"""
省心投 BI 桌面应用打包配置
使用 Python 3.11 + PyInstaller 6.3
"""

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None
base_dir = os.path.dirname(os.path.abspath(SPEC))

# ============================================================
# 数据文件收集
# ============================================================
datas = [
    ('frontend', 'frontend'),      # 前端文件
    ('config.py', '.'),            # 配置文件
    ('init_db.py', '.'),           # 数据库初始化
    ('requirements.txt', '.'),      # 依赖列表
]

# 收集第三方库的数据文件
datas += collect_data_files('pandas')
datas += collect_data_files('openpyxl')
datas += collect_data_files('pywebview')

# ============================================================
# 隐藏导入
# ============================================================
hiddenimports = [
    # Flask 核心
    'flask', 'flask_cors', 'flask_sqlalchemy', 'werkzeug',
    'jinja2', 'jinja2.ext', 'markupsafe', 'itsdangerous',

    # SQLAlchemy
    'sqlalchemy', 'sqlalchemy.dialects', 'sqlalchemy.dialects.sqlite',
    'sqlalchemy.engine', 'sqlalchemy.pool', 'sqlalchemy.orm',

    # 数据处理
    'pandas', 'pandas._libs', 'pandas._libs.tslibs',
    'numpy', 'numpy.core', 'openpyxl', 'xlrd',

    # pywebview 及其依赖
    'webview', 'pywebview',
    'pywebview.cocoa', 'pywebview.edgechromium',
    'pywebview.gtk', 'pywebview.qt', 'pywebview.winforms',
    'bottle',  # pywebview 依赖的轻量级 web 框架

    # 后端模块
    'backend', 'backend.database', 'backend.models',
    'backend.routes', 'backend.routes.metadata',
    'backend.routes.data', 'backend.routes.upload',
    'backend.routes.config', 'backend.routes.aggregation',

    # 工具库
    'webdavclient3', 'requests', 'urllib3',
    'python_dateutil', 'dateutil', 'colorlog',
]

# ============================================================
# 排除不需要的模块（减小体积）
# ============================================================
excludes = [
    # 科学计算（不需要）
    'matplotlib', 'scipy', 'sklearn',
    'PIL', 'Pillow',

    # GUI框架（不需要，用 pywebview）
    'tkinter', 'wx', 'PyQt5', 'PyQt6',
    'PySide2', 'PySide6',

    # 开发工具（不需要）
    'pytest', 'unittest', 'test',
    'IPython', 'jupyter', 'notebook',

    # 深度学习（不需要）
    'torch', 'tensorflow', 'onnxruntime',
    'skimage', 'nltk', 'transformers',
]

# ============================================================
# PyInstaller 分析配置
# ============================================================
a = Analysis(
    ['app.py'],
    pathex=[base_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# ============================================================
# 打包构建（单文件模式）
# ============================================================
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='省心投BI',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # 不显示控制台窗口
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # TODO: 添加图标文件
)
```

**Step 2: 创建打包脚本**

**Create:** `build_desktop.bat`

```batch
@echo off
echo =====================================
echo 省心投 BI 桌面应用打包脚本
echo =====================================
echo.

REM 检查 Python 版本
python --version | findstr "3.11" >nul
if errorlevel 1 (
    echo 错误: 需要 Python 3.11
    echo 当前版本:
    python --version
    pause
    exit /b 1
)

echo [1/5] 检查依赖...
pip show pywebview >nul 2>&1
if errorlevel 1 (
    echo 错误: pywebview 未安装
    echo 正在安装依赖...
    pip install -r requirements.txt
    pip install pyinstaller==6.3.0
)

echo [2/5] 清理旧文件...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo [3/5] 开始打包...
python -m PyInstaller build_desktop.spec --clean --noconfirm

if errorlevel 1 (
    echo.
    echo 错误: 打包失败
    pause
    exit /b 1
)

echo [4/5] 验证输出...
if exist dist\省心投BI.exe (
    echo.
    echo =====================================
    echo 打包成功!
    echo 输出文件: dist\省心投BI.exe
    echo 文件大小:
    dir dist\省心投BI.exe | find "省心投BI.exe"
    echo =====================================
) else (
    echo 错误: 未找到输出文件
    pause
    exit /b 1
)

echo [5/5] 复制到版本输出文件夹...
if not exist "..\版本输出" mkdir "..\版本输出"
copy /Y dist\省心投BI.exe "..\版本输出\省心投BI_%date:~0,4%%date:~5,2%%date:~8,2%.exe"

echo.
echo 完成! 按任意键退出...
pause >nul
```

---

## Task 5: 测试桌面应用

**Step 1: 测试开发模式**

```bash
# 设置开发模式
set DEV_MODE=1

# 运行应用
python app.py
# 预期: 启动 Flask 服务器，显示控制台日志
# 访问: http://127.0.0.1:5000
```

**Step 2: 测试 pywebview 模式**

```bash
# 直接运行（不设置 DEV_MODE）
python app.py
# 预期:
# - 启动 Flask 服务器（后台）
# - 打开嵌入式浏览器窗口
# - 窗口标题: "省心投 BI"
# - 关闭窗口时，服务器也关闭
```

**Step 3: 测试打包后的 EXE**

```bash
# 运行打包脚本
build_desktop.bat

# 测试输出的 EXE
dist\省心投BI.exe
# 预期:
# - 独立窗口打开
# - 无需 Python 环境
# - 关闭窗口时完全退出
```

---

## Task 6: 创建使用文档

**Create:** `版本输出\桌面应用使用说明.md`

```markdown
# 省心投 BI 桌面应用使用说明

## 版本信息
- 版本: v1.3 Desktop
- 打包日期: 2026-01-29
- Python 版本: 3.11.9

## 系统要求
- Windows 10/11 (64位)
- 无需安装 Python
- 无需安装任何依赖

## 使用方法

### 启动应用
1. 双击 `省心投BI_v1.3.exe`
2. 应用窗口自动打开
3. 开始使用系统

### 关闭应用
- 点击窗口关闭按钮 ✕
- 或按 `Alt+F4`
- 应用会自动关闭所有服务和窗口

## 常见问题

### Q: 应用无法启动？
A: 检查 Windows 安全中心是否拦截，右键点击属性，解除锁定

### Q: 窗口无法显示？
A: 确保系统支持 WebView2（Windows 10/11 默认已安装）

### Q: 如何查看日志？
A: 日志文件位置: `%APPDATA%\省心投BI\logs\`

## 技术支持
- 版本历史: 见 `version.json`
- 问题反馈: 联系开发团队
```

---

## Task 7: 优化和清理

**Step 1: 创建 .gitignore 规则**

**Modify:** `.gitignore`

在文件末尾添加:

```
# Python 虚拟环境
venv311/
venv/
__pycache__/

# PyInstaller 打包输出
build/
dist/
*.spec

# 打包输出
版本输出/*.exe
```

**Step 2: 清理旧的打包文件**

```bash
# 删除旧的打包文件
cd "D:\project\省心投-cc\开发代码"
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul
del *.spec 2>nul
```

**Step 3: 验证开发环境**

```bash
# 确保在 Python 3.11 虚拟环境中
python --version
# 预期: Python 3.11.9

# 检查关键依赖
pip list | findstr "Flask"
pip list | findstr "pywebview"
pip list | findstr "PyInstaller"
```

---

## Task 8: 文档更新

**File**:
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Step 1: 更新 CLAUDE.md**

在 CLAUDE.md 的"项目结构"部分添加:

```
├── 版本输出/                     # ⭐ 构建输出目录
│   ├── dist/                    # PyInstaller输出
│   ├── 省心投BI_v1.3.exe        # 桌面应用（推荐）
│   └── 使用说明.txt              # 用户使用说明
```

在"快速开始"部分添加:

```markdown
### 桌面应用模式（推荐）

双击 `版本输出/省心投BI_v1.3.exe` 即可启动，无需 Python 环境。

### 开发模式

双击根目录的 `启动开发服务器-new.bat` 启动开发服务器。
```

**Step 2: 更新 README.md**

在"版本说明"部分添加:

```markdown
### 桌面应用版本

- **位置**: `版本输出/省心投BI_v1.3.exe`
- **用途**: **推荐给最终用户**
- **启动方式**: 双击 `省心投BI_v1.3.exe`
- **特点**:
  - ✅ **无需 Python 环境** - 独立可执行文件
  - ✅ **嵌入式浏览器窗口** - 自动打开前端界面
  - ✅ **自动启动服务端** - 后台运行 Flask 服务器
  - ✅ **优雅关闭** - 关闭窗口时自动关闭服务端
  - ✅ **适合交付** - 可直接分发给客户使用

### 构建桌面应用

```bash
# 1. 切换到开发代码目录
cd 开发代码

# 2. 运行打包脚本
build_desktop.bat

# 3. 输出位置
# 版本输出/省心投BI_v1.3.exe
```
```

---

## Task 9: 版本控制

**Step 1: 提交依赖更新**

```bash
cd "D:\project\省心投-cc"
git add 开发代码/requirements.txt
git add 开发代码/app.py
git add 开发代码/shutdown.py
git add 构建脚本/build_desktop.spec
git add 构建脚本/build_desktop.bat
git commit -m "feat: 添加桌面应用打包支持

- 添加 pywebview 依赖
- 优化应用启动逻辑
- 添加 PyInstaller 配置
- 创建自动打包脚本
- 支持嵌入式浏览器窗口
"
```

**Step 2: 创建 Git Tag**

```bash
git tag -a v1.3.0-desktop -m "桌面应用版本 v1.3.0"
git push origin v1.3.0-desktop
```

---

## Task 10: 最终验证

**Step 1: 完整功能测试**

测试清单:
- [ ] 双击 EXE 能正常启动
- [ ] 嵌入式浏览器窗口正确显示前端界面
- [ ] 所有 API 接口正常工作
- [ ] 数据导入功能正常
- [ ] 报表加载和显示正常
- [ ] 关闭窗口时服务端也关闭
- [ ] 重新打开能正常启动

**Step 2: 性能测试**

```bash
# 检查启动时间
# 预期: 双击到窗口显示 < 5秒

# 检查内存占用
# 预期: 空闲时 < 200MB

# 检查文件大小
# 预期: < 250MB
```

**Step 3: 分发测试**

将 EXE 复制到另一台 Windows 机器（无 Python 环境）测试:
- [ ] 能否直接运行
- [ ] 是否需要安装 WebView2
- [ ] 功能是否正常

---

## 成功标准

✅ **完成标准**:
1. 双击 EXE 能在无 Python 环境的 Windows 机器上运行
2. 自动打开嵌入式浏览器窗口显示前端界面
3. Flask 后端自动启动并正常运行
4. 关闭窗口时，服务端和前端都完全退出
5. 文件大小 < 250MB
6. 启动时间 < 5秒

---

## 附录: 故障排除

### 问题 1: PyInstaller 报错 "Python DLL not found"

**原因**: Python 版本不兼容
**解决**: 使用 Python 3.11.9，不要使用 3.12 或 3.13

### 问题 2: pywebview 窗口不显示

**原因**: WebView2 运行时未安装
**解决**:
```bash
# 检查是否安装 WebView2
dir "C:\Program Files (x86)\Microsoft\EdgeWebView\Application"

# 如未安装，下载安装:
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

### 问题 3: 打包体积过大

**原因**: 包含了不必要的依赖
**解决**:
```bash
# 检查依赖树
pyinstaller --clean --log-level=WARN build_desktop.spec

# 添加更多 excludes
excludes += ['torch', 'tensorflow', 'sklearn', ...]
```

### 问题 4: 启动慢

**原因**: 单文件模式需要解压
**解决**:
- 使用 --onefile 模式（当前配置）
- 或改用 --onedir 模式 + Inno Setup 创建安装包

---

**计划完成时间**: 预计 2-3 小时
**风险**: Python 版本降级可能需要重新安装部分依赖
**Inno Setup 编译器路径**: `C:\Users\cyhzz\AppData\Local\Programs\Inno Setup 6\Compil32.exe`

**下一步**: 从 Task 1 开始执行（用户正在安装 Python 3.11.9）
