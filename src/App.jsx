import { useState, useCallback, useEffect } from 'react';
import { AppProvider, useApp, NEARBY_PID,
  loadAutoTabs, saveAutoTabs, loadFavs, saveFavs } from './context/AppContext.jsx';
import { useNews } from './hooks/useNews.js';
import { useTraffic } from './hooks/useTraffic.js';
import { Drawer, Toast } from './components/Overlay.jsx';
import HomePage from './pages/HomePage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import TrafficPage from './pages/TrafficPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { RHRREAD_STNS, DAY } from './constants/weather.js';
import './styles/global.css';

const APP_VERSION = __APP_VERSION__;

const KMB_BASE = 'https://data.etabus.gov.hk/v1/transport/kmb';
const CTB_BASE = 'https://rt.data.gov.hk/v2/transport/citybus';

const NAV = [
  { id: 'home',     ico: '🌿', lbl: '主頁' },
  { id: 'search',   ico: '🔍', lbl: '搜尋' },
  { id: 'news',     ico: '📰', lbl: '新聞' },
  { id: 'traffic',  ico: '🚦', lbl: '交通' },
  { id: 'settings', ico: '⚙️', lbl: '設定' },
];

// ─────────────────────────────────────────────────────────
// BusDetailDrawer — 路線站點列表 + 即時 ETA
// ─────────────────────────────────────────────────────────
function BusDetailDrawer({ row }) {
  const [stops, setStops] = useState([]);
  const [etas, setEtas] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dir, setDir] = useState('O');

  if (!row) return <div className="msg">路線資料不正確</div>;

  const co = row.companyType || 'kmb';
  const isKMB = ['kmb', 'lwb', 'joint'].includes(co);
  const isCTB = ['ctb', 'joint'].includes(co);
  const isMTR = co === 'mtr';
  const isLRT = co === 'lrt';

  const coColor = {
    kmb: 'var(--amb2)', lwb: '#ff9f43', ctb: '#2ed573',
    joint: '#7ba8ff', mtr: '#ff8a96', lrt: '#c8c2ff',
  }[co] || 'var(--amb2)';

  const coLabel = {
    kmb: '九巴 KMB', lwb: '龍運 LWB', ctb: '城巴 CTB',
    joint: 'KMB+CTB 聯營', mtr: '港鐵 MTR', lrt: '輕鐵 LRT',
  }[co] || co.toUpperCase();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(''); setStops([]); setEtas({});
      try {
        const bound = dir === 'O' ? 'outbound' : 'inbound';
        let stopList = [];

        if (isKMB) {
          const d = await fetch(
            `${KMB_BASE}/route-stop/${row.route}/${bound}/${row.serviceType || '1'}`
          ).then(r => r.json());
          const raw = (d.data || []).sort(
            (a, b) => parseInt(a.stop_seq || a.seq || 0) - parseInt(b.stop_seq || b.seq || 0)
          );
          const names = await Promise.all(
            raw.map(s => fetch(`${KMB_BASE}/stop/${s.stop}`).then(r => r.json()).catch(() => null))
          );
          stopList = raw.map((s, i) => ({
            id: s.stop,
            seq: parseInt(s.stop_seq || s.seq || i + 1),
            name: names[i]?.data?.name_tc || s.stop,
          }));
        } else if (isCTB) {
          const d = await fetch(
            `${CTB_BASE}/route-stop/CTB/${row.route}/${bound}`
          ).then(r => r.json());
          const raw = (d.data || []).sort(
            (a, b) => parseInt(a.stop_seq || a.seq || 0) - parseInt(b.stop_seq || b.seq || 0)
          );
          const names = await Promise.all(
            raw.map(s => fetch(`${CTB_BASE}/stop/${s.stop}`).then(r => r.json()).catch(() => null))
          );
          stopList = raw.map((s, i) => ({
            id: s.stop,
            seq: parseInt(s.stop_seq || s.seq || i + 1),
            name: names[i]?.data?.name_tc || s.stop,
          }));
        }

        if (cancelled) return;
        setStops(stopList);

        // ETA 只取前 8 站
        if (stopList.length && (isKMB || isCTB)) {
          const now = Date.now();
          const etaMap = {};
          await Promise.all(stopList.slice(0, 8).map(async s => {
            try {
              let mins = [];
              if (isKMB) {
                const d = await fetch(
                  `${KMB_BASE}/eta/${s.id}/${row.route}/${row.serviceType || '1'}`
                ).then(r => r.json());
                mins = (d.data || [])
                  .filter(e => e.eta && (e.dir === dir || !e.dir))
                  .map(e => Math.round((new Date(e.eta).getTime() - now) / 60000))
                  .filter(m => m >= 0 && m <= 90).slice(0, 3);
              } else {
                const d = await fetch(
                  `${CTB_BASE}/eta/CTB/${s.id}/all`
                ).then(r => r.json());
                mins = (d.data || [])
                  .filter(e => e.eta && e.route === row.route)
                  .map(e => Math.round((new Date(e.eta).getTime() - now) / 60000))
                  .filter(m => m >= 0 && m <= 90).slice(0, 3);
              }
              if (mins.length) etaMap[s.id] = mins;
            } catch {}
          }));
          if (!cancelled) setEtas(etaMap);
        }
      } catch (e) {
        if (!cancelled) setError('載入失敗：' + e.message);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [dir, row.route, row.serviceType]);

  return (
    <div>
      {/* 路線頭 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          minWidth: 52, height: 52, borderRadius: 12, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: coColor + '18', border: `1.5px solid ${coColor}44`,
        }}>
          <div style={{ fontSize: row.route.length <= 3 ? 20 : row.route.length === 4 ? 16 : 13, fontWeight: 800, color: coColor, lineHeight: 1 }}>
            {row.route}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bright)' }}>往 {row.dest}</div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>
            {coLabel}{row.stopName ? ' · ' + row.stopName : ''}
          </div>
        </div>
      </div>

      {/* 方向切換 */}
      {(isKMB || isCTB) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['O', 'I'].map(d => (
            <button key={d} onClick={() => setDir(d)} style={{
              flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--sans)',
              background: dir === d ? coColor + '22' : 'var(--bg3)',
              border: `1.5px solid ${dir === d ? coColor + '66' : 'var(--bdr)'}`,
              color: dir === d ? coColor : 'var(--mid)',
            }}>
              {d === 'O' ? `往 ${row.dest}` : '回程'}
            </button>
          ))}
        </div>
      )}

      {/* MTR / LRT 提示 */}
      {isMTR && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--mid)', lineHeight: 1.7 }}>
          🚇 港鐵班次請參閱港鐵官方 App 或網站
        </div>
      )}
      {isLRT && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--mid)', lineHeight: 1.7 }}>
          🚋 輕鐵班次請參閱港鐵輕鐵官方時刻表
        </div>
      )}

      {/* 站點列表 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--mid)' }}>
          <div className="spinner" />
          <div style={{ fontSize: 12, marginTop: 10 }}>載入站點中…</div>
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--red, #ff4757)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
          {error}
        </div>
      )}
      {!loading && !error && !isMTR && !isLRT && stops.length === 0 && (
        <div className="msg">找不到站點資料</div>
      )}
      {!loading && stops.length > 0 && (
        <div style={{ position: 'relative' }}>
          {stops.map((stop, i) => {
            const eta = etas[stop.id];
            const isCurrent = stop.id === row.stopId;
            const isFirst = i === 0;
            const isLast = i === stops.length - 1;
            return (
              <div key={stop.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 0',
                background: isCurrent ? coColor + '0d' : 'transparent',
                borderRadius: isCurrent ? 8 : 0,
                paddingLeft: isCurrent ? 6 : 0,
                marginLeft: isCurrent ? -6 : 0,
              }}>
                {/* 時間軸 */}
                <div style={{ width: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, alignSelf: 'stretch' }}>
                  {!isFirst && <div style={{ width: 2, flex: '0 0 6px', background: 'var(--bdr2)' }} />}
                  <div style={{
                    width: isCurrent ? 12 : 8, height: isCurrent ? 12 : 8,
                    borderRadius: '50%', flexShrink: 0,
                    background: isCurrent ? coColor : isFirst || isLast ? 'var(--mid)' : 'var(--bdr2)',
                    border: isCurrent ? `2px solid ${coColor}` : 'none',
                    boxShadow: isCurrent ? `0 0 0 3px ${coColor}33` : 'none',
                  }} />
                  {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--bdr2)' }} />}
                </div>
                {/* 序號 */}
                <div style={{ width: 22, fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)', flexShrink: 0, textAlign: 'right' }}>
                  {stop.seq}
                </div>
                {/* 站名 */}
                <div style={{ flex: 1, fontSize: 14, color: isCurrent ? coColor : 'var(--txt)', fontWeight: isCurrent ? 700 : 400 }}>
                  {stop.name}
                  {isCurrent && <span style={{ fontSize: 10, color: coColor, marginLeft: 5, opacity: 0.8 }}>◀ 你在這裡</span>}
                </div>
                {/* ETA */}
                {eta && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {eta.slice(0, 2).map((m, j) => (
                      <div key={j} style={{
                        fontFamily: 'var(--mono)', fontSize: j === 0 ? 13 : 11,
                        fontWeight: j === 0 ? 700 : 400,
                        color: m <= 2 ? '#ff6b81' : m <= 8 ? '#ffc03a' : 'var(--mid)',
                      }}>
                        {m <= 0 ? '即將' : `${m}分`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// AppInner
// ─────────────────────────────────────────────────────────
function AppInner() {
  const { activePage, setActivePage, toast, showToast } = useApp();
  // drawer.data 傳遞路線資料給 BusDetailDrawer
  const [drawer, setDrawer] = useState({ open: false, title: '', key: null, data: null });
  const newsHook = useNews();
  const trafficHook = useTraffic();

  const openDrawer = useCallback((title, key, data = null) =>
    setDrawer({ open: true, title, key, data }), []);
  const closeDrawer = useCallback(() =>
    setDrawer(d => ({ ...d, open: false })), []);

  const switchPage = (id) => {
    setActivePage(id);
    if (id === 'news') newsHook.ensureLoaded(newsHook.currentFeed);
    if (id === 'traffic' && !trafficHook.v2Data.length) trafficHook.load();
  };

  return (
    <>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: activePage === 'home' ? 'contents' : 'none' }}>
          <HomePage openDrawer={openDrawer} showToast={showToast} />
        </div>
        <NewsPage newsHook={newsHook} isActive={activePage === 'news'} />
        <TrafficPage trafficHook={trafficHook} isActive={activePage === 'traffic'} />
        <SearchPage isActive={activePage === 'search'} openDrawer={openDrawer} />
        <SettingsPage isActive={activePage === 'settings'} openDrawer={openDrawer} showToast={showToast} />
      </div>

      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-btn${activePage === n.id ? ' active' : ''}`}
            onClick={() => switchPage(n.id)}>
            <span className="nav-ico">{n.ico}</span>
            <span className="nav-lbl">{n.lbl}</span>
          </button>
        ))}
      </nav>

      <Drawer open={drawer.open} title={drawer.title} onClose={closeDrawer}>
        <DrawerContent
          drawerKey={drawer.key}
          drawerData={drawer.data}
          closeDrawer={closeDrawer}
          showToast={showToast}
        />
      </Drawer>

      <Toast msg={toast.msg} visible={toast.visible} />
    </>
  );
}

// ─────────────────────────────────────────────────────────
// DrawerContent 路由
// ─────────────────────────────────────────────────────────
function DrawerContent({ drawerKey, drawerData, closeDrawer, showToast }) {
  const { transportSettings, saveTransport, profiles, updateProfiles,
    setActivePid, reloadFavs, selectedStn, setSelectedStn } = useApp();

  if (!drawerKey) return null;

  // ── 路線詳情 ──────────────────────────────────────────
  if (drawerKey === 'bus-detail') {
    return <BusDetailDrawer row={drawerData} />;
  }

  // ── 交通服務設定 ──────────────────────────────────────
  if (drawerKey === 'transport') {
    const { ctb, mtr, lrt } = transportSettings;
    const Toggle = ({ checked, onChange, label, sub, disabled }) => (
      <div className="sett-row" style={{ cursor: 'default' }}>
        <div className="sett-lbl">
          <div className="sett-lbl-main">{label}</div>
          <div className="sett-lbl-sub">{sub}</div>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={!!checked} onChange={onChange} disabled={!!disabled} />
          <span className="toggle-slider" />
        </label>
      </div>
    );
    return (
      <div className="sett-card">
        <Toggle label="九巴 KMB + 龍運 LWB" sub="預設啟用（同一 API）" checked disabled />
        <Toggle label="城巴 CTB" sub="rt.data.gov.hk" checked={ctb}
          onChange={e => { saveTransport({ ...transportSettings, ctb: e.target.checked }); showToast('已儲存'); }} />
        <Toggle label="港鐵 MTR" sub="附近站下班車資料" checked={mtr}
          onChange={e => { saveTransport({ ...transportSettings, mtr: e.target.checked }); showToast('已儲存'); }} />
        <Toggle label="輕鐵 LRT" sub="屯門 / 元朗 / 天水圍" checked={lrt}
          onChange={e => { saveTransport({ ...transportSettings, lrt: e.target.checked }); showToast('已儲存'); }} />
      </div>
    );
  }

  // ── 天氣地點 ──────────────────────────────────────────
  if (drawerKey === 'weather-details') {
    return (
      <div>
        <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 10 }}>
          選擇天氣測站（目前：{selectedStn}）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {RHRREAD_STNS.map(s => (
            <div key={s.n}
              onClick={() => { setSelectedStn(s.n); closeDrawer(); showToast(`已切換至 ${s.n}`); }}
              style={{
                background: s.n === selectedStn ? 'var(--amb-bg)' : 'var(--bg3)',
                border: `1px solid ${s.n === selectedStn ? 'var(--amb-bdr)' : 'var(--bdr)'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all .15s',
              }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: s.n === selectedStn ? 'var(--amb2)' : 'var(--txt)' }}>
                {s.n}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── 自動跳轉版面 ──────────────────────────────────────
  if (drawerKey === 'auto-tab') {
    return <AutoTabDrawer profiles={profiles} showToast={showToast} />;
  }

  // ── 資料管理 ──────────────────────────────────────────
  if (drawerKey === 'data') {
    const exportData = () => {
      const data = { profiles, favsByProfile: {} };
      profiles.forEach(p => { data.favsByProfile[p.id] = loadFavs(p.id); });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `swd-bus-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      showToast('✅ 已匯出巴士資料');
    };
    const importData = (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.profiles || !data.favsByProfile) throw new Error();
          if (!confirm(`確定匯入？覆蓋現有 ${data.profiles.length} 個版面。`)) return;
          updateProfiles(data.profiles);
          Object.entries(data.favsByProfile).forEach(([pid, arr]) => saveFavs(pid, arr));
          showToast('✅ 匯入成功'); closeDrawer();
        } catch { showToast('❌ 檔案格式不正確'); }
      };
      reader.readAsText(file); e.target.value = '';
    };
    return (
      <div className="sett-card">
        <div className="sett-row" onClick={exportData}>
          <div className="sett-ico">📤</div>
          <div className="sett-lbl">
            <div className="sett-lbl-main">匯出路線資料</div>
            <div className="sett-lbl-sub">下載 JSON 備份</div>
          </div>
          <div className="sett-chev">›</div>
        </div>
        <div className="sett-row" onClick={() => document.getElementById('_import-file').click()}>
          <div className="sett-ico">📥</div>
          <div className="sett-lbl">
            <div className="sett-lbl-main">匯入路線資料</div>
            <div className="sett-lbl-sub">還原 JSON 備份</div>
          </div>
          <div className="sett-chev">›</div>
        </div>
        <input id="_import-file" type="file" accept=".json" style={{ display: 'none' }} onChange={importData} />
      </div>
    );
  }

  if (drawerKey === 'notify') return <NotifyDrawer showToast={showToast} />;

  if (drawerKey === 'add-profile') {
    return <AddProfileDrawer profiles={profiles} updateProfiles={updateProfiles}
      closeDrawer={closeDrawer} showToast={showToast} />;
  }

  if (drawerKey === 'install') {
    return (
      <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 2 }}>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr2)', borderRadius: 11, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amb2)', marginBottom: 8 }}>📱 iPhone / iPad（Safari）</div>
          1. 用 <strong style={{ color: 'var(--bright)' }}>Safari</strong> 開啟此網頁<br />
          2. 點底部 <strong style={{ color: 'var(--bright)' }}>「分享」⬆</strong> 按鈕<br />
          3. 選「<strong style={{ color: 'var(--bright)' }}>加入主畫面</strong>」<br />
          4. 按右上角「新增」確認
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr2)', borderRadius: 11, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amb2)', marginBottom: 8 }}>🤖 Android（Chrome）</div>
          1. 用 <strong style={{ color: 'var(--bright)' }}>Chrome</strong> 開啟此網頁<br />
          2. 點右上角 <strong style={{ color: 'var(--bright)' }}>「⋮」</strong> 選單<br />
          3. 選「<strong style={{ color: 'var(--bright)' }}>新增至主畫面</strong>」<br />
          4. 按「新增」確認
        </div>
      </div>
    );
  }

  if (drawerKey === 'about') {
    const sources = [
      ['🌤','天氣','香港天文台開放數據','https://www.hko.gov.hk/tc/abouthko/opendata_intro.htm'],
      ['🚌','九巴/龍運 KMB/LWB','data.etabus.gov.hk','https://data.gov.hk/tc-data/dataset/hk-td-tis_21-etakmb'],
      ['🟢','城巴 CTB','rt.data.gov.hk citybus','https://data.one.gov.hk/zh-hant/dataset/citybus-eta'],
      ['🔴','港鐵 / 輕鐵','rt.data.gov.hk MTR','https://data.one.gov.hk/zh-hant/dataset/mtr-nextrain-data'],
      ['📰','新聞','香港電台 RTHK RSS','https://news.rthk.hk/rthk/ch/rss.htm'],
      ['🚦','交通消息','運輸署特別交通消息 v2','https://data.gov.hk/tc-data/dataset/hk-td-tis_19-special-traffic-news-v2'],
    ];
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--amb2)', marginBottom: 3 }}>生活日常</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>v{APP_VERSION} · React + Vite · 2026</div>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr2)', borderRadius: 11, overflow: 'hidden' }}>
          {sources.map(([ico, name, src, url], i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderBottom: i < sources.length - 1 ? '1px solid var(--bdr)' : 'none',
                textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{ico}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--bright)' }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>{src}</div>
              </div>
              <div style={{ color: 'var(--dim)', fontSize: 14 }}>↗</div>
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--dim)', padding: '8px 0' }}>© 2026 生活日常</div>
      </div>
    );
  }

  return <div className="msg">找不到此頁面</div>;
}

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────
function AutoTabDrawer({ profiles, showToast }) {
  const [cfg, setCfg] = useState(() => loadAutoTabs());
  const DEF = { enabled: false, days: [false,false,false,false,false,false,false], from: '07:00', to: '09:00' };
  const update = (pid, patch) => {
    const next = { ...cfg, [pid]: { ...DEF, ...(cfg[pid] || {}), ...patch } };
    setCfg(next); saveAutoTabs(next);
  };
  const PRESETS = [
    { label: '工作日', days: [false,true,true,true,true,true,false] },
    { label: '週末',   days: [true,false,false,false,false,false,true] },
    { label: '每天',   days: [true,true,true,true,true,true,true] },
  ];
  const TIME_PRESETS = [
    { label: '早上通勤', from: '07:30', to: '09:30' },
    { label: '下午通勤', from: '17:00', to: '19:30' },
    { label: '上午',     from: '08:00', to: '12:00' },
    { label: '下午',     from: '12:00', to: '18:00' },
  ];
  return (
    <div>
      {profiles.map(p => {
        const c = { ...DEF, ...(cfg[p.id] || {}) };
        return (
          <div key={p.id} className="auto-tab-card" style={{ marginBottom: 12 }}>
            <div className="auto-tab-hdr">
              <div className="auto-tab-name">{p.name}</div>
              <label className="toggle">
                <input type="checkbox" checked={!!c.enabled} onChange={e => update(p.id, { enabled: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div style={{ padding: '10px 14px 14px', opacity: c.enabled ? 1 : 0.4, pointerEvents: c.enabled ? 'auto' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 8, fontWeight: 600 }}>啟用日子</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {DAY.map((d, i) => (
                  <button key={i} onClick={() => { const days = [...c.days]; days[i] = !days[i]; update(p.id, { days }); }}
                    style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, background: c.days[i] ? 'var(--amb)' : 'var(--bg3)', color: c.days[i] ? '#000' : 'var(--mid)', transition: 'all .15s' }}>
                    {d}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {PRESETS.map(ps => (
                  <button key={ps.label} onClick={() => update(p.id, { days: ps.days })}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 11, background: 'var(--bg4)', border: '1px solid var(--bdr2)', color: 'var(--mid)' }}>
                    {ps.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 8, fontWeight: 600 }}>時間段</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 4 }}>開始</div>
                  <input type="time" value={c.from || '07:00'} onChange={e => update(p.id, { from: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--bdr2)', borderRadius: 10, padding: '10px 12px', color: 'var(--txt)', fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, outline: 'none' }} />
                </div>
                <div style={{ color: 'var(--dim)', fontSize: 18, paddingTop: 20 }}>→</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 4 }}>結束</div>
                  <input type="time" value={c.to || '09:00'} onChange={e => update(p.id, { to: e.target.value })}
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--bdr2)', borderRadius: 10, padding: '10px 12px', color: 'var(--txt)', fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TIME_PRESETS.map(tp => (
                  <button key={tp.label} onClick={() => update(p.id, { from: tp.from, to: tp.to })}
                    style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 11, background: (c.from === tp.from && c.to === tp.to) ? 'var(--amb-bg)' : 'var(--bg4)', border: `1px solid ${(c.from === tp.from && c.to === tp.to) ? 'var(--amb-bdr)' : 'var(--bdr2)'}`, color: (c.from === tp.from && c.to === tp.to) ? 'var(--amb2)' : 'var(--mid)' }}>
                    {tp.label}<br /><span style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>{tp.from}–{tp.to}</span>
                  </button>
                ))}
              </div>
              {c.days.some(Boolean) && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(91,143,255,.08)', border: '1px solid rgba(91,143,255,.2)', borderRadius: 8, fontSize: 12, color: '#7ba8ff' }}>
                  📋 {['日','一','二','三','四','五','六'].filter((_,i) => c.days[i]).map(d => '星期' + d).join('、')}<br />
                  <span style={{ fontFamily: 'var(--mono)' }}>{c.from} – {c.to}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotifyDrawer({ showToast }) {
  const [perm, setPerm] = useState(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  if (perm === 'unsupported') return <div className="msg">此裝置不支援通知</div>;
  if (perm === 'denied') return <div className="msg">❌ 通知已被封鎖<br /><small style={{ color: 'var(--dim)' }}>請到瀏覽器設定允許通知</small></div>;
  const isOn = perm === 'granted';
  const toggle = async () => {
    if (isOn) { showToast('請到瀏覽器設定中關閉通知權限'); return; }
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === 'granted') showToast('✅ 已啟用天氣警告通知');
    else showToast('❌ 未獲得通知權限');
  };
  return (
    <div>
      <div style={{ background: 'rgba(240,165,0,.08)', border: '1px solid var(--amb-bdr)', borderRadius: 11, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--bright)', marginBottom: 6 }}>🔔 會通知的警告</div>
        <div style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.9 }}>
          ⛈ 黑色 / 紅色 / 黃色暴雨警告<br />🌀 熱帶氣旋警告信號（颱風）<br />
          🥵 酷熱 / 🥶 寒冷天氣警告<br />⚡ 雷暴警告 · 🌊 山泥傾瀉警告
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '11px 13px', marginBottom: 14, fontSize: 12, color: 'var(--dim)', lineHeight: 1.7 }}>
        ℹ️ 每 5 分鐘查詢天文台，有新警告時本地觸發通知
      </div>
      <button onClick={toggle} style={{ width: '100%', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', border: `1px solid ${isOn ? 'rgba(255,71,87,.3)' : 'var(--amb-bdr)'}`, background: isOn ? 'rgba(255,71,87,.15)' : 'var(--amb-bg)', color: isOn ? '#ff8a96' : 'var(--amb2)' }}>
        {isOn ? '🔕 關閉天氣警告通知' : '🔔 啟用天氣警告通知'}
      </button>
    </div>
  );
}

function AddProfileDrawer({ profiles, updateProfiles, closeDrawer, showToast }) {
  const [name, setName] = useState('');
  const doAdd = () => {
    if (!name.trim()) return;
    const id = 'p_' + Date.now();
    updateProfiles([...profiles, { id, name: name.trim() }]);
    closeDrawer();
    showToast(`已新增「${name.trim()}」`);
  };
  return (
    <div>
      <div className="sec-lbl">版面名稱</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="d-input" value={name} placeholder="如：上班、週末…" maxLength={10}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doAdd()}
          autoFocus />
        <button className="d-btn" onClick={doAdd}>確定</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
