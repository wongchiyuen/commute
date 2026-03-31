export const pad = n => String(n).padStart(2, '0');

export function relTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const diff = Math.round((Date.now() - d) / 60000);
  if (diff < 1) return '剛才';
  if (diff < 60) return diff + '分鐘前';
  if (diff < 1440) return Math.round(diff / 60) + '小時前';
  return Math.round(diff / 1440) + '天前';
}

export function esc(s) {
  return (s || '').replace(/'/g, "\\'");
}

export function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
  if (typeof v === 'object') return num(v.value ?? v.data ?? Object.values(v).find(x => typeof x === 'number' || typeof x === 'string'));
  return null;
}

export function hkoFind(arr, stn) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr.find(d => d.place === stn) ?? arr[0];
}

export function fmtTrafficTime(dateStr) {
  if (!dateStr) return '';
  const schemaA = dateStr.trim().match(/(\d{4})\/(\d+)\/(\d+)\s*(上午|下午)?\s*(\d+):(\d+)/);
  if (schemaA) {
    const [, y, mo, d, ampm, h, min] = schemaA;
    let hour = parseInt(h);
    if (ampm === '下午' && hour < 12) hour += 12;
    if (ampm === '上午' && hour === 12) hour = 0;
    const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), hour, parseInt(min));
    const diff = Math.round((Date.now() - dt.getTime()) / 60000);
    if (diff < 1) return '剛才';
    if (diff < 60) return diff + '分前';
    if (diff < 1440) return `${hour}:${String(parseInt(min)).padStart(2, '0')}`;
    return `${mo}/${d}`;
  }
  const dt = new Date(dateStr);
  if (isNaN(dt)) return '';
  const diff = Math.round((Date.now() - dt.getTime()) / 60000);
  if (diff < 1) return '剛才';
  if (diff < 60) return diff + '分前';
  if (diff < 1440) return `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}
