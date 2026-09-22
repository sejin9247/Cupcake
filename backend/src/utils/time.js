export const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
  const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
  signal?.addEventListener('abort', onAbort, { once: true });
});

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* 호출을 한 줄로 세워 최소 간격을 지킨다 (Nominatim 초당 1회 정책 등) */
export function createThrottle(minIntervalMs) {
  let chain = Promise.resolve();
  let last = 0;
  return fn => {
    const p = chain.then(async () => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      try { return await fn(); } finally { last = Date.now(); }
    });
    chain = p.catch(() => {});
    return p;
  };
}
