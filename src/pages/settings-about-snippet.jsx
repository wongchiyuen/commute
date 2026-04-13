// SettingsPage.jsx 中 "關於生活日常" 部分
// 替換現有的 about section

// ── 版本號顯示 ──────────────────────────────────────────────
// __APP_VERSION__ 由 vite.config.js define 注入，格式：1.0.0+YYYYMMDD
// 若未定義則 fallback 至 "dev"
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

// ── About 卡片 JSX ──────────────────────────────────────────
<div className="settings-section">
  <div className="about-card">
    <img
      src="/icons/icon-192x192.png"
      alt="生活日常"
      className="about-app-icon"
    />
    <div className="about-info">
      <h2 className="about-app-name">生活日常</h2>
      <p className="about-version">版本 {APP_VERSION}</p>
      <p className="about-desc">香港通勤者日常資訊</p>
    </div>
  </div>
</div>

// ── CSS (加入現有 settings styles) ─────────────────────────
/*
.about-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--card-bg);
  border-radius: 12px;
}

.about-app-icon {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  flex-shrink: 0;
}

.about-app-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 4px;
}

.about-version {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 4px;
}

.about-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}
*/
