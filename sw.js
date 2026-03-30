// ╔══════════════════════════════════════════════════════════╗
// ║  生活日常 · Service Worker  v1.0                         ║
// ║  快取策略：                                               ║
// ║  · App shell      → Cache First（離線可用）               ║
// ║  · KMB 路線/站點  → Stale-While-Revalidate 24hr          ║
// ║  · 天氣（即時）   → Stale-While-Revalidate 5min          ║
// ║  · 潮汐/日出      → Stale-While-Revalidate 24hr          ║
// ║  · 新聞 RSS       → Stale-While-Revalidate 10min         ║
// ║  · ETA 班次       → Network Only（必須即時）              ║
// ║  · 交通消息       → Network First（fallback cache）       ║
// ╚══════════════════════════════════════════════════════════╝

const CACHE = 'swd-v1';
const SHELL = ['/', '/index.html', '/manifest.json'];

// ── TTL（毫秒）────────────────────────────────────────────
const TTL = {
  kmb_static : 24 * 60 * 60 * 1000,   // 24 小時
  weather    :  5 * 60 * 1000,         //  5 分鐘
  tide_sun   : 24 * 60 * 60 * 1000,   // 24 小時
  news       : 10 * 60 * 1000,         // 10 分鐘
  traffic    :  2 * 60 * 1000,         //  2 分鐘
};

// ── URL 分類 ──────────────────────────────────────────────
const is = {
  shell      : u => u.origin === self.location.origin,
  eta        : u => /\/(stop-)?eta\/|getSchedule|lrt\/getSchedule/.test(u.pathname + u.search),
  kmbStatic  : u => u.hostname === 'data.etabus.gov.hk' && /\/(route|stop)\/?$/.test(u.pathname),
  weather    : u => u.hostname === 'data.weather.gov.hk' && /rhrread|flw|fnd|warnsum/.test(u.search),
  tideSun    : u => u.hostname === 'data.weather.gov.hk' && /HLT|SRS|CLMM|RYES/.test(u.search),
  news       : u => /rss2json\.com|allorigins\.win|corsproxy\.io|codetabs\.com|rthk\.hk.*rss/.test(u.href),
  traffic    : u => /td\.gov\.hk|data\.one\.gov\.hk.*td/.test(u.href),
};

// ── Install：快取 App Shell ───────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate：清理舊快取 ──────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch：路由分發 ───────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // ETA 即時資料：完全交給網絡，不攔截
  if (is.eta(url)) return;

  // /proxy CORS Proxy：永遠不快取，確保 RSS 永遠是最新的
  if (url.pathname === '/proxy') return;

  // App Shell：Cache First
  if (is.shell(url)) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // KMB 路線/站點靜態資料：SWR 24hr
  if (is.kmbStatic(url)) {
    e.respondWith(swr(e.request, TTL.kmb_static));
    return;
  }

  // 天氣即時（溫度/濕度/警告/預報）：SWR 5min
  if (is.weather(url)) {
    e.respondWith(swr(e.request, TTL.weather));
    return;
  }

  // 潮汐/日出/氣候：SWR 24hr
  if (is.tideSun(url)) {
    e.respondWith(swr(e.request, TTL.tide_sun));
    return;
  }

  // 新聞 RSS：SWR 10min
  if (is.news(url)) {
    e.respondWith(swr(e.request, TTL.news));
    return;
  }

  // 交通消息：Network First，失敗用快取
  if (is.traffic(url)) {
    e.respondWith(networkFirst(e.request, TTL.traffic));
    return;
  }

  // 其他：直接網絡，不快取
});

// ── 快取策略實作 ──────────────────────────────────────────

// Cache First：先用快取，沒有才抓網絡
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const c = await caches.open(CACHE);
      c.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Stale-While-Revalidate：即時回傳快取，背景更新
async function swr(req, ttl) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);

  // 檢查快取是否仍在 TTL 內
  if (cached) {
    const age = Date.now() - new Date(cached.headers.get('sw-cached-at') || 0).getTime();
    const fresh = age < ttl;

    // 背景更新（不管是否 fresh，過了一半 TTL 就更新）
    if (!fresh || age > ttl / 2) {
      fetch(req).then(res => {
        if (res.ok) putWithTimestamp(cache, req, res);
      }).catch(() => {});
    }

    if (fresh) return cached;
  }

  // 無快取或已過期：等待網絡
  try {
    const res = await fetch(req);
    if (res.ok) putWithTimestamp(cache, req, res.clone());
    return res;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

// Network First：先抓網絡，失敗用快取
async function networkFirst(req, ttl) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]);
    if (res.ok) putWithTimestamp(cache, req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response('Offline', { status: 503 });
  }
}

// 加入快取時附上時間戳（用於 TTL 計算）
async function putWithTimestamp(cache, req, res) {
  const headers = new Headers(res.headers);
  headers.set('sw-cached-at', new Date().toISOString());
  const body = await res.arrayBuffer();
  cache.put(req, new Response(body, { status: res.status, headers }));
}

// ── Push 通知：接收並顯示 ─────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: '生活日常', body: '有新警告' };
  try { data = e.data?.json() ?? data; } catch {}

  const opts = {
    body: data.body || '',
    icon: data.icon || '/manifest.json',
    badge: data.badge || '',
    tag: data.tag || 'swd-warn',
    renotify: true,
    requireInteraction: data.urgent || false,
    data: { url: data.url || '/' },
  };

  e.waitUntil(
    self.registration.showNotification(data.title, opts)
  );
});

// ── 點擊通知：開啟 App ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url.includes(self.location.origin));
        if (existing) return existing.focus();
        return clients.openWindow(url);
      })
  );
});
