# Cupcake

전세진(JEON SE JIN)의 작업 저장소입니다.

🌐 **배포된 사이트 — <https://cupcakeprofile.vercel.app>**

## 📁 내용물

| 경로 | 설명 |
|---|---|
| [`portfolio/`](portfolio/) | **포트폴리오 사이트** — 배포 대상. 자세한 내용은 [portfolio/README.md](portfolio/README.md) |
| └ `portfolio/cbd-dashboard/` | 프로젝트 01 — 아파트 밀도 CBD 탐색기 |
| └ `portfolio/profile/` | 프로젝트 02 — 편집 디자인 프로필 페이지 |

## ☁️ 배포

[`vercel.json`](vercel.json)에 `outputDirectory: "portfolio"`가 지정돼 있어,
Vercel에서 이 저장소를 **Import 하고 그대로 Deploy만 누르면 됩니다.**
대시보드에서 Root Directory를 따로 만질 필요가 없습니다.

```json
{ "framework": null, "buildCommand": null, "outputDirectory": "portfolio" }
```

배포되면 `/`는 포트폴리오 허브, `/cbd-dashboard/`와 `/profile/`는 각 프로젝트 데모로 열립니다.

> Import 화면에서 Framework Preset이 `Other`가 아닌 값으로 자동 감지되면 `Other`로 바꿔 주세요.

## 💻 로컬에서 보기

`portfolio/index.html`을 브라우저로 열면 됩니다. 빌드 도구가 필요 없습니다.
