-- 1. Every project has a short permanent code, e.g. TBT-2610 (initials + year/month started).
-- 2. Access is per project code with a role: team, approver, contributor or viewer.
--    approver     answers decisions, approves fees, signs off deliverables and monthly reports
--    contributor  sends requests and messages, uploads files, marks their action points done
--    viewer       reads and downloads only
--    team         sees and drafts project work (never money, time or passwords); cannot share with the client
-- 3. Deliverables with client sign-off, % complete on one-time services, and monthly cycles for retainers.

-- ───────── 1. project codes ─────────
alter table public.projects add column code text unique check (code ~ '^[A-Z0-9]{2,6}-[0-9]{4}[A-Z]?$');

create or replace function private.project_code(p_name text, p_day date, p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  words text[] := regexp_split_to_array(upper(regexp_replace(coalesce(p_name, 'PRJ'), '[^A-Za-z ]', '', 'g')), '\s+');
  ini text := '';
  w text;
  base text;
  c text;
  n int := 0;
begin
  foreach w in array words loop if w <> '' then ini := ini || left(w, 1); end if; end loop;
  -- Pad short initials from the first word (Tailbone Treatment -> TBT style needs 3 letters)
  if length(ini) < 3 then ini := left(left(coalesce(words[1], 'PRJ'), 3 - length(ini) + 1) || substr(ini, 2), 3); end if;
  base := left(ini, 4) || '-' || to_char(coalesce(p_day, current_date), 'YYMM');
  c := base;
  while exists (select 1 from public.projects where code = c and id is distinct from p_id) loop
    n := n + 1; c := base || chr(64 + n);
  end loop;
  return c;
end $$;

create or replace function private.fill_project_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := private.project_code(new.name, coalesce(new.started_on, current_date), new.id);
  else
    new.code := upper(btrim(new.code));
  end if;
  return new;
end $$;
create trigger fill_code before insert or update of code on public.projects for each row execute function private.fill_project_code();

update public.projects set code = 'TBT-2610' where slug = 'tailbone-treatment' and code is null;
update public.projects set code = null where code is null;  -- fills the rest through the trigger
alter table public.projects alter column code set not null;

-- ───────── 2. roles per project ─────────
alter table public.project_members drop constraint if exists project_members_role_check;
update public.project_members set role = 'approver' where role = 'client';
alter table public.project_members alter column role set default 'approver';
alter table public.project_members add constraint project_members_role_check check (role in ('team','approver','contributor','viewer'));

-- The signed-in person's role on a project (null when they have no access)
create or replace function private.member_role(p uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.project_members m
    join public.profiles me on me.id = (select auth.uid()) and me.status = 'active'
    join public.projects pr on pr.id = m.project_id and (pr.ended_on is null or current_date <= pr.ended_on + 7)
   where m.project_id = p and m.email = lower((select auth.jwt()) ->> 'email')
$$;
create or replace function private.has_role(p uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role(p) = any(roles), false)
$$;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.has_role(uuid, text[]) to authenticated;

alter table public.audit_log drop constraint if exists audit_log_actor_role_check;
alter table public.audit_log add constraint audit_log_actor_role_check check (actor_role in ('admin','team','client','system'));

create or replace function private.actor(out uid uuid, out name text, out role text)
language plpgsql stable security definer set search_path = '' as $$
begin
  uid := auth.uid();
  if uid is null then name := 'System'; role := 'system'; return; end if;
  select coalesce(p.full_name, p.username, p.email),
         case when p.is_owner then 'admin'
              when exists (select 1 from public.project_members m where m.email = lower(auth.jwt() ->> 'email') and m.role = 'team') then 'team'
              else 'client' end
    into name, role from public.profiles p where p.id = uid;
  name := coalesce(name, lower(auth.jwt() ->> 'email'));
  role := coalesce(role, 'client');
end $$;

-- Who may send things in: approvers, contributors and team; viewers only read
alter policy member_insert on public.requests with check (private.has_role(project_id, array['approver','contributor','team']) and created_by = (select auth.uid()) and status = 'new' and reply is null);
alter policy write_thread on public.request_messages with check ((select private.is_owner()) or private.has_role((select r.project_id from public.requests r where r.id = request_id), array['approver','contributor','team']));
alter policy member_insert on public.files with check (private.has_role(project_id, array['approver','contributor','team']) and storage_path like project_id::text || '/%' and (client_visible or private.has_role(project_id, array['team'])));
alter policy member_upload on storage.objects with check (bucket_id = 'project-files' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and private.has_role(((storage.foldername(name))[1])::uuid, array['approver','contributor','team']));

-- Only the approver answers decisions and fees
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.answer_decision(uuid,text,text)'::regprocedure);
  d := replace(d, $x$  if d.status = 'closed' then$x$, $x$  if not private.has_role(d.project_id, array['approver']) then raise exception 'Only the project approver can answer decisions'; end if;
  if d.status = 'closed' then$x$);
  if position('Only the project approver' in d) = 0 then raise exception 'answer_decision patch did not apply'; end if;
  execute d;
  d := pg_get_functiondef('public.respond_fee(uuid,text,numeric,text)'::regprocedure);
  d := replace(d, $x$  if s.status in ('Declined','Stopped') then$x$, $x$  if not private.has_role(s.project_id, array['approver']) then raise exception 'Only the project approver can answer fees'; end if;
  if s.status in ('Declined','Stopped') then$x$);
  if position('Only the project approver' in d) = 0 then raise exception 'respond_fee patch did not apply'; end if;
  execute d;
end $do$;

-- Team: read all project work (not money, time or passwords) and keep private drafts; never share
do $do$
declare t text;
begin
  foreach t in array array['updates','issues','decisions','meetings','meeting_items','strategies','metrics','files'] loop
    execute format('create policy team_read on public.%I for select to authenticated using (private.has_role(project_id, array[''team'']))', t);
  end loop;
  foreach t in array array['updates','issues','meetings','meeting_items','strategies'] loop
    execute format('create policy team_draft_insert on public.%I for insert to authenticated with check (private.has_role(project_id, array[''team'']) and not client_visible)', t);
    execute format('create policy team_draft_update on public.%I for update to authenticated using (private.has_role(project_id, array[''team'']) and not client_visible) with check (private.has_role(project_id, array[''team'']) and not client_visible)', t);
  end loop;
end $do$;
create policy team_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and exists (select 1 from public.files f where f.storage_path = objects.name and private.has_role(f.project_id, array['team'])));

-- A client (approver or contributor) marks their own action point done, or open again
create or replace function public.client_item_done(item uuid, done boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.meeting_items;
begin
  select mi.* into i from public.meeting_items mi join public.meetings m on m.id = mi.meeting_id
   where mi.id = item and mi.client_visible and m.client_visible;
  if i.id is null or not private.has_role(i.project_id, array['approver','contributor']) then raise exception 'Not found'; end if;
  if i.kind <> 'action' or i.owner not in ('client','both') then raise exception 'Only your own action points can be marked'; end if;
  update public.meeting_items set status = case when done then 'done' else 'open' end where id = item;
end $$;
revoke execute on function public.client_item_done(uuid, boolean) from public, anon;
grant execute on function public.client_item_done(uuid, boolean) to authenticated;

-- ───────── 3a. deliverables and sign-off ─────────
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  title text not null check (length(title) between 1 and 300),
  details text check (length(details) <= 4000),
  link text,
  due_on date,
  status text not null default 'draft' check (status in ('draft','awaiting','approved','changes')),
  client_note text check (length(client_note) <= 2000),
  decided_at timestamptz,
  decided_by uuid,
  client_visible boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.deliverables (project_id);
alter table public.deliverables enable row level security;
create policy owner_all on public.deliverables for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.deliverables for select to authenticated using (client_visible and private.is_member(project_id));
create policy team_read on public.deliverables for select to authenticated using (private.has_role(project_id, array['team']));

create or replace function public.sign_off(deliverable uuid, choice text, note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.deliverables;
begin
  select * into d from public.deliverables where id = deliverable;
  if d.id is null or not d.client_visible or not private.is_member(d.project_id) then raise exception 'Not found'; end if;
  if not private.has_role(d.project_id, array['approver']) then raise exception 'Only the project approver can sign off'; end if;
  if d.status not in ('awaiting','changes') then raise exception 'This is not waiting for your sign-off'; end if;
  if choice not in ('approved','changes') then raise exception 'Choose approve or ask for changes'; end if;
  if choice = 'changes' and coalesce(btrim(sign_off.note), '') = '' then raise exception 'Please say what should change'; end if;
  update public.deliverables set status = choice, client_note = nullif(btrim(sign_off.note), ''), decided_at = now(), decided_by = auth.uid(), updated_at = now()
   where id = deliverable;
end $$;
revoke execute on function public.sign_off(uuid, text, text) from public, anon;
grant execute on function public.sign_off(uuid, text, text) to authenticated;

-- ───────── 3b. % complete on one-time services ─────────
alter table public.project_services add column progress smallint check (progress between 0 and 100);

-- ───────── 3c. monthly cycles for retainers ─────────
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  month date not null check (extract(day from month) = 1),
  plan text check (length(plan) <= 4000),
  target text check (length(target) <= 1000),
  plan_agreed_on date,
  work_done boolean not null default false,
  report_link text,
  report_sent_on date,
  result text check (length(result) <= 2000),
  retro text check (length(retro) <= 2000),
  status text not null default 'planning' check (status in ('planning','in_progress','report_sent','approved','delayed')),
  client_note text check (length(client_note) <= 2000),
  client_approved_at timestamptz,
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, month)
);
alter table public.cycles enable row level security;
create policy owner_all on public.cycles for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.cycles for select to authenticated using (client_visible and private.is_member(project_id));
create policy team_read on public.cycles for select to authenticated using (private.has_role(project_id, array['team']));

create or replace function public.approve_cycle(cycle uuid, note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cycles;
begin
  select * into c from public.cycles where id = cycle;
  if c.id is null or not c.client_visible or not private.is_member(c.project_id) then raise exception 'Not found'; end if;
  if not private.has_role(c.project_id, array['approver']) then raise exception 'Only the project approver can approve the monthly report'; end if;
  if c.status <> 'report_sent' then raise exception 'This month''s report is not waiting for approval'; end if;
  update public.cycles set status = 'approved', client_note = nullif(btrim(approve_cycle.note), ''), client_approved_at = now(), updated_at = now() where id = cycle;
end $$;
revoke execute on function public.approve_cycle(uuid, text) from public, anon;
grant execute on function public.approve_cycle(uuid, text) to authenticated;

-- ───────── audit wording ─────────
do $do$
declare d text := pg_get_functiondef('private.audit_row()'::regprocedure);
begin
  d := replace(d, $x$  when 'consents' then$x$,
$x$  when 'deliverables' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and 'status' = any(chg) and n ->> 'status' = 'approved' then
      s := format('Signed off “%s”%s', r ->> 'title', coalesce(' (' || (n ->> 'client_note') || ')', ''));
    elsif tg_op = 'UPDATE' and 'status' = any(chg) and n ->> 'status' = 'changes' then
      s := format('Changes asked for “%s”: %s', r ->> 'title', coalesce(n ->> 'client_note', ''));
    elsif tg_op = 'UPDATE' and 'status' = any(chg) and n ->> 'status' = 'awaiting' then
      s := format('Sent “%s” for sign-off', r ->> 'title'); vis := true;
    else s := format('%s deliverable “%s”', verb, r ->> 'title'); end if;
  when 'cycles' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and 'status' = any(chg) then
      s := format('Month %s: %s', to_char((r ->> 'month')::date, 'Mon YYYY'), replace(n ->> 'status', '_', ' '));
    else s := format('%s monthly cycle %s', verb, to_char((r ->> 'month')::date, 'Mon YYYY')); end if;
  when 'consents' then$x$);
  if position('Signed off' in d) = 0 then raise exception 'audit_row patch did not apply'; end if;
  execute d;
end $do$;

create trigger audit after insert or update or delete on public.deliverables for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.cycles for each row execute function private.audit_row();

notify pgrst, 'reload schema';
