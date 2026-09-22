/* 브라우저가 요청을 취소하면(다른 지역을 새로 검색 등) 외부 API 호출도 함께 끊도록 req.abortSignal을 붙인다 */
export function requestSignal(req, res, next) {
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ac.abort(new DOMException('Client closed request', 'AbortError')); });
  req.abortSignal = ac.signal;
  next();
}
