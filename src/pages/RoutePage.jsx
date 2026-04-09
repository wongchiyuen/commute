import { useState, useEffect, useCallback, useRef } from 'react';
import { KMB, CTB } from '../constants/transport.js';
import { fetchAllKMBStops, ensureStops } from '../hooks/useNearby.js';
import { fetchKMBFare } from '../utils/fare.js';
import { useApp, loadFavs, saveFavs, NEARBY_PID } from '../context/AppContext.jsx';

// ── 本地 CTB stops cache（不依賴 useNearby.js）────────────
let _ctbCache = null;
async function getCtbStopNames() {
  if (_ctbCache) return _ctbCache;
  try {
    const d = await fetch(`${CTB}/stop`).then(r => r.json());
    _ctbCache = new Map((d.data || []).map(s => [s.stop, s.name_tc || s.name_en || s.stop]));
  } catch {
    _ctbCache = new Map();
  }
  return _ctbCache;
}

// ── 營辦商色彩 ────────────────────────────────────────────
const CO = {
  kmb:   { bg: 'rgba(216,90,48,.12)',  bdr: 'rgba(216,90,48,.3)',  col: '#D85A30', lbl: '九巴' },
  joint: { bg: 'rgba(216,90,48,.12)',  bdr: 'rgba(216,90,48,.3)',  col: '#D85A30', lbl: '九巴+城巴' },
  ctb:   { bg: 'rgba(29,158,117,.12)', bdr: 'rgba(29,158,117,.3)', col: '#0F6E56', lbl: '城巴' },
  mtr:   { bg: 'rgba(55,138,221,.12)', bdr: 'rgba(55,138,221,.3)', col: '#185FA5', lbl: '港鐵' },
  lrt:   { bg: 'rgba(255,170,51,.12)', bdr: 'rgba(255,170,51,.3)', col: '#BA7517', lbl: '輕鐵' },
};

function toApiDir(dir) { return dir === 'I' ? 'inbound' : 'outbound'; }

// ── API helpers（直連 data.gov.hk）────────────────────────
async function getKMBRouteInfo(route, dir, svcType) {
  try {
    const r = await fetch(`${KMB}/route/${route}/${toApiDir(dir)}/${svcType}`).then(r => r.json());
    return r.data || null;
  } catch { return null; }
}

async function getCTBRouteInfo(route) {
  try {
    const r = await fetch(`${CTB}/route/CTB/${route}`).then(r => r.json());
    return r.data || null;
  } catch { return null; }
}

async function getKMBStopIds(route, dir, svcType) {
  const r = await fetch(`${KMB}/route-stop/${route}/${toApiDir(dir)}/${svcType}`).then(r => r.json());
  return (r.data || []).sort((a, b) => a.seq - b.seq).map(s => s.stop);
}

async function getCTBStopIds(route, dir) {
  const r = await fetch(`${CTB}/route-stop/CTB/${route}/${toApiDir(dir)}`).then(r => r.json());
  return (r.data || []).sort((a, b) => a.seq - b.seq).map(s => s.stop);
}

async function getKMBStopETA(stopId, route, svcType) {
  try {
    const r = await fetch(`${KMB}/stop-eta/${stopId}`).then(r => r.json());
    const now = Date.now();
    return (r.data || [])
      .filter(e => e.route === route && String(e.service_type) === String(svcType) && e.eta)
      .map(e => new Date(e.eta).getTime())
      .filter(ts => ts > now - 30000)
      .slice(0, 3);
  } catch { return []; }
}

async function getCTBStopETA(stopId, route) {
  try {
    const r = await fetch(`${CTB}/eta/CTB/${stopId}/${route}`).then(r => r.json());
    const now = Date.now();
    return (r.data || [])
      .filter(e => e.eta)
      .map(e => new Date(e.eta).getTime())
      .filter(ts => ts > now - 30000)
      .slice(0, 3);
  } catch { return []; }
}

// ── ETA pills ─────────────────────────────────────────────
function ETAPills({ etas }) {
  const now = Date.now();
  if (etas === undefined) return <span style={{ fontSize: 11, color: 'var(--dim)' }}>…</span>;
  if (!etas.length) return null;
  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
      {etas.map((ts, i) => {
        const m = Math.round((ts - now) / 60000);
        const urgent = m <= 2;
        const mid    = m <= 8;
        return (
          <span key={i} style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 10,
            fontWeight: i === 0 ? 600 : 400,
            background: urgent ? 'rgba(46,213,115,.15)' : mid ? 'rgba(240,165,0,.12)' : 'var(--bg3)',
            color:      urgent ? '#2ed573'               : mid ? 'var(--amb2)'         : 'var(--mid)',
          }}>
            {m <= 0 ? '即將' : `${m}分`}
          </span>
        );
      })}
    </div>
  );
}

