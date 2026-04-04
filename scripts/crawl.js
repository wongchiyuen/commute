#!/usr/bin/env node
/**
 * 生活日常 Bus Data Crawler
 * 資料來源：data.gov.hk (KMB/LWB) + rt.data.gov.hk (CTB)
 * MTR/LRT 站點靜態內嵌（官方座標）
 * 輸出：scripts/output/stops.json + scripts/output/routes.json
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
  { id:'CEN',n:'中環',   lat:22.2822,lng:114.1579,lines:['TWL','ISL']},
  { id:'ADM',n:'金鐘',   lat:22.2789,lng:114.1650,lines:['TWL','ISL','SIL']},
  { id:'TST',n:'尖沙咀', lat:22.2975,lng:114.1722,lines:['TWL']},
  { id:'JOR',n:'佐敦',   lat:22.3051,lng:114.1715,lines:['TWL']},
  { id:'YMT',n:'油麻地', lat:22.3127,lng:114.1706,lines:['TWL','KTL']},
  { id:'MOK',n:'旺角',   lat:22.3198,lng:114.1693,lines:['TWL','KTL']},
  { id:'PRE',n:'太子',   lat:22.3247,lng:114.1686,lines:['TWL','KTL']},
  { id:'SSP',n:'深水埗', lat:22.3305,lng:114.1626,lines:['TWL']},
  { id:'CSW',n:'長沙灣', lat:22.3355,lng:114.1551,lines:['TWL']},
  { id:'LCK',n:'荔枝角', lat:22.3376,lng:114.1481,lines:['TWL']},
  { id:'MEF',n:'美孚',   lat:22.3379,lng:114.1379,lines:['TWL','TCL','TML']},
  { id:'LAK',n:'荔景',   lat:22.3480,lng:114.1264,lines:['TWL']},
  { id:'KWF',n:'葵芳',   lat:22.3584,lng:114.1284,lines:['TWL']},
  { id:'KWH',n:'葵興',   lat:22.3634,lng:114.1310,lines:['TWL']},
  { id:'TWH',n:'大窩口', lat:22.3710,lng:114.1245,lines:['TWL']},
  { id:'TSW',n:'荃灣',   lat:22.3713,lng:114.1174,lines:['TWL']},
  { id:'KET',n:'堅尼地城',lat:22.2867,lng:114.1285,lines:['ISL']},
  { id:'HKU',n:'香港大學',lat:22.2841,lng:114.1353,lines:['ISL']},
  { id:'SYP',n:'西營盤', lat:22.2850,lng:114.1438,lines:['ISL']},
  { id:'SHW',n:'上環',   lat:22.2866,lng:114.1519,lines:['ISL']},
  { id:'WAC',n:'灣仔',   lat:22.2773,lng:114.1731,lines:['ISL']},
  { id:'CWB',n:'銅鑼灣', lat:22.2804,lng:114.1831,lines:['ISL']},
  { id:'TIH',n:'天后',   lat:22.2815,lng:114.1916,lines:['ISL']},
  { id:'FOR',n:'炮台山', lat:22.2878,lng:114.1962,lines:['ISL']},
  { id:'NOP',n:'北角',   lat:22.2912,lng:114.2006,lines:['ISL','TKL']},
  { id:'QUB',n:'鰂魚涌', lat:22.2882,lng:114.2090,lines:['ISL','TKL']},
  { id:'TAK',n:'太古',   lat:22.2843,lng:114.2164,lines:['ISL']},
  { id:'SWH',n:'筲箕灣', lat:22.2790,lng:114.2265,lines:['ISL']},
  { id:'HFC',n:'杏花邨', lat:22.2733,lng:114.2390,lines:['ISL']},
  { id:'CHW',n:'柴灣',   lat:22.2653,lng:114.2374,lines:['ISL']},
  { id:'WHA',n:'黃埔',   lat:22.3044,lng:114.1896,lines:['KTL']},
  { id:'HOM',n:'何文田', lat:22.3093,lng:114.1826,lines:['KTL']},
  { id:'SKM',n:'石硤尾', lat:22.3320,lng:114.1683,lines:['KTL']},
  { id:'KOT',n:'九龍塘', lat:22.3369,lng:114.1759,lines:['KTL','EAL']},
  { id:'LOF',n:'樂富',   lat:22.3384,lng:114.1875,lines:['KTL']},
  { id:'WTS',n:'黃大仙', lat:22.3421,lng:114.1935,lines:['KTL']},
  { id:'DIH',n:'鑽石山', lat:22.3401,lng:114.2011,lines:['KTL']},
  { id:'CHH',n:'彩虹',   lat:22.3355,lng:114.2095,lines:['KTL']},
  { id:'KWT',n:'觀塘',   lat:22.3121,lng:114.2257,lines:['KTL']},
  { id:'LAT',n:'藍田',   lat:22.3149,lng:114.2367,lines:['KTL']},
  { id:'YAT',n:'油塘',   lat:22.2986,lng:114.2349,lines:['KTL','TKL']},
  { id:'TIK',n:'調景嶺', lat:22.2997,lng:114.2569,lines:['KTL','TKL']},
  { id:'TKO',n:'將軍澳', lat:22.3074,lng:114.2600,lines:['TKL']},
  { id:'HAH',n:'坑口',   lat:22.3159,lng:114.2580,lines:['TKL']},
  { id:'POA',n:'寶琳',   lat:22.3225,lng:114.2638,lines:['TKL']},
  { id:'LHP',n:'康城',   lat:22.2971,lng:114.2697,lines:['TKL']},
  { id:'HUH',n:'紅磡',   lat:22.3030,lng:114.1823,lines:['KTL','EAL','TML']},
  { id:'MKK',n:'旺角東', lat:22.3225,lng:114.1712,lines:['EAL']},
  { id:'TAW',n:'大圍',   lat:22.3725,lng:114.1779,lines:['EAL','TML']},
  { id:'SHT',n:'沙田',   lat:22.3822,lng:114.1889,lines:['EAL']},
  { id:'FOT',n:'火炭',   lat:22.3967,lng:114.2003,lines:['EAL']},
  { id:'UNI',n:'大學',   lat:22.4136,lng:114.2103,lines:['EAL']},
  { id:'TAP',n:'大埔墟', lat:22.4452,lng:114.1712,lines:['EAL']},
  { id:'TWO',n:'太和',   lat:22.4508,lng:114.1617,lines:['EAL']},
  { id:'FAN',n:'粉嶺',   lat:22.4923,lng:114.1383,lines:['EAL']},
  { id:'SHS',n:'上水',   lat:22.5018,lng:114.1281,lines:['EAL']},
  { id:'LOW',n:'羅湖',   lat:22.5328,lng:114.1128,lines:['EAL']},
  { id:'LMC',n:'落馬洲', lat:22.5246,lng:114.0665,lines:['EAL']},
  { id:'HOK',n:'香港',   lat:22.2850,lng:114.1584,lines:['TCL','AEL']},
  { id:'KOL',n:'九龍',   lat:22.3049,lng:114.1618,lines:['TCL','AEL']},
  { id:'KOW',n:'柯士甸', lat:22.3041,lng:114.1661,lines:['TCL','TML']},
  { id:'NAC',n:'南昌',   lat:22.3261,lng:114.1523,lines:['TCL','TML']},
  { id:'OLY',n:'奧運',   lat:22.3170,lng:114.1601,lines:['TCL']},
  { id:'TWW',n:'荃灣西', lat:22.3680,lng:114.1133,lines:['TCL','TML']},
  { id:'TSY',n:'青衣',   lat:22.3582,lng:114.1088,lines:['TCL','AEL']},
  { id:'YOL',n:'欣澳',   lat:22.3349,lng:114.0520,lines:['TCL']},
  { id:'TUC',n:'東涌',   lat:22.2891,lng:113.9441,lines:['TCL']},
  { id:'AWE',n:'博覽館', lat:22.3225,lng:113.9611,lines:['AEL']},
  { id:'AIR',n:'機場',   lat:22.3150,lng:113.9363,lines:['AEL']},
  { id:'OCP',n:'海洋公園',lat:22.2480,lng:114.1741,lines:['SIL']},
  { id:'WCH',n:'黃竹坑', lat:22.2466,lng:114.1675,lines:['SIL']},
  { id:'LET',n:'利東',   lat:22.2433,lng:114.1596,lines:['SIL']},
  { id:'SOH',n:'海怡半島',lat:22.2430,lng:114.1496,lines:['SIL']},
  { id:'TUM',n:'屯門',   lat:22.3938,lng:113.9730,lines:['TML']},
  { id:'SIH',n:'兆康',   lat:22.4118,lng:114.0006,lines:['TML']},
  { id:'TIS',n:'天水圍', lat:22.4267,lng:114.0139,lines:['TML']},
  { id:'LON',n:'朗屏',   lat:22.4449,lng:114.0339,lines:['TML']},
  { id:'YUL',n:'元朗',   lat:22.4449,lng:114.0376,lines:['TML']},
  { id:'KSR',n:'錦上路', lat:22.4378,lng:114.0645,lines:['TML']},
  { id:'AUS',n:'柯士甸', lat:22.3041,lng:114.1661,lines:['TML']},
  { id:'ETS',n:'尖東',   lat:22.2956,lng:114.1717,lines:['TML']},
  { id:'HIK',n:'顯田',   lat:22.3773,lng:114.1884,lines:['TML']},
  { id:'CKT',n:'圓洲角', lat:22.3814,lng:114.1934,lines:['TML']},
  { id:'SHM',n:'沙田圍', lat:22.3832,lng:114.1988,lines:['TML']},
  { id:'STK',n:'石門',   lat:22.3876,lng:114.2055,lines:['TML']},
  { id:'MOS',n:'馬場',   lat:22.4010,lng:114.2012,lines:['TML']},
  { id:'WKS',n:'烏溪沙', lat:22.4285,lng:114.2384,lines:['TML']},
];

const MTR_LINE_NAMES = {
  TWL:'荃灣綫',ISL:'港島綫',KTL:'觀塘綫',EAL:'東鐵綫',
  TKL:'將軍澳綫',TCL:'東涌綫',AEL:'機場快綫',SIL:'南港島綫',TML:'屯馬綫',
};

// ── LRT 站點（靜態，北大嶼山輕鐵）──────────────────────
const LRT_STNS = [
  // 屯門區
  { id:'1',  n:'屯門',         lat:22.3938,lng:113.9730,routes:['505','507','610','614','614P','615','615P','705','706','761P']},
  { id:'2',  n:'三聖',         lat:22.3836,lng:113.9697,routes:['505','507']},
  { id:'3',  n:'兆禧',         lat:22.3986,lng:113.9793,routes:['614','614P','615','615P','705','706']},
  { id:'4',  n:'友愛',         lat:22.3951,lng:113.9813,routes:['614','614P','615','615P','705','706']},
  { id:'5',  n:'安定',         lat:22.3979,lng:113.9849,routes:['614','614P','615','615P','705','706']},
  { id:'6',  n:'田景',         lat:22.4003,lng:113.9869,routes:['614','614P','615','615P','705','706']},
  { id:'7',  n:'良景',         lat:22.4028,lng:113.9892,routes:['614','614P','615','615P','705','706']},
  { id:'8',  n:'乾朗',         lat:22.4064,lng:113.9937,routes:['614','614P','615','615P','705','706']},
  { id:'9',  n:'翠豐',         lat:22.4082,lng:113.9965,routes:['614','614P','615','615P']},
  { id:'10', n:'兆康（輕鐵）', lat:22.4118,lng:114.0006,routes:['505','507','610','614','614P','615','615P','705','706','761P']},
  { id:'11', n:'天水圍（輕鐵）',lat:22.4457,lng:114.0058,routes:['705','706','761P']},
  { id:'12', n:'朗屏（輕鐵）', lat:22.4449,lng:114.0339,routes:['705','706','761P']},
  { id:'13', n:'元朗（輕鐵）', lat:22.4450,lng:114.0376,routes:['610','614','614P','615','615P','705','706','761P']},
  // 元朗區
  { id:'14', n:'鳳攸北',       lat:22.4382,lng:114.0247,routes:['610','614','614P','615','615P']},
  { id:'15', n:'業旺',         lat:22.4349,lng:114.0212,routes:['610']},
  { id:'16', n:'天逸',         lat:22.4281,lng:114.0180,routes:['705','706']},
  { id:'17', n:'天華',         lat:22.4259,lng:114.0155,routes:['705','706']},
  { id:'18', n:'天恩',         lat:22.4240,lng:114.0138,routes:['705','706']},
  { id:'19', n:'天慈',         lat:22.4215,lng:114.0112,routes:['705','706']},
  { id:'20', n:'天盛',         lat:22.4193,lng:114.0083,routes:['705','706']},
  { id:'21', n:'天瑞',         lat:22.4169,lng:114.0059,routes:['505','507','705','706','761P']},
  { id:'22', n:'嶺南大學',     lat:22.4162,lng:113.9993,routes:['505','507']},
  { id:'23', n:'悅來',         lat:22.4135,lng:113.9967,routes:['505','507']},
  { id:'24', n:'屯門碼頭',     lat:22.3701,lng:113.9663,routes:['507']},
  { id:'25', n:'泥圍',         lat:22.3729,lng:113.9702,routes:['507']},
  { id:'26', n:'蝴蝶',         lat:22.3762,lng:113.9710,routes:['507']},
  { id:'27', n:'鳳地',         lat:22.3820,lng:113.9716,routes:['507']},
  { id:'28', n:'龍門居',       lat:22.3871,lng:113.9726,routes:['505','507']},
  { id:'29', n:'井財街',       lat:22.3892,lng:113.9730,routes:['505']},
  { id:'30', n:'翠寧花園',     lat:22.4002,lng:113.9794,routes:['610']},
  { id:'31', n:'建生',         lat:22.4058,lng:113.9928,routes:['610']},
];

// LRT 路線（主要路線）
const LRT_ROUTES = [
  { route:'505', orig_tc:'兆康',    dest_tc:'屯門' },
  { route:'507', orig_tc:'元朗',    dest_tc:'屯門碼頭' },
  { route:'510', orig_tc:'屯門',    dest_tc:'屯門（循環）' },
  { route:'610', orig_tc:'元朗',    dest_tc:'兆康' },
  { route:'614', orig_tc:'元朗',    dest_tc:'屯門' },
  { route:'614P',orig_tc:'元朗',    dest_tc:'屯門' },
  { route:'615', orig_tc:'元朗',    dest_tc:'屯門' },
  { route:'615P',orig_tc:'元朗',    dest_tc:'屯門' },
  { route:'705', orig_tc:'天水圍',  dest_tc:'元朗' },
  { route:'706', orig_tc:'元朗',    dest_tc:'天水圍' },
  { route:'751', orig_tc:'天水圍',  dest_tc:'兆康' },
  { route:'761P',orig_tc:'天水圍',  dest_tc:'屯門' },
];

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
      batch.map(url => fetchJSON(url).catch(e => { console.warn('  ⚠', url.slice(-40), e.message); return null; }))
    );
    results.push(...batchResults);
    if (i + batchSize < urls.length) await sleep(delayMs);
    if (Math.floor((i + batchSize) / batchSize) % 10 === 0) {
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
    id: s.stop, co: 'kmb',
    n: s.name_tc || s.name_en || s.stop,
    lat: parseFloat(s.lat), lng: parseFloat(s.long),
  })).filter(s => s.lat && s.lng && !isNaN(s.lat));
  console.log(`  ✅ ${stops.length} 個站點`);

  console.log('\n📋 KMB/LWB 路線...');
  const routeData = await fetchJSON(`${KMB}/route`);
  const routes = (routeData.data || []).map(r => ({
    route: r.route, co: 'kmb',
    orig_tc: r.orig_tc || '', dest_tc: r.dest_tc || '',
    bound: r.bound || 'O', service_type: r.service_type || '1',
  }));
  console.log(`  ✅ ${routes.length} 條路線`);
  return { stops, routes };
}

// ── CTB ──────────────────────────────────────────────────
async function crawlCTB() {
  console.log('\n📌 CTB 路線...');
  const routeData = await fetchJSON(`${CTB}/route/CTB`);
  const allEntries = routeData.data || [];

  const routeMap = new Map();
  allEntries.forEach(r => {
    if (!routeMap.has(r.route)) {
      routeMap.set(r.route, {
        route: r.route, co: 'ctb',
        orig_tc: r.orig_tc || '', dest_tc: r.dest_tc || '',
        bound: r.bound || 'O', service_type: '1',
      });
    }
  });
  const routes = [...routeMap.values()];
  console.log(`  ✅ ${routes.length} 條路線（${allEntries.length} 個方向記錄）`);

  console.log('\n📌 CTB 站點 ID（雙向）...');
  const BOUND_MAP = { O: 'outbound', I: 'inbound' };
  const tasks = allEntries.map(r => ({ route: r.route, dir: BOUND_MAP[r.bound] || 'outbound' }));
  const routeStopResults = await batchFetch(
    tasks.map(t => `${CTB}/route-stop/CTB/${t.route}/${t.dir}`), 25, 150
  );

  const stopIds = new Set();
  routeStopResults.forEach(res => (res?.data || []).forEach(s => { if (s.stop) stopIds.add(s.stop); }));
  console.log(`  ✅ ${stopIds.size} 個唯一站點 ID`);

  console.log('\n📌 CTB 站點座標...');
  const stopResults = await batchFetch(
    [...stopIds].map(id => `${CTB}/stop/${id}`), 20, 200
  );

  const stops = [];
  stopResults.forEach(res => {
    const s = res?.data;
    if (!s) return;
    const lat = parseFloat(s.lat ?? s.latitude ?? 0);
    const lng = parseFloat(s.long ?? s.longitude ?? 0);
    if (!lat || !lng || isNaN(lat)) return;
    stops.push({ id: s.stop, co: 'ctb', n: s.name_tc || s.name_en || s.stop, lat, lng });
  });
  console.log(`  ✅ ${stops.length} 個站點`);
  return { stops, routes };
}

// ── MTR ──────────────────────────────────────────────────
function buildMTR() {
  const stops = MTR_STNS.map(s => ({ ...s, co: 'mtr' }));
  const lines = Object.keys(MTR_LINE_NAMES);
  const routes = [];
  lines.forEach(line => {
    const stns = MTR_STNS.filter(s => s.lines.includes(line));
    if (stns.length < 2) return;
    routes.push({ route: line, co: 'mtr', name_tc: MTR_LINE_NAMES[line], orig_tc: stns[0].n, dest_tc: stns[stns.length-1].n, bound: 'O', service_type: '1' });
    routes.push({ route: line, co: 'mtr', name_tc: MTR_LINE_NAMES[line], orig_tc: stns[stns.length-1].n, dest_tc: stns[0].n, bound: 'I', service_type: '1' });
  });
  return { stops, routes };
}

// ── LRT ──────────────────────────────────────────────────
function buildLRT() {
  const stops = LRT_STNS.map(s => ({ id: s.id, co: 'lrt', n: s.n, lat: s.lat, lng: s.lng }));
  const routes = LRT_ROUTES.flatMap(r => [
    { route: r.route, co: 'lrt', orig_tc: r.orig_tc, dest_tc: r.dest_tc, bound: 'O', service_type: '1' },
    { route: r.route, co: 'lrt', orig_tc: r.dest_tc, dest_tc: r.orig_tc, bound: 'I', service_type: '1' },
  ]);
  return { stops, routes };
}

// ── 主程式 ────────────────────────────────────────────────
async function main() {
  console.log('🚌 生活日常 Bus Data Crawler');
  console.log('🕐', new Date().toISOString());

  const generated = new Date().toISOString();
  const [kmb, ctb] = await Promise.all([crawlKMB(), crawlCTB()]);
  const mtr = buildMTR();
  const lrt = buildLRT();

  const allStops = [...kmb.stops, ...ctb.stops, ...mtr.stops, ...lrt.stops];
  const allRoutes = [...kmb.routes, ...ctb.routes, ...mtr.routes, ...lrt.routes];

  mkdirSync(OUT, { recursive: true });
  const stopsJSON = JSON.stringify({ v: 1, generated, stops: allStops });
  const routesJSON = JSON.stringify({ v: 1, generated, routes: allRoutes });
  writeFileSync(join(OUT, 'stops.json'), stopsJSON, 'utf8');
  writeFileSync(join(OUT, 'routes.json'), routesJSON, 'utf8');

  console.log('\n✅ 完成！');
  console.log(`  stops.json  : ${allStops.length} 個站點 (${Math.round(Buffer.byteLength(stopsJSON)/1024)}KB)`);
  console.log(`    KMB/LWB:${kmb.stops.length}  CTB:${ctb.stops.length}  MTR:${mtr.stops.length}  LRT:${lrt.stops.length}`);
  console.log(`  routes.json : ${allRoutes.length} 條路線 (${Math.round(Buffer.byteLength(routesJSON)/1024)}KB)`);
  console.log(`    KMB/LWB:${kmb.routes.length}  CTB:${ctb.routes.length}  MTR:${mtr.routes.length}  LRT:${lrt.routes.length}`);
  console.log('🕐', new Date().toISOString());
}

main().catch(e => { console.error('❌ Crawler 失敗：', e); process.exit(1); });
