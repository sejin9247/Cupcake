-- 패널 맨 위의 작은 글. 예: 'Project 01 · 아파트 밀도로 읽는 도시의 중심'
-- 제목(title)과 성격이 다르다 — 제목은 디자인상 줄바꿈과 꾸밈이 들어가 HTML에 남기고,
-- 이 줄은 순수한 글이라 DB에서 그린다.
alter table public.projects add column eyebrow text;

comment on column public.projects.eyebrow is '패널 맨 위의 작은 글 (Project 01 · …)';
comment on column public.projects.summary is '패널에 보이는 설명 문단. description 은 상세 구역용 긴 글.';
comment on column public.projects.title is '작업물 이름. 화면의 큰 제목은 줄바꿈·꾸밈 때문에 HTML에 그대로 두고, 이 값은 목록·관리자 화면에서 쓴다.';
