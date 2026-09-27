-- 버들 대장간: 랜덤 대결 상대 목록
-- 테이블은 직접 읽기/쓰기 불가(RLS + 권한 회수). 등록과 매칭은 아래 함수로만 가능하다.

create table if not exists public.forge_swords (
  device text primary key,
  name text not null,
  level int not null check (level between 1 and 20),
  updated_at timestamptz not null default now()
);
create index if not exists forge_swords_level on public.forge_swords (level, updated_at desc);
alter table public.forge_swords enable row level security;
revoke all on table public.forge_swords from anon, authenticated;

-- 내 검 등록 (기기당 한 줄, 대결할 때마다 갱신)
create or replace function public.forge_submit(p_device text, p_name text, p_level int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 40 then raise exception 'invalid device'; end if;
  if p_level is null or p_level < 1 or p_level > 20 then return; end if;
  p_name := left(regexp_replace(btrim(coalesce(p_name, '')), '[<>]', '', 'g'), 10);
  if p_name = '' then p_name := '대장장이'; end if;
  insert into forge_swords (device, name, level, updated_at) values (p_device, p_name, p_level, now())
  on conflict (device) do update set name = excluded.name, level = excluded.level, updated_at = now();
end $$;

-- 상대 찾기: 최근 30일 안에 대결한 다른 사람 중 내 단계 -2 ~ +1 에서 무작위 한 명
-- (기기 식별값은 돌려주지 않는다)
create or replace function public.forge_match(p_device text, p_level int)
returns table (name text, level int)
language sql security definer set search_path = public volatile as $$
  select fs.name, fs.level
  from forge_swords fs
  where fs.device <> p_device
    and fs.level between greatest(p_level - 2, 1) and least(p_level + 1, 20)
    and fs.updated_at > now() - interval '30 days'
  order by random()
  limit 1
$$;

revoke all on function public.forge_submit(text, text, int) from public;
revoke all on function public.forge_match(text, int) from public;
grant execute on function public.forge_submit(text, text, int) to anon, authenticated;
grant execute on function public.forge_match(text, int) to anon, authenticated;
