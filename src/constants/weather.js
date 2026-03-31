export const HKO   = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
export const HKO_C = 'https://data.weather.gov.hk/weatherAPI/opendata/climate.php';
export const HKO_T = 'https://data.weather.gov.hk/weatherAPI/opendata/tide.php';

export const W_ICONS = {
  50:'☀️',51:'🌤',52:'🌤',53:'⛅',54:'🌥',60:'☁️',61:'🌧',62:'🌧',63:'🌩',64:'⛈',65:'🌩',
  70:'☀️',71:'🌤',72:'🌤',73:'⛅',74:'🌥',75:'☁️',76:'🌦',77:'🌦',80:'🌧',81:'🌧',82:'🌩',
  83:'⛈',84:'🌪',85:'🌩',90:'🌡',100:'🌫',101:'🌫',
};

export const WARN_MAP = {
  WTCSGNL:'熱帶氣旋',WRAINA:'黃色暴雨',WRAINB:'紅色暴雨',WRAINC:'黑色暴雨',
  WFIRE:'山火',WFROST:'霜凍',WHOT:'酷熱',WCOLD:'寒冷',WMSGNL:'強烈季候風',
  WTHUNDER:'雷暴',WL:'山泥傾瀉',
};

export const AMB_WARNS = new Set(['WHOT','WCOLD','WFROST','WTHUNDER']);

export const DAY = ['日','一','二','三','四','五','六'];

export const RHRREAD_STNS = [
  {n:'香港天文台',  lat:22.302,lng:114.174},
  {n:'京士柏',      lat:22.312,lng:114.172},
  {n:'橫瀾島',      lat:22.183,lng:114.303},
  {n:'長洲',        lat:22.210,lng:114.028},
  {n:'赤鱲角',      lat:22.308,lng:113.920},
  {n:'香港國際機場',lat:22.308,lng:113.920},
  {n:'大嶼山',      lat:22.254,lng:113.916},
  {n:'大澳',        lat:22.254,lng:113.858},
  {n:'昂坪',        lat:22.257,lng:113.946},
  {n:'沙螺灣',      lat:22.318,lng:113.943},
  {n:'石鼓洲',      lat:22.236,lng:114.013},
  {n:'赤柱',        lat:22.218,lng:114.213},
  {n:'黃竹坑',      lat:22.247,lng:114.175},
  {n:'南丫島',      lat:22.208,lng:114.105},
  {n:'鴨脷洲',      lat:22.243,lng:114.158},
  {n:'薄扶林',      lat:22.271,lng:114.134},
  {n:'香港公園',    lat:22.277,lng:114.162},
  {n:'跑馬地',      lat:22.273,lng:114.188},
  {n:'鰂魚涌',      lat:22.288,lng:114.209},
  {n:'西灣河',      lat:22.278,lng:114.221},
  {n:'筲箕灣',      lat:22.278,lng:114.228},
  {n:'柴灣',        lat:22.265,lng:114.237},
  {n:'啟德',        lat:22.328,lng:114.209},
  {n:'啟德跑道公園',lat:22.317,lng:114.215},
  {n:'九龍城',      lat:22.330,lng:114.188},
  {n:'京士柏運動場',lat:22.309,lng:114.175},
  {n:'何文田',      lat:22.320,lng:114.182},
  {n:'深水埗',      lat:22.330,lng:114.163},
  {n:'黃大仙',      lat:22.342,lng:114.194},
  {n:'觀塘',        lat:22.313,lng:114.228},
  {n:'油塘',        lat:22.298,lng:114.237},
  {n:'將軍澳',      lat:22.310,lng:114.257},
  {n:'清水灣',      lat:22.320,lng:114.277},
  {n:'西貢',        lat:22.382,lng:114.274},
  {n:'荃灣',        lat:22.371,lng:114.114},
  {n:'葵涌',        lat:22.352,lng:114.128},
  {n:'青衣',        lat:22.349,lng:114.105},
  {n:'大欖涌',      lat:22.383,lng:113.977},
  {n:'屯門',        lat:22.391,lng:113.977},
  {n:'流浮山',      lat:22.469,lng:113.996},
  {n:'元朗',        lat:22.445,lng:114.023},
  {n:'濕地公園',    lat:22.468,lng:114.008},
  {n:'天水圍',      lat:22.447,lng:114.008},
  {n:'石崗',        lat:22.437,lng:114.079},
  {n:'錦田',        lat:22.440,lng:114.052},
  {n:'大埔',        lat:22.445,lng:114.171},
  {n:'大埔滘',      lat:22.435,lng:114.184},
  {n:'大美督',      lat:22.471,lng:114.237},
  {n:'沙田',        lat:22.415,lng:114.210},
  {n:'大圍',        lat:22.373,lng:114.178},
  {n:'馬鞍山',      lat:22.412,lng:114.219},
  {n:'西貢北',      lat:22.435,lng:114.294},
  {n:'打鼓嶺',      lat:22.536,lng:114.138},
  {n:'上水',        lat:22.501,lng:114.129},
  {n:'粉嶺',        lat:22.494,lng:114.139},
  {n:'坪輋',        lat:22.480,lng:114.138},
  {n:'沙頭角',      lat:22.543,lng:114.215},
  {n:'羅湖',        lat:22.533,lng:114.113},
  {n:'塔門',        lat:22.471,lng:114.361},
  {n:'東平洲',      lat:22.580,lng:114.437},
];

export const TIDE_STNS = [
  {n:'長洲',  code:'CCH',lat:22.210,lng:114.028},
  {n:'赤鱲角',code:'CLK',lat:22.308,lng:113.920},
  {n:'芝麻灣',code:'CMW',lat:22.265,lng:114.001},
  {n:'葵涌',  code:'KCT',lat:22.352,lng:114.128},
  {n:'高流灣',code:'KLW',lat:22.335,lng:114.335},
  {n:'樂安排',code:'LOP',lat:22.450,lng:114.300},
  {n:'馬灣',  code:'MWC',lat:22.355,lng:114.048},
  {n:'鰂魚涌',code:'QUB',lat:22.288,lng:114.209},
  {n:'石壁',  code:'SPW',lat:22.225,lng:114.003},
  {n:'大澳',  code:'TAO',lat:22.254,lng:113.858},
  {n:'尖鼻咀',code:'TBT',lat:22.467,lng:113.989},
  {n:'大廟灣',code:'TMW',lat:22.198,lng:114.273},
  {n:'大埔滘',code:'TPK',lat:22.445,lng:114.180},
  {n:'橫瀾島',code:'WAG',lat:22.183,lng:114.303},
];

export const CLIMATE_STNS = [
  {n:'香港天文台',code:'HKO',lat:22.302,lng:114.174},
  {n:'京士柏',    code:'KP', lat:22.312,lng:114.172},
  {n:'九龍城',    code:'KLT',lat:22.330,lng:114.188},
  {n:'觀塘',      code:'KTG',lat:22.313,lng:114.228},
  {n:'流浮山',    code:'LFS',lat:22.469,lng:113.996},
  {n:'將軍澳',    code:'JKB',lat:22.310,lng:114.257},
  {n:'上水',      code:'SSH',lat:22.501,lng:114.129},
  {n:'深水埗',    code:'SSP',lat:22.330,lng:114.163},
  {n:'元朗公園',  code:'YLP',lat:22.445,lng:114.023},
  {n:'清水灣',    code:'CWB',lat:22.320,lng:114.277},
];
