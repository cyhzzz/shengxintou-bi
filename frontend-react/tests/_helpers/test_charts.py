# -*- coding: utf-8 -*-
"""
Test chart rendering in XHS Operation Analysis page
"""
from playwright.sync_api import sync_playwright
import json
import time

def main():
    results = {
        'charts': [],
        'console_logs': [],
        'errors': []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        console_logs = []
        page.on('console', lambda msg: console_logs.append({
            'type': msg.type,
            'text': msg.text
        }))

        try:
            # Navigate to new frontend
            page.goto('http://localhost:3005')
            page.wait_for_load_state('networkidle')
            time.sleep(1)

            # Navigate to XHS Operation page
            # Find the submenu
            sidebar = page.locator('.ant-layout-sider').first
            if sidebar.is_visible():
                # Click on XHS submenu
                xhs_menu = sidebar.locator('.ant-menu-submenu-title').filter(has_text='小红书')
                if xhs_menu.count() > 0:
                    xhs_menu.first.click()
                    time.sleep(0.5)

                    # Click on Operation Analysis
                    op_item = sidebar.locator('.ant-menu-item').filter(has_text='运营分析')
                    if op_item.count() > 0:
                        op_item.first.click()
                        time.sleep(2)

            page.wait_for_load_state('networkidle')
            time.sleep(3)  # Wait for charts to render

            # Take screenshot
            page.screenshot(path='/tmp/operation_charts.png', full_page=True)
            print("Screenshot saved: /tmp/operation_charts.png")

            # Check for canvas elements (charts)
            canvases = page.locator('canvas').all()
            print(f"Found {len(canvases)} canvas elements")
            for i, canvas in enumerate(canvases):
                box = canvas.bounding_box()
                if box:
                    print(f"  Canvas {i+1}: {box['width']}x{box['height']} at ({box['x']}, {box['y']})")
                    results['charts'].append({
                        'index': i,
                        'width': box['width'],
                        'height': box['height'],
                        'x': box['x'],
                        'y': box['y']
                    })

            # Check for chart containers
            chart_cards = page.locator('.chartCard, [class*="chartCard"]').all()
            print(f"\nFound {len(chart_cards)} chart card elements")

            # Check if Line chart container exists
            line_containers = page.locator('[class*="line"], [class*="Line"]').all()
            print(f"Found {len(line_containers)} line chart containers")

            # Check if Column chart container exists
            column_containers = page.locator('[class*="column"], [class*="Column"]').all()
            print(f"Found {len(column_containers)} column chart containers")

            # Get the chart containers by checking Card titles
            cards = page.locator('.ant-card').all()
            for i, card in enumerate(cards):
                title = card.locator('.ant-card-head-title').text_content()
                if '趋势' in title or 'chart' in title.lower():
                    print(f"\nCard {i+1}: {title}")
                    # Check if it has a canvas
                    canvas_in_card = card.locator('canvas').count()
                    empty_in_card = card.locator('text="暂无数据"').count()
                    print(f"  Has canvas: {canvas_in_card}")
                    print(f"  Has empty state: {empty_in_card}")

            # Check console logs for errors
            errors = [log for log in console_logs if log['type'] == 'error']
            warnings = [log for log in console_logs if log['type'] == 'warning']

            print(f"\nConsole errors: {len(errors)}")
            for err in errors:
                print(f"  ERROR: {err['text'][:200]}")

            print(f"\nConsole warnings: {len(warnings)}")
            for warn in warnings[:5]:
                print(f"  WARN: {warn['text'][:200]}")

            results['console_logs'] = console_logs
            results['errors'] = errors

        except Exception as e:
            print(f"ERROR: {e}")
            results['errors'].append(str(e))

        browser.close()

    # Save results
    with open('/tmp/chart_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    print("\nResults saved to: /tmp/chart_test_results.json")

if __name__ == '__main__':
    main()