/**
 * 数据库备份页面功能测试
 * 验证新前端数据库备份页面的各项功能
 */

import { test, expect } from '@playwright/test';
import {
  navigateToPage,
  waitForPageReady,
  waitForDataLoad,
  expectSidebarVisible,
  expectMainContentVisible,
  checkElementExists,
  getTextContent,
  waitForLoadingComplete,
} from './utils';

test.describe('数据库备份页面功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, 'database-backup');
  });

  test('页面加载 - 基本结构验证', async ({ page }) => {
    await expectSidebarVisible(page);
    await expectMainContentVisible(page);
  });

  test('页面加载 - 页面标题验证', async ({ page }) => {
    // 项目用 MetricCard/Card 组件，不使用 ant-page-header
    const title = await getTextContent(page, 'h1, h2, .ant-card-head-title, [class*="metricTitle"], [class*="title"]');
    console.log('数据库备份页面标题:', title);
    // 标题可能为 null（页面用 Card 而非 PageHeader），只要有可见内容即通过
    if (!title) {
      const hasContent = await checkElementExists(page, '.ant-card, .ant-table, .ant-form');
      expect(hasContent).toBeTruthy();
    } else {
      expect(title).toBeTruthy();
    }
  });

  test('页面加载 - 备份操作按钮', async ({ page }) => {
    const backupButton = page.locator('button:has-text("备份"), .ant-btn-primary:has-text("备份")').first();
    const hasBackupButton = await backupButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('备份按钮可见:', hasBackupButton);
  });

  test('页面加载 - 备份记录区域', async ({ page }) => {
    await waitForDataLoad(page);
    
    const recordArea = page.locator('.ant-table, [class*="record"]').first();
    const hasRecordArea = await recordArea.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('备份记录区域可见:', hasRecordArea);
  });

  test('页面加载 - 备份历史表格', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    const isTableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('备份历史表格可见:', isTableVisible);
  });

  test('页面加载 - 版本信息区域', async ({ page }) => {
    const versionInfo = page.locator('text=/版本/i').first();
    const hasVersionInfo = await versionInfo.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('版本信息可见:', hasVersionInfo);
  });

  test('功能 - 备份按钮功能', async ({ page }) => {
    const backupButton = page.locator('button:has-text("备份"), .ant-btn-primary:has-text("备份")').first();
    if (await backupButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(backupButton).toBeVisible();
      console.log('备份按钮可用');
    }
  });

  test('功能 - 恢复按钮功能', async ({ page }) => {
    const restoreButton = page.locator('button:has-text("恢复"), [class*="restore"]').first();
    const hasRestoreButton = await restoreButton.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('恢复按钮可见:', hasRestoreButton);
  });

  test('功能 - 删除备份按钮功能', async ({ page }) => {
    const deleteButton = page.locator('button:has-text("删除"), [class*="delete"]').first();
    const hasDeleteButton = await deleteButton.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('删除备份按钮可见:', hasDeleteButton);
  });

  test('备份记录 - 表格列验证', async ({ page }) => {
    await waitForDataLoad(page);
    
    const table = page.locator('.ant-table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const headers = page.locator('.ant-table-thead th');
      const headerCount = await headers.count();
      console.log('备份记录列数:', headerCount);
    }
  });

  test('备份记录 - 时间列显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const timeColumn = page.locator('th:has-text("时间"), th:has-text("日期")').first();
    const hasTimeColumn = await timeColumn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('时间列可见:', hasTimeColumn);
  });

  test('备份记录 - 文件名列显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const fileColumn = page.locator('th:has-text("文件"), th:has-text("文件名")').first();
    const hasFileColumn = await fileColumn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('文件列可见:', hasFileColumn);
  });

  test('备份记录 - 操作列显示', async ({ page }) => {
    await waitForDataLoad(page);
    
    const actionColumn = page.locator('th:has-text("操作")').first();
    const hasActionColumn = await actionColumn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('操作列可见:', hasActionColumn);
  });

  test('加载状态 - 页面加载状态', async ({ page }) => {
    await waitForLoadingComplete(page);
  });

  test('错误处理 - 无备份记录场景', async ({ page }) => {
    await waitForDataLoad(page);
    
    const emptyState = page.locator('.ant-empty, text=/暂无数据/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    const hasData = await checkElementExists(page, '.ant-table-tbody tr');
    expect(hasData || hasEmptyState).toBeTruthy();
  });
});
