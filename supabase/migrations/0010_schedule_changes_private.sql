-- Schedule changes are admin-only in the audit trail: clients see only when the next update is, never a skipped or
-- moved date. Same function as 0008 except the schedule_changes branch.

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

update public.audit_log set client_visible = false where table_name = 'schedule_changes' and client_visible;
