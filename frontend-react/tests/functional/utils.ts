import { Page, expect, Locator } from '@playwright/test';
import { DEFAULT_FUNCTIONAL_CONFIG, FunctionalConfig } from './types';

const config: FunctionalConfig = DEFAULT_FUNCTIONAL_CONFIG;

export const PAGE_ROUTES = {
  dashboard: '/dashboard',
  'omni-channel': '/omni-channel',
  'agency-analysis': '/agency-analysis',
  'xhs-notes-list': '/xhs-notes/list',
  'xhs-notes-operation': '/xhs-notes/operation',
  'leads-detail': '/leads-detail',
  'conversion-funnel': '/conversion-funnel',
  'anchor-clusters': '/anchor-clusters',
  'employee-conversion-analysis': '/employee-conversion/analysis',
  'employee-conversion-weekly': '/employee-conversion/weekly',
  'app-market-funnel': '/app-market/funnel',
  'app-market-comparison': '/app-market/comparison',
  'app-market-detail': '/app-market/detail',
  'app-market-creative': '/app-market/creative',
  'live-funnel': '/live/funnel',
  'data-import': '/system/data-import',
  'account-management': '/system/account-management',
  'database-backup': '/system/database-backup',
  'report-generation': '/report-generation',
};

export const WAIT_CONFIG = config.waitConfig;

export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(WAIT_CONFIG.pageLoad);
}

export async function waitForDataLoad(page: Page): Promise<void> {
  await page.waitForTimeout(WAIT_CONFIG.dataLoad);
}

export async function waitForChartRender(page: Page): Promise<void> {
  await page.waitForTimeout(WAIT_CONFIG.chartRender);
}

export async function waitForFilterChange(page: Page): Promise<void> {
  await page.waitForTimeout(WAIT_CONFIG.filterChange);
}

export async function waitForAnimation(page: Page): Promise<void> {
  await page.waitForTimeout(WAIT_CONFIG.animation);
}

export async function navigateToPage(page: Page, pageKey: keyof typeof PAGE_ROUTES): Promise<void> {
  const route = PAGE_ROUTES[pageKey];
  await page.goto(route);
  await waitForPageReady(page);
}

export async function expectSidebarVisible(page: Page): Promise<Locator> {
  const sidebar = page.locator('.ant-layout-sider, [class*="sidebar"]').first();
  await expect(sidebar).toBeVisible({ timeout: 30000 });
  return sidebar;
}

export async function expectHeaderVisible(page: Page): Promise<Locator> {
  const header = page.locator('.ant-layout-header, [class*="header"]').first();
  await expect(header).toBeVisible({ timeout: 30000 });
  return header;
}

export async function expectMainContentVisible(page: Page): Promise<Locator> {
  const content = page.locator('.ant-layout-content, main, [class*="content"]').first();
  await expect(content).toBeVisible({ timeout: 30000 });
  return content;
}

export async function expectFilterBarVisible(page: Page): Promise<Locator> {
  const filterBar = page.locator('.ant-card, [class*="filter"]').first();
  await expect(filterBar).toBeVisible({ timeout: 30000 });
  return filterBar;
}

export async function expectDataTableVisible(page: Page): Promise<Locator> {
  const table = page.locator('.ant-table').first();
  await expect(table).toBeVisible({ timeout: 15000 });
  return table;
}

export async function expectChartVisible(page: Page): Promise<Locator> {
  await waitForChartRender(page);
  const chart = page.locator('[class*="chart"], canvas').first();
  await expect(chart).toBeVisible({ timeout: 15000 });
  return chart;
}

export async function expectMetricCardsVisible(page: Page): Promise<Locator> {
  const cards = page.locator('.ant-card, [class*="metric"]').first();
  await expect(cards).toBeVisible({ timeout: 10000 });
  return cards;
}

export async function expectPageTitle(page: Page, expectedText: string | RegExp): Promise<void> {
  await expect(page).toHaveTitle(expectedText);
}

export async function getTableRowCount(page: Page): Promise<number> {
  await waitForDataLoad(page);
  const rows = await page.locator('.ant-table-tbody tr').count();
  return rows;
}

export async function hasDataInTable(page: Page): Promise<boolean> {
  const rowCount = await getTableRowCount(page);
  return rowCount > 0;
}

export async function clickSearchButton(page: Page): Promise<void> {
  const searchButton = page.locator('button:has-text("查询"), .ant-btn-primary:has-text("查询")').first();
  if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchButton.click();
    await waitForFilterChange(page);
  }
}

export async function clickResetButton(page: Page): Promise<void> {
  const resetButton = page.locator('button:has-text("重置"), .ant-btn-default:has-text("重置")').first();
  if (await resetButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await resetButton.click();
    await waitForFilterChange(page);
  }
}

export async function selectFromDropdown(page: Page, dropdownSelector: string, value: string): Promise<void> {
  const dropdown = page.locator(dropdownSelector).first();
  await dropdown.click();
  await waitForAnimation(page);
  
  const option = page.locator(`.ant-select-dropdown .ant-select-item:has-text("${value}")`).first();
  await option.click();
  await waitForAnimation(page);
}

export async function inputText(page: Page, inputSelector: string, text: string): Promise<void> {
  const input = page.locator(inputSelector).first();
  await input.clear();
  await input.fill(text);
  await waitForAnimation(page);
}

export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/functional/${name}.png`,
    fullPage: true,
  });
}

export async function checkElementExists(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector).first();
  return await element.isVisible().catch(() => false);
}

export async function getTextContent(page: Page, selector: string): Promise<string | null> {
  const element = page.locator(selector).first();
  try {
    return await element.textContent();
  } catch {
    return null;
  }
}

export async function clickMenuItem(page: Page, menuText: string): Promise<void> {
  const menuItem = page.locator(`.ant-menu-item:has-text("${menuText}"), .ant-menu-submenu-title:has-text("${menuText}")`).first();
  await menuItem.click();
  await waitForPageReady(page);
}

export async function expandSubMenu(page: Page, menuText: string): Promise<void> {
  const subMenuTrigger = page.locator(`.ant-menu-submenu-title:has-text("${menuText}")`).first();
  const isExpanded = await subMenuTrigger.getAttribute('class');
  if (!isExpanded?.includes('ant-menu-submenu-open')) {
    await subMenuTrigger.click();
    await waitForAnimation(page);
  }
}

export async function expectAntDesignComponentVisible(page: Page, componentType: string): Promise<Locator> {
  const component = page.locator(`.ant-${componentType}`).first();
  await expect(component).toBeVisible({ timeout: 10000 });
  return component;
}

export async function waitForLoadingComplete(page: Page): Promise<void> {
  const loading = page.locator('.ant-spin, .ant-loading').first();
  await expect(loading).not.toBeVisible({ timeout: 30000 }).catch(() => {});
}

export async function expectNoConsoleErrors(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await page.waitForTimeout(1000);
  expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
}

export async function verifyPageElements(
  page: Page,
  elements: { name: string; selector: string; required: boolean }[]
): Promise<{ name: string; exists: boolean }[]> {
  const results: { name: string; exists: boolean }[] = [];
  
  for (const element of elements) {
    const exists = await checkElementExists(page, element.selector);
    results.push({ name: element.name, exists });
    
    if (element.required && !exists) {
      console.warn(`Required element "${element.name}" not found with selector: ${element.selector}`);
    }
  }
  
  return results;
}
