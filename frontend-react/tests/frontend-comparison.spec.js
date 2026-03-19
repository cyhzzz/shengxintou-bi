/**
 * 新旧前端功能对比测试
 * 对比测试：旧前端 (localhost:5000) vs 新前端 (localhost:5173)
 *
 * 测试模块：
 * 1. 数据概览
 * 2. 厂商分析
 * 3. 转化漏斗
 * 4. 线索明细
 * 5. 小红书报表
 * 6. 员工转化
 * 7. 报告生成
 * 8. 系统配置（数据导入、账号管理、简称管理、数据同步）
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

// 测试配置
const OLD_FRONTEND = 'http://localhost:5000';
const NEW_FRONTEND = 'http://localhost:3000';

// 测试日期范围
const TEST_DATE_RANGE = {
  startDate: '2026-02-17',
  endDate: '2026-02-23'
};

// 对比结果存储
const comparisonResults = {
  passed: [],
  failed: [],
  warnings: []
};

/**
 * 辅助函数：记录对比结果
 */
function logResult(module, feature, status, details = '') {
  const result = { module, feature, details, timestamp: new Date().toISOString() };
  if (status === 'pass') {
    comparisonResults.passed.push(result);
    console.log(`✅ [${module}] ${feature} - 通过 ${details}`);
  } else if (status === 'fail') {
    comparisonResults.failed.push(result);
    console.log(`❌ [${module}] ${feature} - 失败 ${details}`);
  } else {
    comparisonResults.warnings.push(result);
    console.log(`⚠️ [${module}] ${feature} - 警告 ${details}`);
  }
}

