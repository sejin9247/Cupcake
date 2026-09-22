/* 라우트·서비스에서 던지는 오류. errorHandler가 JSON 응답으로 바꾼다.
   i18n: 프론트엔드 i18n.js의 문구 키({ k, v })를 넘기면 화면 언어에 맞춰 번역해 보여 준다.
   fields: 입력 검증 오류일 때 칸별 메시지 ({ title: '필수 항목입니다' })
   details: 그 밖에 화면이 쓸 정보 (예: 중복 후보 목록) */
export class HttpError extends Error {
  constructor(status, message, { i18n, code, fields, details } = {}) {
    super(message);
    this.status = status;
    if (i18n) this.i18n = i18n;
    if (code !== undefined) this.code = code;
    if (fields) this.fields = fields;
    if (details) this.details = details;
  }
}
