-- Audit trail: every change to project data is recorded with a timestamp, who made it, and what changed.
-- Nobody can edit or delete the log through the API (no update/delete policies; writes come only from the
-- triggers and functions below). The admin sees everything; a client sees entries for their own projects
-- that concern things they can see, plus their own sign-ins.

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  actor_role text not null check (actor_role in ('admin','client','system')),
  action text not null,           -- insert | update | delete | sign_in | sign_out | user.create | …
  table_name text,
  row_id text,
  project_id uuid,
  summary text not null,
  client_visible boolean not null default false
);
-- The before/after values, admin only.
create table public.audit_detail (
  log_id bigint primary key references public.audit_log on delete cascade,
  old jsonb,
  new jsonb
);
create index on public.audit_log (project_id, at desc);
create index on public.audit_log (at desc);
create index on public.audit_log (actor_id, at desc);

alter table public.audit_log enable row level security;
alter table public.audit_detail enable row level security;
create policy owner_read on public.audit_log for select to authenticated using ((select private.is_owner()));
create policy member_read on public.audit_log for select to authenticated
  using ((client_visible and project_id is not null and private.is_member(project_id)) or actor_id = (select auth.uid()));
create policy owner_read on public.audit_detail for select to authenticated using ((select private.is_owner()));
revoke insert, update, delete, truncate on public.audit_log, public.audit_detail from anon, authenticated;

-- Who is acting right now.
create or replace function private.actor(out uid uuid, out name text, out role text)
language plpgsql stable security definer set search_path = '' as $$
begin
  uid := auth.uid();
  if uid is null then name := 'System'; role := 'system'; return; end if;
  select coalesce(p.full_name, p.username, p.email), case when p.is_owner then 'admin' else 'client' end
    into name, role from public.profiles p where p.id = uid;
  name := coalesce(name, lower(auth.jwt() ->> 'email'));
  role := coalesce(role, 'client');
end $$;

create or replace function private.inr(n numeric) returns text language sql immutable as $$
  select '₹' || trim(to_char(n, 'FM9G99G99G99G999'))
$$;

