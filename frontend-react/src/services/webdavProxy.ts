/**
 * PWA 代理请求工具（mobileSync 与 mobileTableSync 共享）
 *
 * 收拢自两份逐字重复的本地实现（架构优化⑧）：
 *   - mobileSync.ts（v3.6.2 注释版）
 *   - mobileTableSync.ts（无注释版）
 * 本模块不依赖任何其他 services，避免循环引用。
 */

/**
 * v3.6.2：规范化 Deno Deploy 代理 URL
 *
 * 用户在表单中可能填入以下几种格式：
 *   - https://xxx.deno.dev
 *   - https://xxx.deno.dev/
 *   - https://xxx.deno.dev/?
 *
 * 统一去掉末尾的 / 和 ?，再由调用方拼 ?url=...&auth=...
 * 避免拼出 `https://xxx.deno.dev?url=...`（部分代理对裸域名请求
 * 可能触发重定向到带 / 的版本，重定向后 query string 丢失，导致请求失败）。
 */
export function normalizeProxyUrl(raw: string): string {
  let u = raw.trim();
  while (u.endsWith('/') || u.endsWith('?')) {
    u = u.slice(0, -1);
  }
  return u;
}

/**
 * v3.6.2：构造 PWA 代理请求 URL
 *
 * 关键修复：
 *   1. auth（base64）必须 encodeURIComponent —— base64 可能含 +、/、= 字符，
 *      其中 + 在 URL query string 中会被解析为空格，导致坚果云收到错误的凭据 → 401
 *   2. proxyUrl 末尾斜杠规范化，避免代理重定向丢 query string
 */
export function buildProxyRequestUrl(
  proxyUrl: string,
  targetUrl: string,
  authBase64: string
): string {
  const proxy = normalizeProxyUrl(proxyUrl);
  return `${proxy}?url=${encodeURIComponent(targetUrl)}&auth=${encodeURIComponent(authBase64)}`;
}

/**
 * gzip 魔数校验（0x1f 0x8b），防个别网关对 .gz 路径返回假 200（HTML 错误页）。
 * 分表同步 v4.3.2 已有此校验，整库同步原先缺失，现统一走这里。
 */
export function hasGzipMagic(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf.slice(0, 2));
  return head[0] === 0x1f && head[1] === 0x8b;
}
