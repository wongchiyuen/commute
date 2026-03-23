// 生活日常 · Cloudflare Pages Function · 警告推播
// ═══════════════════════════════════════════════════════
// Cron Trigger：每 5 分鐘查 HKO warnsum API
// 有新警告 → 從 KV 取所有訂閱 → 發 Web Push
//
// 需要設定的環境變數（Cloudflare Pages Settings → Environment Variables）：
//   VAPID_PUBLIC  = BMxDlEswgdlRvYNubw60kTTf_aP_c-Qk2M82J8oB0hUEEYPFd3_J8NZFz_3_yf-RsKcwuxoh8jumnwTmfkkgv5w
//   VAPID_PRIVATE = MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQga4ydsm-6FRa0IknbAwF1QBYySq7Y7s2ZLNYLujJzuRuhRANCAATMQ5RLMIHZUb2Dbm8OtJE03_2j_3PkJNjPNifKAdIVBBGDxXd_yfDWRc_9_8n_kbCnMLsaIfI7pp8E5n5JIL-c
//   VAPID_SUBJECT = mailto:your@email.com
//
// 需要建立 KV Namespace：SWD_KV
//   用途：儲存 push subscriptions + 上次警告狀態
// ═══════════════════════════════════════════════════════

const HKO_WARN = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc';

const WARN_LABELS = {
  WTCSGNL: '熱帶氣旋警告信號',
  WRAINA:  '黃色暴雨警告',
  WRAINB:  '紅色暴雨警告',
  WRAINC:  '黑色暴雨警告',
  WFIRE:   '山火警告',
  WFROST:  '霜凍警告',
  WHOT:    '酷熱天氣警告',
  WCOLD:   '寒冷天氣警告',
  WMSGNL:  '強烈季候風信號',
  WTHUNDER:'雷暴警告',
  WL:      '山泥傾瀉警告',
};

// ── Cron handler ──────────────────────────────────────────
export async function onSchedule(event, env) {
  await checkAndNotify(env);
}