// ── 主組件 ────────────────────────────────────────────────
export default function RoutePage({ row, closeDrawer, showToast }) {
  const { activePid, profiles, addRouteTargetPid, setAddRouteTargetPid } = useApp();
  const initDir = row?.dir || 'O';
  const [dir, setDir]             = useState(initDir);
  const [routeInfo, setRouteInfo] = useState(null);
  const [stops, setStops]         = useState([]);
  const [etaMap, setEtaMap]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [fare, setFare]           = useState(row?.fare ?? null);
  const [mapView, setMapView]     = useState(false);
  const nearRef = useRef(null);
  const genRef  = useRef(0);
  const mapElRef = useRef(null);
  const leafletMapRef = useRef(null);

  const route       = row?.route       || '';
  const companyType = row?.companyType || 'kmb';
  const svcType     = row?.serviceType || '1';
  const nearStopId  = row?.stopId      || '';
  const rowDest     = row?.dest        || '';
  const targetPidFromRow = row?.targetPid || null;

  const isCtb     = companyType === 'ctb';
  const isKmbLike = companyType === 'kmb' || companyType === 'joint';
  const co        = CO[companyType] || CO.kmb;

  const loadAll = useCallback(async (d) => {
    if (!route) return;
    const gen = ++genRef.current;
    setLoading(true); setStops([]); setEtaMap({});

    try {
      // 1. 路線資料
      const info = isCtb
        ? await getCTBRouteInfo(route)
        : await getKMBRouteInfo(route, d, svcType);
      if (gen !== genRef.current) return;
      setRouteInfo(info);

      // 2. 站序 IDs
      const ids = isCtb
        ? await getCTBStopIds(route, d)
        : await getKMBStopIds(route, d, svcType);
      if (gen !== genRef.current) return;

      // 3. 全港站點座標（用於地圖）
      const allStops = await ensureStops();
      const stopDataMap = new Map(allStops.map(s => [s.id, s]));

      const stopsArr = ids.map((sid, i) => {
        const sd = stopDataMap.get(sid);
        return {
          stopId: sid, 
          seq: i + 1, 
          name: sd?.n || sid,
          lat: sd?.lat,
          lng: sd?.lng,
        };
      });

      if (gen !== genRef.current) return;
      setStops(stopsArr);
      setLoading(false);

      setTimeout(() => nearRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);

      // 4. 分批取得各站 ETA（每批 6 站）
      const BATCH = 6;
      for (let i = 0; i < stopsArr.length; i += BATCH) {
        if (gen !== genRef.current) return;
        const batch = stopsArr.slice(i, i + BATCH);
        await Promise.all(batch.map(async s => {
          const etas = isCtb
            ? await getCTBStopETA(s.stopId, route)
            : await getKMBStopETA(s.stopId, route, svcType);
          if (gen !== genRef.current) return;
          setEtaMap(prev => ({ ...prev, [s.stopId]: etas }));
        }));
      }

      // 5. 票價（KMB，背景取得）
      if (isKmbLike && fare === null) {
        const f = await fetchKMBFare(route, d, svcType).catch(() => null);
        if (gen !== genRef.current) return;
        if (f !== null) setFare(f);
      }
    } catch (e) {
      console.warn('[RoutePage]', e);
      if (gen !== genRef.current) return;
      setLoading(false);
    }
  }, [route, isCtb, isKmbLike, svcType, fare]);

  useEffect(() => { loadAll(dir); }, [dir]);

  // ── 路線地圖 ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapView || !mapElRef.current || !stops.length) return;
    const L = window.L;
    if (!L) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapElRef.current, { 
        zoomControl: false, 
        attributionControl: false 
      }).setView([22.3193, 114.1694], 13);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);
      
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;
    // 清除現有標記
    map.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l); });

    const points = [];
    stops.forEach((s, i) => {
      if (!s.lat || !s.lng) return;
      const pos = [Number(s.lat), Number(s.lng)];
      points.push(pos);

      const isFirst = i === 0;
      const isLast = i === stops.length - 1;
      const isNear = s.stopId === nearStopId;

      const icon = L.divIcon({
        className: 'custom-stop-icon',
        html: `<div class="stop-marker-inner ${isNear ? 'near' : ''}" style="background: ${isNear ? 'var(--amb)' : co.col}; width: ${isFirst || isLast || isNear ? '24px' : '12px'}; height: ${isFirst || isLast || isNear ? '24px' : '12px'}; border-width: ${isNear ? '3px' : '2px'}">
                ${isFirst ? '起' : isLast ? '終' : ''}
               </div>`,
        iconSize: isFirst || isLast || isNear ? [24, 24] : [12, 12],
        iconAnchor: isFirst || isLast || isNear ? [12, 12] : [6, 6],
      });

      const etas = etaMap[s.stopId];
      const etaTxt = etas?.length ? Math.round((etas[0] - Date.now()) / 60000) + ' 分' : '…';

      L.marker(pos, { icon }).bindPopup(`<b>${s.seq}. ${s.name}</b><br/>下一班：${etaTxt}`).addTo(map);
    });

    if (points.length > 1) {
      L.polyline(points, { color: co.col, weight: 4, opacity: 0.8, lineJoin: 'round' }).addTo(map);
      map.fitBounds(points, { padding: [40, 40] });
    }

    setTimeout(() => map.invalidateSize(), 100);
  }, [mapView, stops, etaMap, co.col, nearStopId]);

  if (!row) return <div style={{ padding: 20, color: 'var(--dim)', fontSize: 13 }}>路線資料缺失</div>;
  if (companyType === 'mtr' || companyType === 'lrt') {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🚆</div>
        <div style={{ fontSize: 14, color: 'var(--bright)', marginBottom: 6 }}>港鐵 / 輕鐵路線詳情</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.7 }}>
          請使用港鐵官方應用程式查看詳細班次資訊。
        </div>
      </div>
    );
  }

  let orig = '', destText = rowDest;
  if (routeInfo) {
    if (isCtb) {
      orig     = dir === 'O' ? (routeInfo.orig_tc || '') : (routeInfo.dest_tc || '');
      destText = dir === 'O' ? (routeInfo.dest_tc || rowDest) : (routeInfo.orig_tc || rowDest);
    } else {
      orig     = routeInfo.orig_tc || '';
      destText = routeInfo.dest_tc || rowDest;
    }
  }

  const rfs = route.length <= 3 ? '22px' : route.length <= 4 ? '17px' : '13px';
  const previewTargetPid =
    targetPidFromRow || addRouteTargetPid || (activePid === NEARBY_PID ? (profiles[0]?.id || null) : activePid);
  const previewTargetName = profiles.find(p => p.id === previewTargetPid)?.name || '目前版面';
  const addToFavs = useCallback((stop) => {
    const targetPid =
      targetPidFromRow ||
      addRouteTargetPid ||
      (activePid === NEARBY_PID ? (profiles[0]?.id || null) : activePid);
    if (!targetPid) {
      showToast?.('請先新增版面');
      return;
    }
    const favType = companyType === 'joint' ? 'joint' : companyType;
    const list = loadFavs(targetPid);
    const exists = list.some(f =>
      f.route === route &&
      String(f.serviceType || '1') === String(svcType || '1') &&
      f.stopId === stop.stopId &&
      (f.type || 'kmb') === favType
    );
    if (exists) {
      showToast?.('此站已在版面中');
      return;
    }
    list.push({
      route,
      stopId: stop.stopId,
      stopName: stop.name,
      dest: destText,
      serviceType: svcType || '1',
      type: favType,
    });
    saveFavs(targetPid, list);
    const targetName = profiles.find(p => p.id === targetPid)?.name || '版面';
    showToast?.(`已加入「${targetName}」`);
    setAddRouteTargetPid(null);
    closeDrawer?.();
  }, [activePid, profiles, companyType, route, svcType, destText, closeDrawer, showToast, targetPidFromRow, addRouteTargetPid, setAddRouteTargetPid]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>

      {/* ── 路線 Header ── */}
      <div style={{ flexShrink: 0, paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            background: co.bg, border: `1px solid ${co.bdr}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 1,
          }}>
            <span style={{ fontSize: rfs, fontWeight: 700, color: co.col, lineHeight: 1 }}>{route}</span>
            <span style={{ fontSize: 9, color: co.col, opacity: .65 }}>{co.lbl}</span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500, color: 'var(--txt)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {orig ? `${orig} → ${destText}` : `往 ${destText}`}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, padding: '2px 7px', borderRadius: 10,
                background: 'var(--bg3)', border: '1px solid var(--bdr)', color: 'var(--mid)',
              }}>加入至：{previewTargetName}</span>
              {fare != null && (
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 10,
                  background: 'var(--bg3)', border: '1px solid var(--bdr)', color: 'var(--mid)',
                }}>${fare}</span>
              )}
              {stops.length > 0 && (
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 10,
                  background: 'var(--bg3)', border: '1px solid var(--bdr)', color: 'var(--mid)',
                }}>{stops.length} 個站</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              onClick={() => setMapView(!mapView)}
              style={{
                padding: '7px 10px', fontSize: 12, borderRadius: 8,
                border: '1px solid var(--bdr2)', background: 'var(--bg2)',
                color: 'var(--mid)', cursor: 'pointer'
              }}
            >
              {mapView ? '📋 列表' : '🗺 地圖'}
            </button>

            <div style={{
              display: 'flex', borderRadius: 8, overflow: 'hidden',
              border: '1px solid var(--bdr2)', flexShrink: 0,
            }}>
              {[['O', '往程'], ['I', '回程']].map(([d, lbl]) => (
                <button key={d} onClick={() => setDir(d)} style={{
                  padding: '7px 11px', fontSize: 12, border: 'none',
                  cursor: 'pointer', fontFamily: 'var(--sans)', transition: 'all .15s',
                  background: dir === d ? co.col : 'var(--bg2)',
                  color:      dir === d ? '#fff' : 'var(--mid)',
                }}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ height: '0.5px', background: 'var(--bdr)' }} />
      </div>

      {/* ── 內容區域 ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* 地圖視圖 */}
        <div ref={mapElRef} style={{ 
          position: 'absolute', inset: 0, 
          display: mapView ? 'block' : 'none',
          zIndex: 5
        }} />

        {/* 站序時間線 */}
        <div style={{ 
          height: '100%', overflowY: 'auto', paddingBottom: 24,
          display: mapView ? 'none' : 'block'
        }}>
          {loading && stops.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--dim)' }}>
              載入站序中…
            </div>
          ) : stops.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--dim)' }}>
              找不到此方向的站序資料
            </div>
          ) : stops.map((s, i) => {
          const isFirst = i === 0;
          const isLast  = i === stops.length - 1;
          const isNear  = s.stopId === nearStopId;
          const etas    = etaMap[s.stopId];

          return (
            <div
              key={s.stopId}
              ref={isNear ? nearRef : null}
              style={{
                display: 'flex', alignItems: 'stretch',
                background: isNear ? co.bg : 'transparent',
                borderRadius: isNear ? 8 : 0,
                transition: 'background .2s',
              }}
            >
              <div style={{
                width: 28, flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <div style={{ width: 2, flex: 1, background: isFirst ? 'transparent' : co.col, opacity: .35 }} />
                <div style={{
                  width:  isFirst || isLast ? 12 : isNear ? 11 : 8,
                  height: isFirst || isLast ? 12 : isNear ? 11 : 8,
                  borderRadius: '50%', flexShrink: 0,
                  background: isFirst || isLast || isNear ? co.col : 'var(--bg2)',
                  border: `2px solid ${co.col}`,
                  zIndex: 1,
                }} />
                <div style={{ width: 2, flex: 1, background: isLast ? 'transparent' : co.col, opacity: .35 }} />
              </div>

              <div style={{
                flex: 1, padding: '9px 6px 9px 4px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--bdr)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: isFirst || isLast || isNear ? 600 : 400,
                    color: isNear ? co.col : isFirst || isLast ? 'var(--bright)' : 'var(--txt)',
                  }}>
                    {s.name}
                  </span>
                  {isNear && (
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 8,
                      background: co.col, color: '#fff', flexShrink: 0,
                    }}>你在附近</span>
                  )}
                </div>
                <ETAPills etas={etas} />
              </div>

              <div style={{
                paddingTop: 11, paddingRight: 6,
                fontSize: 10, color: 'var(--dim)',
                minWidth: 58, textAlign: 'right', flexShrink: 0,
              }}>
                <div>{s.seq}</div>
                <button
                  onClick={() => addToFavs(s)}
                  style={{
                    marginTop: 6, padding: '2px 6px', borderRadius: 8, border: `1px solid ${co.bdr}`,
                    background: co.bg, color: co.col, fontSize: 10, cursor: 'pointer',
                  }}>
                  ＋加入
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
