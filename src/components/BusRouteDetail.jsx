import { useState, useEffect, useCallback } from 'react';
import { useApp, loadFavs, saveFavs } from '../context/AppContext.jsx';
import { KMB, CTB, MTR_API, MTR_LINE_STATIONS } from '../constants/transport.js';
import { Spinner } from './Overlay.jsx';
import { fetchKMBFare } from '../utils/fare.js';

const CO_LABEL = {
  kmb: '九巴', lwb: '龍運', ctb: '城巴', joint: '聯營',
  mtr: '港鐵', lrt: '輕鐵', nlb: '嶼巴',
};
const CO_COLOR = {
  kmb: '#e60012', lwb: '#b5822a', ctb: '#00a03e', joint: '#c00',
  mtr: '#e60012', lrt: '#e60012', nlb: '#f39800',
};

function minsLabel(etaStr) {
  if (!etaStr) return null;
  const diff = Math.round((new Date(etaStr) - Date.now()) / 60000);
  if (diff < -1) return null;
  if (diff <= 0) return '即將';
  return `${diff}分`;
}

// 去除 CTB 站名末尾的站點代碼，如 "荔灣道 (SS450)" → "荔灣道"
function cleanName(name) {
  return (name || '').replace(/\s*\([A-Z]{1,2}\d+\)\s*$/, '').trim();
}

// 分批發請求，避免一次性 80 個並行請求觸發瀏覽器限制
async function fetchBatch(items, fetchFn, batchSize = 12) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const res = await Promise.all(batch.map(item => fetchFn(item).catch(() => null)));
    results.push(...res);
  }
  return results;
}

export default function BusRouteDetail({ data, showToast }) {
  const { activePid } = useApp();
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fare, setFare] = useState(null);
  const [favSet, setFavSet] = useState(() =>
    new Set(loadFavs(activePid).map(f => `${f.route}|${f.stopId}`))
  );

  if (!data) return <div className="msg">路線資料缺失</div>;
  const { co, route, bound, service_type, orig_tc, dest_tc, stops_tc } = data;

  const isKMB = co === 'kmb' || co === 'joint' || co === 'lwb';
  const isCTB = co === 'ctb';
  const isMTR = co === 'mtr';
  const isLRT = co === 'lrt';
  const dir = bound === 'O' ? 'outbound' : 'inbound';
  const svcType = service_type || '1';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ── MTR：靜態站點 + 官方下班車 API（分批）───────────
      if (isMTR) {
        const stns = MTR_LINE_STATIONS[route] || [];
        const ordered = bound === 'I' ? [...stns].reverse() : stns;
        const mtrDir = bound === 'I' ? 'DOWN' : 'UP';
        const schedResults = await fetchBatch(
          ordered,
          s => fetch(`${MTR_API}?line=${route}&sta=${s.c}&lang=TC`).then(r => r.json()),
          8
        );
        const now = Date.now();
        setStops(ordered.map((s, i) => {
          const key = `${route}-${s.c}`;
          const trains = schedResults[i]?.data?.[key]?.[mtrDir] || [];
          const eta = trains
            .map(t => {
              const ts = new Date((t.time || '').replace(' ', 'T')).getTime();
              return ts > now - 30000 ? (t.time || '').slice(11, 16) : null;
            })
            .filter(Boolean)
            .slice(0, 2);
          return { seq: i + 1, id: s.c, name: s.n, eta, isMtrTime: true };
        }));
        setLoading(false);
        return;
      }

      // ── LRT：stops_tc 列表（LRT ETA 需要站點 ID，暫無）──
      if (isLRT) {
        setStops((stops_tc || []).map((n, i) => ({
          seq: i + 1, id: String(i), name: n, eta: [],
        })));
        setLoading(false);
        return;
      }

      // ── KMB / CTB：API 抓站點 + ETA（分批，避免限速）────
      const rsUrl = isKMB
        ? `${KMB}/route-stop/${route}/${dir}/${svcType}`
        : `${CTB}/route-stop/CTB/${route}/${dir}`;

      const rsData = await fetch(rsUrl).then(r => r.json());
      const stopList = (rsData.data || []).map(s => ({ seq: parseInt(s.seq), id: s.stop }));
      if (!stopList.length) { setStops([]); setLoading(false); return; }

      // 分批抓站點名稱
      const detailRes = await fetchBatch(
        stopList,
        s => fetch(isKMB ? `${KMB}/stop/${s.id}` : `${CTB}/stop/${s.id}`).then(r => r.json()),
        12
      );

      // 分批抓 ETA
      const etaRes = await fetchBatch(
        stopList,
        s => fetch(isKMB
          ? `${KMB}/eta/${s.id}/${route}/${svcType}`
          : `${CTB}/eta/${s.id}/CTB/${route}`
        ).then(r => r.json()),
        12
      );

      const now = Date.now();
      setStops(stopList.map((s, i) => {
        const d = detailRes[i]?.data;
        const rawName = d?.name_tc || d?.name_en || s.id;
        const name = cleanName(rawName);
        const eta = (etaRes[i]?.data || [])
          .filter(e => e.eta && new Date(e.eta).getTime() > now - 30000)
          .slice(0, 2)
          .map(e => e.eta);
        return { seq: s.seq, id: s.id, name, eta };
      }));

      // KMB / 聯營：背景抓車費
      if (isKMB) {
        fetchKMBFare(route, bound, svcType)
          .then(f => { if (f != null) setFare(f); })
          .catch(() => {});
      }
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
      {/* ── 路線資訊 header ───────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '10px 12px', background: 'var(--bg3)',
        border: '1px solid var(--bdr)', borderRadius: 11,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
          background: CO_COLOR[co] || '#666', color: '#fff', flexShrink: 0,
        }}>{CO_LABEL[co] || co.toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--bright)', fontWeight: 600 }}>
            往 {dest_tc}
          </div>
          {orig_tc && (
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>
              由 {orig_tc}
            </div>
          )}
        </div>
        {fare != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--amb2)', fontWeight: 700 }}>${fare}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)' }}>成人票價</div>
          </div>
        )}
      </div>

      {/* ── 站點列表 ─────────────────────────────────────── */}
      {stops.map((stop, i) => {
        const isFav = favSet.has(`${route}|${stop.id}`);
        const etaLabels = stop.isMtrTime
          ? stop.eta
          : stop.eta.map(minsLabel).filter(Boolean);
        const hasEta = etaLabels.length > 0;
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
                background: hasEta ? 'var(--amb)' : 'var(--bg4)',
                border: '2px solid var(--bdr2)',
              }} />
            </div>

            {/* 站名 + ETA */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--bright)', fontWeight: 500 }}>
                {stop.name}
              </div>
              {hasEta && (
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
            <div style={{
              fontSize: 11, color: 'var(--dim)', fontFamily: 'var(--mono)',
              width: 18, textAlign: 'right', flexShrink: 0,
            }}>
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
