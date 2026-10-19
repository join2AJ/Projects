-- Priority for meeting points: 1 = now (this week), 2 = next (2 weeks), 3 = later.
alter table public.meeting_items add column priority smallint check (priority between 1 and 3);
create index on public.meeting_items (priority) where status in ('open','in_progress');
notify pgrst, 'reload schema';
