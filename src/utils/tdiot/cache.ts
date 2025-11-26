type CacheItem = { value: any; expire: number };

const mem = new Map<string, CacheItem>();

function k(ns: string, key: string) {
  return `${ns}:${key}`;
}

export function getCache<T = any>(ns: string, key: string): T | null {
  const sk = k(ns, key);
  const now = Date.now();
  const m = mem.get(sk);
  if (m && m.expire > now) return m.value as T;
  if (m && m.expire <= now) mem.delete(sk);
  try {
    const raw = localStorage.getItem(sk);
    if (!raw) return null;
    const obj = JSON.parse(raw) as CacheItem;
    if (obj.expire > now) {
      mem.set(sk, obj);
      return obj.value as T;
    }
    localStorage.removeItem(sk);
  } catch {}
  return null;
}

export function setCache(ns: string, key: string, value: any, ttlMs = 60000) {
  const sk = k(ns, key);
  const item: CacheItem = { value, expire: Date.now() + Math.max(ttlMs, 1000) };
  mem.set(sk, item);
  try {
    localStorage.setItem(sk, JSON.stringify(item));
  } catch {}
}

export function clearCache(ns: string, key?: string) {
  if (key) {
    const sk = k(ns, key);
    mem.delete(sk);
    localStorage.removeItem(sk);
    return;
  }
  Array.from(mem.keys()).forEach((kk) => kk.startsWith(ns + ':') && mem.delete(kk));
  Object.keys(localStorage).forEach((kk) => kk.startsWith(ns + ':') && localStorage.removeItem(kk));
}
