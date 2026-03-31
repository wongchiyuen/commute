import { useState, useCallback } from 'react';
import { AppProvider, useApp, NEARBY_PID } from './context/AppContext.jsx';
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
  const { activePage, setActivePage, toast, showToast } = useApp();
  const [drawer, setDrawer] = useState({ open: false, title: '', key: null });
  const newsHook = useNews();
  const trafficHook = useTraffic();

  const openDrawer = useCallback((title, key) => setDrawer({ open: true, title, key }), []);
  const closeDrawer = useCallback(() => setDrawer(d => ({ ...d, open: false })), []);

  const switchPage = (id) => {
    setActivePage(id);
    if (id === 'news') newsHook.ensureLoaded(newsHook.currentFeed);
    if (id === 'traffic' && !trafficHook.v2Data.length) trafficHook.load();
  };

  return (
    <>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* HomePage 自己負責渲染 profiles bar（天氣面板之下） */}
        <div style={{ display: activePage === 'home' ? 'contents' : 'none' }}>
          <HomePage openDrawer={openDrawer} showToast={showToast} />
        </div>

        <NewsPage newsHook={newsHook} isActive={activePage === 'news'} />
        <TrafficPage trafficHook={trafficHook} isActive={activePage === 'traffic'} />
        <SearchPage isActive={activePage === 'search'} />
        <SettingsPage isActive={activePage === 'settings'} openDrawer={openDrawer} showToast={showToast} />
      </div>

      {/* 底部導航 */}
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
        <DrawerContent
          drawerKey={drawer.key}
          closeDrawer={closeDrawer}
          showToast={showToast}
          newsHook={newsHook}
        />
      </Drawer>

      <Toast msg={toast.msg} visible={toast.visible} />
    </>
  );
}

// ── Drawer 內容路由 ───────────────────────────────────────
function DrawerContent({ drawerKey, closeDrawer, showToast, newsHook }) {
  const { transportSettings, saveTransport, profiles, updateProfiles,
    setActivePid, reloadFavs, selectedStn, setSelectedStn,
    gpsCoords, saveGps } = useApp();

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
          <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
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
    const { RHRREAD_STNS } = require('./constants/weather.js');
    return (
      <div>
        <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 10 }}>選擇天氣測站</div>
        <div className="loc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {RHRREAD_STNS.map(s => (
            <div key={s.n}
              style={{
                background: s.n === selectedStn ? 'var(--amb-bg)' : 'var(--bg3)',
                border: `1px solid ${s.n === selectedStn ? 'var(--amb-bdr)' : 'var(--bdr)'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all .15s',
              }}
              onClick={() => { setSelectedStn(s.n); closeDrawer(); showToast(`已切換至 ${s.n}`); }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: s.n === selectedStn ? 'var(--amb2)' : 'var(--txt)' }}>{s.n}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── 自動跳轉版面 ──────────────────────────────────────
  if (drawerKey === 'auto-tab') {
    const { loadAutoTabs, saveAutoTabs } = require('./context/AppContext.jsx');
    const DAY = ['日','一','二','三','四','五','六'];
    const [cfg, setCfg] = useState(() => loadAutoTabs());

    const update = (pid, patch) => {
      const next = { ...cfg, [pid]: { ...(cfg[pid] || { enabled: false, days: [false,false,false,false,false,false,false], from: '07:00', to: '09:00' }), ...patch } };
      setCfg(next);
      saveAutoTabs(next);
    };

    return (
      <div>
        {profiles.map(p => {
          const c = cfg[p.id] || { enabled: false, days: [false,false,false,false,false,false,false], from: '07:00', to: '09:00' };
          return (
            <div key={p.id} className="auto-tab-card">
              <div className="auto-tab-hdr">
                <div className="auto-tab-name">{p.name}</div>
                <label className="toggle">
                  <input type="checkbox" checked={!!c.enabled}
                    onChange={e => update(p.id, { enabled: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="auto-tab-body" style={{ opacity: c.enabled ? 1 : 0.4, pointerEvents: c.enabled ? 'auto' : 'none' }}>
                <div style={{ fontSize: 10, color: 'var(--mid)', marginBottom: 7 }}>啟用日子</div>
                <div className="days-row">
                  {DAY.map((d, i) => (
                    <button key={i} className={`day-btn${c.days[i] ? ' on' : ''}`}
                      onClick={() => {
                        const days = [...c.days]; days[i] = !days[i];
                        update(p.id, { days });
                      }}>{d}</button>
                  ))}
                </div>
                <div className="time-row">
                  <span className="time-lbl">時間：</span>
                  <input className="time-inp" type="time" value={c.from || '07:00'}
                    onChange={e => update(p.id, { from: e.target.value })} />
                  <span className="time-lbl">至</span>
                  <input className="time-inp" type="time" value={c.to || '09:00'}
                    onChange={e => update(p.id, { to: e.target.value })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── 資料管理 ──────────────────────────────────────────
  if (drawerKey === 'data') {
    const { loadFavs, saveFavs, saveProfiles } = require('./context/AppContext.jsx');
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

  // ── 天氣警告通知 ──────────────────────────────────────
  if (drawerKey === 'notify') {
    const [perm, setPerm] = useState(Notification?.permission || 'unsupported');
    const isOn = perm === 'granted';
    const toggle = async () => {
      if (!('Notification' in window)) return;
      if (isOn) { showToast('請到瀏覽器設定關閉通知權限'); return; }
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result === 'granted') showToast('✅ 已啟用天氣警告通知');
    };
    if (!('Notification' in window)) return <div className="msg">此裝置不支援通知</div>;
    if (perm === 'denied') return <div className="msg">❌ 通知已被封鎖<br /><small style={{ color: 'var(--dim)' }}>請到瀏覽器設定允許通知</small></div>;
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

  // ── 新增版面 ──────────────────────────────────────────
  if (drawerKey === 'add-profile') {
    const [name, setName] = useState('');
    const confirm = () => {
      if (!name.trim()) return;
      const id = 'p_' + Date.now();
      const newProfiles = [...profiles, { id, name: name.trim() }];
      updateProfiles(newProfiles);
      closeDrawer();
      showToast(`已新增「${name.trim()}」`);
    };
    return (
      <div>
        <div className="sec-lbl">版面名稱</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="d-input" value={name} placeholder="如：上班、週末…" maxLength={10}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirm()}
            autoFocus />
          <button className="d-btn" onClick={confirm}>確定</button>
        </div>
      </div>
    );
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

  // ── 關於 ──────────────────────────────────────────────
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