create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  chg text[];
  a record;
  pid uuid;
  vis boolean := false;
  s text;
  verb text := case tg_op when 'INSERT' then 'Added' when 'UPDATE' then 'Edited' else 'Deleted' end;
  log_id bigint;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k) into chg from jsonb_object_keys(n) k where n -> k is distinct from o -> k and k <> 'updated_at';
    if chg is null then return null; end if;
  end if;
  select * into a from private.actor();
  -- Account changes made through the admin tool are logged by that tool, with the admin's name.
  if a.role = 'system' and tg_table_name in ('profiles','project_members') then return null; end if;

  pid := case when tg_table_name = 'projects' then (r ->> 'id')::uuid else nullif(r ->> 'project_id', '')::uuid end;

  case tg_table_name
  when 'projects' then
    if tg_op = 'UPDATE' and 'stage' = any(chg) then
      s := format('Project moved from %s to %s', initcap(o ->> 'stage'), initcap(n ->> 'stage')); vis := true;
    else s := format('%s project “%s”', verb, r ->> 'name'); end if;
  when 'project_services' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and ('price' = any(chg) or 'list_price' = any(chg)) then
      s := format('Fee for %s changed from %s to %s%s', r ->> 'name', private.inr((o ->> 'price')::numeric), private.inr((n ->> 'price')::numeric),
        case when (n ->> 'list_price') is not null and (n ->> 'list_price')::numeric > (n ->> 'price')::numeric
          then format(' (standard %s)', private.inr((n ->> 'list_price')::numeric)) else '' end);
    elsif tg_op = 'UPDATE' and 'status' = any(chg) then
      s := format('%s: %s → %s', r ->> 'name', o ->> 'status', n ->> 'status');
    else s := format('%s service %s (%s)', verb, r ->> 'name', private.inr((r ->> 'price')::numeric)); end if;
  when 'updates' then
    -- the update itself appears on the client's timeline once published; the log stays admin-only
    if tg_op = 'UPDATE' and 'client_visible' = any(chg) then
      s := format('%s update “%s”', case when (n ->> 'client_visible')::boolean then 'Approved' else 'Unapproved' end, r ->> 'title');
    else s := format('%s update “%s”', verb, r ->> 'title'); end if;
  when 'issues' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and 'status' = any(chg) then
      s := format('Issue “%s”: %s → %s', r ->> 'title', replace(o ->> 'status', '_', ' '), replace(n ->> 'status', '_', ' '));
    else s := format('%s issue “%s”', verb, r ->> 'title'); end if;
  when 'invoices' then
    vis := (r ->> 'status') <> 'draft';
    if tg_op = 'UPDATE' and 'status' = any(chg) then
      s := format('Invoice %s (%s): %s', r ->> 'number', private.inr((r ->> 'amount')::numeric),
        case n ->> 'status' when 'sent' then 'sent' when 'paid' then 'payment received' when 'void' then 'cancelled' else n ->> 'status' end);
    elsif tg_op = 'UPDATE' and 'last_reminded_at' = any(chg) then
      s := format('Payment reminder for invoice %s', r ->> 'number');
    else s := format('%s invoice %s (%s)', verb, r ->> 'number', private.inr((r ->> 'amount')::numeric)); end if;
  when 'expenses' then
    vis := (r ->> 'client_visible')::boolean;
    s := format('%s expense “%s” (%s)', verb, r ->> 'description', private.inr((r ->> 'amount')::numeric));
  when 'time_entries' then
    s := format('%s time entry “%s”', verb, r ->> 'task');
  when 'requests' then
    vis := true;
    if tg_op = 'INSERT' then s := format('Request sent: %s', left(r ->> 'details', 120));
    elsif 'status' = any(coalesce(chg, '{}')) then s := format('Request “%s” marked %s', left(r ->> 'details', 60), replace(n ->> 'status', '_', ' '));
    elsif 'reply' = any(coalesce(chg, '{}')) then s := format('Reply to request “%s”', left(r ->> 'details', 60));
    else s := format('%s request “%s”', verb, left(r ->> 'details', 60)); end if;
  when 'files' then
    vis := (r ->> 'client_visible')::boolean;
    s := format('%s file %s', case tg_op when 'INSERT' then 'Uploaded' when 'DELETE' then 'Removed' else 'Edited' end, r ->> 'name');
    if tg_op = 'UPDATE' and 'client_visible' = any(chg) then
      s := format('File %s %s', r ->> 'name', case when (n ->> 'client_visible')::boolean then 'shared with the client' else 'made private' end);
      vis := true;
    end if;
  when 'metrics' then
    s := format('%s number “%s” for %s', verb, r ->> 'metric', r ->> 'period');
  when 'decisions' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and 'answer' = any(chg) then
      s := format('Answered “%s”: %s%s', r ->> 'question', coalesce(initcap(n ->> 'answer'), 'cleared'),
        case when n ->> 'answer_note' is not null then ' (' || (n ->> 'answer_note') || ')' else '' end);
    elsif tg_op = 'UPDATE' and 'status' = any(chg) and n ->> 'status' = 'closed' then
      s := format('Decided “%s”%s', r ->> 'question', coalesce(': ' || (n ->> 'outcome'), ''));
    elsif tg_op = 'UPDATE' and 'client_visible' = any(chg) then
      s := format('%s decision “%s”', case when (n ->> 'client_visible')::boolean then 'Sent' else 'Withdrew' end, r ->> 'question');
      vis := true;
    else s := format('%s decision “%s”', verb, r ->> 'question'); end if;
  when 'project_members' then
    s := format('%s access for %s', case tg_op when 'INSERT' then 'Gave' when 'DELETE' then 'Removed' else 'Changed' end, r ->> 'email');
  when 'clients' then s := format('%s clinic “%s”', verb, r ->> 'name');
  when 'profiles' then s := format('%s account %s', verb, coalesce(r ->> 'username', r ->> 'email'));
  when 'services' then s := format('%s price list item %s (%s)', verb, r ->> 'name', private.inr((r ->> 'avg_price')::numeric));
  when 'service_notes' then s := format('%s private notes for %s', verb, r ->> 'service_id');
  else s := format('%s %s', verb, tg_table_name);
  end case;

  insert into public.audit_log (actor_id, actor_name, actor_role, action, table_name, row_id, project_id, summary, client_visible)
  values (a.uid, a.name, a.role, lower(tg_op), tg_table_name, coalesce(r ->> 'id', r ->> 'service_id', r ->> 'email'), pid, s, coalesce(vis, false))
  returning id into log_id;
  insert into public.audit_detail (log_id, old, new) values (
    log_id,
    case when tg_op = 'UPDATE' then (select jsonb_object_agg(k, o -> k) from unnest(chg) k) else o end,
    case when tg_op = 'UPDATE' then (select jsonb_object_agg(k, n -> k) from unnest(chg) k) else n end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','project_services','updates','issues','invoices','expenses','time_entries',
    'requests','files','metrics','decisions','project_members','clients','profiles','services','service_notes'] loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function private.audit_row()', t);
  end loop;
end $$;

-- Sign-in and sign-out, recorded by the website after the event.
create or replace function public.log_event(kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if kind not in ('sign_in','sign_out') then raise exception 'Unknown event'; end if;
  select * into a from private.actor();
  if a.uid is null then raise exception 'Not signed in'; end if;
  insert into public.audit_log (actor_id, actor_name, actor_role, action, summary)
  values (a.uid, a.name, a.role, kind, case kind when 'sign_in' then 'Signed in' else 'Signed out' end);
end $$;
revoke execute on function public.log_event(text) from public, anon;
grant execute on function public.log_event(text) to authenticated;

notify pgrst, 'reload schema';
