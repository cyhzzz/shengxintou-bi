# -*- coding: utf-8 -*-
"""
对官网截图统一施加「终极强脱敏」效果——确保任何字符、数字、UI 元素都无法辨识。

策略（多级叠加，确保万无一失）：
1. 整图缩到 240 宽 → 放大回原尺寸（强像素化，消除所有字符）
2. 强高斯模糊（半径 6）抹除剩余边缘
3. 转灰度混合暖白色（去掉业务色彩暗示）
4. 暖白径向蒙版让画面与官网底色融合
5. 整体降饱和度到 20%
6. 品牌色块点缀保留视觉暗示

用法：
    .venv\Scripts\python.exe scripts/apply_preview_effect.py
"""

from pathlib import Path

from PIL import Image, ImageFilter, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "website" / "assets" / "screenshots"


def ultimate_desensitize(path: Path):
    img = Image.open(path).convert("RGB")
    w, h = img.size

    # 1) 强像素化（240 宽 → 放大回原尺寸）
    target_w = 240
    scale = target_w / w
    small_h = max(1, int(h * scale))
    small = img.resize((target_w, small_h), Image.Resampling.BILINEAR)
    pixelated = small.resize((w, h), Image.Resampling.NEAREST)

    # 2) 强高斯模糊（半径 6，抹除所有可读字符）
    blurred = pixelated.filter(ImageFilter.GaussianBlur(radius=6.0))

    # 3) 降饱和度到 25%（去掉业务色彩暗示）
    enhancer = ImageEnhance.Color(blurred)
    desaturated = enhancer.enhance(0.25)

    # 4) 暖白径向蒙版：中部透，边缘融入背景
    overlay = Image.new("RGB", (w, h), (245, 242, 237))
    overlay_draw = ImageDraw.Draw(overlay)
    cx, cy = w / 2, h / 2
    max_dist = ((w / 2) ** 2 + (h / 2) ** 2) ** 0.5
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            dx, dy = x - cx, y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            t = min(1.0, dist / max_dist)
            alpha = int(80 * t)
            r0, g0, b0 = desaturated.getpixel((x, y))
            r1, g1, b1 = 245, 242, 237
            blended = (
                int(r0 * (100 - alpha) / 100 + r1 * alpha / 100),
                int(g0 * (100 - alpha) / 100 + g1 * alpha / 100),
                int(b0 * (100 - alpha) / 100 + b1 * alpha / 100),
            )
            overlay_draw.point((x, y), fill=blended)
    blurred = overlay

    # 5) 细颗粒噪点
    grain = Image.new("RGB", (w, h), (0, 0, 0))
    grain_draw = ImageDraw.Draw(grain)
    for i in range(0, w, 3):
        for j in range(0, h, 3):
            if (i * 7 + j * 13) % 11 == 0:
                grain_draw.point((i, j), fill=(255, 255, 255))
            elif (i * 5 + j * 17) % 13 == 0:
                grain_draw.point((i, j), fill=(0, 0, 0))
    blurred = Image.blend(blurred, grain, alpha=0.05)

    # 6) 暖白底色提亮
    final = Image.new("RGB", (w, h), (250, 248, 245))
    final.paste(blurred, (0, 0))

    # 7) 品牌色块点缀：左上小蓝块 + 右下小陶土色块
    final_draw = ImageDraw.Draw(final)
    final_draw.rectangle([40, 40, 140, 80], fill=(24, 144, 255))
    final_draw.rectangle([w - 120, h - 60, w - 40, h - 20], fill=(201, 107, 74))

    final.save(path, quality=88)
    print(f"[ultimate-desensitize] {path}")


def main():
    for p in sorted(SRC_DIR.glob("*.png")):
        ultimate_desensitize(p)


if __name__ == "__main__":
    main()