-- 1. Weekly update schedule changes (skip / move a Tuesday slot, for one client or all)
-- 2. Request conversations that cannot be edited or deleted; requests and decisions cannot be deleted
-- 3. Fees: the client approves a fee or names their own price; standard prices and discounts become admin-only
-- 4. DPDP: privacy-notice consent records; portal access ends 7 days after a project ends
-- 0. Audit trail wording for all of the above (installed first)

-- ───────── 0. audit wording (first, so the data moves below are logged correctly) ─────────
create or replace function private.ist(t timestamptz) returns text language sql stable as $$
  select to_char(t at time zone 'Asia/Kolkata', 'Dy DD Mon YYYY, HH24:MI')
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
  -- Standard prices / discounts on a client's fee are admin-only (fee_private); don't log them as fee changes.
  if tg_op = 'UPDATE' and tg_table_name = 'project_services' and chg <@ array['list_price','discount_note'] then return null; end if;
  select * into a from private.actor();
  if a.role = 'system' and tg_table_name in ('profiles','project_members') then return null; end if;

  pid := case when tg_table_name = 'projects' then (r ->> 'id')::uuid
              when tg_table_name = 'fee_private' then (select ps.project_id from public.project_services ps where ps.id = (r ->> 'project_service_id')::uuid)
              else nullif(r ->> 'project_id', '')::uuid end;

  case tg_table_name
  when 'projects' then
    if tg_op = 'UPDATE' and 'stage' = any(chg) then
      s := format('Project moved from %s to %s', initcap(o ->> 'stage'), initcap(n ->> 'stage')); vis := true;
    elsif tg_op = 'UPDATE' and 'ended_on' = any(chg) and n ->> 'ended_on' is not null then
      s := format('Project end date set to %s (portal access until 7 days later)', n ->> 'ended_on'); vis := true;
    else s := format('%s project “%s”', verb, r ->> 'name'); end if;
  when 'project_services' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and a.role = 'admin' and o ->> 'client_response' = 'offer' and n ->> 'client_response' = 'approved' then
      s := format('Proposed price accepted for %s: %s', r ->> 'name', private.inr((n ->> 'price')::numeric));
    elsif tg_op = 'UPDATE' and 'client_response' = any(chg) and n ->> 'client_response' = 'approved' then
      s := format('Fee approved for %s: %s%s', r ->> 'name', private.inr((n ->> 'price')::numeric), coalesce(' (' || (n ->> 'client_note') || ')', ''));
    elsif tg_op = 'UPDATE' and ('client_offer' = any(chg) or 'client_response' = any(chg)) and n ->> 'client_response' = 'offer' then
      s := format('Price proposed for %s: %s%s', r ->> 'name', private.inr((n ->> 'client_offer')::numeric), coalesce(' (' || (n ->> 'client_note') || ')', ''));
    elsif tg_op = 'UPDATE' and 'price' = any(chg) then
      s := format('Fee for %s set to %s (was %s)', r ->> 'name', private.inr((n ->> 'price')::numeric), private.inr((o ->> 'price')::numeric));
    elsif tg_op = 'UPDATE' and 'status' = any(chg) then
      s := format('%s: %s → %s', r ->> 'name', o ->> 'status', n ->> 'status');
    else s := format('%s service %s (%s)', verb, r ->> 'name', private.inr((r ->> 'price')::numeric)); end if;
  when 'fee_private' then
    s := format('Standard price / discount note changed (standard %s)', coalesce(private.inr((r ->> 'list_price')::numeric), '–'));
  when 'updates' then
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
  when 'request_messages' then
    vis := true;
    s := format('Message on request “%s”: %s', left((select q.details from public.requests q where q.id = (r ->> 'request_id')::uuid), 50), left(r ->> 'body', 120));
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
  when 'schedule_changes' then
    vis := pid is not null;
    s := case when tg_op = 'DELETE' then format('Weekly update on %s restored to its usual time', private.ist((r ->> 'slot_at')::timestamptz))
              when r ->> 'action' = 'skip' then format('Weekly update on %s skipped%s', private.ist((r ->> 'slot_at')::timestamptz), coalesce(': ' || (r ->> 'reason'), ''))
              else format('Weekly update on %s moved to %s%s', private.ist((r ->> 'slot_at')::timestamptz), private.ist((r ->> 'new_at')::timestamptz), coalesce(': ' || (r ->> 'reason'), '')) end;
  when 'consents' then
    s := format('Accepted the privacy notice (%s)', r ->> 'notice_version');
  when 'project_members' then
    s := format('%s access for %s', case tg_op when 'INSERT' then 'Gave' when 'DELETE' then 'Removed' else 'Changed' end, r ->> 'email');
  when 'clients' then s := format('%s clinic “%s”', verb, r ->> 'name');
  when 'profiles' then s := format('%s account %s', verb, coalesce(r ->> 'username', r ->> 'email'));
  when 'services' then s := format('%s price list item %s', verb, r ->> 'name');
  when 'service_notes' then s := format('%s private pricing notes for %s', verb, r ->> 'service_id');
  else s := format('%s %s', verb, tg_table_name);
  end case;

  insert into public.audit_log (actor_id, actor_name, actor_role, action, table_name, row_id, project_id, summary, client_visible)
  values (a.uid, a.name, a.role, lower(tg_op), tg_table_name,
          coalesce(r ->> 'id', r ->> 'service_id', r ->> 'project_service_id', r ->> 'email'), pid, s, coalesce(vis, false))
  returning id into log_id;
  insert into public.audit_detail (log_id, old, new) values (
    log_id,
    case when tg_op = 'UPDATE' then (select jsonb_object_agg(k, o -> k) from unnest(chg) k) else o end,
    case when tg_op = 'UPDATE' then (select jsonb_object_agg(k, n -> k) from unnest(chg) k) else n end);
  return null;
