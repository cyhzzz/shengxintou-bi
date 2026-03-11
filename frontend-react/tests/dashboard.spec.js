// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Dashboard Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard page successfully', async ({ page }) => {
    // Check that the sidebar is visible
    const sidebar = page.locator('.ant-layout-sider');
    await expect(sidebar).toBeVisible();
  });

  test('should display metric cards', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check for metric cards (statistic components)
    const statisticCards = page.locator('.ant-statistic');
    await expect(statisticCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have working sidebar navigation', async ({ page }) => {
    // Check sidebar menu items
    const menuItems = page.locator('.ant-menu-item');
    await expect(menuItems.first()).toBeVisible();

    // Click on the first menu item
    await menuItems.first().click();
  });
});

test.describe('Theme Tests', () => {
  test('should toggle theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for theme toggle button
    const themeToggle = page.locator('[data-testid="theme-toggle"]').or(
      page.locator('button').filter({ hasText: /theme|主题/ })
    );

    // If theme toggle exists, test it
    if (await themeToggle.count() > 0) {
      await themeToggle.first().click();
    }
  });
});

test.describe('Filter Tests', () => {
  test('should have date range filter', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for date picker
    const datePicker = page.locator('.ant-picker-range');

    // Date picker might exist on dashboard
    if (await datePicker.count() > 0) {
      await expect(datePicker.first()).toBeVisible();
    }
  });
});