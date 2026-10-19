-- Fees can be kept from a client until they are agreed in person ("coming soon" on their Money tab).
-- projects.money_open = false: the client cannot answer fees, fee changes are not in their activity, and the
-- website shows "Coming soon" instead of fees and invoices. Turn it on from the project's Overview.

alter table public.projects add column money_open boolean not null default true;

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
    elsif tg_op = 'UPDATE' and 'money_open' = any(chg) then
      s := case when (n ->> 'money_open')::boolean then 'Fees and payments shown to the client' else 'Fees and payments hidden from the client (coming soon)' end;
    elsif tg_op = 'UPDATE' and 'ended_on' = any(chg) and n ->> 'ended_on' is not null then
      s := format('Project end date set to %s (portal access until 7 days later)', n ->> 'ended_on'); vis := true;
    else s := format('%s project “%s”', verb, r ->> 'name'); end if;
  when 'project_services' then
    vis := (r ->> 'client_visible')::boolean and coalesce((select pr.money_open from public.projects pr where pr.id = pid), true);
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
    vis := false;
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

create or replace function public.respond_fee(service uuid, choice text, amount numeric default null, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.project_services;
begin
  select * into s from public.project_services where id = service;
  if s.id is null or not s.client_visible or not private.is_member(s.project_id) then raise exception 'Service not found'; end if;
  if not (select pr.money_open from public.projects pr where pr.id = s.project_id) then raise exception 'Fees are not open yet'; end if;
  if s.status in ('Declined','Stopped') then raise exception 'This fee can no longer be changed'; end if;
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

notify pgrst, 'reload schema';
