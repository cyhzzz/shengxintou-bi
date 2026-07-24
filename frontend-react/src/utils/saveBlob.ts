/**
 * 跨端文件保存工具
 *
 * - Web/Desktop：走浏览器 <a download> 触发下载
 * - 移动端（Capacitor Android）：Android WebView 默认拦截 <a download>，
 *   改用 @capacitor/filesystem 写入 Documents 目录，避免「提示成功但未真正保存」
 */
import { Filesystem, Directory } from '@capacitor/filesystem';
import { isMobileClient } from './isDesktop';

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
