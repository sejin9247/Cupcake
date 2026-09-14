# 🏙 아파트 밀도 CBD 탐색기

지역을 지정하면 그 지역 안에서 **아파트가 지역 평균보다 두드러지게 밀집한 권역**을 찾아 CBD(중심 권역)로 선정하고 지도와 차트로 보여주는 대시보드입니다.
HTML 한 파일로 동작하며, 빌드 도구가 필요 없습니다.

## 🚀 실행

OSM 타일·Nominatim 이용 정책상 `file://`보다 로컬 서버로 여는 것을 권장합니다. Python이나 Node 없이 PowerShell만 있으면 됩니다.

```powershell
powershell -ExecutionPolicy Bypass -File cbd-dashboard/serve.ps1
```

브라우저에서 <http://localhost:8765> 을 엽니다. `#q=성남시 분당구`처럼 주소 뒤에 검색어를 붙이면 바로 분석합니다.

## 🗺 지역 지정 방법

| 방법 | 설명 |
|---|---|
| 🔍 검색 | 지도 왼쪽 위 검색창에 `성남시 분당구`, `송파구` 등을 입력합니다. 후보가 여러 곳이면 목록에서 고를 수 있습니다. |
| 📍 지도 클릭으로 선택 | 단위(시·도 / 시·군·구 / 읍·면·동)를 고른 뒤 지도를 클릭하면 그 위치의 행정 경계를 가져옵니다. |
| ✏️ 영역 직접 그리기 | 지도를 클릭해 꼭짓점을 찍고, 마지막 점을 더블클릭(또는 [완료])하면 그 다각형으로 분석합니다. Esc로 취소합니다. |

넓은 영역(2,500 km² 초과)은 Overpass 부하 때문에 분석하지 않습니다.

## 📐 CBD 선정 방식

1. **아파트 수집**: Overpass API로 영역 범위의 `building=apartments` 건물을 받아 영역 폴리곤 안의 것만 남깁니다.
2. **육각 격자 밀도**: 영역을 육각 격자로 나누고 격자별 밀도를 구합니다. 가우시안 커널로 평활화할 수 있습니다.
3. **지역대비 밀도(LQ)**: `격자 밀도 ÷ 지역 평균 밀도`. LQ 2는 지역 평균의 두 배라는 뜻입니다.
4. **군집화**: LQ가 임계값(기본 ×2.0) 이상인 격자 중 맞닿은 것끼리 묶습니다.
5. **선정**: 아파트 규모(밀도×면적 합)가 가장 큰 군집이 **CBD**, 그다음 군집들이 **부도심**입니다.

오른쪽 패널에서 임계값, 격자 크기, 평활화 강도, 가중치(건물 동수 / 연면적 추정)를 바꾸면 데이터를 다시 받지 않고 즉시 재계산합니다.

## 🍩 건물 유형 구성

CBD 중심에서 반경 1·2·3·5 km 안의 **모든 OSM 건물**을 받아 용도별 도넛 차트로 보여줍니다.

| 유형 | 분류 기준 (OSM 태그) |
|---|---|
| 주거 | `building=apartments, residential, house, detached, terrace, dormitory …` |
| 상업·업무 | `building=commercial, office, officetel, retail, hotel …` 또는 `shop`·`office` 태그 |
| 공공·교육 | `building=public, school, university, kindergarten, hospital …` 또는 공공시설 `amenity` |
| 종교·문화 | `building=church, temple, religious, museum, stadium …` 또는 `amenity=place_of_worship` |
| 공업 | `building=industrial, factory, warehouse …` 또는 `craft`·`industrial` 태그 |
| 미분류 | 위에 해당하지 않는 건물 (`building=yes` 등) |

도넛 가운데 숫자는 용도가 확인된 건물 비율입니다. 한국 OSM은 `building=yes`만 입력된 건물이 많아 미분류 비중이 크게 나올 수 있습니다.
지도 레이어 메뉴에서 **건물 유형별 건물**을 켜면 반경 안 건물을 유형 색으로 볼 수 있습니다.

## 🔌 사용 API

| API | 용도 | 키 |
|---|---|---|
| OpenStreetMap 타일 (`tile.openstreetmap.org`) | 배경 지도 | 불필요 |
| Nominatim | 지역 검색, 클릭 위치 경계 조회, 군집 이름 | 불필요 (초당 1회 제한) |
| Overpass API (`overpass-api.de`, 예비 `overpass.kumi.systems`) | 아파트 건물 수집 | 불필요 |
| SGIS OpenAPI3 (`sgisapi.mods.go.kr`) | 행정동 경계, 주택총조사 아파트 수 | **필요 (선택 기능)** |

### SGIS 키 설정 (선택)

1. [SGIS 개발지원센터](https://sgis.mods.go.kr/developer/)에서 서비스 ID(consumer_key)와 보안 Key(consumer_secret)를 발급받습니다.
2. 대시보드 오른쪽 위 **⚙ SGIS 설정**에 입력하고 **연결 테스트**로 확인합니다. 키는 브라우저 localStorage에만 저장됩니다.
3. 키를 설정하면 행정동별 지역대비 밀도 차트와 표, 행정동 밀도 지도 레이어가 추가됩니다.

SGIS 호출 경로:
- `auth/authentication.json`: accessToken 발급
- `addr/stage.json`: 시·도 → 시·군·구 코드 탐색
- `boundary/hadmarea.geojson`: 행정동 경계 (UTM-K, 브라우저에서 WGS84로 변환)
- `stats/house.json` (`house_type`): 행정동별 아파트 주택 수. 아파트 코드 기본값은 `02`이며 설정에서 바꿀 수 있습니다.

## ⚠️ 유의점

- 여기서 말하는 CBD는 전통적인 업무지구가 아니라 **아파트 밀집 핵심 권역**입니다.
- OSM 건물 입력이 부족한 지역은 결과가 치우칠 수 있습니다. SGIS 통계와 함께 보세요.
- Overpass 공용 서버가 혼잡하면 504가 날 수 있습니다. 이 경우 예비 서버로 자동 재시도합니다.

## 🛠 기술

- Leaflet 1.9 (지도), Turf.js 7 (공간 연산), proj4js (UTM-K 좌표 변환)
- Vanilla JavaScript, 프레임워크 없음
