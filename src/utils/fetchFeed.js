function parseXML(text) {
  if (!text || text.length < 80) return null;
  try {
    const clean = text
      .replace(/^\uFEFF/, '')
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/encoding="[^"]*"/gi, 'encoding="UTF-8"')
      .trim();
    const xml = new DOMParser().parseFromString(clean, 'text/xml');
    if (xml.querySelector('parseerror')) return null;
    const items = [...xml.querySelectorAll('item,entry')];
    if (!items.length) return null;
    return items.slice(0, 80).map(item => {
      const gs = t => {
        const el = item.querySelector(t);
        if (!el) return '';
        return (el.textContent || el.innerHTML || '')
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };
      const linkEl = item.querySelector('link');
      const link = linkEl?.textContent?.trim() || linkEl?.getAttribute('href') ||
        item.querySelector('guid')?.textContent?.trim() || '';
      return {
        title: gs('title'),
        link,
        description: (gs('description') || gs('summary') || gs('content')).slice(0, 280),
        pubDate: gs('pubDate') || gs('published') || gs('updated') || gs('dc\\:date'),
      };
    }).filter(i => i.title && i.title.length > 1);
  } catch { return null; }
}

async function _tryProxy(label, fetchPromise, isJson) {
  const res = await fetchPromise;
  if (isJson) {
    const j = await res.json();
    if (j?.status?.http_code === 200 && j.contents?.length > 100) {
      const items = parseXML(j.contents);
      if (items?.length) return items;
    }
    if (j.status === 'ok' && j.items?.length > 0) {
      return j.items.map(i => ({
        title: (i.title || '').replace(/<[^>]+>/g, '').trim(),
        link: i.link || i.guid || '',
        pubDate: i.pubDate || '',
        description: (i.description || i.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 240),
      })).filter(i => i.title);
    }
    throw new Error('json-empty');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const items = parseXML(text);
  if (!items?.length) throw new Error('no-items');
  return items;
}

export async function fetchFeed(url) {
  const enc = encodeURIComponent(url);
  const SIG = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  const opt = SIG ? { signal: SIG } : {};

  const attempts = [
    _tryProxy('cf-proxy',  fetch(`/proxy?url=${enc}`, opt), false),
    _tryProxy('rss2json',  fetch(`https://api.rss2json.com/v1/api.json?rss_url=${enc}&count=60`, opt), true),
    _tryProxy('ao-get',    fetch(`https://api.allorigins.win/get?url=${enc}`, opt), true),
    _tryProxy('corsproxy', fetch(`https://corsproxy.io/?url=${enc}`, opt), false),
    _tryProxy('ao-raw',    fetch(`https://api.allorigins.win/raw?url=${enc}`, opt), false),
    _tryProxy('codetabs',  fetch(`https://api.codetabs.com/v1/proxy?quest=${url}`, opt), false),
    _tryProxy('direct',    fetch(url, { ...opt, mode: 'cors' }), false),
  ];

  return new Promise(resolve => {
    let done = false, remaining = attempts.length;
    attempts.forEach(p => p.then(items => {
      if (!done && items?.length) { done = true; resolve(items); }
    }).catch(() => {}).finally(() => {
      remaining--;
      if (remaining === 0 && !done) resolve(null);
    }));
    setTimeout(() => { if (!done) { done = true; resolve(null); } }, 18000);
  });
}
