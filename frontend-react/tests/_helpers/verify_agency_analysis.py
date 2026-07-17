# -*- coding: utf-8 -*-
"""
Verify AgencyAnalysis page fixes:
1. Card heights are consistent in the summary row
2. Daily trend chart shows stacked bar chart correctly
3. Table shows total row at top with no pagination and has CSV export button
"""
from playwright.sync_api import sync_playwright
import os
from pathlib import Path

# Create output directory
output_dir = Path(__file__).parent / "screenshots"
output_dir.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1920, "height": 1080})

    print("1. Navigating to http://localhost:5173...")
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')

    # Take screenshot of homepage
    page.screenshot(path=str(output_dir / "01-homepage.png"))
    print("   Homepage loaded")

    # Navigate to AgencyAnalysis page
    print("2. Navigating to AgencyAnalysis page...")

    # Try to find and click the menu item
    try:
        # Find the menu item by text
        agency_menu = page.locator('text=厂商分析').first
        if agency_menu.is_visible():
            agency_menu.click()
            print("   Clicked menu item")
        else:
            # Try direct navigation
            page.goto('http://localhost:5173/#/agency-analysis')
            print("   Navigated directly to agency-analysis route")
    except Exception as e:
        print(f"   Menu click failed: {e}, trying direct URL...")
        page.goto('http://localhost:5173/#/agency-analysis')

    # Wait for the page to load
    page.wait_for_timeout(3000)
    page.wait_for_load_state('networkidle')

    # Take screenshot of the AgencyAnalysis page
    page.screenshot(path=str(output_dir / "02-agency-analysis.png"), full_page=True)
    print("   AgencyAnalysis page loaded")

    # Get page content for analysis
    content = page.content()

    # ===== Verification 1: Card heights =====
    print("\n3. Verifying card heights in summary row...")

    # Find all cards in the summary row
    summary_cards = page.locator('.ant-card').all()
    print(f"   Found {len(summary_cards)} cards on the page")

    # Check if the summary row exists (looking for Statistic components)
    statistics = page.locator('.ant-statistic').all()
    print(f"   Found {len(statistics)} statistic components")

    # Check card heights
    card_heights = []
    for i, card in enumerate(summary_cards[:6]):  # Check first 6 cards (summary row)
        try:
            box = card.bounding_box()
            if box:
                card_heights.append({
                    'index': i,
                    'height': box['height'],
                    'width': box['width']
                })
        except:
            pass

    print("   Card dimensions:")
    for h in card_heights:
        print(f"     Card {h['index']}: {h['width']:.0f}x{h['height']:.0f}")

    # Check summary row cards (cards 1-5 should be the metric cards)
    summary_card_heights = [h['height'] for h in card_heights[1:6] if h['index'] > 0]
    if summary_card_heights:
        min_height = min(summary_card_heights)
        max_height = max(summary_card_heights)
        height_diff = max_height - min_height
        print(f"   Summary cards height difference: {height_diff:.0f}px (tolerance: 5px)")
        if height_diff <= 5:
            print("   [PASS] Card heights are consistent")
        else:
            print(f"   [WARN] Card heights may be inconsistent (diff={height_diff:.0f}px)")

    # ===== Verification 2: Stacked bar chart =====
    print("\n4. Verifying stacked bar chart...")

    # Look for chart container
    chart_container = page.locator('.chart-container, [class*="chart"], canvas').first
    if chart_container.is_visible():
        print("   [PASS] Chart container found")

        # Take screenshot of chart area
        try:
            chart_container.screenshot(path=str(output_dir / "03-chart.png"))
            print("   Chart screenshot saved")
        except:
            page.screenshot(path=str(output_dir / "03-chart.png"))
    else:
        print("   [WARN] Chart container not visible")

    # Check for canvas element (ECharts/Ant Design Charts use canvas)
    canvas_count = page.locator('canvas').count()
    print(f"   Found {canvas_count} canvas elements")

    # ===== Verification 3: Table structure =====
    print("\n5. Verifying table structure...")

    # Find the table
    table = page.locator('.ant-table').first
    if table.is_visible():
        print("   [PASS] Table found")

        # Check for total row at top
        first_row = table.locator('.ant-table-tbody tr').first
        first_row_text = first_row.text_content() if first_row else ""
        print(f"   First row text preview: {first_row_text[:100]}...")

        if '总计' in first_row_text or '合计' in first_row_text:
            print("   [PASS] Total row appears to be at the top")
        else:
            print("   [WARN] First row may not be the total row")

        # Check for pagination
        pagination = page.locator('.ant-pagination')
        if pagination.count() > 0 and pagination.first.is_visible():
            print("   [WARN] Pagination is visible (expected: hidden)")
        else:
            print("   [PASS] No pagination visible (as expected)")

        # Check for CSV export button
        export_button = page.locator('button:has-text("导出CSV"), button:has-text("导出"), button:has-text("CSV")')
        if export_button.count() > 0:
            print("   [PASS] Export button found")
            try:
                export_button.first.screenshot(path=str(output_dir / "04-export-button.png"))
            except:
                pass
        else:
            # Look for any button with download icon or export icon
            download_buttons = page.locator('button[aria-label*="download"], button[aria-label*="export"], .anticon-download, .anticon-export')
            if download_buttons.count() > 0:
                print("   [PASS] Export icon button found")
            else:
                print("   [WARN] No export button visible - checking all buttons...")
                all_buttons = page.locator('button').all()
                button_texts = [b.text_content() for b in all_buttons[:10]]
                print(f"   Button texts found: {button_texts}")

        # Take screenshot of table
        table.screenshot(path=str(output_dir / "05-table.png"))
        print("   Table screenshot saved")
    else:
        print("   [WARN] Table not found")

    # Final full page screenshot
    page.screenshot(path=str(output_dir / "06-full-page.png"), full_page=True)

    print("\n6. Verification complete!")
    print(f"   Screenshots saved to: {output_dir}")

    browser.close()