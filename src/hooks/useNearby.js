import { useState, useCallback, useRef } from 'react';
import { KMB, MTR_API } from '../constants/transport.js';
import { LRT_API } from '../constants/lrt.js';
import { haverDist } from '../utils/geo.js';
import { fetchKMBFare } from '../utils/fare.js';
import _idb from '../utils/idb.js';

// gh-pages 每日自動爬取的靜態站點資料庫
const STOPS_URL = 'https://wongchiyuen.github.io/commute/data/stops.json';
const STOPS_TTL = 7 * 24 * 60 * 60 * 1000;

// ✅ 城巴 API 直接定義於此，確保用 v2 且不受 transport.js 影響
const CTB_API = 'https://rt.data.gov.hk/v2/transport/citybus';

// ── Route usage ───────────────────────────────────────────
const USAGE_TTL = 30 * 24 * 60 * 60 * 1000;
export async function incrementRouteUsage(route, companyType) {
  try {
    const entry = await _idb.get('route_usage');
    const usage = entry?.data || {};
    const rk = `${route}_${companyType || 'kmb'}`;
    usage[rk] = (usage[rk] || 0) + 1;
    _idb.set('route_usage', usage, USAGE_TTL);
  } catch {}
}
export async function getRouteUsage() {
  try { const e = await _idb.get('route_usage'); return e?.data || {}; } catch { return {}; }
}

// ── 全港站點快取 ──────────────────────────────────────────
let _stopsCache = null;
let _stopsLoading = false;
let _stopsCallbacks = [];

