# Supabase 데이터베이스 — 연결 안내

이 문서는 포트폴리오의 데이터를 Supabase에 모으는 과정을 적은 것입니다.
브랜치 `feat/db-connection`에서 작업합니다.

---

## 0. 먼저 알아 둘 것 하나

> **표마다 따로 연결하지 않습니다.**

"여러 테이블을 각각 연결한다"고 생각하기 쉬운데, 그렇지 않습니다.
연결은 **프로젝트 한 곳에 한 번**이고, 표는 그 뒤에 **이름으로 부릅니다.**

```
          ┌─────────────────────────────┐
우리 서버 ─┤  Supabase 프로젝트 (연결 1번) │
          │   ├ projects                │  ← from('projects')
          │   ├ bookings                │  ← from('bookings')
          │   ├ regions                 │  ← from('regions')
          │   └ … 11개 표               │
          └─────────────────────────────┘
```

전기로 치면 **콘센트는 하나**고, 거기에 꽂은 뒤 방마다 불을 켜는 것과 같습니다.

---

## 1. 지금 어디까지 되어 있나

| 한 일 | 상태 |
|---|---|
| Supabase 프로젝트 깨우기 | ✅ `sejin9247's Project` (서울 리전) |
| 표 11개 만들기 | ✅ |
| 빈자리 전용 창 `booked_slots` | ✅ |
| 줄 단위 잠금(RLS) 걸기 | ✅ |
| 공개 키로 안 새는지 확인 | ✅ 예약·비공개 작업물 모두 막힘 확인 |
| 실제 데이터 옮기기 | ⬜ 아직 |
| 서버 코드에 연결 | ⬜ 아직 |

---

## 2. 만들어 둔 표

### 포트폴리오
- **`projects`** — 작업물. `slug` · 제목 · 역할 · 설명 · 기간 · 인원 · 표지 · 데모주소
- **`project_facts`** — 작업물에 딸린 `데이터 / 출처` 같은 항목

### 나
- **`profile`** — 한 줄 소개·학교·학과·졸업예정 (한 줄만 들어갑니다)
- **`profile_entries`** — 학력·군복무·자격·경험

### 방문
- **`bookings`** — 예약 (비공개 전용)
- **`booked_slots`** — 날짜·시간만 비치는 창
- **`holidays`** — 공휴일
- **`visit_info`** — 주소·좌표·방문 시간 규칙 (한 줄만)

### 조례
- **`zones`** — 용도지역 21종 (전국 공통)
- **`regions`** — 시·군·구 165곳
- **`ordinance_values`** — 지역 × 용도지역 × 지표 = 6,930줄
- **`legal_caps`** — 국토계획법이 정한 전국 상한

---

## 3. 공개 / 비공개는 어떻게 정해지나

표마다 **`is_public`** 이라는 칸이 하나씩 있습니다. 체크 상자라고 보면 됩니다.

```
projects
┌──────────┬──────────┬───────────┐
│ 제목     │ 설명     │ is_public │
├──────────┼──────────┼───────────┤
│ CBD 파인더│ ……      │   true    │ ← 사이트에 보임
│ 새 프로젝트│ ……      │   false   │ ← 나만 보임
└──────────┴──────────┴───────────┘
```

이게 **말로만 하는 약속이 아닙니다.** 데이터베이스가 직접 막습니다(RLS).
`is_public`이 `false`인 줄은 공개 키로 아무리 요청해도 **빈 목록**이 돌아옵니다.

딸린 것은 부모를 따라갑니다:
- 작업물이 비공개면 → 그 작업물의 지표도 함께 숨습니다
- 지역이 비공개면 → 그 지역의 조례값도 함께 숨습니다

### 예약만 예외입니다

예약 한 줄에는 공개할 것과 절대 공개하면 안 되는 것이 **섞여** 있습니다.

| 날짜 | 시간 | 이름 | 이메일 | 목적 |
|---|---|---|---|---|
| 공개 필요 | 공개 필요 | 공개 불가 | 공개 불가 | 공개 불가 |

날짜·시간을 알려줘야 다른 방문자 화면에 `(완료)` 표시가 뜹니다.
그래서 **`bookings` 표는 통째로 잠그고**, 날짜·시간만 들어 있는 창 `booked_slots`를 따로 열어 두었습니다.
이 창에는 이름·이메일이 **아예 들어있지 않아서**, 설정을 실수해도 샐 것이 없습니다.

---

## 4. 열쇠 두 개 — 이게 제일 중요합니다

Supabase는 열쇠를 두 개 줍니다. **역할이 완전히 다릅니다.**

