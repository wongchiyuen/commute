export const KMB = 'https://data.etabus.gov.hk/v1/transport/kmb';
export const CTB = 'https://rt.data.gov.hk/v2/transport/citybus';
export const MTR_API = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php';

export const NEARBY_PID = '__nearby__';

// ── 巴士公司顯示資訊 ──────────────────────────────────────
// KMB API 同時涵蓋九巴(KMB)及龍運(LWB)，stop-eta 回應 co 欄位區分
export const CO_INFO = {
  kmb:   { label: '九巴',      short: 'KMB', color: '#ffc03a', bg: 'rgba(240,165,0,.13)',  bdr: 'rgba(240,165,0,.35)'  },
  lwb:   { label: '龍運',      short: 'LWB', color: '#ff9f43', bg: 'rgba(255,159,67,.13)', bdr: 'rgba(255,159,67,.35)' },
  ctb:   { label: '城巴',      short: 'CTB', color: '#2ed573', bg: 'rgba(46,213,115,.1)',  bdr: 'rgba(46,213,115,.3)'  },
  joint: { label: 'KMB+CTB',   short: '聯營', color: '#7ba8ff', bg: 'rgba(91,143,255,.1)',  bdr: 'rgba(91,143,255,.3)'  },
  mtr:   { label: '港鐵',      short: 'MTR', color: '#e74c3c', bg: 'rgba(231,76,60,.12)',  bdr: 'rgba(231,76,60,.3)'   },
  lrt:   { label: '輕鐵',      short: 'LRT', color: '#a29bfe', bg: 'rgba(162,155,254,.12)', bdr: 'rgba(162,155,254,.3)' },
};

export const MTR_LINE = {
  TWL:'荃灣綫',ISL:'港島綫',KTL:'觀塘綫',EAL:'東鐵綫',
  TKL:'將軍澳綫',TCL:'東涌綫',AEL:'機場快綫',SIL:'南港島綫',TML:'屯馬綫',
};

export const MTR_DIR_LABELS = {
  TWL:['中環','荃灣'],ISL:['柴灣','堅尼地城'],KTL:['調景嶺','黃埔'],
  EAL:['落馬洲/羅湖','紅磡'],TKL:['康城','北角'],TCL:['東涌','香港'],
  AEL:['機場/博覽館','香港'],SIL:['海怡半島','金鐘'],TML:['烏溪沙','屯門'],
};

export const MTR_LINE_STATIONS = {
  TWL:[{c:'TSW',n:'荃灣'},{c:'TWH',n:'大窩口'},{c:'KWH',n:'葵興'},{c:'KWF',n:'葵芳'},{c:'LAK',n:'荔景'},{c:'MEF',n:'美孚'},{c:'LCK',n:'茘枝角'},{c:'CSW',n:'長沙灣'},{c:'SSP',n:'深水埗'},{c:'PRE',n:'太子'},{c:'MOK',n:'旺角'},{c:'YMT',n:'油麻地'},{c:'JOR',n:'佐敦'},{c:'TST',n:'尖沙咀'},{c:'ADM',n:'金鐘'},{c:'CEN',n:'中環'}],
  ISL:[{c:'KET',n:'堅尼地城'},{c:'HKU',n:'香港大學'},{c:'SYP',n:'西營盤'},{c:'SHW',n:'上環'},{c:'CEN',n:'中環'},{c:'ADM',n:'金鐘'},{c:'WAC',n:'灣仔'},{c:'CWB',n:'銅鑼灣'},{c:'TIH',n:'天后'},{c:'FOR',n:'炮台山'},{c:'NOP',n:'北角'},{c:'QUB',n:'鰂魚涌'},{c:'TAK',n:'太古'},{c:'SWH',n:'筲箕灣'},{c:'HFC',n:'杏花邨'},{c:'CHW',n:'柴灣'}],
  KTL:[{c:'WHA',n:'黃埔'},{c:'HUH',n:'紅磡'},{c:'HOM',n:'何文田'},{c:'YMT',n:'油麻地'},{c:'MOK',n:'旺角'},{c:'PRE',n:'太子'},{c:'SKM',n:'石硤尾'},{c:'KOT',n:'九龍塘'},{c:'LOF',n:'樂富'},{c:'WTS',n:'黃大仙'},{c:'DIH',n:'鑽石山'},{c:'CHH',n:'彩虹'},{c:'HAH',n:'坑口'},{c:'TKO',n:'將軍澳'},{c:'TIK',n:'調景嶺'}],
  TKL:[{c:'NOP',n:'北角'},{c:'QUB',n:'鰂魚涌'},{c:'YAT',n:'油塘'},{c:'TIK',n:'調景嶺'},{c:'TKO',n:'將軍澳'},{c:'HAH',n:'坑口'},{c:'POA',n:'寶琳'},{c:'LHP',n:'康城'}],
  TCL:[{c:'HOK',n:'香港'},{c:'KOL',n:'九龍'},{c:'KOW',n:'柯士甸'},{c:'NAC',n:'南昌'},{c:'OLY',n:'奧運'},{c:'MEF',n:'美孚'},{c:'TWW',n:'荃灣西'},{c:'TSY',n:'青衣'},{c:'YOL',n:'欣澳'},{c:'TUC',n:'東涌'}],
  AEL:[{c:'HOK',n:'香港'},{c:'KOL',n:'九龍'},{c:'TSY',n:'青衣'},{c:'AWE',n:'博覽館'},{c:'AIR',n:'機場'}],
  EAL:[{c:'HUH',n:'紅磡'},{c:'MKK',n:'旺角東'},{c:'HOM',n:'何文田'},{c:'KOT',n:'九龍塘'},{c:'TAW',n:'大圍'},{c:'SHT',n:'沙田'},{c:'FOT',n:'火炭'},{c:'UNI',n:'大學'},{c:'TAP',n:'大埔墟'},{c:'TWO',n:'太和'},{c:'FAN',n:'粉嶺'},{c:'SHS',n:'上水'},{c:'LOW',n:'羅湖'},{c:'LMC',n:'落馬洲'}],
  SIL:[{c:'ADM',n:'金鐘'},{c:'OCP',n:'海洋公園'},{c:'LET',n:'利東'},{c:'WHC',n:'黃竹坑'},{c:'SOH',n:'海怡半島'}],
  TML:[{c:'TUM',n:'屯門'},{c:'SIH',n:'兆康'},{c:'TIS',n:'天水圍'},{c:'LON',n:'朗屏'},{c:'YUL',n:'元朗'},{c:'KSR',n:'錦上路'},{c:'TWW',n:'荃灣西'},{c:'MEF',n:'美孚'},{c:'NAC',n:'南昌'},{c:'AUS',n:'柯士甸'},{c:'ETS',n:'尖東'},{c:'HUH',n:'紅磡'},{c:'HIK',n:'顯田'},{c:'TAW',n:'大圍'},{c:'CKT',n:'圓洲角'},{c:'SHM',n:'沙田圍'},{c:'STK',n:'石門'},{c:'MOS',n:'馬場'},{c:'WKS',n:'烏溪沙'}],
};

