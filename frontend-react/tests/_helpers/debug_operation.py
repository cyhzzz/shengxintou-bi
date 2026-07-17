# -*- coding: utf-8 -*-
"""
Debug XHS Operation Analysis charts in new React frontend
"""
from playwright.sync_api import sync_playwright
import json
import time
import sys

# Fix encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')

def main():
    results = {
        'api_requests': [],
        'console_logs': [],
        'charts': []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on('console', lambda msg: results['console_logs'].append({
            'type': msg.type,
            'text': msg.text[:500] if len(msg.text) > 500 else msg.text
        }))

        # Capture network requests
        def on_request(request):
            if 'xhs-notes-operation' in request.url:
                results['api_requests'].append({
                    'url': request.url,
                    'method': request.method,
                    'postData': request.post_data
                })

        def on_response(response):
            if 'xhs-notes-operation' in response.url:
                try:
                    body = response.json()
                    data = body.get('data', {})
                    results['api_response'] = {
                        'status': response.status,
                        'success': body.get('success'),
                        'creator_creation_data_count': len(data.get('creator_creation_data', [])),
                        'creator_interaction_data_count': len(data.get('creator_interaction_data', [])),
                        'creation_trend_dates': len(data.get('creation_trend', {}).get('dates', [])),
                    }
                except:
                    pass

        page.on('request', on_request)
        page.on('response', on_response)

        try:
            page.goto('http://localhost:3007')
            page.wait_for_load_state('networkidle')
            time.sleep(1)

            # Navigate to XHS Operation page
            sidebar = page.locator('.ant-layout-sider').first
            if sidebar.is_visible():
                xhs_menu = sidebar.locator('.ant-menu-submenu-title').filter(has_text='小红书')
                if xhs_menu.count() > 0:
                    xhs_menu.first.click()
                    time.sleep(0.5)
                    op_item = sidebar.locator('.ant-menu-item').filter(has_text='运营分析')
                    if op_item.count() > 0:
                        op_item.first.click()
                        time.sleep(3)

            page.wait_for_load_state('networkidle')
            time.sleep(3)

            # Take screenshot
            page.screenshot(path='D:/temp/operation_debug.png', full_page=True)
            print("Screenshot saved: D:/temp/operation_debug.png")

            # Check chart cards
            chart_types = ['转化趋势', '创作量趋势', '互动量趋势', '笔记创作量', '笔记互动量']
            for chart_type in chart_types:
                card = page.locator(f'.ant-card:has-text("{chart_type}")')
                if card.count() > 0:
                    canvas_count = card.first.locator('canvas').count()
                    empty_count = card.first.locator('text=暂无数据').count()
                    status = "OK" if canvas_count > 0 and empty_count == 0 else "EMPTY" if empty_count > 0 else "NO_CANVAS"
                    print(f"  {chart_type}: {status} (canvas={canvas_count}, empty={empty_count})")
                    results['charts'].append({
                        'name': chart_type,
                        'status': status,
                        'canvas_count': canvas_count
                    })

            # Print API request info
            print("\n=== API Requests ===")
            for req in results['api_requests']:
                print(f"  {req['method']} {req['url']}")
                if req['postData']:
                    print(f"    Body: {req['postData'][:200]}")

            # Print API response info
            if 'api_response' in results:
                print("\n=== API Response ===")
                for key, value in results['api_response'].items():
                    print(f"  {key}: {value}")

            # Print errors from console
            errors = [log for log in results['console_logs'] if log['type'] == 'error']
            if errors:
                print("\n=== Console Errors ===")
                for err in errors[:5]:
                    print(f"  {err['text']}")

        except Exception as e:
            print(f"Error: {e}")
            results['error'] = str(e)

        page.close()
        browser.close()

    # Save results
    with open('D:/temp/operation_debug.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    print("\nResults saved to D:/temp/operation_debug.json")

if __name__ == '__main__':
    main()