| | 공개 열쇠 (publishable) | 비밀 열쇠 (service_role) |
|---|---|---|
| 생김새 | `sb_publishable_…` | `sb_secret_…` |
| 어디에 두나 | 브라우저에 있어도 됨 | **서버에만** |
| 할 수 있는 일 | 공개된 줄만 읽기 | 전부 읽고 쓰기 |
| 잠금(RLS) | 적용됨 | **지나감** |

> ⚠️ **비밀 열쇠를 브라우저 코드나 깃허브에 올리면 안 됩니다.**
> 그 열쇠는 잠금을 지나가기 때문에, 가진 사람이 예약자 이름·이메일을 전부 볼 수 있습니다.

**가져오는 곳**: Supabase 대시보드 → 왼쪽 `Project Settings` → `API Keys`

**프로젝트 주소**: `https://dwlrjyditdednagjfnpo.supabase.co`

---

## 5. 서버에 연결하는 순서

### 5-1. 꾸러미 설치

```bash
cd backend
npm install @supabase/supabase-js
```

### 5-2. 열쇠를 `.env`에 적기

`backend/.env` 파일에 두 줄을 더합니다. (이 파일은 깃에 올라가지 않습니다)

```
SUPABASE_URL=https://dwlrjyditdednagjfnpo.supabase.co
SUPABASE_SECRET_KEY=여기에_비밀_열쇠
```

### 5-3. 연결하는 곳을 한 군데만 만들기

`backend/src/db/supabase.js` 파일 하나에만 연결을 둡니다.
다른 파일들은 여기서 가져다 씁니다 — 연결이 흩어지면 나중에 바꿀 때 전부 찾아다녀야 합니다.

```js
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

export const db = createClient(config.supabase.url, config.supabase.secretKey, {
  auth: { persistSession: false },   // 서버는 로그인 상태를 들고 있지 않는다
});
```

### 5-4. 표를 하나씩 붙이기

표마다 다시 연결하는 게 아니라, **이름만 바꿔 부릅니다.**

```js
// 작업물 읽기
const { data, error } = await db.from('projects').select('*').eq('is_public', true);

// 예약 넣기
const { data, error } = await db.from('bookings').insert({ … }).select().single();

// 빈자리 읽기
const { data, error } = await db.from('booked_slots').select('*');
```

**순서를 지키면 덜 헤맵니다.** 한 번에 다 바꾸지 말고 하나씩, 바꿀 때마다 확인하세요.

1. `holidays` — 가장 단순합니다. 공휴일만 들어 있어 틀려도 피해가 작습니다.
2. `bookings` — 지금 Redis 자리를 대신합니다.
3. `projects` + `project_facts` — 사이트 작업물이 DB에서 나오게 합니다.
4. `profile` + `profile_entries`
5. `zones` → `regions` → `ordinance_values` → `legal_caps` — **이 순서를 지켜야 합니다.** 뒤쪽이 앞쪽을 가리키고 있어서, 앞의 것이 없으면 들어가지 않습니다.

---

## 6. 잘 됐는지 확인하는 법

터미널에서 공개 열쇠로 찔러 봅니다. **보이면 안 되는 것이 안 보여야** 성공입니다.

```bash
U=https://dwlrjyditdednagjfnpo.supabase.co/rest/v1
K=공개_열쇠

# 1) 예약이 새는가 — []  가 나와야 정상
curl -s -H "apikey: $K" "$U/bookings?select=*"

# 2) 빈자리는 보이는가 — 날짜·시간만 나와야 정상
curl -s -H "apikey: $K" "$U/booked_slots?select=*"
```

`[]`는 "막혀 있다"는 뜻이기도 하고 "자료가 없다"는 뜻이기도 합니다.
**자료를 한 줄 넣어 두고 확인해야** 진짜 확인입니다.

---

## 7. 알아 둘 점

**프로젝트가 또 멈출 수 있습니다.** 무료 등급은 한동안 쓰지 않으면 자동으로 정지합니다.
멈추면 사이트에서 데이터를 못 읽습니다. 대시보드에서 `Restore`를 누르면 몇 분 뒤 돌아옵니다.

**Supabase 점검이 경고 두 개를 띄웁니다.** 둘 다 일부러 그렇게 만든 것입니다.

| 경고 | 왜 괜찮은가 |
|---|---|
| `bookings`에 규칙이 하나도 없음 | 일부러입니다. 규칙이 없어야 공개 키로 한 줄도 못 읽습니다. |
| `booked_slots` 창이 주인 권한으로 동작함 | 일부러입니다. 그래야 잠긴 표에서 날짜·시간만 꺼내 올 수 있습니다. 창 안에 그 두 칸 말고는 아무것도 없어서 더 샐 것이 없습니다. |
