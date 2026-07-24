/**
 * 跨端文件保存工具
 *
 * - Web/Desktop：走浏览器 <a download> 触发下载
 * - 移动端（Capacitor Android）：Android WebView 默认拦截 <a download>，
 *   改用 @capacitor/filesystem 写入 Documents 目录，避免「提示成功但未真正保存」
 *
 * v3.5.8：截图库从 html2canvas 切到 modern-screenshot
 *   - html2canvas 用 JS 模拟 DOM 渲染，对 inline-flex / flex gap / CSS variables
 *     支持不完善，在 Android WebView 下会出现子元素重叠、列宽塌缩
 *   - modern-screenshot 基于 SVG foreignObject，使用浏览器原生渲染，
 *     对现代 CSS 完整支持，0 依赖、MIT、活跃维护
 */
import { Filesystem, Directory } from '@capacitor/filesystem';
import { domToCanvas } from 'modern-screenshot';
import { isMobileClient } from './isDesktop';

/**
 * body.mobile-scaled 下 zoom:0.67 !important，任何截图库（包括 modern-screenshot）
 * 在 zoom 下都会按缩放后尺寸渲染，导致截图分辨率被压缩、ECharts canvas 错位。
 *
 * 修复：
 *   1. 截图前临时移除 mobile-scaled class
 *   2. 主动调用所有 echarts 实例 resize() 在 1:1 尺寸下重绘
 *   3. 等待重排 + canvas 重绘完成
 *   4. 截图完成后恢复 mobile-scaled + echarts 尺寸
 */
export async function withZoomReset<T>(fn: () => Promise<T>): Promise<T> {
  if (!isMobileClient()) return fn();

  const body = document.body;
  const hadMobileScaled = body.classList.contains('mobile-scaled');

  // 先记录滚动位置，后续恢复
  const scrollEl = document.documentElement;
  const scrollTop = scrollEl.scrollTop;
  const scrollLeft = scrollEl.scrollLeft;

  if (hadMobileScaled) {
    body.classList.remove('mobile-scaled');
  }

  // 触发 echarts / antd 等依赖 resize 的组件重排
  window.dispatchEvent(new Event('resize'));

  // 主动 resize 所有 echarts 实例
  // echarts 全局 API：echarts.getInstanceByDom(dom) 拿到该 DOM 上的实例
  try {
    const echarts = await import('echarts');
    const chartContainers = document.querySelectorAll('[_echarts_instance_]');
    chartContainers.forEach((dom) => {
      const inst = (echarts as any).getInstanceByDom(dom);
      if (inst) {
        inst.resize();
      }
    });
  } catch (e) {
    // echarts 动态 import 失败时降级到纯 resize 事件
    console.warn('[withZoomReset] echarts resize failed', e);
  }

  // 等待浏览器重排 + echarts canvas 重绘
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    return await fn();
  } finally {
    if (hadMobileScaled) {
      body.classList.add('mobile-scaled');
    }
    window.dispatchEvent(new Event('resize'));
    // 恢复 echarts 尺寸
    try {
      const echarts = await import('echarts');
      const chartContainers = document.querySelectorAll('[_echarts_instance_]');
      chartContainers.forEach((dom) => {
        const inst = (echarts as any).getInstanceByDom(dom);
        if (inst) {
          inst.resize();
        }
      });
    } catch { /* ignore */ }
    scrollEl.scrollTop = scrollTop;
    scrollEl.scrollLeft = scrollLeft;
  }
}

/**
 * 截图封装：基于 modern-screenshot 替代 html2canvas
 *
 * @param element  目标 DOM 节点
 * @param options  scale=缩放倍率；backgroundColor=背景色（null=透明）
 * @returns        HTMLCanvasElement
 */
export async function captureElement(
  element: HTMLElement,
  options: { scale?: number; backgroundColor?: string | null } = {}
): Promise<HTMLCanvasElement> {
  const { scale = 2, backgroundColor = '#ffffff' } = options;
  return withZoomReset(() =>
    domToCanvas(element, {
      scale,
      backgroundColor: backgroundColor ?? undefined,
    })
  );
}

interface SaveOptions {
  /** 文件名（含扩展名），如 `周报.png` */
  filename: string;
  /** dataURL 或 base64 字符串；dataURL 会自动剥离前缀 */
  data: string;
}

/**
 * 保存 dataURL/base64 到文件
 *
 * @returns 实际保存路径（移动端）或空字符串（Web 端走浏览器下载）
 */
export async function saveBlobFile({ filename, data }: SaveOptions): Promise<string> {
  // 剥离 dataURL 前缀，仅保留 base64 部分
  const base64 = data.includes(',') ? data.split(',')[1] || '' : data;
  if (!base64) {
    throw new Error('数据为空，无法保存');
  }

  // 文件名安全化：Capacitor Filesystem 对中文/特殊符号兼容性较差，统一转 ASCII
  // 保留扩展名，主体用时间戳 + 原文件名 hash
  const ext = (filename.toLowerCase().match(/\.(png|pdf|jpg|jpeg|webp)$/) || ['', 'png'])[1];
  const safeName = `report_${Date.now()}.${ext}`;

  if (isMobileClient()) {
    // 写入 Documents 目录（应用沙盒内，文件管理器可见）
    const result = await Filesystem.writeFile({
      path: safeName,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    // 移动端不弹 message（调用方负责），仅返回路径
    return result.uri;
  }

  // Web/Desktop：浏览器 <a download>
  const mimeType = ext === 'pdf' ? 'application/pdf' : 'image/png';
  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return '';
}

/**
 * 构造移动端保存成功的提示文案
 */
export function buildMobileSaveMessage(originalFilename: string, savedUri: string): string {
  return `${originalFilename} 已保存到 Documents 目录（${savedUri}），可用系统文件管理器查看`;
}
