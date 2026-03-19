// 开发代码/frontend-react/tests/agency-analysis-hybrid.spec.ts
/**
 * 厂商分析页面混合迁移测试
 * 测试 Ant Design 筛选器 + 旧版图表/表格渲染
 */
import { test, expect } from '@playwright/test';

test.describe('厂商分析页面测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问页面
    await page.goto('http://localhost:5173/agency-analysis');
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    // 等待旧版 JS 加载
    await page.waitForTimeout(2000);
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
    // 检查趋势图容器
    const chartContainer = page.locator('#trendChart');
    await expect(chartContainer).toBeVisible();

    // 检查图表标题
    const chartTitle = page.locator('text=日级趋势图');
    await expect(chartTitle).toBeVisible();
  });

  test('应该显示聚合数据表格', async ({ page }) => {
    // 检查表格容器
    const tableContainer = page.locator('#agencyTable');
    await expect(tableContainer).toBeVisible();

    // 检查表格标题
    const tableTitle = page.locator('text=平台×代理商聚合数据');
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
    const impressionsOption = metricSelector.locator('text=曝光');
    await impressionsOption.click();

    // 等待图表更新
    await page.waitForTimeout(500);

    // 验证选中状态
    await expect(impressionsOption).toHaveAttribute('aria-checked', 'true');
  });

  test('导出按钮应该可用', async ({ page }) => {
    // 检查导出按钮存在
    const exportButton = page.locator('button:has-text("导出Excel")');
    await expect(exportButton).toBeVisible();

    // 按钮应该可用（非禁用状态）
    await expect(exportButton).not.toBeDisabled();
  });
});