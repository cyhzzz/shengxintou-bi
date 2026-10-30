// Placement probe: seek the GSAP timeline to given timestamps and dump the
// bounding rects of the elements we care about, so fixes are measured not guessed.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pathToFileURL } from 'url';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const TIMES = (args.find(a => a.startsWith('--t=')) || '--t=2,8,14').slice(4).split(',').map(Number);
const SEL = (args.find(a => a.startsWith('--sel=')) || '--sel=#a1h1,#a1h2,#a1hook,#a2h,#a2sub,#a3h,#a3sub,#a4h').slice(6);

function loadPuppeteer() {
  const tries = [process.cwd(), path.dirname(path.resolve(file)), path.dirname(new URL(import.meta.url).pathName || new URL(import.meta.url).pathname)];
  for (const base of tries) {
    try { return createRequire(path.join(base, 'x.js'))('puppeteer-core'); } catch {}
  }
  const npx = path.join(os.homedir(), '.npm', '_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) {
    const p = path.join(npx, d, 'node_modules', 'puppeteer-core');
    if (fs.existsSync(p)) { try { return createRequire(path.join(npx, d, 'x.js'))('puppeteer-core'); } catch {} }
  }
  console.error('puppeteer-core not found'); process.exit(2);
}
const puppeteer = loadPuppeteer().default || loadPuppeteer();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => document.fonts && document.fonts.ready);

const sels = SEL.split(',').map(s => s.trim()).filter(Boolean);
for (const t of TIMES) {
  const res = await page.evaluate(({ t, sels }) => {
    const tl = Object.values(window.__timelines)[0];
    tl.seek(t);
    const out = [];
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        // same text box the layout audit measures: union of the text-node rects
        const tn = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
        let box = null;
        if (tn.length) {
          const range = document.createRange();
          for (const n of tn) { range.selectNodeContents(n); for (const r of range.getClientRects()) {
            if (r.width < 2 || r.height < 2) continue;
            box = box ? { l: Math.min(box.l, r.left), t: Math.min(box.t, r.top), r: Math.max(box.r, r.right), b: Math.max(box.b, r.bottom) }
                      : { l: r.left, t: r.top, r: r.right, b: r.bottom }; } }
        }
        const cs = getComputedStyle(el);
        out.push({ sel: s, id: el.id || '', tag: el.tagName.toLowerCase(),
          x: box ? Math.round(box.l) : null, y: box ? Math.round(box.t) : null,
          w: box ? Math.round(box.r - box.l) : null, h: box ? Math.round(box.b - box.t) : null,
          op: cs.opacity, fs: cs.fontSize });
      }
    }
    const cams = {};
    for (const c of document.querySelectorAll('.cam')) cams[c.id] = getComputedStyle(c).transform;
    return { rows: out, cams };
  }, { t, sels });
  console.log('\n=== t=' + t + 's');
  for (const [k, v] of Object.entries(res.cams)) console.log('    cam ' + k + ': ' + v);
  for (const r of res.rows) {
    if (r.x === null) { console.log('  ' + r.sel + ' (no direct text)'); continue; }
    console.log('  %-10s x=%-6s y=%-6s w=%-6s h=%-6s right=%-6s bottom=%-6s op=%s fs=%s',
      r.sel + (r.id ? '#' + r.id : ''), r.x, r.y, r.w, r.h, r.x + r.w, r.y + r.h, r.op, r.fs);
  }
}
await browser.close();
