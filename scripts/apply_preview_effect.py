# -*- coding: utf-8 -*-
r"""
对官网截图统一施加「产品预览」效果：
- 轻微高斯模糊 + 降噪，避免真实业务数据可读
- 叠加半透明渐变遮罩，使其更像设计稿
- 保持 UI 结构、品牌色、布局完整

用法：
    .venv\Scripts\python.exe scripts\apply_preview_effect.py
"""

from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "website" / "assets" / "screenshots"


def apply_effect(path: Path):
    img = Image.open(path).convert("RGBA")
    w, h = img.size

    # 1. 轻微高斯模糊，切断小字可读性
    blurred = img.filter(ImageFilter.GaussianBlur(radius=1.2))

    # 2. 叠加噪点纹理（极淡），让画面更像印刷品/预览图
    overlay = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    for i in range(0, w, 6):
        for j in range(0, h, 6):
            if (i + j) % 12 == 0:
                draw.point((i, j), fill=(255, 255, 255, 18))
            elif (i + j) % 18 == 0:
                draw.point((i, j), fill=(0, 0, 0, 8))

    # 3. 叠加底部到顶部的微弱渐变，增加层次感
    for y in range(h):
        alpha = int(10 + 25 * (y / h))  # 顶部更淡，底部略深
        draw.line([(0, y), (w, y)], fill=(245, 242, 237, alpha))

    # 4. 在四个角加极淡的暗角
    vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    max_radius = min(w, h) // 2
    for i in range(max_radius, 0, -4):
        alpha = int(18 * (1 - i / max_radius))
        v_draw.rectangle([i, i, w - i, h - i], outline=(0, 0, 0, alpha))

    result = Image.alpha_composite(blurred, overlay)
    result = Image.alpha_composite(result, vignette)

    # 转回 RGB 保存
    result.convert("RGB").save(path, quality=95)
    print(f"[preview effect] {path}")


def main():
    for p in sorted(SRC_DIR.glob("*.png")):
        apply_effect(p)


if __name__ == "__main__":
    main()
