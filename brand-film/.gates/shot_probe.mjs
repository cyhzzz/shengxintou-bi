// quick screenshot probe: seek the GSAP timeline and capture full frames
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPuppeteer() {
  const roots = [
    path.join(__dirname, '..', 'film', 'node_modules'),
    path.join(__dirname, 'node_modules'),
    path.join(__dirname, '..', 'node_modules'),
  ];
  for (const r of roots) {
    try { return require(path.join(r, 'puppeteer-core')); } catch {}
  }
  return require('puppeteer-core');
}

(async () => {
  const target = process.argv[2];
  const times = (process.argv[3] || '8.5,15').split(',').map(Number);
  const outDir = process.argv[4] || '/tmp/shots';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await loadPuppeteer().launch({
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--force-device-scale-factor=1',
           '--hide-scrollbars', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  await page.goto('file://' + path.resolve(target), { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__timelines && Object.keys(window.__timelines).length', { timeout: 20000 });
  for (const t of times) {
    await page.evaluate((tt) => {
      const tl = Object.values(window.__timelines)[0];
      tl.seek(tt);
    }, t);
    await new Promise((r) => setTimeout(r, 250));
    const f = path.join(outDir, `t${t}.png`);
    await page.screenshot({ path: f });
    console.log('saved', f);
  }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
