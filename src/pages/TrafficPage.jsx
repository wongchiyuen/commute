import { useEffect } from 'react';
import { TrafficCard, RthkCard } from '../components/TrafficCard.jsx';
import { Spinner } from '../components/Overlay.jsx';

const CATS = [
  { key: 'all', label: '📋 全部' },
  { key: 'accident', label: '🚗 交通意外' },
  { key: 'works', label: '🚧 道路工程' },
  { key: 'transit', label: '🚌 公共交通' },
  { key: 'new', label: '🆕 最新/更新' },
  { key: 'closed', label: '✅ 完結' },
];

export default function TrafficPage({ trafficHook, isActive }) {
  const { srcLabel, loading, currentCat, setCurrentCat, countdown,
    load, reload, hardReload, startAutoRefresh, stopAutoRefresh, getFiltered, v2Data } = trafficHook;

  useEffect(() => {
    if (isActive) {
      if (!v2Data.length) load();
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  // eslint-disable-next-line
  }, [isActive]);

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0');
  const ss = String(countdown % 60).padStart(2, '0');
  const badgeText = loading ? '更新中…' : `⟳ ${mm}:${ss} 後自動更新`;

  const { td, rthk } = getFiltered();
  const newCount = v2Data.filter(i => !(i.statusCN || '').includes('完結')).length;

  return (
    <div className="page" id="page-traffic" style={isActive ? { display: 'flex' } : {}}>
      <div className="feed-page">
        <div className="sub-tab-bar">
          {CATS.map(t => (
            <button key={t.key} className={`sub-tab${currentCat === t.key ? ' active' : ''}`}
              onClick={() => setCurrentCat(t.key)}>
              {t.key === 'all' && newCount > 0
                ? <>{t.label}<span className="tc-count-badge">{newCount}</span></>
                : t.label}
            </button>
          ))}
        </div>
        <div className="feed-toolbar">
          <span className="feed-auto-badge">{badgeText}</span>
          <span style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>{srcLabel}</span>
          <button className="feed-refresh-btn" onClick={reload}>↺ 更新</button>
          <button className="feed-hard-btn" onClick={hardReload}>🗑 清除重載</button>
        </div>
        <div className="feed-list">
          {loading && !td.length && !rthk.length ? <Spinner /> : (
            td.length === 0 && rthk.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🚦</div>
                <div className="empty-text">目前沒有相關消息</div>
                <div className="empty-sub">交通暢順，繼續留意最新消息</div>
              </div>
            ) : (
              <>
                {currentCat === 'all' && td.length > 0 && rthk.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', fontFamily: 'var(--mono)', margin: '4px 2px 8px' }}>🚦 運輸署特別交通消息</div>
                )}
                {td.map((item, i) => <TrafficCard key={item.id || i} item={item} idx={i} />)}
                {rthk.length > 0 && (
                  <>
                    {currentCat === 'all' && td.length > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', fontFamily: 'var(--mono)', margin: '12px 2px 8px' }}>📻 RTHK 交通廣播</div>
                    )}
                    {rthk.map((item, i) => <RthkCard key={i} item={item} idx={td.length + i} />)}
                  </>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
