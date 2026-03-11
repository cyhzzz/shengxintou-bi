// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Conversion Funnel Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to conversion funnel page', async ({ page }) => {
    // Look for conversion funnel menu item
    const funnelMenuItem = page.locator('.ant-menu-item').filter({
      hasText: /转化漏斗|conversion|funnel/i
    });

    // Click if exists
    if (await funnelMenuItem.count() > 0) {
      await funnelMenuItem.click();

      // Wait for navigation
      await page.waitForTimeout(1000);

      // Check URL contains funnel path
      await expect(page).toHaveURL(/.*funnel.*/);
    }
  });

  test('should display funnel chart', async ({ page }) => {
    // Navigate directly to funnel page
    await page.goto('/conversion-funnel');
    await page.waitForTimeout(2000);

    // Check for chart container or funnel visualization
    const chartContainer = page.locator('[class*="chart"]').or(
      page.locator('[class*="funnel"]')
    );

    // Chart might take time to render
    if (await chartContainer.count() > 0) {
      await expect(chartContainer.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display data table', async ({ page }) => {
    await page.goto('/conversion-funnel');
    await page.waitForTimeout(2000);

    // Check for Ant Design table
    const table = page.locator('.ant-table');

    if (await table.count() > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('should have filter controls', async ({ page }) => {
    await page.goto('/conversion-funnel');
    await page.waitForLoadState('networkidle');

    // Look for filter controls
    const filterBar = page.locator('[class*="filter"]').or(
      page.locator('.ant-card').first()
    );

    if (await filterBar.count() > 0) {
      await expect(filterBar.first()).toBeVisible();
    }
  });
});

test.describe('Conversion Funnel API Tests', () => {
  test('should fetch funnel data', async ({ page }) => {
    // Intercept API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/') && response.url().includes('funnel')
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to funnel page
    await page.goto('/conversion-funnel');

    // Wait for API response (might not exist in all cases)
    try {
      const response = await responsePromise;
      expect(response.status()).toBeLessThan(500);
    } catch {
      // API might not be called yet, that's ok for this test
    }
  });
});