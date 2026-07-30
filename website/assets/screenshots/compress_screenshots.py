"""压缩官网截图：缩到 1200 宽 + 转 WebP（quality 82）。

执行：python website/assets/screenshots/compress_screenshots.py
- 源：*.png（保留不删，作为 <picture> fallback）
- 输出：*.webp（约 30-50% 体积）
"""
from PIL import Image
import os
import sys

src_dir = os.path.dirname(os.path.abspath(__file__))
files = ["dashboard.png", "funnel.png", "appmarket.png", "dataimport.png"]
total_before = 0
total_after = 0

for f in files:
    src = os.path.join(src_dir, f)
    if not os.path.exists(src):
        print(f"[skip] {f} not found")
        continue
    before_kb = os.path.getsize(src) / 1024
    img = Image.open(src)
    w, h = img.size
    if w > 1200:
        ratio = 1200 / w
        new_size = (1200, int(h * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    if img.mode == "RGBA":
        img = img.convert("RGB")
    dst = os.path.join(src_dir, f.replace(".png", ".webp"))
    img.save(dst, "WEBP", quality=82, method=6)
    after_kb = os.path.getsize(dst) / 1024
    total_before += before_kb
    total_after += after_kb
    print(f"{f}: {before_kb:.1f}KB -> {os.path.basename(dst)} {after_kb:.1f}KB  ({100 * after_kb / before_kb:.0f}%)")

print(f"\nTOTAL: {total_before:.1f}KB -> {total_after:.1f}KB  ({100 * total_after / total_before:.0f}%)")