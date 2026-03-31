import { useState, useCallback, useRef } from 'react';
import { NEWS_FEEDS, NEWS_FEED_KEYS, CACHE_TTL, NEWS_AUTO_INTERVAL_SEC } from '../constants/news.js';
import { fetchFeed } from '../utils/fetchFeed.js';

function cacheValid(key, store) {
  const e = store[key];
  if (!e || !e.ts) return false;
  if (e._failed) return (Date.now() - e.ts < 2 * 60 * 1000);
  return (Date.now() - e.ts < CACHE_TTL) && e.items?.length;
}

export function useNews() {
  const [cache, setCache] = useState({});
  const [currentFeed, setCurrentFeed] = useState('all');
  const [countdown, setCountdown] = useState(NEWS_AUTO_INTERVAL_SEC);
  const [autoStatus, setAutoStatus] = useState('idle'); // 'idle'|'loading'
  const timerRef = useRef(null);
  const cacheRef = useRef({});

  const _setCache = useCallback((updates) => {
    cacheRef.current = { ...cacheRef.current, ...updates };
    setCache(c => ({ ...c, ...updates }));
  }, []);

  const loadFeed = useCallback(async (key) => {
    if (key === 'all') {
      await Promise.all(NEWS_FEED_KEYS.map(k => loadFeed(k)));
      return;
    }
    const items = await fetchFeed(NEWS_FEEDS[key].url);
    if (items) {
      _setCache({ [key]: { items: items.map(i => ({ ...i, _src: key })), ts: Date.now() } });
    } else {
      _setCache({ [key]: { items: [], ts: Date.now(), _failed: true } });
    }
  }, [_setCache]);

  const ensureLoaded = useCallback(async (key) => {
    const cur = cacheRef.current;
    if (key === 'all') {
      const missing = NEWS_FEED_KEYS.filter(k => !cacheValid(k, cur));
      if (missing.length) {
        missing.forEach(k => loadFeed(k));
      }
    } else {
      if (!cacheValid(key, cur)) await loadFeed(key);
    }
  }, [loadFeed]);

  const reload = useCallback(async (key) => {
    const toClear = key === 'all' ? NEWS_FEED_KEYS : [key];
    const cleared = {};
    toClear.forEach(k => { cleared[k] = undefined; });
    _setCache(cleared);
    setAutoStatus('loading');
    await ensureLoaded(key);
    setAutoStatus('idle');
  }, [_setCache, ensureLoaded]);

  const hardReload = useCallback(async (key) => {
    const cleared = {};
    NEWS_FEED_KEYS.forEach(k => { cleared[k] = undefined; });
    _setCache(cleared);
    setAutoStatus('loading');
    await ensureLoaded(key);
    setAutoStatus('idle');
  }, [_setCache, ensureLoaded]);

  const getMerged = useCallback(() => {
    const all = [];
    NEWS_FEED_KEYS.forEach(k => (cacheRef.current[k]?.items || []).forEach(i => all.push(i)));
    return all.sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return tb - ta;
    });
  }, []);

  const startAutoRefresh = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(NEWS_AUTO_INTERVAL_SEC);
    let count = NEWS_AUTO_INTERVAL_SEC;
    timerRef.current = setInterval(() => {
      count--;
      setCountdown(Math.max(0, count));
      if (count <= 0) {
        count = NEWS_AUTO_INTERVAL_SEC;
        setCountdown(NEWS_AUTO_INTERVAL_SEC);
        NEWS_FEED_KEYS.forEach(k => { cacheRef.current[k] = undefined; });
        ensureLoaded(currentFeed);
      }
    }, 1000);
  }, [currentFeed, ensureLoaded]);

  const stopAutoRefresh = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    cache, currentFeed, setCurrentFeed,
    countdown, autoStatus,
    ensureLoaded, reload, hardReload, getMerged,
    startAutoRefresh, stopAutoRefresh,
    NEWS_FEED_KEYS,
  };
}
