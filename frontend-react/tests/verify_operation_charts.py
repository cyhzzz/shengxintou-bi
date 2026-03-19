# -*- coding: utf-8 -*-
"""
Verify XHS Operation Analysis charts in new React frontend
"""
from playwright.sync_api import sync_playwright
import json
import time

def main():
    results = {
        'charts': [],
        'errors': [],
        'api_data_keys': []
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
            page.screenshot(path='/tmp/operation_charts_new.png', full_page=True)
            print("Screenshot saved: /tmp/operation_charts_new.png")

            # Check for canvas elements (charts)
            canvases = page.locator('canvas').all()
            print(f"\nFound {len(canvases)} canvas elements (charts)")
            for i, canvas in enumerate(canvases):
                box = canvas.bounding_box()
                if box:
                    print(f"  Canvas {i+1}: {box['width']:.0f}x{box['height']:.0f}")
                    results['charts'].append({
                        'index': i,
                        'width': box['width'],
                        'height': box['height']
                    })

            # Check for chart sections by looking for specific patterns
            print("\n=== Checking Chart Sections ===")

            # 1. Core Metrics (4 cards)
            metric_cards = page.locator('.ant-card').filter(has_text='笔记总数').count()
            print(f"Core Metrics cards: {metric_cards}")

            # 2. Conversion Trend Chart
            conversion_trend = page.locator('.ant-card').filter(has_text='转化趋势')
            if conversion_trend.count() > 0:
                canvas_count = conversion_trend.first.locator('canvas').count()
                print(f"Conversion Trend: has {canvas_count} canvas")

            # 3. Creation Volume Chart
            creation_volume = page.locator('.ant-card').filter(has_text='创作量趋势')
            if creation_volume.count() > 0:
                canvas_count = creation_volume.first.locator('canvas').count()
                print(f"Creation Volume Trend: has {canvas_count} canvas")
            else:
                print("WARNING: Creation Volume Trend card NOT found")

            # 4. Interaction Trend Chart
            interaction_trend = page.locator('.ant-card').filter(has_text='互动量趋势')
            if interaction_trend.count() > 0:
                canvas_count = interaction_trend.first.locator('canvas').count()
                print(f"Interaction Trend: has {canvas_count} canvas")
            else:
                print("WARNING: Interaction Trend card NOT found")

            # 5. Creator Creation Chart
            creator_creation = page.locator('.ant-card').filter(has_text='创作者创作量')
            if creator_creation.count() > 0:
                canvas_count = creator_creation.first.locator('canvas').count()
                print(f"Creator Creation: has {canvas_count} canvas")
            else:
                print("WARNING: Creator Creation card NOT found")

            # 6. Creator Interaction Chart
            creator_interaction = page.locator('.ant-card').filter(has_text='创作者互动量')
            if creator_interaction.count() > 0:
                canvas_count = creator_interaction.first.locator('canvas').count()
                print(f"Creator Interaction: has {canvas_count} canvas")
            else:
                print("WARNING: Creator Interaction card NOT found")

            # Check for empty states
            empty_states = page.locator('text=暂无数据').all()
            print(f"\nEmpty state messages found: {len(empty_states)}")

            # Check console for errors
            errors = [log for log in console_logs if log['type'] == 'error']
            print(f"\nConsole errors: {len(errors)}")
            for err in errors:
                print(f"  ERROR: {err['text'][:200]}")
                results['errors'].append(err['text'])

        except Exception as e:
            print(f"ERROR: {e}")
            results['errors'].append(str(e))

        browser.close()

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total charts (canvas): {len(results['charts'])}")
    print(f"Errors: {len(results['errors'])}")

    # Save results
    with open('/tmp/chart_verify_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    print("\nResults saved to: /tmp/chart_verify_results.json")

if __name__ == '__main__':
    main()