# 🛠 Backend · API 서버

CBD 탐색기의 데이터 요청을 받아 외부 API(Nominatim · Overpass · SGIS)를 대신 호출하는 Node.js 서버입니다.
DB는 아직 연결하지 않았고, 연결할 자리(`src/db/`, `src/repositories/`)만 마련돼 있습니다.

## 🚀 실행

Node.js 22 이상이 필요합니다.

```powershell
npm install
copy .env.example .env
npm run dev      # 파일을 고치면 자동 재시작
npm start        # 일반 실행
npm test         # 테스트 (외부 API를 부르지 않음)
npm run set-password   # 관리자 비밀번호 설정 (처음 한 번, 바꿀 때마다)
```

- API: <http://localhost:4000/api/health>
- 프론트엔드도 함께 서빙합니다: <http://localhost:4000/cbd-dashboard/>
- 관리자 화면: <http://localhost:4000/admin/>

## ⚙️ 환경 변수 (`.env`)

| 이름 | 설명 | 기본값 |
|---|---|---|
| `PORT` | 서버 포트 | `4000` |
| `CORS_ORIGINS` | 호출을 허용할 프론트엔드 주소 (쉼표 구분) | `localhost:8765`, `localhost:4000` |
| `USER_AGENT` | 외부 API에 보낼 User-Agent | `cupcake-cbd-explorer/0.1 …` |
| `SGIS_KEY`, `SGIS_SECRET` | SGIS 키. 넣어 두면 브라우저에 키를 입력하지 않아도 됩니다 | 없음 |
| `DATABASE_URL` | DB 주소 (아직 사용 안 함) | 없음 |
| `ADMIN_PASSWORD_HASH` | 관리자 비밀번호의 scrypt 해시. 직접 쓰지 말고 `npm run set-password`로 만듭니다 | 없음 (로그인 불가) |
| `DATA_DIR` | 프로젝트 저장 폴더 (로컬) | `backend/data` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis (배포). Vercel Storage에서 연결하면 자동으로 들어갑니다 | 없음 (로컬 파일) |
| `ENABLE_PROXY` | 외부 API 중계 라우트 사용 여부 | 로컬 `true`, Vercel `false` |

`.env`는 git에 올라가지 않습니다. 새 변수는 `.env.example`과 `src/config/index.js`에 함께 추가하세요.

## 📁 구조

```
src/
  server.js                 실행 진입점 (DB 연결 → listen)
  app.js                    Express 앱 구성 (CORS, JSON, 라우트, 오류 처리, 프론트엔드 정적 서빙)
  config/index.js           환경 변수 → config (다른 곳에서는 process.env를 직접 읽지 않음)
  routes/                   URL ↔ 서비스 연결만 담당
    index.js                  /api 아래 라우트 목록
    health.routes.js          GET  /api/health
    geo.routes.js             GET  /api/geo/nominatim/:path
    overpass.routes.js        POST /api/overpass
    sgis.routes.js            GET  /api/sgis/*, POST /api/sgis/test
    projects.routes.js        GET  /api/projects (공개 프로젝트)
    admin.routes.js           /api/admin/* (로그인 · 프로젝트 관리)
  services/                 외부 API 호출 · 재시도 · 요청 간격 · 토큰
  repositories/             데이터 저장소 (메모리 캐시, 프로젝트)
  store/index.js            키-값 저장소 — 로컬 파일/메모리 또는 Upstash Redis
  db/index.js               DB 연결 자리
  middleware/               요청 취소 신호, 404 · 오류 응답
  utils/                    HttpError, sleep · throttle
scripts/set-admin-password.js  관리자 비밀번호 해시 생성
test/                       node:test 테스트
```

요청 흐름: **route → service → (repository / 외부 API)**. 라우트는 얇게, 로직은 서비스에 둡니다.

## 🔌 API

