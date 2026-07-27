# -*- coding: utf-8 -*-
"""
重新截取省心投 BI Web 端真实页面并做强脱敏。

脱敏要求：整图统一高斯模糊 + 像素化，让任何业务数据无法辨识。

用法：
    .venv\Scripts\python.exe scripts\capture_site_screenshots.py

输出：
    website/assets/screenshots/*.png
"""

import time
from pathlib import Path

from PIL import Image, ImageFilter, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "website" / "assets" / "screenshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1440, "height": 900}
BASE_URL = "http://localhost:3000"


def heavy_desensitize(path: Path):
    """
    强脱敏策略：整图统一处理，无法逆向出真实业务字段。

    1. 缩小到 360px 宽（像素化）
    2. 再放大回原尺寸（保留轮廓、失去细节）
    3. 高斯模糊进一步抹除可识别特征
    4. 叠加暖白渐变蒙版，与官网主色融合
    5. 加细颗粒纹理，统一视觉语言
    """
    img = Image.open(path).convert("RGB")
    w, h = img.size

    # 1) 像素化：宽缩到 360，再放大回原尺寸
    target_w = 360
    scale = target_w / w
    small_h = max(1, int(h * scale))
    small = img.resize((target_w, small_h), Image.Resampling.BILINEAR)
    pixelated = small.resize((w, h), Image.Resampling.NEAREST)

    # 2) 强高斯模糊
    blurred = pixelated.filter(ImageFilter.GaussianBlur(radius=4.0))

    # 3) 叠加暖白蒙版，让画面与官网暖白底色融合
    overlay = Image.new("RGB", (w, h), (245, 242, 237))
    overlay_draw = ImageDraw.Draw(overlay)
    # 中部更透，保留 UI 轮廓；边缘更不透明，融合背景
    cx, cy = w / 2, h / 2
    max_dist = ((w / 2) ** 2 + (h / 2) ** 2) ** 0.5
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            dx, dy = x - cx, y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            # 中部透 0%（让模糊图显出），边缘不透 70%（融入背景）
            t = min(1.0, dist / max_dist)
            alpha = int(70 * t)
            r0, g0, b0 = blurred.getpixel((x, y))
            r1, g1, b1 = 245, 242, 237
            blended = (
                int(r0 * (100 - alpha) / 100 + r1 * alpha / 100),
                int(g0 * (100 - alpha) / 100 + g1 * alpha / 100),
                int(b0 * (100 - alpha) / 100 + b1 * alpha / 100),
            )
            overlay_draw.point((x, y), fill=blended)
    blurred = overlay

    # 4) 加细颗粒噪点
    grain = Image.new("RGB", (w, h), (0, 0, 0))
    grain_draw = ImageDraw.Draw(grain)
    for i in range(0, w, 3):
        for j in range(0, h, 3):
            if (i * 7 + j * 13) % 11 == 0:
                grain_draw.point((i, j), fill=(255, 255, 255))
            elif (i * 5 + j * 17) % 13 == 0:
                grain_draw.point((i, j), fill=(0, 0, 0))
    blurred = Image.blend(blurred, grain, alpha=0.04)

    # 5) 暖白底色提亮中部，让界面像「抽象的 UI 概念图」
    final = Image.new("RGB", (w, h), (250, 248, 245))
    final.paste(blurred, (0, 0))

    # 6) 在整图四角加微弱品牌蓝阴影，暗示"这是 BI"
    final_draw = ImageDraw.Draw(final)
    for r in range(40, 0, -2):
        a = int(8 * (1 - r / 40))
        final_draw.ellipse(
            [w - r * 4 - 30, -r * 2 - 30, w + r * 4 + 30, r * 2 + 30],
            outline=(24, 144, 255),
            width=2,
        )

    final.save(path, quality=90)
    print(f"[heavy-desensitize] {path}")


def capture(page, route: str, filename: str):
    url = f"{BASE_URL}/{route}"
    print(f"  → {url}")
    page.goto(url, wait_until="networkidle")
    time.sleep(2.5)
    out = OUT_DIR / filename
    page.screenshot(path=str(out), full_page=False)
    heavy_desensitize(out)


def main():
    with sync_playwright() as p:
        browser = p.chromium.chromium.launch(headless=True)
        context = browser.new_context(viewport=VIEWPORT)
        page = context.new_page()

        print("开始截取真实页面（强脱敏）…")
        capture(page, "", "dashboard.png")
        capture(page, "conversion-funnel", "funnel.png")
        capture(page, "reports/app-market/funnel", "appmarket.png")
        capture(page, "system/data-import", "dataimport.png")

        browser.close()
        print("完成。截图均已强脱敏，无法从中辨识真实业务数据。")


if __name__ == "__main__":
    main()