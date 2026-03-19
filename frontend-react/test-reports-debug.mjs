import { chromium } from 'playwright';

async function testReports() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 监听控制台消息
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });

  // 监听网络请求
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
      if (response.status() >= 400) {
        const text = await response.text();
        console.log(`[ERROR BODY] ${text}`);
      }
    }
  });

  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('\n=== Testing Employee Conversion Analysis ===');
  try {
    const response = await page.goto('http://localhost:3001/employee-conversion/analysis', { waitUntil: 'networkidle' });
    console.log('Page loaded, status:', response?.status());
    
    await page.waitForTimeout(5000);

    // 获取页面标题
    const title = await page.title();
    console.log('Page title:', title);

    // 检查是否有React root
    const rootContent = await page.locator('#root').innerHTML();
    console.log('Root element content length:', rootContent.length);
    
    // 检查是否有错误元素
    const hasError = await page.locator('text=/error|错误/i').count();
    console.log('Error elements count:', hasError);

    // 截图
    await page.screenshot({ path: 'test-debug-employee.png', fullPage: true });
    console.log('Screenshot saved: test-debug-employee.png');

  } catch (error) {
    console.error('Test error:', error);
  }

  await browser.close();
  console.log('\nTest completed!');
}

testReports().catch(console.error);
