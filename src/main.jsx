import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';

// PWA Service Worker auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a toast — the SW will update on next reload
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:76px;left:50%;transform:translateX(-50%);background:#1a1f30;border:1px solid #262f48;border-radius:10px;padding:9px 16px;font-size:13px;color:#e8eef9;white-space:nowrap;z-index:300;font-family:sans-serif;cursor:pointer';
    el.textContent = '✅ 有新版本，點擊更新';
    el.onclick = () => updateSW(true);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
