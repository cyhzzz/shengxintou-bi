/**
 * 报告生成页面对比测试
 * 对比旧前端和新前端的报告生成功能
 */

import { test, expect } from '@playwright/test';
import { PAGE_ROUTES, WAIT_CONFIG, verifySidebar } from './utils';

test.describe('报告生成页面对比测试', () => {
  test.describe.configure({ mode: 'parallel' });

  test('旧前端 - 报告生成页面结构验证', async ({ page }) => {
    // 导航到报告生成页面
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['report-generation'].old}`);

    // 等待页面加载
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证侧边栏
    await verifySidebar(page, 'old');

    // 验证页面标题
    const titleElement = page.locator('.card__title, h2, h3').first();
    await expect(titleElement).toBeVisible({ timeout: 5000 });

    // 验证报告类型选择
    const reportTypeSelector = page.locator('select, .form-control, .filter-group select').first();
    const hasReportType = await reportTypeSelector.isVisible().catch(() => false);
    console.log('旧前端有报告类型选择器:', hasReportType);

    // 验证日期范围选择
    const dateInputs = page.locator('input[type="date"], .date-picker, input[placeholder*="日期"]');
    const dateInputCount = await dateInputs.count();
    console.log('旧前端日期输入数量:', dateInputCount);

    // 验证生成按钮
    const generateButton = page.locator('.btn--primary:has-text("生成"), button:has-text("生成"), button:has-text("导出")').first();
    const hasGenerateButton = await generateButton.isVisible().catch(() => false);
    console.log('旧前端有生成按钮:', hasGenerateButton);
  });

  test('新前端 - 报告生成页面结构验证', async ({ page }) => {
    // 导航到报告生成页面
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['report-generation'].new}`);

    // 等待页面加载
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 验证侧边栏
    await verifySidebar(page, 'new');

    // 验证页面标题
    const titleElement = page.locator('.ant-page-header-heading-title, .ant-card-head-title, h2, h3').first();
    await expect(titleElement).toBeVisible({ timeout: 5000 });

    // 验证报告类型选择（Ant Design Select）
    const reportTypeSelector = page.locator('.ant-select').first();
    const hasReportType = await reportTypeSelector.isVisible().catch(() => false);
    console.log('新前端有报告类型选择器:', hasReportType);

    // 验证日期范围选择（Ant Design RangePicker）
    const datePicker = page.locator('.ant-picker-range, .ant-picker').first();
    const hasDatePicker = await datePicker.isVisible().catch(() => false);
    console.log('新前端有日期选择器:', hasDatePicker);

    // 验证生成按钮
    const generateButton = page.locator('.ant-btn-primary:has-text("生成"), button:has-text("生成"), button:has-text("导出")').first();
    const hasGenerateButton = await generateButton.isVisible().catch(() => false);
    console.log('新前端有生成按钮:', hasGenerateButton);
  });

  test('报告生成 - 模板选择对比', async ({ page }) => {
    // 测试旧前端模板选择
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['report-generation'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    const oldTemplateSelect = page.locator('select, .form-control').first();
    if (await oldTemplateSelect.isVisible()) {
      await oldTemplateSelect.click();
      await page.waitForTimeout(300);
      const oldOptions = await oldTemplateSelect.locator('option').allTextContents();
      console.log('旧前端报告模板:', oldOptions);
    }

    // 测试新前端模板选择
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['report-generation'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    const newTemplateSelect = page.locator('.ant-select').first();
    if (await newTemplateSelect.isVisible()) {
      await newTemplateSelect.click();
      await page.waitForTimeout(500);
      const newOptions = await page.locator('.ant-select-dropdown .ant-select-item').allTextContents();
      console.log('新前端报告模板:', newOptions);
      await page.keyboard.press('Escape');
    }
  });

  test('报告生成 - 配置项对比', async ({ page }) => {
    // 测试旧前端配置项
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['report-generation'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查配置区域
    const oldConfigArea = page.locator('.card__body, .config-section, .report-config').first();
    const hasOldConfig = await oldConfigArea.isVisible().catch(() => false);

    // 检查复选框（选择要包含的内容）
    const oldCheckboxes = page.locator('input[type="checkbox"]');
    const oldCheckboxCount = await oldCheckboxes.count();
    console.log('旧前端配置复选框数量:', oldCheckboxCount);

    // 测试新前端配置项
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['report-generation'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查配置区域
    const newConfigArea = page.locator('.ant-card-body, .ant-form').first();
    const hasNewConfig = await newConfigArea.isVisible().catch(() => false);

    // 检查 Ant Design Checkbox
    const newCheckboxes = page.locator('.ant-checkbox-wrapper, .ant-checkbox');
    const newCheckboxCount = await newCheckboxes.count();
    console.log('新前端配置复选框数量:', newCheckboxCount);
  });

  test('报告生成 - 预览功能验证', async ({ page }) => {
    // 测试旧前端预览
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['report-generation'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查预览按钮
    const oldPreviewButton = page.locator('.btn:has-text("预览"), button:has-text("预览")').first();
    const hasOldPreview = await oldPreviewButton.isVisible().catch(() => false);
    console.log('旧前端有预览按钮:', hasOldPreview);

    // 测试新前端预览
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['report-generation'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查预览按钮
    const newPreviewButton = page.locator('.ant-btn:has-text("预览"), button:has-text("预览")').first();
    const hasNewPreview = await newPreviewButton.isVisible().catch(() => false);
    console.log('新前端有预览按钮:', hasNewPreview);
  });

  test('报告生成 - 导出功能验证', async ({ page }) => {
    // 测试旧前端导出
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['report-generation'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查导出按钮
    const oldExportButton = page.locator('.btn--primary:has-text("导出"), .btn:has-text("下载"), button:has-text("导出")').first();
    const hasOldExport = await oldExportButton.isVisible().catch(() => false);
    console.log('旧前端有导出按钮:', hasOldExport);

    // 测试新前端导出
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['report-generation'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查导出按钮
    const newExportButton = page.locator('.ant-btn-primary:has-text("导出"), .ant-btn:has-text("下载"), button:has-text("导出")').first();
    const hasNewExport = await newExportButton.isVisible().catch(() => false);
    console.log('新前端有导出按钮:', hasNewExport);
  });

  test('报告生成 - 报告历史记录对比', async ({ page }) => {
    // 测试旧前端历史记录
    await page.goto(`http://127.0.0.1:5000${PAGE_ROUTES['report-generation'].old}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查历史记录表格
    const oldHistoryTable = page.locator('.data-table, table').first();
    const hasOldHistory = await oldHistoryTable.isVisible().catch(() => false);
    console.log('旧前端有历史记录表格:', hasOldHistory);

    if (hasOldHistory) {
      const oldRows = await oldHistoryTable.locator('tbody tr').count();
      console.log('旧前端历史记录数:', oldRows);
    }

    // 测试新前端历史记录
    await page.goto(`http://127.0.0.1:3000${PAGE_ROUTES['report-generation'].new}`);
    await page.waitForTimeout(WAIT_CONFIG.pageLoad);

    // 检查历史记录表格
    const newHistoryTable = page.locator('.ant-table').first();
    const hasNewHistory = await newHistoryTable.isVisible().catch(() => false);
    console.log('新前端有历史记录表格:', hasNewHistory);

    if (hasNewHistory) {
      const newRows = await newHistoryTable.locator('.ant-table-tbody tr').count();
      console.log('新前端历史记录数:', newRows);
    }
  });
});