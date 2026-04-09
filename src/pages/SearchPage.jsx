import { useState } from 'react';
import { KMB, CTB } from '../constants/transport.js';
import { Spinner } from '../components/Overlay.jsx';
import { useApp } from '../context/AppContext.jsx';

// 營辦商色彩（與 RoutePage / BusCard 一致）
const CO_COL  = { kmb: '#D85A30', ctb: '#0F6E56', joint: '#D85A30' };
const CO_BG   = { kmb: 'rgba(216,90,48,.1)', ctb: 'rgba(29,158,117,.1)', joint: 'rgba(216,90,48,.1)' };
const CO_LBL  = { kmb: '九巴', ctb: '城巴', joint: '九巴+城巴' };

export default function SearchPage({ isActive, openDrawer }) {
  const { addRouteTargetPid } = useApp();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLoading(true); setResults(null);
    try {
      // 同時搜尋 KMB + CTB
      const [kmbData, ctbData] = await Promise.allSettled([
        fetch(`${KMB}/route/`).then(r => r.json()),
        fetch(`${CTB}/route/CTB/`).then(r => r.json()),
      ]);

      const kmbRoutes = (kmbData.status === 'fulfilled' ? kmbData.value.data || [] : [])
        .filter(r =>
          r.route === q || r.route.startsWith(q) ||
          r.dest_tc?.includes(query) || r.orig_tc?.includes(query)
        )
        .map(r => ({ ...r, _co: 'kmb' }));

      const ctbRoutes = (ctbData.status === 'fulfilled' ? ctbData.value.data || [] : [])
        .filter(r =>
          r.route === q || r.route.startsWith(q) ||
          r.dest_tc?.includes(query) || r.orig_tc?.includes(query)
        )
        .map(r => ({ ...r, _co: 'ctb' }));

      // 合拼：KMB+CTB 同路線號標示為 joint
      const kmbSet = new Set(kmbRoutes.map(r => r.route));
      const ctbSet = new Set(ctbRoutes.map(r => r.route));
      const marked = [
        ...kmbRoutes.map(r => ({ ...r, _co: ctbSet.has(r.route) ? 'joint' : 'kmb' })),
        ...ctbRoutes.filter(r => !kmbSet.has(r.route)),
      ];

      // 排序：完全符合優先，再按字母
      marked.sort((a, b) => {
        const aExact = a.route === q ? 0 : 1;
        const bExact = b.route === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.route.localeCompare(b.route);
      });

      setResults(marked);
    } catch { setResults([]); }
    setLoading(false);
  };

  // 點擊路線 → 開路線詳情 drawer
  const openRoute = (r) => {
    if (!openDrawer) return;
    const dir = r.bound || r.direction || 'O';  // KMB 用 bound，CTB 用 direction
    const row = {
      route:       r.route,
      dest:        r.dest_tc || '',
      companyType: r._co || 'kmb',
      dir:         dir === 'I' || dir === 'inbound' ? 'I' : 'O',
      serviceType: r.service_type || '1',
      stopId:      null,   // 搜尋不帶特定站，不高亮
      targetPid:   addRouteTargetPid || null,
      fare:        null,
    };
    openDrawer(`${r.route} 路線詳情`, 'bus-detail', row);
  };

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
                const co    = r._co || 'kmb';
                const col   = CO_COL[co]  || CO_COL.kmb;
                const bg    = CO_BG[co]   || CO_BG.kmb;
                const colbl = CO_LBL[co]  || '九巴';
                const rfs   = r.route.length <= 3 ? '18px' : r.route.length <= 4 ? '15px' : '12px';
                return (
                  <div
                    key={i}
                    onClick={() => openRoute(r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      background: 'var(--bg2)',
                      border: '1px solid var(--bdr)',
                      borderRadius: 12,
                      marginBottom: 6,
                      cursor: 'pointer',
                      transition: 'background .12s',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    onTouchStart={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onTouchEnd={e => { e.currentTarget.style.background = 'var(--bg2)'; openRoute(r); }}
                  >
                    {/* 路線 badge */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: bg, border: `1px solid ${col}33`,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 1,
                    }}>
                      <span style={{ fontSize: rfs, fontWeight: 700, color: col, lineHeight: 1 }}>
                        {r.route}
                      </span>
                      <span style={{ fontSize: 8, color: col, opacity: .7 }}>{colbl}</span>
                    </div>

                    {/* 路線資訊 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: 'var(--bright)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        往 {r.dest_tc}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                        由 {r.orig_tc}
                      </div>
                    </div>

                    {/* 箭頭 */}
                    <div style={{ color: 'var(--dim)', fontSize: 18, flexShrink: 0 }}>›</div>
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
