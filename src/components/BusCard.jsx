import { pad } from '../utils/format.js';

export default function BusCard({ row, idx, onRemove, onDragStart, onClick }) {
  const { route, dest, stopName, dist, fare, companyType, etasWithType } = row;
  const now = Date.now();
  const validEtas = (etasWithType || []).filter(e => e.ts > now - 30000).slice(0, 3);
  const firstM = validEtas.length ? Math.round((validEtas[0].ts - now) / 60000) : null;
  const urgency = firstM === null ? '' : firstM <= 2 ? 'soon' : firstM <= 8 ? 'coming' : 'ok';

  const isCTB = companyType === 'ctb';
  const isLWB = companyType === 'lwb';
  const isLRT = companyType === 'lrt';
  const isMTR = companyType === 'mtr';
  const isJoint = companyType === 'joint';

  const coLabel = isJoint ? '九巴+城巴' : isCTB ? '城巴' : isLWB ? '龍運' : isLRT ? '輕鐵' : isMTR ? '港鐵' : '九巴';
  const badgeBg = isCTB ? 'rgba(46,213,115,.1)' : isLWB ? 'rgba(181,130,42,.12)' : isLRT ? 'rgba(255,165,0,.1)' : isMTR ? 'rgba(255,71,87,.12)' : 'var(--amb-bg)';
  const badgeBdr = isCTB ? 'rgba(46,213,115,.3)' : isLWB ? 'rgba(181,130,42,.4)' : isLRT ? 'rgba(255,165,0,.35)' : isMTR ? 'rgba(255,71,87,.35)' : 'var(--amb-bdr)';
  const routeCol = isCTB ? '#2ed573' : isLWB ? '#c8972a' : isLRT ? '#ffaa33' : isMTR ? '#ff8a96' : 'var(--amb2)';
  const routeFontSize = route.length <= 3 ? '24px' : route.length === 4 ? '19px' : '15px';

  const distStr = dist ? `${dist}m` : '';
  const fareStr = fare != null ? ` ($${fare})` : '';
  const stopInfo = stopName + (distStr ? ` - ${distStr}` : '') + fareStr;

  return (
    <div
      className={`bus-card-v2 ${urgency}`}
      data-fare-key={`${route}_${companyType}`}
      style={{ animationDelay: `${idx * 0.04}s` }}
      onClick={onClick}
    >
      {onDragStart && (
        <div className="bcv2-drag-hdl" onTouchStart={e => onDragStart(e, idx)}>⠿</div>
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
      {onRemove && (
        <button className="bcv2-rm-btn" onClick={e => { e.stopPropagation(); onRemove(idx); }}>×</button>
      )}
    </div>
  );
}
