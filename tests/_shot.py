import sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright
SHOTS = Path("logs/bug-fix-shots"); SHOTS.mkdir(parents=True, exist_ok=True)
PAGES = json.loads(sys.argv[1])
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--disable-gpu", "--no-sandbox"])
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.set_default_timeout(8000)
    for spec in PAGES:
        name, route, wait_sel = spec["name"], spec["route"], spec.get("wait", "body")
        results[name] = {"route": route, "ok": False, "console_errors": []}
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.on("console", lambda m: errs.append(f"[{m.type}] {m.text[:200]}") if m.type == "error" else None)
        try:
            page.goto("http://127.0.0.1:3000" + route, wait_until="domcontentloaded", timeout=10000)
            try: page.wait_for_selector(wait_sel, timeout=4000)
            except: pass
            time.sleep(2.5)
            page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)
            results[name]["ok"] = True
        except Exception as e:
            results[name]["exception"] = str(e)
        results[name]["console_errors"] = errs[:3]
    browser.close()
print(json.dumps(results, ensure_ascii=False, indent=2))