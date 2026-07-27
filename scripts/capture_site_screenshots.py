# -*- coding: utf-8 -*-
r"""
截取省心投 BI Web 端真实页面并做脱敏打码，用于官网素材。

用法：
    .venv\Scripts\python.exe scripts\capture_site_screenshots.py

输出：
    website/assets/screenshots/*.png

脱敏策略：
    - 顶部 header 右侧用户区整体模糊
    - 指标卡数字区域局部马赛克
    - 表格/明细中文字单元格做轻模糊（保留布局）
    - 热力图、日历、漏斗等可视化组件保留视觉形态
"""

import os
import sys
import time
from pathlib import Path

from PIL import Image, ImageFilter, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "website" / "assets" / "screenshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1440, "height": 900}
BASE_URL = "http://localhost:3000"


def pixelate(img: Image.Image, box, block_size=12):
    """对指定区域做像素化马赛克。"""
    region = img.crop(box)
    small = region.resize(
        (max(1, region.width // block_size), max(1, region.height // block_size)),
        Image.Resampling.NEAREST,
    )
    pixelated = small.resize(region.size, Image.Resampling.NEAREST)
    img.paste(pixelated, box)


def blur_region(img: Image.Image, box, radius=8):
    """对指定区域做高斯模糊。"""
    region = img.crop(box)
    blurred = region.filter(ImageFilter.GaussianBlur(radius=radius))
    img.paste(blurred, box)


def add_noise_pattern(img: Image.Image, box):
    """在马赛克区域上加细微噪点纹理，避免太平整。"""
    draw = ImageDraw.Draw(img)
    x1, y1, x2, y2 = box
    for i in range(0, x2 - x1, 4):
        for j in range(0, y2 - y1, 4):
            if (i + j) % 8 == 0:
                draw.point((x1 + i, y1 + j), fill=(240, 240, 240, 30))


def capture_dashboard(page, path: Path):
    page.goto(f"{BASE_URL}/")
    page.wait_for_load_state("networkidle")
    time.sleep(2.5)
    page.screenshot(path=str(path), full_page=False)

    img = Image.open(path)
    w, h = img.size

    # 顶部 header 右侧用户区
    blur_region(img, (w - 220, 0, w, 48), radius=12)

    # 指标卡数字区域：第一张图假设顶部有 4 个指标卡，覆盖数字部分
    # 实际坐标会根据页面微调；这里按 1440x900 的 Ant Design 布局估算
    card_width = w // 4
    for i in range(4):
        # 指标值大致在 y=88~150 之间
        pixelate(img, (i * card_width + 24, 88, (i + 1) * card_width - 24, 150), block_size=10)

    # 日历热力图右侧/下侧的具体数字 tooltip 不可见，不处理
    # 趋势图保留

    img.save(path, quality=95)
    print(f"[saved] {path}")


def capture_funnel(page, path: Path):
    page.goto(f"{BASE_URL}/conversion-funnel")
    page.wait_for_load_state("networkidle")
    time.sleep(2.5)
    page.screenshot(path=str(path), full_page=False)

    img = Image.open(path)
    w, h = img.size
    blur_region(img, (w - 220, 0, w, 48), radius=12)

    # 漏斗图左侧阶段名与数字需要保护
    pixelate(img, (200, 120, 520, h - 80), block_size=14)
    # 右侧筛选区若有具体账号也模糊
    blur_region(img, (w - 280, 80, w, 360), radius=10)

    img.save(path, quality=95)
    print(f"[saved] {path}")


def capture_appmarket(page, path: Path):
    page.goto(f"{BASE_URL}/reports/app-market/funnel")
    page.wait_for_load_state("networkidle")
    time.sleep(2.5)
    page.screenshot(path=str(path), full_page=False)

    img = Image.open(path)
    w, h = img.size
    blur_region(img, (w - 220, 0, w, 48), radius=12)

    # 指标卡与漏斗数据打码
    pixelate(img, (200, 80, w - 280, 200), block_size=12)
    pixelate(img, (200, 200, 560, h - 80), block_size=14)

    img.save(path, quality=95)
    print(f"[saved] {path}")


def capture_data_import(page, path: Path):
    page.goto(f"{BASE_URL}/system/data-import")
    page.wait_for_load_state("networkidle")
    time.sleep(1.5)
    page.screenshot(path=str(path), full_page=False)

    img = Image.open(path)
    w, h = img.size
    blur_region(img, (w - 220, 0, w, 48), radius=12)

    img.save(path, quality=95)
    print(f"[saved] {path}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport=VIEWPORT)
        page = context.new_page()

        capture_dashboard(page, OUT_DIR / "dashboard.png")
        capture_funnel(page, OUT_DIR / "funnel.png")
        capture_appmarket(page, OUT_DIR / "appmarket.png")
        capture_data_import(page, OUT_DIR / "dataimport.png")

        browser.close()


if __name__ == "__main__":
    main()
