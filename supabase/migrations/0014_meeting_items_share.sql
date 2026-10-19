-- Each meeting point is shared with the client one by one (the meeting itself must be shared too), and
-- workable points get a "working on it" status so the client sees they are being acted on.

alter table public.meeting_items add column client_visible boolean not null default false;
alter table public.meeting_items drop constraint meeting_items_status_check;
alter table public.meeting_items add constraint meeting_items_status_check check (status in ('open','in_progress','done','dropped'));

alter policy member_read on public.meeting_items
  using (client_visible and exists (select 1 from public.meetings m where m.id = meeting_id and m.client_visible and private.is_member(m.project_id)));

do $do$
declare d text := pg_get_functiondef('private.audit_row()'::regprocedure);
begin
  d := replace(d, $x$    vis := coalesce((select m.client_visible from public.meetings m where m.id = (r ->> 'meeting_id')::uuid), false);
    if tg_op = 'UPDATE' and 'status' = any(chg) then$x$,
$x$    vis := (r ->> 'client_visible')::boolean and coalesce((select m.client_visible from public.meetings m where m.id = (r ->> 'meeting_id')::uuid), false);
    if tg_op = 'UPDATE' and 'client_visible' = any(chg) then
      s := format('%s meeting point “%s”', case when (n ->> 'client_visible')::boolean then 'Shared' else 'Unshared' end, left(r ->> 'body', 80));
    elsif tg_op = 'UPDATE' and 'status' = any(chg) then$x$);
  d := replace(d, $x$      s := format('Meeting point “%s” marked %s', left(r ->> 'body', 80), n ->> 'status');$x$,
$x$      s := format('Meeting point “%s” marked %s', left(r ->> 'body', 80), replace(n ->> 'status', '_', ' '));$x$);
  if position('meeting point “%s”'', case when' in d) = 0 then
    raise exception 'audit_row patch did not apply';
  end if;
  execute d;
end $do$;

notify pgrst, 'reload schema';