| 메서드 · 경로 | 설명 |
|---|---|
| `GET /api/health` | `{ ok, sgis, db }` — 프론트엔드가 시작할 때 백엔드 사용 여부를 정합니다 |
| `GET /api/geo/nominatim/:path` | `search` · `reverse` · `lookup`. 쿼리는 Nominatim에 그대로 전달. 서버 전체에서 초당 1회로 제한, 24시간 캐시 |
| `POST /api/overpass` | `{ query, server? }` → `{ elements }`. 서버 순환 · 재시도, 6시간 캐시. `server`는 허용 목록에 있을 때만 사용 |
| `GET /api/sgis/{addr/stage.json, boundary/hadmarea.geojson, stats/house.json}` | SGIS 응답 그대로. 토큰 발급 · 갱신은 서버가 처리 |
| `POST /api/sgis/test` | SGIS 키 확인 |
| `GET /api/projects` | 공개된 프로젝트 목록 (사이트용) |
| `GET /api/admin/session` | 비밀번호 설정 여부, 저장소 연결 여부 |
| `POST /api/admin/login` · `logout` | 관리자 로그인(`{ token }` 반환) · 로그아웃 |
| `GET · POST /api/admin/projects`, `PUT · DELETE /api/admin/projects/:id` | 프로젝트 관리 (초안 포함, `Authorization: Bearer <token>` 필요) |
| `POST /api/admin/projects/:id/merge` | 중복 통합 (`{ ...입력값, removeId }`) |

SGIS 키는 `X-SGIS-Key` · `X-SGIS-Secret` 헤더(브라우저 설정 창의 키)가 우선이고, 없으면 `.env` 키를 씁니다.

오류 응답은 모두 `{ "error": { "message", "i18n"?, "code"? } }` 형식입니다.
`i18n`은 프론트엔드 `i18n.js`의 문구 키(`{ k, v }`)라서, 화면 언어에 맞춰 번역돼 보입니다.

## 🔐 관리자

- 비밀번호 원문은 코드·git·저장소 어디에도 없습니다. 로컬은 `.env`, 배포는 Vercel 환경 변수에 scrypt 해시만 두고, 응답·로그에도 나오지 않습니다.
- 로그인하면 세션 토큰을 받습니다. 관리자 화면은 이 토큰을 **페이지 메모리에만** 두고 쿠키·localStorage·sessionStorage에 쓰지 않습니다.
  → 창·탭을 닫거나, 새로고침하거나, 다른 페이지로 이동하면 토큰이 사라지고 서버 세션도 끝납니다. 새 창에서는 항상 비밀번호를 다시 입력합니다.
- 저장소에는 토큰 원문이 아니라 sha256 값만 둡니다. 30분 동안 요청이 없거나 로그인 후 8시간이 지나면 만료됩니다.
- 비밀번호를 틀리면: 같은 IP는 15분 안에 5번, 전체는 하루 20번에서 로그인이 잠깁니다. (짧은 비밀번호를 여러 IP로 맞히는 공격 방지. 대신 누군가 일부러 틀리면 하루 동안 로그인이 막힐 수 있습니다.)
- 관리자 페이지는 `Cache-Control: no-store`와 CSP(외부 스크립트 차단), 다른 사이트에 끼워 넣기 금지 헤더로 응답합니다.

### 프로젝트 저장 규칙

| 상태 | 필수 칸 | 사이트 표시 |
|---|---|---|
| 초안 (`draft`) | 없음 (단, 전부 비어 있으면 저장 안 됨) — **임시 저장** | 안 보임 |
| 공개 (`published`) | 제목 · 역할 · 설명 · 날짜 · 참여 인원 (참고사항만 선택) | `/#projects` 섹션에 표시 |

같은 규칙을 관리자 화면(`frontend/admin/admin.js`)과 서버(`src/services/project.service.js`)가 각각 검사합니다. 서버 검사가 최종입니다.

### 중복 확인

