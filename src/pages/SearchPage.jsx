import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { KMB, CTB, CO_INFO } from '../constants/transport.js';
import { Spinner } from '../components/Overlay.jsx';

// ── 公司標籤 ─────────────────────────────────────────────
function CoBadge({ co }) {
  const s = CO_INFO[co] || CO_INFO.kmb;
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
      background: s.bg, border: `1px solid ${s.bdr}`, color: s.color,
      flexShrink: 0, alignSelf: 'flex-start', marginTop: 3, whiteSpace: 'nowrap',
    }}>{s.short}</div>
  );
}

// ── 已啟用公司指示器 ─────────────────────────────────────
function CoChip({ co, active }) {
  const s = CO_INFO[co] || CO_INFO.kmb;
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
      background: active ? s.bg : 'var(--bg3)',
      border: `1px solid ${active ? s.bdr : 'var(--bdr)'}`,
      color: active ? s.color : 'var(--dim)',
      opacity: active ? 1 : 0.6,
    }}>{s.label} {s.short}{!active ? ' (未啟用)' : ''}</div>
  );
}

export default function SearchPage({ isActive }) {
  const { transportSettings } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    const qOrig = query.trim();
    if (!q) return;
    setLoading(true);
    setResults(null);

    try {
      // ── KMB + LWB（同一 API，company 欄位區分）────────
      const kmbPromise = fetch(`${KMB}/route/`)
        .then(r => r.json())
        .then(data => (data.data || [])
          .filter(r =>
            r.route === q || r.route.startsWith(q) ||
            r.dest_tc?.includes(qOrig) || r.orig_tc?.includes(qOrig)
          )
          .map(r => ({
            ...r,
            // company 欄位 = "KMB" | "LWB"（轉小寫作 co key）
            co: (r.company || 'KMB').toLowerCase(),
          }))
        )
        .catch(() => []);

      // ── CTB（依設定）────────────────────────────────
      const ctbPromise = transportSettings?.ctb
        ? fetch(`${CTB}/route/CTB`)
            .then(r => r.json())
            .then(data => (data.data || [])
              .filter(r =>
                r.route === q || r.route?.startsWith(q) ||
                r.dest_tc?.includes(qOrig) || r.orig_tc?.includes(qOrig)
              )
              .map(r => ({ ...r, co: 'ctb' }))
            )
            .catch(() => [])
        : Promise.resolve([]);

      const [kmbLwbMatches, ctbMatches] = await Promise.all([kmbPromise, ctbPromise]);

      // ── 合併：同路線 KMB+CTB → joint，去重 ───────────
      const ctbRouteSet = new Set(ctbMatches.map(r => r.route));
      const merged = [];

      // KMB/LWB 結果：若 CTB 也有同路線 → 改為 joint
      kmbLwbMatches.forEach(r => {
        const isJoint = r.co === 'kmb' && ctbRouteSet.has(r.route);
        merged.push({ ...r, co: isJoint ? 'joint' : r.co });
      });

      // CTB 專屬路線（KMB 沒有的）
      const kmbRouteSet = new Set(kmbLwbMatches.map(r => r.route));
      ctbMatches.forEach(r => {
        if (!kmbRouteSet.has(r.route)) merged.push({ ...r, co: 'ctb' });
      });

      // 按路線號碼排序（numeric-aware）
      merged.sort((a, b) => a.route.localeCompare(b.route, 'zh-HK', { numeric: true }));

      // 去重（同路線+同公司的 inbound/outbound 只保留一條）
      const seen = new Set();
      const deduped = merged.filter(r => {
        const key = `${r.route}_${r.co}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setResults(deduped);
    } catch {
      setResults([]);
    }

    setLoading(false);
  };

  const ctbEnabled = !!transportSettings?.ctb;

  return (
    <div className="page" id="page-search" style={isActive ? { display: 'flex' } : {}}>

      {/* ── 搜尋欄 ── */}
      <div style={{
        flexShrink: 0, padding: '12px 12px 10px',
        background: 'var(--bg2)', borderBottom: '1px solid var(--bdr)',
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
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

        {/* 已啟用公司 chips */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <CoChip co="kmb" active />
          <CoChip co="lwb" active />
          <CoChip co="ctb" active={ctbEnabled} />
        </div>
      </div>

      {/* ── 結果區 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', scrollbarWidth: 'thin' }}>

        {!results && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mid)' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: .3 }}>🔍</div>
            <div style={{ fontSize: 14 }}>輸入路線號碼或地名搜尋</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 5, lineHeight: 1.7 }}>
              如 40X、1A、E21、荃灣、尖沙咀
            </div>
            {!ctbEnabled && (
              <div style={{
                marginTop: 14, fontSize: 11, color: 'var(--dim)',
                background: 'var(--bg3)', borderRadius: 8, padding: '8px 14px',
                border: '1px solid var(--bdr)', display: 'inline-block', lineHeight: 1.7,
              }}>
                💡 設定 → 交通服務 → 開啟城巴 CTB 搜尋
              </div>
            )}
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
              <div className="sec-lbl" style={{ marginBottom: 8 }}>
                找到 {results.length} 條路線
              </div>
              {results.map((r, i) => (
                <div key={`${r.co}_${r.route}_${i}`} className="result-item">
                  <div className="rn">{r.route}</div>
                  <div className="ri" style={{ minWidth: 0 }}>
                    <div className="ri-dest">往 {r.dest_tc}</div>
                    <div className="ri-orig" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      由 {r.orig_tc}
                    </div>
                  </div>
                  <CoBadge co={r.co} />
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
