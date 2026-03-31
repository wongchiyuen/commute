import { KMB } from '../constants/transport.js';

const _fareCache = {};

export async function fetchKMBFare(route, dir, svcType) {
  const bound = (dir === 'O' || dir === 'outbound') ? 'outbound' : 'inbound';
  const altBound = bound === 'outbound' ? 'inbound' : 'outbound';
  const key = `kmb_${route}_${bound}_${svcType}`;
  if (_fareCache[key] !== undefined) return _fareCache[key];

  const _tryFetch = async (b) => {
    const ctrl = new AbortController();
    const _ft = setTimeout(() => ctrl.abort(), 10000);
    try {
      const resp = await fetch(`${KMB}/fare/${route}/${b}/${svcType}`, { signal: ctrl.signal });
      if (resp.status === 404 || resp.status === 422) return null;
      if (!resp.ok) return undefined; // transient error
      const d = await resp.json();
      const fares = (d.data || []).map(f => parseFloat(f.fare || f.fare_full || 0)).filter(f => f > 0);
      return fares.length ? Math.round(Math.max(...fares) * 10) / 10 : null;
    } catch (e) {
      return (e?.name === 'AbortError' || e?.name === 'TypeError') ? undefined : null;
    } finally { clearTimeout(_ft); }
  };

  try {
    let fare = await _tryFetch(bound);
    if (fare === null) fare = await _tryFetch(altBound);
    if (fare === undefined) return null; // network error — don't cache
    _fareCache[key] = fare;
    return fare;
  } catch { return null; }
}
