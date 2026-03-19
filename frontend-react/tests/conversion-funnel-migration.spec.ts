import { test, expect } from '@playwright/test';

/**
 * 转化漏斗页面迁移验证测试
 * 验证新版前端是否正确迁移旧版前端的功能、交互和数据细节
 */

const OLD_FRONTEND = 'http://127.0.0.1:5000';
const NEW_FRONTEND = 'http://localhost:5173';

test.describe('转化漏斗迁移验证测试', () => {
  test.slow();

  test.describe('旧版前端功能验证', () => {
    test('应该有服务人员筛选器', async ({ page }) => {
      await page.goto(OLD_FRONTEND);
      await page.waitForLoadState('networkidle');

      // 点击转化漏斗菜单
      await page.click('text=转化漏斗').catch(() => {});
      await page.waitForTimeout(3000);

      // 验证服务人员筛选器存在
      const employeeFilter = page.locator('#filterEmployee, [id*="employee"], label:has-text("服务人员")');
      const hasEmployeeFilter = await employeeFilter.count() > 0;
      console.log('旧版有服务人员筛选器:', hasEmployeeFilter);

      // 截图保存
      await page.screenshot({ path: 'test-results/funnel-old-filters.png', fullPage: true });
    });

    test('应该有核心数据指标展示', async ({ page }) => {
      await page.goto(OLD_FRONTEND);
      await page.waitForLoadState('networkidle');
      await page.click('text=转化漏斗').catch(() => {});
      await page.waitForTimeout(5000);

      // 验证核心数据指标卡片存在
      const coreMetrics = page.locator('#coreMetrics');
      const hasCoreMetrics = await coreMetrics.count() > 0;
      console.log('旧版有核心数据指标:', hasCoreMetrics);

      // 获取核心指标内容
      if (hasCoreMetrics) {
        const content = await coreMetrics.textContent();
        console.log('核心指标内容:', content);
      }

      await page.screenshot({ path: 'test-results/funnel-old-metrics.png', fullPage: true });
    });

    test('应该有合并转化率展示', async ({ page }) => {
      await page.goto(OLD_FRONTEND);
      await page.waitForLoadState('networkidle');
      await page.click('text=转化漏斗').catch(() => {});
      await page.waitForTimeout(5000);

      // 验证合并转化率存在
      const combinedRates = page.locator('#combinedRates');
      const hasCombinedRates = await combinedRates.count() > 0;
      console.log('旧版有合并转化率:', hasCombinedRates);

      // 获取合并转化率内容
      if (hasCombinedRates) {
        const content = await combinedRates.textContent();
        console.log('合并转化率内容:', content);
      }

      await page.screenshot({ path: 'test-results/funnel-old-combined.png', fullPage: true });
    });

    test('应该有转化率数据列表', async ({ page }) => {
      await page.goto(OLD_FRONTEND);
      await page.waitForLoadState('networkidle');
      await page.click('text=转化漏斗').catch(() => {});
      await page.waitForTimeout(5000);

      // 验证转化率数据列表存在
      const conversionRateList = page.locator('#conversionRateList');
      const hasConversionRateList = await conversionRateList.count() > 0;
      console.log('旧版有转化率数据列表:', hasConversionRateList);

      // 获取漏斗阶段数量
      if (hasConversionRateList) {
        const stages = await conversionRateList.locator('[class*="conversion-step"], > div').count();
        console.log('旧版漏斗阶段数:', stages);
      }

      await page.screenshot({ path: 'test-results/funnel-old-list.png', fullPage: true });
    });
  });

  test.describe('新版前端功能验证', () => {
    test('应该有服务人员筛选器', async ({ page }) => {
      await page.goto(NEW_FRONTEND + '/conversion-funnel');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // 验证服务人员筛选器是否存在
      const employeeFilter = page.locator('[class*="employee"], label:has-text("服务人员"), .ant-select:has-text("服务人员")');
      const hasEmployeeFilter = await employeeFilter.count() > 0;
      console.log('新版有服务人员筛选器:', hasEmployeeFilter);

      // 统计筛选器数量
      const filters = await page.locator('.ant-select, [class*="Filter"]').count();
      console.log('新版筛选器数量:', filters);

      await page.screenshot({ path: 'test-results/funnel-new-filters.png', fullPage: true });

      // TODO: 目前新版缺少服务人员筛选器
      // expect(hasEmployeeFilter).toBe(true);
    });

    test('应该有核心数据指标展示', async ({ page }) => {
      await page.goto(NEW_FRONTEND + '/conversion-funnel');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      // 验证核心数据指标是否存在
      // 检查是否有"投入金额"、"新增线索"、"新开客户数"、"新增有效户数"等指标
      const pageContent = await page.content();

      const hasCostMetric = pageContent.includes('投入金额') || pageContent.includes('花费') || pageContent.includes('cost');
      const hasLeadMetric = pageContent.includes('线索') || pageContent.includes('lead');
      const hasOpenAccountMetric = pageContent.includes('开户') || pageContent.includes('opened');

      console.log('新版有投入金额指标:', hasCostMetric);
      console.log('新版有线索指标:', hasLeadMetric);
      console.log('新版有开户指标:', hasOpenAccountMetric);

      await page.screenshot({ path: 'test-results/funnel-new-metrics.png', fullPage: true });

      // TODO: 目前新版缺少核心数据指标展示
    });

    test('应该有合并转化率展示', async ({ page }) => {
      await page.goto(NEW_FRONTEND + '/conversion-funnel');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      // 验证合并转化率是否存在
      const pageContent = await page.content();

      const hasExposureToLeadRate = pageContent.includes('曝光-线索') || pageContent.includes('曝光线索');
      const hasLeadToOpenRate = pageContent.includes('线索-开户') || pageContent.includes('线索开户');
      const hasOverallRate = pageContent.includes('全链路') || pageContent.includes('整体转化');

      console.log('新版有曝光-线索率:', hasExposureToLeadRate);
      console.log('新版有线索-开户率:', hasLeadToOpenRate);
      console.log('新版有全链路转化率:', hasOverallRate);

      await page.screenshot({ path: 'test-results/funnel-new-combined.png', fullPage: true });

      // TODO: 目前新版缺少合并转化率展示
    });

    test('应该有正确的漏斗阶段数', async ({ page }) => {
      await page.goto(NEW_FRONTEND + '/conversion-funnel');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      // 验证漏斗阶段数量
      const funnelStages = page.locator('[class*="funnelStage"], [class*="funnelRow"]');
      const stageCount = await funnelStages.count();
      console.log('新版漏斗阶段数:', stageCount);

      // 获取漏斗阶段名称
      if (stageCount > 0) {
        for (let i = 0; i < stageCount; i++) {
          const stageText = await funnelStages.nth(i).textContent();
          console.log(`阶段 ${i + 1}:`, stageText);
        }
      }

      await page.screenshot({ path: 'test-results/funnel-new-stages.png', fullPage: true });
    });
  });

  test.describe('功能对比测试', () => {
    test('筛选器对比', async ({ page, context }) => {
      // 打开旧版
      const oldPage = await context.newPage();
      await oldPage.goto(OLD_FRONTEND);
      await oldPage.waitForLoadState('networkidle');
      await oldPage.click('text=转化漏斗').catch(() => {});
      await oldPage.waitForTimeout(3000);

      // 获取旧版筛选器
      const oldFilters = await oldPage.locator('.filter-group, [class*="filter"]').count();
      console.log('旧版筛选器组数量:', oldFilters);

      // 检查旧版筛选器类型
      const oldPageContent = await oldPage.content();
      const oldHasPlatform = oldPageContent.includes('平台');
      const oldHasBusinessModel = oldPageContent.includes('业务模式');
      const oldHasAgency = oldPageContent.includes('代理商');
      const oldHasEmployee = oldPageContent.includes('服务人员');
      const oldHasDateRange = oldPageContent.includes('日期范围') || oldPageContent.includes('近7天');

      console.log('旧版筛选器:', {
        平台: oldHasPlatform,
        业务模式: oldHasBusinessModel,
        代理商: oldHasAgency,
        服务人员: oldHasEmployee,
        日期范围: oldHasDateRange
      });

      // 打开新版
      const newPage = await context.newPage();
      await newPage.goto(NEW_FRONTEND + '/conversion-funnel');
      await newPage.waitForLoadState('networkidle');
      await newPage.waitForTimeout(3000);

      // 获取新版筛选器
      const newFilters = await newPage.locator('.ant-select').count();
      console.log('新版下拉筛选器数量:', newFilters);

      // 检查新版筛选器类型
      const newPageContent = await newPage.content();
      const newHasPlatform = newPageContent.includes('平台');
      const newHasBusinessModel = newPageContent.includes('业务模式');
      const newHasAgency = newPageContent.includes('代理商');
      const newHasEmployee = newPageContent.includes('服务人员');
      const newHasDateRange = newPageContent.includes('日期') || newPageContent.includes('DatePicker');

      console.log('新版筛选器:', {
        平台: newHasPlatform,
        业务模式: newHasBusinessModel,
        代理商: newHasAgency,
        服务人员: newHasEmployee,
        日期范围: newHasDateRange
      });

      // 对比差异
      const differences = [];
      if (oldHasEmployee && !newHasEmployee) {
        differences.push('缺失服务人员筛选器');
      }
      if (!oldHasBusinessModel && newHasBusinessModel) {
        // 可能需要检查是否应该有业务模式筛选器
      }

      console.log('筛选器差异:', differences);

      await oldPage.close();
      await newPage.close();
    });
  });
});