/**
 * Deno Deploy：坚果云 WebDAV CORS 反向代理
 *
 * 用途：
 *   省心投 BI PWA 端（iOS Safari）需要从坚果云 WebDAV 下载 SQLite 备份，
 *   但坚果云（dav.jianguoyun.com）不支持 CORS，浏览器 fetch 会被拦截。
 *   本代理转发请求到坚果云并加 CORS 头。
 *
 * 为什么不用 Cloudflare Worker：
 *   workers.dev 域名在中国大陆被 DNS 污染（解析到 Facebook IP），
 *   导致 PWA 端无法访问。deno.dev 域名国内可达性好。
 *
 * 部署步骤（用户在 Deno Deploy 后台操作）：
 *   1. 注册 Deno Deploy：https://dash.deno.com/（用 GitHub 账号登录）
 *   2. 点击 New Project → 选择 GitHub 仓库（先 Fork 本仓库到自己账号）
 *   3. Entrypoint 选择本文件：scripts/deno-webdav-proxy.js
 *   4. Project Name 自定义（如 shengxintou-webdav），点击 Link
 *   5. 部署完成后，复制 URL（如 https://shengxintou-webdav.deno.dev）
 *   6. 在 PWA「数据同步」页面的「WebDAV 配置」中填入此 URL
 *
 * 安全说明：
 *   - 代理不存储任何凭据，Authorization 由前端通过 query string 传递
 *   - 凭据仅在本代理 ↔ 坚果云之间传输（HTTPS），不经过 Deno 日志
 *
 * 请求格式：
 *   GET https://<proxy>/?url=<encoded webdav url>&auth=<basic auth base64>
 *
 * 限制：
 *   - Deno Deploy 免费版每天 100,000 次请求，对个人 BI 工具足够
 *   - 单次响应体积上限 150MB（30-80MB 的 SQLite DB 在限内）
 *
 * v3.6.3
 */

const ALLOWED_HOSTS = [
  'dav.jianguoyun.com',
];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}

function jsonResp(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

Deno.serve(async (req) => {
  // 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // 只允许 GET（PWA 只下载，不上传）
  if (req.method !== 'GET') {
    return jsonResp(405, { error: 'Method not allowed' });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');
  const auth = url.searchParams.get('auth');

  if (!targetUrl || !auth) {
    return jsonResp(400, { error: 'Missing url or auth parameter' });
  }

  // 校验目标 URL 在白名单内（防止开放代理滥用）
  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    return jsonResp(400, { error: 'Invalid url parameter' });
  }
  if (!ALLOWED_HOSTS.includes(target.hostname)) {
    return jsonResp(403, { error: 'Target host not allowed' });
  }

  // 转发请求到坚果云
  try {
    const resp = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'ShengXinTou-PWA/1.0 (Deno Deploy proxy)',
      },
    });

    // 透传响应体（可能是文本 manifest 或二进制 .db.gz）
    const body = await resp.arrayBuffer();
    const contentType = resp.headers.get('Content-Type') || 'application/octet-stream';

    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResp(502, { error: 'Upstream fetch failed', detail: msg });
  }
});
