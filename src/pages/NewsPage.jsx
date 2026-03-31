import { useEffect } from 'react';
import { Spinner } from '../components/Overlay.jsx';
import { SRC_LABEL, SRC_COLOR } from '../constants/news.js';
import { relTime } from '../utils/format.js';

const TABS = [
  { key: 'all', label: '📋 全部' },
  { key: 'local', label: '本地' },
  { key: 'china', label: '大中華' },
  { key: 'world', label: '國際' },
  { key: 'finance', label: '財經' },
  { key: 'sport', label: '體育' },
];

export default function NewsPage({ newsHook, isActive }) {
  const { cache, currentFeed, setCurrentFeed, countdown, autoStatus,
    ensureLoaded, reload, hardReload, getMerged, startAutoRefresh, stopAutoRefresh } = newsHook;

  useEffect(() => {
    if (isActive) {
      ensureLoaded(currentFeed);
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  // eslint-disable-next-line
  }, [isActive]);

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0');
  const ss = String(countdown % 60).padStart(2, '0');
  const badgeText = autoStatus === 'loading' ? '載入中…' : `⟳ ${mm}:${ss} 後自動更新`;

  const getItems = () => {
    if (currentFeed === 'all') return getMerged();
    return cache[currentFeed]?.items || null;
  };

  const items = getItems();
  const isLoading = items === null || items === undefined;
  const isFailed = !isLoading && items.length === 0 && cache[currentFeed]?._failed;

  return (
    <div className="page" id="page-news" style={isActive ? { display: 'flex' } : {}}>
      <div className="feed-page">
        <div className="sub-tab-bar">
          {TABS.map(t => (
            <button key={t.key} className={`sub-tab${currentFeed === t.key ? ' active' : ''}`}
              onClick={() => { setCurrentFeed(t.key); ensureLoaded(t.key); }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="feed-toolbar">
          <span className="feed-auto-badge">{badgeText}</span>
          <button className="feed-refresh-btn" onClick={() => reload(currentFeed)}>↺ 更新</button>
          <button className="feed-hard-btn" onClick={() => { hardReload(currentFeed); }}>🗑 清除重載</button>
        </div>
        <div className="feed-list">
          {isLoading ? <Spinner /> : isFailed ? (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--bright)', marginBottom: 6 }}>無法載入資料</div>
              <div style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.7, marginBottom: 16 }}>
                RSS 代理服務器繁忙，請稍後重試。
              </div>
              <button onClick={() => reload(currentFeed)} style={{ background: 'var(--bg3)', border: '1px solid var(--bdr2)', color: 'var(--txt)', borderRadius: 9, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>↺ 重試</button>
            </div>
          ) : items.slice(0, 80).map((item, i) => (
            <a key={i} className="feed-item" href={item.link || '#'} target="_blank" rel="noreferrer"
              style={{ animationDelay: `${i * 0.01}s` }}>
              <div className="feed-item-title">{item.title}</div>
              {item.description && <div className="feed-item-desc">{item.description}</div>}
              <div className="feed-item-meta">
                {currentFeed === 'all' && item._src && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: SRC_COLOR[item._src] || 'var(--dim)', fontFamily: 'var(--mono)' }}>
                    {SRC_LABEL[item._src] || item._src}
                  </span>
                )}
                {item.pubDate && <span>{relTime(item.pubDate)}</span>}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
