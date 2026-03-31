import { useState, useCallback } from 'react';
import { AppProvider, useApp, NEARBY_PID, loadAutoTabs } from './context/AppContext.jsx';
import { useNews } from './hooks/useNews.js';
import { useTraffic } from './hooks/useTraffic.js';
import { Drawer, Toast } from './components/Overlay.jsx';
import HomePage from './pages/HomePage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import TrafficPage from './pages/TrafficPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import './styles/global.css';

const NAV = [
  { id: 'home',     ico: '🌿', lbl: '主頁' },
  { id: 'search',   ico: '🔍', lbl: '搜尋' },
  { id: 'news',     ico: '📰', lbl: '新聞' },
  { id: 'traffic',  ico: '🚦', lbl: '交通' },
  { id: 'settings', ico: '⚙️', lbl: '設定' },
];

function AppInner() {
  const { activePage, setActivePage, toast, showToast,
    profiles, activePid, setActivePid, reloadFavs } = useApp();

  const [drawer, setDrawer] = useState({ open: false, title: '', key: null });
  const newsHook = useNews();
  const trafficHook = useTraffic();

  const openDrawer = useCallback((title, key) => setDrawer({ open: true, title, key }), []);
  const closeDrawer = useCallback(() => setDrawer(d => ({ ...d, open: false })), []);

  const switchPage = (id) => {
    setActivePage(id);
    // Auto-load on page switch
    if (id === 'news') newsHook.ensureLoaded(newsHook.currentFeed);
    if (id === 'traffic' && !trafficHook.v2Data.length) trafficHook.load();
  };

  // Profile tabs
  const isNearby = activePid === NEARBY_PID;

  return (
    <>
      {/* Pages - render all, control visibility via CSS class */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Home page always rendered for weather refresh */}
        <div style={{ display: activePage === 'home' ? 'contents' : 'none' }}>
          {/* Profile tabs shared between home and shown here */}
          {activePage === 'home' && (
            <div className="profiles-bar">
              <button
                className={`profile-tab nearby-tab${isNearby ? ' active' : ''}`}
                onClick={() => { setActivePid(NEARBY_PID); }}>
                📍 附近
              </button>
              {profiles.map((p, i) => (
                <button key={p.id}
                  className={`profile-tab${p.id === activePid ? ' active' : ''}`}
                  onClick={() => { setActivePid(p.id); reloadFavs(p.id); }}>
                  {p.name}
                </button>
              ))}
              <button className="add-profile-btn" onClick={() => openDrawer('新增版面', 'add-profile')}>＋</button>
            </div>
          )}
          <HomePage openDrawer={openDrawer} closeDrawer={closeDrawer} showToast={showToast} />
        </div>

        <NewsPage newsHook={newsHook} isActive={activePage === 'news'} />
        <TrafficPage trafficHook={trafficHook} isActive={activePage === 'traffic'} />
        <SearchPage isActive={activePage === 'search'} />
        <SettingsPage isActive={activePage === 'settings'} openDrawer={openDrawer} showToast={showToast} />
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} className={`nav-btn${activePage === n.id ? ' active' : ''}`}
            onClick={() => switchPage(n.id)}>
            <span className="nav-ico">{n.ico}</span>
            <span className="nav-lbl">{n.lbl}</span>
          </button>
        ))}
      </nav>

      {/* Drawer */}
      <Drawer open={drawer.open} title={drawer.title} onClose={closeDrawer}>
        <DrawerContent drawerKey={drawer.key} closeDrawer={closeDrawer} showToast={showToast} />
      </Drawer>

      {/* Toast */}
      <Toast msg={toast.msg} visible={toast.visible} />
    </>
  );
}

// Drawer content router
function DrawerContent({ drawerKey, closeDrawer, showToast }) {
  const { transportSettings, saveTransport, profiles,
    updateProfiles, setActivePid, reloadFavs } = useApp();

  if (!drawerKey) return null;

  if (drawerKey === 'transport') {
    const { ctb, mtr, lrt } = transportSettings;
    const Toggle = ({ id, checked, onChange, label, sub }) => (
      <div className="sett-row" style={{ cursor: 'default' }}>
        <div className="sett-lbl"><div className="sett-lbl-main">{label}</div><div className="sett-lbl-sub">{sub}</div></div>
        <label className="toggle">
          <input type="checkbox" checked={checked} onChange={onChange} id={id} />
          <span className="toggle-slider" />
        </label>
      </div>
    );
    return (
      <div className="sett-card">
        <Toggle label="九巴 KMB" sub="預設啟用" checked disabled />
        <Toggle label="城巴 CTB" sub="rt.data.gov.hk" checked={ctb}
          onChange={e => { const s = { ...transportSettings, ctb: e.target.checked }; saveTransport(s); showToast('已儲存'); }} />
        <Toggle label="港鐵 MTR" sub="附近站下班車資料" checked={mtr}
          onChange={e => { const s = { ...transportSettings, mtr: e.target.checked }; saveTransport(s); showToast('已儲存'); }} />
        <Toggle label="輕鐵 LRT" sub="rt.data.gov.hk/mtr/lrt" checked={lrt}
          onChange={e => { const s = { ...transportSettings, lrt: e.target.checked }; saveTransport(s); showToast('已儲存'); }} />
      </div>
    );
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
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr2)', borderRadius: 11, padding: '14px 16px', marginBottom: 12 }}>
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
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>v2.1 · React + Vite · 2026</div>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--bdr2)', borderRadius: 11, overflow: 'hidden' }}>
          {sources.map(([ico, name, src, url], i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < sources.length - 1 ? '1px solid var(--bdr)' : 'none', textDecoration: 'none', color: 'inherit' }}>
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

  return <div className="msg">載入中…</div>;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
