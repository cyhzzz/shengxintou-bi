/**
 * 跨端文件保存工具
 *
 * - Web/Desktop：走浏览器 <a download> 触发下载
 * - 移动端（Capacitor Android）：Android WebView 默认拦截 <a download>，
 *   改用 @capacitor/filesystem 写入 Documents 目录，避免「提示成功但未真正保存」
 */
import { Filesystem, Directory } from '@capacitor/filesystem';
import { isMobileClient } from './isDesktop';

/**
 * html2canvas 对 CSS zoom 支持不佳（body.mobile-scaled 下 zoom:0.67 !important），
 * 导出时会因为元素尺寸与实际渲染尺寸不一致导致文字/图表重叠。
 * 由于 CSS 用了 !important，内联 style 无法覆盖，必须移除 mobile-scaled class。
 * 本函数临时移除 class 触发 echarts 等组件 resize 重绘，
 * 等待足够时间确保 canvas 重新绘制完成，再执行回调生成图片，
 * 完成后恢复原始状态。
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

  // 等待浏览器重排 + echarts resize 回调执行 + canvas 重绘
  // echarts resize 是同步的，但 setOption 后的 canvas 绘制可能需要一帧
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
    scrollEl.scrollTop = scrollTop;
    scrollEl.scrollLeft = scrollLeft;
  }
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
