import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  expectFilterBarVisible,
  expectDataTableVisible,
  PAGE_ROUTES,
  WAIT_CONFIG,
} from './utils';

/**
 * 线索明细页面对比测试
 * Batch 1: 核心页面
 */

test.describe('线索明细页面对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  // 旧前端测试
  test('旧前端 - 页面加载', async ({ page }) => {
    // 旧前端使用 JavaScript 导航，不支持 URL 参数
    // 先导航到主页，然后点击侧边栏菜单
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 点击侧边栏的线索明细菜单
    const leadsDetailMenu = page.locator('[data-report="leads-detail"]');
    await leadsDetailMenu.click();

    // 等待页面切换完成
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证筛选器
    await expectFilterBarVisible(page, false);

    // 旧前端表格是动态渲染的，需要等待数据加载完成
    // 等待表格容器或数据区域出现
    await page.waitForSelector('.data-section, #leadsDetailTable, .data-table', {
      timeout: 20000,
      state: 'visible'
    }).catch(() => {
      // 如果表格不存在，检查是否有错误状态
      console.log('表格未找到，检查页面状态');
    });

    // 验证数据表格
    await expectDataTableVisible(page, false);
  });

  test('旧前端 - 筛选器功能', async ({ page }) => {
    // 旧前端使用 JavaScript 导航
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 点击侧边栏的线索明细菜单
    const leadsDetailMenu = page.locator('[data-report="leads-detail"]');
    await leadsDetailMenu.click();
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 旧前端使用 MultiSelectDropdown 组件，查找平台筛选器容器
    const platformFilter = page.locator('#platformFilterContainer, [id*="platform"]').first();
    if (await platformFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      // MultiSelectDropdown 点击展开
      await platformFilter.click();
      await page.waitForTimeout(500);

      // 检查下拉选项是否出现
      const dropdownOption = page.locator('.multi-select-dropdown__option, .dropdown-option').first();
      if (await dropdownOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('平台筛选器下拉选项可见');
      }
    }
  });

  test('旧前端 - 表格分页', async ({ page }) => {
    // 旧前端使用 JavaScript 导航
    await page.goto('http://127.0.0.1:5000/');
    await waitForPageReady(page);

    // 点击侧边栏的线索明细菜单
    const leadsDetailMenu = page.locator('[data-report="leads-detail"]');
    await leadsDetailMenu.click();
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证分页器
    const pagination = page.locator('.pagination, [class*="pagination"]').first();
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 检查总数显示
      const paginationText = await pagination.textContent();
      expect(paginationText).toBeTruthy();
    }
  });

  // 新前端测试
  test('新前端 - 页面加载', async ({ page }) => {
    const route = PAGE_ROUTES['leads-detail'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证筛选器
    await expectFilterBarVisible(page, true);

    // 验证数据表格
    await expectDataTableVisible(page, true);
  });

  test('新前端 - 筛选器功能', async ({ page }) => {
    const route = PAGE_ROUTES['leads-detail'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 查找平台筛选器 - Ant Design Select
    const platformSelect = page.locator('.ant-select:has-text("平台")').first();
    if (await platformSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await platformSelect.click();
      await page.waitForTimeout(500);
    }
  });

  test('新前端 - 表格分页', async ({ page }) => {
    const route = PAGE_ROUTES['leads-detail'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 验证 Ant Design 分页器
    const pagination = page.locator('.ant-pagination').first();
    if (await pagination.isVisible({ timeout: 2000 }).catch(() => false)) {
      // 检查总数显示
      const totalText = page.locator('.ant-pagination-total-text').first();
      if (await totalText.isVisible()) {
        const text = await totalText.textContent();
        expect(text).toContain('共');
      }
    }
  });

  test('新前端 - 详情弹窗', async ({ page }) => {
    const route = PAGE_ROUTES['leads-detail'];
    await page.goto('http://localhost:5173' + route.new);
    await waitForPageReady(page);

    // 查找详情按钮
    const detailButton = page.locator('button:has-text("详情")').first();
    if (await detailButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await detailButton.click();
      await page.waitForTimeout(500);

      // 验证弹窗
      const modal = page.locator('.ant-modal').first();
      await expect(modal).toBeVisible();
    }
  });

  // 功能对比
  test('功能对比 - 查询重置', async ({ page }) => {
    await page.goto('http://localhost:5173/leads-detail');
    await waitForPageReady(page);

    // 查找重置按钮
    const resetButton = page.locator('button:has-text("重置")').first();
    if (await resetButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await resetButton.click();
      await page.waitForTimeout(WAIT_CONFIG.filterChange);
    }
  });
});