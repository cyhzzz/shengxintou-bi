/**
 * MainLayout 组件行为测试（冒烟级）
 *
 * 背景：前端 59 个 TSX 源文件零组件测试（better-harness finding）。
 * 本 spec 验证 MainLayout 的核心渲染行为：
 *   1) 侧栏菜单正确渲染（含一级菜单和二级子菜单）
 *   2) 顶部面包屑显示当前页面名称
 *   3) 菜单点击触发路由跳转
 *   4) 主题切换按钮可交互
 *
 * 跑法：cd frontend-react && npm run test
 */
import { test, expect } from '@playwright/test';

test.describe('MainLayout 组件行为', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    // 等待 Suspense lazy chunk 加载完成
    await page.waitForTimeout(1500);
  });

  test('侧栏渲染：一级菜单项可见', async ({ page }) => {
    // 验证核心一级菜单（限定在侧栏 menu 内，避免与面包屑冲突）
    const menu = page.getByRole('menu');
    await expect(menu.getByText('全渠道获客')).toBeVisible();
    await expect(menu.getByText('互联网渠道数据概览')).toBeVisible();
    await expect(menu.getByText('转化漏斗')).toBeVisible();
    await expect(menu.getByText('厂商分析')).toBeVisible();
  });

  test('侧栏渲染：二级子菜单展开后可见', async ({ page }) => {
    // 点击「应用市场」展开子菜单
    await page.getByText('应用市场').click();
    await expect(page.getByText('获客漏斗')).toBeVisible();
    await expect(page.getByText('市场对比')).toBeVisible();
    await expect(page.getByText('计划分析').first()).toBeVisible();
  });

  test('面包屑：显示当前页面名称', async ({ page }) => {
    // /dashboard 路径 → 面包屑应显示「互联网渠道数据概览」
    await expect(page.locator('header').getByText('互联网渠道数据概览')).toBeVisible();
  });

  test('面包屑：切换路由后更新', async ({ page }) => {
    // 点击侧栏「转化漏斗」
    await page.getByText('转化漏斗').click();
    await page.waitForTimeout(800);
    // 面包屑应更新为「转化漏斗」
    await expect(page.locator('header').getByText('转化漏斗')).toBeVisible();
    // URL 应跳转
    expect(page.url()).toContain('/conversion-funnel');
  });

  test('主题切换按钮可交互', async ({ page }) => {
    // 主题切换按钮应存在且可点击
    const themeBtn = page.locator('[aria-label="切换主题"]');
    await expect(themeBtn).toBeVisible();
    await expect(themeBtn).toBeEnabled();
  });

  test('品牌标识渲染', async ({ page }) => {
    // Header 中「省心投」品牌名应可见
    await expect(page.locator('header').getByText('省心投').first()).toBeVisible();
  });
});
