import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import _idb from '../utils/idb.js';

const ROUTES_URL = 'https://wongchiyuen.github.io/commute/data/routes.json';
const ROUTES_TTL = 7 * 24 * 60 * 60 * 1000;

const CO_CFG = {
  kmb:   { label: '九巴',  short: 'KMB', color: '#ffc03a', bg: 'rgba(240,165,0,.13)',   bdr: 'rgba(240,165,0,.38)'   },
  lwb:   { label: '龍運',  short: 'LWB', color: '#ff9f43', bg: 'rgba(255,159,67,.13)',  bdr: 'rgba(255,159,67,.38)'  },
  ctb:   { label: '城巴',  short: 'CTB', color: '#2ed573', bg: 'rgba(46,213,115,.1)',   bdr: 'rgba(46,213,115,.3)'   },
  joint: { label: '聯營',  short: 'KMB+CTB', color: '#7ba8ff', bg: 'rgba(91,143,255,.1)', bdr: 'rgba(91,143,255,.3)' },
  mtr:   { label: '港鐵',  short: 'MTR', color: '#ff8a96', bg: 'rgba(231,76,60,.12)',   bdr: 'rgba(231,76,60,.35)'   },
  lrt:   { label: '輕鐵',  short: 'LRT', color: '#c8c2ff', bg: 'rgba(162,155,254,.12)', bdr: 'rgba(162,155,254,.38)' },
};

function CoBadge({ co }) {
  const s = CO_CFG[co] || CO_CFG.kmb;
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
      background: s.bg, border: `1px solid ${s.bdr}`, color: s.color,
      flexShrink: 0, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: 3,
    }}>{s.short}</div>
  );
}

