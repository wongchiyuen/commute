import { useState, useCallback, useRef } from 'react';
import { KMB, CTB, MTR_API, MTR_STNS } from '../constants/transport.js';
import { LRT_API, LRT_STNS } from '../constants/lrt.js';
import { haverDist, nearestOf } from '../utils/geo.js';
import { fetchKMBFare } from '../utils/fare.js';
import _idb from '../utils/idb.js';

// ── Route usage (learning) ────────────────────────────────
const USAGE_TTL = 30 * 24 * 60 * 60 * 1000;

export async function incrementRouteUsage(route, companyType) {
  try {
    const entry = await _idb.get('route_usage');
    const usage = entry?.data || {};
    const rk = `${route}_${companyType || 'kmb'}`;
    const nowHour = new Date().getHours();
    const existing = usage[rk];

    if (!existing || typeof existing === 'number') {
      // 舊格式遷移（flat number → object）
      const oldTotal = typeof existing === 'number' ? existing : 0;
      const hours = new Array(24).fill(0);
      hours[nowHour] = 1;
      usage[rk] = { total: oldTotal + 1, hours };
    } else {
      existing.total = (existing.total || 0) + 1;
      const hours = existing.hours || new Array(24).fill(0);
      hours[nowHour] = (hours[nowHour] || 0) + 1;
      existing.hours = hours;
      usage[rk] = existing;
    }

    _idb.set('route_usage', usage, USAGE_TTL);
  } catch {}
}

export async function getRouteUsage() {
  try { const e = await _idb.get('route_usage'); return e?.data || {}; } catch { return {}; }
}

// ── KMB stops cache ───────────────────────────────────────
let _kmbStopsCache = null;
async function fetchAllKMBStops() {
  if (_kmbStopsCache?.length) return _kmbStopsCache;
  const cached = await _idb.fresh('kmb_stops');
  if (cached?.length) { _kmbStopsCache = cached; return cached; }
  const data = await fetch(`${KMB}/stop`).then(r => r.json());
  _kmbStopsCache = data.data || [];
  if (_kmbStopsCache.length) _idb.set('kmb_stops', _kmbStopsCache, 24 * 60 * 60 * 1000);
  return _kmbStopsCache;
}
export { fetchAllKMBStops };

// ── CTB stops cache ───────────────────────────────────────
let _ctbStopsCache = null;
let _ctbStopsLoading = false;
let _ctbStopsCallbacks = [];

// alias for RoutePage.jsx compatibility
export const ensureStops = (...args) => ensureCTBStops(...args);

export async function ensureCTBStops() {
  if (_ctbStopsCache?.length) return _ctbStopsCache;

  try {
    const cached = await _idb.fresh('ctb_stops');
    if (cached?.length) {
      _ctbStopsCache = cached;
      console.log('[CTB stops] IDB hit:', cached.length);
      return cached;
    }
  } catch {}

  if (_ctbStopsLoading) {
    return new Promise(resolve => { _ctbStopsCallbacks.push(resolve); });
  }

  _ctbStopsLoading = true;
  console.log('[CTB stops] fetching from API...');

  try {
    const sig = AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined;
    const d = await fetch(`${CTB}/stop`, sig ? { signal: sig } : {}).then(r => r.json());
    _ctbStopsCache = d.data || [];
    if (_ctbStopsCache.length) {
      console.log('[CTB stops] fetched:', _ctbStopsCache.length);
      _idb.set('ctb_stops', _ctbStopsCache, 7 * 24 * 60 * 60 * 1000);
    } else {
      console.warn('[CTB stops] API returned empty');
    }
  } catch (e) {
    console.warn('[CTB stops] fetch failed:', e.message);
    _ctbStopsCache = null;
  } finally {
    _ctbStopsLoading = false;
    const cbs = _ctbStopsCallbacks.splice(0);
    cbs.forEach(cb => cb(_ctbStopsCache || []));
  }

  return _ctbStopsCache || [];
}

// ── CTB nearby ────────────────────────────────────────────
async function fetchCTBNearbyRaw(lat, lng, radius) {
  const ctbStops = await ensureCTBStops();
  if (!ctbStops?.length) {
    console.warn('[CTB nearby] no stops data available');
    return [];
  }

  const nearby = ctbStops
    .map(s => {
      const sLat = parseFloat(s.lat ?? s.latitude ?? 0);
      const sLng = parseFloat(s.long ?? s.longitude ?? 0);
      return { ...s, dist: haverDist(lat, lng, sLat, sLng) };
    })
    .filter(s => s.dist <= radius && s.dist > 0 && !isNaN(s.dist))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 6);

  if (!nearby.length) {
    console.log('[CTB nearby] no stops within', radius, 'm');
    return [];
  }

  console.log('[CTB nearby] checking', nearby.length, 'stops');
  const now = Date.now();
  const results = [];

  await Promise.all(nearby.map(async stop => {
    try {
      const sig = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
      const d = await fetch(
        `${CTB}/eta/CTB/${stop.stop}/all`,
        sig ? { signal: sig } : {}
      ).then(r => r.json());

      const etaData = d.data || [];
      if (!etaData.length) return;

      const routeMap = new Map();
      etaData.forEach(e => {
        if (!e.eta) return;
        const ts = new Date(e.eta).getTime();
        if (ts < now - 30000) return;
        const key = `${e.route}_${e.dir || 'O'}`;
        if (!routeMap.has(key)) {
          routeMap.set(key, {
            route: e.route, dest: e.dest_tc || '',
            stopName: stop.name_tc || stop.stop,
            stopId: stop.stop, dist: Math.round(stop.dist),
            dir: e.dir || 'O', etasWithType: [{ ts, type: 'ctb' }],
          });
        } else {
          const ex = routeMap.get(key);
          if (ex.etasWithType.length < 3) ex.etasWithType.push({ ts, type: 'ctb' });
        }
      });

      routeMap.forEach(r => results.push(r));
    } catch (e) {
      console.warn('[CTB nearby] stop', stop.stop, 'failed:', e.message);
    }
  }));

  console.log('[CTB nearby] total:', results.length, 'routes');
  return results;
}

