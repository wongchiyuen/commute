import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp, loadFavs, saveFavs, NEARBY_PID } from '../context/AppContext.jsx';
import { useWeather } from '../hooks/useWeather.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { useNearby, incrementRouteUsage, fetchAllKMBStops } from '../hooks/useNearby.js';
import { KMB, CTB } from '../constants/transport.js';
import { RHRREAD_STNS } from '../constants/weather.js';
import { nearestOf } from '../utils/geo.js';
import { fetchKMBFare } from '../utils/fare.js';
import WeatherPanel from '../components/WeatherPanel.jsx';
import BusCard from '../components/BusCard.jsx';
import { Spinner } from '../components/Overlay.jsx';

const DIST_STEPS = [100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 10000];
const STD_DISTS = [100, 300, 500, 1000, 3000, 5000];

function distLabel(m) { return m >= 1000 ? (m / 1000) + 'km' : m + 'm'; }

export default function HomePage({ openDrawer, showToast }) {
  const {
    setActivePage,
    setAddRouteTargetPid,
    activePid, setActivePid, profiles,
    nearbyDist, setNearbyDist,
    gpsCoords, saveGps,
    selectedStn, setSelectedStn,
    transportSettings,
    reloadFavs,
  } = useApp();

  const isNearby = activePid === NEARBY_PID;
  const [refreshing, setRefreshing] = useState(false);
  const [favRows, setFavRows] = useState([]);
  const [showSlider, setShowSlider] = useState(false);
  const [sliderIdx, setSliderIdx] = useState(3);
  const [mapView, setMapView] = useState(false);
  const mapElRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerLayerRef = useRef(null);

  const { weatherData, loadWeather } = useWeather(selectedStn, gpsCoords);
  const { getCurrentPosition, checkPermission } = useGeolocation();
  const nearbyHook = useNearby(transportSettings);

  // ── GPS ──────────────────────────────────────────────────
  const doLocate = useCallback(() => {
    getCurrentPosition(pos => {
      saveGps(pos.coords.latitude, pos.coords.longitude);
      const near = nearestOf(RHRREAD_STNS, pos.coords.latitude, pos.coords.longitude);
      if (near.n !== selectedStn) setSelectedStn(near.n);
      if (isNearby) nearbyHook.load(pos.coords.latitude, pos.coords.longitude, nearbyDist);
    }, () => {
      if (!gpsCoords && isNearby) nearbyHook.setStatus('no-permission');
    });
  }, [getCurrentPosition, saveGps, selectedStn, setSelectedStn, isNearby, nearbyDist, gpsCoords, nearbyHook]);

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    loadWeather();
    if (gpsCoords && isNearby) {
      nearbyHook.load(gpsCoords.lat, gpsCoords.lng, nearbyDist);
    } else if (isNearby) {
      checkPermission().then(state => {
        if (state === 'granted') doLocate();
        else nearbyHook.setStatus('no-permission');
      });
    } else {
      _refreshFavs();
    }
    doLocate();
    const weatherT = setInterval(loadWeather, 5 * 60 * 1000);
    const etaT = setInterval(() => {
      if (isNearby && gpsCoords) nearbyHook.load(gpsCoords.lat, gpsCoords.lng, nearbyDist);
      else _refreshFavs();
    }, 30000);
    return () => { clearInterval(weatherT); clearInterval(etaT); };
  // eslint-disable-next-line
  }, []);

  // 距離變化時重新載入
  useEffect(() => {
    if (isNearby && gpsCoords) nearbyHook.load(gpsCoords.lat, gpsCoords.lng, nearbyDist);
  // eslint-disable-next-line
  }, [nearbyDist]);

  // ── Nearby map（Leaflet）──────────────────────────────────
  useEffect(() => {
    let mapInstance = null;
    let timer = null;

    // 只有在 isNearby && mapView 為真時才嘗試操作地圖
    if (!isNearby || !mapView || !mapElRef.current) {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerLayerRef.current = null;
      }
      return;
    }

    const L = window.L;
    if (!L) return;

    try {
      if (!leafletMapRef.current) {
        const center = gpsCoords ? [gpsCoords.lat, gpsCoords.lng] : [22.3193, 114.1694];
        mapInstance = L.map(mapElRef.current, { 
          zoomControl: false, 
          attributionControl: false 
        }).setView(center, gpsCoords ? 15 : 11);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
        }).addTo(mapInstance);
        
        L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
        leafletMapRef.current = mapInstance;
        markerLayerRef.current = L.layerGroup().addTo(mapInstance);
      }

      const map = leafletMapRef.current;
      const layer = markerLayerRef.current;
      if (!map || !layer) return;

      // 重要：給予一些時間讓 React 完成 DOM 渲染
      timer = setTimeout(() => {
        if (leafletMapRef.current) leafletMapRef.current.invalidateSize();
      }, 200);

      layer.clearLayers();
      const points = [];
      
      if (gpsCoords) {
        points.push([gpsCoords.lat, gpsCoords.lng]);
        L.circleMarker([gpsCoords.lat, gpsCoords.lng], {
          radius: 8, color: '#fff', weight: 2, fillColor: '#007bff', fillOpacity: 0.9,
        }).addTo(layer);
        L.circle([gpsCoords.lat, gpsCoords.lng], {
          radius: nearbyDist, color: '#007bff', weight: 1, fillColor: '#007bff', fillOpacity: 0.05, dashArray: '5, 5'
        }).addTo(layer);
      }

      const stopMap = new Map();
      (nearbyHook.rows || []).forEach(r => {
        if (r?.stopLat && r?.stopLng && r?.stopId) {
          if (!stopMap.has(r.stopId)) stopMap.set(r.stopId, []);
          stopMap.get(r.stopId).push(r);
        }
      });

      stopMap.forEach((routes, stopId) => {
        const r = routes[0];
        const lat = Number(r.stopLat);
        const lng = Number(r.stopLng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          points.push([lat, lng]);
          
          const routeCount = routes.length;
          const displayRoute = r.route || '';
          const hasMore = routeCount > 1;
          
          // 決定標記顏色：如果是聯營或有多種營辦商，用 joint 色
          const cos = new Set(routes.map(x => x.companyType));
          const mainCo = cos.size > 1 ? 'joint' : r.companyType;

          const icon = L.divIcon({
            className: 'custom-stop-icon',
            html: `<div class="stop-pill ${mainCo}">
                    <div class="co-dot"></div>
                    <span>${displayRoute}${hasMore ? `<small>+${routeCount-1}</small>` : ''}</span>
                  </div>`,
            iconSize: [hasMore ? 80 : 60, 24],
            iconAnchor: [hasMore ? 40 : 30, 12],
          });
          const eta = r.etasWithType?.[0]?.ts ? Math.max(0, Math.round((r.etasWithType[0].ts - Date.now()) / 60000)) : null;
          const etaTxt = eta == null ? '無班次' : eta <= 0 ? '即將' : `${eta}分`;
          const popup = `
            <div class="map-popup">
              <div class="map-popup-title">${r.stopName || '未知站點'}</div>
              <div class="map-popup-routes">${routes.map(x => `<b>${x.route || ''}</b>`).join(' ')}</div>
              <div class="map-popup-eta">下一班：${etaTxt}</div>
            </div>
          `;
          L.marker([lat, lng], { icon }).bindPopup(popup).addTo(layer);
        }
      });

      if (points.length > 1) map.fitBounds(points, { padding: [24, 24], maxZoom: 16 });
      else if (points.length === 1) map.setView(points[0], 15);
    } catch (e) {
      console.error('Home map error:', e);
    }

    return () => { if (timer) clearTimeout(timer); };
  }, [isNearby, mapView, gpsCoords, nearbyHook.rows, nearbyDist]);

  // 移除舊有的 [isNearby] 清理 effect，因為上面已經整合咗
  // (即係刪除原本 157-164 行嘅 useEffect)
  
  // ── Favs ──────────────────────────────────────────────────
  const fetchFavEtas = useCallback(async (fav, now) => {
    const favType = (fav.type || '').toLowerCase();
    const isKnownType = ['kmb', 'lwb', 'ctb', 'joint'].includes(favType);

    const loadKmbLike = async () => {
      const d = await fetch(`${KMB}/eta/${fav.stopId}/${fav.route}/${fav.serviceType}`).then(r => r.json());
      const etas = (d.data || [])
        .filter(e => e.eta)
        .map(e => ({
          ts: new Date(e.eta).getTime(),
          type: (e.co || '').toUpperCase() === 'LWB' ? 'lwb' : 'kmb',
        }))
        .filter(e => e.ts > now - 30000)
        .sort((a, b) => a.ts - b.ts)
        .slice(0, 3);
      const hasKmb = etas.some(e => e.type === 'kmb');
      const hasLwb = etas.some(e => e.type === 'lwb');
      const companyType = hasKmb && hasLwb ? 'joint' : hasLwb ? 'lwb' : 'kmb';
      return { etasWithType: etas, companyType };
    };

    const loadCtb = async () => {
      const d = await fetch(`${CTB}/eta/CTB/${fav.stopId}/${fav.route}`).then(r => r.json());
      const etas = (d.data || [])
        .filter(e => e.eta)
        .map(e => ({ ts: new Date(e.eta).getTime(), type: 'ctb' }))
        .filter(e => e.ts > now - 30000)
        .sort((a, b) => a.ts - b.ts)
        .slice(0, 3);
      return { etasWithType: etas, companyType: 'ctb' };
    };

    if (favType === 'ctb') return loadCtb();
    if (favType === 'joint') {
      const [kmbRes, ctbRes] = await Promise.allSettled([loadKmbLike(), loadCtb()]);
      const kmbEtas = kmbRes.status === 'fulfilled' ? kmbRes.value.etasWithType : [];
      const ctbEtas = ctbRes.status === 'fulfilled' ? ctbRes.value.etasWithType : [];
      const merged = [...kmbEtas, ...ctbEtas]
        .filter(e => e.ts > now - 30000)
        .sort((a, b) => a.ts - b.ts)
        .slice(0, 3);
      const hasKmbLike = merged.some(e => e.type === 'kmb' || e.type === 'lwb');
      const hasCtb = merged.some(e => e.type === 'ctb');
      const companyType = hasKmbLike && hasCtb ? 'joint' : hasCtb ? 'ctb' : 'kmb';
      return { etasWithType: merged, companyType };
    }

    // 舊資料可能沒有 type：並行探測 KMB/CTB，避免誤判導致城巴永遠空白
    if (!isKnownType) {
      const [kmbRes, ctbRes] = await Promise.allSettled([loadKmbLike(), loadCtb()]);
      const kmbEtas = kmbRes.status === 'fulfilled' ? kmbRes.value.etasWithType : [];
      const ctbEtas = ctbRes.status === 'fulfilled' ? ctbRes.value.etasWithType : [];
      const merged = [...kmbEtas, ...ctbEtas]
        .filter(e => e.ts > now - 30000)
        .sort((a, b) => a.ts - b.ts)
        .slice(0, 3);
      if (!merged.length) return { etasWithType: [], companyType: 'kmb' };
      const hasKmbLike = merged.some(e => e.type === 'kmb' || e.type === 'lwb');
      const hasCtb = merged.some(e => e.type === 'ctb');
      const companyType = hasKmbLike && hasCtb ? 'joint' : hasCtb ? 'ctb' : 'kmb';
      return { etasWithType: merged, companyType };
    }

    return loadKmbLike();
  }, []);

  const _refreshFavs = useCallback(async () => {
    const favList = loadFavs(activePid);
    if (!favList.length) { setFavRows([]); return; }
    const now = Date.now();
    const results = await Promise.all(favList.map(async fav => {
      try {
        const { etasWithType, companyType } = await fetchFavEtas(fav, now);
        return { ...fav, etasWithType, companyType, fare: null };
      } catch {
        return { ...fav, etasWithType: [], companyType: fav.type || 'kmb', fare: null };
      }
    }));
    setFavRows(results);
    // 車費背景更新
    results.forEach(async (r, i) => {
      if (r.companyType !== 'kmb' && r.companyType !== 'joint') return;
      const fare = await fetchKMBFare(r.route, 'O', r.serviceType).catch(() => null);
      if (fare != null) setFavRows(prev => prev.map((row, j) => j === i ? { ...row, fare } : row));
    });
  }, [activePid, fetchFavEtas]);

  const removeFav = useCallback((idx) => {
    const favList = loadFavs(activePid);
    if (!confirm(`確定移除「${favList[idx]?.route} 往 ${favList[idx]?.dest}」？`)) return;
    favList.splice(idx, 1);
    saveFavs(activePid, favList);
    setFavRows(prev => prev.filter((_, i) => i !== idx));
  }, [activePid]);

  // ── Refresh ───────────────────────────────────────────────
  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([
      loadWeather(),
      isNearby && gpsCoords
        ? nearbyHook.load(gpsCoords.lat, gpsCoords.lng, nearbyDist)
        : _refreshFavs(),
    ]);
    setRefreshing(false);
  };

  // ── Profile switch ────────────────────────────────────────
  const switchToNearby = () => {
    setActivePid(NEARBY_PID);
    if (gpsCoords) nearbyHook.load(gpsCoords.lat, gpsCoords.lng, nearbyDist);
    else {
      checkPermission().then(state => {
        if (state === 'granted') doLocate();
        else nearbyHook.setStatus('no-permission');
      });
    }
  };

  const switchProfile = (pid) => {
    setActivePid(pid);
    reloadFavs(pid);
    setTimeout(() => _refreshFavs(), 0);
  };

  // ── 開啟路線詳情（附帶完整 row 資料）────────────────────
  const openRouteDetail = useCallback((row) => {
    incrementRouteUsage(row.route, row.companyType);
    openDrawer(`${row.route} 路線詳情`, 'bus-detail', row);
  }, [openDrawer]);

  // ── Nearby content ────────────────────────────────────────
  const renderNearbyContent = () => {
    switch (nearbyHook.status) {
      case 'loading': return <Spinner />;
      case 'no-permission': return (
        <div className="msg" style={{ padding: '30px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
          <div style={{ fontSize: 15, color: 'var(--bright)', marginBottom: 8 }}>需要位置權限</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>為搜尋附近班次，需要使用你的位置。</div>
          <button
            onClick={() => { nearbyHook.setStatus('loading'); doLocate(); }}
            style={{ background: 'var(--blu)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            📡 允許位置使用
          </button>
        </div>
      );
      case 'error': return <div className="msg">{nearbyHook.errorMsg}</div>;
      case 'ready':
        if (!nearbyHook.rows.length) return (
          <div className="empty-state">
            <div className="empty-icon">⏱</div>
            <div className="empty-text">附近暫無班次</div>
            <div className="empty-sub">{nearbyDist}米範圍內沒有找到班次</div>
          </div>
        );
        return nearbyHook.rows.map((row, i) => (
          <BusCard key={`${row.route}_${row.stopId}_${i}`} row={row} idx={i}
            onClick={row.companyType !== 'mtr' ? () => openRouteDetail(row) : undefined}
          />
        ));
      default: return <Spinner />;
    }
  };

  const isStdDist = STD_DISTS.includes(nearbyDist);

  return (
    <div className="page active" id="page-home">
      {/* 天氣面板 */}
      <WeatherPanel
        weatherData={weatherData}
        selectedStn={selectedStn}
        refreshing={refreshing}
        onRefresh={doRefresh}
        onOpenDetails={() => openDrawer('天氣詳情', 'weather-details')}
      />

      {/* Profiles bar */}
      <div className="profiles-bar">
        <button
          className={`profile-tab nearby-tab${isNearby ? ' active' : ''}`}
          onClick={switchToNearby}>
          📍 附近
        </button>
        {profiles.map(p => (
          <button key={p.id}
            className={`profile-tab${p.id === activePid ? ' active' : ''}`}
            onClick={() => switchProfile(p.id)}>
            {p.name}
          </button>
        ))}
        <button className="add-profile-btn" onClick={() => openDrawer('新增版面', 'add-profile')}>＋</button>
      </div>

      {/* 巴士區域 */}
      <div className="bus-sec">
        <div className="bus-hdr">
          <div className="bus-hdr-lbl">
            {isNearby ? `${nearbyDist}米內到站時間` : '到站時間'}
          </div>
          {isNearby && (
            <button className={`map-toggle-btn${mapView ? ' active' : ''}`} onClick={() => setMapView(v => !v)}>
              {mapView ? '📋 列表' : '🗺 地圖'}
            </button>
          )}
          {!isNearby && (
            <button className="add-btn" onClick={() => { setAddRouteTargetPid(activePid); setActivePage('search'); }}>
              ＋ 加路線
            </button>
          )}
        </div>

        {isNearby && (
          <div className="dist-row">
            <span className="dist-lbl">距離：</span>
            {STD_DISTS.map(m => (
              <button key={m} className={`dist-pill${nearbyDist === m ? ' active' : ''}`}
                onClick={() => setNearbyDist(m)}>
                {distLabel(m)}
              </button>
            ))}
            <button className={`dist-pill${!isStdDist ? ' active' : ''}`}
              onClick={() => {
                const cur = DIST_STEPS.reduce((b, v, i) =>
                  Math.abs(v - nearbyDist) < Math.abs(DIST_STEPS[b] - nearbyDist) ? i : b, 0);
                setSliderIdx(cur); setShowSlider(true);
              }}>
              {isStdDist ? '自訂' : distLabel(nearbyDist)}
            </button>
          </div>
        )}

        <div className="bus-list" style={{ display: mapView ? 'none' : undefined }}>
          {isNearby ? renderNearbyContent() : (
            favRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🚌</div>
                <div className="empty-text">未有路線</div>
                <div className="empty-sub">點擊「加路線」搜尋巴士班次</div>
              </div>
            ) : favRows.map((row, i) => (
              <BusCard key={`${row.route}_${row.stopId}_${i}`} row={row} idx={i}
                onRemove={removeFav}
                onClick={() => openRouteDetail(row)}
              />
            ))
          )}
        </div>

        {isNearby && mapView && (
          <div ref={mapElRef} id="nearby-map" style={{ flex: 1, minHeight: 0, position: 'relative' }} />
        )}
      </div>

      {/* 自訂距離 slider */}
      {showSlider && (
        <div style={{ position: 'fixed', bottom: 'calc(var(--nav-h) + 8px)', left: 0, right: 0, zIndex: 40, display: 'flex', justifyContent: 'center', padding: '0 12px' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr2)', borderRadius: 14, padding: '14px 16px 12px', width: '100%', maxWidth: 480, boxShadow: '0 6px 28px rgba(0,0,0,.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--mid)' }}>自訂距離</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--amb2)' }}>{distLabel(DIST_STEPS[sliderIdx])}</span>
            </div>
            <input type="range" min={0} max={DIST_STEPS.length - 1} step={1} value={sliderIdx}
              onChange={e => setSliderIdx(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--amb)', height: 4, cursor: 'pointer', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSlider(false)}
                style={{ background: 'var(--bg3)', border: '1px solid var(--bdr2)', color: 'var(--mid)', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={() => { setNearbyDist(DIST_STEPS[sliderIdx]); setShowSlider(false); }}
                style={{ background: 'var(--amb)', color: '#000', border: 'none', borderRadius: 8, padding: '7px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
