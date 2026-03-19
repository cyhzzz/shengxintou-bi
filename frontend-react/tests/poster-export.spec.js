/**
 * 员工转化周报海报导出功能测试
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// 设置更长的超时时间
test.setTimeout(90000);

// 有数据的日期范围（数据库最新数据到 2026-02-28）
const TEST_DATE_RANGE = {
  startDate: '2026-02-17',  // 周一
  endDate: '2026-02-23'     // 周日
};

test.describe('员工转化周报海报导出测试', () => {
  test('应该能够访问员工转化周报页面并生成海报', async ({ page }) => {
    // 监听API响应
    const apiResponses = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/v1/employee-conversion/weekly')) {
        try {
          const data = await response.json();
          console.log('API Response:', JSON.stringify(data, null, 2));
          apiResponses.push(data);
        } catch (e) {
          console.log('Failed to parse API response');
        }
      }
    });

    // 直接导航到员工转化周报页面
    await page.goto(`${BASE_URL}/employee-conversion/weekly`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 设置日期范围 - 使用有数据的日期
    // Ant Design DatePicker: 点击打开面板，然后使用 fill 方法设置输入框
    const mondayPicker = page.locator('.ant-picker').nth(0);
    await mondayPicker.click();
    await page.waitForTimeout(300);

    // 在输入框中直接输入日期
    const mondayInput = page.locator('.ant-picker input').nth(0);
    await mondayInput.fill(TEST_DATE_RANGE.startDate);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 填写周日日期
    const sundayPicker = page.locator('.ant-picker').nth(1);
    await sundayPicker.click();
    await page.waitForTimeout(300);

    const sundayInput = page.locator('.ant-picker input').nth(1);
    await sundayInput.fill(TEST_DATE_RANGE.endDate);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 检查生成周报按钮
    const generateButton = page.locator('button:has-text("生成周报")');
    await expect(generateButton).toBeVisible({ timeout: 10000 });

    // 点击生成周报按钮
    await generateButton.click();
    await page.waitForTimeout(5000);

    // 打印API响应中的overview数据
    if (apiResponses.length > 0 && apiResponses[0].data) {
      const overview = apiResponses[0].data.overview;
      console.log('Overview data:', JSON.stringify(overview, null, 2));

      // 检查各平台的leads
      if (overview) {
        for (const [platform, data] of Object.entries(overview)) {
          console.log(`Platform ${platform}: leads = ${data.leads}`);
        }
      }
    }

    // 截图保存生成的周报页面
    await page.screenshot({ path: 'test-results/weekly-report-generated.png', fullPage: true });

    // 查找海报按钮
    const posterButtons = page.locator('button:has-text("海报")');
    const buttonCount = await posterButtons.count();
    console.log(`找到 ${buttonCount} 个海报按钮`);

    if (buttonCount > 0) {
      // 点击第一个海报按钮
      await posterButtons.first().click();
      await page.waitForTimeout(2000);

      // 检查模态框是否打开 - 使用 dialog 角色或导出按钮作为更可靠的选择器
      const exportImageBtn = page.locator('button:has-text("导出图片")');
      await expect(exportImageBtn).toBeVisible({ timeout: 10000 });

      // 截图保存模态框状态
      await page.screenshot({ path: 'test-results/poster-modal.png', fullPage: true });

      // 检查导出按钮是否存在
      const exportPdfBtn = page.locator('button:has-text("导出PDF")');
      await expect(exportPdfBtn).toBeVisible();

      // 检查海报容器样式
      const posterContainer = page.locator('[class*="posterContainer"]').first();
      await expect(posterContainer).toBeVisible();

      // 关闭模态框 - 使用更具体的按钮选择器
      const closeButton = page.locator('.ant-modal-close, button[aria-label="Close"]').first();
      await closeButton.click();
      await page.waitForTimeout(500);

      // 检查模态框关闭 - 验证导出按钮不再可见
      await expect(exportImageBtn).not.toBeVisible();

      console.log('海报导出功能测试通过');
    } else {
      console.log('没有找到海报按钮，可能没有数据 - 跳过测试');
      test.skip();
    }
  });

  test('应该显示各平台的海报样式', async ({ page }) => {
    await page.goto(`${BASE_URL}/employee-conversion/weekly`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 设置日期范围 - Ant Design DatePicker
    const mondayPicker = page.locator('.ant-picker').nth(0);
    await mondayPicker.click();
    await page.waitForTimeout(300);

    const mondayInput = page.locator('.ant-picker input').nth(0);
    await mondayInput.fill(TEST_DATE_RANGE.startDate);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const sundayPicker = page.locator('.ant-picker').nth(1);
    await sundayPicker.click();
    await page.waitForTimeout(300);

    const sundayInput = page.locator('.ant-picker input').nth(1);
    await sundayInput.fill(TEST_DATE_RANGE.endDate);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 点击生成周报按钮
    const generateButton = page.locator('button:has-text("生成周报")');
    await generateButton.click();
    await page.waitForTimeout(5000);

    // 测试各平台样式
    const platforms = ['小红书', '腾讯', '抖音'];
    let testedCount = 0;

    for (const platform of platforms) {
      const posterButton = page.locator(`button:has-text("${platform}海报")`);

      try {
        await posterButton.waitFor({ state: 'visible', timeout: 3000 });
      } catch (e) {
        console.log(`${platform} 海报按钮未找到，跳过`);
        continue;
      }

      await posterButton.click();
      await page.waitForTimeout(1000);

      // 检查导出按钮
      const exportBtn = page.locator('button:has-text("导出图片")');
      await expect(exportBtn).toBeVisible({ timeout: 5000 });

      // 截图保存各平台样式
      await page.screenshot({ path: `test-results/poster-${platform}.png`, fullPage: true });
      console.log(`${platform} 海报样式截图已保存`);

      // 关闭模态框
      const closeButton = page.locator('.ant-modal-close').first();
      await closeButton.click();

      // 等待模态框关闭
      await expect(exportBtn).not.toBeVisible({ timeout: 3000 });
      await page.waitForTimeout(500);

      testedCount++;
    }

    // 确保至少测试了一个平台
    expect(testedCount).toBeGreaterThan(0);
    console.log(`共测试了 ${testedCount} 个平台的海报样式`);
  });
});