// ── LRT nearby ────────────────────────────────────────────
async function fetchLRTNearby(lat, lng, radius) {
  try {
    const nearby = LRT_STNS
      .map(s => ({ ...s, dist: haverDist(lat, lng, s.lat, s.lng) }))
      .filter(s => s.dist <= Math.min(radius, 1500))
      .sort((a, b) => a.dist - b.dist).slice(0, 4);
    if (!nearby.length) return [];
    const results = [];
    await Promise.all(nearby.map(async stn => {
      try {
        const d = await fetch(`${LRT_API}?station_id=${stn.id}`).then(r => r.json());
        if (d.status !== '1') return;
        (d.platform_list || []).forEach(plat => {
          (plat.route_list || []).slice(0, 2).forEach(route => {
            if (!route.time_en) return;
            const mins = parseInt(route.time_en);
            if (isNaN(mins)) return;
            const ts = Date.now() + mins * 60000;
            results.push({
              type: 'lrt', route: route.route_no, stopName: stn.n,
              dest: route.dest_ch || route.dest_en || '', stopId: stn.id,
              serviceType: '1', etasWithType: [{ ts, type: 'lrt' }],
              dist: Math.round(stn.dist), fare: null,
            });
          });
        });
      } catch {}
    }));
    return results;
  } catch { return []; }
}

// ── MTR nearby ────────────────────────────────────────────
async function fetchMTRNearby(lat, lng) {
  const stn = nearestOf(MTR_STNS, lat, lng);
  const dist = haverDist(lat, lng, stn.lat, stn.lng);
  if (dist > 1500) return [];
  const results = [];
  for (const line of stn.lines.slice(0, 2)) {
    try {
      const code = stn.codes[line];
      const d = await fetch(`${MTR_API}?line=${line}&sta=${code}`).then(r => r.json());
      if (d.status !== 0) continue;
      const dirs = d.data?.[`${line}-${code}`];
      if (!dirs) continue;
      ['UP', 'DOWN'].forEach(dir => {
        const trains = (dirs[dir] || []).slice(0, 3);
        if (!trains.length) return;
        const etas = trains
          .map(t => new Date(t.time).getTime())
          .filter(ts => ts > Date.now() - 30000);
        if (etas.length) {
          results.push({
            type: 'mtr', route: line, stopName: stn.n,
            dest: dir === 'UP' ? '往上行' : '往下行',
            etasWithType: etas.map(ts => ({ ts, type: 'mtr' })),
            stopId: code, serviceType: '1', dist: Math.round(dist), fare: null,
          });
        }
      });
    } catch {}
  }
  return results;
}

// ── 複合評分計算 ──────────────────────────────────────────
// 分數 = 時段命中次數 × 3 + 總使用次數 × 0.5
// 時段：當前小時 ±2 小時範圍
function calcScore(rk, usage) {
  const u = usage[rk];
  if (!u) return 0;
  if (typeof u === 'number') return u * 0.5;
  const total = u.total || 0;
  const hours = u.hours || [];
  const nowHour = new Date().getHours();
  let timeHits = 0;
  for (let dh = -2; dh <= 2; dh++) {
    const h = (nowHour + dh + 24) % 24;
    timeHits += hours[h] || 0;
  }
  return timeHits * 3 + total * 0.5;
}

