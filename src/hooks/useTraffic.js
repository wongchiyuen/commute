import { useState, useCallback, useRef } from 'react';
import { TRAFFIC_RTHK_URL, TRAFFIC_AUTO_INTERVAL_SEC } from '../constants/news.js';
import { fetchFeed } from '../utils/fetchFeed.js';
import { fmtTrafficTime } from '../utils/format.js';

// ── TD XML parser (dual-schema) ───────────────────────────
function parseTDXML(xmlText) {
  if (!xmlText || xmlText.length < 100) return null;
  try {
    const clean = xmlText.replace(/^\uFEFF/, '').trim();
    const xml = new DOMParser().parseFromString(clean, 'text/xml');
    if (xml.querySelector('parseerror') || xml.querySelector('parsererror')) return null;
    const messages = [
      ...xml.getElementsByTagName('message'),
      ...xml.getElementsByTagName('Message'),
    ].filter((_, i, arr) => arr.indexOf(_) === i);
    if (!messages.length) return null;

    const gText = (el, ...tags) => {
      for (const tag of tags) {
        const found = el.getElementsByTagName(tag)[0];
        if (found) return (found.textContent || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      }
      return '';
    };

    return messages.map(m => {
      const msgId    = gText(m, 'msgID', 'MSGID');
      const chinText = gText(m, 'ChinText', 'CHINTEXT');
      const chinShort= gText(m, 'ChinShort', 'CHINSHORT');
      const refDate  = gText(m, 'ReferenceDate', 'REFERENCEDATE');
      const statusNum= parseInt(gText(m, 'CurrentStatus', 'CURRENTSTATUS') || '0');
      const districts= [...m.getElementsByTagName('District')].map(d => d.textContent.trim()).filter(Boolean);
      const incNo    = gText(m, 'INCIDENT_NUMBER', 'ID');
      const headCN   = gText(m, 'INCIDENT_HEADING_CN');
      const detailCN = gText(m, 'INCIDENT_DETAIL_CN');
      const locCN    = gText(m, 'LOCATION_CN');
      const dirCN    = gText(m, 'DIRECTION_CN');
      const distCN   = gText(m, 'DISTRICT_CN');
      const statusCN = gText(m, 'INCIDENT_STATUS_CN');
      const contentCN= gText(m, 'CONTENT_CN');
      const annDate  = gText(m, 'ANNOUNCEMENT_DATE');
      const nearLM   = gText(m, 'NEAR_LANDMARK_CN');
      const isSchemaA = !!chinText || !!msgId;

      if (isSchemaA) {
        const isResolved = /現已解封|現已重開|現已開放|已恢復正常|已解除|已撤銷/u.test(chinText);
        let derivedStatus;
        if (statusNum === 1) derivedStatus = '最新情況';
        else if (statusNum === 2) derivedStatus = isResolved ? '完結' : '更新情況';
        else derivedStatus = isResolved ? '完結' : '更新情況';
        return {
          _src: 'td_v2', id: msgId || String(Math.random()),
          headingCN: chinShort || chinText.split('\n')[0].slice(0, 60),
          detailCN: chinText, contentCN: chinText,
          locationCN: '', directionCN: '', districtCN: districts.join('、'),
          statusCN: derivedStatus, nearLandmarkCN: '', announcementDate: refDate,
          lat: null, lng: null,
        };
      } else {
        return {
          _src: 'td_v2', id: incNo || gText(m, 'ID'),
          headingCN: headCN, detailCN: detailCN, contentCN: contentCN,
          locationCN: locCN, directionCN: dirCN, districtCN: distCN,
          statusCN: statusCN, nearLandmarkCN: nearLM, announcementDate: annDate,
          lat: parseFloat(gText(m, 'LATITUDE')) || null,
          lng: parseFloat(gText(m, 'LONGITUDE')) || null,
        };
      }
    }).filter(i => i.headingCN || i.contentCN);
  } catch (e) { console.warn('[td-xml]', e); return null; }
}

// ── Category classifier ───────────────────────────────────
export function getTrafficCat(item) {
  if (item._src !== 'td_v2') return 'rthk';
  const text = [item.detailCN, item.headingCN, item.contentCN, item.locationCN].join(' ');
  if (/交通意外|車禍|碰撞|車輛相撞/.test(text)) return 'accident';
  if (/車輛故障|道路工程|道路維修|緊急維修|水管|管道|工程|挖掘|高空墮物|封路|管制/.test(text)) return 'works';
  if (/巴士|小巴|公共交通|鐵路|港鐵|輕鐵|電車|渡輪|高速鐵路|運輸|服務|班次|列車/.test(text)) return 'transit';
  return 'other';
}

// ── TD XML fetcher ────────────────────────────────────────
async function fetchTDXML() {
  const urls = [
    'https://resource.data.one.gov.hk/td/tc/specialtrafficnews.xml',
    'https://resource.data.one.gov.hk/td/en/specialtrafficnews.xml',
  ];
  const proxyFns = [
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${u}`,
  ];
  for (const url of urls) {
    try {
      const r = await Promise.race([
        fetch(url, { mode: 'cors' }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
      ]);
      if (r.ok) {
        const text = await r.text();
        const items = parseTDXML(text);
        if (items?.length) return items;
      }
    } catch {}
  }
  const tdUrl = 'https://www.td.gov.hk/tc/special_news/trafficnews.xml';
  for (const mk of proxyFns) {
    try {
      const r = await Promise.race([
        fetch(mk(tdUrl)),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      if (!r.ok) continue;
      let text = await r.text();
      if (text.startsWith('{')) { try { const j = JSON.parse(text); text = j.contents || j.body || text; } catch {} }
      const items = parseTDXML(text);
      if (items?.length) return items;
    } catch {}
  }
  return null;
}

// ── Main hook ─────────────────────────────────────────────
export function useTraffic() {
  const [v2Data, setV2Data] = useState([]);
  const [rthkData, setRthkData] = useState([]);
  const [srcLabel, setSrcLabel] = useState('');
  const [currentCat, setCurrentCat] = useState('all');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(TRAFFIC_AUTO_INTERVAL_SEC);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSrcLabel('載入中…');
    const [v2Items, rthkItems] = await Promise.all([
      fetchTDXML(),
      fetchFeed(TRAFFIC_RTHK_URL).catch(() => null),
    ]);
    const v2 = v2Items || [];
    const rthk = (rthkItems || []).map(i => ({ ...i, _src: 'rthk' }));
    setV2Data(v2);
    setRthkData(rthk);
    const parts = [];
    if (v2.length) parts.push(`運輸署(${v2.length})`);
    if (rthk.length) parts.push(`RTHK(${rthk.length})`);
    setSrcLabel(parts.join(' · ') || '無資料');
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    setV2Data([]); setRthkData([]); setSrcLabel('');
    await load();
  }, [load]);

  const hardReload = useCallback(async () => {
    setV2Data([]); setRthkData([]); setSrcLabel('');
    await load();
  }, [load]);

  const startAutoRefresh = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(TRAFFIC_AUTO_INTERVAL_SEC);
    let count = TRAFFIC_AUTO_INTERVAL_SEC;
    timerRef.current = setInterval(() => {
      count--;
      setCountdown(Math.max(0, count));
      if (count <= 0) {
        count = TRAFFIC_AUTO_INTERVAL_SEC;
        setCountdown(TRAFFIC_AUTO_INTERVAL_SEC);
        load();
      }
    }, 1000);
  }, [load]);

  const stopAutoRefresh = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Filtered + sorted items for current category
  const getFiltered = useCallback(() => {
    const statusOrder = s => s.includes('完結') ? 2 : s.includes('更新') ? 1 : 0;
    const timeSafe = s => { try { return new Date(s).getTime() || 0; } catch { return 0; } };
    let td = [...v2Data];
    if (currentCat === 'accident') td = td.filter(i => getTrafficCat(i) === 'accident');
    else if (currentCat === 'works') td = td.filter(i => getTrafficCat(i) === 'works');
    else if (currentCat === 'transit') td = td.filter(i => getTrafficCat(i) === 'transit');
    else if (currentCat === 'new') td = td.filter(i => !(i.statusCN || '').includes('完結'));
    else if (currentCat === 'closed') td = td.filter(i => (i.statusCN || '').includes('完結'));
    td.sort((a, b) => {
      const so = statusOrder(a.statusCN || '') - statusOrder(b.statusCN || '');
      return so !== 0 ? so : timeSafe(b.announcementDate) - timeSafe(a.announcementDate);
    });
    const rthk = (currentCat === 'all' || currentCat === 'rthk') ? rthkData : [];
    return { td, rthk };
  }, [v2Data, rthkData, currentCat]);

  return {
    v2Data, rthkData, srcLabel, loading,
    currentCat, setCurrentCat,
    countdown, load, reload, hardReload,
    startAutoRefresh, stopAutoRefresh, getFiltered,
    fmtTrafficTime,
  };
}
