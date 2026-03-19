/**
 * 前端对比测试汇总报告工具
 * 用于生成对比测试结果汇总报告
 */

import { TestResult, ComparisonResult, PageComparisonSummary } from './types';

/**
 * 生成对比测试汇总报告
 */
export function generateSummaryReport(results: ComparisonResult[]): string {
  const report: string[] = [];
  const timestamp = new Date().toISOString();

  report.push('# 前端迁移对比测试报告');
  report.push(`\n**生成时间**: ${timestamp}`);
  report.push('\n---\n');

  // 总体统计
  const totalTests = results.length;
  const passedTests = results.filter(r => r.status === 'passed').length;
  const failedTests = results.filter(r => r.status === 'failed').length;
  const skippedTests = results.filter(r => r.status === 'skipped').length;

  report.push('## 📊 测试统计\n');
  report.push('| 指标 | 数值 |');
  report.push('|------|------|');
  report.push(`| 总测试数 | ${totalTests} |`);
  report.push(`| ✅ 通过 | ${passedTests} |`);
  report.push(`| ❌ 失败 | ${failedTests} |`);
  report.push(`| ⏭️ 跳过 | ${skippedTests} |`);
  report.push(`| 通过率 | ${((passedTests / totalTests) * 100).toFixed(1)}% |`);

  // 按页面分组
  report.push('\n## 📋 分页面结果\n');
  const pageGroups = groupByPage(results);

  for (const [page, pageResults] of Object.entries(pageGroups)) {
    const pagePassed = pageResults.filter(r => r.status === 'passed').length;
    const pageTotal = pageResults.length;
    const status = pagePassed === pageTotal ? '✅' : pagePassed > 0 ? '⚠️' : '❌';

    report.push(`### ${status} ${formatPageName(page)}\n`);
    report.push('| 测试项 | 旧前端 | 新前端 | 状态 |');
    report.push('|--------|--------|--------|------|');

    for (const result of pageResults) {
      const oldStatus = result.oldFrontend ? '✅' : '❌';
      const newStatus = result.newFrontend ? '✅' : '❌';
      const testStatus = result.status === 'passed' ? '✅ 通过' : '❌ 失败';
      report.push(`| ${result.testName} | ${oldStatus} | ${newStatus} | ${testStatus} |`);
    }
    report.push('');
  }

  // 问题汇总
  const issues = results.filter(r => r.status === 'failed' || !r.newFrontend);
  if (issues.length > 0) {
    report.push('## ⚠️ 发现的问题\n');
    for (const issue of issues) {
      report.push(`- **${issue.page} - ${issue.testName}**: ${issue.message || '新前端功能缺失或异常'}`);
    }
    report.push('');
  }

  // 建议
  report.push('## 💡 迁移建议\n');
  const pagesWithIssues = new Set(issues.map(i => i.page));
  if (pagesWithIssues.size === 0) {
    report.push('所有测试通过，迁移状态良好！');
  } else {
    report.push('以下页面需要重点关注：\n');
    for (const page of pagesWithIssues) {
      report.push(`1. **${formatPageName(page)}**: 检查新前端实现是否完整`);
    }
  }

  return report.join('\n');
}

/**
 * 按页面分组结果
 */
function groupByPage(results: ComparisonResult[]): Record<string, ComparisonResult[]> {
  return results.reduce((acc, result) => {
    if (!acc[result.page]) {
      acc[result.page] = [];
    }
    acc[result.page].push(result);
    return acc;
  }, {} as Record<string, ComparisonResult[]>);
}

/**
 * 格式化页面名称
 */
function formatPageName(page: string): string {
  const nameMap: Record<string, string> = {
    'dashboard': '数据概览',
    'agency-analysis': '厂商分析',
    'leads-detail': '线索明细',
    'conversion-funnel': '转化漏斗',
    'xhs-notes': '小红书报表',
    'employee-conversion': '员工转化',
    'account-management': '账号管理',
    'data-import': '数据导入',
    'abbreviation-management': '简称映射管理',
    'report-generation': '报告生成'
  };
  return nameMap[page] || page;
}

/**
 * 打印测试结果到控制台
 */
export function printTestSummary(results: ComparisonResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('前端迁移对比测试汇总');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const total = results.length;

  console.log(`\n总计: ${total} 个测试`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`通过率: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n失败的测试:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`  - ${r.page}: ${r.testName}`);
      });
  }

  console.log('\n' + '='.repeat(60));
}

export default {
  generateSummaryReport,
  printTestSummary
};