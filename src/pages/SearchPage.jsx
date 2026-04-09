import { useState, useMemo } from 'react';
import { KMB, CTB, MTR_LINE, MTR_STNS } from '../constants/transport.js';
import { LRT_STNS, LRT_ROUTES_DATA } from '../constants/lrt.js';
import { Spinner } from '../components/Overlay.jsx';
import { useApp } from '../context/AppContext.jsx';

// 營辦商色彩（與 RoutePage / BusCard 一致）
const CO_COL  = { kmb: '#D85A30', lwb: '#ff9f43', ctb: '#0F6E56', joint: '#7ba8ff', mtr: '#185FA5', lrt: '#BA7517' };
const CO_BG   = { kmb: 'rgba(216,90,48,.1)', lwb: 'rgba(255,159,67,.1)', ctb: 'rgba(29,158,117,.1)', joint: 'rgba(123,168,255,.1)', mtr: 'rgba(24,95,165,.1)', lrt: 'rgba(186,117,23,.1)' };
const CO_LBL  = { kmb: '九巴', lwb: '龍運', ctb: '城巴', joint: '九巴+城巴', mtr: '港鐵', lrt: '輕鐵' };

// ── 聯營路線名單（排除已非聯營的 968, 978, 108 等） ───────────────
const JOINT_ROUTES = new Set([
  '101','102','103','104','106','107','109','110','111','112','113','115','116','117','118','170','171','182',
  '301','307','373','601','606','608','619','621','641','671','678','680','681','690','694',
  '904','905','914','930','948','962','967','969','970','971','973','980','981','982','985',
  'N118','N121','N122','N170','N171','N182','N307','N368','N373','N619','N680','N691','N930','N952','N960','N962','N969'
]);

function isJointRoute(route) {
  if (JOINT_ROUTES.has(route)) return true;
  // 過海聯營線主力：1xx, 6xx, 9xx (排除已知純九巴或純城巴路線)
  if (/^(1|6|9)\d{2}/.test(route)) {
    const kmbOnly = ['108', '603', '613', '673', '681', '934', '935', '936', '960', '961', '968', '978'];
    const ctbOnly = ['608', '629', '952', '962', '967', '969', '976', '979', '986', '987', '988', '989'];
    if (kmbOnly.includes(route) || ctbOnly.includes(route)) return false;
    return true;
  }
  return false;
}

