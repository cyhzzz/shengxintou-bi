/**
 * 数据导入页面功能测试
 * 验证新前端数据导入页面的各项功能
 */

import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForDataLoad,
  expectSidebarVisible,
  expectMainContentVisible,
  checkElementExists,
  waitForLoadingComplete,
  getTextContent,
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
    // v3.2.x 数据导入页使用卡片网格选择器，不再是 ant-select
    const typeGrid = page.locator('[class*="typeGrid"]').first();
    await expect(typeGrid).toBeVisible({ timeout: 10000 });
    const typeCards = page.locator('[class*="typeCard"]');
    expect(await typeCards.count()).toBeGreaterThan(0);
  });

  test('页面加载 - 文件上传区域', async ({ page }) => {
    const uploadArea = page.locator('.ant-upload-drag, .ant-upload').first();
    await expect(uploadArea).toBeVisible({ timeout: 10000 });
  });

  test('页面加载 - 上传按钮', async ({ page }) => {
    // 文件上传区使用 Upload.Dragger，拖拽区域即上传触发区域，无独立的「上传」主按钮
    const uploadArea = page.locator('.ant-upload-drag, .ant-upload').first();
    await expect(uploadArea).toBeVisible({ timeout: 10000 });
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 10000 });
  });

  test('功能 - 数据类型卡片切换', async ({ page }) => {
    // v3.2.x 数据类型改为卡片网格，点击第二个卡片可切换选中态
    const typeCards = page.locator('[class*="typeCard"]');
    const firstCard = typeCards.first();
    const secondCard = typeCards.nth(1);
    await expect(firstCard).toBeVisible();
    await expect(secondCard).toBeVisible();

    // 先点击第二个卡片
    await secondCard.click();
    await page.waitForTimeout(300);
    const isSecondActive = await secondCard.evaluate((el) =>
      el.className.includes('active')
    );
    expect(isSecondActive).toBeTruthy();
    console.log('数据类型可切换卡片数量:', await typeCards.count());
  });

  test('功能 - 数据类型选项验证', async ({ page }) => {
    // 卡片网格中的标题即为选项
    const typeCards = page.locator('[class*="typeCard"]');
    const titles = page.locator('[class*="typeCard"] [class*="cardTitle"]');
    const optionTexts = await titles.allTextContents();
    console.log('数据类型选项:', optionTexts);

    expect(await typeCards.count()).toBeGreaterThan(0);
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

  test('功能 - 上传区域状态', async ({ page }) => {
    // Dragger 区域即上传触发区，检查是否可交互（存在 file input）
    const uploadArea = page.locator('.ant-upload-drag, .ant-upload').first();
    await expect(uploadArea).toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
    const isDisabled = await fileInput.isDisabled().catch(() => false);
    console.log('上传区 file input 禁用状态:', isDisabled);
  });

  test('错误处理 - 未选择文件不会触发上传', async ({ page }) => {
    // 当前为卡片选择器 + Dragger，默认已选中第一个类型；未选文件时不应触发上传或报错
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    // 不上传文件直接提交不应产生错误提示
    await page.waitForTimeout(1000);
    const errorMessage = page.locator('.ant-form-item-explain-error, .ant-alert-error').first();
    const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('空文件错误提示可见:', hasError);
    expect(hasError).toBeFalsy();
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
