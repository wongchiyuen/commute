import { pad } from '../utils/format.js';

const CO_CFG = {
  kmb:   { label: '九巴',      color: '#ffc03a', bg: 'rgba(240,165,0,.13)',   bdr: 'rgba(240,165,0,.35)'   },
  lwb:   { label: '龍運',      color: '#ff9f43', bg: 'rgba(255,159,67,.13)',  bdr: 'rgba(255,159,67,.38)'  },
  ctb:   { label: '城巴',      color: '#2ed573', bg: 'rgba(46,213,115,.1)',   bdr: 'rgba(46,213,115,.3)'   },
  joint: { label: '九巴+城巴', color: '#7ba8ff', bg: 'rgba(91,143,255,.1)',   bdr: 'rgba(91,143,255,.3)'   },
  mtr:   { label: '港鐵',      color: '#ff8a96', bg: 'rgba(231,76,60,.12)',   bdr: 'rgba(231,76,60,.35)'   },
  lrt:   { label: '輕鐵',      color: '#c8c2ff', bg: 'rgba(162,155,254,.12)', bdr: 'rgba(162,155,254,.38)' },
};
const ETA_TAG = { kmb: '九巴', lwb: '龍運', ctb: '城巴', mtr: '港鐵', lrt: '輕鐵' };
function etaMinLabel(ts, now) {
  if (!ts) return '--';
  const m = Math.round((ts - now) / 60000);
  return m <= 0 ? '即將' : `${m}分`;
}

export default function BusCard({ row, idx, onRemove, onDragStart, onClick }) {
  const { route, dest, stopName, dist, fare, companyType, etasWithType, dir, dirPair } = row;
  const now = Date.now();
  const validEtas = (etasWithType || []).filter(e => e.ts > now - 30000).slice(0, 3);
  const firstM = validEtas.length ? Math.round((validEtas[0].ts - now) / 60000) : null;
  const urgency = firstM === null ? '' : firstM <= 2 ? 'soon' : firstM <= 8 ? 'coming' : 'ok';
  const cfg = CO_CFG[companyType] || CO_CFG.kmb;
  const routeFontSize = route.length <= 3 ? '24px' : route.length === 4 ? '19px' : '15px';
  const distStr = dist ? `${dist}m` : '';
  const fareStr = fare != null ? ` ($${fare})` : '';
  const stopInfo = stopName + (distStr ? ` · ${distStr}` : '') + fareStr;
  const dirLabel = dir === 'I' ? '回程' : dir === 'O' ? '往程' : '';
  const statusLabel = firstM == null ? '暫無班次' : firstM <= 2 ? '即將到站' : firstM <= 8 ? '即將開出' : '班次正常';

  return (
    <div
      className={`bus-card-v2 ${urgency}`}
      style={{ animationDelay: `${idx * 0.04}s` }}
      onClick={onClick}
    >
      {onDragStart && (
        <div className="bcv2-drag-hdl" onTouchStart={e => onDragStart(e, idx)}>⠿</div>
      )}
      <div className="bcv2-badge" style={{ background: cfg.bg, borderColor: cfg.bdr }}>
        <div className="bcv2-route-no" style={{ color: cfg.color, fontSize: routeFontSize }}>{route}</div>
        <div className="bcv2-co-name" style={{ color: cfg.color, opacity: 0.9 }}>{cfg.label}</div>
      </div>
      <div className="bcv2-mid">
        <div className="bcv2-meta-row">
          {dirLabel && <span className="bcv2-dir-pill">{dirLabel}</span>}
          <span className={`bcv2-status-pill ${urgency || 'none'}`}>{statusLabel}</span>
        </div>
        {dirPair && (
          <div className="bcv2-dirpair">
            <span>往 {etaMinLabel(dirPair.O, now)}</span>
            <span className="bcv2-dirpair-sep">|</span>
            <span>回 {etaMinLabel(dirPair.I, now)}</span>
          </div>
        )}
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
          const minStr = m <= 0 ? '即將' : `${m}分`;
          const mc = m <= 2 ? 'sc' : m <= 8 ? 'cc' : 'oc';
          const etaColor = e.type === 'ctb' ? '#2ed573' : e.type === 'lwb' ? '#ff9f43' : 'var(--amb2)';
          return (
            <div key={i} className={`bcv2-eta-row${i === 0 ? ' e-first' : ''}`}>
              {companyType === 'joint' && (
                <span className="bcv2-eta-co" style={{ color: etaColor, minWidth: 24, fontSize: 9 }}>
                  {ETA_TAG[e.type] || ''}
                </span>
              )}
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
