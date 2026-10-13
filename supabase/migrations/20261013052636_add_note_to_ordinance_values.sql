-- 조례값 445개에 단서가 달려 있다. 예: "다만, 순수 주거용 공동주택의 경우에는 300퍼센트",
-- "성장관리계획을 수립한 지역의 경우: 50퍼센트 이하".
-- 숫자만 옮기고 이 단서를 버리면 법적으로 틀린 값을 보여주게 된다.
alter table public.ordinance_values add column note text;

comment on column public.ordinance_values.value is '조례가 정한 수치. 비어 있으면 그 지역 조례에 해당 용도지역 값이 없음(전국 363칸).';
comment on column public.ordinance_values.note  is '그 값에 붙은 단서 조항. 완화·예외 규정이 들어온다.';
