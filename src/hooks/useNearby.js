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
    usage[rk] = (usage[rk] || 0) + 1;
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
let _ctbStopsPromise = null;
export async function ensureCTBStops() {
  if (_ctbStopsCache?.length) return _ctbStopsCache;
  if (!_ctbStopsPromise) {
    _ctbStopsPromise = (async () => {
      const cached = await _idb.fresh('ctb_stops');
      if (cached?.length) { _ctbStopsCache = cached; return; }
      try {
        const d = await fetch(`${CTB}/stop`, {
          signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined,
        }).then(r => r.json());
        _ctbStopsCache = d.data || [];
        if (_ctbStopsCache.length) _idb.set('ctb_stops', _ctbStopsCache, 7 * 24 * 60 * 60 * 1000);
      } catch (e) {
        console.warn('[CTB stops]', e);
        _ctbStopsCache = null;
        _ctbStopsPromise = null;
      }
    })();
  }
  await _ctbStopsPromise;
  return _ctbStopsCache || [];
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
              serviceType: '1', etasWithType: [{ ts, type: 'lrt' }], dist: Math.round(stn.dist), fare: null,
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

// ── CTB nearby raw ────────────────────────────────────────
async function fetchCTBNearbyRaw(lat, lng, radius) {
  const ctbStops = await ensureCTBStops();
  if (!ctbStops?.length) return [];
  const nearby = ctbStops
    .map(s => ({ ...s, dist: haverDist(lat, lng, parseFloat(s.lat || s.latitude || 0), parseFloat(s.long || s.longitude || 0)) }))
    .filter(s => s.dist <= radius && !isNaN(s.dist) && s.dist > 0)
    .sort((a, b) => a.dist - b.dist).slice(0, 8);
  const now = Date.now();
  const results = [];
  await Promise.all(nearby.map(async stop => {
    try {
      const d = await fetch(`${CTB}/eta/CTB/${stop.stop}/all`).then(r => r.json());
      const seen = new Set();
      (d.data || []).forEach(e => {
        if (!e.eta) return;
        const ts = new Date(e.eta).getTime();
        if (ts < now - 30000) return;
        const key = `${e.route}_${e.dir || 'O'}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            route: e.route, dest: e.dest_tc || '', stopName: stop.name_tc || stop.stop,
            stopId: stop.stop, dist: Math.round(stop.dist), dir: e.dir || 'O',
            etasWithType: [{ ts, type: 'ctb' }],
          });
        } else {
          const ex = results.find(r => r.route === e.route && r.stopId === stop.stop);
          if (ex && ex.etasWithType.length < 3) ex.etasWithType.push({ ts, type: 'ctb' });
        }
      });
    } catch {}
  }));
  return results;
}

// ── Main hook ─────────────────────────────────────────────
export function useNearby(transportSettings) {
  // status: 'idle' | 'no-permission' | 'loading' | 'ready' | 'error'
  const [status, setStatus] = useState('idle');
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const buildAndRender = useCallback(async (lat, lng, dist, routeMap) => {
    const { mtr, lrt } = transportSettings;

    if (mtr) {
      try {
        const mtrRows = await fetchMTRNearby(lat, lng);
        mtrRows.forEach((r, i) =>
          routeMap.set(`MTR_${r.route}_${r.dest}_${i}`, { ...r, serviceType: '1', dir: 'U', companyType: 'mtr', fare: null })
        );
      } catch {}
    }
    if (lrt) {
      try {
        const lrtRows = await fetchLRTNearby(lat, lng, dist);
        lrtRows.forEach((r, i) =>
          routeMap.set(`LRT_${r.route}_${r.stopId}_${i}`, { ...r, serviceType: '1', dir: 'O', companyType: 'lrt', fare: null })
        );
      } catch {}
    }

    let allRows = [...routeMap.values()].filter(r => r.etasWithType?.length > 0);
    allRows.forEach(r => { if (r.companyType === 'joint') r.etasWithType.sort((a, b) => a.ts - b.ts); });

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

    // Fetch fares (KMB/joint only) — max 4s wait
    const fareRows = renderRows.filter(r => r.companyType === 'kmb' || r.companyType === 'joint');
    await Promise.race([
      Promise.all(fareRows.map(r =>
        fetchKMBFare(r.route, r.dir, r.serviceType).then(fare => { r.fare = fare; }).catch(() => {})
      )),
      new Promise(res => setTimeout(res, 4000)),
    ]);

    setRows([...renderRows]);
    setStatus('ready');
  }, [transportSettings]);

  const load = useCallback(async (lat, lng, dist) => {
    setStatus('loading');
    try {
      const stops = await fetchAllKMBStops();
      const nearby = stops
        .map(s => ({ ...s, dist: haverDist(lat, lng, parseFloat(s.lat), parseFloat(s.long)) }))
        .filter(s => s.dist <= dist)
        .sort((a, b) => a.dist - b.dist).slice(0, 25);

      if (!nearby.length) { setRows([]); setStatus('ready'); return; }

      const etaResults = await Promise.all(
        nearby.map(s => fetch(`${KMB}/stop-eta/${s.stop}`).then(r => r.json()).catch(() => ({ data: [] })))
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

      // Phase 1: render KMB immediately
      await buildAndRender(lat, lng, dist, new Map(routeMap));

      // Phase 2: merge CTB if enabled
      if (transportSettings.ctb) {
        ensureCTBStops().then(async ctbStops => {
          if (!ctbStops?.length) return;
          try {
            const ctbRows = await fetchCTBNearbyRaw(lat, lng, dist);
            if (!ctbRows.length) return;
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
                if (!routeMap.has(newKey))
                  routeMap.set(newKey, { ...r, serviceType: '1', dir: 'O', companyType: 'ctb', fare: null });
              }
            });
            await buildAndRender(lat, lng, dist, routeMap);
          } catch (e) { console.warn('[CTB phase2]', e); }
        });
      }
    } catch (e) {
      console.warn('[nearby]', e);
      setStatus('error');
      setErrorMsg('載入失敗，請重試');
    }
  }, [transportSettings, buildAndRender]);

  return { status, rows, errorMsg, setStatus, load };
}
