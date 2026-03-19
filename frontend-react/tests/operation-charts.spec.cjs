/**
 * Test Operation Analysis page charts with Playwright
 * Compare new React frontend with old native JS frontend
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Configure test
test.use({
  viewport: { width: 1920, height: 1080 },
  screenshot: 'on',
  video: 'retain-on-failure',
});

test.describe('Operation Analysis Charts Comparison', () => {
  const screenshotDir = path.join(__dirname, 'screenshots');

  test.beforeAll(() => {
    // Create screenshot directory
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('Check Metadata API returns xhs_notes_date_range', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('Checking Metadata API');
    console.log('='.repeat(60));

    // Check metadata API directly
    const response = await page.request.get('http://127.0.0.1:5000/api/v1/metadata');
    const data = await response.json();

    console.log('xhs_notes_date_range:', data.data?.xhs_notes_date_range);

    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('xhs_notes_date_range');
    expect(data.data.xhs_notes_date_range.start).toBeTruthy();
    expect(data.data.xhs_notes_date_range.end).toBeTruthy();
  });

  test('New Frontend - Operation Analysis Page Direct Navigation', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('Testing NEW Frontend (React) - Operation Analysis');
    console.log('='.repeat(60));

    // Navigate directly to Operation Analysis page
    await page.goto('http://127.0.0.1:5173/xhs-notes/operation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000); // Wait for metadata fetch and charts to render

    // Take screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'new_operation_analysis.png'),
      fullPage: true
    });
    console.log('Screenshot saved: new_operation_analysis.png');

    // Check for chart containers
    const chartContainers = await page.locator('[class*="chart"], [class*="Chart"], canvas').count();
    console.log(`Found ${chartContainers} chart/canvas elements in new frontend`);

    // Check for canvas elements (used by Ant Design Charts/G2)
    const chartsInfo = await page.evaluate(() => {
      const charts = [];
      document.querySelectorAll('canvas').forEach(canvas => {
        const parent = canvas.closest('[class*="chart"], [class*="Chart"], [class*="card"]');
        charts.push({
          canvasSize: `${canvas.width}x${canvas.height}`,
          parentClass: parent ? parent.className : 'unknown',
          hasContent: canvas.width > 0 && canvas.height > 0
        });
      });
      return charts;
    });
    console.log('Canvas elements in new frontend:', JSON.stringify(chartsInfo, null, 2));

    // Check for "暂无数据" messages
    const noDataMessages = await page.locator('text=暂无数据').count();
    console.log(`'暂无数据' messages found: ${noDataMessages}`);

    // Check for loading states
    const loadingStates = await page.locator('.ant-spin, [class*="loading"], [class*="Loading"]').count();
    console.log(`Loading states found: ${loadingStates}`);

    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    // Test the API endpoint directly
    const dataLoaded = await page.evaluate(async () => {
      // Check if API was called and returned data
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
        keys: data.data ? Object.keys(data.data) : []
      };
    });
    console.log('API response check:', JSON.stringify(dataLoaded, null, 2));

    // Take final screenshot
    await page.screenshot({
      path: path.join(screenshotDir, 'new_operation_analysis_final.png'),
      fullPage: true
    });

    // Assertions
    expect(chartsInfo.length).toBeGreaterThan(0);
    expect(noDataMessages).toBe(0); // No "暂无数据" messages should appear
  });

  test('Old Frontend - Operation Analysis', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('Testing OLD Frontend (Native JS)');
    console.log('='.repeat(60));

    // Navigate to old frontend
    await page.goto('http://127.0.0.1:5000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot of main page
    await page.screenshot({ path: path.join(screenshotDir, 'old_frontend_main.png') });
    console.log('Screenshot saved: old_frontend_main.png');

    // Try to find and click menu items
    try {
      // Check for sidebar menu structure
      const sidebar = page.locator('.sidebar, [class*="sidebar"], nav');
      if (await sidebar.count() > 0) {
        console.log('Found sidebar element');
      }

      // Try different menu selectors
      const menuItems = await page.locator('a, button, [role="menuitem"]').allTextContents();
      console.log('Menu items found:', menuItems.slice(0, 10));

      // Try to find XHS menu
      const xhsMenuItem = page.locator('text=/小红书|XHS|xhs-notes/i').first();
      if (await xhsMenuItem.count() > 0) {
        await xhsMenuItem.click();
        await page.waitForTimeout(1000);
        console.log('Clicked on 小红书报表 menu');
      }

      // Try to find operation menu
      const operationMenuItem = page.locator('text=/运营分析|operation/i').first();
      if (await operationMenuItem.count() > 0) {
        await operationMenuItem.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        console.log('Clicked on 运营分析 menu');
      }

      await page.screenshot({
        path: path.join(screenshotDir, 'old_operation_analysis.png'),
        fullPage: true
      });
      console.log('Screenshot saved: old_operation_analysis.png');

      // Check for chart containers
      const chartContainers = await page.locator('.chart-container, .chart-card, [id*="chart"], [class*="chart"]').count();
      console.log(`Found ${chartContainers} chart containers in old frontend`);

      // Check for ECharts instances
      const chartsRendered = await page.evaluate(() => {
        const charts = [];
        if (window.echarts && window.echarts.getInstanceByDom) {
          document.querySelectorAll('[id]').forEach(el => {
            const chart = echarts.getInstanceByDom(el);
            if (chart) {
              const option = chart.getOption();
              charts.push({
                id: el.id,
                hasData: option && option.series && option.series.length > 0
              });
            }
          });
        }
        return charts;
      });
      console.log('ECharts instances in old frontend:', JSON.stringify(chartsRendered, null, 2));

    } catch (e) {
      console.log('Error navigating old frontend:', e.message);
      await page.screenshot({ path: path.join(screenshotDir, 'old_frontend_error.png') });
    }
  });
});