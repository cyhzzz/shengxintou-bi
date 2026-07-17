# -*- coding: utf-8 -*-
"""
Compare XHS Operation Analysis charts between old and new frontend
"""
from playwright.sync_api import sync_playwright
import json
import time
import sys

# Fix encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')

def main():
    results = {
        'old_frontend': {},
        'new_frontend': {},
        'comparison': {}
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ========== Test Old Frontend ==========
        print("=" * 60)
        print("Testing OLD Frontend (http://127.0.0.1:5000)")
        print("=" * 60)

        page_old = browser.new_page()
        console_old = []
        page_old.on('console', lambda msg: console_old.append({'type': msg.type, 'text': msg.text}))

        try:
            page_old.goto('http://127.0.0.1:5000')
            page_old.wait_for_load_state('networkidle')
            time.sleep(1)

            # Navigate to XHS Operation page - look for the menu structure
            # First, try to find and click the XHS submenu
            try:
                # Old frontend menu structure
                xhs_submenu = page_old.locator('[class*="nav"]').locator('text=小红书').first
                if xhs_submenu.is_visible():
                    xhs_submenu.click()
                    time.sleep(0.5)

                    # Then click on Operation Analysis
                    op_item = page_old.locator('[class*="nav"]').locator('text=运营分析').first
                    if op_item.is_visible():
                        op_item.click()
                        time.sleep(2)
            except Exception as nav_err:
                print(f"Navigation error: {nav_err}")

            page_old.wait_for_load_state('networkidle')
            time.sleep(3)

            # Take screenshot first
            page_old.screenshot(path='D:/temp/operation_old_frontend.png', full_page=True)
            print("Screenshot saved: D:/temp/operation_old_frontend.png")

            # Count charts
            canvases_old = page_old.locator('canvas').all()
            print(f"Old Frontend: Found {len(canvases_old)} canvas elements")

            # Check page content
            page_content = page_old.content()
            has_operation = '运营分析' in page_content or 'operation' in page_content.lower()
            print(f"Page contains operation content: {has_operation}")

            # Check for chart cards by looking for ECharts containers
            echarts_containers = page_old.locator('[class*="chart"], [id*="chart"]').all()
            print(f"Found {len(echarts_containers)} chart container elements")

            results['old_frontend'] = {
                'canvas_count': len(canvases_old),
                'echarts_containers': len(echarts_containers),
                'has_operation_content': has_operation,
                'errors': [e['text'] for e in console_old if e['type'] == 'error'][:5]
            }

        except Exception as e:
            print(f"Old Frontend Error: {e}")
            results['old_frontend']['error'] = str(e)

        page_old.close()

        # ========== Test New Frontend ==========
        print("\n" + "=" * 60)
        print("Testing NEW Frontend (http://localhost:3007)")
        print("=" * 60)

        page_new = browser.new_page()
        console_new = []
        page_new.on('console', lambda msg: console_new.append({'type': msg.type, 'text': msg.text}))

        try:
            page_new.goto('http://localhost:3007')
            page_new.wait_for_load_state('networkidle')
            time.sleep(1)

            # Navigate to XHS Operation page
            sidebar = page_new.locator('.ant-layout-sider').first
            if sidebar.is_visible():
                xhs_menu = sidebar.locator('.ant-menu-submenu-title').filter(has_text='小红书')
                if xhs_menu.count() > 0:
                    xhs_menu.first.click()
                    time.sleep(0.5)
                    op_item = sidebar.locator('.ant-menu-item').filter(has_text='运营分析')
                    if op_item.count() > 0:
                        op_item.first.click()
                        time.sleep(2)

            page_new.wait_for_load_state('networkidle')
            time.sleep(3)

            # Take screenshot
            page_new.screenshot(path='D:/temp/operation_new_frontend.png', full_page=True)
            print("Screenshot saved: D:/temp/operation_new_frontend.png")

            # Count charts
            canvases_new = page_new.locator('canvas').all()
            print(f"New Frontend: Found {len(canvases_new)} canvas elements")

            # Check for chart sections
            chart_types = ['转化趋势', '创作量趋势', '互动量趋势', '笔记创作量', '笔记互动量']
            new_charts = {}
            for chart_type in chart_types:
                card = page_new.locator(f'.ant-card:has-text("{chart_type}")')
                if card.count() > 0:
                    canvas_count = card.first.locator('canvas').count()
                    empty_count = card.first.locator('text=暂无数据').count()
                    new_charts[chart_type] = {'has_canvas': canvas_count > 0, 'empty': empty_count > 0}
                    status = "OK" if canvas_count > 0 and empty_count == 0 else "EMPTY" if empty_count > 0 else "NO_CANVAS"
                    print(f"  {chart_type}: {status}")
                else:
                    new_charts[chart_type] = {'found': False}
                    print(f"  {chart_type}: NOT FOUND")

            results['new_frontend'] = {
                'canvas_count': len(canvases_new),
                'charts': new_charts,
                'errors': [e['text'] for e in console_new if e['type'] == 'error'][:5]
            }

        except Exception as e:
            print(f"New Frontend Error: {e}")
            results['new_frontend']['error'] = str(e)

        page_new.close()
        browser.close()

    # ========== Summary ==========
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Old Frontend: {results['old_frontend'].get('canvas_count', 0)} canvas elements")
    print(f"New Frontend: {results['new_frontend'].get('canvas_count', 0)} canvas elements")

    # Save results
    with open('D:/temp/operation_comparison.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    print("\nResults saved to D:/temp/operation_comparison.json")

if __name__ == '__main__':
    main()