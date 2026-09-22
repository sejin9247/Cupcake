/* 응답 형식: { error: { message, i18n?, code? } }
   프론트엔드 api/backend.js가 이 형식을 읽어 화면 언어에 맞는 오류로 바꾼다. */
export function notFound(req, res) {
  res.status(404).json({ error: { message: `Not found: ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (req.abortSignal?.aborted || res.headersSent) return;   // 클라이언트가 이미 떠남
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
  res.status(status).json({
    error: {
      message: status >= 500 && !err.status ? 'Internal server error' : err.message,
      ...(err.i18n && { i18n: err.i18n }),
      ...(err.code !== undefined && { code: err.code }),
      ...(err.fields && { fields: err.fields }),
      ...(err.details && { details: err.details }),
    },
  });
}
