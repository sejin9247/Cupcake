'use strict';
/* ============================================================
   화면 문구 사전 · 번역 도우미 (app.js보다 먼저 로드)
   - t(key, vars): 현재 언어 문구. {name} 자리표시자를 채운다.
   - tk(key, vars): 나중에 언어가 바뀌어도 다시 번역할 수 있게 key를 보관한 객체.
   - tx(value): 문자열 · tk 객체 · Error · 함수를 현재 언어 문자열로 바꾼다.
   ============================================================ */
const LANG_KEY = 'cbd-dash-lang';

const I18N = {
  ko: {
    'doc.title': '아파트 밀도 CBD 탐색기',
    'lang.group': '언어',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.home': '첫 화면으로',

    /* landing */
    'land.eyebrow': '아파트 밀도로 읽는 도시의 중심',
    /* 표지 제목은 언어와 상관없이 영어 문구로 고정한다 */
    'land.lines': ['APARTMENT', 'DENSITY', 'CBD FINDER'],
    'land.aria': '아파트 밀도로 도시의 중심을 찾는 사이트',
    'land.sub': '지역을 고르면 아파트가 지역 평균보다 두드러지게 모인 곳을 찾아 CBD로 선정하고, 지도와 차트로 보여 드립니다.',
    'land.cta': '분석 시작하기',
    'land.footL': 'SMU · Green Smart City',
    'land.footR': 'OSM · Overpass · SGIS',

    /* about */
    'about.title': '이 사이트는',
    'about.lead': '도시의 중심이 어디인지 <b>아파트 밀도</b>로 읽어 보기 위해 만든 분석 도구입니다. 지역 안에서 아파트가 평균보다 두드러지게 몰린 곳을 찾아 CBD(중심 권역)로 선정합니다.',
    'about.items': [
      ['⌕', '지역 지정', '검색 · 지도 클릭 · 영역 직접 그리기로 분석할 곳을 고릅니다.'],
      ['⬡', '지역대비 밀도', '육각 격자마다 아파트 밀도가 지역 평균의 몇 배인지 계산합니다.'],
      ['◎', 'CBD · 부도심 선정', '밀집 격자가 이어진 군집을 찾아 지도에 표시합니다.'],
      ['◔', '건물 유형 구성', 'CBD 반경 안 건물의 용도를 도넛 차트로 보여 줍니다.'],
      ['▦', '행정동 비교', 'SGIS 주택총조사 아파트 수로 행정동별 밀도를 비교합니다.'],
    ],
    'about.foot': '데이터 · OpenStreetMap, Overpass, Nominatim, SGIS(국가데이터처)',
    'about.close': '닫기',

    /* header / theme / settings */
    'app.title': '아파트 밀도 CBD 탐색기',
    'app.subtitle': 'OpenStreetMap · Overpass · SGIS 기반 지역대비 밀도 분석',
    'theme.light': '라이트',
    'theme.dark': '다크',
    'theme.switchTo': '{mode} 모드로 전환',
    'sgis.btn': 'SGIS 설정',
    'badge.on': '키 설정됨',
    'badge.off': '키 없음',

    /* map bar */
    'map.aria': '분석 지도',
    'search.placeholder': '지역 검색 (예: 성남시 분당구, 송파구)',
    'search.aria': '지역 검색',
    'search.btn': '검색',
    'modes.aria': '지역 지정 방법',
    'pick.btn': '📍 지도 클릭으로 선택',
    'pick.levelAria': '클릭 선택 단위',
    'level.sgg': '시·군·구 단위',
    'level.dong': '읍·면·동 단위',
    'level.sido': '시·도 단위',
    'pickName.sgg': '시·군·구',
    'pickName.dong': '읍·면·동',
    'pickName.sido': '시·도',
    'draw.btn': '✏️ 영역 직접 그리기',
    'hint.pick': '지도에서 분석할 곳을 클릭하세요 — 그 위치의 <b>{level}</b> 경계를 가져옵니다',
    'hint.draw': '지도를 클릭해 꼭짓점을 찍고, 마지막 점을 <b>더블클릭</b>하거나 {finish}를 누르세요',
    'hint.need3': '꼭짓점이 3개 이상 필요합니다 · 계속 클릭하세요',
    'hint.cancel': '취소',
    'hint.finish': '완료',
    'hint.undo': '되돌리기',
    'results.head': '검색 결과 {n}곳 · 다른 지역을 고를 수 있습니다',
    'results.close': '닫기',
    'examples': ['성남시 분당구', '서울특별시 송파구', '고양시 일산서구', '대전광역시 서구', '세종특별자치시'],
    'empty.title': '어느 지역의 중심지를 찾아볼까요?',
    'empty.body': '왼쪽 위 검색창에 지역을 입력하거나, <b>지도 클릭으로 선택</b> · <b>영역 직접 그리기</b>로 분석할 지역을 지정하세요. 아파트가 지역 평균보다 두드러지게 모인 군집을 CBD로 선정합니다.',

    /* base map & layers */
    'base.osm': 'OSM 기본 지도',
    'base.gray': 'OSM 흑백 (데이터 강조)',
    'attr.sgis': '통계: SGIS',
    'layer.hex': '육각 격자 밀도',
    'layer.dongFill': '행정동 밀도 (SGIS)',
    'layer.dongLine': '행정동 경계 (SGIS)',
    'layer.apts': '아파트 건물 (OSM)',
    'layer.cbd': 'CBD · 부도심',
    'layer.bldRing': '건물 유형 분석 반경',
    'layer.bldPts': '건물 유형별 건물 (반경 내)',
    'legend.title': '지역대비 아파트 밀도 (LQ)',
    'legend.cbd': 'CBD 군집',
    'legend.sub': '부도심 군집',

    /* steps */
    'step.geo': '분석 지역 지정',
    'step.osm': '아파트 건물 수집',
    'step.sgis': '행정동 경계 · 주택통계',
    'step.calc': '지역대비 밀도 분석 · CBD 선정',
    'status.wait': '대기', 'status.run': '진행 중', 'status.ok': '완료', 'status.err': '오류', 'status.skip': '생략',
    'geo.searching': '"{q}" 검색 중',
    'geo.notFound': '경계가 있는 지역을 찾지 못했습니다. 시·군·구 이름으로 검색하거나 지도에서 직접 지정해 보세요.',
    'geo.picking': '{level} 경계 조회 중 ({lat}, {lon})',
    'geo.pickFail': '이 위치에서 행정 경계를 찾지 못했습니다. 다른 곳을 클릭하거나 영역을 직접 그려 보세요.',
    'geo.ok': '{display} — {area} km²',
    'geo.note': "OSM에 {level} 경계가 없어 '{name}' 경계를 사용",
    'osm.tooBig': '영역이 너무 넓습니다 ({area} km² > {max} km²). 시·군·구 단위로 좁혀 주세요.',
    'osm.bigWait': '넓은 지역이라 수집에 시간이 걸릴 수 있습니다',
    'osm.querying': 'building=apartments 질의 중',
    'osm.retry': '{msg} · 재시도 중',
    'osm.ok': '아파트 건물 {n}동 (층수 정보 {p}%)',
    'osm.none': 'OSM에 입력된 아파트 건물(building=apartments)이 없습니다',
    'osm.fail': '수집 실패: {msg}',
    'sgis.custom': '직접 그린 영역은 행정동 비교를 생략합니다',
    'sgis.noKey': '키 미설정 — 오른쪽 위 SGIS 설정에서 입력하면 행정동 비교가 추가됩니다',
    'sgis.auth': '인증 · 행정구역 코드 조회 중',
    'sgis.progress': '경계 · 주택통계 수신 {d}/{n}',
    'sgis.ok': '{level} {n}개 경계 ({year}년){warn}',
    'sgis.warn': ' · 통계 일부 실패: {msg}',
    'sgis.lvlEmd': '읍면동',
    'sgis.lvlSgg': '시군구',
    'sgis.noSido': 'SGIS 시·도 코드를 찾지 못했습니다',
    'sgis.dongSkip': '읍·면·동 단위 지역은 행정동 비교를 생략합니다',
    'sgis.noCode': "SGIS에서 '{name}' 코드를 찾지 못했습니다",
    'sgis.empty': '{year}년 행정구역 경계가 비어 있습니다',
    'sgis.error': 'SGIS 오류',
    'calc.running': '격자 밀도 계산 중',
    'calc.ok': '격자 {cells}개 (한 변 {side} m) · 군집 {n}개',
    'calc.dongOnly': '행정동 통계로 CBD 선정 (OSM 건물 없음)',
    'calc.noData': 'OSM 아파트 건물과 SGIS 통계가 모두 없습니다',
    'op.http': '{host} HTTP {status}{why}',
    'op.why429': ' (요청 과다)',
    'op.why504': ' (서버 혼잡)',
    'op.timeout': '{host} 응답 시간 초과',
    'op.slotWait': 'Overpass 요청 한도로 {s}초 대기',
    'busy.default': '분석 중…',
    'busy.search': '지역 검색 중…',
    'busy.prep': '분석 준비 중…',
    'busy.osm': '아파트 건물 수집 중…',
    'busy.calc': '밀도 분석 중…',
    'busy.pick': '{level} 경계 찾는 중…',
    'region.custom': '직접 그린 영역',
    'region.customDisplay': '직접 그린 영역 (꼭짓점 {n}개)',

    /* hero & tiles */
    'hero.eyebrow': '선정된 CBD',
    'hero.placeholder': '지역을 지정하면 결과가 표시됩니다',
    'hero.analyzing': '분석 중…',
    'hero.fail': '분석을 완료하지 못했습니다 — 단계별 오류를 확인하세요',
    'hero.noResults': '검색 결과가 없습니다',
    'hero.noBoundary': '경계를 찾지 못했습니다',
    'hero.tooBig': '영역이 너무 넓습니다',
    'hero.noData': '분석할 아파트 데이터가 없습니다',
    'hero.insufficient': 'CBD를 선정할 데이터가 부족합니다',
    'hero.byDong': '선정된 CBD · 행정동 기준',
    'hero.vsAvg': '지역 평균 대비',
    'hero.densityVsAvg': '지역 평균 대비 밀도',
    'hero.dongOnlyDesc': 'OSM 아파트 건물이 없어 SGIS 아파트 주택 수 밀도로만 선정했습니다.',
    'hero.center': 'CBD 중심 {lat}, {lon}',
    'hero.desc': '군집 {area} km²(영역의 {pa}%)에 아파트 {ps}%가 모여 있습니다 · 최고 격자 ×{peak}',
    'hero.fallback': '임계값 ×{thr}을 넘는 격자가 없어 상위 3% 격자로 선정했습니다. 임계값을 낮춰 보세요.',
    'hero.bestDong': '행정동 기준 최고 밀도는 <b>{name}</b>(×{v})입니다.',
    'cluster.area': '{name} 일대',
    'tile.area': '분석 면적',
    'tile.apts': '아파트 건물 (OSM)',
    'tile.avg': '지역 평균 밀도',
    'tile.cbdArea': 'CBD 면적',
    'tile.cbdShare': 'CBD 아파트 비율',
    'tile.sgisApt': 'SGIS 아파트 주택',
    'tile.side': '격자 한 변',
    'unit.bldg': '동',
    'unit.kfloor': '천㎡',
    'unit.units': '호',
    'fmt.bldg': '{n}동',
    'fmt.units': '{n}호',

    /* panels */
    'common.afterAnalysis': '분석 후 표시됩니다',
    'common.needKey': 'SGIS 키를 설정하면 표시됩니다',
    'bld.title': '건물 유형 구성',
    'bld.subDefault': 'CBD 중심 반경 안의 OSM 건물을 용도별로 분류합니다',
    'bld.sub': '{center} 반경 {r} km 안의 OSM 건물을 용도별로 분류합니다',
    'bld.radiusAria': '분석 반경',
    'bld.radius': '반경 {r} km',
    'bld.rules': '분류 기준',
    'bld.cCbd': 'CBD 중심',
    'bld.cDong': 'CBD 행정동',
    'bld.cRegion': '영역 중심',
    'bld.loading': '반경 {r} km 건물 수집 중…',
    'bld.retry': '{msg} · 재시도 중',
    'bld.fail': '건물 수집 실패: {msg}',
    'bld.retryBtn': '다시 시도',
    'bld.none': '반경 {r} km 안에 OSM 건물이 없습니다',
    'bld.head': '반경 {r}km 건물 {n}동',
    'bld.aria': '반경 {r}km 건물 유형 구성 도넛 차트',
    'bld.known': '용도 확인됨',
    'bld.unkNote': "OSM 건물의 {p}%가 용도 없이(building=yes 등) 입력돼 미분류입니다. 지도 레이어 '건물 유형별 건물'에서 분포를 볼 수 있습니다.",
    'bld.ruleFallback': '<b>보완 분류</b> — building=yes 등 용도가 없으면 같은 건물의 amenity·shop·office·tourism·craft 태그로 분류합니다.',
    'bld.ruleUnk': '<b>미분류</b> — 위에 해당하지 않는 건물 (building=yes, roof, greenhouse, construction 등)',
    'type.res': '주거', 'type.com': '상업·업무', 'type.pub': '공공·교육', 'type.rel': '종교·문화', 'type.ind': '공업', 'type.unk': '미분류',

    'ctl.title': '분석 조건',
    'ctl.sub': '바꾸면 데이터를 다시 받지 않고 즉시 재계산합니다 · 항목 이름에 마우스를 올리면 설명이 나옵니다',
    'ctl.thr': 'CBD 임계값',
    'ctl.cell': '격자 크기',
    'ctl.smooth': '평활화',
    'ctl.mode': '가중치',
    'ctl.helpAria': '{name} 설명',
    'cell.auto': '자동 (지역 면적 기준)',
    'smooth.0': '없음 (격자 내 집계)',
    'smooth.075': '약하게',
    'smooth.125': '보통 (커널 밀도)',
    'smooth.2': '강하게',
    'mode.count': '건물 동수',
    'mode.floor': '연면적 추정',

    'hist.title': '지역대비 밀도 분포',
    'hist.sub': '아파트가 있는 격자의 LQ(격자 밀도 ÷ 지역 평균 밀도) 분포',
    'hist.none': '격자 데이터가 없습니다',
    'hist.over': '×{v} 이상',
    'hist.cells': '격자 {n}개 ({p}%)',
    'hist.candZone': 'CBD 후보 구간',
    'hist.partial': '임계값이 걸친 구간',
    'hist.thr': '임계값 ×{v}',
    'hist.legendCand': 'CBD 후보 (LQ ≥ {v}) {n}개',
    'hist.legendOther': '그 외 {n}개',
    'hist.aria': '격자 LQ 분포 히스토그램',

    'cluster.title': '중심지 군집',
    'cluster.sub': '임계값 이상 격자가 이어진 군집 · 막대 = 지역 전체 아파트 중 군집이 차지하는 비율',
    'cluster.none': '군집이 없습니다',
    'cluster.subN': '부도심 {n}',
    'cluster.tipApts': '아파트 {n}동 ({p}%)',
    'cluster.tipArea': '면적 {a} km² · 격자 {c}개',
    'cluster.tipLq': '평균 ×{m} · 최고 ×{pk}',
    'cluster.tipClick': '클릭하면 지도에서 확대',
    'cluster.more': '작은 군집 {n}개는 생략했습니다 (CBD 규모의 5% 미만 또는 6번째 이후)',
    'cluster.legendSub': '부도심',
    'cluster.legendVal': '값 = 아파트 비율 · 군집 평균 LQ',

    'tip.cbd': 'CBD 군집',
    'tip.apts': '아파트 <b>{n}동</b>',
    'tip.density': '밀도 {v} {u}/km²',
    'tip.vsAvg': '지역 평균 대비',

    'dong.title': '행정동별 지역대비 밀도',
    'dong.subDefault': 'SGIS 주택총조사 아파트 수 + OSM 아파트 건물의 LQ 평균',
    'dong.subStats': 'SGIS {year}년 아파트 주택 수와 OSM 아파트 건물의 LQ 평균 · 지역 평균 = ×1',
    'dong.subOsm': 'SGIS 주택통계가 없어 OSM 아파트 건물 LQ만 사용 · 지역 평균 = ×1',
    'dong.table': '표로 보기',
    'dong.custom': '직접 그린 영역은 행정동 비교를 하지 않습니다',
    'dong.loadFail': 'SGIS 데이터를 불러오지 못했습니다 — 단계 상태를 확인하세요',
    'dong.needKey': 'SGIS 키를 설정하면 행정동별 비교가 표시됩니다',
    'dong.noLq': '행정동 LQ를 계산할 수 없습니다',
    'dong.legendCbd': 'CBD가 속한 행정동',
    'dong.legendOther': '그 외',
    'dong.legendRef': '세로선 = 지역 평균(×1)',
    'dong.more': '상위 12개 / 전체 {n}개 — 전체는 아래 표에서 확인하세요',
    'dong.th': ['행정동', '면적 km²', 'SGIS 아파트(호)', '아파트 비중', 'OSM 동수', 'LQ SGIS', 'LQ OSM', '종합'],
    'dong.tipArea': '면적 {a} km²',
    'dong.tipSgis': 'SGIS 아파트 {v}',
    'dong.tipShare': '(주택의 {p}%)',
    'dong.tipOsm': 'OSM 아파트 {n}동',
    'dong.tipComp': '종합',

    'method.summary': '산정 방법',
    'method.body': `<ul>
      <li><b>지역 지정</b> — 검색·지도 클릭은 Nominatim(OSM) 행정 경계 폴리곤을, 직접 그리기는 그린 다각형을 분석 영역으로 씁니다.</li>
      <li><b>아파트</b> — Overpass로 영역 범위의 <code>building=apartments</code> 건물을 받아 영역 폴리곤 안의 것만 남깁니다. 연면적 추정은 바닥면적(건물 외곽 사각형의 75%로 추정) × <code>building:levels</code>(없으면 설정의 기본 층수)입니다.</li>
      <li><b>지역대비 밀도(LQ)</b> — 영역을 육각 격자로 나누고, 격자 밀도(가우시안 커널 평활화 선택)를 지역 평균 밀도(전체 아파트 ÷ 영역 면적)로 나눕니다. LQ 2는 평균의 두 배입니다.</li>
      <li><b>CBD 선정</b> — LQ가 임계값 이상인 격자 중 맞닿은 것끼리 군집으로 묶고, 아파트 규모(밀도×면적 합)가 가장 큰 군집을 CBD, 그다음 군집을 부도심으로 표시합니다. 임계값을 넘는 격자가 없으면 상위 3% 격자로 대신합니다.</li>
      <li><b>SGIS(선택)</b> — 행정동 경계(UTM-K → WGS84 변환)와 주택총조사 아파트 수(<code>stats/house.json</code>)로 행정동별 LQ를 계산해 OSM 결과와 평균합니다.</li>
    </ul>
    <p>여기서 CBD는 전통적인 업무 중심지가 아니라 <b>아파트가 지역 평균보다 두드러지게 밀집한 핵심 권역</b>을 뜻합니다. OSM 건물 입력이 부족한 지역은 결과가 치우칠 수 있으니 SGIS 통계와 함께 보세요.</p>`,

    /* settings dialog */
    'dlg.title': 'SGIS API 설정',
    'dlg.hint': 'SGIS 개발지원센터(sgis.mods.go.kr)에서 발급받은 서비스 ID와 보안 Key를 입력하세요. 값은 이 브라우저의 localStorage에만 저장되고 SGIS API 호출에만 쓰입니다.',
    'dlg.key': '서비스 ID (consumer_key)',
    'dlg.secret': '보안 Key (consumer_secret)',
    'dlg.year': '기준 연도',
    'dlg.yearOpt': '{y}년',
    'dlg.aptType': '아파트 주택유형 코드',
    'dlg.floors': '연면적 추정 기본 층수',
    'dlg.overpass': 'Overpass 서버',
    'dlg.recommended': 'maps.mail.ru (권장)',
    'dlg.clear': '키 지우기',
    'dlg.test': '연결 테스트',
    'dlg.cancel': '취소',
    'dlg.save': '저장',
    'dlg.needBoth': '서비스 ID와 보안 Key를 모두 입력하세요.',
    'dlg.testing': '인증 요청 중…',
    'dlg.ok': '✓ 인증 성공 — accessToken을 받았습니다.',
    'dlg.fail': '✕ 인증 실패: {msg}',

    /* help popovers */
    'help.current': '현재 {v}',
    'help.thr.title': 'CBD 임계값',
    'help.thr.what': '격자의 아파트 밀도가 <b>지역 평균의 몇 배 이상</b>이어야 CBD 후보가 되는지 정하는 기준입니다. ×2.0은 “평균의 2배 이상”이라는 뜻입니다.',
    'help.thr.rows': [['▲ 올리면', '기준이 엄격해져 가장 빽빽한 핵심만 남습니다. CBD가 작아지고, 부도심은 사라질 수 있어요.'], ['▼ 내리면', '덜 밀집한 곳까지 후보가 되어 CBD가 넓어집니다. 떨어져 있던 군집이 하나로 합쳐질 수 있어요.']],
    'help.thr.note': '넘는 격자가 하나도 없으면 상위 3% 격자로 대신 선정합니다.',
    'help.thr.figA': '임계값 ×1.5', 'help.thr.capA': '후보 {n}칸 → CBD 넓게',
    'help.thr.figB': '임계값 ×3.0', 'help.thr.capB': '후보 {n}칸 → 핵심만',
    'help.cell.title': '격자 크기',
    'help.cell.auto': '자동',
    'help.cell.side': '한 변 {m} m',
    'help.cell.what': '지역을 나누는 <b>육각형 한 칸의 크기</b>(한 변 길이)입니다. 칸마다 아파트를 세어 밀도를 계산합니다.',
    'help.cell.rows': [['▲ 크게', '넓게 묶어 결과가 안정적이지만, 좁은 밀집지는 주변과 섞여 흐려집니다.'], ['▼ 작게', '단지 단위까지 세밀하게 보이지만, 건물 몇 동 차이로 값이 크게 흔들립니다.']],
    'help.cell.note': '자동은 지역 면적에 맞춰 격자가 약 650칸이 되도록 정합니다.',
    'help.cell.figA': '작은 칸', 'help.cell.capA': '세밀하지만 들쭉날쭉',
    'help.cell.figB': '큰 칸', 'help.cell.capB': '매끈하지만 뭉개짐',
    'help.smooth.title': '평활화',
    'help.smooth.what': '칸 밖의 가까운 건물도 <b>거리에 따라 조금씩 나눠 반영</b>해(가우시안 커널) 밀도를 부드럽게 만듭니다.',
    'help.smooth.rows': [['▲ 강하게', '계단처럼 끊기던 값이 매끄러워져 큰 흐름이 드러납니다. 너무 강하면 가까운 두 중심이 하나로 뭉칩니다.'], ['▼ 약하게', '칸 안의 실제 개수에 가까워집니다. “없음”은 칸 안 건물만 세서, 경계에서 값이 뚝 끊깁니다.']],
    'help.smooth.figA': '없음', 'help.smooth.capA': '칸 경계에서 뚝뚝 끊김',
    'help.smooth.figB': '평활화 적용', 'help.smooth.mid': '보통', 'help.smooth.strong': '강하게(뭉침)',
    'help.mode.title': '가중치',
    'help.mode.what': '아파트 <b>한 동을 얼마만큼으로 셀지</b> 정합니다.',
    'help.mode.rows': [['건물 동수', '모든 건물을 1로 셉니다. 저층 단지가 넓게 퍼진 곳이 크게 잡힙니다.'], ['연면적 추정', '바닥면적 × 층수로 셉니다. 고층 아파트가 몰린 곳이 크게 잡힙니다.']],
    'help.mode.note': 'OSM에 층수 정보가 없는 건물은 SGIS 설정의 기본 층수(15층)를 씁니다.',
    'help.mode.figA': '건물 동수', 'help.mode.capA': '고층도 저층도 똑같이 1',
    'help.mode.figB': '연면적 추정', 'help.mode.capB': '고층 1동 ≈ 저층 6동',
  },

  en: {
    'doc.title': 'Apartment Density CBD Explorer',
    'lang.group': 'Language',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.home': 'Back to cover',

    'land.eyebrow': 'Reading the city core through apartment density',
    'land.lines': ['APARTMENT', 'DENSITY', 'CBD FINDER'],
    'land.aria': 'Apartment density CBD finder',
    'land.sub': 'Pick any region in Korea. We compare apartment density with the regional average, pinpoint the CBD, and show it on a map with charts.',
    'land.cta': 'Start analysis',
    'land.footL': 'SMU · Green Smart City',
    'land.footR': 'OSM · Overpass · SGIS',

    'about.title': 'About this site',
    'about.lead': 'An analysis tool that reads where a city’s core is through <b>apartment density</b>. It finds where apartments cluster well above the regional average and selects that area as the CBD (core area).',
    'about.items': [
      ['⌕', 'Choose a region', 'Search, click on the map, or draw your own area.'],
      ['⬡', 'Relative density', 'Measures how many times the regional average each hex cell reaches.'],
      ['◎', 'CBD & sub-centers', 'Finds connected clusters of dense cells and marks them on the map.'],
      ['◔', 'Building mix', 'A donut chart of building uses within a radius of the CBD.'],
      ['▦', 'District comparison', 'Compares districts using SGIS census apartment counts.'],
    ],
    'about.foot': 'Data · OpenStreetMap, Overpass, Nominatim, SGIS (Statistics Korea)',
    'about.close': 'Close',

    'app.title': 'Apartment Density CBD Explorer',
    'app.subtitle': 'Relative density analysis with OpenStreetMap · Overpass · SGIS',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.switchTo': 'Switch to {mode} mode',
    'sgis.btn': 'SGIS settings',
    'badge.on': 'Key set',
    'badge.off': 'No key',

    'map.aria': 'Analysis map',
    'search.placeholder': 'Search a region (e.g. Bundang-gu, Songpa-gu)',
    'search.aria': 'Search a region',
    'search.btn': 'Search',
    'modes.aria': 'How to choose a region',
    'pick.btn': '📍 Pick on map',
    'pick.levelAria': 'Unit to pick',
    'level.sgg': 'City / county / district',
    'level.dong': 'Town / neighborhood',
    'level.sido': 'Province / metro city',
    'pickName.sgg': 'city/county/district',
    'pickName.dong': 'town/neighborhood',
    'pickName.sido': 'province/metro city',
    'draw.btn': '✏️ Draw an area',
    'hint.pick': 'Click a spot on the map — we’ll load the <b>{level}</b> boundary there',
    'hint.draw': 'Click to add vertices, then <b>double-click</b> the last point or press {finish}',
    'hint.need3': 'At least 3 vertices are needed · keep clicking',
    'hint.cancel': 'Cancel',
    'hint.finish': 'Done',
    'hint.undo': 'Undo',
    'results.head': '{n} matches · you can pick another',
    'results.close': 'Close',
    'examples': ['Bundang-gu, Seongnam', 'Songpa-gu, Seoul', 'Ilsanseo-gu, Goyang', 'Seo-gu, Daejeon', 'Sejong'],
    'empty.title': 'Which region’s core shall we find?',
    'empty.body': 'Type a region in the search box at the top left, or choose one with <b>Pick on map</b> · <b>Draw an area</b>. The cluster where apartments gather well above the regional average becomes the CBD.',

    'base.osm': 'OSM standard',
    'base.gray': 'OSM grayscale (data focus)',
    'attr.sgis': 'Statistics: SGIS',
    'layer.hex': 'Hex grid density',
    'layer.dongFill': 'District density (SGIS)',
    'layer.dongLine': 'District boundaries (SGIS)',
    'layer.apts': 'Apartment buildings (OSM)',
    'layer.cbd': 'CBD · sub-centers',
    'layer.bldRing': 'Building-mix radius',
    'layer.bldPts': 'Buildings by type (in radius)',
    'legend.title': 'Apartment density vs. avg (LQ)',
    'legend.cbd': 'CBD cluster',
    'legend.sub': 'Sub-center cluster',

    'step.geo': 'Choose region',
    'step.osm': 'Collect apartment buildings',
    'step.sgis': 'District boundaries · housing stats',
    'step.calc': 'Relative density · CBD selection',
    'status.wait': 'Waiting', 'status.run': 'Running', 'status.ok': 'Done', 'status.err': 'Error', 'status.skip': 'Skipped',
    'geo.searching': 'Searching "{q}"',
    'geo.notFound': 'No region with a boundary was found. Try a city/district name or choose on the map.',
    'geo.picking': 'Looking up {level} boundary ({lat}, {lon})',
    'geo.pickFail': 'No administrative boundary at this spot. Click elsewhere or draw an area.',
    'geo.ok': '{display} — {area} km²',
    'geo.note': "OSM has no {level} boundary here, so '{name}' is used",
    'osm.tooBig': 'The area is too large ({area} km² > {max} km²). Please narrow it to a city or district.',
    'osm.bigWait': 'Large area — collection may take a while',
    'osm.querying': 'Querying building=apartments',
    'osm.retry': '{msg} · retrying',
    'osm.ok': '{n} apartment buildings ({p}% with floor data)',
    'osm.none': 'No apartment buildings (building=apartments) are mapped in OSM here',
    'osm.fail': 'Collection failed: {msg}',
    'sgis.custom': 'District comparison is skipped for drawn areas',
    'sgis.noKey': 'No key — add one in SGIS settings (top right) to compare districts',
    'sgis.auth': 'Authenticating · looking up region codes',
    'sgis.progress': 'Receiving boundaries · housing stats {d}/{n}',
    'sgis.ok': '{n} {level} boundaries ({year}){warn}',
    'sgis.warn': ' · some stats failed: {msg}',
    'sgis.lvlEmd': 'neighborhood',
    'sgis.lvlSgg': 'district',
    'sgis.noSido': 'Could not find the SGIS province code',
    'sgis.dongSkip': 'District comparison is skipped for neighborhood-level regions',
    'sgis.noCode': "Could not find an SGIS code for '{name}'",
    'sgis.empty': 'No administrative boundaries for {year}',
    'sgis.error': 'SGIS error',
    'calc.running': 'Computing grid density',
    'calc.ok': '{cells} cells ({side} m side) · {n} clusters',
    'calc.dongOnly': 'CBD chosen from district stats (no OSM buildings)',
    'calc.noData': 'Neither OSM apartment buildings nor SGIS stats are available',
    'op.http': '{host} HTTP {status}{why}',
    'op.why429': ' (too many requests)',
    'op.why504': ' (server busy)',
    'op.timeout': '{host} timed out',
    'op.slotWait': 'Waiting {s}s for the Overpass rate limit',
    'busy.default': 'Analyzing…',
    'busy.search': 'Searching region…',
    'busy.prep': 'Preparing analysis…',
    'busy.osm': 'Collecting apartment buildings…',
    'busy.calc': 'Analyzing density…',
    'busy.pick': 'Finding {level} boundary…',
    'region.custom': 'Drawn area',
    'region.customDisplay': 'Drawn area ({n} vertices)',

    'hero.eyebrow': 'Selected CBD',
    'hero.placeholder': 'Results appear once you choose a region',
    'hero.analyzing': 'Analyzing…',
    'hero.fail': 'The analysis could not finish — check the step errors',
    'hero.noResults': 'No search results',
    'hero.noBoundary': 'No boundary found',
    'hero.tooBig': 'The area is too large',
    'hero.noData': 'No apartment data to analyze',
    'hero.insufficient': 'Not enough data to select a CBD',
    'hero.byDong': 'Selected CBD · by district',
    'hero.vsAvg': 'vs. regional avg',
    'hero.densityVsAvg': 'density vs. regional avg',
    'hero.dongOnlyDesc': 'No OSM apartment buildings, so the CBD was chosen from SGIS apartment counts only.',
    'hero.center': 'CBD center {lat}, {lon}',
    'hero.desc': 'The cluster covers {area} km² ({pa}% of the area) and holds {ps}% of apartments · peak cell ×{peak}',
    'hero.fallback': 'No cell reached ×{thr}, so the top 3% of cells were used. Try lowering the threshold.',
    'hero.bestDong': 'By district, the densest is <b>{name}</b> (×{v}).',
    'cluster.area': '{name} area',
    'tile.area': 'Area',
    'tile.apts': 'Apartment bldgs (OSM)',
    'tile.avg': 'Regional avg density',
    'tile.cbdArea': 'CBD area',
    'tile.cbdShare': 'Apartments in CBD',
    'tile.sgisApt': 'SGIS apartments',
    'tile.side': 'Cell side',
    'unit.bldg': 'bldg',
    'unit.kfloor': 'k m²',
    'unit.units': 'units',
    'fmt.bldg': '{n} bldg',
    'fmt.units': '{n} units',

    'common.afterAnalysis': 'Shown after analysis',
    'common.needKey': 'Set an SGIS key to see this',
    'bld.title': 'Building type mix',
    'bld.subDefault': 'Classifies OSM buildings within a radius of the CBD by use',
    'bld.sub': 'OSM buildings within {r} km of the {center}, by use',
    'bld.radiusAria': 'Radius',
    'bld.radius': '{r} km radius',
    'bld.rules': 'Classification rules',
    'bld.cCbd': 'CBD center',
    'bld.cDong': 'CBD district',
    'bld.cRegion': 'area center',
    'bld.loading': 'Collecting buildings within {r} km…',
    'bld.retry': '{msg} · retrying',
    'bld.fail': 'Building collection failed: {msg}',
    'bld.retryBtn': 'Retry',
    'bld.none': 'No OSM buildings within {r} km',
    'bld.head': '{n} buildings within {r} km',
    'bld.aria': 'Donut chart of building types within {r} km',
    'bld.known': 'use known',
    'bld.unkNote': "{p}% of OSM buildings have no use tag (e.g. building=yes) and are unclassified. See the map layer 'Buildings by type' for where they are.",
    'bld.ruleFallback': '<b>Fallback</b> — buildings without a use (e.g. building=yes) are classified by amenity·shop·office·tourism·craft tags on the same building.',
    'bld.ruleUnk': '<b>Unclassified</b> — anything else (building=yes, roof, greenhouse, construction, …)',
    'type.res': 'Residential', 'type.com': 'Commercial · office', 'type.pub': 'Public · education', 'type.rel': 'Religious · cultural', 'type.ind': 'Industrial', 'type.unk': 'Unclassified',

    'ctl.title': 'Analysis settings',
    'ctl.sub': 'Changes recompute instantly without refetching · hover a label for an explanation',
    'ctl.thr': 'CBD threshold',
    'ctl.cell': 'Grid size',
    'ctl.smooth': 'Smoothing',
    'ctl.mode': 'Weighting',
    'ctl.helpAria': 'About {name}',
    'cell.auto': 'Auto (by region area)',
    'smooth.0': 'None (count per cell)',
    'smooth.075': 'Light',
    'smooth.125': 'Medium (kernel density)',
    'smooth.2': 'Strong',
    'mode.count': 'Building count',
    'mode.floor': 'Est. floor area',

    'hist.title': 'Relative density distribution',
    'hist.sub': 'LQ (cell density ÷ regional average) of cells that contain apartments',
    'hist.none': 'No grid data',
    'hist.over': '×{v} or more',
    'hist.cells': '{n} cells ({p}%)',
    'hist.candZone': 'CBD candidate range',
    'hist.partial': 'Range containing the threshold',
    'hist.thr': 'Threshold ×{v}',
    'hist.legendCand': 'CBD candidates (LQ ≥ {v}): {n}',
    'hist.legendOther': 'Others: {n}',
    'hist.aria': 'Histogram of cell LQ',

    'cluster.title': 'Core clusters',
    'cluster.sub': 'Connected cells above the threshold · bar = share of all apartments in the region',
    'cluster.none': 'No clusters',
    'cluster.subN': 'Sub-center {n}',
    'cluster.tipApts': '{n} apartments ({p}%)',
    'cluster.tipArea': '{a} km² · {c} cells',
    'cluster.tipLq': 'mean ×{m} · peak ×{pk}',
    'cluster.tipClick': 'Click to zoom on the map',
    'cluster.more': '{n} small clusters hidden (under 5% of the CBD or beyond the 5th)',
    'cluster.legendSub': 'Sub-center',
    'cluster.legendVal': 'value = apartment share · cluster mean LQ',

    'tip.cbd': 'CBD cluster',
    'tip.apts': '<b>{n}</b> apartments',
    'tip.density': 'Density {v} {u}/km²',
    'tip.vsAvg': 'vs. regional avg',

    'dong.title': 'Relative density by district',
    'dong.subDefault': 'Mean LQ of SGIS census apartment counts and OSM apartment buildings',
    'dong.subStats': 'Mean LQ of SGIS {year} apartment counts and OSM apartment buildings · regional avg = ×1',
    'dong.subOsm': 'No SGIS housing stats, so only OSM apartment LQ is used · regional avg = ×1',
    'dong.table': 'Show table',
    'dong.custom': 'Drawn areas are not compared by district',
    'dong.loadFail': 'Could not load SGIS data — check the step status',
    'dong.needKey': 'Set an SGIS key to compare districts',
    'dong.noLq': 'District LQ could not be computed',
    'dong.legendCbd': 'District containing the CBD',
    'dong.legendOther': 'Others',
    'dong.legendRef': 'vertical line = regional avg (×1)',
    'dong.more': 'Top 12 of {n} — see the table below for all',
    'dong.th': ['District', 'Area km²', 'SGIS apts', 'Apt share', 'OSM bldgs', 'LQ SGIS', 'LQ OSM', 'Combined'],
    'dong.tipArea': 'Area {a} km²',
    'dong.tipSgis': 'SGIS apartments {v}',
    'dong.tipShare': '({p}% of housing)',
    'dong.tipOsm': 'OSM apartments {n}',
    'dong.tipComp': 'Combined',

    'method.summary': 'Methodology',
    'method.body': `<ul>
      <li><b>Region</b> — Search and map clicks use Nominatim (OSM) administrative boundary polygons; drawing uses the polygon you draw.</li>
      <li><b>Apartments</b> — Overpass returns <code>building=apartments</code> within the area’s extent, and only those inside the polygon are kept. Floor area is estimated as footprint (75% of the building’s bounding box) × <code>building:levels</code> (or the default floors from settings).</li>
      <li><b>Relative density (LQ)</b> — The area is split into hexagon cells, and each cell’s density (optionally Gaussian-kernel smoothed) is divided by the regional average (all apartments ÷ area). LQ 2 means twice the average.</li>
      <li><b>CBD selection</b> — Cells at or above the threshold are grouped with their neighbors. The cluster with the most apartments (density × area) becomes the CBD and the next ones sub-centers. If no cell passes, the top 3% of cells are used.</li>
      <li><b>SGIS (optional)</b> — District boundaries (UTM-K → WGS84) and census apartment counts (<code>stats/house.json</code>) give a per-district LQ that is averaged with the OSM result.</li>
    </ul>
    <p>Here, CBD does not mean a traditional business district but <b>the core area where apartments are much denser than the regional average</b>. Where OSM buildings are sparsely mapped, results may be skewed — check them against SGIS statistics.</p>`,

    'dlg.title': 'SGIS API settings',
    'dlg.hint': 'Enter the Service ID and Secret Key issued by the SGIS developer center (sgis.mods.go.kr). They are stored only in this browser’s localStorage and used only for SGIS API calls.',
    'dlg.key': 'Service ID (consumer_key)',
    'dlg.secret': 'Secret key (consumer_secret)',
    'dlg.year': 'Reference year',
    'dlg.yearOpt': '{y}',
    'dlg.aptType': 'Apartment housing-type code',
    'dlg.floors': 'Default floors (floor-area estimate)',
    'dlg.overpass': 'Overpass server',
    'dlg.recommended': 'maps.mail.ru (recommended)',
    'dlg.clear': 'Clear keys',
    'dlg.test': 'Test connection',
    'dlg.cancel': 'Cancel',
    'dlg.save': 'Save',
    'dlg.needBoth': 'Enter both the Service ID and the Secret Key.',
    'dlg.testing': 'Requesting a token…',
    'dlg.ok': '✓ Authenticated — access token received.',
    'dlg.fail': '✕ Authentication failed: {msg}',

    'help.current': 'Now {v}',
    'help.thr.title': 'CBD threshold',
    'help.thr.what': 'How many times the <b>regional average density</b> a cell must reach to become a CBD candidate. ×2.0 means “at least twice the average.”',
    'help.thr.rows': [['▲ Raise', 'Stricter: only the densest core remains. The CBD shrinks and sub-centers may disappear.'], ['▼ Lower', 'Less dense cells qualify too. The CBD grows and separate clusters may merge.']],
    'help.thr.note': 'If no cell passes, the top 3% of cells are used instead.',
    'help.thr.figA': 'Threshold ×1.5', 'help.thr.capA': '{n} candidates → wide CBD',
    'help.thr.figB': 'Threshold ×3.0', 'help.thr.capB': '{n} candidate → core only',
    'help.cell.title': 'Grid size',
    'help.cell.auto': 'auto',
    'help.cell.side': '{m} m side',
    'help.cell.what': 'The size (side length) of <b>each hexagon cell</b>. Apartments are counted per cell to get density.',
    'help.cell.rows': [['▲ Larger', 'Coarser groups give stable results, but small dense spots blur into their surroundings.'], ['▼ Smaller', 'Shows detail down to single complexes, but a few buildings swing the values a lot.']],
    'help.cell.note': 'Auto picks a size that gives the region about 650 cells.',
    'help.cell.figA': 'Small cells', 'help.cell.capA': 'Detailed but noisy',
    'help.cell.figB': 'Large cells', 'help.cell.capB': 'Smooth but blurred',
    'help.smooth.title': 'Smoothing',
    'help.smooth.what': 'Nearby buildings outside a cell also count, <b>weighted by distance</b> (Gaussian kernel), which smooths the density.',
    'help.smooth.rows': [['▲ Stronger', 'Step-like jumps even out and the big picture emerges. Too strong merges two nearby centers into one.'], ['▼ Weaker', 'Closer to raw counts. “None” counts only buildings inside each cell, so values jump at cell edges.']],
    'help.smooth.figA': 'None', 'help.smooth.capA': 'Jumps at cell edges',
    'help.smooth.figB': 'Smoothed', 'help.smooth.mid': 'Medium', 'help.smooth.strong': 'Strong (merges)',
    'help.mode.title': 'Weighting',
    'help.mode.what': 'Decides <b>how much one apartment building counts</b>.',
    'help.mode.rows': [['Count', 'Every building counts as 1. Areas with many low-rise complexes stand out.'], ['Floor area', 'Counts footprint × floors. Areas packed with high-rise towers stand out.']],
    'help.mode.note': 'Buildings without floor data in OSM use the default floors from SGIS settings (15).',
    'help.mode.figA': 'Building count', 'help.mode.capA': 'Tall or low, each counts 1',
    'help.mode.figB': 'Est. floor area', 'help.mode.capB': '1 tower ≈ 6 low-rises',
  },
};