end $$;

-- ───────── 1. schedule changes ─────────
create table public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade,     -- null = every client
  slot_at timestamptz not null,                                     -- the regular Tuesday 11:00 slot affected
  action text not null check (action in ('skip','move')),
  new_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  check ((action = 'move') = (new_at is not null))
);
create unique index schedule_changes_once on public.schedule_changes (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), slot_at);
create index on public.schedule_changes (project_id);
alter table public.schedule_changes enable row level security;
create policy owner_all on public.schedule_changes for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.schedule_changes for select to authenticated
  using (project_id is null or private.is_member(project_id));

-- ───────── 2. conversations ─────────
create table public.request_messages (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests on delete restrict,
  project_id uuid not null references public.projects on delete cascade,
  author_id uuid references auth.users on delete set null,
  author_name text,
  author_role text,
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on public.request_messages (request_id, created_at);
create index on public.request_messages (project_id);
create index on public.request_messages (author_id);

create or replace function private.fill_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select * into a from private.actor();
  new.author_id := a.uid; new.author_name := a.name; new.author_role := a.role;
  new.project_id := (select r.project_id from public.requests r where r.id = new.request_id);
  new.created_at := now();
  return new;
end $$;
create trigger fill_message before insert on public.request_messages for each row execute function private.fill_message();

alter table public.request_messages enable row level security;
create policy read_thread on public.request_messages for select to authenticated
  using ((select private.is_owner()) or private.is_member(project_id));
create policy write_thread on public.request_messages for insert to authenticated
  with check (((select private.is_owner()) or private.is_member((select r.project_id from public.requests r where r.id = request_id))));
revoke update, delete, truncate on public.request_messages from anon, authenticated;

-- Nobody deletes requests or decisions; they are part of the record.
create policy keep_forever on public.requests as restrictive for delete to authenticated using (false);
create policy keep_forever on public.decisions as restrictive for delete to authenticated using (false);

-- ───────── 3. fees ─────────
create table public.fee_private (
  project_service_id uuid primary key references public.project_services on delete cascade,
  list_price numeric(12,2) check (list_price is null or list_price >= 0),
  discount_note text,
  updated_at timestamptz not null default now()
);
alter table public.fee_private enable row level security;
create policy owner_all on public.fee_private for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
insert into public.fee_private (project_service_id, list_price, discount_note)
  select id, list_price, discount_note from public.project_services where list_price is not null or discount_note is not null;
update public.project_services set list_price = null, discount_note = null where list_price is not null or discount_note is not null;

-- Standard prices are admin-only too.
alter table public.service_notes add column std_price numeric(12,2) check (std_price is null or std_price >= 0);
update public.service_notes n set std_price = s.avg_price from public.services s where s.id = n.service_id;
insert into public.service_notes (service_id, std_price) select id, avg_price from public.services s
  where not exists (select 1 from public.service_notes n where n.service_id = s.id);
update public.services set avg_price = 0 where avg_price <> 0;

alter table public.project_services
  add column client_response text check (client_response in ('approved','offer')),
  add column client_offer numeric(12,2) check (client_offer is null or client_offer >= 0),
  add column client_note text check (length(client_note) <= 1000),
  add column client_response_at timestamptz;

create or replace function public.respond_fee(service uuid, choice text, amount numeric default null, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.project_services;
begin
  select * into s from public.project_services where id = service;
  if s.id is null or not s.client_visible or not private.is_member(s.project_id) then raise exception 'Service not found'; end if;
  if s.status in ('Declined','Stopped','Done') then raise exception 'This fee can no longer be changed'; end if;
  if choice = 'approved' then
    update public.project_services set client_response = 'approved', client_offer = null, client_note = nullif(btrim(respond_fee.note), ''),
      client_response_at = now(), status = case when status = 'Proposed' then 'Agreed' else status end where id = service;
  elsif choice = 'offer' then
    if amount is null or amount <= 0 then raise exception 'Enter the fee you propose'; end if;
    update public.project_services set client_response = 'offer', client_offer = round(amount, 2), client_note = nullif(btrim(respond_fee.note), ''),
      client_response_at = now() where id = service;
  else raise exception 'Choose approve or offer';
  end if;
end $$;
revoke execute on function public.respond_fee(uuid, text, numeric, text) from public, anon;
grant execute on function public.respond_fee(uuid, text, numeric, text) to authenticated;

-- ───────── 4. privacy (DPDP) ─────────
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  notice_version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, notice_version)
);
alter table public.consents enable row level security;
create policy own_or_owner on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));
create policy own_insert on public.consents for insert to authenticated with check (user_id = (select auth.uid()));
revoke update, delete, truncate on public.consents from anon, authenticated;

-- Client access to a project ends 7 days after the project's end date.
create or replace function private.is_member(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    join public.profiles me on me.id = (select auth.uid()) and me.status = 'active'
    join public.projects pr on pr.id = m.project_id and (pr.ended_on is null or current_date <= pr.ended_on + 7)
    where m.project_id = p and m.email = lower((select auth.jwt()) ->> 'email')
  )
$$;

create trigger audit after insert or update or delete on public.schedule_changes for each row execute function private.audit_row();
create trigger audit after insert on public.request_messages for each row execute function private.audit_row();
create trigger audit after insert or update or delete on public.fee_private for each row execute function private.audit_row();
create trigger audit after insert on public.consents for each row execute function private.audit_row();

notify pgrst, 'reload schema';