// ── 排序 + 車費 ───────────────────────────────────────────
async function buildRows(routeMap, lat, lng, dist, transportSettings) {
  const { mtr, lrt } = transportSettings;

  if (mtr) {
    try {
      const mtrRows = await fetchMTRNearby(lat, lng);
      mtrRows.forEach((r, i) =>
        routeMap.set(`MTR_${r.route}_${r.dest}_${i}`, {
          ...r, serviceType: '1', dir: 'U', companyType: 'mtr', fare: null,
        })
      );
    } catch {}
  }
  if (lrt) {
    try {
      const lrtRows = await fetchLRTNearby(lat, lng, dist);
      lrtRows.forEach((r, i) =>
        routeMap.set(`LRT_${r.route}_${r.stopId}_${i}`, {
          ...r, serviceType: '1', dir: 'O', companyType: 'lrt', fare: null,
        })
      );
    } catch {}
  }

  let allRows = [...routeMap.values()].filter(r => r.etasWithType?.length > 0);
  allRows.forEach(r => {
    if (r.companyType === 'joint') r.etasWithType.sort((a, b) => a.ts - b.ts);
  });

  const usage = await getRouteUsage();
  const now = Date.now();

  allRows.sort((a, b) => {
    const aMin = Math.round((a.etasWithType[0].ts - now) / 60000);
    const bMin = Math.round((b.etasWithType[0].ts - now) / 60000);

    // 3分鐘內到站優先
    if (aMin <= 3 && bMin > 3) return -1;
    if (bMin <= 3 && aMin > 3) return 1;

    // 複合評分（時段命中 × 3 + 使用次數 × 0.5）
    const aScore = calcScore(`${a.route}_${a.companyType}`, usage);
    const bScore = calcScore(`${b.route}_${b.companyType}`, usage);
    if (Math.abs(aScore - bScore) > 0.1) return bScore - aScore;

    // 最後以 ETA 排序
    return a.etasWithType[0].ts - b.etasWithType[0].ts;
  });

  const renderRows = allRows.slice(0, 25);

  // 車費（KMB/joint，最多等 4 秒）
  const fareRows = renderRows.filter(r => r.companyType === 'kmb' || r.companyType === 'joint');
  await Promise.race([
    Promise.all(fareRows.map(r =>
      fetchKMBFare(r.route, r.dir, r.serviceType)
        .then(fare => { r.fare = fare; })
        .catch(() => {})
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
      // ── Phase 1: KMB ──────────────────────────────────
      const stops = await fetchAllKMBStops();
      const nearby = stops
        .map(s => ({ ...s, dist: haverDist(lat, lng, parseFloat(s.lat), parseFloat(s.long)) }))
        .filter(s => s.dist <= dist)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 25);

      if (!nearby.length) {
        if (myId !== loadId.current) return;
        setRows([]); setStatus('ready'); return;
      }

      const etaResults = await Promise.all(
        nearby.map(s =>
          fetch(`${KMB}/stop-eta/${s.stop}`).then(r => r.json()).catch(() => ({ data: [] }))
        )
      );

      const now = Date.now();
      const routeMap = new Map();

      etaResults.forEach((res, i) => {
        const stop = nearby[i];
        (res.data || []).forEach(e => {
          if (!e.eta) return;
          const ts = new Date(e.eta).getTime();
          if (ts < now - 30000) return;
          const key = `${e.route}_${e.dir}`;
          if (!routeMap.has(key)) {
            routeMap.set(key, {
              route: e.route, dest: e.dest_tc || '', stopName: stop.name_tc,
              stopId: stop.stop, dist: Math.round(stop.dist),
              serviceType: e.service_type || '1', dir: e.dir,
              companyType: 'kmb', etasWithType: [{ ts, type: 'kmb' }], fare: null,
            });
          } else {
            const ex = routeMap.get(key);
            if (ex.etasWithType.length < 3 && !ex.etasWithType.find(x => x.ts === ts))
              ex.etasWithType.push({ ts, type: 'kmb' });
          }
        });
      });

      const kmbRows = await buildRows(new Map(routeMap), lat, lng, dist, transportSettings);
      if (myId !== loadId.current) return;
      setRows(kmbRows);
      setStatus('ready');

      // ── Phase 2: CTB（背景合併）──────────────────────
      if (transportSettings.ctb) {
        try {
          const ctbRows = await fetchCTBNearbyRaw(lat, lng, dist);
          if (myId !== loadId.current) return;

          if (ctbRows.length > 0) {
            ctbRows.forEach(r => {
              const matchKey =
                routeMap.has(`${r.route}_O`) ? `${r.route}_O` :
                routeMap.has(`${r.route}_I`) ? `${r.route}_I` : null;

              if (matchKey) {
                const ex = routeMap.get(matchKey);
                if (ex.companyType === 'kmb') ex.companyType = 'joint';
                r.etasWithType.forEach(e => {
                  if (ex.etasWithType.length < 3 && !ex.etasWithType.find(x => x.ts === e.ts))
                    ex.etasWithType.push(e);
                });
                ex.etasWithType.sort((a, b) => a.ts - b.ts);
              } else {
                const newKey = `${r.route}_CTB_${r.stopId}`;
                if (!routeMap.has(newKey)) {
                  routeMap.set(newKey, {
                    ...r, serviceType: '1', dir: 'O', companyType: 'ctb', fare: null,
                  });
                }
              }
            });

            const finalRows = await buildRows(routeMap, lat, lng, dist, transportSettings);
            if (myId !== loadId.current) return;
            setRows(finalRows);
          }
        } catch (e) {
          console.warn('[CTB phase2]', e);
        }
      }
    } catch (e) {
      console.warn('[nearby]', e);
      if (myId !== loadId.current) return;
      setStatus('error');
      setErrorMsg('載入失敗，請重試');
    }
  }, [transportSettings]);

  return { status, rows, errorMsg, setStatus, load };
}