제목에서 띄어쓰기·기호·대소문자를 뺀 값이 같으면 중복으로 봅니다 (`duplicateKey()` 한 줄). 예: `CBD 탐색기` = `cbd-탐색기!`.
저장할 때 중복이 있으면 409를 돌려주고, 관리자 화면이 선택지를 보여 줍니다.

| 선택 | 동작 |
|---|---|
| 통합 | 기존 항목에 합침 — 제목은 기존 것, 입력한 칸은 새 내용, 빈 칸은 기존 내용. 둘 중 하나라도 공개였다면 공개 유지. 중복 항목은 삭제 |
| 제거 | 지금 입력(또는 저장된 중복 항목)을 버리고 기존 항목을 엶 |
| 따로 저장 | 그대로 저장 (`allowDuplicate`). 목록에 "중복" 표시가 남아 나중에 정리 가능 |

### 저장 위치

| 환경 | 프로젝트 | 세션 · 로그인 제한 |
|---|---|---|
| 로컬 | `backend/data/projects.json` (git 제외, 백업은 이 파일 복사) | 메모리 (서버 재시작 시 로그아웃) |
| 배포 (Vercel) | Upstash Redis | Upstash Redis |

`KV_REST_API_URL` · `KV_REST_API_TOKEN`(또는 `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN`)이 있으면 Redis를 씁니다 ([`src/store/index.js`](src/store/index.js)).
Vercel의 파일 시스템은 요청이 끝나면 사라지므로, 배포에서 Redis가 없으면 저장을 거절합니다(503).

## 🗄 DB 연결하기

1. 드라이버 설치 — 예: `npm install pg`
2. `.env`에 `DATABASE_URL` 입력
3. [`src/db/index.js`](src/db/index.js)의 `connectDb()`에서 연결 풀을 만들어 `db`에 넣기 (파일 안 예시 참고)
4. 테이블 접근은 `src/repositories/`에 파일을 추가해 그 안에서만 하기
   - 예: 분석 결과 저장 → `analysis.repository.js`의 `saveAnalysis()` · `findAnalysis()`
5. 프로젝트를 DB로 옮기려면 [`project.repository.js`](src/repositories/project.repository.js)의 `list` · `get` · `create` · `update` · `remove`를 DB 쿼리로 바꾸면 됩니다.
6. 캐시를 DB나 Redis로 옮기려면 [`cache.repository.js`](src/repositories/cache.repository.js)의
   `MemoryCache`를 같은 `get` · `set` · `delete` 모양의 구현으로 바꾸면 됩니다. 서비스 코드는 그대로입니다.

## ➕ 새 API 추가하기

1. `src/services/<이름>.service.js` — 외부 API 호출 또는 DB 로직
2. `src/routes/<이름>.routes.js` — 경로와 서비스 연결
3. `src/routes/index.js`에 `apiRouter.use('/<이름>', …)` 한 줄 추가
4. 프론트엔드: `frontend/cbd-dashboard/api/backend.js`에 호출 함수 추가 → `api/index.js`에서 `via('<함수>')`로 내보내기

## ⚠️ 유의점

- `POST /api/overpass`는 받은 Overpass 질의를 그대로 실행합니다. 공개 배포 전에는 요청 수 제한을 두거나,
  `GET /api/apartments?bbox=…`처럼 질의를 서버에서 만드는 전용 경로로 좁히는 것을 권장합니다.
- 캐시는 메모리에 있어 서버를 재시작하면 비워집니다.
- 외부 API 중계(`/api/geo`, `/api/overpass`, `/api/sgis`)는 로컬 개발에서만 켜집니다. 배포 사이트의 CBD 탐색기는 브라우저가 외부 API를 직접 부릅니다.
- 백엔드 모드에서는 Overpass 재시도 진행 상황("○초 대기" 등)이 화면에 표시되지 않고, 최종 결과나 오류만 전달됩니다.
