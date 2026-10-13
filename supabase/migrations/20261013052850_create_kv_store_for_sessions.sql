-- 만료 시간이 있는 값들을 담는 표. Redis가 하던 일을 그대로 받는다.
--   session:<해시>      로그인 세션 (30분 뒤 만료, 요청마다 연장)
--   loginfail:ip:<ip>   한 IP의 실패 횟수 (15분 창)
--   loginfail:all       전체 실패 횟수 (하루 창)
--
-- 토큰 원문은 담지 않는다 — sha256 값만 키로 쓴다. 이 표가 새어도 토큰으로 쓸 수 없다.
-- 공개 키로는 한 줄도 읽히지 않아야 하므로 규칙을 만들지 않는다.
create table public.kv (
  key        text primary key,
  value      jsonb not null,
  expires_at timestamptz,                       -- 비어 있으면 만료 없음
  updated_at timestamptz not null default now()
);
create index kv_expires_idx on public.kv (expires_at) where expires_at is not null;

alter table public.kv enable row level security;   -- 규칙 없음 = 공개 키로 접근 불가

-- 횟수 세기는 '읽고 더해 쓰기'로 하면 동시에 들어온 요청이 서로 덮어쓴다.
-- 한 문장 안에서 더하도록 함수로 둔다. 처음 세는 순간에만 만료 시각을 박는다.
create function public.kv_incr(p_key text, p_window_sec integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_next bigint;
begin
  insert into public.kv as k (key, value, expires_at, updated_at)
  values (p_key, '1'::jsonb, v_now + make_interval(secs => p_window_sec), v_now)
  on conflict (key) do update
    set value = (
          case when k.expires_at is not null and k.expires_at <= v_now
               then 1                                        -- 지난 창은 버리고 새로 센다
               else coalesce((k.value)::text::bigint, 0) + 1
          end
        )::text::jsonb,
        expires_at = case when k.expires_at is not null and k.expires_at <= v_now
                          then v_now + make_interval(secs => p_window_sec)
                          else k.expires_at end,
        updated_at = v_now
  returning (value)::text::bigint into v_next;

  return v_next;
end $$;

revoke all on function public.kv_incr(text, integer) from anon, authenticated;

comment on table public.kv is '만료 시간이 있는 임시값 (로그인 세션, 시도 제한). 서버만 접근한다.';
