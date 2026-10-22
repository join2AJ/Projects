-- A short "How it's going" note per campaign, shown at the top of the campaign on Current results.
alter table public.campaigns add column highlights text check (length(highlights) <= 3000);
notify pgrst, 'reload schema';
