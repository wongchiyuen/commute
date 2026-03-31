import { useState } from 'react';
import { getTrafficCat } from '../hooks/useTraffic.js';
import { relTime, fmtTrafficTime } from '../utils/format.js';

export function TrafficCard({ item, idx }) {
  const [expanded, setExpanded] = useState(false);
  const cat = getTrafficCat(item);

  let statusClass = 'st-new', statusLabel = '🆕 最新', cardClass = 'tc-new';
  const statusRaw = item.statusCN || '';
  if (statusRaw.includes('更新')) { statusClass = 'st-updated'; statusLabel = '🔄 更新'; cardClass = 'tc-updated'; }
  else if (statusRaw.includes('完結')) { statusClass = 'st-closed'; statusLabel = '✅ 完結'; cardClass = 'tc-closed'; }

  const typeLabel = { accident: '🚗 交通意外', works: '🚧 道路/工程', transit: '🚌 公共交通', other: '📋 其他' }[cat] || '📋 其他';
  const typeClass = { accident: '', works: 'tc-t-works', transit: 'tc-t-transit', other: 'tc-t-other' }[cat] || 'tc-t-other';

  const heading = item.headingCN || item.contentCN?.split('\n')[0]?.slice(0, 80) || '特別交通消息';
  const content = (item.contentCN || '').trim().replace(/\r\n|\r/g, '\n');
  const showContent = content && content !== heading && content.length > heading.length;
  const loc = [item.locationCN, item.directionCN && '往' + item.directionCN, item.nearLandmarkCN && '近' + item.nearLandmarkCN].filter(Boolean).join('　');
  const timeStr = item.announcementDate ? fmtTrafficTime(item.announcementDate) : '';

  return (
    <div className={`tc-card ${cardClass}`} style={{ animationDelay: `${idx * 0.025}s` }}>
      <div className="tc-inner">
        <div className="tc-hdr">
          <span className={`tc-type-badge ${typeClass}`}>{typeLabel}</span>
          <span className={`tc-status-badge ${statusClass}`}>{statusLabel}</span>
          {timeStr && <span className="tc-time">{timeStr}</span>}
        </div>
        <div className="tc-heading">{heading}</div>
        {loc && <div className="tc-location">📍 {loc}</div>}
        {showContent && (
          <div className={`tc-content${expanded ? ' expanded' : ''}`}>{content}</div>
        )}
        <div className="tc-footer">
          {item.districtCN && <span className="tc-district">{item.districtCN}</span>}
          {showContent && content.length > 100 && (
            <button className="tc-expand-btn" onClick={() => setExpanded(e => !e)}>
              {expanded ? '收起 ▴' : '展開 ▾'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RthkCard({ item, idx }) {
  const timeStr = relTime(item.pubDate);
  const desc = (item.description || '').trim();
  return (
    <a className="tc-card tc-new" href={item.link || '#'} target="_blank" rel="noreferrer"
      style={{ animationDelay: `${idx * 0.025}s`, textDecoration: 'none', color: 'inherit' }}>
      <div className="tc-inner">
        <div className="tc-hdr">
          <span className="tc-type-badge tc-t-rthk">📻 RTHK 交通</span>
          {timeStr && <span className="tc-time">{timeStr}</span>}
        </div>
        <div className="tc-heading">{item.title || ''}</div>
        {desc && <div className="tc-content" style={{ WebkitLineClamp: 3 }}>{desc}</div>}
      </div>
    </a>
  );
}
