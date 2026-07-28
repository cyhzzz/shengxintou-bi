/**
 * Cloudflare Worker：坚果云 WebDAV CORS 反向代理
 *
 * 用途：
 *   省心投 BI PWA 端（iOS Safari）需要从坚果云 WebDAV 下载 SQLite 备份，
 *   但坚果云（dav.jianguoyun.com）不支持 CORS，浏览器 fetch 会被拦截。
 *   本 Worker 作为反向代理，转发请求到坚果云并加 CORS 头。
 *
 * 部署步骤（用户在 Cloudflare 后台操作）：
 *   1. 注册 Cloudflare 账号：https://dash.cloudflare.com/sign-up
 *   2. 进入 Workers & Pages → Create application → Create Worker
 *   3. Worker 名称随意（如 shengxintou-webdav-proxy），点击 Deploy
 *   4. 点击 "Edit code"，粘贴本文件全部内容，Save and Deploy
 *   5. 复制 Worker URL（如 https://shengxintou-webdav-proxy.<your-subdomain>.workers.dev）
 *   6. 在 PWA「数据同步」页面的「WebDAV 配置」中填入此 URL
 *
 * 安全说明：
 *   - Worker 不存储任何凭据，Authorization 由前端通过 query string 传递
 *   - 凭据仅在本 Worker ↔ 坚果云之间传输（HTTPS），不经过 Cloudflare 日志
 *   - 可选：在 Worker 配置环境变量 WEBDAV_ALLOWED_ORIGIN 限制只允许 PWA 域名访问
 *
 * 请求格式：
 *   GET https://<worker>/?url=<encoded webdav url>&auth=<basic auth base64>
 *
 * 限制：
 *   - Cloudflare Workers 免费版每天 100,000 次请求，对个人 BI 工具足够
 *   - 单次响应体积上限 100MB（30-80MB 的 SQLite DB 在限内）
 *   - 如超出，需升级 Workers Paid（$5/月）
 *
 * v3.6.2
 */

// 允许的来源（PWA 域名）。'*' 表示允许任何来源，生产建议改为 PWA 实际域名。
const ALLOWED_ORIGIN = '*';

// 坚果云 WebDAV 域名白名单（防止被滥用为开放代理）
const ALLOWED_HOSTS = [
  'dav.jianguoyun.com',
];

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // 只允许 GET（PWA 只下载，不上传）
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const auth = url.searchParams.get('auth');

    if (!targetUrl || !auth) {
      return new Response(JSON.stringify({ error: 'Missing url or auth parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // 校验目标 URL 在白名单内（防止开放代理滥用）
    let target;
    try {
      target = new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
    if (!ALLOWED_HOSTS.includes(target.hostname)) {
      return new Response(JSON.stringify({ error: 'Target host not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // 转发请求到坚果云
    try {
      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'ShengXinTou-PWA/1.0 (Cloudflare Worker proxy)',
        },
      });

      // 透传响应体（可能是文本 manifest 或二进制 .db.gz）
      const body = await resp.arrayBuffer();
      const contentType = resp.headers.get('Content-Type') || 'application/octet-stream';

      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: msg }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };
}
