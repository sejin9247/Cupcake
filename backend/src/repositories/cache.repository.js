/* 외부 API 응답 캐시.
   지금은 메모리에 두지만, 인터페이스(get/set/delete, 모두 async)를 유지한 채
   DB(예: cache 테이블)나 Redis 구현으로 바꾸면 서비스 코드는 고칠 필요가 없다. */

class MemoryCache {
  constructor({ maxEntries = 200 } = {}) {
    this.maxEntries = maxEntries;
    this.map = new Map();
  }

  async get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) { this.map.delete(key); return undefined; }
    // 최근 사용 순서 유지 (LRU)
    this.map.delete(key); this.map.set(key, hit);
    return hit.value;
  }

  async set(key, value, ttlMs) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + ttlMs });
    while (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value);
  }

  async delete(key) { this.map.delete(key); }
}

export const cache = new MemoryCache();

/* 캐시에 있으면 돌려주고, 없으면 load()로 받아 저장한다 */
export async function cached(key, ttlMs, load) {
  const hit = await cache.get(key);
  if (hit !== undefined) return hit;
  const value = await load();
  await cache.set(key, value, ttlMs);
  return value;
}
