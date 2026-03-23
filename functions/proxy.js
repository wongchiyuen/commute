// 生活日常 · Cloudflare Pages Function · CORS Proxy
// 路徑：/proxy?url=<encoded-url>
// 用途：繞過瀏覽器 CORS 限制，抓取 RSS / XML 新聞來源
// 安全：只允許白名單內的域名

const ALLOWED = [
  'rthk.hk',
  'programme.rthk.hk',
  'news.rthk.hk',
  'hket.com',
  'www.hket.com',
  'td.gov.hk',
  'www.td.gov.hk',
  'resource.data.one.gov.hk',
  'data.one.gov.hk',
  'data.gov.hk',
  'www.info.gov.hk',
];

export async function onRequest({ request }) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url');

  if (!target) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // 驗證目標 URL（支援雙重 encode）
  let targetUrl;
  try {
    targetUrl = new URL(decodeURIComponent(target));
  } catch {
    try { targetUrl = new URL(target); }
    catch { return new Response('Invalid url', { status: 400 }); }
  }

  // 只允許 http/https
  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return new Response('Only http/https allowed', { status: 400 });
  }

  // 白名單檢查
  const hostname = targetUrl.hostname.replace(/^www\./, '');
  const allowed = ALLOWED.some(h => {
    const hn = h.replace(/^www\./, '');
    return hostname === hn || hostname.endsWith('.' + hn);
  });

  if (!allowed) {
    return new Response(`Domain not allowed: ${targetUrl.hostname}`, { status: 403 });
  }

  // 抓取目標（Pages Functions 不支援 cf 屬性，移除）
  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SWD/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'zh-HK, zh, en',
      },
    });

    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=120',
        'X-Proxy-By': 'swd-cf-pages',
      },
    });
  } catch (e) {
    return new Response(`Fetch failed: ${e.message}`, { status: 502 });
  }
}
