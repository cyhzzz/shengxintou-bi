/**
 * 新前端功能测试汇总报告工具
 */

import { FunctionalTestResult } from './types';

export function generateFunctionalTestReport(results: FunctionalTestResult[]): string {
  const report: string[] = [];
  const timestamp = new Date().toISOString();

  report.push('# 新前端功能测试报告');
  report.push(`\n**生成时间**: ${timestamp}`);
  report.push('\n---\n');

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

  const pageGroups = groupByPage(results);
  report.push('\n## 📋 分页面结果\n');

  for (const [page, pageResults] of Object.entries(pageGroups)) {
    const pagePassed = pageResults.filter(r => r.status === 'passed').length;
    const pageTotal = pageResults.length;
    const status = pagePassed === pageTotal ? '✅' : pagePassed > 0 ? '⚠️' : '❌';

    report.push(`### ${status} ${formatPageName(page)}\n`);
    report.push('| 测试项 | 状态 |');
    report.push('|--------|------|');

    for (const result of pageResults) {
      const testStatus = result.status === 'passed' ? '✅ 通过' : result.status === 'failed' ? '❌ 失败' : '⏭️ 跳过';
      report.push(`| ${result.testName} | ${testStatus} |`);
    }
    report.push('');
  }

  const failedResults = results.filter(r => r.status === 'failed');
  if (failedResults.length > 0) {
    report.push('## ❌ 失败的测试\n');
    for (const failed of failedResults) {
      report.push(`- **${failed.page} - ${failed.testName}**: ${failed.error || '未知错误'}`);
    }
    report.push('');
  }

  return report.join('\n');
}

function groupByPage(results: FunctionalTestResult[]): Record<string, FunctionalTestResult[]> {
  return results.reduce((acc, result) => {
    if (!acc[result.page]) {
      acc[result.page] = [];
    }
    acc[result.page].push(result);
    return acc;
  }, {} as Record<string, FunctionalTestResult[]>);
}

function formatPageName(page: string): string {
  const nameMap: Record<string, string> = {
    'dashboard': '数据概览',
    'agency-analysis': '厂商分析',
    'leads-detail': '线索明细',
    'conversion-funnel': '转化漏斗',
    'xhs-notes-list': '小红书笔记列表',
    'xhs-notes-operation': '小红书运营分析',
    'employee-conversion-analysis': '员工转化分析',
    'employee-conversion-weekly': '员工转化周报',
    'account-management': '账号管理',
    'data-import': '数据导入',
    'abbreviation-management': '简称映射管理',
    'database-backup': '数据库备份'
  };
  return nameMap[page] || page;
}

export function printFunctionalTestSummary(results: FunctionalTestResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('新前端功能测试汇总');
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
        if (r.error) {
          console.log(`    错误: ${r.error}`);
        }
      });
  }

  console.log('\n' + '='.repeat(60));
}

export default {
  generateFunctionalTestReport,
  printFunctionalTestSummary
};
