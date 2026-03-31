export const NEWS_FEEDS = {
  local:   { name:'本地新聞',   url:'https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml' },
  china:   { name:'大中華新聞', url:'https://rthk.hk/rthk/news/rss/c_expressnews_greaterchina.xml' },
  world:   { name:'國際新聞',   url:'https://rthk.hk/rthk/news/rss/c_expressnews_cinternational.xml' },
  finance: { name:'財經新聞',   url:'https://rthk.hk/rthk/news/rss/c_expressnews_cfinance.xml' },
  sport:   { name:'體育新聞',   url:'https://rthk.hk/rthk/news/rss/c_expressnews_csport.xml' },
};
export const NEWS_FEED_KEYS = ['local','china','world','finance','sport'];

export const SRC_LABEL = {local:'本地',china:'大中華',world:'國際',finance:'財經',sport:'體育'};
export const SRC_COLOR = {local:'#5b8fff',china:'#ff8a96',world:'#2ed573',finance:'#f0a500',sport:'#a78bfa'};

export const TRAFFIC_RTHK_URL = 'https://programme.rthk.hk/channel/radio/trafficnews/rss.xml';

export const NEWS_AUTO_INTERVAL_SEC = 5 * 60;
export const TRAFFIC_AUTO_INTERVAL_SEC = 2 * 60;
export const CACHE_TTL = 10 * 60 * 1000;
