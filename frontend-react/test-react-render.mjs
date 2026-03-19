import { chromium } from 'playwright';

async function testReactRender() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 收集所有控制台消息
  const consoleMessages = [];
  const errors = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);

    if (type === 'error') {
      errors.push(text);
    }
  });

  // 捕获页面错误
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    errors.push(error.message);
  });

  // 捕获请求失败
  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
  });

  console.log('\n=== Loading Employee Conversion Analysis Page ===\n');

  try {
    await page.goto('http://localhost:3001/employee-conversion/analysis', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 等待一段时间让 React 渲染
    await page.waitForTimeout(5000);

    // 检查页面状态
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        innerHTML: root?.innerHTML || '',
        innerText: root?.innerText || '',
        children: root?.children.length || 0
      };
    });

    console.log('\n=== Page State ===');
    console.log('Root children count:', rootContent.children);
    console.log('Root innerText preview:', rootContent.innerText.substring(0, 200));

    // 检查是否有 Ant Design 组件
    const antdComponents = await page.evaluate(() => {
      const cards = document.querySelectorAll('.ant-card');
      const selects = document.querySelectorAll('.ant-select');
      const tables = document.querySelectorAll('.ant-table');
      return {
        cards: cards.length,
        selects: selects.length,
        tables: tables.length
      };
    });

    console.log('\n=== Ant Design Components ===');
    console.log('Cards:', antdComponents.cards);
    console.log('Selects:', antdComponents.selects);
    console.log('Tables:', antdComponents.tables);

    // 打印所有错误
    console.log('\n=== All Errors ===');
    errors.forEach((err, i) => {
      console.log(`Error ${i + 1}:`, err);
    });

    // 检查 script 标签
    const scripts = await page.evaluate(() => {
      const scriptTags = document.querySelectorAll('script');
      return Array.from(scriptTags).map(s => ({
        src: s.src,
        type: s.type,
        hasContent: s.innerHTML.length > 0
      }));
    });

    console.log('\n=== Script Tags ===');
    scripts.forEach((s, i) => {
      console.log(`Script ${i + 1}: src=${s.src || 'inline'}, type=${s.type || 'text/javascript'}`);
    });

  } catch (error) {
    console.error('Test failed:', error);
  }

  // 保持浏览器打开以便查看
  console.log('\n=== Keeping browser open for 10 seconds ===');
  await page.waitForTimeout(10000);

  await browser.close();
}

testReactRender().catch(console.error);