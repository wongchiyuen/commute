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
  const [showHourly, setShowHourly] = useState(false);
  const { temp, icon, humidity, warns, desc, forecast, hourlyForecast = [] } = weatherData;

  const clockStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}（${DAY[now.getDay()]}）`;

  // 只顯示當前小時起的未來時段
  const nowHourInt = parseInt(
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}` +
    `${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}`
  );
  const upcomingHourly = hourlyForecast
    .filter(h => parseInt(String(h.forecastHour)) >= nowHourInt)
    .slice(0, 24);

  const canToggle = upcomingHourly.length > 0;

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
        <>
          {/* 模式標籤列 — 點擊切換 */}
          <div
            onClick={() => canToggle && setShowHourly(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 6px 2px',
              cursor: canToggle ? 'pointer' : 'default',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--mid)', opacity: 0.65 }}>
              {showHourly ? '每小時預報' : '每日預報'}
            </span>
            {canToggle && (
              <span style={{ fontSize: 9, color: 'var(--mid)', opacity: 0.45 }}>
                {showHourly ? '切換每日 ↕' : '切換每小時 ↕'}
              </span>
            )}
          </div>

          {/* 預報橫列 — 整行亦可點擊切換 */}
          <div
            className="w-fore"
            onClick={() => canToggle && setShowHourly(v => !v)}
            style={canToggle ? { cursor: 'pointer' } : undefined}
          >
            {showHourly ? (
              upcomingHourly.map((h, i) => {
                const hrStr = String(h.forecastHour || '').slice(-2);
                const isNow = i === 0;
                return (
                  <div key={i} className={`fc${isNow ? ' hl' : ''}`}>
                    <div className={`fc-date${isNow ? ' named' : ''}`}>{hrStr}時</div>
                    <div className="fc-day" style={{ minHeight: '1em' }} />
                    <div className="fc-ico">{h.icon ?? '🌡'}</div>
                    <div className="fc-tt">
                      <span className="fc-hi">{h.forecastTemperature ?? '--'}°</span>
                    </div>
                    {h.forecastRelativeHumidity != null && (
                      <div className="fc-rh">💧{h.forecastRelativeHumidity}%</div>
                    )}
                  </div>
                );
              })
            ) : (
              forecast.slice(0, 9).map((f, i) => {
                const ds = String(f.forecastDate);
                const fcDate = new Date(parseInt(ds.slice(0,4)), parseInt(ds.slice(4,6))-1, parseInt(ds.slice(6,8)));
                const todayMid = new Date(); todayMid.setHours(0,0,0,0); fcDate.setHours(0,0,0,0);
                const diff = Math.round((fcDate - todayMid) / 86400000);
                const dateLbl = diff === 0 ? '今日' : diff === 1 ? '明日' : diff === 2 ? '後日' : `${ds.slice(4, 6)}/${ds.slice(6, 8)}`;
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
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
