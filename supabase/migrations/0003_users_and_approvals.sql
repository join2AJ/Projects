-- Username/password accounts managed by the admin, client (clinic) details, and approval of updates.
--
-- Accounts: the login is a username or an email. A username is stored in auth as <username>@u.portal,
-- so it can sign in without any email being sent. Accounts are created, edited and deleted only by the
-- admin, through the admin-users Edge Function (it holds the service key; the browser never does).

-- ───────── people ─────────
alter table public.profiles
  add column username text unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  add column phone text,
  add column contact_email text,
  add column client_id uuid references public.clients on delete set null,
  add column status text not null default 'active' check (status in ('active','disabled')),
  add column notes text,
  add column updated_at timestamptz not null default now();
create index on public.profiles (client_id);

-- Fill username from the login email when the profile is created.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, username, is_owner)
  values (new.id, lower(new.email),
    case when lower(new.email) like '%@u.portal' then split_part(lower(new.email), '@', 1) end,
    exists (select 1 from public.settings s where s.owner_email = lower(new.email)));
  return new;
end $$;

-- ───────── clinics / client organisations ─────────
alter table public.clients
  add column city text,
  add column address text,
  add column gstin text,
  add column status text not null default 'active' check (status in ('active','paused','past','lead')),
  add column notes text;

-- ───────── approvals ─────────
-- An update reaches the client only once approved (client_visible = true). New updates start unapproved.
alter table public.updates
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users on delete set null,
  alter column client_visible set default false;
update public.updates set approved_at = now() where client_visible and approved_at is null;

-- ───────── disabled accounts lose access at once ─────────
-- (their sign-in is also blocked in auth, but a token already issued lives up to an hour)
create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_owner and status = 'active' from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function private.is_member(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    join public.profiles me on me.id = (select auth.uid()) and me.status = 'active'
    where m.project_id = p and m.email = lower((select auth.jwt()) ->> 'email')
  )
$$;

-- The admin may read and edit every profile from the website; account changes go through the Edge Function.
create policy owner_all on public.profiles for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

notify pgrst, 'reload schema';
