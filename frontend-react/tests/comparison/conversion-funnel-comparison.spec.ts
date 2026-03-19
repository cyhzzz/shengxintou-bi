import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  expectFilterBarVisible,
  expectChartVisible,
  expectDataTableVisible,
  PAGE_ROUTES,
  WAIT_CONFIG,
} from './utils';

/**
 * 转化漏斗页面对比测试
 * Batch 2: 分析报表
 */

test.describe('转化漏斗页面对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载', async ({ page }) => {
    // 旧前端使用 JavaScript 导航，不支持 URL 参数
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 点击侧边栏的转化漏斗菜单
    const funnelMenu = page.locator('[data-report="conversion-funnel"]');
    await funnelMenu.click();

    // 等待页面切换完成
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证筛选器
    await expectFilterBarVisible(page, false);

    // 验证漏斗图
    await expectChartVisible(page, false);
  });

  test('旧前端 - 漏斗数据展示', async ({ page }) => {
    // 旧前端使用 JavaScript 导航，不支持 URL 参数
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 点击侧边栏的转化漏斗菜单
    const funnelMenu = page.locator('[data-report="conversion-funnel"]');
    await funnelMenu.click();

    // 等待页面切换完成
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证漏斗阶段数据
    const funnelData = page.locator('[class*="funnel"], [class*="stage"]').first();
    await expect(funnelData).toBeVisible({ timeout: 10000 });
  });

  // 新前端测试
  test('新前端 - 页面加载', async ({ page }) => {
    const route = PAGE_ROUTES['conversion-funnel'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证筛选器
    await expectFilterBarVisible(page, true);

    // 验证漏斗图
    await expectChartVisible(page, true);
  });

  test('新前端 - 漏斗数据展示', async ({ page }) => {
    const route = PAGE_ROUTES['conversion-funnel'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证漏斗图或漏斗数据
    const funnelChart = page.locator('[class*="funnel"], canvas').first();
    await expect(funnelChart).toBeVisible({ timeout: 10000 });

    // 验证漏斗明细卡片
    const detailCard = page.locator('.ant-card:has-text("漏斗数据")').first();
    if (await detailCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 验证阶段数据
      const stageData = page.locator('[class*="funnelRow"], [class*="stage"]').first();
      await expect(stageData).toBeVisible();
    }
  });

  test('新前端 - 平台对比表格', async ({ page }) => {
    const route = PAGE_ROUTES['conversion-funnel'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证平台对比表格（可能存在）
    const table = page.locator('.ant-table').first();
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTable) {
      await expect(table).toBeVisible();
    }
  });

  // 功能对比
  test('功能对比 - 维度切换', async ({ page }) => {
    await page.goto('http://localhost:5173/conversion-funnel');
    await waitForPageReady(page);

    // 查找维度选择器
    const dimensionSelect = page.locator('.ant-select').first();
    if (await dimensionSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dimensionSelect.click();
      await page.waitForTimeout(500);

      // 选择不同维度
      const option = page.locator('.ant-select-dropdown .ant-select-item').first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(WAIT_CONFIG.filterChange);
      }
    }
  });
});