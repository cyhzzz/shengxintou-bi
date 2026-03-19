import { Page, expect } from '@playwright/test';

/**
 * 对比测试工具函数
 */

// 页面路由映射
export const PAGE_ROUTES: Record<string, { old: string; new: string }> = {
  dashboard: { old: '/', new: '/dashboard' },
  'agency-analysis': { old: '/?page=agency-analysis', new: '/agency-analysis' },
  'xhs-notes-list': { old: '/?page=xhs-notes-list', new: '/xhs-notes/list' },
  'xhs-notes-operation': { old: '/?page=xhs-notes-operation', new: '/xhs-notes/operation' },
  'leads-detail': { old: '/?page=leads-detail', new: '/leads-detail' },
  'conversion-funnel': { old: '/?page=conversion-funnel', new: '/conversion-funnel' },
  'employee-conversion-analysis': { old: '/?page=employee-conversion-analysis', new: '/employee-conversion/analysis' },
  'employee-conversion-weekly': { old: '/?page=employee-conversion-weekly', new: '/employee-conversion/weekly' },
  'data-import': { old: '/?page=data-import', new: '/system/data-import' },
  'account-management': { old: '/?page=account-management', new: '/system/account-management' },
  'abbreviation-management': { old: '/?page=abbreviation-management', new: '/system/abbreviation-management' },
  'report-generation': { old: '/?page=report-generation', new: '/report-generation' },
};

// 等待时间配置
export const WAIT_CONFIG = {
  pageLoad: 3000,
  dataLoad: 2000,
  chartRender: 2000,
  filterChange: 1000,
};

/**
 * 等待页面加载完成
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(WAIT_CONFIG.pageLoad);
}

/**
 * 验证侧边栏存在
 */
export async function expectSidebarVisible(page: Page, isNewFrontend: boolean) {
  if (isNewFrontend) {
    // 新前端使用 Ant Design Layout
    const sidebar = page.locator('.ant-layout-sider, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  } else {
    // 旧前端
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  }
}

/**
 * 验证筛选器存在
 */
export async function expectFilterBarVisible(page: Page, isNewFrontend: boolean) {
  if (isNewFrontend) {
    // 新前端筛选器
    const filterBar = page.locator('.ant-card, [class*="filter"]').first();
    await expect(filterBar).toBeVisible({ timeout: 10000 });
  } else {
    // 旧前端筛选器
    const filterBar = page.locator('.filter-bar, .card--filter').first();
    await expect(filterBar).toBeVisible({ timeout: 10000 });
  }
}

/**
 * 验证数据表格存在
 */
export async function expectDataTableVisible(page: Page, isNewFrontend: boolean) {
  if (isNewFrontend) {
    // 新前端使用 Ant Design Table
    const table = page.locator('.ant-table').first();
    await expect(table).toBeVisible({ timeout: 15000 });
  } else {
    // 旧前端表格 - 使用更具体的选择器
    // 表格可能还在渲染中，需要等待更长时间
    const table = page.locator('#leadsDetailTable, .data-table, table.data-table').first();
    await expect(table).toBeVisible({ timeout: 20000 });
  }
}

/**
 * 验证图表存在
 */
export async function expectChartVisible(page: Page, isNewFrontend: boolean) {
  await page.waitForTimeout(WAIT_CONFIG.chartRender);

  if (isNewFrontend) {
    // 新前端使用 @ant-design/charts
    const chart = page.locator('[class*="chart"], canvas').first();
    await expect(chart).toBeVisible({ timeout: 15000 });
  } else {
    // 旧前端使用 ECharts
    const chart = page.locator('[id*="chart"], canvas, [class*="chart"]').first();
    await expect(chart).toBeVisible({ timeout: 15000 });
  }
}

/**
 * 验证指标卡片存在
 */
export async function expectMetricCardsVisible(page: Page, isNewFrontend: boolean) {
  if (isNewFrontend) {
    // 新前端使用 Ant Design Card/Statistic
    const cards = page.locator('.ant-card, [class*="metric"]').first();
    await expect(cards).toBeVisible({ timeout: 10000 });
  } else {
    // 旧前端指标卡片
    const cards = page.locator('.metric-card, .card--metric, .card').first();
    await expect(cards).toBeVisible({ timeout: 10000 });
  }
}

/**
 * 获取页面截图并保存
 */
export async function takeComparisonScreenshot(
  page: Page,
  pageName: string,
  isNewFrontend: boolean
) {
  const prefix = isNewFrontend ? 'new' : 'old';
  await page.screenshot({
    path: `test-results/comparison/${prefix}-${pageName}.png`,
    fullPage: true,
  });
}

/**
 * 验证页面标题包含预期文本
 */
export async function expectPageTitle(page: Page, expectedText: string | RegExp) {
  await expect(page).toHaveTitle(expectedText);
}

/**
 * 点击菜单导航到指定页面
 */
export async function navigateToPage(
  page: Page,
  pageKey: string,
  isNewFrontend: boolean
) {
  const route = PAGE_ROUTES[pageKey];
  if (!route) {
    throw new Error(`Unknown page key: ${pageKey}`);
  }

  const url = isNewFrontend ? route.new : route.old;
  await page.goto(url);
  await waitForPageReady(page);
}

/**
 * 测试筛选器交互
 */
export async function testFilterInteraction(page: Page, isNewFrontend: boolean) {
  // 查找查询按钮
  let searchButton;
  if (isNewFrontend) {
    searchButton = page.locator('button:has-text("查询"), .ant-btn-primary:has-text("查询")').first();
  } else {
    searchButton = page.locator('.btn--primary:has-text("查询"), button:has-text("查询")').first();
  }

  if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchButton.click();
    await page.waitForTimeout(WAIT_CONFIG.filterChange);
  }
}

/**
 * 测试表格排序
 */
export async function testTableSorting(page: Page, isNewFrontend: boolean) {
  // 查找表头排序图标
  let sortHeader;
  if (isNewFrontend) {
    sortHeader = page.locator('.ant-table-thead th:has(.ant-table-column-sorters)').first();
  } else {
    sortHeader = page.locator('th[data-sortable="true"], th.sortable').first();
  }

  if (await sortHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sortHeader.click();
    await page.waitForTimeout(WAIT_CONFIG.filterChange);
  }
}

/**
 * 验证数据是否存在
 */
export async function expectDataLoaded(page: Page, isNewFrontend: boolean): Promise<boolean> {
  await page.waitForTimeout(WAIT_CONFIG.dataLoad);

  if (isNewFrontend) {
    // 检查是否有数据行
    const rows = await page.locator('.ant-table-tbody tr').count();
    return rows > 0;
  } else {
    // 检查是否有数据行
    const rows = await page.locator('tbody tr').count();
    return rows > 0;
  }
}

/**
 * 验证侧边栏（简化版，用于测试文件）
 */
export async function verifySidebar(page: Page, frontendType: 'old' | 'new') {
  const isNewFrontend = frontendType === 'new';
  await expectSidebarVisible(page, isNewFrontend);
}

/**
 * 验证筛选器（简化版，用于测试文件）
 */
export async function verifyFilterBar(page: Page, frontendType: 'old' | 'new') {
  const isNewFrontend = frontendType === 'new';
  await expectFilterBarVisible(page, isNewFrontend);
}