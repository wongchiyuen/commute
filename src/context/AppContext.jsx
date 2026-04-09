import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const [addRouteTargetPid, setAddRouteTargetPid] = useState(null);

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

  // ── activePid 預設為「附近」而非第一個版面 ──────────────
  // 若 localStorage 有上次選擇的版面且仍存在則恢復，否則用附近
  const [activePid, setActivePidState] = useState(() => {
    const saved = localStorage.getItem('active_pid') || '';
    const ps = loadProfiles();
    return ps.find(p => p.id === saved) ? saved : NEARBY_PID;
  });

  const setActivePid = useCallback((pid) => {
    setActivePidState(pid);
    localStorage.setItem('active_pid', pid);
  }, []);

  const updateProfiles = useCallback((newProfiles) => {
    setProfiles(newProfiles);
    saveProfiles(newProfiles);
  }, []);

  // ── 刪除版面（同步清除 auto-tab 設定，切換至附近）────────
  const deleteProfile = useCallback((pid) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== pid);
      saveProfiles(next);
      return next;
    });
    // 清除孤兒 auto-tab 設定
    const at = loadAutoTabs();
    if (at[pid]) {
      delete at[pid];
      saveAutoTabs(at);
    }
    // 若正在使用被刪版面，切到附近
    setActivePidState(cur => {
      if (cur === pid) {
        localStorage.setItem('active_pid', NEARBY_PID);
        return NEARBY_PID;
      }
      return cur;
    });
  }, []);

  // ── 上下移動版面順序 ──────────────────────────────────
  const moveProfile = useCallback((pid, dir) => {
    // dir: -1 上移, +1 下移
    setProfiles(prev => {
      const idx = prev.findIndex(p => p.id === pid);
      if (idx < 0) return prev;
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      saveProfiles(next);
      return next;
    });
  }, []);

  // Favs
  const [favs, setFavsState] = useState(() => loadFavs(
    (() => {
      const saved = localStorage.getItem('active_pid') || '';
      const ps = loadProfiles();
      return ps.find(p => p.id === saved) ? saved : NEARBY_PID;
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

  // ── 自動跳轉版面（每個 browser session 只執行一次）────────
  // 用 sessionStorage flag 保護：用戶手動切 tab 後重新整理不受影響，
  // 但關閉瀏覽器重新開啟則再次按時間匹配
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

  useEffect(() => {
    // 已在此 session 執行過則跳過（防止手動切 tab 後被覆蓋）
    if (sessionStorage.getItem('auto_tab_done')) return;
    sessionStorage.setItem('auto_tab_done', '1');
    const pid = checkAutoTab();
    if (pid !== NEARBY_PID) {
      setActivePidState(pid);
      localStorage.setItem('active_pid', pid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppContext.Provider value={{
      activePage, setActivePage,
      addRouteTargetPid, setAddRouteTargetPid,
      toast, showToast,
      drawer, openDrawer, closeDrawer,
      profiles, updateProfiles,
      deleteProfile, moveProfile,
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
