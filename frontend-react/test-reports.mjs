import { chromium } from 'playwright';

async function testReports() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 监听控制台错误
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  // 监听网络请求失败
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });

  // 监听网络响应
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log('API RESPONSE:', response.url(), response.status());
    }
  });

  console.log('\n=== Testing Employee Conversion Analysis ===');
  await page.goto('http://localhost:3001/employee-conversion/analysis', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // 截图
  await page.screenshot({ path: 'test-employee-conversion.png', fullPage: true });
  console.log('Screenshot saved: test-employee-conversion.png');

  // 检查页面内容
  const content = await page.content();
  console.log('Page has .ant-card:', content.includes('ant-card'));
  console.log('Page has .ant-table:', content.includes('ant-table'));
  console.log('Page has "暂无数据":', content.includes('暂无数据'));
  console.log('Page has "加载中":', content.includes('加载中'));

  console.log('\n=== Testing Agency Analysis ===');
  await page.goto('http://localhost:3001/agency-analysis', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-agency-analysis.png', fullPage: true });
  console.log('Screenshot saved: test-agency-analysis.png');

  console.log('\n=== Testing XHS Notes List ===');
  await page.goto('http://localhost:3001/xhs-notes/list', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-xhs-notes.png', fullPage: true });
  console.log('Screenshot saved: test-xhs-notes.png');

  console.log('\n=== Testing XHS Operation Analysis ===');
  await page.goto('http://localhost:3001/xhs-notes/operation', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-xhs-operation.png', fullPage: true });
  console.log('Screenshot saved: test-xhs-operation.png');

  await browser.close();
  console.log('\nTest completed!');
}

testReports().catch(console.error);
