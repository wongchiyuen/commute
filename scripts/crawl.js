#!/usr/bin/env node
/**
 * 生活日常 Bus Data Crawler
 * 資料來源：data.gov.hk (KMB/LWB) + rt.data.gov.hk (CTB)
 * 輸出：scripts/output/stops.json + scripts/output/routes.json
 * 供 GitHub Actions 每日執行
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'output');

const KMB = 'https://data.etabus.gov.hk/v1/transport/kmb';
const CTB = 'https://rt.data.gov.hk/v2/transport/citybus';

// ── MTR 站點（靜態，極少變動）────────────────────────────
const MTR_STNS = [
  // 荃灣綫 TWL
  { id: 'CEN', n: '中環',   lat: 22.2822, lng: 114.1579, lines: ['TWL','ISL'] },
  { id: 'ADM', n: '金鐘',   lat: 22.2789, lng: 114.1650, lines: ['TWL','ISL','SIL'] },
  { id: 'TST', n: '尖沙咀', lat: 22.2975, lng: 114.1722, lines: ['TWL'] },
  { id: 'JOR', n: '佐敦',   lat: 22.3051, lng: 114.1715, lines: ['TWL'] },
  { id: 'YMT', n: '油麻地', lat: 22.3127, lng: 114.1706, lines: ['TWL','KTL'] },
  { id: 'MOK', n: '旺角',   lat: 22.3198, lng: 114.1693, lines: ['TWL','KTL'] },
  { id: 'PRE', n: '太子',   lat: 22.3247, lng: 114.1686, lines: ['TWL','KTL'] },
  { id: 'SSP', n: '深水埗', lat: 22.3305, lng: 114.1626, lines: ['TWL'] },
  { id: 'CSW', n: '長沙灣', lat: 22.3355, lng: 114.1551, lines: ['TWL'] },
  { id: 'LCK', n: '荔枝角', lat: 22.3376, lng: 114.1481, lines: ['TWL'] },
  { id: 'MEF', n: '美孚',   lat: 22.3379, lng: 114.1379, lines: ['TWL','TCL','TML'] },
  { id: 'LAK', n: '荔景',   lat: 22.3480, lng: 114.1264, lines: ['TWL'] },
  { id: 'KWF', n: '葵芳',   lat: 22.3584, lng: 114.1284, lines: ['TWL'] },
  { id: 'KWH', n: '葵興',   lat: 22.3634, lng: 114.1310, lines: ['TWL'] },
  { id: 'TWH', n: '大窩口', lat: 22.3710, lng: 114.1245, lines: ['TWL'] },
  { id: 'TSW', n: '荃灣',   lat: 22.3713, lng: 114.1174, lines: ['TWL'] },
  // 港島綫 ISL
  { id: 'KET', n: '堅尼地城', lat: 22.2867, lng: 114.1285, lines: ['ISL'] },
  { id: 'HKU', n: '香港大學', lat: 22.2841, lng: 114.1353, lines: ['ISL'] },
  { id: 'SYP', n: '西營盤',   lat: 22.2850, lng: 114.1438, lines: ['ISL'] },
  { id: 'SHW', n: '上環',     lat: 22.2866, lng: 114.1519, lines: ['ISL'] },
  { id: 'WAC', n: '灣仔',     lat: 22.2773, lng: 114.1731, lines: ['ISL'] },
  { id: 'CWB', n: '銅鑼灣',   lat: 22.2804, lng: 114.1831, lines: ['ISL'] },
  { id: 'TIH', n: '天后',     lat: 22.2815, lng: 114.1916, lines: ['ISL'] },
  { id: 'FOR', n: '炮台山',   lat: 22.2878, lng: 114.1962, lines: ['ISL'] },
  { id: 'NOP', n: '北角',     lat: 22.2912, lng: 114.2006, lines: ['ISL','TKL'] },
  { id: 'QUB', n: '鰂魚涌',   lat: 22.2882, lng: 114.2090, lines: ['ISL','TKL'] },
  { id: 'TAK', n: '太古',     lat: 22.2843, lng: 114.2164, lines: ['ISL'] },
  { id: 'SWH', n: '筲箕灣',   lat: 22.2790, lng: 114.2265, lines: ['ISL'] },
  { id: 'HFC', n: '杏花邨',   lat: 22.2733, lng: 114.2390, lines: ['ISL'] },
  { id: 'CHW', n: '柴灣',     lat: 22.2653, lng: 114.2374, lines: ['ISL'] },
  // 觀塘綫 KTL
  { id: 'WHA', n: '黃埔',   lat: 22.3044, lng: 114.1896, lines: ['KTL'] },
  { id: 'HOM', n: '何文田', lat: 22.3093, lng: 114.1826, lines: ['KTL'] },
  { id: 'SKM', n: '石硤尾', lat: 22.3320, lng: 114.1683, lines: ['KTL'] },
  { id: 'KOT', n: '九龍塘', lat: 22.3369, lng: 114.1759, lines: ['KTL','EAL'] },
  { id: 'LOF', n: '樂富',   lat: 22.3384, lng: 114.1875, lines: ['KTL'] },
  { id: 'WTS', n: '黃大仙', lat: 22.3421, lng: 114.1935, lines: ['KTL'] },
  { id: 'DIH', n: '鑽石山', lat: 22.3401, lng: 114.2011, lines: ['KTL'] },
  { id: 'CHH', n: '彩虹',   lat: 22.3355, lng: 114.2095, lines: ['KTL'] },
  { id: 'KWT', n: '觀塘',   lat: 22.3121, lng: 114.2257, lines: ['KTL'] },
  { id: 'LAT', n: '藍田',   lat: 22.3149, lng: 114.2367, lines: ['KTL'] },
  { id: 'YAT', n: '油塘',   lat: 22.2986, lng: 114.2349, lines: ['KTL','TKL'] },
  { id: 'TIK', n: '調景嶺', lat: 22.2997, lng: 114.2569, lines: ['KTL','TKL'] },
  // 將軍澳綫 TKL
  { id: 'TKO', n: '將軍澳', lat: 22.3074, lng: 114.2600, lines: ['TKL'] },
  { id: 'HAH', n: '坑口',   lat: 22.3159, lng: 114.2580, lines: ['TKL'] },
  { id: 'POA', n: '寶琳',   lat: 22.3225, lng: 114.2638, lines: ['TKL'] },
  { id: 'LHP', n: '康城',   lat: 22.2971, lng: 114.2697, lines: ['TKL'] },
  // 東鐵綫 EAL
  { id: 'HUH', n: '紅磡',   lat: 22.3030, lng: 114.1823, lines: ['KTL','EAL','TML'] },
  { id: 'MKK', n: '旺角東', lat: 22.3225, lng: 114.1712, lines: ['EAL'] },
  { id: 'TAW', n: '大圍',   lat: 22.3725, lng: 114.1779, lines: ['EAL','TML'] },
  { id: 'SHT', n: '沙田',   lat: 22.3822, lng: 114.1889, lines: ['EAL'] },
  { id: 'FOT', n: '火炭',   lat: 22.3967, lng: 114.2003, lines: ['EAL'] },
  { id: 'UNI', n: '大學',   lat: 22.4136, lng: 114.2103, lines: ['EAL'] },
  { id: 'TAP', n: '大埔墟', lat: 22.4452, lng: 114.1712, lines: ['EAL'] },
  { id: 'TWO', n: '太和',   lat: 22.4508, lng: 114.1617, lines: ['EAL'] },
  { id: 'FAN', n: '粉嶺',   lat: 22.4923, lng: 114.1383, lines: ['EAL'] },
  { id: 'SHS', n: '上水',   lat: 22.5018, lng: 114.1281, lines: ['EAL'] },
  { id: 'LOW', n: '羅湖',   lat: 22.5328, lng: 114.1128, lines: ['EAL'] },
  { id: 'LMC', n: '落馬洲', lat: 22.5246, lng: 114.0665, lines: ['EAL'] },
  // 東涌綫 TCL
  { id: 'HOK', n: '香港',   lat: 22.2850, lng: 114.1584, lines: ['TCL','AEL'] },
  { id: 'KOL', n: '九龍',   lat: 22.3049, lng: 114.1618, lines: ['TCL','AEL'] },
  { id: 'KOW', n: '柯士甸', lat: 22.3041, lng: 114.1661, lines: ['TCL','TML'] },
  { id: 'NAC', n: '南昌',   lat: 22.3261, lng: 114.1523, lines: ['TCL','TML'] },
  { id: 'OLY', n: '奧運',   lat: 22.3170, lng: 114.1601, lines: ['TCL'] },
  { id: 'TWW', n: '荃灣西', lat: 22.3680, lng: 114.1133, lines: ['TCL','TML'] },
  { id: 'TSY', n: '青衣',   lat: 22.3582, lng: 114.1088, lines: ['TCL','AEL'] },
  { id: 'YOL', n: '欣澳',   lat: 22.3349, lng: 114.0520, lines: ['TCL'] },
  { id: 'TUC', n: '東涌',   lat: 22.2891, lng: 113.9441, lines: ['TCL'] },
  // 機場快綫 AEL
  { id: 'AWE', n: '博覽館', lat: 22.3225, lng: 113.9611, lines: ['AEL'] },
  { id: 'AIR', n: '機場',   lat: 22.3150, lng: 113.9363, lines: ['AEL'] },
  // 南港島綫 SIL
  { id: 'OCP', n: '海洋公園', lat: 22.2480, lng: 114.1741, lines: ['SIL'] },
  { id: 'WCH', n: '黃竹坑',  lat: 22.2466, lng: 114.1675, lines: ['SIL'] },
  { id: 'LET', n: '利東',    lat: 22.2433, lng: 114.1596, lines: ['SIL'] },
  { id: 'SOH', n: '海怡半島',lat: 22.2430, lng: 114.1496, lines: ['SIL'] },
  // 屯馬綫 TML
  { id: 'TUM', n: '屯門',   lat: 22.3938, lng: 113.9730, lines: ['TML'] },
  { id: 'SIH', n: '兆康',   lat: 22.4118, lng: 114.0006, lines: ['TML'] },
  { id: 'TIS', n: '天水圍', lat: 22.4267, lng: 114.0139, lines: ['TML'] },
  { id: 'LON', n: '朗屏',   lat: 22.4449, lng: 114.0339, lines: ['TML'] },
  { id: 'YUL', n: '元朗',   lat: 22.4449, lng: 114.0376, lines: ['TML'] },
  { id: 'KSR', n: '錦上路', lat: 22.4378, lng: 114.0645, lines: ['TML'] },
  { id: 'AUS', n: '柯士甸', lat: 22.3041, lng: 114.1661, lines: ['TML'] },
  { id: 'ETS', n: '尖東',   lat: 22.2956, lng: 114.1717, lines: ['TML'] },
  { id: 'HIK', n: '顯田',   lat: 22.3773, lng: 114.1884, lines: ['TML'] },
  { id: 'CKT', n: '圓洲角', lat: 22.3814, lng: 114.1934, lines: ['TML'] },
  { id: 'SHM', n: '沙田圍', lat: 22.3832, lng: 114.1988, lines: ['TML'] },
  { id: 'STK', n: '石門',   lat: 22.3876, lng: 114.2055, lines: ['TML'] },
  { id: 'MOS', n: '馬場',   lat: 22.4010, lng: 114.2012, lines: ['TML'] },
  { id: 'WKS', n: '烏溪沙', lat: 22.4285, lng: 114.2384, lines: ['TML'] },
];

// MTR 綫名稱
const MTR_LINE_NAMES = {
  TWL: '荃灣綫', ISL: '港島綫', KTL: '觀塘綫', EAL: '東鐵綫',
  TKL: '將軍澳綫', TCL: '東涌綫', AEL: '機場快綫', SIL: '南港島綫', TML: '屯馬綫',
};

// ── 工具函數 ─────────────────────────────────────────────
async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function batchFetch(urls, batchSize = 15, delayMs = 300) {
  const results = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(url => fetchJSON(url).catch(e => { console.warn('  ⚠', url, e.message); return null; }))
    );
    results.push(...batchResults);
    if (i + batchSize < urls.length) await sleep(delayMs);
    if ((i / batchSize + 1) % 10 === 0) {
      console.log(`    進度：${Math.min(i + batchSize, urls.length)}/${urls.length}`);
    }
  }
  return results;
}

// ── KMB + LWB ────────────────────────────────────────────
async function crawlKMB() {
  console.log('\n📌 KMB/LWB 站點...');
  const stopData = await fetchJSON(`${KMB}/stop`);
  const stops = (stopData.data || []).map(s => ({
    id: s.stop,
    co: 'kmb',
    n: s.name_tc || s.name_en || s.stop,
    lat: parseFloat(s.lat),
    lng: parseFloat(s.long),
  })).filter(s => s.lat && s.lng);
  console.log(`  ✅ ${stops.length} 個站點`);

  console.log('\n📋 KMB/LWB 路線...');
  const routeData = await fetchJSON(`${KMB}/route`);
  const routes = (routeData.data || []).map(r => ({
    route: r.route,
    co: (r.bound === 'O' || r.bound === 'I') ? 'kmb' : 'kmb', // KMB API 不直接標 LWB，後面透過 company 欄位處理
    orig_tc: r.orig_tc || '',
    dest_tc: r.dest_tc || '',
    bound: r.bound || 'O',
    service_type: r.service_type || '1',
  }));
  console.log(`  ✅ ${routes.length} 條路線`);

  return { stops, routes };
}

// ── CTB ──────────────────────────────────────────────────
async function crawlCTB() {
  console.log('\n📌 CTB 路線...');
  const routeData = await fetchJSON(`${CTB}/route/CTB`);
  const allRouteEntries = routeData.data || [];

  // 去重路線（同路線有 O 和 I 兩個方向）
  const routeMap = new Map();
  allRouteEntries.forEach(r => {
    const key = r.route;
    if (!routeMap.has(key)) {
      routeMap.set(key, {
        route: r.route,
        co: 'ctb',
        orig_tc: r.orig_tc || '',
        dest_tc: r.dest_tc || '',
        bound: r.bound || 'O',
        service_type: '1',
      });
    }
  });
  const routes = [...routeMap.values()];
  console.log(`  ✅ ${routes.length} 條路線（${allRouteEntries.length} 個方向記錄）`);

  // Step 2: 取所有方向的站點 ID（雙向，避免遺漏）
  console.log('\n📌 CTB 站點 ID（雙向）...');
  const BOUND_MAP = { O: 'outbound', I: 'inbound' };
  const tasks = allRouteEntries
    .map(r => ({ route: r.route, dir: BOUND_MAP[r.bound] || 'outbound' }));

  const routeStopUrls = tasks.map(t => `${CTB}/route-stop/CTB/${t.route}/${t.dir}`);
  const routeStopResults = await batchFetch(routeStopUrls, 20, 200);

  const stopIds = new Set();
  routeStopResults.forEach(res => {
    (res?.data || []).forEach(s => { if (s.stop) stopIds.add(s.stop); });
  });
  console.log(`  ✅ ${stopIds.size} 個唯一站點 ID`);

  // Step 3: 取座標
  console.log('\n📌 CTB 站點座標...');
  const stopIdArr = [...stopIds];
  const stopUrls = stopIdArr.map(id => `${CTB}/stop/${id}`);
  const stopResults = await batchFetch(stopUrls, 15, 300);

  const stops = [];
  stopResults.forEach(res => {
    const s = res?.data;
    if (!s) return;
    const lat = parseFloat(s.lat ?? s.latitude ?? 0);
    const lng = parseFloat(s.long ?? s.longitude ?? 0);
    if (!lat || !lng) return;
    stops.push({
      id: s.stop,
      co: 'ctb',
      n: s.name_tc || s.name_en || s.stop,
      lat, lng,
    });
  });
  console.log(`  ✅ ${stops.length} 個站點（有座標）`);

  return { stops, routes };
}

// ── MTR ──────────────────────────────────────────────────
function buildMTR() {
  const stops = MTR_STNS.map(s => ({
    id: s.id,
    co: 'mtr',
    n: s.n,
    lat: s.lat,
    lng: s.lng,
    lines: s.lines,
  }));

  // 每條綫生成兩個方向作為「路線」供搜尋
  const lines = Object.keys(MTR_LINE_NAMES);
  const routes = [];
  lines.forEach(line => {
    const stns = MTR_STNS.filter(s => s.lines.includes(line));
    if (stns.length < 2) return;
    const first = stns[0];
    const last = stns[stns.length - 1];
    routes.push({
      route: line,
      co: 'mtr',
      name_tc: MTR_LINE_NAMES[line],
      orig_tc: first.n,
      dest_tc: last.n,
      bound: 'O',
      service_type: '1',
    });
    routes.push({
      route: line,
      co: 'mtr',
      name_tc: MTR_LINE_NAMES[line],
      orig_tc: last.n,
      dest_tc: first.n,
      bound: 'I',
      service_type: '1',
    });
  });

  return { stops, routes };
}

// ── 主程式 ────────────────────────────────────────────────
async function main() {
  console.log('🚌 生活日常 Bus Data Crawler');
  console.log('🕐 開始時間：', new Date().toISOString());

  const generated = new Date().toISOString();

  // 並行爬取 KMB 和 CTB
  const [kmb, ctb] = await Promise.all([crawlKMB(), crawlCTB()]);
  const mtr = buildMTR();

  // 合併
  const allStops = [
    ...kmb.stops,
    ...ctb.stops,
    ...mtr.stops,
  ];

  const allRoutes = [
    ...kmb.routes,
    ...ctb.routes,
    ...mtr.routes,
  ];

  // 輸出
  mkdirSync(OUT, { recursive: true });

  const stopsJSON = JSON.stringify({ v: 1, generated, stops: allStops });
  const routesJSON = JSON.stringify({ v: 1, generated, routes: allRoutes });

  writeFileSync(join(OUT, 'stops.json'), stopsJSON, 'utf8');
  writeFileSync(join(OUT, 'routes.json'), routesJSON, 'utf8');

  const stopsSizeKB = Math.round(Buffer.byteLength(stopsJSON) / 1024);
  const routesSizeKB = Math.round(Buffer.byteLength(routesJSON) / 1024);

  console.log('\n✅ 完成！');
  console.log(`  stops.json  : ${allStops.length} 個站點（${stopsSizeKB} KB）`);
  console.log(`    - KMB/LWB : ${kmb.stops.length}`);
  console.log(`    - CTB     : ${ctb.stops.length}`);
  console.log(`    - MTR     : ${mtr.stops.length}`);
  console.log(`  routes.json : ${allRoutes.length} 條路線（${routesSizeKB} KB）`);
  console.log(`    - KMB/LWB : ${kmb.routes.length}`);
  console.log(`    - CTB     : ${ctb.routes.length}`);
  console.log(`    - MTR     : ${mtr.routes.length}`);
  console.log('🕐 完成時間：', new Date().toISOString());
}

main().catch(e => { console.error('❌ Crawler 失敗：', e); process.exit(1); });
