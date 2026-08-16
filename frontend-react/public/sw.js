/* 省心投 BI PWA Service Worker
 *
 * 解决 GitHub Pages 部署后「旧 index.html + 已删除旧 chunk → 白屏」问题。
 *
 * 缓存策略：
 *   - 导航请求（index.html）：network-first，保证壳始终最新（关键，杜绝陈旧壳引用已删除 chunk）
 *   - 带 hash 的内容寻址资源（/assets/，内容不变则哈希不变）：cache-first（immutable）
 *   - 其他同源资源（sql-wasm.wasm / manifest / icons）：stale-while-revalidate
 *   - 跨域请求（坚果云 WebDAV 代理）：不拦截，直连，避免干扰 CORS
 *
 * 部署原子化：新 SW 激活即 skipWaiting + clients.claim，并删除所有旧缓存，
 * 用户拿到的是「全旧」或「全新」的资源集合，永不会出现壳与 chunk 混版本。
 */
const CACHE = 'shengxintou-cache-v1';

self.addEventListener('install', (event) => {
  // 不等旧页面关闭，立即激活新 SW
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只处理同源；跨域（Deno/Cloudflare 代理等）直连，避免干扰 CORS
  if (url.origin !== self.location.origin) return;

  // 1) 导航请求：network-first，失败回退缓存（离线可用）
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response('离线不可用，请联网后重试', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })()
    );
    return;
  }

  // 2) 带 hash 的内容寻址资源（/assets/）：immutable cache-first
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 3) 其他同源资源（sql-wasm.wasm / manifest / icons 等）：stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});
