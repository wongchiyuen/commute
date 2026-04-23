import { useState } from 'react';
import { KMB, CTB, MTR_LINE, MTR_LINE_STATIONS, MTR_DIR_LABELS } from '../constants/transport.js';
import { LRT_ROUTES_DATA } from '../constants/lrt.js';
import { Spinner } from '../components/Overlay.jsx';

const MTR_ROUTES = Object.entries(MTR_LINE).map(([code, name]) => ({
  co: 'mtr', route: code,
  dest_tc: MTR_DIR_LABELS[code]?.[0] || '',
  orig_tc: MTR_DIR_LABELS[code]?.[1] || '',
  name_tc: name,
  stationNames: (MTR_LINE_STATIONS[code] || []).map(s => s.n),
}));

const LRT_ROUTES = Object.entries(LRT_ROUTES_DATA).map(([routeNo, data]) => ({
  co: 'lrt', route: routeNo,
  dest_tc: data.to, orig_tc: data.from,
  desc: data.desc,
  stops_tc: data.stops.map(s => s.n),
}));

export default function SearchPage({ isActive, openDrawer }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    const qOrig = query.trim();
    if (!q) return;
    setLoading(true); setResults(null);
    try {
      const [kmbData, ctbData] = await Promise.all([
        fetch(`${KMB}/route/`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${CTB}/route/CTB`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      const kmbMatches = (kmbData.data || [])
        .filter(r => r.route === q || r.route.startsWith(q) || r.dest_tc?.includes(qOrig) || r.orig_tc?.includes(qOrig))
        .map(r => ({ ...r, co: 'kmb' }));
      const ctbMatches = (ctbData.data || [])
        .filter(r => r.route === q || r.route.startsWith(q) || r.dest_tc?.includes(qOrig) || r.orig_tc?.includes(qOrig))
        .map(r => ({ ...r, co: 'ctb', bound: r.bound || 'O', service_type: '1' }));
      const mtrMatches = MTR_ROUTES.filter(r =>
        r.route === q || r.name_tc?.includes(qOrig) ||
        r.dest_tc?.includes(qOrig) || r.orig_tc?.includes(qOrig) ||
        r.stationNames.some(n => n.includes(qOrig))
      );
      const lrtMatches = LRT_ROUTES.filter(r =>
        r.route === q || r.route.startsWith(q) || r.desc?.includes(qOrig) ||
        r.dest_tc?.includes(qOrig) || r.orig_tc?.includes(qOrig) ||
        r.stops_tc.some(n => n.includes(qOrig))
      );
      setResults([...kmbMatches, ...ctbMatches, ...mtrMatches, ...lrtMatches]);
    } catch { setResults([]); }
    setLoading(false);
  };

  const openDetail = (r) => {
    if (!openDrawer) return;
    openDrawer(
      `${r.co === 'mtr' ? (MTR_LINE[r.route] || r.route) : r.route} 路線詳情`,
      'bus-detail',
      { co: r.co, route: r.route, bound: r.bound || 'O', service_type: r.service_type || '1', dest_tc: r.dest_tc, stops_tc: r.stops_tc }
    );
  };

  const coLabel = (co) => {
    if (co === 'mtr') return { text: '港鐵', color: '#c00' };
    if (co === 'lrt') return { text: '輕鐵', color: '#7d5a8a' };
    if (co === 'ctb') return { text: '城巴', color: '#2a7de1' };
    return { text: '九巴', color: '#f5a623' };
  };

  return (
    <div className="page" id="page-search" style={isActive ? { display: 'flex' } : {}}>
      <div style={{ flexShrink: 0, padding: '12px 12px 8px', background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="d-input" value={query} placeholder="路線號碼 / 地名 / 港鐵站"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            style={{ fontFamily: 'var(--sans)' }} />
          <button className="d-btn" onClick={doSearch}>搜尋</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', scrollbarWidth: 'thin' }}>
        {!results && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mid)' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: .3 }}>🔍</div>
            <div style={{ fontSize: 14 }}>輸入路線號碼或地名搜尋</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 5, lineHeight: 1.8 }}>
              巴士：40X、1A、荃灣<br />
              港鐵：荃灣綫、TWL、旺角<br />
              輕鐵：507、屯門
            </div>
          </div>
        )}
        {loading && <Spinner />}
        {results !== null && !loading && (
          results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--mid)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--bright)' }}>找不到「{query}」</div>
              <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 6, lineHeight: 1.8 }}>支援：路線號碼、中文地名、港鐵站名</div>
            </div>
          ) : (
            <>
              <div className="sec-lbl">找到 {results.length} 個結果</div>
              {results.map((r, i) => {
                const lbl = coLabel(r.co);
                return (
                  <div key={i} className="result-item" onClick={() => openDetail(r)} style={{ cursor: 'pointer' }}>
                    <div className="rn" style={{ color: lbl.color, minWidth: 44 }}>
                      {r.co === 'mtr' ? MTR_LINE[r.route] || r.route : r.route}
                    </div>
                    <div className="ri">
                      <div className="ri-dest">往 {r.dest_tc}</div>
                      <div className="ri-orig" style={{ color: lbl.color, fontSize: 10, fontWeight: 600 }}>
                        {lbl.text} · 由 {r.orig_tc}
                      </div>
                    </div>
                    <div className="chev">›</div>
                  </div>
                );
              })}
            </>
          )
        )}
      </div>
    </div>
  );
}
