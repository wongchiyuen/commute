import { useState, useCallback } from 'react';
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
import { KMB, CTB } from './constants/transport.js';
import './styles/global.css';

// 自動從 package.json 讀取版本號（Vite build 時注入）
const APP_VERSION = __APP_VERSION__;

const NAV = [
  { id: 'home',     ico: '🌿', lbl: '主頁' },
  { id: 'search',   ico: '🔍', lbl: '搜尋' },
  { id: 'news',     ico: '📰', lbl: '新聞' },
  { id: 'traffic',  ico: '🚦', lbl: '交通' },
  { id: 'settings', ico: '⚙️', lbl: '設定' },
];

function AppInner() {
  const { activePage, setActivePage, toast, showToast } = useApp();
  const [drawer, setDrawer] = useState({ open: false, title: '', key: null });
  const newsHook = useNews();
  const trafficHook = useTraffic();

  const openDrawer = useCallback((title, key) =>
    setDrawer({ open: true, title, key }), []);
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
        <SearchPage isActive={activePage === 'search'} />
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
        <DrawerContent drawerKey={drawer.key} closeDrawer={closeDrawer} showToast={showToast} />
      </Drawer>

      <Toast msg={toast.msg} visible={toast.visible} />
    </>
  );
}

// ── Drawer 內容路由 ───────────────────────────────────────
function DrawerContent({ drawerKey, closeDrawer, showToast }) {
  const { transportSettings, saveTransport, profiles, updateProfiles,
    setActivePid, reloadFavs, selectedStn, setSelectedStn } = useApp();

  if (!drawerKey) return null;

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
        <Toggle label="九巴 KMB" sub="預設啟用" checked disabled />
        <Toggle label="城巴 CTB" sub="rt.data.gov.hk" checked={ctb}
          onChange={e => { saveTransport({ ...transportSettings, ctb: e.target.checked }); showToast('已儲存'); }} />
        <Toggle label="港鐵 MTR" sub="附近站下班車資料" checked={mtr}
          onChange={e => { saveTransport({ ...transportSettings, mtr: e.target.checked }); showToast('已儲存'); }} />
        <Toggle label="輕鐵 LRT" sub="rt.data.gov.hk/mtr/lrt" checked={lrt}
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
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('✅ 已匯出巴士資料');
    };
    const importData = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.profiles || !data.favsByProfile) throw new Error();
          if (!confirm(`確定匯入？覆蓋現有 ${data.profiles.length} 個版面。`)) return;
          updateProfiles(data.profiles);
          Object.entries(data.favsByProfile).forEach(([pid, arr]) => saveFavs(pid, arr));
          showToast('✅ 匯入成功');
          closeDrawer();
        } catch { showToast('❌ 檔案格式不正確'); }
      };
      reader.readAsText(file);
      e.target.value = '';
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
        <input id="_import-file" type="file" accept=".json"
          style={{ display: 'none' }} onChange={importData} />
      </div>
    );
  }

  // ── 天氣警告通知 ──────────────────────────────────────
  if (drawerKey === 'notify') {
    return <NotifyDrawer showToast={showToast} />;
  }

  // ── 新增版面 ──────────────────────────────────────────
  if (drawerKey === 'add-profile') {
    return <AddProfileDrawer profiles={profiles} updateProfiles={updateProfiles}
      closeDrawer={closeDrawer} showToast={showToast} />;
  }

  // ── 安裝到手機 ────────────────────────────────────────
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

  // ── 關於生活日常 ──────────────────────────────────────
  if (drawerKey === 'about') {
    const sources = [
      ['🌤','天氣','香港天文台開放數據','https://www.hko.gov.hk/tc/abouthko/opendata_intro.htm'],
      ['🚌','九巴 KMB','data.gov.hk 九巴開放 API','https://data.gov.hk/tc-data/dataset/hk-td-tis_21-etakmb'],
      ['🟢','城巴 CTB','rt.data.gov.hk citybus ETA','https://data.one.gov.hk/zh-hant/dataset/citybus-eta'],
      ['🔴','港鐵 / 輕鐵','data.one.gov.hk MTR 列車資訊','https://data.one.gov.hk/zh-hant/dataset/mtr-nextrain-data'],
      ['📰','新聞','香港電台 RTHK RSS','https://news.rthk.hk/rthk/ch/rss.htm'],
      ['🚦','交通消息','運輸署特別交通消息 v2','https://data.gov.hk/tc-data/dataset/hk-td-tis_19-special-traffic-news-v2'],
    ];
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--amb2)', marginBottom: 3 }}>生活日常</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>
            v{APP_VERSION} · React + Vite · 2026
          </div>
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
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--dim)', padding: '8px 0' }}>
          © 2026 生活日常
        </div>
      </div>
    );
  }

  // ── 加路線搜尋 ────────────────────────────────────────
  if (drawerKey === 'search') {
    return <SearchDrawer closeDrawer={closeDrawer} showToast={showToast} />;
  }

  return <div className="msg">載入中…</div>;
}

