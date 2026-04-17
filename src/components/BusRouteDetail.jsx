import { useState, useEffect, useCallback } from 'react';
import { useApp, loadFavs, saveFavs } from '../context/AppContext.jsx';
import { KMB, CTB, MTR_LINE_STATIONS } from '../constants/transport.js';
import { Spinner } from './Overlay.jsx';

function minsLabel(etaStr) {
  if (!etaStr) return null;
  const diff = Math.round((new Date(etaStr) - Date.now()) / 60000);
  if (diff < -1) return null;
  if (diff <= 0) return '即將';
  return `${diff}分`;
}

export default function BusRouteDetail({ data, showToast }) {
  const { activePid } = useApp();
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favSet, setFavSet] = useState(() =>
    new Set(loadFavs(activePid).map(f => `${f.route}|${f.stopId}`))
  );

  if (!data) return <div className="msg">路線資料缺失</div>;
  const { co, route, bound, service_type, dest_tc, stops_tc } = data;

  const isKMB = co === 'kmb' || co === 'joint' || co === 'lwb';
  const isCTB = co === 'ctb';
  const isMTR = co === 'mtr';
  const isLRT = co === 'lrt';
  const dir = bound === 'O' ? 'outbound' : 'inbound';
  const svcType = service_type || '1';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ── MTR：靜態站點，不顯示 ETA ────────────────────────
      if (isMTR) {
        const stns = MTR_LINE_STATIONS[route] || [];
        const ordered = bound === 'I' ? [...stns].reverse() : stns;
        setStops(ordered.map((s, i) => ({ seq: i + 1, id: s.c, name: s.n, eta: [] })));
        setLoading(false);
        return;
      }

      // ── LRT：stops_tc 列表，不顯示 ETA ───────────────────
      if (isLRT) {
        (stops_tc || []).forEach((n, i) => setStops(prev => [...prev, { seq: i + 1, id: String(i), name: n, eta: [] }]));
        setStops((stops_tc || []).map((n, i) => ({ seq: i + 1, id: String(i), name: n, eta: [] })));
        setLoading(false);
        return;
      }

      // ── KMB / CTB：API 抓站點 + ETA ──────────────────────
      const rsUrl = isKMB
        ? `${KMB}/route-stop/${route}/${dir}/${svcType}`
        : `${CTB}/route-stop/CTB/${route}/${dir}`;

      const rsData = await fetch(rsUrl).then(r => r.json());
      const stopList = (rsData.data || []).map(s => ({ seq: parseInt(s.seq), id: s.stop }));
      if (!stopList.length) { setStops([]); setLoading(false); return; }

      // 並行抓站點資料 + ETA
      const [detailRes, etaRes] = await Promise.all([
        Promise.all(stopList.map(s =>
          fetch(isKMB ? `${KMB}/stop/${s.id}` : `${CTB}/stop/${s.id}`)
            .then(r => r.json()).catch(() => null)
        )),
        Promise.all(stopList.map(s =>
          fetch(isKMB
            ? `${KMB}/eta/${s.id}/${route}/${svcType}`
            : `${CTB}/eta/${s.id}/CTB/${route}`)
            .then(r => r.json()).catch(() => null)
        )),
      ]);

      const now = Date.now();
      setStops(stopList.map((s, i) => {
        const d = detailRes[i]?.data;
        const name = d?.name_tc || d?.name_en || s.id;
        const eta = (etaRes[i]?.data || [])
          .filter(e => e.eta && new Date(e.eta).getTime() > now - 30000)
          .slice(0, 2)
          .map(e => e.eta);
        return { seq: s.seq, id: s.id, name, eta };
      }));
    } catch (e) {
      console.warn('BusRouteDetail:', e);
      setStops([]);
    }
    setLoading(false);
  }, [route, co, bound, service_type]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const toggleFav = (stop) => {
    const favs = loadFavs(activePid);
    const key = `${route}|${stop.id}`;
    if (favSet.has(key)) {
      saveFavs(activePid, favs.filter(f => !(f.route === route && f.stopId === stop.id)));
      setFavSet(prev => { const s = new Set(prev); s.delete(key); return s; });
      showToast('已移除');
    } else {
      saveFavs(activePid, [...favs, {
        route, stopId: stop.id, stopName: stop.name,
        dest: dest_tc, serviceType: svcType, type: co,
      }]);
      setFavSet(prev => new Set([...prev, key]));
      showToast(`已加入 ${stop.name}`);
    }
  };

  if (loading) return <Spinner />;
  if (!stops.length) return <div className="msg">找不到站點資料</div>;

  return (
    <div>
      {stops.map((stop, i) => {
        const isFav = favSet.has(`${route}|${stop.id}`);
        const etaLabels = stop.eta.map(minsLabel).filter(Boolean);
        const isFirst = etaLabels[0];
        return (
          <div key={stop.id + i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0',
            borderBottom: i < stops.length - 1 ? '1px solid var(--bdr)' : 'none',
          }}>
            {/* 時間線圓點 */}
            <div style={{ width: 18, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: isFirst ? 'var(--amb)' : 'var(--bg4)',
                border: '2px solid var(--bdr2)',
              }} />
            </div>

            {/* 站名 + ETA */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--bright)', fontWeight: 500 }}>{stop.name}</div>
              {etaLabels.length > 0 && (
                <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                  {etaLabels.map((lbl, j) => (
                    <span key={j} style={{
                      fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
                      padding: '2px 7px', borderRadius: 6,
                      background: j === 0
                        ? (lbl === '即將' ? 'rgba(39,174,96,.15)' : 'var(--amb-bg)')
                        : 'var(--bg3)',
                      color: j === 0
                        ? (lbl === '即將' ? 'var(--grn)' : 'var(--amb2)')
                        : 'var(--mid)',
                    }}>{lbl}</span>
                  ))}
                </div>
              )}
            </div>

            {/* 序號 */}
            <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'var(--mono)', width: 18, textAlign: 'right', flexShrink: 0 }}>
              {stop.seq}
            </div>

            {/* +加入（只限 KMB/CTB） */}
            {(isKMB || isCTB) && (
              <button onClick={() => toggleFav(stop)} style={{
                fontSize: 11, fontWeight: 600, padding: '4px 9px',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--sans)', flexShrink: 0,
                border: `1px solid ${isFav ? 'rgba(255,71,87,.4)' : 'var(--amb-bdr)'}`,
                background: isFav ? 'rgba(255,71,87,.15)' : 'var(--amb-bg)',
                color: isFav ? '#ff8a96' : 'var(--amb2)',
              }}>{isFav ? '已加入' : '+加入'}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
