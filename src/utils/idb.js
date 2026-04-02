// IndexedDB cache layer
// DB: swd-cache v1 · store: kv
// Each record: { data, ts, ttl }

const _idb = {
  _db: null,
  async open() {
    if (this._db) return this._db;
    return new Promise((res, rej) => {
      const req = indexedDB.open('swd-cache', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
      req.onsuccess = e => { this._db = e.target.result; res(this._db); };
      req.onerror = () => rej(req.error);
    });
  },
  async get(key) {
    try {
      const db = await this.open();
      return new Promise((res, rej) => {
        const req = db.transaction('kv').objectStore('kv').get(key);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    } catch { return null; }
  },
  async set(key, data, ttl) {
    try {
      const db = await this.open();
      return new Promise((res, rej) => {
        const req = db.transaction('kv', 'readwrite').objectStore('kv')
          .put({ data, ts: Date.now(), ttl }, key);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
    } catch {}
  },
  /** 刪除指定 key */
  async del(key) {
    try {
      const db = await this.open();
      return new Promise((res, rej) => {
        const req = db.transaction('kv', 'readwrite').objectStore('kv').delete(key);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
    } catch {}
  },
  /** Returns data if fresh (within TTL), else null */
  async fresh(key) {
    const entry = await this.get(key);
    if (!entry || !entry.data) return null;
    if (Date.now() - entry.ts > entry.ttl) return null;
    return entry.data;
  },
};

export default _idb;
