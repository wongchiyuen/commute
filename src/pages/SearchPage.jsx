import { useState } from 'react';
import { Spinner } from '../components/Overlay.jsx';

export default function SearchPage({ isActive }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null=idle, []|[...]
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setResults(null);
    try {
      const data = await fetch('/routes.json').then(r => r.json());
      const qUp = q.toUpperCase();
      const seen = new Set();
      const matches = (data.routes || []).filter(r => {
        if (!(r.route === qUp || r.route.startsWith(qUp) ||
              r.dest_tc?.includes(q) || r.orig_tc?.includes(q) ||
              r.stops_tc?.some(s => s.includes(q)))) return false;
        const key = `${r.co}|${r.route}|${r.bound}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      setResults(matches);
    } catch { setResults([]); }
    setLoading(false);
  };

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
                <div key={i} className="result-item">
                  <div className="rn">{r.route}</div>
                  <div className="ri">
                    <div className="ri-dest">往 {r.dest_tc}</div>
                    <div className="ri-orig">由 {r.orig_tc}</div>
                  </div>
                  <div className="chev">›</div>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </div>
  );
}
