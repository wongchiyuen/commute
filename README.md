# 生活日常 · SWD Daily

香港交通、天氣、新聞一手掌握。React + Vite PWA，部署於 Cloudflare Pages。

## 技術棧

- **框架**: React 18 + Vite 6
- **PWA**: vite-plugin-pwa (Workbox 自動生成 Service Worker)
- **部署**: Cloudflare Pages + GitHub Actions CI/CD
- **數據**: 全部使用 data.gov.hk 官方開放數據

## 目錄結構

```
src/
  constants/    — 靜態常數（天氣站、路線資料等）
  utils/        — 工具函數（IDB、地理、格式化、fetchFeed）
  context/      — 全局狀態 (AppContext)
  hooks/        — 業務邏輯 (useWeather, useNearby, useNews, useTraffic)
  components/   — UI 組件 (BusCard, WeatherPanel, Drawer…)
  pages/        — 頁面 (Home, News, Traffic, Search, Settings)
functions/
  proxy.js      — Cloudflare Pages Function CORS Proxy
  warn.js       — 天氣警告推播 Cron
```

## GitHub Actions 設定

1. 在 GitHub repo → **Settings → Secrets → Actions** 新增：
   - `CLOUDFLARE_API_TOKEN` — Cloudflare API Token（需要 Pages:Edit 權限）
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID

2. Push 到 `main` branch 即自動 build + deploy。

## 本地開發（可選）

```bash
npm install
npm run dev      # localhost:5173
npm run build    # 輸出至 dist/
```

## 數據來源

| 服務 | API |
|------|-----|
| 天氣 | 香港天文台 opendata.php |
| 九巴 | data.etabus.gov.hk |
| 城巴 | rt.data.gov.hk/v2/transport/citybus |
| 港鐵/輕鐵 | rt.data.gov.hk/v1/transport/mtr |
| 交通消息 | resource.data.one.gov.hk/td |
| 新聞 | RTHK RSS via /proxy |