test.describe('新旧前端功能对比测试', () => {

  // ==================== 1. 数据概览 ====================
  test.describe('数据概览对比', () => {
    test('页面加载对比', async ({ page }) => {
      // 旧前端
      await page.goto(`${OLD_FRONTEND}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const oldSidebarExists = await page.locator('.sidebar').isVisible().catch(() => false);
      const oldContentExists = await page.locator('#mainContent').isVisible().catch(() => false);

      logResult('数据概览', '旧前端侧边栏', oldSidebarExists ? 'pass' : 'fail');
      logResult('数据概览', '旧前端内容区', oldContentExists ? 'pass' : 'fail');

      // 新前端
      await page.goto(`${NEW_FRONTEND}/dashboard`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const newSidebarExists = await page.locator('.ant-layout-sider').isVisible().catch(() => false);
      const newContentExists = await page.locator('.ant-layout-content').isVisible().catch(() => false);

      logResult('数据概览', '新前端侧边栏', newSidebarExists ? 'pass' : 'fail');
      logResult('数据概览', '新前端内容区', newContentExists ? 'pass' : 'fail');
    });

    test('指标卡片对比', async ({ page }) => {
      // 旧前端
      await page.goto(`${OLD_FRONTEND}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const oldMetricCards = await page.locator('.metric-card, .card--metric').count();
      logResult('数据概览', '旧前端指标卡片数量', oldMetricCards > 0 ? 'pass' : 'fail', `数量: ${oldMetricCards}`);

      // 新前端
      await page.goto(`${NEW_FRONTEND}/dashboard`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const newMetricCards = await page.locator('.ant-card').count();
      logResult('数据概览', '新前端指标卡片数量', newMetricCards > 0 ? 'pass' : 'fail', `数量: ${newMetricCards}`);
    });
  });

  // ==================== 2. 厂商分析 ====================
  test.describe('厂商分析对比', () => {
    test('筛选器对比', async ({ page }) => {
      // 旧前端
      await page.goto(`${OLD_FRONTEND}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // 点击厂商分析菜单 - 使用更精确的选择器，避免匹配帮助弹窗中的文本
      // 侧边栏导航项在 .sidebar-nav 内
      await page.locator('.sidebar-nav').locator('text=厂商分析').click();
      await page.waitForTimeout(3000); // 等待动态加载

      // 旧前端使用 MultiSelectForm 组件，选择器为 .multi-select-form 或 .multi-select-form__trigger
      const oldFilterGroup = await page.locator('.multi-select-form, .multi-select-form__trigger').first().isVisible().catch(() => false);
      logResult('厂商分析', '旧前端筛选器', oldFilterGroup ? 'pass' : 'fail');

      // 新前端
      await page.goto(`${NEW_FRONTEND}/agency-analysis`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const newFilters = await page.locator('.ant-select').count();
      logResult('厂商分析', '新前端筛选器', newFilters > 0 ? 'pass' : 'fail', `数量: ${newFilters}`);
    });

    test('数据表格对比', async ({ page }) => {
      // 新前端 - 设置日期并查询
      await page.goto(`${NEW_FRONTEND}/agency-analysis`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // 检查是否有数据表格
      const newTable = await page.locator('.ant-table').isVisible().catch(() => false);
      logResult('厂商分析', '新前端数据表格', newTable ? 'pass' : 'fail');
    });
  });

  // ==================== 3. 转化漏斗 ====================
  test.describe('转化漏斗对比', () => {
    test('页面加载对比', async ({ page }) => {
      // 新前端
      await page.goto(`${NEW_FRONTEND}/conversion-funnel`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const newContent = await page.locator('.ant-layout-content').isVisible().catch(() => false);
      logResult('转化漏斗', '新前端页面加载', newContent ? 'pass' : 'fail');

      // 检查是否有图表
      const charts = await page.locator('canvas, .antv-chart').count();
      logResult('转化漏斗', '新前端图表', charts > 0 ? 'pass' : 'warning', `图表数量: ${charts}`);
    });
  });

  // ==================== 4. 线索明细 ====================
  test.describe('线索明细对比', () => {
    test('表格功能对比', async ({ page }) => {
      // 新前端
      await page.goto(`${NEW_FRONTEND}/leads-detail`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // 检查表格
      const table = await page.locator('.ant-table').isVisible().catch(() => false);
      logResult('线索明细', '新前端表格', table ? 'pass' : 'fail');

      // 检查筛选器
      const filters = await page.locator('.ant-select, .ant-picker').count();
      logResult('线索明细', '新前端筛选器', filters > 0 ? 'pass' : 'fail', `筛选器数量: ${filters}`);

      // 检查导出按钮
      const exportBtn = await page.locator('button:has-text("导出")').isVisible().catch(() => false);
      logResult('线索明细', '新前端导出按钮', exportBtn ? 'pass' : 'warning');
    });
  });

  // ==================== 5. 小红书报表 ====================
  test.describe('小红书报表对比', () => {
    test('笔记列表对比', async ({ page }) => {
      // 新前端
      await page.goto(`${NEW_FRONTEND}/xhs-notes/list`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const table = await page.locator('.ant-table').isVisible().catch(() => false);
      logResult('小红书报表', '笔记列表表格', table ? 'pass' : 'fail');
    });

    test('运营分析对比', async ({ page }) => {
      await page.goto(`${NEW_FRONTEND}/xhs-notes/operation`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const content = await page.locator('.ant-layout-content').isVisible().catch(() => false);
      logResult('小红书报表', '运营分析页面', content ? 'pass' : 'fail');
    });
  });

  // ==================== 6. 员工转化 ====================
  test.describe('员工转化对比', () => {
    test('周报功能对比', async ({ page }) => {
      await page.goto(`${NEW_FRONTEND}/employee-conversion/weekly`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // 检查日期选择器
      const datePickers = await page.locator('.ant-picker').count();
      logResult('员工转化', '周报日期选择器', datePickers >= 2 ? 'pass' : 'warning', `数量: ${datePickers}`);

      // 检查生成按钮
      const generateBtn = await page.locator('button:has-text("生成")').isVisible().catch(() => false);
      logResult('员工转化', '周报生成按钮', generateBtn ? 'pass' : 'fail');

      // 检查海报按钮（需要数据）
      const posterBtns = await page.locator('button:has-text("海报")').count();
      logResult('员工转化', '海报按钮', posterBtns > 0 ? 'pass' : 'warning', `数量: ${posterBtns}`);
    });
  });

  // ==================== 7. 报告生成 ====================
  test.describe('报告生成对比', () => {
    test('页面功能对比', async ({ page }) => {
      await page.goto(`${NEW_FRONTEND}/report-generation`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const content = await page.locator('.ant-layout-content').isVisible().catch(() => false);
      logResult('报告生成', '页面加载', content ? 'pass' : 'fail');
    });
  });

  // ==================== 8. 系统配置 ====================
  test.describe('系统配置对比', () => {
    test('数据导入对比', async ({ page }) => {
      await page.goto(`${NEW_FRONTEND}/system/data-import`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // 检查上传组件
      const uploadArea = await page.locator('.ant-upload, input[type="file"]').count();
      logResult('系统配置', '数据导入上传组件', uploadArea > 0 ? 'pass' : 'fail', `数量: ${uploadArea}`);
    });

    test('账号管理对比', async ({ page }) => {
      await page.goto(`${NEW_FRONTEND}/system/account-management`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);  // 增加等待时间让数据加载

      // 检查卡片
      const cards = await page.locator('.ant-card').count();
      logResult('系统配置', '账号管理卡片', cards > 0 ? 'pass' : 'fail', `卡片数量: ${cards}`);

      // 检查表格 - 可能需要等待更长时间
      const table = await page.locator('.ant-table').isVisible().catch(() => false);
      logResult('系统配置', '账号管理表格', table ? 'pass' : 'warning', '表格可能无数据');

      // 检查添加按钮
      const addBtn = await page.locator('button:has-text("添加账号")').isVisible().catch(() => false);
      logResult('系统配置', '账号管理添加按钮', addBtn ? 'pass' : 'warning');
    });

    test('简称管理对比', async ({ page }) => {
      await page.goto(`${NEW_FRONTEND}/system/abbreviation-management`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const content = await page.locator('.ant-layout-content').isVisible().catch(() => false);
      logResult('系统配置', '简称管理页面', content ? 'pass' : 'fail');
    });

    test('数据库备份对比', async ({ page }) => {
      await page.goto(`${NEW_FRONTEND}/system/database-backup`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const content = await page.locator('.ant-layout-content').isVisible().catch(() => false);
      logResult('系统配置', '数据库备份页面', content ? 'pass' : 'fail');
    });
  });

  // ==================== 汇总报告 ====================
  test('生成对比测试报告', async ({ page }) => {
    console.log('\n========== 新旧前端功能对比测试报告 ==========\n');
    console.log(`✅ 通过: ${comparisonResults.passed.length} 项`);
    console.log(`❌ 失败: ${comparisonResults.failed.length} 项`);
    console.log(`⚠️ 警告: ${comparisonResults.warnings.length} 项`);

    if (comparisonResults.failed.length > 0) {
      console.log('\n失败项详情:');
      comparisonResults.failed.forEach((item, i) => {
        console.log(`  ${i + 1}. [${item.module}] ${item.feature} - ${item.details}`);
      });
    }

    if (comparisonResults.warnings.length > 0) {
      console.log('\n警告项详情:');
      comparisonResults.warnings.forEach((item, i) => {
        console.log(`  ${i + 1}. [${item.module}] ${item.feature} - ${item.details}`);
      });
    }

    console.log('\n============================================\n');

    // 写入报告文件
    const reportPath = 'test-results/comparison-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(comparisonResults, null, 2));
    console.log(`报告已保存到: ${reportPath}`);
  });
});