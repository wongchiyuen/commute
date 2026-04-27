import { useState } from 'react';
import { KMB, CTB } from '../constants/transport.js';
import { useApp, loadFavs, saveFavs, NEARBY_PID } from '../context/AppContext.jsx';
import { Spinner } from '../components/Overlay.jsx';

export default function SearchPage({ isActive }) {
  const { activePid, profiles, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stops, setStops] = useState(null);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [targetPid, setTargetPid] = useState(() =>
    activePid !== NEARBY_PID ? activePid : null
  );

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLoading(true); setResults(null); setSelectedRoute(null); setStops(null);
    try {
      const [kmbData, ctbData] = await Promise.all([
        fetch(`${KMB}/route/`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${CTB}/route/CTB`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      const LWB_PREFIX = /^(A|B|E|R)\d|^N(11|21|29|30|31|35|42)/;
      const kmbMatches = (kmbData.data || [])
        .filter(r => r.route === q || r.route.startsWith(q) || r.dest_tc?.includes(query) || r.orig_tc?.includes(query))
        .map(r => ({ ...r, co: LWB_PREFIX.test(r.route) ? 'lwb' : 'kmb' }));
      const ctbMatches = (ctbData.data || [])
        .filter(r => r.route === q || r.route.startsWith(q) || r.dest_tc?.includes(query) || r.orig_tc?.includes(query))
        .map(r => ({ ...r, co: 'ctb' }));
      setResults([...kmbMatches, ...ctbMatches]);
    } catch { setResults([]); }
    setLoading(false);
  };

  const selectRoute = async (r) => {
    setSelectedRoute(r); setStopsLoading(true); setStops(null);
    try {
      const bound = r.bound === 'O' ? 'outbound' : 'inbound';
      if (r.co === 'ctb') {
        const d = await fetch(`${CTB}/route-stop/CTB/${r.route}/${bound}`).then(x => x.json());
        const stopIds = (d.data || []).map(s => s.stop);
        const details = await Promise.all(
          stopIds.slice(0, 25).map(id => fetch(`${CTB}/stop/${id}`).then(x => x.json()).catch(() => null))
        );
        setStops(details.filter(s => s?.data).map((s, i) => ({ ...s.data, seq: i + 1 })));
      } else {
        const d = await fetch(`${KMB}/route-stop/${r.route}/${bound}/${r.service_type}`).then(x => x.json());
        const stopIds = (d.data || []).map(s => s.stop);
        const details = await Promise.all(
          stopIds.slice(0, 25).map(id => fetch(`${KMB}/stop/${id}`).then(x => x.json()).catch(() => null))
        );
        setStops(details.filter(s => s?.data).map((s, i) => ({ ...s.data, seq: i + 1 })));
      }
    } catch { setStops([]); }
    setStopsLoading(false);
  };
  
  const addStop = (stop) => {
    const needPicker = activePid === NEARBY_PID;
    const pid = needPicker ? targetPid : activePid;
    if (!pid) { showToast('請先選擇要加入的版面'); return; }
    const favList = loadFavs(pid);
    if (favList.some(f => f.stopId === stop.stop && f.route === selectedRoute.route)) {
      showToast('⚠️ 此站已加入'); return;
    }
    favList.push({
      route: selectedRoute.route,
      dest: selectedRoute.dest_tc,
      stopId: stop.stop,
      stopName: stop.name_tc,
      serviceType: selectedRoute.service_type || '1',
      type: selectedRoute.co,
    });
    saveFavs(pid, favList);
    const profName = profiles.find(p => p.id === pid)?.name || pid;
    showToast(`✅ 已加入「${profName}」: ${selectedRoute.route} ${stop.name_tc}`);
  };

  // ── 站點選擇畫面 ──────────────────────────────────────
  if (selectedRoute) {
    return (
      <div className="page" id="page-search" style={isActive ? { display: 'flex' } : {}}>
        <div style={{ flexShrink: 0, padding: '12px 12px 10px', background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)' }}>
          <button onClick={() => { setSelectedRoute(null); setStops(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--amb2)', fontSize: 13, cursor: 'pointer', padding: '0 0 8px', fontFamily: 'var(--sans)' }}>
            ← 返回結果
          </button>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)' }}>
            {selectedRoute.route} 往 {selectedRoute.dest_tc}
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>由 {selectedRoute.orig_tc} — 選擇站點加入</div>
          {profiles.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--mid)' }}>加入版面：</span>
              {profiles.map(p => (
                <button key={p.id} onClick={() => setTargetPid(p.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--sans)',
                    background: targetPid === p.id ? 'var(--amb-bg)' : 'var(--bg3)',
                    border: `1px solid ${targetPid === p.id ? 'var(--amb-bdr)' : 'var(--bdr2)'}`,
                    color: targetPid === p.id ? 'var(--amb2)' : 'var(--mid)',
                  }}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', scrollbarWidth: 'thin' }}>
          {stopsLoading ? <Spinner /> : (
            !stops || stops.length === 0
              ? <div style={{ textAlign: 'center', padding: '30px', color: 'var(--mid)' }}>找不到站點</div>
              : stops.map((stop, i) => (
                <div key={i} onClick={() => addStop(stop)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 10, marginBottom: 6, cursor: 'pointer' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--amb-bg)',
                    border: '1px solid var(--amb-bdr)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 10, color: 'var(--amb2)', fontWeight: 700, flexShrink: 0 }}>
                    {stop.seq}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--txt)' }}>{stop.name_tc}</div>
                  <div style={{ fontSize: 18, color: 'var(--amb2)', fontWeight: 300 }}>＋</div>
                </div>
              ))
          )}
        </div>
      </div>
    );
  }

  // ── 搜尋畫面 ──────────────────────────────────────────
  return (
    <div className="page" id="page-search" style={isActive ? { display: 'flex' } : {}}>
      <div style={{ flexShrink: 0, padding: '12px 12px 8px', background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="d-input" value={query} placeholder="路線號碼 / 起終點站（如 40X、荃灣）"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            style={{ fontFamily: 'var(--sans)' }}
          />
          <button className="d-btn" onClick={doSearch}>搜尋</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', scrollbarWidth: 'thin' }}>
        {!results && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mid)' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: .3 }}>🔍</div>
            <div style={{ fontSize: 14 }}>輸入路線號碼或地名搜尋</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 5 }}>如 40X、1A、荃灣、尖沙咀</div>
          </div>
        )}
        {loading && <Spinner />}
        {results !== null && !loading && (
          results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--mid)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--bright)' }}>找不到「{query}」</div>
              <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 6, lineHeight: 1.8 }}>支援：路線號碼（40X）、中文地名（荃灣）</div>
            </div>
          ) : (
            <>
              <div className="sec-lbl">找到 {results.length} 個結果</div>
              {results.map((r, i) => (
                <div key={i} className="result-item" onClick={() => selectRoute(r)} style={{ cursor: 'pointer' }}>
                  <div className="rn">{r.route}</div>
                  <div className="ri">
                    <div className="ri-dest">往 {r.dest_tc}</div>
                    <div className="ri-orig">由 {r.orig_tc}</div>
                  </div>
                  <div style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 600,
                    color: r.co === 'ctb' ? '#2ed573' : r.co === 'lwb' ? '#00c896' : 'var(--amb2)',
                    background: r.co === 'ctb' ? 'rgba(46,213,115,.1)' : r.co === 'lwb' ? 'rgba(0,168,132,.1)' : 'var(--amb-bg)',
                    border: `1px solid ${r.co === 'ctb' ? 'rgba(46,213,115,.3)' : r.co === 'lwb' ? 'rgba(0,168,132,.3)' : 'var(--amb-bdr)'}`,
                    alignSelf: 'center', flexShrink: 0 }}>
                    {r.co === 'ctb' ? '城巴' : r.co === 'lwb' ? '龍運' : '九巴'}
                  </div>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </div>
  );
}
