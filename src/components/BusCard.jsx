import { pad } from '../utils/format.js';

export default function BusCard({ row, idx, onRemove, onMoveUp, onMoveDown, onDragStart, onClick }) {
  const { route, dest, stopName, dist, fare, companyType, etasWithType } = row;
  const now = Date.now();
  const validEtas = (etasWithType || []).filter(e => e.ts > now - 30000).slice(0, 3);
  const firstM = validEtas.length ? Math.round((validEtas[0].ts - now) / 60000) : null;
  const urgency = firstM === null ? '' : firstM <= 2 ? 'soon' : firstM <= 8 ? 'coming' : 'ok';

  const isCTB = companyType === 'ctb';
  const isLRT = companyType === 'lrt';
  const isMTR = companyType === 'mtr';
  const isJoint = companyType === 'joint';

  const coLabel = isJoint ? '九巴+城巴' : isCTB ? '城巴' : isLRT ? '輕鐵' : isMTR ? '港鐵' : '九巴';
  const badgeBg = isCTB ? 'rgba(46,213,115,.1)' : isLRT ? 'rgba(255,165,0,.1)' : isMTR ? 'rgba(255,71,87,.12)' : 'var(--amb-bg)';
  const badgeBdr = isCTB ? 'rgba(46,213,115,.3)' : isLRT ? 'rgba(255,165,0,.35)' : isMTR ? 'rgba(255,71,87,.35)' : 'var(--amb-bdr)';
  const routeCol = isCTB ? '#2ed573' : isLRT ? '#ffaa33' : isMTR ? '#ff8a96' : 'var(--amb2)';
  const routeFontSize = route.length <= 3 ? '24px' : route.length === 4 ? '19px' : '15px';

  const distStr = dist ? `${dist}m` : '';
  const fareStr = fare != null ? ` ($${fare})` : '';
  const stopInfo = stopName + (distStr ? ` - ${distStr}` : '') + fareStr;

  // 編輯模式：有 ↑↓ 其中一個即進入
  const isEditMode = onMoveUp !== undefined || onMoveDown !== undefined;

  return (
    <div
      className={`bus-card-v2 ${urgency}`}
      data-fare-key={`${route}_${companyType}`}
      style={{ animationDelay: `${idx * 0.04}s` }}
      onClick={isEditMode ? undefined : onClick}
    >
      {/* 拖曳柄（非編輯模式才顯示）*/}
      {onDragStart && !isEditMode && (
        <div className="bcv2-drag-hdl" onTouchStart={e => onDragStart(e, idx)}>⠿</div>
      )}

      {/* 排序按鈕（編輯模式）*/}
      {isEditMode && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2, padding: '0 6px 0 2px',
            flexShrink: 0,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onMoveUp}
            disabled={!onMoveUp}
            style={{
              background: onMoveUp ? 'var(--bg3)' : 'transparent',
              border: '1px solid var(--bdr2)',
              borderRadius: 6, color: onMoveUp ? 'var(--bright)' : 'var(--dim)',
              fontSize: 13, width: 28, height: 28,
              cursor: onMoveUp ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >↑</button>
          <button
            onClick={onMoveDown}
            disabled={!onMoveDown}
            style={{
              background: onMoveDown ? 'var(--bg3)' : 'transparent',
              border: '1px solid var(--bdr2)',
              borderRadius: 6, color: onMoveDown ? 'var(--bright)' : 'var(--dim)',
              fontSize: 13, width: 28, height: 28,
              cursor: onMoveDown ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >↓</button>
        </div>
      )}

      <div className="bcv2-badge" style={{ background: badgeBg, borderColor: badgeBdr }}>
        <div className="bcv2-route-no" style={{ color: routeCol, fontSize: routeFontSize }}>{route}</div>
        <div className="bcv2-co-name">{coLabel}</div>
      </div>
      <div className="bcv2-mid">
        <div className="bcv2-dest-lbl">往 {dest}</div>
        <div className="bcv2-stop-lbl">{stopInfo}</div>
      </div>
      <div className="bcv2-etas">
        {validEtas.length === 0 ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--dim)' }}>無班次</div>
        ) : validEtas.map((e, i) => {
          const m = Math.round((e.ts - now) / 60000);
          const dv = new Date(e.ts);
          const timeStr = `${pad(dv.getHours())}:${pad(dv.getMinutes())}`;
          const minStr = m <= 0 ? '即將' : m + '分';
          const mc = m <= 2 ? 'sc' : m <= 8 ? 'cc' : 'oc';
          const coTag = isJoint ? (e.type === 'ctb' ? '城巴' : e.type === 'lrt' ? '輕' : e.type === 'mtr' ? '港鐵' : '九巴') : '';
          return (
            <div key={i} className={`bcv2-eta-row${i === 0 ? ' e-first' : ''}`}>
              {isJoint && <span className="bcv2-eta-co">{coTag}</span>}
              <span className="bcv2-eta-time">{timeStr}</span>
              <span className={`bcv2-eta-mins ${mc}`}>{minStr}</span>
            </div>
          );
        })}
      </div>

      {/* 刪除按鈕：編輯模式時亦顯示 */}
      {onRemove && (
        <button className="bcv2-rm-btn" onClick={e => { e.stopPropagation(); onRemove(idx); }}>×</button>
      )}
    </div>
  );
}
