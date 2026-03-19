# -*- coding: utf-8 -*-
"""
Test Operation Analysis page charts with Playwright
Compare new React frontend with old native JS frontend
"""
import sys
import os
import time
from pathlib import Path

# Add paths for portable Python
base_dir = Path(__file__).parent.parent / "开发代码"
lib_dir = base_dir / "lib"
sys.path.insert(0, str(base_dir))
sys.path.insert(0, str(lib_dir))

from playwright.sync_api import sync_playwright

def test_operation_analysis():
    """Test Operation Analysis page in both frontends"""

    # Ensure directories exist
    output_dir = Path(__file__).parent / "screenshots"
    output_dir.mkdir(exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ===== Test New React Frontend =====
        print("\n" + "="*60)
        print("Testing NEW Frontend (React)")
        print("="*60)

        page_new = browser.new_page()
        page_new.set_viewport_size({"width": 1920, "height": 1080})

        # Navigate to new React frontend - Operation Analysis directly
        page_new.goto('http://127.0.0.1:5173/xhs-notes/operation')
        page_new.wait_for_load_state('networkidle')
        time.sleep(8)  # Wait for metadata fetch and charts to render

        # Take screenshot
        page_new.screenshot(path=str(output_dir / 'new_operation_analysis.png'), full_page=True)
        print(f"Screenshot saved: new_operation_analysis.png")

        # Check for chart containers
        chart_containers_new = page_new.locator('[class*="chart"], [class*="Chart"]').all()
        print(f"Found {len(chart_containers_new)} chart containers in new frontend")

        # Check for Ant Design Charts (canvas elements)
        charts_info = page_new.evaluate('''() => {
            const charts = [];
            // Check for canvas elements (used by Ant Design Charts/G2)
            document.querySelectorAll('canvas').forEach(canvas => {
                const parent = canvas.closest('[class*="chart"], [class*="Chart"], [class*="card"]');
                charts.push({
                    canvasSize: `${canvas.width}x${canvas.height}`,
                    parentClass: parent ? parent.className : 'unknown',
                    hasContent: canvas.width > 0 && canvas.height > 0
                });
            });
            return charts;
        }''')
        print(f"Canvas elements in new frontend: {len(charts_info)}")
        for i, chart in enumerate(charts_info[:5]):  # Show first 5
            print(f"  Canvas {i+1}: {chart['canvasSize']} - {chart['parentClass'][:50] if chart['parentClass'] else 'unknown'}")

        # Check for "暂无数据" messages
        no_data_messages = page_new.locator('text=暂无数据').all()
        print(f"'暂无数据' messages found: {len(no_data_messages)}")

        # Check for loading states
        loading_states = page_new.locator('.ant-spin, [class*="loading"]').all()
        print(f"Loading states found: {len(loading_states)}")

        # Test API endpoint directly
        api_result = page_new.evaluate('''async () => {
            const response = await fetch('/api/v1/xhs-notes-operation-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: '2026-02-11',
                    end_date: '2026-03-13'
                })
            });
            const data = await response.json();
            return {
                success: data.success,
                hasData: data.data && Object.keys(data.data).length > 0,
                keys: data.data ? Object.keys(data.data) : [],
                error: data.error || null
            };
        }''')
        print(f"\nAPI response check:")
        print(f"  Success: {api_result['success']}")
        print(f"  Has data: {api_result['hasData']}")
        print(f"  Data keys: {api_result['keys']}")
        if api_result['error']:
            print(f"  Error: {api_result['error']}")

        page_new.screenshot(path=str(output_dir / 'new_operation_analysis_final.png'), full_page=True)

        # ===== Test Old Frontend =====
        print("\n" + "="*60)
        print("Testing OLD Frontend (Native JS)")
        print("="*60)

        page_old = browser.new_page()
        page_old.set_viewport_size({"width": 1920, "height": 1080})

        # Navigate to old frontend
        page_old.goto('http://127.0.0.1:5000')
        page_old.wait_for_load_state('networkidle')
        time.sleep(2)

        # Take screenshot of main page
        page_old.screenshot(path=str(output_dir / 'old_frontend_main.png'))
        print(f"Screenshot saved: old_frontend_main.png")

        # Navigate to XHS Notes - Operation Analysis
        try:
            # Click on 小红书报表 menu
            xhs_menu = page_old.locator('text=小红书报表')
            if xhs_menu.count() > 0:
                xhs_menu.click()
                time.sleep(1)

                # Click on 运营分析
                operation_menu = page_old.locator('text=运营分析')
                if operation_menu.count() > 0:
                    operation_menu.click()
                    page_old.wait_for_load_state('networkidle')
                    time.sleep(3)

                    page_old.screenshot(path=str(output_dir / 'old_operation_analysis.png'), full_page=True)
                    print(f"Screenshot saved: old_operation_analysis.png")

                    # Check for chart containers
                    chart_containers = page_old.locator('.chart-container, .chart-card, [id*="chart"], [class*="chart"]').all()
                    print(f"Found {len(chart_containers)} chart containers in old frontend")

                    # Check for ECharts instances
                    charts_rendered = page_old.evaluate('''() => {
                        const charts = [];
                        // Check for ECharts instances
                        if (window.echarts && window.echarts.getInstanceByDom) {
                            document.querySelectorAll('[id]').forEach(el => {
                                const chart = echarts.getInstanceByDom(el);
                                if (chart) {
                                    charts.push({
                                        id: el.id,
                                        hasData: chart.getOption() && chart.getOption().series && chart.getOption().series.length > 0
                                    });
                                }
                            });
                        }
                        return charts;
                    }''')
                    print(f"ECharts instances in old frontend: {len(charts_rendered)}")
                    for chart in charts_rendered[:5]:
                        print(f"  {chart['id']}: hasData={chart['hasData']}")

                else:
                    print("Could not find 运营分析 menu in old frontend")
            else:
                print("Could not find 小红书报表 menu in old frontend")
        except Exception as e:
            print(f"Error navigating old frontend: {e}")
            page_old.screenshot(path=str(output_dir / 'old_frontend_error.png'))

        browser.close()

    print("\n" + "="*60)
    print("Test completed. Screenshots saved to:")
    print(f"  {output_dir}")
    print("="*60)

if __name__ == "__main__":
    test_operation_analysis()