// ── HTTP handler（手動觸發測試用）────────────────────────
export async function onRequest({ request, env }) {
  if (request.method === 'POST') {
    const auth = request.headers.get('X-Admin-Key');
    if (auth !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    const result = await checkAndNotify(env);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // GET /warn：訂閱 / 取消訂閱
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (request.method === 'GET' && action === 'subscribe') {
    return handleSubscribe(request, env);
  }
  if (request.method === 'GET' && action === 'unsubscribe') {
    return handleUnsubscribe(request, env);
  }
  if (request.method === 'GET' && action === 'vapid-public') {
    return new Response(env.VAPID_PUBLIC || '', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response('OK', { status: 200 });
}

// ── 處理訂閱請求 ──────────────────────────────────────────
async function handleSubscribe(request, env) {
  const url = new URL(request.url);
  const sub = url.searchParams.get('sub');
  if (!sub || !env.SWD_KV) {
    return new Response('Missing sub or KV', { status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(sub));
    const key = `sub_${btoa(parsed.endpoint).slice(0, 40)}`;
    await env.SWD_KV.put(key, JSON.stringify(parsed), { expirationTtl: 90 * 24 * 3600 });
    return new Response('Subscribed', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}

// ── 處理取消訂閱 ──────────────────────────────────────────
async function handleUnsubscribe(request, env) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint || !env.SWD_KV) {
    return new Response('Missing endpoint or KV', { status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  const key = `sub_${btoa(endpoint).slice(0, 40)}`;
  await env.SWD_KV.delete(key);
  return new Response('Unsubscribed', {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

// ── 核心邏輯：查警告 + 發推播 ────────────────────────────
async function checkAndNotify(env) {
  if (!env.SWD_KV || !env.VAPID_PUBLIC || !env.VAPID_PRIVATE) {
    return { error: 'Missing KV or VAPID keys' };
  }

  // 抓 HKO 警告
  let warns = {};
  try {
    const res = await fetch(HKO_WARN);
    warns = await res.json();
  } catch (e) {
    return { error: 'HKO fetch failed: ' + e.message };
  }

  // 只保留「生效中」的警告
  const active = Object.entries(warns)
    .filter(([, v]) => v?.actionCode && v.actionCode !== 'CANCEL')
    .map(([k]) => k);

  // 比對上次狀態
  const lastRaw = await env.SWD_KV.get('last_warns');
  const last = lastRaw ? JSON.parse(lastRaw) : [];
  const newWarns = active.filter(k => !last.includes(k));
  const lifted  = last.filter(k => !active.includes(k));

  // 儲存新狀態
  await env.SWD_KV.put('last_warns', JSON.stringify(active));

  if (!newWarns.length && !lifted.length) {
    return { status: 'no_change', active };
  }

  // 組成通知內容
  const notifications = [];
  for (const k of newWarns) {
    notifications.push({
      title: `⚠️ ${WARN_LABELS[k] || k}`,
      body: warns[k]?.details || `${WARN_LABELS[k] || k} 現已生效`,
      tag: `warn-${k}`,
      urgent: ['WRAINC', 'WTCSGNL'].includes(k),
      url: '/?tab=home',
    });
  }
  for (const k of lifted) {
    notifications.push({
      title: `✅ ${WARN_LABELS[k] || k} 已取消`,
      body: `${WARN_LABELS[k] || k} 已解除`,
      tag: `warn-lifted-${k}`,
      urgent: false,
      url: '/?tab=home',
    });
  }

  // 取出所有訂閱
  const { keys } = await env.SWD_KV.list({ prefix: 'sub_' });
  if (!keys.length) return { status: 'no_subscribers', notifications };

  // 發送推播
  let sent = 0, failed = 0;
  for (const { name } of keys) {
    const raw = await env.SWD_KV.get(name);
    if (!raw) continue;
    let sub;
    try { sub = JSON.parse(raw); } catch { continue; }

    for (const notif of notifications) {
      try {
        await sendPush(sub, notif, env);
        sent++;
      } catch (e) {
        failed++;
        // 410 Gone = 訂閱已失效，刪除
        if (e.message?.includes('410')) await env.SWD_KV.delete(name);
      }
    }
  }

  return { status: 'sent', sent, failed, newWarns, lifted };
}

// ── Web Push 發送（手動 VAPID，無需 web-push 套件）──────────
async function sendPush(subscription, payload, env) {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!p256dh || !auth) throw new Error('Missing subscription keys');

  const payloadStr = JSON.stringify(payload);

  // 建立 VAPID JWT
  const jwt = await buildVAPIDJWT(endpoint, env.VAPID_SUBJECT || 'mailto:admin@swd.app', env.VAPID_PRIVATE);

  // 加密 payload（使用 Web Crypto API）
  const encrypted = await encryptPayload(payloadStr, p256dh, auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${env.VAPID_PUBLIC}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: encrypted,
  });

  if (!res.ok && res.status !== 201) {
    throw new Error(`Push failed: ${res.status}`);
  }
}

// ── VAPID JWT 建立 ────────────────────────────────────────
async function buildVAPIDJWT(endpoint, subject, vapidPrivateB64) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 43200;

  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64url(JSON.stringify({ aud: audience, exp, sub: subject }));
  const unsigned = `${header}.${payload}`;

  // 匯入私鑰
  const keyData = base64urlToBuffer(vapidPrivateB64);
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${bufToB64url(sig)}`;
}

// ── Payload 加密（aes128gcm）─────────────────────────────
async function encryptPayload(plaintext, p256dhB64, authB64) {
  const p256dh = base64urlToBuffer(p256dhB64);
  const authBuf = base64urlToBuffer(authB64);

  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const serverPub = await crypto.subtle.exportKey('raw', serverKeys.publicKey);

  const receiverPub = await crypto.subtle.importKey(
    'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPub }, serverKeys.privateKey, 256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const text = enc.encode(plaintext);

  // HKDF extract + expand
  const prk = await hkdfExtract(authBuf, concatBufs(sharedBits, serverPub, p256dh));
  const cek = await hkdfExpand(prk, concatBufs(enc.encode('Content-Encoding: aes128gcm\x00'), salt, serverPub), 16);
  const nonce = await hkdfExpand(prk, concatBufs(enc.encode('Content-Encoding: nonce\x00'), salt, serverPub), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const paddedText = concatBufs(text, new Uint8Array([0x02]));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedText);

  // aes128gcm content encoding header
  const header = new Uint8Array(21 + serverPub.byteLength);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = serverPub.byteLength;
  header.set(new Uint8Array(serverPub), 21);

  return concatBufs(header, ciphertext);
}

// ── Crypto helpers ────────────────────────────────────────
async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, ikm);
}
async function hkdfExpand(prk, info, len) {
  const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const t = await crypto.subtle.sign('HMAC', key, concatBufs(info, new Uint8Array([1])));
  return new Uint8Array(t).slice(0, len);
}
function concatBufs(...bufs) {
  const total = bufs.reduce((s, b) => s + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) { out.set(new Uint8Array(b), offset); offset += b.byteLength; }
  return out;
}
function b64url(str) { return btoa(unescape(encodeURIComponent(str))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function bufToB64url(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function base64urlToBuffer(b64) {
  const s = b64.replace(/-/g,'+').replace(/_/g,'/');
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}
