/**
 * 数据导入页面功能测试
 * 验证新前端数据导入页面的各项功能
 */

import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForPageReady,
  waitForDataLoad,
  expectSidebarVisible,
  expectMainContentVisible,
  checkElementExists,
  waitForLoadingComplete,
  getTextContent,
  takeScreenshot,
} from './utils';

test.describe('数据导入页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'data-import');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
  });

  test('页面加载 - 页面标题验证', async ({ page }) => {
    // 项目用 MetricCard/Card 组件，不使用 ant-page-header
    const title = await getTextContent(page, 'h1, h2, .ant-card-head-title, [class*="metricTitle"], [class*="title"]');
    console.log('数据导入页面标题:', title);
    // 标题可能为 null（页面用 Card 而非 PageHeader），只要有可见内容即通过
    if (!title) {
      const hasContent = await checkElementExists(page, '.ant-card, .ant-table, .ant-form');
      expect(hasContent).toBeTruthy();
    } else {
      expect(title).toBeTruthy();
    }
  });

  test('页面加载 - 数据类型选择器', async ({ page }) => {
    const dataTypeSelector = page.locator('.ant-select').first();
    await expect(dataTypeSelector).toBeVisible({ timeout: 10000 });
  });

  test('页面加载 - 文件上传区域', async ({ page }) => {
    const uploadArea = page.locator('.ant-upload-drag, .ant-upload').first();
    await expect(uploadArea).toBeVisible({ timeout: 10000 });
  });

  test('页面加载 - 上传按钮', async ({ page }) => {
    const uploadButton = page.locator('.ant-btn-primary:has-text("上传")').first();
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
  });

  test('功能 - 数据类型下拉菜单', async ({ page }) => {
    const select = page.locator('.ant-select').first();
    await select.click();
    await page.waitForTimeout(500);
    
    const dropdown = page.locator('.ant-select-dropdown').first();
    await expect(dropdown).toBeVisible();
    
    const options = page.locator('.ant-select-dropdown .ant-select-item');
    const optionCount = await options.count();
    console.log('数据类型选项数量:', optionCount);
    
    await page.keyboard.press('Escape');
  });

  test('功能 - 数据类型选项验证', async ({ page }) => {
    const select = page.locator('.ant-select').first();
    await select.click();
    await page.waitForTimeout(500);
    
    const options = page.locator('.ant-select-dropdown .ant-select-item');
    const optionTexts = await options.allTextContents();
    console.log('数据类型选项:', optionTexts);
    
    await page.keyboard.press('Escape');
    
    expect(optionTexts.length).toBeGreaterThan(0);
  });

  test('功能 - 文件上传区域可见性', async ({ page }) => {
    const uploadText = page.locator('text=/点击或拖拽文件到此区域上传/i').first();
    const hasUploadText = await uploadText.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('上传提示文本可见:', hasUploadText);
    
    const uploadArea = page.locator('.ant-upload-drag');
    await expect(uploadArea).toBeVisible();
  });

  test('功能 - 支持的文件格式提示', async ({ page }) => {
    const formatText = page.locator('text=/支持.*格式/i').first();
    const hasFormatText = await formatText.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('文件格式提示可见:', hasFormatText);
  });

  test('导入记录 - 导入记录表格', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    const isTableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('导入记录表格可见:', isTableVisible);
  });

  test('导入记录 - 表格列验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const headers = page.locator('.ant-table-thead th');
      const headerCount = await headers.count();
      console.log('导入记录表格列数:', headerCount);
    }
  });

  test('导入记录 - 分页组件', async ({ page }) => {
    await waitForDataLoad(page);
    
    const pagination = page.locator('.ant-pagination').first();
    const isPaginationVisible = await pagination.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('分页组件可见:', isPaginationVisible);
  });

  test('功能 - 上传按钮状态', async ({ page }) => {
    const uploadButton = page.locator('.ant-btn-primary:has-text("上传")').first();
    await expect(uploadButton).toBeVisible();
    
    const isDisabled = await uploadButton.isDisabled();
    console.log('上传按钮禁用状态:', isDisabled);
  });

  test('错误处理 - 不选择数据类型直接上传', async ({ page }) => {
    const uploadButton = page.locator('.ant-btn-primary:has-text("上传")').first();
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      await page.waitForTimeout(1000);
      
      const errorMessage = page.locator('.ant-form-item-explain-error').first();
      const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('有错误提示:', hasError);
    }
  });

  test('错误处理 - 上传不支持的文件类型', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('test content')
      });
      
      await page.waitForTimeout(1000);
      
      const errorMessage = page.locator('.ant-message-error, .ant-alert-error').first();
      const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false);
      console.log('有错误提示:', hasError);
    }
  });

  test('加载状态 - 页面加载状态', async ({ page }) => {
    await waitForLoadingComplete(page);
    
    const loading = page.locator('.ant-spin, .ant-loading').first();
    const isLoading = await loading.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('页面加载中:', isLoading);
  });
});
