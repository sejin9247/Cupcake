-- 페이지에 적혀 있는데 표에 자리가 없던 두 가지를 더한다.

-- 프로필의 거주지 (Location: 인천광역시 동구)
alter table public.profile add column location text;

-- 이력의 기간을 '적혀 있는 그대로' 담는 칸.
-- started_on·ended_on 만으로는 표현할 수 없는 것이 있다:
--   '2023.08 – 2025.05' → 일(日)이 없다. 날짜로 바꾸면 없는 정보를 지어내게 된다.
--   '1개월'            → 애초에 날짜가 아니라 기간이다.
-- 날짜 칸은 정렬·계산용으로 남기고, 화면에 보일 글은 이 칸을 쓴다.
alter table public.profile_entries add column period text;

comment on column public.profile_entries.period is '화면에 보이는 기간 글. 예: 2023.08 – 2025.05, 1개월';
comment on column public.profile_entries.started_on is '정렬·계산용. 월까지만 아는 경우 1일로 적는다.';
