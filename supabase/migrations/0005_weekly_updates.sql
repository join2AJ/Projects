-- Weekly updates on a fixed timetable: every Tuesday 11:00 IST, for every active client.
-- Updates of kind 'meeting' are the weekly updates (shown as "Weekly update"; clients never see the word meeting).
-- An update can carry publish_at: clients see it only once it is approved AND that time has passed,
-- so the admin can write and approve on Monday and it appears on Tuesday at 11:00 by itself.
alter table public.updates add column publish_at timestamptz;
alter policy member_read on public.updates
  using (client_visible and (publish_at is null or publish_at <= now()) and private.is_member(project_id));
create index on public.updates (project_id, kind, happened_on);
notify pgrst, 'reload schema';
