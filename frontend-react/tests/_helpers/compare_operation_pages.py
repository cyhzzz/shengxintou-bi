# -*- coding: utf-8 -*-
"""
Compare XHS Operation Analysis pages between old and new frontends
"""
from playwright.sync_api import sync_playwright
import json
import time

def main():
    results = {
        'old_frontend': {},
        'new_frontend': {},
        'api_responses': {}
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ============================================
        # 1. Test Old Frontend (Port 5000)
        # ============================================
        print("Testing OLD frontend on port 5000...")
        old_page = browser.new_page()

        # Capture console logs
        old_console_logs = []
        old_page.on('console', lambda msg: old_console_logs.append(f"[{msg.type}] {msg.text}"))

        try:
            # Navigate to old frontend
            old_page.goto('http://127.0.0.1:5000')
            old_page.wait_for_load_state('networkidle')
            time.sleep(1)

            # Take screenshot of initial page
            old_page.screenshot(path='/tmp/old_frontend_initial.png', full_page=True)
            print("  Initial screenshot saved: /tmp/old_frontend_initial.png")

            # Find and click on XHS Reports menu item (try multiple selectors)
            try:
                # Try to find the sidebar menu
                sidebar = old_page.locator('.sidebar, .sidebar-nav, nav').first
                if sidebar.is_visible():
                    # Look for menu items containing "小红书"
                    menu_items = sidebar.locator('li, .menu-item, .nav-item').all()
                    for item in menu_items:
                        text = item.text_content()
                        if '小红书' in text or 'xhs' in text.lower():
                            print(f"  Found menu item: {text[:30]}...")
                            item.click()
                            time.sleep(0.5)
                            break

                    # Now look for "运营分析" submenu
                    time.sleep(0.5)
                    sub_items = sidebar.locator('li, .submenu-item, .nav-sub-item').all()
                    for item in sub_items:
                        text = item.text_content()
                        if '运营分析' in text:
                            print(f"  Found submenu: {text}")
                            item.click()
                            break
            except Exception as e:
                print(f"  Menu navigation error: {e}")

            old_page.wait_for_load_state('networkidle')
            time.sleep(3)  # Wait for data to load

            # Take screenshot
            old_page.screenshot(path='/tmp/old_frontend_operation.png', full_page=True)
            print("  Screenshot saved: /tmp/old_frontend_operation.png")

            # Check tables
            old_tables = old_page.locator('table').all()
            results['old_frontend']['table_count'] = len(old_tables)
            print(f"  Found {len(old_tables)} tables")

            # Check if charts rendered (look for canvas elements)
            old_canvases = old_page.locator('canvas').all()
            results['old_frontend']['canvas_count'] = len(old_canvases)
            print(f"  Found {len(old_canvases)} canvas elements (charts)")

            # Check for ECharts instances
            old_echarts = old_page.evaluate('() => typeof echarts !== "undefined"')
            results['old_frontend']['has_echarts'] = old_echarts

            results['old_frontend']['console_errors'] = [log for log in old_console_logs if 'error' in log.lower()]

        except Exception as e:
            results['old_frontend']['error'] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # 2. Test New Frontend (Port 3005)
        # ============================================
        print("\nTesting NEW frontend on port 3005...")
        new_page = browser.new_page()

        # Capture console logs
        new_console_logs = []
        new_page.on('console', lambda msg: new_console_logs.append(f"[{msg.type}] {msg.text}"))

        try:
            # Navigate to new frontend
            new_page.goto('http://localhost:3005')
            new_page.wait_for_load_state('networkidle')
            time.sleep(1)

            # Take screenshot of initial page
            new_page.screenshot(path='/tmp/new_frontend_initial.png', full_page=True)
            print("  Initial screenshot saved: /tmp/new_frontend_initial.png")

            # Find and click on XHS Reports menu item
            try:
                # Try to find the sidebar menu
                sidebar = new_page.locator('.ant-layout-sider, nav, aside').first
                if sidebar.is_visible():
                    # Look for menu items containing "小红书"
                    menu_items = sidebar.locator('.ant-menu-item, .ant-menu-submenu-title').all()
                    for item in menu_items:
                        text = item.text_content()
                        if '小红书' in text or 'xhs' in text.lower():
                            print(f"  Found menu item: {text[:30]}...")
                            item.click()
                            time.sleep(0.5)
                            break

                    # Now look for "运营分析" submenu
                    time.sleep(0.5)
                    sub_items = sidebar.locator('.ant-menu-item').all()
                    for item in sub_items:
                        text = item.text_content()
                        if '运营分析' in text:
                            print(f"  Found submenu: {text}")
                            item.click()
                            break
            except Exception as e:
                print(f"  Menu navigation error: {e}")

            new_page.wait_for_load_state('networkidle')
            time.sleep(3)  # Wait for data to load

            # Take screenshot
            new_page.screenshot(path='/tmp/new_frontend_operation.png', full_page=True)
            print("  Screenshot saved: /tmp/new_frontend_operation.png")

            # Check tables
            new_tables = new_page.locator('table, .ant-table').all()
            results['new_frontend']['table_count'] = len(new_tables)
            print(f"  Found {len(new_tables)} tables")

            # Check if charts rendered (look for canvas elements)
            new_canvases = new_page.locator('canvas').all()
            results['new_frontend']['canvas_count'] = len(new_canvases)
            print(f"  Found {len(new_canvases)} canvas elements (charts)")

            # Check for Ant Design Charts
            new_antv = new_page.evaluate('() => typeof window.G2 !== "undefined"')
            results['new_frontend']['has_antv_g2'] = new_antv

            results['new_frontend']['console_errors'] = [log for log in new_console_logs if 'error' in log.lower()]

        except Exception as e:
            results['new_frontend']['error'] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # 3. Capture API Response Data
        # ============================================
        print("\nCapturing API response data...")

        # Create a new page to directly call the API
        api_page = browser.new_page()

        # Get API data
        try:
            # Use the backend API directly
            api_response = api_page.request.post(
                'http://127.0.0.1:5000/api/v1/xhs-notes-operation-analysis',
                headers={'Content-Type': 'application/json'},
                data=json.dumps({
                    'filters': {
                        'date_range': ['2025-02-01', '2025-03-15']
                    }
                })
            )
            api_data = api_response.json()

            # Store full API response
            results['api_responses']['full_data'] = api_data

            # Store structure info
            results['api_responses']['structure'] = {
                'success': api_data.get('success'),
                'data_keys': list(api_data.get('data', {}).keys()) if api_data.get('data') else [],
            }

            print(f"  API response success: {api_data.get('success')}")
            print(f"  Data keys: {results['api_responses']['structure']['data_keys']}")

            # Check each data section
            data = api_data.get('data', {})
            for key in ['core_metrics', 'creation_trend', 'conversion_trend', 'top_notes',
                        'creator_annual_ranking', 'employee_weekly_conversion', 'employee_conversion_ranking',
                        'note_conversion_ranking', 'agency_data']:
                value = data.get(key)
                if value:
                    if isinstance(value, list):
                        print(f"  {key}: {len(value)} items")
                        if len(value) > 0:
                            print(f"    First item keys: {list(value[0].keys()) if isinstance(value[0], dict) else type(value[0])}")
                    elif isinstance(value, dict):
                        print(f"  {key}: dict with keys {list(value.keys())}")
                    else:
                        print(f"  {key}: {type(value).__name__}")
                else:
                    print(f"  {key}: EMPTY or NULL")

        except Exception as e:
            results['api_responses']['error'] = str(e)
            print(f"  ERROR fetching API: {e}")

        browser.close()

    # Print summary
    print("\n" + "="*60)
    print("COMPARISON SUMMARY")
    print("="*60)

    print(f"\nOld Frontend (port 5000):")
    print(f"  Tables: {results['old_frontend'].get('table_count', 'N/A')}")
    print(f"  Charts (canvas): {results['old_frontend'].get('canvas_count', 'N/A')}")
    print(f"  Has ECharts: {results['old_frontend'].get('has_echarts', 'N/A')}")
    print(f"  Console errors: {len(results['old_frontend'].get('console_errors', []))}")

    print(f"\nNew Frontend (port 3005):")
    print(f"  Tables: {results['new_frontend'].get('table_count', 'N/A')}")
    print(f"  Charts (canvas): {results['new_frontend'].get('canvas_count', 'N/A')}")
    print(f"  Has AntV G2: {results['new_frontend'].get('has_antv_g2', 'N/A')}")
    print(f"  Console errors: {len(results['new_frontend'].get('console_errors', []))}")

    # Save full results to file
    with open('/tmp/operation_comparison.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)
    print("\nFull results saved to: /tmp/operation_comparison.json")

if __name__ == '__main__':
    main()