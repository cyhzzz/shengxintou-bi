# -*- coding: utf-8 -*-
"""
本地截取官网页面快照，肉眼验证布局/图片加载/资源。
"""

from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path("logs/site-preview")
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    msgs = []
    page.on("console", lambda m: msgs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: msgs.append(f"[pageerror] {e}"))
    page.on("requestfailed", lambda r: msgs.append(f"[failed] {r.url} -> {r.failure}"))

    page.goto("http://localhost:8090/", wait_until="networkidle")
    page.wait_for_timeout(2000)

    page.screenshot(path=str(OUT / "01-top.png"), full_page=False)
    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "02-features.png"), full_page=False)
    page.evaluate("window.scrollTo(0, 1800)")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "03-showcase.png"), full_page=False)
    page.evaluate("window.scrollTo(0, 2700)")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "04-platforms.png"), full_page=False)
    page.evaluate("window.scrollTo(0, 3600)")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / "05-cta-footer.png"), full_page=False)
    page.screenshot(path=str(OUT / "full.png"), full_page=True)

    print("--- 资源/控制台 ---")
    for m in msgs:
        print(m)

    # 检查关键图片是否真的渲染
    logo_info = page.evaluate("""() => {
      const img = document.querySelector('.brand-mark');
      const heroImgs = document.querySelectorAll('.screen-card img');
      const showcaseImgs = document.querySelectorAll('.showcase-frame img');
      return {
        brand: { src: img?.src, complete: img?.complete, w: img?.naturalWidth, h: img?.naturalHeight },
        hero: Array.from(heroImgs).map(i => ({ src: i.src, w: i.naturalWidth, h: i.naturalHeight })),
        showcase: Array.from(showcaseImgs).map(i => ({ src: i.src, w: i.naturalWidth, h: i.naturalHeight })),
      };
    }""")
    print("--- 图片渲染检查 ---")
    import json
    print(json.dumps(logo_info, indent=2, ensure_ascii=False))

    browser.close()