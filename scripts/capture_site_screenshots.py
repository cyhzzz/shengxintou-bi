# -*- coding: utf-8 -*-
"""
截取省心投 BI Web 端真实页面并施加适度模糊脱敏。

脱敏策略：
- 保留原分辨率 1440x900
- 高斯模糊半径 3：文字/数字不可读，UI 结构、图表形态、配色仍清晰
- 不做像素化、不做暖白蒙版、不降饱和度

用法：
    .venv\Scripts\python.exe scripts\capture_site_screenshots.py

输出：
    website/assets/screenshots/*.png
"""

import time
from pathlib import Path

from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "website" / "assets" / "screenshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1440, "height": 900}
BASE_URL = "http://localhost:3000"


def soft_blur(path: Path):
    """适度高斯模糊：文字不可读，UI 结构仍清晰。"""
    img = Image.open(path).convert("RGB")
    blurred = img.filter(ImageFilter.GaussianBlur(radius=3))
    blurred.save(path, quality=92)
    print(f"  [soft-blur] {path.name}")


def capture(page, route: str, filename: str):
    url = f"{BASE_URL}/{route}" if route else BASE_URL + "/"
    print(f"  → {url}")
    page.goto(url, wait_until="networkidle")
    time.sleep(2.5)
    out = OUT_DIR / filename
    page.screenshot(path=str(out), full_page=False)
    soft_blur(out)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport=VIEWPORT)
        page = context.new_page()

        print("截取真实页面 + 适度模糊脱敏…")
        capture(page, "", "dashboard.png")
        capture(page, "conversion-funnel", "funnel.png")
        capture(page, "app-market/funnel", "appmarket.png")
        capture(page, "system/data-import", "dataimport.png")

        browser.close()
        print("完成。截图保留真实 UI 结构，文字已模糊到不可读。")


if __name__ == "__main__":
    main()
