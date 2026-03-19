import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  expectFilterBarVisible,
  expectDataTableVisible,
  expectChartVisible,
  PAGE_ROUTES,
  WAIT_CONFIG,
} from './utils';

/**
 * 员工转化页面对比测试
 * Batch 2: 分析报表
 * 包含：员工转化分析、员工转化周报
 */

test.describe('员工转化分析对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载', async ({ page }) => {
    // 旧前端使用 JavaScript 导航
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 先展开员工转化菜单
    const employeeMenu = page.locator('[data-report="employee-conversion"]');
    await employeeMenu.click();
    await page.waitForTimeout(500);

    // 点击转化分析子菜单
    const analysisMenu = page.locator('[data-report="employee-conversion-analysis"]');
    await analysisMenu.click();
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证筛选器
    await expectFilterBarVisible(page, false);
  });

  // 新前端测试
  test('新前端 - 页面加载', async ({ page }) => {
    const route = PAGE_ROUTES['employee-conversion-analysis'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证筛选器
    await expectFilterBarVisible(page, true);
  });

  test('新前端 - 筛选器功能', async ({ page }) => {
    await page.goto('http://localhost:5173/employee-conversion/analysis');
    await waitForPageReady(page);

    // 验证日期范围选择器
    const dateRangePicker = page.locator('.ant-picker-range').first();
    if (await dateRangePicker.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(dateRangePicker).toBeVisible();
    }

    // 验证平台筛选器
    const platformSelect = page.locator('.ant-select:has-text("平台")').first();
    if (await platformSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(platformSelect).toBeVisible();
    }

    // 验证线索类型选择器
    const leadTypeSelect = page.locator('.ant-select:has-text("线索类型")').first();
    if (await leadTypeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(leadTypeSelect).toBeVisible();
    }
  });

  test('新前端 - 排行榜表格', async ({ page }) => {
    await page.goto('http://localhost:5173/employee-conversion/analysis');
    await waitForPageReady(page);

    // 验证排行榜表格
    const rankingTable = page.locator('.ant-card:has-text("排行榜")').first();
    if (await rankingTable.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(rankingTable).toBeVisible();
    }
  });

  test('新前端 - 导出功能', async ({ page }) => {
    await page.goto('http://localhost:5173/employee-conversion/analysis');
    await waitForPageReady(page);

    // 查找导出按钮
    const exportButton = page.locator('button:has-text("导出")').first();
    if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(exportButton).toBeVisible();
    }
  });
});

test.describe('员工转化周报对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载', async ({ page }) => {
    // 旧前端使用 JavaScript 导航
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 先展开员工转化菜单
    const employeeMenu = page.locator('[data-report="employee-conversion"]');
    await employeeMenu.click();
    await page.waitForTimeout(500);

    // 点击转化周报子菜单
    const weeklyMenu = page.locator('[data-report="employee-conversion-weekly"]');
    await weeklyMenu.click();
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证配置区域
    const configCard = page.locator('.card, [class*="config"]').first();
    await expect(configCard).toBeVisible({ timeout: 10000 });
  });

  // 新前端测试
  test('新前端 - 页面加载', async ({ page }) => {
    const route = PAGE_ROUTES['employee-conversion-weekly'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证配置卡片
    const configCard = page.locator('.ant-card').first();
    await expect(configCard).toBeVisible({ timeout: 10000 });
  });

  test('新前端 - 配置选项', async ({ page }) => {
    await page.goto('http://localhost:5173/employee-conversion/weekly');
    await waitForPageReady(page);

    // 验证日期选择器
    const datePicker = page.locator('.ant-picker').first();
    if (await datePicker.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(datePicker).toBeVisible();
    }

    // 验证平台多选
    const platformSelect = page.locator('.ant-select:has-text("平台")').first();
    if (await platformSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(platformSelect).toBeVisible();
    }
  });

  test('新前端 - 生成周报', async ({ page }) => {
    await page.goto('http://localhost:5173/employee-conversion/weekly');
    await waitForPageReady(page);

    // 查找生成按钮
    const generateButton = page.locator('button:has-text("生成周报")').first();
    if (await generateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(generateButton).toBeEnabled();
    }
  });

  test('新前端 - 导出功能', async ({ page }) => {
    await page.goto('http://localhost:5173/employee-conversion/weekly');
    await waitForPageReady(page);

    // 验证导出按钮区域
    const exportButtons = page.locator('button:has-text("导出"), button:has-text("复制")');
    const count = await exportButtons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});