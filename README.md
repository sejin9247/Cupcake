# Cupcake

전세진(JEON SE JIN)의 작업 저장소입니다.

🌐 **배포된 사이트 — <https://cupcakeprofile.vercel.app>**

## 📁 내용물

| 경로 | 설명 |
|---|---|
| [`frontend/`](frontend/) | **프론트엔드** — 포트폴리오 사이트 (정적 HTML/CSS/JS, Vercel 배포 대상). 자세한 내용은 [frontend/README.md](frontend/README.md) |
| └ `frontend/cbd-dashboard/` | 프로젝트 01 — 아파트 밀도 CBD 탐색기 |
| └ 프로젝트 02 | 화성시 동탄구 조례 지표판 — 별도 배포(<https://cupcakegroundused.vercel.app>), 과정물은 `frontend/assets/projects/dongtan/` |
| └ `frontend/profile/` | 프로필 페이지 |
| └ `frontend/admin/` | 관리자 화면 — 프로젝트 추가 · 수정 (백엔드 필요) |
| [`backend/`](backend/) | **백엔드** — Node.js API 서버. 외부 API 중계, 이후 DB 연결 지점. 자세한 내용은 [backend/README.md](backend/README.md) |

## 🔀 프론트엔드 ↔ 백엔드

CBD 탐색기는 데이터 요청을 모두 `frontend/cbd-dashboard/api/`(DataAPI)로 보냅니다.
시작할 때 백엔드(`/api/health`)가 응답하면 백엔드를, 응답하지 않으면 예전처럼 외부 API를 직접 부릅니다.

```
브라우저 app.js ─▶ DataAPI ─┬─ 백엔드 모드 ─▶ backend (/api/...) ─▶ Nominatim · Overpass · SGIS (· DB)
                            └─ 직접 모드 ───▶ Nominatim · Overpass · SGIS
```

그래서 백엔드를 아직 배포하지 않아도 배포 사이트는 지금처럼 동작합니다.
백엔드를 배포하면 `frontend/cbd-dashboard/config.js`의 `apiBase`에 주소를 넣으면 됩니다.

## 💻 로컬 개발

```powershell
cd backend
npm install
copy .env.example .env     # 필요하면 SGIS 키 입력
npm run dev
```

- <http://localhost:4000/cbd-dashboard/> — 백엔드가 프론트엔드까지 함께 서빙합니다 (백엔드 모드)
- <http://localhost:4000/> — 포트폴리오 허브 (관리자 화면에서 공개한 프로젝트가 `Projects` 섹션에 표시됨)
- <http://localhost:4000/admin/> — 관리자 화면 (처음 한 번 `npm run set-password`로 비밀번호 설정)

백엔드 없이 보려면 `frontend/index.html`을 브라우저로 열면 됩니다 (직접 모드).

## ☁️ 배포 (Vercel)

GitHub `main`에 push하면 Vercel이 자동으로 배포합니다 → <https://cupcakeprofile.vercel.app>

| 경로 | 무엇이 처리하나 |
|---|---|
| `/`, `/cbd-dashboard/`, `/admin/` … | `frontend/` 정적 파일 ([`vercel.json`](vercel.json)의 `outputDirectory`) |
| `/api/*` | [`api/index.js`](api/index.js) 서버리스 함수 → `backend/`의 Express 앱 |

루트의 [`package.json`](package.json)은 이 함수가 쓰는 의존성(express · cors)만 담고 있습니다. 로컬 개발은 계속 `backend/`에서 합니다.

### 처음 한 번 — Vercel 대시보드에서 설정

관리자 화면이 배포 사이트에서 동작하려면 두 가지가 필요합니다. (코드·git에는 넣지 않습니다)

1. **저장소 연결** — 프로젝트 → Storage → Upstash(Redis) 만들기 → 이 프로젝트에 Connect.
   `KV_REST_API_URL` · `KV_REST_API_TOKEN`이 자동으로 추가됩니다.
2. **관리자 비밀번호** — 프로젝트 → Settings → Environment Variables → `ADMIN_PASSWORD_HASH` 추가 (Sensitive 체크).
   값은 로컬에서 `npm run set-password`를 실행한 뒤 `backend/.env`의 `ADMIN_PASSWORD_HASH=` 뒤 값을 그대로 복사합니다.
3. Deployments → 최신 배포 → Redeploy (환경 변수는 다시 배포해야 적용됩니다).

로컬(`backend/data/projects.json`)과 배포(Redis)의 프로젝트는 서로 따로 저장됩니다.

> 배포별 주소(`cupcakeprofile-xxxx-jeon14.vercel.app`)가 Vercel 로그인 화면으로 넘어가는 것은 Vercel의 Deployment Protection 설정 때문입니다.
> 누구나 보게 하려면 Settings → Deployment Protection → Vercel Authentication을 끄면 됩니다. 메인 주소는 이 설정과 관계없이 열립니다.
