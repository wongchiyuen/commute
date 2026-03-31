import { useRef, useCallback } from 'react';

export function useGeolocation() {
  const inFlight = useRef(false);

  const getCurrentPosition = useCallback((onSuccess, onError) => {
    if (!navigator.geolocation) { onError?.({ code: 0, message: 'not supported' }); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    navigator.geolocation.getCurrentPosition(
      pos => { inFlight.current = false; onSuccess(pos); },
      err => { inFlight.current = false; onError?.(err); },
      { timeout: 15000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
    );
  }, []);

  const getHighAccuracy = useCallback((onSuccess, onError) => {
    if (!navigator.geolocation) { onError?.({ code: 0 }); return; }
    navigator.geolocation.getCurrentPosition(
      onSuccess, onError,
      { timeout: 15000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }, []);

  const checkPermission = useCallback(async () => {
    try {
      const ps = await navigator.permissions.query({ name: 'geolocation' });
      return ps.state; // 'granted' | 'denied' | 'prompt'
    } catch { return 'prompt'; }
  }, []);

  return { getCurrentPosition, getHighAccuracy, checkPermission };
}
