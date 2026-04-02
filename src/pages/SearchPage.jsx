import { useState } from 'react';
import { KMB, CTB } from '../constants/transport.js';
import { Spinner } from '../components/Overlay.jsx';

// 公司標籤樣式
const CO_STYLE = {
  kmb: { bg: 'rgba(240,165,0,.13)', color: 'var(--amb2)', border: 'rgba(240,165,0,.28)' },
  ctb: { bg: 'rgba(46,213,115,.10)', color: '#2ed573',    border: 'rgba(46,213,115,.25)' },
};

export default function SearchPage({ isActive, transportSettings }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null=idle
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLoading(true); setResults(null);

    try {
      // ── KMB（永遠搜）────────────────────────────────
      const kmbData = await fetch(`${KMB}/route/`).then(r => r.json());
      const kmbMatches = (kmbData.data || [])
        .filter(r =>
          r.route === q || r.route.startsWith(q) ||
          r.dest_tc?.includes(query) || r.orig_tc?.includes(query)
        )
        .map(r => ({ ...r, co: 'kmb' }));

      // ── CTB（按設定）────────────────────────────────
      let ctbMatches = [];
      if (transportSettings?.ctb) {
        try {
          const ctbData = await fetch(`${CTB}/route/CTB`).then(r => r.json());
          ctbMatches = (ctbData.data || [])
            .filter(r =>
              r.route === q || r.route.startsWith(q) ||
              r.dest_tc?.includes(query) || r.orig_tc?.includes(query)
            )
            .map(r => ({ ...r, co: 'ctb' }));
        } catch { /* CTB 搜尋失敗不影響 KMB 結果 */ }
      }

      // ── 合併：同路線號先 KMB 後 CTB，其餘按路線號排序 ──
      const combined = [...kmbMatches, ...ctbMatches];
      combined.sort((a, b) => {
        // 數字部分優先排序
        const aNum = parseInt(a.route) || 0;
        const bNum = parseInt(b.route) || 0;
        if (aNum !== bNum) return aNum - bNum;
        return a.route.localeCompare(b.route);
      });

      setResults(combined);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const ctbEnabled = transportSettings?.ctb;

  return (
    <div className="page" id="page-search" style={isActive ? { display: 'flex' } : {}}>
      {/* 搜尋欄 */}
      <div style={{ flexShrink: 0, padding: '12px 12px 8px', background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="d-input"
            value={query}
            placeholder="路線號碼 / 起終點站（如 40X、荃灣）"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            style={{ fontFamily: 'var(--sans)' }}
          />
          <button className="d-btn" onClick={doSearch}>搜尋</button>
        </div>
        {/* 顯示目前搜尋範圍 */}
        <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 6, fontFamily: 'var(--mono)' }}>
          搜尋範圍：九巴 KMB{ctbEnabled ? ' · 城巴 CTB' : ''}
          {!ctbEnabled && (
            <span style={{ color: 'rgba(46,213,115,.5)', marginLeft: 6 }}>
              （可在設定 › 交通服務開啟城巴）
            </span>
          )}
        </div>
      </div>

      {/* 結果列表 */}
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
              <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 6, lineHeight: 1.8 }}>
                支援：路線號碼（40X）、中文地名（荃灣）
              </div>
            </div>
          ) : (
            <>
              <div className="sec-lbl">找到 {results.length} 個結果</div>
              {results.map((r, i) => {
                const co = r.co || 'kmb';
                const cs = CO_STYLE[co] || CO_STYLE.kmb;
                return (
                  <div key={i} className="result-item">
                    {/* 公司標籤 */}
                    <div style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                      background: cs.bg, color: cs.color,
                      border: `1px solid ${cs.border}`,
                      flexShrink: 0, alignSelf: 'center',
                      fontFamily: 'var(--mono)', letterSpacing: '.02em',
                    }}>
                      {co.toUpperCase()}
                    </div>
                    <div className="rn">{r.route}</div>
                    <div className="ri">
                      <div className="ri-dest">往 {r.dest_tc}</div>
                      <div className="ri-orig">由 {r.orig_tc}</div>
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
