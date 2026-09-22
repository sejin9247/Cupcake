# ⛵ JEON SE JIN · Portfolio

**공간을 설계한다 — 장소를 선물한다**

바다 위를 항해하듯 스크롤하며 포트폴리오를 둘러보는 개인 사이트입니다.
빌드 도구·프레임워크 없이 HTML / CSS / Vanilla JS로만 동작합니다.

🌐 <https://cupcakeprofile.vercel.app>

## 📁 구조

```
index.html              메인 포트폴리오 허브 (항해 인트로 + 프로젝트 + 이력)
assets/
  css/site.css          전체 스타일
  js/voyage.js          바다 장면 캔버스 엔진 (스크롤 연동)
  js/site.js            스크롤 진행도 · 챕터 전환 · 탭 · 등장 애니메이션
  img/                  프로필 · 스크린샷
cbd-dashboard/          프로젝트 01 — 아파트 밀도 CBD 탐색기 (실행 가능한 데모)
```

## 🌊 항해 인트로

스크롤 진행도(0 → 1)에 따라 캔버스 장면이 세 단계로 이어집니다. 영상 파일 없이 전부 코드로 그립니다.

| 구간 | 시점 | 화면 |
|---|---|---|
| 0.00 – 0.30 | 외부 시점 | 잔잔한 바다 위의 배, 양옆 동행 선박 · 대표 문구 |
| 0.30 – 0.62 | 갑판 시점 | 배를 타고 전진하며 "무엇을 보는지" 한 줄씩 등장 |
| 0.62 – 1.00 | 항공 시점 | 카메라가 떠올라 항공뷰로 전환 · 한 줄 자기소개 |

이후 프로젝트 쇼케이스 → 프로젝트 상세 → 이력 → 연락처가 이어집니다.
상단 우측 **Skip intro**로 인트로를 건너뛸 수 있습니다.

## 🚀 실행

`index.html`을 브라우저로 열면 됩니다. 로컬 서버가 필요하면:

```powershell
powershell -ExecutionPolicy Bypass -File cbd-dashboard/serve.ps1
```

## ☁️ 배포 (Vercel)

저장소: <https://github.com/sejin9247/Cupcake> · 이 사이트는 `frontend/` 하위에 있습니다

저장소 루트의 `vercel.json`이 배포 디렉터리를 `frontend`로 지정하므로,
Vercel에서 Import 후 Deploy만 누르면 됩니다.


## 🖼 이미지

| 경로 | 내용 | 상태 |
|---|---|---|
| `assets/img/cbd-landing.png` | CBD Finder 표지 화면 | ✅ 준비됨 |
| `assets/img/og.png` | 링크 공유용 썸네일 (1200×630) | ✅ 준비됨 |
| `assets/img/cbd-analysis.jpg` | CBD Finder 분석 결과 화면 (송파구) | ✅ 준비됨 |
| `assets/img/profile.png` | 프로필 이미지 | ✅ 준비됨 |

분석 화면을 다시 캡처하려면 대시보드에서 분석을 돌린 뒤 창 전체를 캡처하고,
가로 1920px · JPEG로 줄여 같은 경로에 덮어씁니다. 원본 2560×1440 PNG는 3.9 MB라
웹에는 무겁습니다 (현재 파일은 1920×1080 · 516 KB).

이미지 파일이 없으면 그 자리에 경로가 적힌 점선 박스가 표시되고, 사이트는 정상 동작합니다.

## 📄 이력서 PDF

`assets/resume.html`이 원본이고, Chrome 헤드리스로 A4 1페이지 PDF를 생성합니다.
내용을 고친 뒤 아래 명령으로 다시 뽑으면 사이트의 다운로드 버튼에 바로 반영됩니다.

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu `
  --no-pdf-header-footer --print-to-pdf="assets\resume-jeon-se-jin.pdf" `
  "assets\resume.html"
```

## 🛠 기술

- Vanilla JavaScript · HTML5 Canvas 2D (바다 장면)
- CSS Grid / Flexbox · `position: sticky` 기반 스크롤 연출
- Instrument Serif · Noto Serif KR · IBM Plex Mono · Pretendard
- 프레임워크 · 번들러 · 애니메이션 라이브러리 없음
- `prefers-reduced-motion` 대응, 860px 이하 모바일 레이아웃
