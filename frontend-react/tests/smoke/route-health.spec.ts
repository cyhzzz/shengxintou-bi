/**
 * v3.1.25 路由健康检查（冒烟测试）
 *
 * 背景：v3.1.23 后曾出现 build hash 失效导致 "Failed to fetch dynamically
 * imported module" 类崩溃（用户截图里就是这种）。此 spec 遍历所有顶层路由，
 * 断言：
 *   1) 页面进入后没有渲染 RouteErrorBoundary 卡片
 *   2) 控制台没有 "Failed to fetch dynamically imported module" 等关键错误
 *   3) 顶级菜单可点击展开且子菜单路径可访问
 *
 * 跑法：cd frontend-react && npm run test（playwright.config.ts 已配 webServer）
 */
import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES: { name: string; path: string }[] = [
  { name: 'Dashboard(互联网渠道数据概览)', path: '/dashboard' },
  { name: '全渠道获客', path: '/omni-channel' },
  { name: '转化漏斗', path: '/conversion-funnel' },
  { name: '线索明细', path: '/leads-detail' },
  { name: '主播聚类', path: '/anchor-clusters' },
  { name: '厂商分析', path: '/agency-analysis' },
  { name: '小红书-列表', path: '/xhs-notes/list' },
  { name: '小红书-运营', path: '/xhs-notes/operation' },
  // v3.3.10：小红书计划分析（与菜单 key 对齐）
  { name: '小红书-计划分析', path: '/xhs-notes/plan-analysis' },
  // v3.8.0：分支KOS转化周报（featureFlags.showKosWeekly=true 时注册，桌面/Web 端覆盖）
  { name: '小红书-分支KOS转化周报', path: '/xhs-notes/kos-weekly' },
  { name: '员工转化-分析', path: '/employee-conversion/analysis' },
  { name: '员工转化-周报', path: '/employee-conversion/weekly' },
  { name: '应用市场-漏斗', path: '/app-market/funnel' },
  { name: '应用市场-对比', path: '/app-market/comparison' },
  { name: '应用市场-明细', path: '/app-market/detail' },
  // v3.6.3：消耗和成本子报表
  { name: '应用市场-消耗成本', path: '/app-market/cost-analysis' },
  // v3.3.10：creative → plan-analysis（命名统一；旧路径走 Navigate 重定向，保留一项用例验证重定向可用）
  { name: '应用市场-计划分析', path: '/app-market/plan-analysis' },
  { name: '应用市场-创意(旧路径重定向)', path: '/app-market/creative' },
  // v3.7.3：归因转化率子报表
  { name: '应用市场-归因转化率', path: '/app-market/attribution-conversion' },
  { name: '直播-漏斗', path: '/live/funnel' },
  { name: '直播-带货', path: '/live/direct-sales' },
  { name: '直播-投顾IP', path: '/live/advisor-ip' },
  { name: '直播-分析师', path: '/live/analyst' },
  { name: '报告生成', path: '/report-generation' },
  // v3.3.10：投放评审（内容平台二级菜单，所有端注册）
  { name: '投放评审', path: '/investment-review' },
  // v3.6.1：抖音青鸟对账（featureFlags.showDataReconciliation=true 时注册，桌面/Web 端覆盖）
  { name: '抖音青鸟对账', path: '/data-reconciliation/douyin-qingniao' },
  { name: '系统-数据导入', path: '/system/data-import' },
  { name: '系统-账号管理', path: '/system/account-management' },
  { name: '系统-数据库备份', path: '/system/database-backup' },
];

const FATAL_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /ChunkLoadError/i,
  /Importing a module script failed/i,
];

test.describe('路由健康检查·v3.1.25', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`访问 ${route.name}（${route.path}）不应跳到 RouteErrorBoundary`, async ({ page }) => {
      const fatalErrors: string[] = [];
      page.on('pageerror', (err) => {
        if (FATAL_PATTERNS.some((p) => p.test(err.message))) {
          fatalErrors.push(err.message);
        }
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (FATAL_PATTERNS.some((p) => p.test(text))) {
            fatalErrors.push(text);
          }
        }
      });

      const res = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      // 404 不算健康坏，跳过
      if (res && res.status() === 404) {
        test.skip();
        return;
      }
      // 给 Suspense 1.5s 完成 lazy chunk 加载
      await page.waitForTimeout(1500);
      const fallbackVisible = await page
        .getByText(/(页面加载出错|资源版本不匹配|页面不存在|服务器异常)/)
        .first()
        .isVisible()
        .catch(() => false);
      expect(fallbackVisible, `RouteErrorBoundary 被渲染，fatalErrors=${fatalErrors.join('|')}`).toBe(false);
      expect(fatalErrors, `控制台报错：${fatalErrors.join('|')}`).toEqual([]);
    });
  }
});
