/* 키-값 저장소. 값은 JSON.
   get(key) · set(key, value, ttlSec?) · del(key) · incr(key, ttlSec) — 모두 async

   - Redis (Upstash REST): 배포용. 서버 인스턴스가 여러 개이거나 요청마다 새로 떠도 같은 데이터를 본다.
   - 로컬: TTL이 있는 값(세션·로그인 제한)은 메모리에만, TTL이 없는 값(프로젝트)은 dataDir/<key>.json 파일에. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config/index.js';
import { HttpError } from '../utils/httpError.js';

function createRedisStore({ redisUrl, redisToken, prefix }) {
  async function cmd(...args) {
    const r = await fetch(redisUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const js = await r.json().catch(() => ({}));
    if (!r.ok || js.error) throw new Error(`Redis ${args[0]} failed: ${js.error || r.status}`);
    return js.result;
  }
  const k = key => prefix + key;
  return {
    kind: 'redis',
    persistent: true,
    async get(key) { const v = await cmd('GET', k(key)); return v == null ? null : JSON.parse(v); },
    async set(key, value, ttlSec) {
      await (ttlSec ? cmd('SET', k(key), JSON.stringify(value), 'EX', ttlSec) : cmd('SET', k(key), JSON.stringify(value)));
    },
    async del(key) { await cmd('DEL', k(key)); },
    async incr(key, ttlSec) {
      const n = await cmd('INCR', k(key));
      if (n === 1) await cmd('EXPIRE', k(key), ttlSec);
      return n;
    },
  };
}

function createLocalStore(dir, { persistent }) {
  const mem = new Map();   // key → { value, exp }
  const file = key => join(dir, `${key.replace(/[^\w.-]/g, '_')}.json`);
  let writing = Promise.resolve();

  const live = key => {
    const hit = mem.get(key);
    if (hit && hit.exp && hit.exp <= Date.now()) { mem.delete(key); return undefined; }
    return hit;
  };

  return {
    kind: 'local',
    persistent,
    async get(key) {
      const hit = live(key);
      if (hit) return hit.value;
      try {
        const value = JSON.parse(await readFile(file(key), 'utf8'));
        mem.set(key, { value, exp: 0 });
        return value;
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    async set(key, value, ttlSec) {
      if (ttlSec) { mem.set(key, { value, exp: Date.now() + ttlSec * 1000 }); return; }
      // 배포 환경의 파일 시스템은 요청이 끝나면 사라지므로 저장을 거절한다 (Redis 연결 필요)
      if (!persistent) throw new HttpError(503, '저장소가 연결되지 않았습니다. Vercel에서 Upstash Redis를 연결하세요.');
      mem.set(key, { value, exp: 0 });
      const snapshot = JSON.stringify(value, null, 2);
      // 임시 파일에 쓴 뒤 이름을 바꿔, 저장 도중 꺼져도 기존 파일이 깨지지 않게 한다
      writing = writing.catch(() => {}).then(async () => {
        await mkdir(dir, { recursive: true });
        await writeFile(file(key) + '.tmp', snapshot, 'utf8');
        await rename(file(key) + '.tmp', file(key));
      });
      await writing;
    },
    async del(key) { mem.delete(key); },
    async incr(key, ttlSec) {
      const hit = live(key);
      const n = (hit?.value ?? 0) + 1;
      mem.set(key, { value: n, exp: hit?.exp || Date.now() + ttlSec * 1000 });
      return n;
    },
  };
}

const { redisUrl, redisToken } = config.store;
export const store = redisUrl && redisToken
  ? createRedisStore(config.store)
  : createLocalStore(config.dataDir, { persistent: !config.onVercel });
