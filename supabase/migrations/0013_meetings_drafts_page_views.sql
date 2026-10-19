-- 1. Meeting notes: after each call or update, the discussion points, action points and workable points.
--    Private until the admin shares them; then the client sees them on their project.
-- 2. Reply drafts: a prepared reply to a client request, private until the admin edits and shares it.
-- 3. Page views: which pages and sections a client opens, and when (listed in the privacy notice, v2).

-- ───────── 1. meetings ─────────
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  held_on date not null,
  channel text,                       -- e.g. WhatsApp voice call, video call, in person
  title text not null,
  summary text,
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.meetings (project_id, held_on);

create table public.meeting_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings on delete cascade,
  project_id uuid references public.projects on delete cascade,   -- copied from the meeting
  kind text not null check (kind in ('discussion','action','workable')),
  body text not null check (length(body) between 1 and 2000),
  owner text check (owner in ('me','client','both')),
  due_on date,
  status text not null default 'open' check (status in ('open','done','dropped')),
  sort int not null default 100,
  created_at timestamptz not null default now()
);
create index on public.meeting_items (meeting_id);

create or replace function private.fill_meeting_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.project_id := (select m.project_id from public.meetings m where m.id = new.meeting_id);
  return new;
end $$;
create trigger fill before insert or update of meeting_id on public.meeting_items for each row execute function private.fill_meeting_item();

alter table public.meetings enable row level security;
alter table public.meeting_items enable row level security;
create policy owner_all on public.meetings for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.meetings for select to authenticated
  using (client_visible and private.is_member(project_id));
create policy owner_all on public.meeting_items for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.meeting_items for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and m.client_visible and private.is_member(m.project_id)));

-- ───────── 2. reply drafts (admin only) ─────────
create table public.reply_drafts (
  request_id uuid primary key references public.requests on delete cascade,
  body text not null,
  updated_at timestamptz not null default now()
);
alter table public.reply_drafts enable row level security;
create policy owner_all on public.reply_drafts for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- ───────── 3. page views ─────────
create table public.page_views (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  who text default lower(auth.jwt() ->> 'email'),
  project_id uuid references public.projects on delete cascade,
  path text not null check (length(path) <= 300),
  tab text check (length(tab) <= 60),
  at timestamptz not null default now()
);
create index on public.page_views (project_id, at);
create index on public.page_views (user_id, at);
alter table public.page_views enable row level security;
create policy own_insert on public.page_views for insert to authenticated
  with check (user_id = (select auth.uid()) and (project_id is null or private.is_member(project_id)));
create policy own_or_owner_read on public.page_views for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));
revoke update, delete on public.page_views from authenticated, anon;

-- ───────── audit wording for meetings ─────────
do $do$
declare d text := pg_get_functiondef('private.audit_row()'::regprocedure);
begin
  d := replace(d, $x$  when 'consents' then$x$,
$x$  when 'meetings' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and 'client_visible' = any(chg) then
      s := format('%s meeting notes “%s”', case when (n ->> 'client_visible')::boolean then 'Shared' else 'Unshared' end, r ->> 'title');
      vis := true;
    else s := format('%s meeting notes “%s”', verb, r ->> 'title'); end if;
  when 'meeting_items' then
    vis := coalesce((select m.client_visible from public.meetings m where m.id = (r ->> 'meeting_id')::uuid), false);
    if tg_op = 'UPDATE' and 'status' = any(chg) then
      s := format('Meeting point “%s” marked %s', left(r ->> 'body', 80), n ->> 'status');
    else s := format('%s meeting point “%s”', verb, left(r ->> 'body', 80)); end if;
  when 'consents' then$x$);
  if position('meeting_items' in d) = 0 then raise exception 'audit_row patch did not apply'; end if;
  execute d;
end $do$;

create trigger audit after insert or update or delete on public.meetings for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.meeting_items for each row execute function private.audit_row();

notify pgrst, 'reload schema';