export default function SearchPage({ isActive, openDrawer }) {
  const { addRouteTargetPid, transportSettings } = useApp();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // 判斷是否為龍運路線 (A, E, S, NA, R 等開頭)
  const isLWB = (route) => /^(A|E|S|NA)\d/.test(route) || ['R8', 'R33', 'R42', 'N30', 'N31', 'N42', 'N64'].includes(route);

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLoading(true); setResults(null);
    try {
      // 1. 同時搜尋 KMB + CTB
      const [kmbData, ctbData] = await Promise.allSettled([
        fetch(`${KMB}/route/`).then(r => r.json()),
        fetch(`${CTB}/route/CTB/`).then(r => r.json()),
      ]);

      const kmbRoutes = (kmbData.status === 'fulfilled' ? kmbData.value.data || [] : [])
        .filter(r =>
          r.route === q || r.route.startsWith(q) ||
          r.dest_tc?.includes(query) || r.orig_tc?.includes(query)
        )
        .map(r => ({ 
          ...r, 
          _co: isLWB(r.route) ? 'lwb' : (isJointRoute(r.route) ? 'joint' : 'kmb'),
          _type: 'bus'
        }));

      const ctbRoutes = (ctbData.status === 'fulfilled' ? ctbData.value.data || [] : [])
        .filter(r =>
          r.route === q || r.route.startsWith(q) ||
          r.dest_tc?.includes(query) || r.orig_tc?.includes(query)
        )
        .map(r => ({ 
          ...r, 
          _co: isJointRoute(r.route) ? 'joint' : 'ctb', 
          _type: 'bus' 
        }));

      // 合拼：避免重複顯示
      const busResults = [];
      const processedRoutes = new Map(); // route -> co

      kmbRoutes.forEach(r => {
        busResults.push(r);
        processedRoutes.set(r.route, r._co);
      });

      ctbRoutes.forEach(r => {
        if (!processedRoutes.has(r.route)) {
          busResults.push(r);
        } else if (processedRoutes.get(r.route) !== 'joint' && isJointRoute(r.route)) {
          // 如果 KMB 沒標為 joint 但 CTB 標了（理論上不會發生，保險起見）
          const idx = busResults.findIndex(x => x.route === r.route);
          if (idx !== -1) busResults[idx]._co = 'joint';
        }
      });

      // 2. MTR 搜尋 (如果設定中開啟了)
      let mtrResults = [];
      if (transportSettings.mtr) {
        // 搜尋車站
        const stnMatches = MTR_STNS.filter(s => s.n.includes(query) || query.includes(s.n))
          .map(s => ({
            route: s.n,
            dest_tc: s.lines.map(l => MTR_LINE[l]).join(', '),
            orig_tc: '港鐵站',
            _co: 'mtr',
            _type: 'mtr_stn',
            _data: s
          }));
        
        // 搜尋綫路
        const lineMatches = Object.entries(MTR_LINE)
          .filter(([id, name]) => name.includes(query) || id === q)
          .map(([id, name]) => ({
            route: name,
            dest_tc: id,
            orig_tc: '港鐵綫',
            _co: 'mtr',
            _type: 'mtr_line',
            _id: id
          }));
        
        mtrResults = [...stnMatches, ...lineMatches];
      }

      // 3. LRT 搜尋 (如果設定中開啟了)
      let lrtResults = [];
      if (transportSettings.lrt) {
        // 搜尋路線
        const routeMatches = Object.entries(LRT_ROUTES_DATA)
          .filter(([no, data]) => no === q || data.desc.includes(query))
          .map(([no, data]) => ({
            route: no,
            dest_tc: data.to,
            orig_tc: data.from,
            _co: 'lrt',
            _type: 'lrt_route',
            _data: data
          }));
        
        // 搜尋車站
        const stnMatches = LRT_STNS.filter(s => s.n.includes(query))
          .map(s => ({
            route: s.n,
            dest_tc: '輕鐵站',
            orig_tc: `編號: ${s.id}`,
            _co: 'lrt',
            _type: 'lrt_stn',
            _id: s.id
          }));
        
        lrtResults = [...routeMatches, ...stnMatches];
      }

      const allResults = [...busResults, ...mtrResults, ...lrtResults];

      // 排序：完全符合優先，再按字母
      allResults.sort((a, b) => {
        const aExact = a.route === q ? 0 : 1;
        const bExact = b.route === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.route.localeCompare(b.route);
      });

      setResults(allResults);
    } catch (e) { 
      console.error('Search error:', e);
      setResults([]); 
    }
    setLoading(false);
  };

  // 點擊路線 → 開路線詳情 drawer
  const openRoute = (r) => {
    if (!openDrawer) return;

    if (r._type === 'bus') {
      const dir = r.bound || r.direction || 'O';
      const row = {
        route:       r.route,
        dest:        r.dest_tc || '',
        companyType: r._co || 'kmb',
        dir:         dir === 'I' || dir === 'inbound' ? 'I' : 'O',
        serviceType: r.service_type || '1',
        stopId:      null,
        targetPid:   addRouteTargetPid || null,
        fare:        null,
      };
      openDrawer(`${r.route} 路線詳情`, 'bus-detail', row);
    } else {
      // MTR / LRT 暫時直接顯示提示或跳轉 (目前 App 詳情頁主要支援巴士)
      const row = {
        route: r.route,
        dest: r.dest_tc,
        companyType: r._co,
        stopId: r._id || null,
        etasWithType: [],
        _type: r._type
      };
      openDrawer(`${r.route} 詳情`, 'bus-detail', row);
    }
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
