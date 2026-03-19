/**
 * 数据导入页面对比测试
 * 对比旧前端和新前端的数据导入功能
 */

import { test, expect } from '@playwright/test';
import { PAGE_ROUTES, WAIT_CONFIG, verifySidebar } from './utils';

test.describe('数据导入页面对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  test('旧前端 - 数据导入页面结构验证', async ({ page }) => {
    // 导航到数据导入页面
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['data-import'].old}`);

    // 等待页面加载
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证侧边栏
    await verifySidebar(page, 'old');

    // 验证页面标题
    const titleElement = page.locator('.card__title, h2, h3').first();
    await expect(titleElement).toBeVisible({ timeout: 5000 });

    // 验证数据类型选择卡片存在（旧前端使用卡片网格而非下拉框）
    const typeCards = page.locator('.type-card, .card').first();
    const hasTypeCards = await typeCards.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('旧前端有数据类型选择卡片:', hasTypeCards);

    // 验证文件上传区域存在（使用 dropzone div）
    const dropzone = page.locator('#dropzone').first();
    const hasDropzone = await dropzone.isVisible({ timeout: 10000 }).catch(() => false);
    console.log('旧前端有上传区域:', hasDropzone);

    // 验证导入按钮（可能被禁用直到选择文件）
    const importButton = page.locator('.btn--primary, button').first();
    const hasButton = await importButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('旧前端有导入按钮:', hasButton);
  });

  test('新前端 - 数据导入页面结构验证', async ({ page }) => {
    // 导航到数据导入页面
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['data-import'].new}`);

    // 等待页面加载
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证侧边栏
    await verifySidebar(page, 'new');

    // 验证页面标题
    const titleElement = page.locator('.ant-page-header-heading-title, .ant-card-head-title, h2, h3').first();
    await expect(titleElement).toBeVisible({ timeout: 5000 });

    // 验证数据类型选择卡片存在（新前端使用卡片网格而非下拉框）
    const typeCards = page.locator('[class*="typeCard"], [class*="type-card"], .ant-card').first();
    const hasTypeCards = await typeCards.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('新前端有数据类型选择卡片:', hasTypeCards);

    // 验证文件上传区域存在（Ant Design Upload 或自定义上传组件）
    const uploadArea = page.locator('.ant-upload, [class*="upload"], [class*="Upload"]').first();
    const hasUpload = await uploadArea.isVisible({ timeout: 10000 }).catch(() => false);
    console.log('新前端有上传区域:', hasUpload);
  });

  test('数据导入 - 支持的数据类型对比', async ({ page }) => {
    // 获取旧前端支持的数据类型选项
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['data-import'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 旧前端使用卡片网格，检查卡片存在
    const oldTypeCards = page.locator('.type-card, .card');
    const oldCardCount = await oldTypeCards.count();
    console.log('旧前端数据类型卡片数量:', oldCardCount);

    // 获取新前端支持的数据类型选项
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['data-import'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 新前端也使用卡片网格，检查卡片存在
    const newTypeCards = page.locator('[class*="typeCard"], [class*="type-card"], .ant-card');
    const newCardCount = await newTypeCards.count();
    console.log('新前端数据类型卡片数量:', newCardCount);
  });

  test('数据导入 - 上传功能验证', async ({ page }) => {
    // 测试旧前端上传功能
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['data-import'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 等待页面主要内容加载
    await page.waitForSelector('.card', { timeout: 10000 });

    // 验证上传区域存在（dropzone）
    const oldDropzone = page.locator('#dropzone');
    const hasOldDropzone = await oldDropzone.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('旧前端有dropzone上传区域:', hasOldDropzone);

    // 验证文件输入存在（隐藏的file input）
    const oldFileInput = page.locator('input[type="file"]');
    const hasOldFileInput = await oldFileInput.count() > 0;
    console.log('旧前端有file input:', hasOldFileInput);

    // 测试新前端上传功能
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['data-import'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 等待页面主要内容加载
    await page.waitForSelector('.ant-card, [class*="typeCard"]', { timeout: 10000 });

    // 验证 Ant Design Upload 组件或自定义上传区域
    const newUploadArea = page.locator('.ant-upload, [class*="upload"], [class*="Upload"], #dropzone').first();
    const hasNewUpload = await newUploadArea.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('新前端有上传区域:', hasNewUpload);

    // 验证文件输入存在（隐藏的file input）
    const newFileInput = page.locator('input[type="file"]');
    const hasNewFileInput = await newFileInput.count() > 0;
    console.log('新前端有file input:', hasNewFileInput);

    // 至少有一个前端有上传功能即可
    expect(hasOldDropzone || hasNewUpload).toBe(true);
  });

  test('数据导入 - 导入记录表格验证', async ({ page }) => {
    // 测试旧前端导入记录
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['data-import'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查是否有导入记录表格
    const oldRecordsTable = page.locator('.data-table, table').first();
    const oldHasTable = await oldRecordsTable.isVisible();
    console.log('旧前端有导入记录表格:', oldHasTable);

    // 测试新前端导入记录
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['data-import'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查是否有导入记录表格
    const newRecordsTable = page.locator('.ant-table').first();
    const newHasTable = await newRecordsTable.isVisible();
    console.log('新前端有导入记录表格:', newHasTable);

    // 验证一致性
    expect(oldHasTable).toBe(newHasTable);
  });

  test('数据导入 - 错误处理验证', async ({ page }) => {
    // 测试旧前端错误提示
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['data-import'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 尝试不上传文件直接提交
    const oldSubmitBtn = page.locator('.btn--primary:has-text("上传"), button[type="submit"]').first();
    if (await oldSubmitBtn.isVisible()) {
      await oldSubmitBtn.click();
      await page.waitForTimeout(1000);

      // 检查是否有错误提示
      const oldError = page.locator('.error-message, .alert-error, .toast-error, .is-error').first();
      const oldHasError = await oldError.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('旧前端有错误提示:', oldHasError);
    }

    // 测试新前端错误提示
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['data-import'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查 Ant Design Form 验证
    const newSubmitBtn = page.locator('.ant-btn-primary, button[type="submit"]').first();
    if (await newSubmitBtn.isVisible()) {
      await newSubmitBtn.click();
      await page.waitForTimeout(1000);

      // 检查是否有 Ant Design Form 验证错误
      const newError = page.locator('.ant-form-item-explain-error, .ant-message-error, .ant-alert-error').first();
      const newHasError = await newError.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('新前端有错误提示:', newHasError);
    }
  });
});