-- 줄 단위 잠금(RLS). 켜는 순간 기본값은 '아무도 못 봄'이 되고,
-- 아래에서 허락한 줄만 공개 키로 읽힌다. 관리자는 service_role 키를 쓰므로 이 규칙을 지나간다.
--
-- 근거노트의 evidence 표는 여기에 적지 않는다 — 이 파일은 포트폴리오 표만 건드린다.

alter table public.projects         enable row level security;
alter table public.project_facts    enable row level security;
alter table public.profile          enable row level security;
alter table public.profile_entries  enable row level security;
alter table public.bookings         enable row level security;
alter table public.holidays         enable row level security;
alter table public.visit_info       enable row level security;
alter table public.zones            enable row level security;
alter table public.regions          enable row level security;
alter table public.ordinance_values enable row level security;
alter table public.legal_caps       enable row level security;

-- ── 공개로 표시한 줄만 읽히게 ──

create policy "공개된 작업물만 읽기" on public.projects
  for select to anon, authenticated using (is_public);

-- 지표는 자기도 공개여야 하고, 딸린 작업물도 공개여야 보인다
create policy "공개된 작업물의 공개 지표만 읽기" on public.project_facts
  for select to anon, authenticated using (
    is_public and exists (select 1 from public.projects p where p.id = project_id and p.is_public)
  );

create policy "공개된 소개만 읽기" on public.profile
  for select to anon, authenticated using (is_public);

create policy "공개된 이력만 읽기" on public.profile_entries
  for select to anon, authenticated using (is_public);

create policy "공개된 공휴일만 읽기" on public.holidays
  for select to anon, authenticated using (is_public);

create policy "공개된 방문 안내만 읽기" on public.visit_info
  for select to anon, authenticated using (is_public);

create policy "공개된 용도지역만 읽기" on public.zones
  for select to anon, authenticated using (is_public);

create policy "공개된 지역만 읽기" on public.regions
  for select to anon, authenticated using (is_public);

-- 조례값은 그 지역이 공개여야 함께 보인다 (지역 없이 숫자만 보여 봐야 뜻이 없다)
create policy "공개된 지역의 공개 조례값만 읽기" on public.ordinance_values
  for select to anon, authenticated using (
    is_public and exists (select 1 from public.regions r where r.id = region_id and r.is_public)
  );

create policy "공개된 법정 상한만 읽기" on public.legal_caps
  for select to anon, authenticated using (is_public);

-- ── 예약은 규칙을 하나도 만들지 않는다 ──
-- 규칙이 없으면 공개 키로는 한 줄도 못 읽는다. 접수와 조회는 서버(service_role)가 맡는다.
-- 대신 빈자리 창만 열어 둔다. 이 창에는 날짜·시간 말고는 아무것도 들어 있지 않다.
--
-- Supabase 점검기가 이 창을 'SECURITY DEFINER VIEW'라고 경고하는데, 일부러 그렇게 둔 것이다.
-- 창이 주인 권한으로 동작해야 잠긴 bookings에서 날짜·시간을 꺼내 올 수 있다.
-- 창의 select 목록이 두 칸으로 고정돼 있으므로 더 샐 것이 없다.
grant select on public.booked_slots to anon, authenticated;
