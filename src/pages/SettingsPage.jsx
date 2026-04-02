import { useState, useEffect } from 'react';
import { useApp, loadAutoTabs } from '../context/AppContext.jsx';
import { clearNearbyCache } from '../hooks/useNearby.js';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.1';

function HistoryCard() {
  const [events, setEvents] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const now = new Date(), mo = now.getMonth() + 1, d = now.getDate();
    fetch(`https://zh.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mo}/${d}`)
      .then(r => r.json())
      .then(data => {
        const evs = (data.selected || data.events || []).sort((a, b) => a.year - b.year);
        if (evs.length) setEvents(evs);
      })
      .catch(() => {});
  }, []);

  if (!events.length) return (
    <div className="history-card">
      <div style={{ fontSize: 13, color: 'var(--mid)', textAlign: 'center', padding: '16px 0' }}>載入中…</div>
    </div>
  );

  const ev = events[idx];
  const text = ev.text || ev.pages?.[0]?.description || '';
  const now = new Date();
  return (
    <div className="history-card" onClick={() => setIdx(i => (i + 1) % events.length)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div>
          <div className="history-date">{now.getMonth() + 1}月{now.getDate()}日 · 歷史上的今天</div>
          <div className="history-year">
            {ev.year}<sup style={{ fontSize: 14, fontWeight: 400, color: 'var(--amb)', marginLeft: 2 }}>年</sup>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap', paddingTop: 2, flexShrink: 0 }}>
          {idx + 1}/{events.length} ›
        </div>
      </div>
      <div className="history-text">{text}</div>
      <div className="history-src" style={{ marginTop: 8 }}>點擊切換事件 · 維基百科</div>
    </div>
  );
}

export default function SettingsPage({ isActive, openDrawer, showToast }) {
  const { profiles, selectedStn, transportSettings } = useApp();
  const cfg = loadAutoTabs();
  const active = profiles.filter(p => cfg[p.id]?.enabled);
  const { ctb, mtr, lrt } = transportSettings;
  const enabled = ['九巴'];
  if (ctb) enabled.push('城巴');
  if (mtr) enabled.push('港鐵');
  if (lrt) enabled.push('輕鐵');

  // ── 清除交通快取 ──────────────────────────────────────
  const [clearing, setClearing] = useState(false);
  const doClearCache = async () => {
    if (!confirm('確定清除附近班次快取？\n下次開啟「附近」時會重新下載站點資料（約需 10-15 秒）。')) return;
    setClearing(true);
    try {
      await clearNearbyCache();
      showToast('✅ 已清除快取，重新整理後生效');
    } catch {
      showToast('❌ 清除失敗，請重試');
    }
    setClearing(false);
  };

  return (
    <div className="page" id="page-settings" style={isActive ? { display: 'flex' } : {}}>
      <div className="settings-scroll">
        <HistoryCard />
        <div className="sett-card" style={{ marginTop: 12 }}>
          <div className="sett-row" onClick={() => openDrawer('⏰ 自動跳轉版面', 'auto-tab')}>
            <div className="sett-ico">⏰</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main">自動跳轉版面</div>
              <div className="sett-lbl-sub">
                {active.length ? `${active.map(p => p.name).join('、')} 已啟用` : '未啟用'}
              </div>
            </div>
            <div className="sett-chev">›</div>
          </div>
          <div className="sett-row" onClick={() => openDrawer('天氣詳情', 'weather-details')}>
            <div className="sett-ico">🌤</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main">天氣地點</div>
              <div className="sett-lbl-sub">{selectedStn}</div>
            </div>
            <div className="sett-chev">›</div>
          </div>
          <div className="sett-row" onClick={() => openDrawer('🚇 交通服務', 'transport')}>
            <div className="sett-ico">🚇</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main">交通服務</div>
              <div className="sett-lbl-sub">{enabled.join(' · ')}</div>
            </div>
            <div className="sett-chev">›</div>
          </div>
          {/* 清除交通快取 */}
          <div
            className="sett-row"
            onClick={clearing ? undefined : doClearCache}
            style={{ cursor: clearing ? 'default' : 'pointer', opacity: clearing ? 0.6 : 1 }}
          >
            <div className="sett-ico">🗑</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main" style={{ color: clearing ? 'var(--mid)' : 'var(--bright)' }}>
                {clearing ? '清除中…' : '清除附近班次快取'}
              </div>
              <div className="sett-lbl-sub">
                強制重新下載 KMB / CTB 站點資料
              </div>
            </div>
            <div className="sett-chev" style={{ fontSize: 13 }}>{clearing ? '⏳' : '›'}</div>
          </div>
          <div className="sett-row" onClick={() => openDrawer('🗂 資料管理', 'data')}>
            <div className="sett-ico">🗂</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main">資料管理</div>
              <div className="sett-lbl-sub">匯出 / 匯入路線備份</div>
            </div>
            <div className="sett-chev">›</div>
          </div>
          <div className="sett-row" onClick={() => openDrawer('📲 安裝到手機', 'install')}>
            <div className="sett-ico">📲</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main">安裝到手機</div>
              <div className="sett-lbl-sub">加至主畫面如原生 App</div>
            </div>
            <div className="sett-chev">›</div>
          </div>
          <div className="sett-row" onClick={() => openDrawer('🔔 天氣警告通知', 'notify')}>
            <div className="sett-ico">🔔</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main">天氣警告推播</div>
              <div className="sett-lbl-sub">
                {typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '✅ 已啟用' : '未啟用'}
              </div>
            </div>
            <div className="sett-chev">›</div>
          </div>
          <div className="sett-row" onClick={() => openDrawer('🌿 關於生活日常', 'about')}>
            <div className="sett-ico">🌿</div>
            <div className="sett-lbl">
              <div className="sett-lbl-main">關於生活日常</div>
              <div className="sett-lbl-sub">v{APP_VERSION} · 數據來源</div>
            </div>
            <div className="sett-chev">›</div>
          </div>
        </div>
      </div>
    </div>
  );
}
