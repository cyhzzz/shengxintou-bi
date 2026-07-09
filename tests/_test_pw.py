import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.stdout.write("starting...\n"); sys.stdout.flush()
with sync_playwright() as p:
    sys.stdout.write("launching...\n"); sys.stdout.flush()
    b = p.chromium.launch(headless=True, args=["--disable-gpu", "--no-sandbox"])
    sys.stdout.write("launched\n"); sys.stdout.flush()
    page = b.new_page()
    page.set_default_timeout(10000)
    sys.stdout.write("goto...\n"); sys.stdout.flush()
    page.goto("http://127.0.0.1:3000/omni-channel", wait_until="domcontentloaded", timeout=10000)
    sys.stdout.write("page title: " + page.title() + "\n"); sys.stdout.flush()
    time.sleep(3)
    SHOTS = Path("logs/bug-fix-shots")
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOTS / "test-omni.png"), full_page=True)
    sys.stdout.write("shot OK\n"); sys.stdout.flush()
    b.close()
