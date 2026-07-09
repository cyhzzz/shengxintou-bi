# -*- coding: utf-8 -*-
"""Playwright 截图测试 — v3.1 方案 6 bug 修复验证"""
import os, sys, time, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "logs" / "bug-fix-shots"
SHOTS.mkdir(parents=True, exist_ok=True)
BASE = "http://127.0.0.1:3000"

from playwright.sync_api import sync_playwright

PAGES = [
    ("omni-channel", "/omni-channel", ".ant-segmented"),
    ("conversion-funnel", "/conversion-funnel", ".ant-tabs"),
    ("agency-analysis", "/agency-analysis", ".ant-card"),
    ("app-market-funnel", "/app-market/funnel", ".ant-card"),
    ("app-market-creative", "/app-market/creative", ".ant-table"),
    ("employee-conversion-analysis", "/employee-conversion/analysis", ".ant-card"),
    ("employee-conversion-weekly", "/employee-conversion/weekly", ".ant-card"),
    ("live-funnel", "/live/funnel", "body"),
]

results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.set_default_timeout(20000)
    for name, route, wait_sel in PAGES:
        url = BASE + route
        results[name] = {"url": url, "ok": False, "shots": [], "errors": []}
        console_msgs = []
        page.on("console", lambda msg: console_msgs.append((msg.type, msg.text)))
        page.on("pageerror", lambda err: console_msgs.append(("error", str(err))))
        try:
            page.goto(url, wait_until="networkidle", timeout=20000)
            try:
                page.wait_for_selector(wait_sel, timeout=5000)
            except Exception:
                pass
            time.sleep(2)
            shot_path = SHOTS / f"{name}.png"
            page.screenshot(path=str(shot_path), full_page=True)
            results[name]["ok"] = True
            results[name]["shots"].append(str(shot_path))
            errors = [m for m in console_msgs if m[0] in ("error",)]
            results[name]["errors"] = errors[:5]
        except Exception as e:
            results[name]["errors"].append(("exception", str(e)))
    browser.close()

print(json.dumps(results, ensure_ascii=False, indent=2))
