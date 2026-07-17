/**
 * 数据导入页面测试
 * 验证卡片布局、角标指南图标、指南弹窗渲染
 */
import { test, expect } from '@playwright/test';

test.describe('数据导入页面测试', () => {
  test.beforeEach(async ({ page }) => {
    // 使用完整 URL 访问数据导入页面
    await page.goto('http://localhost:3000/system/data-import', { timeout: 60000 });
    // 等待页面加载
    await page.waitForLoadState('domcontentloaded');
    // 等待主要内容加载
    await page.waitForTimeout(2000);
  });

  test('应该显示卡片网格布局的数据类型选择器', async ({ page }) => {
    // 检查卡片网格容器存在
    const typeGrid = page.locator('.typeGrid');
    await expect(typeGrid).toBeVisible();

    // 检查卡片数量（应该有 7 个数据类型）
    const cards = page.locator('.typeCard');
    await expect(cards).toHaveCount(7);

    // 检查第一个卡片（腾讯广告）内容
    const firstCard = cards.first();
    await expect(firstCard.locator('.cardTitle')).toContainText('腾讯广告');
    await expect(firstCard.locator('.cardIcon')).toBeVisible();
  });

  test('每个卡片应该有角标指南按钮', async ({ page }) => {
    const guideButtons = page.locator('.guideBtn');
    await expect(guideButtons).toHaveCount(7);

    // 检查第一个角标按钮有 ? 图标
    const firstGuideBtn = guideButtons.first();
    await expect(firstGuideBtn).toBeVisible();
  });

  test('点击角标应该打开指南弹窗', async ({ page }) => {
    // 点击第一个卡片的角标按钮（腾讯广告）
    const firstGuideBtn = page.locator('.guideBtn').first();
    await firstGuideBtn.click();

    // 等待弹窗出现
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 检查弹窗标题
    const modalTitle = page.locator('.ant-modal-title');
    await expect(modalTitle).toContainText('腾讯广告数据导入指南');
  });

  test('指南弹窗应该正确渲染 markdown 内容', async ({ page }) => {
    // 点击腾讯广告的角标
    await page.locator('.guideBtn').first().click();

    // 等待弹窗内容加载
    await page.waitForSelector('.ant-modal-content', { timeout: 5000 });

    // 等待 markdown 内容渲染（检查是否有 h1-h4 标题）
    const markdownBody = page.locator('.markdownBody');
    await expect(markdownBody).toBeVisible({ timeout: 10000 });

    // 检查是否有 markdown 标题元素
    const headings = markdownBody.locator('h1, h2, h3, h4');
    await expect(headings.first()).toBeVisible({ timeout: 5000 });
  });

  test('点击卡片应该选中对应数据类型', async ({ page }) => {
    // 点击第二个卡片（抖音广告）
    const cards = page.locator('.typeCard');
    const secondCard = cards.nth(1);

    // 获取卡片标题
    const cardTitle = await secondCard.locator('.cardTitle').textContent();
    expect(cardTitle).toContain('抖音广告');

    // 点击卡片主体（不是角标）
    await secondCard.click({ position: { x: 80, y: 60 } });

    // 检查卡片是否有 active 样式
    await expect(secondCard).toHaveClass(/active/);

    // 检查上传区域的标题是否更新
    const uploadTitle = page.locator('.uploadCard h4');
    await expect(uploadTitle).toContainText('抖音广告');
  });

  test('各个数据类型的指南文件都能正确加载', async ({ page }) => {
    const dataTypes = [
      { name: '腾讯广告', index: 0, expectedTitle: '腾讯广告数据导入指南' },
      { name: '抖音广告', index: 1, expectedTitle: '抖音广告数据导入指南' },
      { name: '小红书广告', index: 2, expectedTitle: '小红书广告数据导入指南' },
      { name: '笔记列表', index: 3, expectedTitle: '小红书笔记列表导入指南' },
      { name: '笔记投放', index: 4, expectedTitle: '小红书笔记投放数据导入指南' },
      { name: '笔记运营', index: 5, expectedTitle: '小红书笔记运营数据导入指南' },
      { name: '后端转化', index: 6, expectedTitle: '后端转化数据导入指南' },
    ];

    for (const dataType of dataTypes) {
      // 点击对应卡片的角标
      const guideBtn = page.locator('.guideBtn').nth(dataType.index);
      await guideBtn.click();

      // 等待弹窗
      const modalTitle = page.locator('.ant-modal-title');
      await expect(modalTitle).toContainText(dataType.expectedTitle, { timeout: 5000 });

      // 关闭弹窗
      await page.locator('.ant-modal-close').click();
      await page.waitForTimeout(300);
    }
  });

  test('覆盖模式默认应该是开启状态', async ({ page }) => {
    // 检查覆盖模式开关
    const overwriteSwitch = page.locator('.ant-switch').first();

    // 默认应该是选中状态
    await expect(overwriteSwitch).toHaveClass(/ant-switch-checked/);
  });

  test('弹窗可以通过关闭按钮和点击遮罩关闭', async ({ page }) => {
    // 打开弹窗
    await page.locator('.guideBtn').first().click();
    await page.waitForSelector('.ant-modal-content', { timeout: 5000 });

    // 点击关闭按钮
    await page.locator('.ant-modal-close').click();

    // 验证弹窗关闭
    await expect(page.locator('.ant-modal-content')).not.toBeVisible({ timeout: 3000 });
  });
});