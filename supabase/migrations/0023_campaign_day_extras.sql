-- Other daily figures from the same export (e.g. sitelinks or the call button shown), by label.
alter table public.campaign_days add column extras jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';

-- When each figure was last changed, for "Report updated as on …"
-- Older figures stay empty (backfilling would log every row); new and changed figures get the time
alter table public.metrics add column updated_at timestamptz;
alter table public.metrics alter column updated_at set default now();
create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch before update on public.metrics for each row execute function private.touch_updated_at();
create trigger touch before update on public.campaign_days for each row execute function private.touch_updated_at();
notify pgrst, 'reload schema';
