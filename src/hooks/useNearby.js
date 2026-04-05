import { useState, useCallback, useRef } from 'react';
import { KMB, CTB, MTR_API } from '../constants/transport.js';
import { LRT_API } from '../constants/lrt.js';
import { haverDist } from '../utils/geo.js';
import { fetchKMBFare } from '../utils/fare.js';
import _idb from '../utils/idb.js';

// gh-pages 每日自動爬取的靜態站點資料庫
const STOPS_URL = 'https://wongchiyuen.github.io/commute/data/stops.json';
const STOPS_TTL = 7 * 24 * 60 * 60 * 1000;

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
    console.log('[stops] fetched:', _stopsCache.length);
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

// 相容舊 import（HomePage 仍有 import fetchAllKMBStops）
export async function fetchAllKMBStops() {
  const stops = await ensureStops();
  return stops.filter(s => s.co === 'kmb').map(s => ({
    stop: s.id, name_tc: s.n, lat: String(s.lat), long: String(s.lng),
  }));
}

// ── KMB + LWB ETA ─────────────────────────────────────────
// 同一 API (data.etabus.gov.hk)，e.co 欄位區分九巴/龍運
async function fetchKMBLWBEtas(nearby, now) {
  const stops = nearby.filter(s => s.co === 'kmb').slice(0, 20);
  if (!stops.length) return new Map();
  const results = await Promise.all(
    stops.map(s =>
      fetch(`${KMB}/stop-eta/${s.id}`).then(r => r.json()).catch(() => ({ data: [] }))
    )
  );
  const routeMap = new Map();
  results.forEach((res, i) => {
    const stop = stops[i];
    (res.data || []).forEach(e => {
      if (!e.eta) return;
      const ts = new Date(e.eta).getTime();
      if (ts < now - 30000) return;
      // e.co = 'KMB' 九巴 | 'LWB' 龍運
      const co = (e.co || 'KMB').toUpperCase() === 'LWB' ? 'lwb' : 'kmb';
      const key = `${e.route}_${e.dir}_${co}`;
      if (!routeMap.has(key)) {
        routeMap.set(key, {
          route: e.route, dest: e.dest_tc || '',
          stopName: stop.n, stopId: stop.id,
          stopLat: stop.lat, stopLng: stop.lng, // 供地圖標記
          dist: Math.round(stop.dist),
          serviceType: e.service_type || '1', dir: e.dir,
          companyType: co,
          etasWithType: [{ ts, type: co }], fare: null,
        });
      } else {
        const ex = routeMap.get(key);
        if (ex.etasWithType.length < 3 && !ex.etasWithType.find(x => x.ts === ts))
          ex.etasWithType.push({ ts, type: co });
      }
    });
  });
  return routeMap;
}

// ── CTB ETA ───────────────────────────────────────────────
// stops.json 已有 CTB 座標，直接取 ETA
async function fetchCTBEtas(nearby, now) {
  const stops = nearby.filter(s => s.co === 'ctb').slice(0, 8);
  if (!stops.length) return [];
  const results = [];
  await Promise.all(stops.map(async stop => {
    try {
      const sig = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
      const d = await fetch(
        `${CTB}/eta/CTB/${stop.id}/all`,
        sig ? { signal: sig } : {}
      ).then(r => r.json());
      const routeMap = new Map();
      (d.data || []).forEach(e => {
        if (!e.eta) return;
        const ts = new Date(e.eta).getTime();
        if (ts < now - 30000) return;
        const key = `${e.route}_${e.dir || 'O'}`;
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
          if (ex.etasWithType.length < 3) ex.etasWithType.push({ ts, type: 'ctb' });
        }
      });
      routeMap.forEach(r => results.push(r));
    } catch (e) { console.warn('[CTB eta]', stop.id, e.message); }
  }));
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

// ── 合併、排序、車費 ──────────────────────────────────────
async function buildFinalRows(kmbMap, ctbRows, mtrRows, lrtRows) {
  const routeMap = new Map(kmbMap);

  // CTB 合併：同路線 KMB 改為 joint
  ctbRows.forEach(r => {
    const matchKey =
      routeMap.has(`${r.route}_O_kmb`) ? `${r.route}_O_kmb` :
      routeMap.has(`${r.route}_I_kmb`) ? `${r.route}_I_kmb` :
      routeMap.has(`${r.route}_O_lwb`) ? `${r.route}_O_lwb` : null;
    if (matchKey) {
      const ex = routeMap.get(matchKey);
      ex.companyType = 'joint';
      r.etasWithType.forEach(e => {
        if (ex.etasWithType.length < 3 && !ex.etasWithType.find(x => x.ts === e.ts))
          ex.etasWithType.push(e);
      });
      ex.etasWithType.sort((a, b) => a.ts - b.ts);
    } else {
      const k = `${r.route}_CTB_${r.stopId}`;
      if (!routeMap.has(k)) routeMap.set(k, { ...r, serviceType: '1', companyType: 'ctb', fare: null });
    }
  });

  mtrRows.forEach((r, i) => routeMap.set(`MTR_${r.route}_${r.dest}_${i}`, r));
  lrtRows.forEach((r, i) => routeMap.set(`LRT_${r.route}_${r.stopId}_${i}`, r));

  let allRows = [...routeMap.values()].filter(r => r.etasWithType?.length > 0);
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
  const fareRows = renderRows.filter(r => ['kmb', 'lwb', 'joint'].includes(r.companyType));
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

      if (!nearby.length) {
        if (myId !== loadId.current) return;
        setRows([]); setStatus('ready'); return;
      }

      // Phase 1: KMB + LWB
      const kmbMap = await fetchKMBLWBEtas(nearby, now);
      const phase1 = await buildFinalRows(new Map(kmbMap), [], [], []);
      if (myId !== loadId.current) return;
      setRows(phase1);
      setStatus('ready');

      // Phase 2: CTB + MTR + LRT 並行背景更新
      const [ctbRows, mtrRows, lrtRows] = await Promise.all([
        transportSettings.ctb ? fetchCTBEtas(nearby, now) : Promise.resolve([]),
        transportSettings.mtr ? fetchMTREtas(nearby) : Promise.resolve([]),
        transportSettings.lrt ? fetchLRTEtas(nearby) : Promise.resolve([]),
      ]);
      if (myId !== loadId.current) return;
      if (ctbRows.length || mtrRows.length || lrtRows.length) {
        const final = await buildFinalRows(kmbMap, ctbRows, mtrRows, lrtRows);
        if (myId !== loadId.current) return;
        setRows(final);
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
