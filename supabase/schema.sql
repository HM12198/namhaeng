-- 남행열차 회원 사이트 DB
-- 2026-11-01 Supabase 프로젝트 namhaeng(veqbbkwbtdrbjifcyydg)에 적용됨. 새 프로젝트면 SQL Editor에 통째로 붙여넣고 Run.
-- 역할: pending(승인 대기) → member(회원) → staff(운영진) → owner(방장). banned(강퇴)는 아무것도 못 봄.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '',
  kakao_name text not null default '',
  role text not null default 'pending' check (role in ('pending','member','staff','owner','banned')),
  memo text not null default '',          -- 운영진만 보는 메모 (접수코드 등)
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  board text not null check (board in ('notice','meetup','watch','drink','bungae','free','staff')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 5000),
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_board_idx on public.posts (board, pinned desc, created_at desc);
create index if not exists posts_author_idx on public.posts (author);

-- 내 역할 (RLS 안에서 쓰므로 security definer)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'none')
$$;

-- 카카오로 처음 로그인하면 승인 대기 프로필 자동 생성
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, kakao_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'preferred_username', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 역할·메모는 운영진만 바꿀 수 있고, 운영진 임명/해임과 방장 건드리기는 방장만
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := public.my_role();
begin
  if new.id = old.id and new.role = old.role and new.memo = old.memo and new.approved_at is not distinct from old.approved_at then
    return new;  -- 닉네임만 바뀜
  end if;
  if me not in ('staff','owner') then raise exception '권한이 없어요'; end if;
  if (old.role in ('staff','owner') or new.role in ('staff','owner')) and me <> 'owner' then
    raise exception '운영진 임명·해임은 방장만 할 수 있어요';
  end if;
  if old.role = 'pending' and new.role = 'member' then new.approved_at := now(); end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (
  id = (select auth.uid()) or public.my_role() in ('member','staff','owner')
);
drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update to authenticated using (
  id = (select auth.uid()) or public.my_role() in ('staff','owner')
);

-- 회원에게는 memo 열을 숨김
revoke all on public.profiles from anon, authenticated;
revoke all on public.posts from anon;
grant select (id, nickname, kakao_name, role, created_at, approved_at) on public.profiles to authenticated;
grant update (nickname, role, memo) on public.profiles to authenticated;
create or replace function public.staff_profiles() returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where public.my_role() in ('staff','owner') order by created_at desc
$$;
revoke execute on function public.staff_profiles() from public, anon;
grant execute on function public.staff_profiles() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile() from public, anon, authenticated;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select to authenticated using (
  case when board = 'staff' then public.my_role() in ('staff','owner')
       else public.my_role() in ('member','staff','owner') end
);
drop policy if exists "posts write" on public.posts;
create policy "posts write" on public.posts for insert to authenticated with check (
  author = (select auth.uid()) and
  case when board in ('notice','staff') then public.my_role() in ('staff','owner')
       else public.my_role() in ('member','staff','owner') end
);
drop policy if exists "posts edit" on public.posts;
create policy "posts edit" on public.posts for update to authenticated using (
  (author = (select auth.uid()) and public.my_role() in ('member','staff','owner')) or public.my_role() in ('staff','owner')
) with check (
  public.my_role() in ('staff','owner') or (board in ('meetup','watch','drink','bungae','free') and pinned = false)
);
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete to authenticated using (
  (author = (select auth.uid()) and public.my_role() in ('member','staff','owner')) or public.my_role() in ('staff','owner')
);

-- 처음 한 번: 방장 본인 계정을 owner로 (카카오로 한 번 로그인한 뒤 실행)
-- update public.profiles set role = 'owner' where kakao_name = '여기에 방장 카카오 이름';
-- (guard 트리거 때문에 SQL Editor에서 실행해야 함: SQL Editor는 auth.uid()가 없어서 아래처럼)
-- alter table public.profiles disable trigger guard_profile;
-- update public.profiles set role = 'owner' where kakao_name = '...';
-- alter table public.profiles enable trigger guard_profile;

-- 모임 양식 값 (직관·티관·술자리·번개): 날짜, 시간, 장소, 인원, 모집 상태 등
alter table public.posts add column if not exists meta jsonb not null default '{}'::jsonb
  check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 4000);

-- 왼쪽 메뉴 "함께 하기" 바깥 링크 (참여코드가 들어 있어 회원만 읽는다)
-- (실제 표 정의는 Supabase 마이그레이션 namhaeng_cafe_links 참고)

-- 기아 경기 일정 (캘린더·오늘의 매치데이). 회원은 읽기, 운영진이 넣고 고친다.
create table if not exists public.games (
  id bigint generated always as identity primary key,
  game_date date not null,
  game_time time,
  opp text not null check (char_length(opp) between 1 and 20),
  park text not null default '' check (char_length(park) <= 30),
  home boolean not null default true,
  tv text not null default '' check (char_length(tv) <= 30),
  result text not null default '' check (result in ('', '승', '패', '무', '취소')),
  score text not null default '' check (char_length(score) <= 15),
  note text not null default '' check (char_length(note) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists games_date on public.games (game_date);
alter table public.games enable row level security;
create policy "games read" on public.games for select to authenticated using (public.my_role() in ('member','staff','owner'));
create policy "games write" on public.games for all to authenticated
  using (public.my_role() in ('staff','owner')) with check (public.my_role() in ('staff','owner'));
grant select, insert, update, delete on public.games to authenticated;

-- 댓글·모임 참석 신청 (실제 적용본: 마이그레이션 namhaeng_comments_attendees)
-- can_read_post(pid): posts 읽기 규칙과 같은 판정 (security definer)
-- comments: 읽을 수 있는 글에만 회원 이상이 씀, 본인·운영진이 지움
-- attendees(post_id, user_id): 모집중인 모임 글에 본인만 신청, 본인·모임장·운영진이 뺌
