# -*- mode: python ; coding: utf-8 -*-
"""
省心投 BI - PyInstaller spec（onedir 模式）

产物：dist/server/server.exe + dist/server/_internal/

部署时把整个 dist/server/ 目录复制到 desktop/resources/server/，
Electron 通过 spawn(resources/server/server.exe) 启动 Flask。

为什么 onedir 而不是 onefile：
- pandas + numpy + supabase + lxml 全量打包约 250-400MB，onefile 每次启动解压到 %TEMP% 5-15s
- onedir 启动快，调试 import 失败可直接查 _internal/
- 升级时只替换 _internal/ 改动文件，不用重下整个 exe
"""
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# ============================================================================
# hiddenimports：动态 import 的库必须显式声明
# ============================================================================
hiddenimports = (
    # supabase-py 内部用 importlib.import_module 动态加载子模块
    collect_submodules('supabase')
    + collect_submodules('postgrest')
    + collect_submodules('gotrue')
    + collect_submodules('realtime')
    + collect_submodules('storage3')
    + collect_submodules('httpx')
    + collect_submodules('httpcore')
    + collect_submodules('anyio')
    # SQLAlchemy dialect 动态加载
    + collect_submodules('sqlalchemy.dialects.postgresql')
    + collect_submodules('sqlalchemy.dialects.sqlite')
    + collect_submodules('psycopg')
    # 数据处理
    + collect_submodules('openpyxl')
    + collect_submodules('webdav3')
    + [
        'alembic', 'alembic.config', 'alembic.runtime', 'alembic.command',
        'alembic.migration', 'alembic.util', 'alembic.util.sqla_compat',
        'flask_migrate', 'flask_cors', 'flask_sqlalchemy',
        'dotenv', 'dateutil', 'dateutil.parser', 'dateutil.relativedelta',
        'lxml.etree', 'lxml._elementpath',
        'greenlet', 'mako', 'mako.template', 'markupsafe',
        'tzdata', 'colorama', 'cffi',
        # PG driver 兜底
        'psycopg._cmodule', 'psycopg._types', 'psycopg._preparing',
        'psycopg._encodings', 'psycopg.pq', 'psycopg.pq.pq_ctypes',
        # feat-local-auth 方案 A：JWT 鉴权
        'jwt', 'jwt.api_jwt', 'jwt.api_jws', 'jwt.algorithms',
        'jwt.api_base', 'jwt.utils', 'jwt.help',
        # werkzeug.security 用于密码 hash
        'werkzeug.security', 'werkzeug._internal',
        # backend.auth 模块
        'backend.auth', 'backend.auth.routes', 'backend.auth.middleware',
        'backend.auth.jwt_utils', 'backend.auth.supabase_client',
    ]
)

# ============================================================================
# datas：第三方库自带的非 .py 资源
# ============================================================================
datas = (
    collect_data_files('openpyxl')
    + collect_data_files('alembic')
    + collect_data_files('flask_migrate')
)

# ============================================================================
# excludes：减小体积，排除无关大型库
# ============================================================================
excludes = [
    'tkinter', 'matplotlib', 'pytest', 'IPython', 'jupyter',
    'notebook', 'pydoc', 'webview', 'pywebview', 'flasgger',
    'playwright', 'uvicorn', 'fastapi', 'scipy',
    'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
]

# ============================================================================
# UPX 压缩排除：这些二进制被 UPX 压缩后会 import 失败
# ============================================================================
upx_exclude = [
    'numpy/*.dll', 'numpy/*_umath*.pyd', 'numpy/*linalg*.pyd', 'numpy/random/*.pyd',
    'numpy.libs/*.dll',
    'pandas/_libs/*.pyd', 'pandas/_libs/tslibs/*.pyd',
    'psycopg/*.pyd', 'psycopg_binary/*.pyd',
    'lxml/*.pyd', 'lxml/etree*.pyd', 'lxml/_elementpath*.pyd',
    'greenlet/*.pyd', 'markupsafe/*.pyd',
    'pydantic_core/*.pyd', '_cython_*.pyd',
    'Python/_freeze*.pyd',
]


a = Analysis(
    ['server_entry.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,   # onedir 模式
    name='server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=upx_exclude,
    runtime_tmpdir=None,
    console=False,           # Electron 接管 stdio，不需要 console 窗口
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='x64',
    codesign_identity=None,
    entitlements_file=None,
    icon=['icon\\LOGO.ico'],
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=upx_exclude,
    name='server',
)