export async function ensureStops() {
  if (_stopsCache?.length) return _stopsCache;
  try {
    const cached = await _idb.fresh('all_stops_v1');
    if (cached?.length) { _stopsCache = cached; return cached; }
  } catch {}
  if (_stopsLoading) return new Promise(r => _stopsCallbacks.push(r));
  _stopsLoading = true;
  try {
    const res = await fetch(STOPS_URL, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _stopsCache = data.stops || [];
    if (_stopsCache.length) _idb.set('all_stops_v1', _stopsCache, STOPS_TTL);
    console.log('[stops] fetched:', _stopsCache.length,
      '| CTB:', _stopsCache.filter(s => s.co === 'ctb').length);
  } catch (e) {
    console.warn('[stops] failed:', e.message);
    _stopsCache = null;
  } finally {
    _stopsLoading = false;
    _stopsCallbacks.splice(0).forEach(cb => cb(_stopsCache || []));
  }
  return _stopsCache || [];
}

export function clearStopsCache() {
  _stopsCache = null; _stopsLoading = false;
  _stopsCallbacks.splice(0);
  _idb.del('all_stops_v1');
  _idb.del('all_routes_v1');
}

export async function fetchAllKMBStops() {
  const stops = await ensureStops();
  return stops.filter(s => s.co === 'kmb').map(s => ({
    stop: s.id, name_tc: s.n, lat: String(s.lat), long: String(s.lng),
  }));
}

// ── KMB + LWB ETA ─────────────────────────────────────────
async function fetchKMBLWBEtas(nearby, now) {
  const stops = nearby.filter(s => s.co === 'kmb' || s.co === 'lwb').slice(0, 20);
  if (!stops.length) return new Map();
  const results = await Promise.all(
    stops.map(s =>
      fetch(`${KMB}/stop-eta/${s.id}`).then(r => r.json()).catch(() => ({ data: [] }))
    )
  );
  const routeMap = new Map();
  // LWB debug: 收集所有唯一 e.co 值
  const coValues = new Set();
  results.forEach((res, i) => {
    const stop = stops[i];
    (res.data || []).forEach(e => {
      if (e.co) coValues.add(e.co);
      if (!e.eta) return;
      const ts = new Date(e.eta).getTime();
      if (ts < now - 30000) return;
      const co = (e.co || 'KMB').toUpperCase() === 'LWB' ? 'lwb' : 'kmb';
      const key = `${e.route}_${e.dir}_${co}`;
      if (!routeMap.has(key)) {
        const co = e.co === 'LWB' ? 'lwb' : 'kmb';
              routeMap.set(key, {
                route: e.route, dest: e.dest_tc || '', stopName: stop.name_tc,
                stopId: stop.stop, dist: Math.round(stop.dist),
                serviceType: e.service_type || '1', dir: e.dir,
                companyType: co, etasWithType: [{ ts, type: co }], fare: null,
              });
      } else {
        const ex = routeMap.get(key);
        if (ex.etasWithType.length < 3 && !ex.etasWithType.find(x => x.ts === ts))
          ex.etasWithType.push({ ts, type: co });
      }
    });
  });
  const lwbRoutes = [...routeMap.values()].filter(r => r.companyType === 'lwb').map(r => r.route);
  console.log('[KMB/LWB] e.co values seen:', [...coValues]);
  console.log('[KMB/LWB] LWB routes found:', lwbRoutes);
  return routeMap;
}

// ── CTB ETA ───────────────────────────────────────────────
// ✅ 主頁永遠抓取城巴，不受 transportSettings 限制
// ✅ v2 API 不支援 /all，改為用 stops.json 裡的 routes 欄位逐條路線查詢
async function fetchCTBEtas(nearby, now) {
  const stops = nearby.filter(s => s.co === 'ctb').slice(0, 20);
  console.log('[CTB] nearby ctb stops:', stops.length,
    stops.slice(0, 3).map(s => `${s.n}(${Math.round(s.dist)}m) routes:${(s.routes||[]).length}`));
  if (!stops.length) return [];

  // 建立 stop+route 查詢任務（每個站點逐條路線查詢）
  const tasks = [];
  stops.forEach(stop => {
    const routeList = stop.routes || [];
    if (!routeList.length) {
      // 舊版 stops.json 無 routes 欄位時的降級方案
      console.warn('[CTB] stop has no routes field:', stop.id, '— 請重新執行爬蟲');
    }
    routeList.forEach(route => tasks.push({ stop, route }));
  });

  if (!tasks.length) {
    console.warn('[CTB] no tasks — stops.json 可能未含 routes 欄位，請重新執行爬蟲更新 stops.json');
    return [];
  }

  const results = [];
  const routeMap = new Map();
  let fetchOk = 0, fetchFail = 0, etaCount = 0;

  await Promise.all(tasks.map(async ({ stop, route }) => {
    try {
      const url = `${CTB_API}/eta/CTB/${stop.id}/${route}`;
      const d = await fetch(url, { signal: AbortSignal.timeout(8000) }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      fetchOk++;
      (d.data || []).forEach(e => {
        if (!e.eta) return;
        const ts = new Date(e.eta).getTime();
        if (ts < now - 30000) return;
        etaCount++;
        const key = `${e.route}_${e.dir || 'O'}_${stop.id}`;
        if (!routeMap.has(key)) {
          routeMap.set(key, {
            route: e.route, dest: e.dest_tc || '',
            stopName: stop.n, stopId: stop.id,
            stopLat: stop.lat, stopLng: stop.lng,
            dist: Math.round(stop.dist), dir: e.dir || 'O',
            etasWithType: [{ ts, type: 'ctb' }],
          });
        } else {
          const ex = routeMap.get(key);
          if (ex.etasWithType.length < 3 && !ex.etasWithType.find(x => x.ts === ts))
            ex.etasWithType.push({ ts, type: 'ctb' });
        }
      });
    } catch (e) {
      fetchFail++;
      console.warn('[CTB eta]', stop.id, route, e.message);
    }
  }));

  routeMap.forEach(r => results.push(r));
  console.log(`[CTB] done: ok=${fetchOk} fail=${fetchFail} etas=${etaCount} routes=${results.length}`);
  return results;
}

// ── MTR ETA ───────────────────────────────────────────────
async function fetchMTREtas(nearby) {
  const stops = nearby.filter(s => s.co === 'mtr').slice(0, 3);
  if (!stops.length) return [];
  const results = [];
  for (const stop of stops) {
    for (const line of (stop.lines || []).slice(0, 2)) {
      try {
        const d = await fetch(`${MTR_API}?line=${line}&sta=${stop.id}`).then(r => r.json());
        if (d.status !== 0) continue;
        const dirs = d.data?.[`${line}-${stop.id}`];
        if (!dirs) continue;
        ['UP', 'DOWN'].forEach(dir => {
          const etas = (dirs[dir] || []).slice(0, 3)
            .map(t => new Date(t.time).getTime())
            .filter(ts => ts > Date.now() - 30000);
          if (etas.length) results.push({
            route: line, dest: dir === 'UP' ? '往上行' : '往下行',
            stopName: stop.n, stopId: stop.id,
            stopLat: stop.lat, stopLng: stop.lng,
            dist: Math.round(stop.dist),
            dir: dir === 'UP' ? 'O' : 'I',
            serviceType: '1', companyType: 'mtr',
            etasWithType: etas.map(ts => ({ ts, type: 'mtr' })), fare: null,
          });
        });
      } catch {}
    }
  }
  return results;
}

// ── LRT ETA ───────────────────────────────────────────────
async function fetchLRTEtas(nearby) {
  const stops = nearby.filter(s => s.co === 'lrt').slice(0, 4);
  if (!stops.length) return [];
  const results = [];
  await Promise.all(stops.map(async stop => {
    try {
      const d = await fetch(`${LRT_API}?station_id=${stop.id}`).then(r => r.json());
      if (d.status !== '1') return;
      (d.platform_list || []).forEach(plat => {
        (plat.route_list || []).slice(0, 2).forEach(route => {
          const mins = parseInt(route.time_en);
          if (isNaN(mins)) return;
          results.push({
            route: route.route_no, dest: route.dest_ch || '',
            stopName: stop.n, stopId: stop.id,
            stopLat: stop.lat, stopLng: stop.lng,
            dist: Math.round(stop.dist), dir: 'O',
            serviceType: '1', companyType: 'lrt',
            etasWithType: [{ ts: Date.now() + mins * 60000, type: 'lrt' }], fare: null,
          });
        });
      });
    } catch {}
  }));
  return results;
}

// ── NLB ETA ───────────────────────────────────────────────
const NLB_API = 'https://rt.data.gov.hk/v2/transport/nlb';

async function fetchNLBEtas(nearby, now) {
  const stops = nearby.filter(s => s.co === 'nlb').slice(0, 15);
  if (!stops.length) return [];
  const results = [];
  const seen = new Map(); // key → row

  await Promise.all(stops.map(async stop => {
    const routeList = stop.routes || [];
    await Promise.all(routeList.map(async ({ routeId, routeNo }) => {
      try {
        const url = `${NLB_API}/stop.php?action=estimatedArrivals&routeId=${routeId}&stopId=${stop.id}&serviceType=1`;
        const d = await fetch(url, { signal: AbortSignal.timeout(8000) }).then(r => r.json());
        (d.estimatedArrivals || []).forEach(e => {
          if (!e.estimatedArrivalTime) return;
          const ts = new Date(e.estimatedArrivalTime.replace(' ', 'T') + '+08:00').getTime();
          if (ts < now - 30000) return;
          const key = `${routeNo}_${stop.id}`;
          if (!seen.has(key)) {
            seen.set(key, {
              route: routeNo, dest: '',
              stopName: stop.n, stopId: stop.id,
              stopLat: stop.lat, stopLng: stop.lng,
              dist: Math.round(stop.dist), dir: 'O',
              serviceType: '1', companyType: 'nlb',
              etasWithType: [{ ts, type: 'nlb' }], fare: null,
            });
          } else {
            const ex = seen.get(key);
            if (ex.etasWithType.length < 3 && !ex.etasWithType.find(x => x.ts === ts))
              ex.etasWithType.push({ ts, type: 'nlb' });
          }
        });
      } catch {}
    }));
  }));

  seen.forEach(r => results.push(r));
  return results;
}

// ── 聯營路線名單 ──────────────────────────────────────────
const JOINT_ROUTES = new Set([
  '101','101P','101R','101X','102','102P','102R','103','104',
  '106','106A','106P','107','107P','109','110','111','111P','112','113',
  '115','115P','116','117','118','118P','118R',
  '170','171','171A','171P','182','182X',
  '302','302A','307','307A','307P',
  '601','601P','606','606A','606X','619','619P','619X','621','641',
  '671','671X','678','680','680B','680P','680X','681','681P','690','690P','690S','694',
  '904','905','905A','905P','907C','907D','914','914P','914X',
  '948','948A','948B','948E','948P','948X',
  '980','980A','980X','981','981P','982','982X','985','985A','985B',
  'N116','N118','N121','N122','N170','N171','N182','N307',
  'N619','N680','N691','R8','S1','X1','SP10','SP12',
]);

function isJointRoute(route) {
  return JOINT_ROUTES.has(route);
}

// ── 合併、排序、車費 ──────────────────────────────────────
async function buildFinalRows(kmbMap, ctbRows, mtrRows, lrtRows, nlbRows = []) {
  const routeMap = new Map(kmbMap);

  ctbRows.forEach(r => {
    const isJoint = isJointRoute(r.route);
    const matchKey =
      routeMap.has(`${r.route}_O_kmb`) ? `${r.route}_O_kmb` :
      routeMap.has(`${r.route}_I_kmb`) ? `${r.route}_I_kmb` :
      routeMap.has(`${r.route}_O_lwb`) ? `${r.route}_O_lwb` :
      routeMap.has(`${r.route}_I_lwb`) ? `${r.route}_I_lwb` : null;

    if (matchKey) {
      const ex = routeMap.get(matchKey);
      ex.companyType = 'joint';
      r.etasWithType.forEach(e => {
        if (ex.etasWithType.length < 5 && !ex.etasWithType.find(x => x.ts === e.ts))
          ex.etasWithType.push(e);
      });
      ex.etasWithType.sort((a, b) => a.ts - b.ts);
    } else {
      const k = `${r.route}_${r.dir}_ctb`;
      if (!routeMap.has(k)) {
        routeMap.set(k, { ...r, serviceType: '1', companyType: isJoint ? 'joint' : 'ctb', fare: null });
      }
    }
  });

  routeMap.forEach((v) => {
    if ((v.companyType === 'kmb' || v.companyType === 'lwb') && isJointRoute(v.route)) {
      v.companyType = 'joint';
    }
  });

  mtrRows.forEach((r, i) => routeMap.set(`MTR_${r.route}_${r.dest}_${i}`, r));
  lrtRows.forEach((r, i) => routeMap.set(`LRT_${r.route}_${r.stopId}_${i}`, r));
  nlbRows.forEach((r, i) => routeMap.set(`NLB_${r.route}_${r.stopId}_${i}`, r));

  let allRows = [...routeMap.values()].filter(r => r.etasWithType?.length > 0);
  const pairIndex = new Map();
  allRows.forEach((r, idx) => {
    if (!['kmb', 'lwb', 'ctb', 'joint'].includes(r.companyType)) return;
    const groupKey = `${r.route}_${r.companyType}`;
    if (!pairIndex.has(groupKey)) pairIndex.set(groupKey, { O: null, I: null });
    const d = r.dir === 'I' ? 'I' : 'O';
    const firstTs = r.etasWithType?.[0]?.ts || null;
    const rec = pairIndex.get(groupKey);
    if (!rec[d] || (firstTs && firstTs < rec[d].ts)) rec[d] = { ts: firstTs, idx };
  });
  pairIndex.forEach((rec) => {
    if (!rec.O || !rec.I) return;
    const oRow = allRows[rec.O.idx];
    const iRow = allRows[rec.I.idx];
    oRow.dirPair = { O: rec.O.ts, I: rec.I.ts };
    iRow.dirPair = { O: rec.O.ts, I: rec.I.ts };
  });
  const usage = await getRouteUsage();
  const now = Date.now();
  allRows.sort((a, b) => {
    const aMin = Math.round((a.etasWithType[0].ts - now) / 60000);
    const bMin = Math.round((b.etasWithType[0].ts - now) / 60000);
    if (aMin <= 3 && bMin > 3) return -1;
    if (bMin <= 3 && aMin > 3) return 1;
    const aU = usage[`${a.route}_${a.companyType}`] || 0;
    const bU = usage[`${b.route}_${b.companyType}`] || 0;
    if (aU !== bU) return bU - aU;
    return a.etasWithType[0].ts - b.etasWithType[0].ts;
  });

  const renderRows = allRows.slice(0, 25);
  const fareRows = renderRows.filter(r => r.companyType === 'kmb' || r.companyType === 'lwb' || r.companyType === 'joint');
  await Promise.race([
    Promise.all(fareRows.map(r =>
      fetchKMBFare(r.route, r.dir, r.serviceType).then(f => { r.fare = f; }).catch(() => {})
    )),
    new Promise(res => setTimeout(res, 4000)),
  ]);
  return renderRows;
}

// ── Main hook ─────────────────────────────────────────────
export function useNearby(transportSettings) {
  const [status, setStatus] = useState('idle');
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const loadId = useRef(0);

  const load = useCallback(async (lat, lng, dist) => {
    const myId = ++loadId.current;
    setStatus('loading');
    try {
      const allStops = await ensureStops();
      if (!allStops.length) throw new Error('站點資料未就緒，請到設定清除緩存後重試');

      const now = Date.now();
      const nearby = allStops
        .map(s => ({ ...s, dist: haverDist(lat, lng, s.lat, s.lng) }))
        .filter(s => s.dist <= dist && s.dist > 0 && !isNaN(s.dist))
        .sort((a, b) => a.dist - b.dist);

      console.log('[nearby] total nearby:', nearby.length,
        '| kmb:', nearby.filter(s=>s.co==='kmb').length,
        '| ctb:', nearby.filter(s=>s.co==='ctb').length,
        '| dist:', dist);

      if (!nearby.length) {
        if (myId !== loadId.current) return;
        setRows([]); setStatus('ready'); return;
      }

      // Phase 1: KMB + LWB（快速顯示）
      const kmbMap = await fetchKMBLWBEtas(nearby, now);
      const phase1 = await buildFinalRows(new Map(kmbMap), [], [], []);
      if (myId !== loadId.current) return;
      setRows(phase1);
      setStatus('ready');

      // Phase 2: CTB + NLB 永遠抓取；MTR/LRT 按設定
      const [ctbRows, nlbRows, mtrRows, lrtRows] = await Promise.all([
        fetchCTBEtas(nearby, now),
        fetchNLBEtas(nearby, now),
        (transportSettings?.mtr === true) ? fetchMTREtas(nearby) : Promise.resolve([]),
        (transportSettings?.lrt === true) ? fetchLRTEtas(nearby) : Promise.resolve([]),
      ]);
      if (myId !== loadId.current) return;
      if (ctbRows.length || nlbRows.length || mtrRows.length || lrtRows.length) {
        const final = await buildFinalRows(kmbMap, ctbRows, mtrRows, lrtRows, nlbRows);
        if (myId !== loadId.current) return;
        setRows(final);
      } else {
        console.log('[nearby] Phase 2 empty: ctb=0 nlb=0 mtr=0 lrt=0');
      }
    } catch (e) {
      console.warn('[nearby]', e);
      if (myId !== loadId.current) return;
      setStatus('error');
      setErrorMsg(e.message || '載入失敗，請重試');
    }
  }, [transportSettings]);

  return { status, rows, errorMsg, setStatus, load };
}
