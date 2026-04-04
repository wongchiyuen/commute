import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp, loadFavs, saveFavs, NEARBY_PID } from '../context/AppContext.jsx';
import { useWeather } from '../hooks/useWeather.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { useNearby, incrementRouteUsage, fetchAllKMBStops } from '../hooks/useNearby.js';
import { KMB } from '../constants/transport.js';
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

  const { weatherData, loadWeather } = useWeather(selectedStn, gpsCoords);
  const { getCurrentPosition, checkPermission } = useGeolocation();
  const nearbyHook = useNearby(transportSettings);

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

  useEffect(() => {
    if (isNearby && gpsCoords) nearbyHook.load(gpsCoords.lat, gpsCoords.lng, nearbyDist);
  // eslint-disable-next-line
  }, [nearbyDist]);

  const _refreshFavs = useCallback(async () => {
    const favList = loadFavs(activePid);
    if (!favList.length) { setFavRows([]); return; }
    const now = Date.now();
    const results = await Promise.all(favList.map(async fav => {
      try {
        const d = await fetch(`${KMB}/eta/${fav.stopId}/${fav.route}/${fav.serviceType}`).then(r => r.json());
        const etas = (d.data || []).filter(e => e.eta)
          .slice(0, 3).map(e => new Date(e.eta).getTime()).filter(ts => ts > now - 30000);
        return { ...fav, etasWithType: etas.map(ts => ({ ts, type: fav.type || 'kmb' })), companyType: fav.type || 'kmb', fare: null };
      } catch {
        return { ...fav, etasWithType: [], companyType: fav.type || 'kmb', fare: null };
      }
    }));
    setFavRows(results);
    results.forEach(async (r, i) => {
      if (r.companyType !== 'kmb' && r.companyType !== 'joint') return;
      const fare = await fetchKMBFare(r.route, 'O', r.serviceType).catch(() => null);
      if (fare != null) setFavRows(prev => prev.map((row, j) => j === i ? { ...row, fare } : row));
    });
  }, [activePid]);

  const removeFav = useCallback((idx) => {
    const favList = loadFavs(activePid);
    if (!confirm(`確定移除「${favList[idx]?.route} 往 ${favList[idx]?.dest}」？`)) return;
    favList.splice(idx, 1);
    saveFavs(activePid, favList);
    setFavRows(prev => prev.filter((_, i) => i !== idx));
  }, [activePid]);

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

  const renderNearbyContent = () => {
    switch (nearbyHook.status) {
      case 'loading': return <Spinner />;
      case 'no-permission': return (
        <div className="msg" style={{ padding: '30px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
          <div style={{ fontSize: 15, color: 'var(--bright)', marginBottom: 8 }}>需要位置權限</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>為搜尋附近班次，需要使用你的位置。</div>
          <button onClick={() => { nearbyHook.setStatus('loading'); doLocate(); }}
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
            onClick={row.companyType !== 'mtr' ? () => {
              incrementRouteUsage(row.route, row.companyType);
              // ★ 修改：傳遞 row 資料供路線詳情 drawer 使用
              openDrawer(`${row.route} 路線詳情`, 'bus-detail', row);
            } : undefined}
          />
        ));
      default: return <Spinner />;
    }
  };

  const isStdDist = STD_DISTS.includes(nearbyDist);

  return (
    <div className="page active" id="page-home">
      <WeatherPanel
        weatherData={weatherData}
        selectedStn={selectedStn}
        refreshing={refreshing}
        onRefresh={doRefresh}
        onOpenDetails={() => openDrawer('天氣詳情', 'weather-details')}
      />

      <div className="profiles-bar">
        <button className={`profile-tab nearby-tab${isNearby ? ' active' : ''}`} onClick={switchToNearby}>
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
            <button className="add-btn" onClick={() => openDrawer('搜尋路線', 'search')}>＋ 加路線</button>
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
                onClick={() => {
                  incrementRouteUsage(row.route, row.companyType);
                  // ★ 修改：傳遞 row 資料供路線詳情 drawer 使用
                  openDrawer(`${row.route} 路線詳情`, 'bus-detail', row);
                }}
              />
            ))
          )}
        </div>

        {isNearby && mapView && (
          <div id="nearby-map" style={{ flex: 1, minHeight: 0, position: 'relative' }} />
        )}
      </div>

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