// ── 獨立 sub-components（避免 hooks-in-conditional 問題）──
function AutoTabDrawer({ profiles, showToast }) {
  const [cfg, setCfg] = useState(() => loadAutoTabs());
  const DEF = { enabled: false, days: [false,false,false,false,false,false,false], from: '07:00', to: '09:00' };

  const update = (pid, patch) => {
    const next = { ...cfg, [pid]: { ...DEF, ...(cfg[pid] || {}), ...patch } };
    setCfg(next);
    saveAutoTabs(next);
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
                <input type="checkbox" checked={!!c.enabled}
                  onChange={e => update(p.id, { enabled: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>

            <div style={{ padding: '10px 14px 14px', opacity: c.enabled ? 1 : 0.4, pointerEvents: c.enabled ? 'auto' : 'none' }}>
              <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 8, fontWeight: 600 }}>啟用日子</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {DAY.map((d, i) => (
                  <button key={i}
                    onClick={() => { const days = [...c.days]; days[i] = !days[i]; update(p.id, { days }); }}
                    style={{
                      flex: 1, height: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600,
                      background: c.days[i] ? 'var(--amb)' : 'var(--bg3)',
                      color: c.days[i] ? '#000' : 'var(--mid)',
                      transition: 'all .15s',
                    }}>{d}</button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {PRESETS.map(ps => (
                  <button key={ps.label}
                    onClick={() => update(p.id, { days: ps.days })}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'var(--sans)', fontSize: 11,
                      background: 'var(--bg4)', border: '1px solid var(--bdr2)',
                      color: 'var(--mid)',
                    }}>{ps.label}</button>
                ))}
              </div>

              <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 8, fontWeight: 600 }}>時間段</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 4 }}>開始</div>
                  <input type="time" value={c.from || '07:00'}
                    onChange={e => update(p.id, { from: e.target.value })}
                    style={{
                      width: '100%', background: 'var(--bg3)', border: '1px solid var(--bdr2)',
                      borderRadius: 10, padding: '10px 12px', color: 'var(--txt)',
                      fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, outline: 'none',
                    }} />
                </div>
                <div style={{ color: 'var(--dim)', fontSize: 18, paddingTop: 20 }}>→</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 4 }}>結束</div>
                  <input type="time" value={c.to || '09:00'}
                    onChange={e => update(p.id, { to: e.target.value })}
                    style={{
                      width: '100%', background: 'var(--bg3)', border: '1px solid var(--bdr2)',
                      borderRadius: 10, padding: '10px 12px', color: 'var(--txt)',
                      fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, outline: 'none',
                    }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TIME_PRESETS.map(tp => (
                  <button key={tp.label}
                    onClick={() => update(p.id, { from: tp.from, to: tp.to })}
                    style={{
                      padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'var(--sans)', fontSize: 11,
                      background: (c.from === tp.from && c.to === tp.to) ? 'var(--amb-bg)' : 'var(--bg4)',
                      border: `1px solid ${(c.from === tp.from && c.to === tp.to) ? 'var(--amb-bdr)' : 'var(--bdr2)'}`,
                      color: (c.from === tp.from && c.to === tp.to) ? 'var(--amb2)' : 'var(--mid)',
                    }}>
                    {tp.label}<br />
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>{tp.from}–{tp.to}</span>
                  </button>
                ))}
              </div>

              {c.days.some(Boolean) && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(91,143,255,.08)', border: '1px solid rgba(91,143,255,.2)', borderRadius: 8, fontSize: 12, color: '#7ba8ff' }}>
                  📋 {['日','一','二','三','四','五','六'].filter((_, i) => c.days[i]).map(d => '星期' + d).join('、')}<br />
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
  if (perm === 'denied') return (
    <div className="msg">
      ❌ 通知已被封鎖<br />
      <small style={{ color: 'var(--dim)' }}>請到瀏覽器設定允許通知，然後重新整理頁面</small>
    </div>
  );
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
          ⛈ 黑色 / 紅色 / 黃色暴雨警告<br />
          🌀 熱帶氣旋警告信號（颱風）<br />
          🥵 酷熱 / 🥶 寒冷天氣警告<br />
          ⚡ 雷暴警告 · 🌊 山泥傾瀉警告
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '11px 13px', marginBottom: 14, fontSize: 12, color: 'var(--dim)', lineHeight: 1.7 }}>
        ℹ️ 每 5 分鐘查詢天文台，有新警告時本地觸發通知
      </div>
      <button onClick={toggle} style={{
        width: '100%', padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'var(--sans)',
        border: `1px solid ${isOn ? 'rgba(255,71,87,.3)' : 'var(--amb-bdr)'}`,
        background: isOn ? 'rgba(255,71,87,.15)' : 'var(--amb-bg)',
        color: isOn ? '#ff8a96' : 'var(--amb2)',
      }}>
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