// 路線快取（IDB 7 天）
let _routesCache = null;
async function ensureRoutes() {
  if (_routesCache?.length) return _routesCache;
  try {
    const cached = await _idb.fresh('all_routes_v1');
    if (cached?.length) { _routesCache = cached; return cached; }
  } catch {}
  const res = await fetch(ROUTES_URL, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  _routesCache = data.routes || [];
  if (_routesCache.length) _idb.set('all_routes_v1', _routesCache, ROUTES_TTL);
  return _routesCache;
}

export default function SearchPage({ isActive, openDrawer }) {
  const { transportSettings } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  // 進入頁面時預載路線資料庫
  useEffect(() => {
    if (!isActive) return;
    ensureRoutes().then(() => setDbReady(true)).catch(() => {});
  }, [isActive]);

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    const qOrig = query.trim();
    if (!q) return;
    setLoading(true);
    setResults(null);
    try {
      const allRoutes = await ensureRoutes();
      const matched = allRoutes.filter(r => {
        if (r.route === q || r.route.startsWith(q)) return true;
        if (r.orig_tc?.includes(qOrig) || r.dest_tc?.includes(qOrig)) return true;
        if (r.co === 'mtr' && r.name_tc?.includes(qOrig)) return true;
        return false;
      });

      // 依設定過濾
      const filtered = matched.filter(r => {
        if (r.co === 'ctb' && !transportSettings?.ctb) return false;
        return true;
      });

      // KMB+CTB 同路線合為 joint
      const kmbSet = new Set(filtered.filter(r => r.co === 'kmb').map(r => r.route));
      const ctbSet = new Set(filtered.filter(r => r.co === 'ctb').map(r => r.route));
      // KMB route list: only from data.etabus（includes LWB）
      // routes.json: kmb = KMB+LWB mixed, ctb = CTB
      const merged = filtered.map(r => ({
        ...r,
        co: r.co === 'kmb' && ctbSet.has(r.route) ? 'joint' : r.co,
      }));

      // 去重（同路線+公司+方向只保留一條）
      const seen = new Set();
      const deduped = merged.filter(r => {
        const k = `${r.route}_${r.co}_${r.bound || 'O'}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });

      // 排序：MTR/LRT先，然後路線號碼
      deduped.sort((a, b) => {
        const order = { mtr: 0, lrt: 1 };
        const ao = order[a.co] ?? 2;
        const bo = order[b.co] ?? 2;
        if (ao !== bo) return ao - bo;
        return a.route.localeCompare(b.route, 'zh-HK', { numeric: true });
      });

      setResults(deduped);
    } catch (e) {
      console.warn('[search]', e);
      setResults([]);
    }
    setLoading(false);
  };

  const ctbOn = !!transportSettings?.ctb;

  return (
    <div className="page" id="page-search" style={isActive ? { display: 'flex' } : {}}>

      {/* 搜尋欄 */}
      <div style={{
        flexShrink: 0, padding: '12px 12px 10px',
        background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)',
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            className="d-input"
            value={query}
            placeholder="路線號碼 / 地名 / 鐵路綫（如 40X、荃灣、TWL）"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            style={{ fontFamily: 'var(--sans)' }}
          />
          <button className="d-btn" onClick={doSearch}>搜尋</button>
        </div>
        {/* 公司狀態 chips */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {['kmb', 'lwb', 'ctb', 'mtr', 'lrt'].map(co => {
            const s = CO_CFG[co];
            const active = co === 'ctb' ? ctbOn : true;
            return (
              <div key={co} style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                background: active ? s.bg : 'var(--bg3)',
                border: `1px solid ${active ? s.bdr : 'var(--bdr)'}`,
                color: active ? s.color : 'var(--dim)',
              }}>
                {s.label}{!active ? ' (未啟用)' : ''}
              </div>
            );
          })}
          {!dbReady && (
            <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)', marginLeft: 4 }}>⏳</div>
          )}
        </div>
      </div>

      {/* 結果 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', scrollbarWidth: 'thin' }}>
        {!results && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mid)' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: .3 }}>🔍</div>
            <div style={{ fontSize: 14 }}>路線號碼 / 中文地名 / 鐵路綫</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 6, lineHeight: 1.8 }}>
              如 40X、荃灣、TWL、荃灣綫
            </div>
            {!ctbOn && (
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--dim)', background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--bdr)', display: 'inline-block' }}>
                💡 設定 → 交通服務 → 開啟城巴 CTB
              </div>
            )}
          </div>
        )}

        {loading && <div className="spinner" />}

        {results !== null && !loading && (
          results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--mid)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--bright)' }}>找不到「{query}」</div>
              <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.8 }}>
                支援：路線號碼、中文地名、鐵路綫名
              </div>
            </div>
          ) : (
            <>
              <div className="sec-lbl" style={{ marginBottom: 8 }}>找到 {results.length} 條路線</div>
              {results.map((r, i) => {
                // 構建一個 row 物件供 bus-detail drawer 使用
                const fakeRow = {
                  route: r.route,
                  dest: r.dest_tc,
                  stopName: r.orig_tc,
                  companyType: r.co === 'lrt' ? 'lrt' : r.co === 'mtr' ? 'mtr' : r.co === 'ctb' ? 'ctb' : r.co === 'joint' ? 'joint' : r.co === 'lwb' ? 'lwb' : 'kmb',
                  serviceType: r.service_type || '1',
                  dir: r.bound === 'I' ? 'I' : 'O',
                  stopId: null,
                };
                return (
                  <div
                    key={`${r.co}_${r.route}_${r.bound}_${i}`}
                    className="result-item"
                    onClick={() => openDrawer && openDrawer(`${r.route} 路線詳情`, 'bus-detail', fakeRow)}
                  >
                    <div className="rn" style={{ fontSize: r.route.length > 4 ? 14 : undefined }}>
                      {r.route}
                    </div>
                    <div className="ri" style={{ minWidth: 0 }}>
                      {r.co === 'mtr' && r.name_tc && (
                        <div style={{ fontSize: 10, color: CO_CFG.mtr.color, marginBottom: 1 }}>{r.name_tc}</div>
                      )}
                      <div className="ri-dest" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        往 {r.dest_tc}
                      </div>
                      <div className="ri-orig" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        由 {r.orig_tc}
                      </div>
                    </div>
                    <CoBadge co={r.co} />
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
