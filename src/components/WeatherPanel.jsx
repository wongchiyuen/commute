import { useState, useEffect } from 'react';
import { DAY, WARN_MAP, AMB_WARNS, W_ICONS } from '../constants/weather.js';
import { pad } from '../utils/format.js';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function WeatherPanel({ weatherData, selectedStn, refreshing, onRefresh, onOpenDetails }) {
  const now = useClock();
  const { temp, icon, humidity, warns, desc, forecast } = weatherData;

  const clockStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（${DAY[now.getDay()]}）`;

  return (
    <div className="w-panel">
      <div className="w-r1">
        <div className="w-templeft">
          <div className="w-icon">{icon}</div>
          <div>
            <div className="w-temp-big">
              <span>{temp ?? '--'}</span><sup>°C</sup>
            </div>
            {humidity != null && (
              <div className="w-hum-badge" onClick={onOpenDetails} style={{ cursor: 'pointer' }}>
                <span className="w-hum-val">{humidity}%</span>
                <span className="w-hum-lbl">濕度</span>
              </div>
            )}
          </div>
        </div>
        <div className="w-right">
          <div className="w-clock">{clockStr}</div>
          <div className="w-date">{dateStr}</div>
          <div className="w-btns">
            <button className="w-btn" onClick={onOpenDetails}>
              📍 <span>{selectedStn}</span>
            </button>
            <button className={`w-btn${refreshing ? ' spinning' : ''}`} onClick={onRefresh}>
              <span className="ico">↺</span> 更新
            </button>
          </div>
        </div>
      </div>

      {warns.length > 0 && (
        <div className="w-warns">
          {warns.map(k => (
            <span key={k} className={`warn-pill${AMB_WARNS.has(k) ? ' amb' : ''}`}>
              ⚠ {WARN_MAP[k] || k}
            </span>
          ))}
        </div>
      )}

      {desc && <div className="w-desc">{desc}</div>}

      {forecast.length > 0 && (
        <div className="w-fore">
          {forecast.slice(0, 9).map((f, i) => {
            const ds = String(f.forecastDate);
            const dateLbl = i === 0 ? '今日' : i === 1 ? '明日' : i === 2 ? '後日' : `${ds.slice(4, 6)}/${ds.slice(6, 8)}`;
            const weekLbl = f.week || '';
            const hl = i <= 2;
            const maxT = f.forecastMaxtemp?.value ?? f.forecastMaxtemp ?? '--';
            const minT = f.forecastMintemp?.value ?? f.forecastMintemp ?? '--';
            const maxRH = f.forecastMaxrh?.value ?? f.forecastMaxrh;
            const minRH = f.forecastMinrh?.value ?? f.forecastMinrh;
            const rhStr = maxRH != null && minRH != null ? `${minRH}-${maxRH}%` : '';
            const psr = f.PSR || '';
            const psrDotClass = psr === '低' ? 'low' : psr === '中低' ? 'medlow' : psr === '中' ? 'med' : psr === '中高' ? 'medhigh' : psr === '高' ? 'high' : 'low';
            const iconCode = f.ForecastIcon ?? f.forecastIcon ?? parseInt(f.forecastWeather);
            return (
              <div key={i} className={`fc${hl ? ' hl' : ''}`}>
                <div className={`fc-date${hl ? ' named' : ''}`}>{dateLbl}</div>
                <div className={`fc-day${hl ? ' named' : ''}`}>{weekLbl}</div>
                <div className="fc-ico">{W_ICONS[iconCode] ?? '🌡'}</div>
                <div className="fc-tt">
                  <span className="fc-lo">{minT}°</span>
                  <span className="fc-sep">|</span>
                  <span className="fc-hi">{maxT}°</span>
                </div>
                {rhStr && <div className="fc-rh">💧{rhStr}</div>}
                {psr && (
                  <div className="fc-psr" style={{ fontSize: 9, color: 'var(--mid)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span className={`fc-psr-dot ${psrDotClass}`} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: psrDotClass === 'low' ? '#2ed573' : psrDotClass === 'medlow' ? '#7ba8ff' : psrDotClass === 'med' ? '#f0a500' : psrDotClass === 'medhigh' ? '#ff7b5a' : '#ff4757' }} />
                    {psr}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
