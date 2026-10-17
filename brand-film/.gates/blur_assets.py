#!/usr/bin/env python3
"""blur_assets.py — 真实截图高斯模糊（数据安全红线）。

宣传片不得携带任何可读的真实业务数据。两张真实截图按下列 sigma 高斯模糊后
才进入 film/assets/：
  - dashboard-preview.png  趋势曲线 + 开户日历热力图（含真实业务数据）→ sigma 22
  - architecture.png       系统架构图（无业务数据，但属内部资料截图）→ sigma 8

脚本从仓库原始路径读取、模糊后写入 film/assets/，可重复执行（幂等）。
"""
import os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # brand-film/
REPO = os.path.dirname(ROOT)                                                # 省心投BI/
DEST = os.path.join(ROOT, 'film', 'assets')

# (仓库源文件, 输出名, 高斯 sigma)
JOBS = [
    (os.path.join(REPO, 'frontend-react', 'src', 'assets', 'dashboard-preview.png'),
     'dashboard-preview.png', 22),
    (os.path.join(REPO, 'docs', 'images', 'architecture.png'),
     'architecture.png', 8),
]


def main():
    os.makedirs(DEST, exist_ok=True)
    for src, name, sigma in JOBS:
        if not os.path.exists(src):
            raise SystemExit('missing source: %s' % src)
        im = Image.open(src).convert('RGB')
        before = im.size
        im = im.filter(ImageFilter.GaussianBlur(radius=sigma))
        out = os.path.join(DEST, name)
        im.save(out, optimize=True)
        kb = os.path.getsize(out) // 1024
        print('%-24s %sx%s -> %s  sigma=%d  %dKB'
              % (name, before[0], before[1], os.path.relpath(out, ROOT), sigma, kb))


if __name__ == '__main__':
    main()
