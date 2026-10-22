-- Campaigns (which ads run, with their settings) and day-by-day results, shown on Current results.
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  service_id uuid references public.project_services on delete set null,
  name text not null check (length(name) between 1 and 200),
  platform text not null default 'Google Ads',
  type text,                 -- Search, Performance Max, YouTube…
  status text not null default 'live' check (status in ('planned','live','paused','ended')),
  started_on date,
  ended_on date,
  locations text,
  budget text,
  bidding text,
  networks text,
  schedule text,
  goal text,
  keywords text,
  ads text,
  assets text,
  landing_url text,
  notes text,                -- remarks the client sees
  client_visible boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.campaigns (project_id);
alter table public.campaigns enable row level security;
create policy owner_all on public.campaigns for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.campaigns for select to authenticated using (client_visible and private.is_member(project_id));
create policy team_read on public.campaigns for select to authenticated using (private.has_role(project_id, array['team']));

create table public.campaign_days (
  campaign_id uuid not null references public.campaigns on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  day date not null,
  impressions int check (impressions >= 0),
  clicks int check (clicks >= 0),
  cost numeric(12,2) check (cost >= 0),       -- ₹, as Google reports it (before GST)
  calls int check (calls >= 0),               -- calls from the ad's call button
  conversions numeric(10,2) check (conversions >= 0),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, day)
);
create index on public.campaign_days (project_id);
alter table public.campaign_days enable row level security;
create policy owner_all on public.campaign_days for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.campaign_days for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.client_visible and private.is_member(c.project_id)));
create policy team_read on public.campaign_days for select to authenticated using (private.has_role(project_id, array['team']));

-- Activity wording; daily figures are bulk imports and are not logged row by row
do $do$
declare d text := pg_get_functiondef('private.audit_row()'::regprocedure);
begin
  d := replace(d, $x$  when 'consents' then$x$,
$x$  when 'campaigns' then
    vis := (r ->> 'client_visible')::boolean;
    s := format('%s campaign “%s”', verb, r ->> 'name');
  when 'consents' then$x$);
  if position('campaign “%s”' in d) = 0 then raise exception 'audit_row patch did not apply'; end if;
  execute d;
end $do$;
create trigger audit after insert or update or delete on public.campaigns for each row execute function private.audit_row();

notify pgrst, 'reload schema';
