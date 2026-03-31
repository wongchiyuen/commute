import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { NEARBY_PID } from '../constants/transport.js';
import { DAY } from '../constants/weather.js';

// ── Storage helpers ──────────────────────────────────────
export function loadProfiles() {
  const raw = localStorage.getItem('profiles_v2');
  if (raw) return JSON.parse(raw);
  const def = [{ id: 'p_a', name: '返工' }, { id: 'p_b', name: '放工' }, { id: 'p_c', name: '日常' }];
  localStorage.setItem('profiles_v2', JSON.stringify(def));
  return def;
}
export function saveProfiles(p) { localStorage.setItem('profiles_v2', JSON.stringify(p)); }
export function loadFavs(pid) { return JSON.parse(localStorage.getItem('favs_' + pid) || '[]'); }
export function saveFavs(pid, arr) {
  localStorage.setItem('favs_' + pid, JSON.stringify(
    arr.map(({ route, stopId, stopName, dest, serviceType, type }) => ({ route, stopId, stopName, dest, serviceType, type }))
  ));
}
export function loadAutoTabs() { return JSON.parse(localStorage.getItem('auto_tabs') || '{}'); }
export function saveAutoTabs(o) { localStorage.setItem('auto_tabs', JSON.stringify(o)); }

// ── Context ──────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Page navigation
  const [activePage, setActivePage] = useState('home');

  // Toast
  const [toast, setToast] = useState({ msg: '', visible: false });
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  }, []);

  // Drawer
  const [drawer, setDrawer] = useState({ open: false, title: '', content: null });
  const openDrawer = useCallback((title, content) => setDrawer({ open: true, title, content }), []);
  const closeDrawer = useCallback(() => setDrawer(d => ({ ...d, open: false })), []);

  // Profiles
  const [profiles, setProfiles] = useState(() => loadProfiles());
  const [activePid, setActivePidState] = useState(() => {
    const saved = localStorage.getItem('active_pid') || '';
    const ps = loadProfiles();
    return ps.find(p => p.id === saved) ? saved : (ps[0]?.id || NEARBY_PID);
  });

  const setActivePid = useCallback((pid) => {
    setActivePidState(pid);
    localStorage.setItem('active_pid', pid);
  }, []);

  const updateProfiles = useCallback((newProfiles) => {
    setProfiles(newProfiles);
    saveProfiles(newProfiles);
  }, []);

  // Favs
  const [favs, setFavsState] = useState(() => loadFavs(
    (() => {
      const saved = localStorage.getItem('active_pid') || '';
      const ps = loadProfiles();
      return ps.find(p => p.id === saved) ? saved : (ps[0]?.id || NEARBY_PID);
    })()
  ));

  const setFavs = useCallback((pid, newFavs) => {
    saveFavs(pid, newFavs);
    setFavsState(newFavs);
  }, []);

  const reloadFavs = useCallback((pid) => {
    setFavsState(loadFavs(pid));
  }, []);

  // Transport settings
  const [transportSettings, setTransportSettings] = useState(() => {
    const s = JSON.parse(localStorage.getItem('transport_settings') || 'null');
    if (s === null) return { ctb: true, mtr: false, lrt: false };
    if (s.ctb === undefined) s.ctb = true;
    return s;
  });

  const saveTransport = useCallback((s) => {
    setTransportSettings(s);
    localStorage.setItem('transport_settings', JSON.stringify(s));
  }, []);

  // Weather station
  const [selectedStn, setSelectedStnState] = useState(
    () => localStorage.getItem('hko_stn') || '香港天文台'
  );
  const setSelectedStn = useCallback((n) => {
    setSelectedStnState(n);
    localStorage.setItem('hko_stn', n);
  }, []);

  // Nearby distance
  const [nearbyDist, setNearbyDistState] = useState(
    () => parseInt(localStorage.getItem('nearby_dist') || '500')
  );
  const setNearbyDist = useCallback((m) => {
    setNearbyDistState(m);
    localStorage.setItem('nearby_dist', m);
  }, []);

  // GPS coordinates
  const [gpsCoords, setGpsCoords] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem('last_gps_v1') || 'null');
      if (c && c.lat && c.lng && (Date.now() - c.ts) < 24 * 60 * 60 * 1000) return c;
    } catch {}
    return null;
  });

  const saveGps = useCallback((lat, lng) => {
    const c = { lat, lng, ts: Date.now() };
    setGpsCoords(c);
    try { localStorage.setItem('last_gps_v1', JSON.stringify(c)); } catch {}
  }, []);

  // Auto-tab check
  const checkAutoTab = useCallback(() => {
    const cfg = loadAutoTabs();
    const now = new Date();
    const dow = now.getDay(), hhmm = now.getHours() * 60 + now.getMinutes();
    for (const p of loadProfiles()) {
      const c = cfg[p.id];
      if (!c || !c.enabled) continue;
      if (!c.days[dow]) continue;
      const [fh, fm] = (c.from || '00:00').split(':').map(Number);
      const [th, tm] = (c.to || '23:59').split(':').map(Number);
      if (hhmm >= fh * 60 + fm && hhmm <= th * 60 + tm) return p.id;
    }
    return NEARBY_PID;
  }, []);

  return (
    <AppContext.Provider value={{
      activePage, setActivePage,
      toast, showToast,
      drawer, openDrawer, closeDrawer,
      profiles, updateProfiles,
      activePid, setActivePid,
      favs, setFavs, reloadFavs,
      transportSettings, saveTransport,
      selectedStn, setSelectedStn,
      nearbyDist, setNearbyDist,
      gpsCoords, saveGps,
      checkAutoTab,
      DAY,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
export { NEARBY_PID };