export const MTR_STNS = [
  {n:'金鐘',lines:['TWL','ISL','SIL'],codes:{TWL:'ADM',ISL:'ADM',SIL:'ADM'},lat:22.279,lng:114.165},
  {n:'中環',lines:['TWL','ISL'],codes:{TWL:'CEN',ISL:'CEN'},lat:22.282,lng:114.158},
  {n:'灣仔',lines:['ISL'],codes:{ISL:'WAC'},lat:22.277,lng:114.173},
  {n:'銅鑼灣',lines:['ISL'],codes:{ISL:'CWB'},lat:22.280,lng:114.183},
  {n:'旺角',lines:['TWL','KTL'],codes:{TWL:'MOK',KTL:'MOK'},lat:22.320,lng:114.169},
  {n:'油麻地',lines:['TWL','KTL'],codes:{TWL:'YMT',KTL:'YMT'},lat:22.313,lng:114.171},
  {n:'佐敦',lines:['TWL'],codes:{TWL:'JOR'},lat:22.305,lng:114.171},
  {n:'尖沙咀',lines:['TWL'],codes:{TWL:'TST'},lat:22.298,lng:114.172},
  {n:'紅磡',lines:['KTL','EAL'],codes:{KTL:'HOM',EAL:'HUH'},lat:22.303,lng:114.182},
  {n:'九龍塘',lines:['KTL','EAL'],codes:{KTL:'KOT',EAL:'KOT'},lat:22.337,lng:114.176},
  {n:'沙田',lines:['EAL'],codes:{EAL:'SHT'},lat:22.382,lng:114.189},
  {n:'大埔墟',lines:['EAL'],codes:{EAL:'TAP'},lat:22.445,lng:114.171},
  {n:'上水',lines:['EAL'],codes:{EAL:'SHS'},lat:22.502,lng:114.128},
  {n:'羅湖',lines:['EAL'],codes:{EAL:'LOW'},lat:22.533,lng:114.113},
  {n:'將軍澳',lines:['TKL'],codes:{TKL:'TKO'},lat:22.307,lng:114.260},
  {n:'坑口',lines:['TKL'],codes:{TKL:'HAH'},lat:22.316,lng:114.258},
  {n:'青衣',lines:['TCL','AEL'],codes:{TCL:'TSY',AEL:'TSY'},lat:22.358,lng:114.109},
  {n:'東涌',lines:['TCL'],codes:{TCL:'TUC'},lat:22.289,lng:113.944},
  {n:'機場',lines:['AEL'],codes:{AEL:'AIR'},lat:22.315,lng:113.937},
  {n:'荃灣',lines:['TWL'],codes:{TWL:'TSW'},lat:22.371,lng:114.117},
  {n:'葵芳',lines:['TWL'],codes:{TWL:'KWF'},lat:22.358,lng:114.128},
  {n:'美孚',lines:['TWL'],codes:{TWL:'MEF'},lat:22.338,lng:114.137},
  {n:'奧運',lines:['TWL'],codes:{TWL:'OLY'},lat:22.317,lng:114.160},
  {n:'大圍',lines:['KTL','EAL'],codes:{KTL:'TAW',EAL:'TAW'},lat:22.373,lng:114.178},
  {n:'鑽石山',lines:['KTL'],codes:{KTL:'DIH'},lat:22.340,lng:114.201},
  {n:'觀塘',lines:['KTL'],codes:{KTL:'KWT'},lat:22.312,lng:114.226},
];
