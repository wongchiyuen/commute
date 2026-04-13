// vite.config.js — 版本號注入
// 格式：package.json version + build date，例如 "1.2.0+20250413"
// 每次 GitHub Actions build 都會自動帶上當日日期，版本號永遠是最新的

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// 建立版本字串：semver + build date
const buildDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const appVersion = `${pkg.version}+${buildDate}`

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  // ... 其他現有設定保持不變
})

// ──────────────────────────────────────────────────────────────
// 若想改成純日期版本（不依賴 package.json semver 手動維護），
// 可改為：
//   const appVersion = new Date().toISOString().slice(0,10)  // "2025-04-13"
// ──────────────────────────────────────────────────────────────
