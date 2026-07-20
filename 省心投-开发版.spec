# -*- mode: python ; coding: utf-8 -*-
""\"
Developer 打包配置（带 console 便于开发调试）。

用法:
  pip install pyinstaller
  cd 项目根目录
  pyinstaller 省心投-开发版.spec

产物: dist/省心投启动器.exe（带窗口 + 控制台日志）
\"\"\"

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='省心投启动器',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,           # 开发版：留 console 窗口便于看日志
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['icon\\\\LOGO.ico'],
)
