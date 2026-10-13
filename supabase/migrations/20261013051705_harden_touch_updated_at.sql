-- search_path이 비어 있지 않으면, 누군가 같은 이름의 가짜 함수를 앞세워 이 트리거를 가로챌 수 있다.
-- 찾는 경로를 못 박아 둔다. (Supabase 점검기의 function_search_path_mutable 경고)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;
