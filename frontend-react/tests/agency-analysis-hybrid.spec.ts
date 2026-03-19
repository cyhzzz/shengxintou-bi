// 开发代码/frontend-react/tests/agency-analysis-hybrid.spec.ts
/**
 * 厂商分析页面混合迁移测试
 * 测试 Ant Design 筛选器 + 旧版图表/表格渲染
 */
import { test, expect } from '@playwright/test';

test.describe('厂商分析页面测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问页面（Vite 开发服务器端口）
    await page.goto('http://localhost:3001/agency-analysis');
    // 等待 DOM 加载完成（Vite 开发模式有 WebSocket，不适合用 networkidle）
    await page.waitForLoadState('domcontentloaded');
    // 等待 React 渲染完成（等待筛选器出现）
    await page.waitForSelector('.ant-card', { timeout: 10000 });
    // 等待旧版 JS 加载和初始化
    await page.waitForTimeout(3000);
  });

  test('应该显示筛选器', async ({ page }) => {
    // 检查筛选器存在
    const filterBar = page.locator('.ant-card').first();
    await expect(filterBar).toBeVisible();

    // 检查平台筛选器
    const platformFilter = page.locator('text=平台:');
    await expect(platformFilter).toBeVisible();
  });

  test('应该显示汇总统计卡片', async ({ page }) => {
    // 检查统计卡片
    const totalCost = page.locator('text=总花费');
    await expect(totalCost).toBeVisible();

    const totalImpressions = page.locator('text=总曝光');
    await expect(totalImpressions).toBeVisible();
  });

  test('应该显示日级趋势图', async ({ page }) => {
    // 检查趋势图容器（React 页面中的）
    const chartContainer = page.locator('#root #trendChart').first();
    await expect(chartContainer).toBeVisible();

    // 检查图表标题（React 页面中的）
    const chartTitle = page.locator('#root').getByRole('heading', { name: '日级趋势图' });
    await expect(chartTitle).toBeVisible();
  });

  test('应该显示聚合数据表格', async ({ page }) => {
    // 检查表格容器（React 页面中的）
    const tableContainer = page.locator('#root #agencyTable').first();
    await expect(tableContainer).toBeVisible();

    // 检查表格标题（React 页面中的）
    const tableTitle = page.locator('#root').getByRole('heading', { name: '平台×代理商聚合数据' });
    await expect(tableTitle).toBeVisible();
  });

  test('筛选器查询应该刷新图表和表格', async ({ page }) => {
    // 点击查询按钮
    const searchButton = page.locator('button:has-text("查询")');
    await searchButton.click();

    // 等待数据加载
    await page.waitForTimeout(2000);

    // 检查加载状态消失
    const loadingSpinner = page.locator('.ant-spin-spinning');
    await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
  });

  test('指标切换应该更新图表', async ({ page }) => {
    // 找到指标切换组件
    const metricSelector = page.locator('.ant-segmented').first();

    // 点击"曝光"选项
    const impressionsOption = metricSelector.locator('.ant-segmented-item:has-text("曝光")');
    await impressionsOption.click();

    // 等待图表更新
    await page.waitForTimeout(500);

    // 验证选中状态（Ant Design 使用 ant-segmented-item-selected 类）
    await expect(impressionsOption).toHaveClass(/ant-segmented-item-selected/);
  });

  test('导出按钮应该可用', async ({ page }) => {
    // 检查导出按钮存在
    const exportButton = page.locator('button:has-text("导出Excel")');
    await expect(exportButton).toBeVisible();

    // 按钮应该可用（非禁用状态）
    await expect(exportButton).not.toBeDisabled();
  });
});