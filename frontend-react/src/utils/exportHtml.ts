/**
 * 单文件 HTML 导出工具（静态快照方案）
 *
 * 遍历海报 DOM：计算样式逐节点内联到克隆树，<canvas>（ECharts 图表）
 * 替换为 toDataURL 的 <img>。产出零脚本、零外链（禁 CDN 红线）、
 * 完全离线可打开的单文件 HTML；表格保留真实 HTML（接收方可选中复制）。
 *
 * 为什么不是「内联 echarts.min.js + 活图表」：
 *   ECharts 6 的 npm 包不再发布 dist/echarts.min.js（仅 ESM 入口），
 *   无 UMD 产物可内联，故降级为图表 PNG 快照（图表视觉 100% 等同页面渲染）。
 *
 * 已知限制：
 *   - 伪元素（::before/::after）内容不导出（当前海报未依赖伪元素承载信息）
 *   - 内联的是导出时刻的计算样式（固定 px），快照语义下属预期行为
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'IFRAME']);

// 需要内联的样式属性白名单（kebab-case）：覆盖报表用到的盒模型/布局/排版/边框背景
const STYLE_PROPS = [
  // 定位与盒模型
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear',
  'box-sizing', 'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'aspect-ratio',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  // flex / grid
  'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'flex-wrap',
  'align-items', 'align-content', 'align-self', 'justify-content', 'justify-items', 'justify-self',
  'order', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'grid-area',
  // 溢出
  'overflow', 'overflow-x', 'overflow-y',
  // 字体与排版
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'line-height',
  'letter-spacing', 'word-spacing', 'color', 'text-align', 'text-align-last', 'text-transform',
  'text-decoration', 'text-decoration-line', 'text-decoration-color', 'text-indent',
  'white-space', 'word-break', 'overflow-wrap', 'text-overflow', 'vertical-align',
  'writing-mode', 'text-shadow', 'direction', '-webkit-line-clamp', '-webkit-box-orient',
  // 边框与背景
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-collapse', 'border-spacing', 'border-radius',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'outline', 'box-shadow',
  'background', 'background-color', 'background-image', 'background-size',
  'background-position', 'background-repeat', 'background-clip',
  // 其他
  'opacity', 'visibility', 'transform', 'transform-origin',
  'table-layout', 'empty-cells', 'caption-side', 'list-style', 'list-style-type',
  'object-fit', 'filter', 'backdrop-filter', 'cursor', 'user-select',
];

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineStyleOf(el: Element): string {
  const cs = window.getComputedStyle(el);
  let css = '';
  for (const prop of STYLE_PROPS) {
    const v = cs.getPropertyValue(prop);
    if (v) css += `${prop}:${v};`;
  }
  return css;
}

function buildNode(src: Node): Node | null {
  if (src.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(src.textContent || '');
  }
  if (src.nodeType !== Node.ELEMENT_NODE) return null;
  const el = src as Element;
  if (SKIP_TAGS.has(el.tagName)) return null;

  // 图表 canvas → PNG 快照 <img>（ECharts 画布未跨域污染，toDataURL 同步可用）
  if (el.tagName === 'CANVAS') {
    try {
      const img = document.createElement('img');
      img.src = (el as HTMLCanvasElement).toDataURL('image/png');
      img.alt = 'chart';
      const cs = window.getComputedStyle(el);
      // img 必须显式锁定 CSS 尺寸：canvas 内部像素（devicePixelRatio 放大）≠ 页面显示尺寸
      img.setAttribute('style', `display:block;width:${cs.width};height:${cs.height};`);
      return img;
    } catch {
      return null;
    }
  }

  const clone = document.createElement(el.tagName);
  const css = inlineStyleOf(el);
  if (css) clone.setAttribute('style', css);
  // 表格结构属性无对应计算样式，需显式保留
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === 'colspan' || attr.name === 'rowspan') clone.setAttribute(attr.name, attr.value);
  }
  for (const child of Array.from(el.childNodes)) {
    const c = buildNode(child);
    if (c) clone.appendChild(c);
  }
  return clone;
}

/**
 * 将海报容器转换为自包含单文件 HTML
 *
 * @param root  海报根节点（概览版 / 详细版容器）
 * @param title 文档标题（同时用于文件名语义，不含扩展名）
 */
export function elementToSelfContainedHtml(root: HTMLElement, title: string): string {
  const clone = buildNode(root);
  const innerHtml = clone instanceof HTMLElement ? clone.outerHTML : '';
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtmlText(title)}</title>`,
    '</head>',
    '<body style="margin:0;padding:16px;background:#eef0f4;overflow-x:auto;">',
    `<div style="width:${root.offsetWidth}px;margin:0 auto;background:#ffffff;box-shadow:0 2px 12px rgba(0,0,0,.08);">${innerHtml}</div>`,
    '</body>',
    '</html>',
  ].join('\n');
}
