import { useState, useCallback } from 'react';
import { HKO, HKO_C, W_ICONS, WARN_MAP, AMB_WARNS, RHRREAD_STNS, TIDE_STNS, CLIMATE_STNS } from '../constants/weather.js';
import { nearestOf } from '../utils/geo.js';
import { num, hkoFind } from '../utils/format.js';

const _WARN_STORE_KEY = 'swd_last_warns';
function getStoredWarns() { try { return JSON.parse(localStorage.getItem(_WARN_STORE_KEY) || '[]'); } catch { return []; } }
function setStoredWarns(arr) { try { localStorage.setItem(_WARN_STORE_KEY, JSON.stringify(arr)); } catch {} }

// WMO weather code → emoji（Open-Meteo 使用 WMO 標準）
const WMO_ICONS = {
  0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
  45: '🌫', 48: '🌫',
  51: '🌦', 53: '🌦', 55: '🌧',
  61: '🌧', 63: '🌧', 65: '🌧',
  71: '🌨', 73: '🌨', 75: '❄️', 77: '🌨',
  80: '🌦', 81: '🌧', 82: '⛈',
  85: '🌨', 86: '❄️',
  95: '⛈', 96: '⛈', 99: '⛈',
};

export function useWeather(selectedStn, gpsCoords) {
  const [weatherData, setWeatherData] = useState({
    temp: null, icon: '🌡', humidity: null, humidityStn: '',
    warns: [], desc: '', forecast: [],
    hourlyForecast: [],
    todayMaxT: null, todayMinT: null,
    tide: [], tideLoaded: false, tideStn: '',
    sunrise: null, sunset: null,
    climMax: null, climMin: null, climAvg: null, climStn: '',
    radiation: null, radiationStn: '',
  });

  const loadWeather = useCallback(async (onNewWarn) => {
    try {
      // 決定座標（GPS > 選定站點 > 香港天文台預設）
      const stnCoords = RHRREAD_STNS.find(s => s.n === selectedStn);
      const hLat = gpsCoords?.lat ?? stnCoords?.lat ?? 22.3193;
      const hLng = gpsCoords?.lng ?? stnCoords?.lng ?? 114.1694;

      const [rhr, flw, fnd, warn, hourlyRes] = await Promise.all([
        fetch(`${HKO}?dataType=rhrread&lang=tc`).then(r => r.json()),
        fetch(`${HKO}?dataType=flw&lang=tc`).then(r => r.json()),
        fetch(`${HKO}?dataType=fnd&lang=tc`).then(r => r.json()),
        fetch(`${HKO}?dataType=warnsum&lang=tc`).then(r => r.json()),
        // Open-Meteo 每小時預報（免費，無需 API key）
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${hLat}&longitude=${hLng}` +
          `&hourly=temperature_2m,relativehumidity_2m,weathercode` +
          `&timezone=Asia%2FHong_Kong&forecast_days=2`,
          { signal: AbortSignal.timeout(8000) }
        ).then(r => r.json()).catch(() => null),
      ]);

      const te = hkoFind(rhr.temperature?.data, selectedStn);
      const he = hkoFind(rhr.humidity?.data, selectedStn);
      const ic = Array.isArray(rhr.icon) ? rhr.icon[0] : rhr.icon;
      const fcs = fnd.weatherForecast || [];
      const aw = Object.entries(warn)
        .filter(([, v]) => v?.actionCode && v.actionCode !== 'CANCEL')
        .map(([k]) => k);

      // 警告通知
      const last = getStoredWarns();
      const newWarns = aw.filter(k => !last.includes(k));
      const lifted = last.filter(k => !aw.includes(k));
      setStoredWarns(aw);
      if ((newWarns.length || lifted.length) && onNewWarn) {
        onNewWarn(newWarns, lifted, warn);
      }

      // 解析 Open-Meteo 每小時資料
      let hourlyForecast = [];
      if (hourlyRes?.hourly) {
        const { time, temperature_2m, relativehumidity_2m, weathercode } = hourlyRes.hourly;
        hourlyForecast = time.map((t, i) => ({
          // "2026-04-13T09:00" → "2026041309"
          forecastHour: t.replace(/[-:T]/g, '').slice(0, 10),
          forecastTemperature: Math.round(temperature_2m[i]),
          forecastRelativeHumidity: relativehumidity_2m[i],
          icon: WMO_ICONS[weathercode[i]] ?? '🌡',
        }));
      }

      setWeatherData(prev => ({
        ...prev,
        temp: num(te?.value),
        icon: W_ICONS[ic] ?? '🌡',
        humidity: num(he?.value),
        humidityStn: he?.place || selectedStn,
        warns: aw,
        desc: flw.forecastDesc || flw.outlook || '',
        forecast: fcs,
        hourlyForecast,
        todayMaxT: num(fcs[0]?.forecastMaxtemp),
        todayMinT: num(fcs[0]?.forecastMintemp),
      }));

      // 背景載入額外資料
      _loadExtra(selectedStn, gpsCoords, setWeatherData);
    } catch (e) { console.warn('[weather]', e); }
  }, [selectedStn, gpsCoords]);

  return { weatherData, loadWeather, W_ICONS, WARN_MAP, AMB_WARNS };
}

async function _loadExtra(selectedStn, gpsCoords, setWeatherData) {
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth() + 1, d = now.getDate();
  const moStr = String(mo).padStart(2, '0');
  const stnCoords = RHRREAD_STNS.find(s => s.n === selectedStn);
  const lat = gpsCoords?.lat ?? stnCoords?.lat;
  const lng = gpsCoords?.lng ?? stnCoords?.lng;
  if (!lat) return;

  // Tide
  try {
    const tstn = nearestOf(TIDE_STNS, lat, lng);
    const csv = await fetch(
      `https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=HLT&station=${tstn.code}&year=${y}&month=${moStr}&rformat=csv`,
      { signal: AbortSignal.timeout(8000) }
    ).then(r => r.text());
    const lines = csv.split('\n').map(l => l.trim()).filter(l => l && !/^[#A-Za-z]/i.test(l));
    const today = [];
    for (const line of lines) {
      const cols = line.split(',').map(s => s.trim());
      if (cols.length < 4) continue;
      let mo_col, d_col, t_col, h_col, type_col;
      if (cols.length >= 5 && !isNaN(parseInt(cols[0])) && !isNaN(parseInt(cols[1]))) {
        [mo_col, d_col, t_col, h_col, type_col] = [0, 1, 2, 3, 4];
      } else if (cols.length >= 4 && !isNaN(parseInt(cols[0]))) {
        [d_col, t_col, h_col, type_col] = [0, 1, 2, 3]; mo_col = null;
      } else continue;
      const rowMo = mo_col != null ? parseInt(cols[mo_col]) : mo;
      const rowD = parseInt(cols[d_col]);
      if (rowMo !== mo || rowD !== d) continue;
      const t = String(cols[t_col] || '').padStart(4, '0');
      const h = parseFloat(cols[h_col]);
      if (isNaN(h)) continue;
      today.push({ time: `${t.slice(0, 2)}:${t.slice(2, 4)}`, height: h, type: (cols[type_col] || '').toUpperCase() });
    }
    setWeatherData(prev => ({ ...prev, tide: today, tideLoaded: true, tideStn: tstn.n }));
  } catch { setWeatherData(prev => ({ ...prev, tideLoaded: true, tide: [] })); }

  // Sunrise/Sunset
  try {
    let csv = '';
    for (const url of [
      `https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=SRS&year=${y}&month=${moStr}&rformat=csv`,
      `https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=SRS&year=${y}&rformat=csv`,
    ]) {
      try { csv = await fetch(url, { signal: AbortSignal.timeout(6000) }).then(r => r.text()); if (csv?.length > 20) break; } catch {}
    }
    const lines = csv.split('\n').map(l => l.trim()).filter(l => l && !/^[#A-Za-z]/i.test(l));
    for (const line of lines) {
      const cols = line.split(',').map(s => s.trim());
      if (cols.length < 4) continue;
      let rowMo, rowD, riseIdx, setIdx;
      if (cols.length >= 5 && !isNaN(parseInt(cols[0])) && !isNaN(parseInt(cols[1]))) {
        rowMo = parseInt(cols[0]); rowD = parseInt(cols[1]); riseIdx = 2; setIdx = 4;
      } else if (cols.length >= 4 && !isNaN(parseInt(cols[0]))) {
        rowMo = mo; rowD = parseInt(cols[0]); riseIdx = 1; setIdx = 3;
      } else continue;
      if (rowMo !== mo || rowD !== d) continue;
      const toHHMM = v => { const s = String(v || '').trim().padStart(4, '0'); return `${s.slice(0, 2)}:${s.slice(2, 4)}`; };
      const rise = toHHMM(cols[riseIdx]), set = toHHMM(cols[setIdx]);
      if (rise !== '00:00' && set !== '00:00') {
        setWeatherData(prev => ({ ...prev, sunrise: rise, sunset: set }));
      }
      break;
    }
  } catch {}

  // Climate normals
  try {
    const cstn = nearestOf(CLIMATE_STNS, lat, lng);
    const [maxR, minR, avgR] = await Promise.all([
      fetch(`${HKO_C}?dataType=CLMMAXT&lang=tc&station=${cstn.code}&year=${y}&month=${moStr}`).then(r => r.json()).catch(() => null),
      fetch(`${HKO_C}?dataType=CLMMINT&lang=tc&station=${cstn.code}&year=${y}&month=${moStr}`).then(r => r.json()).catch(() => null),
      fetch(`${HKO_C}?dataType=CLMTEMP&lang=tc&station=${cstn.code}&year=${y}&month=${moStr}`).then(r => r.json()).catch(() => null),
    ]);
    const getClim = obj => {
      if (!obj) return null;
      const arr = obj.data || [];
      if (!arr.length) return null;
      return num(arr[arr.length - 1]?.value ?? arr[0]?.value);
    };
    setWeatherData(prev => ({
      ...prev,
      climMax: getClim(maxR), climMin: getClim(minR), climAvg: getClim(avgR), climStn: cstn.n,
    }));
  } catch {}
}
