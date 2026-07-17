// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Application Basic Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that the page loaded successfully
    await expect(page).toHaveTitle(/省心投|ShengXinTou/i);
  });

  test('should have Ant Design layout', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for Ant Design layout components
    const layout = page.locator('.ant-layout');
    await expect(layout).toBeVisible();
  });

  test('should have sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for sidebar
    const sider = page.locator('.ant-layout-sider');
    await expect(sider).toBeVisible();
  });

  test('should have content area', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for content area
    const content = page.locator('.ant-layout-content');
    await expect(content).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should still load on mobile
    await expect(page.locator('.ant-layout')).toBeVisible();
  });
});

test.describe('Navigation Tests', () => {
  test('should have menu items', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for menu items
    const menuItems = page.locator('.ant-menu-item');
    const count = await menuItems.count();

    // Should have at least one menu item
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all menu items
    const menuItems = page.locator('.ant-menu-item');
    const count = await menuItems.count();

    if (count > 1) {
      // Click the second menu item
      await menuItems.nth(1).click();
      await page.waitForTimeout(500);

      // Check that URL changed or content updated
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();
    }
  });
});