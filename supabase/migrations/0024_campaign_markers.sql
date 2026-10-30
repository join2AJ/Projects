-- Dated notes drawn as dotted lines on the campaign's day-by-day charts (e.g. "areas added"), one per line: YYYY-MM-DD text
alter table public.campaigns add column if not exists markers text;
notify pgrst, 'reload schema';
