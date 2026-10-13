-- 포트폴리오 데이터베이스 — 기능별로 표를 나누고, 표마다 is_public 한 칸으로 공개 여부를 정한다.
-- 예외는 bookings 하나뿐이다: 한 줄 안에 공개할 것과 절대 공개하면 안 되는 것이 섞여 있어서
-- 표 자체는 통째로 잠그고, 날짜·시간만 비치는 창(booked_slots)을 따로 둔다.
--
-- 이 프로젝트에는 근거노트의 evidence 표가 함께 들어 있다. 이름이 겹치지 않으므로 서로 간섭하지 않는다.

-- 수정 시각을 손으로 적지 않아도 되게 한다
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ────────────────────────────── 포트폴리오 ──────────────────────────────

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,                 -- 주소에 쓰는 짧은 이름 (cbd, dongtan …)
  title         text not null,
  role          text,
  summary       text,                                 -- 목록에 보이는 한 줄
  description   text,                                 -- 자세한 설명
  period        text,                                 -- '2025.03 – 2025.06'
  members       integer check (members between 1 and 999),
  notes         text,
  cover_image   text,
  demo_url      text,
  repo_url      text,
  sort_order    integer not null default 0,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 작업물마다 붙는 '데이터 / 출처' 같은 항목
create table public.project_facts (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  label       text not null,
  value       text not null,
  sort_order  integer not null default 0,
  is_public   boolean not null default true,          -- 작업물이 비공개면 이것도 함께 숨는다
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.project_facts (project_id, sort_order);

-- ────────────────────────────── 나 ──────────────────────────────

create table public.profile (
  id                   uuid primary key default gen_random_uuid(),
  full_name            text not null,
  tagline              text,
  school               text,
  department           text,
  grade                text,
  expected_graduation  text,
  intro                text,
  public_email         text,
  is_public            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- 소개는 한 사람 것이므로 두 줄이 생기지 않게 막는다
create unique index profile_single_row on public.profile ((true));

create table public.profile_entries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('education','military','credential','experience','service')),
  title       text not null,
  org         text,
  started_on  date,
  ended_on    date,
  description text,
  sort_order  integer not null default 0,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.profile_entries (kind, sort_order);

-- ────────────────────────────── 방문 ──────────────────────────────

-- 이 표에는 is_public이 없다. 통째로 비공개이고, 공개는 아래 booked_slots가 맡는다.
create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  booking_no  text not null unique,                   -- 261008-1500-7A3C
  name        text not null,
  email       text not null,
  purpose     text not null,
  visit_date  date not null,
  visit_time  time not null,
  consent     boolean not null default false,
  status      text not null default 'received'
                check (status in ('received','confirmed','reschedule','cancelled')),
  created_at  timestamptz not null default now(),
  status_at   timestamptz not null default now()
);
-- 한 자리에 한 예약. 취소된 건은 자리를 비워 주므로 셈에서 뺀다.
create unique index bookings_one_per_slot
  on public.bookings (visit_date, visit_time)
  where status <> 'cancelled';

-- 빈자리 전용 창 — 날짜와 시간만 들어 있다. 이름·이메일·목적은 애초에 없다.
create view public.booked_slots as
  select visit_date, visit_time
  from public.bookings
  where status <> 'cancelled';

create table public.holidays (
  on_date    date primary key,
  name       text not null,
  is_public  boolean not null default true
);

create table public.visit_info (
  id             uuid primary key default gen_random_uuid(),
  address        text not null,
  room           text,
  campus         text,
  lat            numeric(9,6),
  lng            numeric(9,6),
  open_from      time not null default '13:00',
  open_to        time not null default '18:00',
  slot_minutes   integer not null default 30,
  weekdays_only  boolean not null default true,
  is_public      boolean not null default true,
  updated_at     timestamptz not null default now()
);
create unique index visit_info_single_row on public.visit_info ((true));

-- ────────────────────────────── 조례 ──────────────────────────────

-- 전국 공통 21종. 지역마다 이름을 반복해 적으면 오타가 섞여 비교가 깨진다.
create table public.zones (
  id         smallint primary key,
  name       text not null unique,
  sort_order smallint not null,
  is_public  boolean not null default false
);

create table public.regions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,                  -- 천안시
  law_name     text not null,                         -- 천안시 도시계획 조례
  law_mst      text,                                  -- 국가법령정보 법령ID
  effective_on date,
  fetched_on   date,
  source       text,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 165개 지역 × 21종 × 2지표 = 6,930줄
create table public.ordinance_values (
  id         bigint generated always as identity primary key,
  region_id  uuid not null references public.regions(id) on delete cascade,
  zone_id    smallint not null references public.zones(id),
  metric     text not null check (metric in ('bcr','far')),   -- 건폐율 / 용적률
  value      numeric,                                          -- 비어 있으면 조례에서 못 찾은 칸
  unit       text,
  article    text,
  is_public  boolean not null default false,
  unique (region_id, zone_id, metric)
);
create index on public.ordinance_values (zone_id, metric);

-- 국토계획법 시행령이 정한 전국 상한 — 조례값을 견주는 기준선
create table public.legal_caps (
  zone_id      smallint not null references public.zones(id),
  metric       text not null check (metric in ('bcr','far')),
  value        numeric not null,
  unit         text,
  article      text,
  source       text,
  effective_on date,
  is_public    boolean not null default false,
  primary key (zone_id, metric)
);

-- ────────────────────────────── 수정 시각 자동 기록 ──────────────────────────────

create trigger t_projects        before update on public.projects        for each row execute function public.touch_updated_at();
create trigger t_project_facts   before update on public.project_facts   for each row execute function public.touch_updated_at();
create trigger t_profile         before update on public.profile         for each row execute function public.touch_updated_at();
create trigger t_profile_entries before update on public.profile_entries for each row execute function public.touch_updated_at();
create trigger t_visit_info      before update on public.visit_info      for each row execute function public.touch_updated_at();
create trigger t_regions         before update on public.regions         for each row execute function public.touch_updated_at();