// ── 加路線 Drawer ─────────────────────────────────────────
function SearchDrawer({ closeDrawer, showToast }) {
  const { activePid, profiles } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stops, setStops] = useState(null);
  const [stopsLoading, setStopsLoading] = useState(false);

  const profName = profiles.find(p => p.id === activePid)?.name || '';

  const doSearch = async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLoading(true); setResults(null); setSelectedRoute(null); setStops(null);
    try {
      const [kmbData, ctbData] = await Promise.all([
        fetch(`${KMB}/route/`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${CTB}/route/CTB`).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      const kmbMatches = (kmbData.data || [])
        .filter(r => r.route === q || r.route.startsWith(q) || r.dest_tc?.includes(query) || r.orig_tc?.includes(query))
        .map(r => ({ ...r, co: r.co === 'LWB' ? 'lwb' : 'kmb' }));
      const ctbMatches = (ctbData.data || [])
        .filter(r => r.route === q || r.route.startsWith(q) || r.dest_tc?.includes(query) || r.orig_tc?.includes(query))
        .map(r => ({ ...r, co: 'ctb' }));
      setResults([...kmbMatches, ...ctbMatches].slice(0, 40));
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
    const favList = loadFavs(activePid);
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
    saveFavs(activePid, favList);
    showToast(`✅ 已加入 ${selectedRoute.route} ${stop.name_tc}`);
    closeDrawer();
  };

  if (selectedRoute) return (
    <div>
      <button onClick={() => { setSelectedRoute(null); setStops(null); }}
        style={{ background: 'none', border: 'none', color: 'var(--amb2)', fontSize: 13, cursor: 'pointer', padding: '0 0 12px', fontFamily: 'var(--sans)' }}>
        ← 返回結果
      </button>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)', marginBottom: 3 }}>
        {selectedRoute.route} 往 {selectedRoute.dest_tc}
      </div>
      <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>由 {selectedRoute.orig_tc} — 選擇站點加入</div>
      {profName && (
        <div style={{ fontSize: 12, background: 'var(--amb-bg)', border: '1px solid var(--amb-bdr)', borderRadius: 8, padding: '6px 10px', marginBottom: 12, color: 'var(--amb2)' }}>
          ＋ 加入版面：<strong>{profName}</strong>
        </div>
      )}
      {stopsLoading
        ? <div className="msg">載入站點…</div>
        : (stops || []).map((stop, i) => (
          <div key={i} onClick={() => addStop(stop)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 10, marginBottom: 6, cursor: 'pointer' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--amb-bg)',
              border: '1px solid var(--amb-bdr)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10, color: 'var(--amb2)', fontWeight: 700, flexShrink: 0 }}>
              {stop.seq}
            </div>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--txt)' }}>{stop.name_tc}</div>
            <div style={{ fontSize: 18, color: 'var(--amb2)' }}>＋</div>
          </div>
        ))
      }
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="d-input" value={query} placeholder="路線號碼 / 地名（如 40X、荃灣）" autoFocus
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()} />
        <button className="d-btn" onClick={doSearch}>搜尋</button>
      </div>
      {loading && <div className="msg">搜尋中…</div>}
      {results !== null && !loading && (results.length === 0
        ? <div className="msg">找不到「{query}」</div>
        : results.map((r, i) => (
          <div key={i} onClick={() => selectRoute(r)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: 'var(--bg3)', border: '1px solid var(--bdr)', borderRadius: 10, marginBottom: 6, cursor: 'pointer' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--amb2)', minWidth: 44 }}>{r.route}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--bright)' }}>往 {r.dest_tc}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>由 {r.orig_tc}</div>
            </div>
            <div style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 600, flexShrink: 0,
              color: r.co === 'ctb' ? '#2ed573' : r.co === 'lwb' ? '#00c896' : 'var(--amb2)',
              background: r.co === 'ctb' ? 'rgba(46,213,115,.1)' : r.co === 'lwb' ? 'rgba(0,168,132,.1)' : 'var(--amb-bg)',
              border: `1px solid ${r.co === 'ctb' ? 'rgba(46,213,115,.3)' : r.co === 'lwb' ? 'rgba(0,168,132,.3)' : 'var(--amb-bdr)'}` }}>
              {r.co === 'ctb' ? '城巴' : r.co === 'lwb' ? '龍運' : '九巴'}
            </div>
          </div>
        ))
      )}
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
