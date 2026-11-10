-- Which sections a project uses; null means all (projects made before this keep every section)
alter table public.projects add column if not exists sections text[];
notify pgrst, 'reload schema';