let lang = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LANG_KEY) || 'null');
    if (saved === 'ko' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
})();

function t(key, vars) {
  const raw = I18N[lang][key] ?? I18N.ko[key] ?? key;
  if (typeof raw !== 'string' || !vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? tx(vars[name]) : m));
}
const tk = (k, v) => ({ k, v });
function tx(x) {
  if (x == null) return '';
  if (typeof x === 'function') return tx(x());
  if (x instanceof Error) return errText(x);
  if (typeof x === 'object' && 'k' in x) return t(x.k, x.v);
  return String(x);
}
function i18nErr(k, v) {
  const e = new Error(t(k, v));
  e.i18n = tk(k, v);
  return e;
}
const errText = e => (e?.i18n ? tx(e.i18n) : (e?.message ?? String(e)));

/* data-i18n(글자), data-i18n-html(HTML), data-i18n-attr("속성:키;속성:키")를 현재 언어로 채운다 */
function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
  document.title = t('doc.title');
  document.documentElement.lang = lang;
}

/* ----- 행정동 이름 로마자 표기 (국어의 로마자 표기법 기본 규칙) -----
   SGIS 경계에는 영문 이름이 없어, 영어 모드에서는 한글 이름을 로마자로 옮겨 보여 준다. */
const RR_INI = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const RR_VOW = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const RR_FIN = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
const RR_LINK = ['', 'g', 'kk', 'ks', 'n', 'nj', 'nh', 'd', 'r', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];
const SIDO_EN = {
  서울특별시: 'Seoul', 부산광역시: 'Busan', 대구광역시: 'Daegu', 인천광역시: 'Incheon', 광주광역시: 'Gwangju',
  대전광역시: 'Daejeon', 울산광역시: 'Ulsan', 세종특별자치시: 'Sejong', 경기도: 'Gyeonggi-do', 강원특별자치도: 'Gangwon',
  강원도: 'Gangwon-do', 충청북도: 'Chungcheongbuk-do', 충청남도: 'Chungcheongnam-do', 전북특별자치도: 'Jeonbuk',
  전라북도: 'Jeollabuk-do', 전라남도: 'Jeollanam-do', 경상북도: 'Gyeongsangbuk-do', 경상남도: 'Gyeongsangnam-do', 제주특별자치도: 'Jeju',
};
function romanizeWord(word) {
  const syl = [...word].map(ch => {
    const c = ch.charCodeAt(0) - 0xAC00;
    return c >= 0 && c < 11172 ? { i: Math.floor(c / 588), v: Math.floor((c % 588) / 28), f: c % 28 } : { raw: ch };
  });
  let out = '';
  syl.forEach((s, k) => {
    if (s.raw) { out += s.raw; return; }
    const prev = syl[k - 1], next = syl[k + 1];
    let ini = RR_INI[s.i];
    if (prev && !prev.raw && prev.f && prev.f !== 21 && s.i === 11) ini = '';         // 앞 받침이 넘어왔다
    if (prev && !prev.raw && (prev.f === 8 || prev.f === 4) && s.i === 5) ini = 'l'; // ㄹㄹ·ㄴㄹ → ll
    let fin = RR_FIN[s.f];
    if (next && !next.raw && s.f && s.f !== 21 && next.i === 11) fin = RR_LINK[s.f];  // 연음
    else if (next && !next.raw && s.f === 4 && next.i === 5) fin = 'l';               // 신림 → Sillim
    out += ini + RR_VOW[s.v] + fin;
  });
  return out;
}
function romanizeAdmin(name) {
  if (!name) return name;
  if (SIDO_EN[name]) return SIDO_EN[name];
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const SUF = { 동: 'dong', 읍: 'eup', 면: 'myeon', 리: 'ri', 가: 'ga', 구: 'gu', 시: 'si', 군: 'gun', 도: 'do' };
  const m = name.match(/^(.+?)(\d+)?(동|읍|면|리|가|구|시|군|도)$/);
  if (!m) return cap(romanizeWord(name));
  return `${cap(romanizeWord(m[1]))}${m[2] ? ` ${m[2]}` : ''}-${SUF[m[3]]}`;
}
