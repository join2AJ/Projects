-- Promotion plan: every channel (Google Ads, website, Instagram and Facebook, influencers, referrals...) with its
-- strategies, status, priority, monthly budget and how success is measured. Private until shared, point by point.

-- The client's agreed monthly ad spend limit (incl. GST), shown against the planned spend.
alter table public.projects add column ads_cap numeric(12,2) check (ads_cap is null or ads_cap >= 0);

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  channel text not null check (length(channel) between 1 and 80),
  title text not null check (length(title) between 1 and 300),
  details text check (length(details) <= 4000),
  status text not null default 'idea' check (status in ('idea','planned','active','paused','done','dropped')),
  priority smallint check (priority between 1 and 3),
  budget_month numeric(12,2) check (budget_month is null or budget_month >= 0),
  kpi text check (length(kpi) <= 500),
  owner text check (owner in ('me','client','both')),
  start_on date,
  client_visible boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.strategies (project_id, channel);
alter table public.strategies enable row level security;
create policy owner_all on public.strategies for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.strategies for select to authenticated
  using (client_visible and private.is_member(project_id));

do $do$
declare d text := pg_get_functiondef('private.audit_row()'::regprocedure);
begin
  d := replace(d, $x$  when 'consents' then$x$,
$x$  when 'strategies' then
    vis := (r ->> 'client_visible')::boolean;
    if tg_op = 'UPDATE' and 'client_visible' = any(chg) then
      s := format('%s promotion plan point “%s”', case when (n ->> 'client_visible')::boolean then 'Shared' else 'Unshared' end, r ->> 'title');
      vis := true;
    elsif tg_op = 'UPDATE' and 'status' = any(chg) then
      s := format('Promotion “%s” (%s): %s → %s', r ->> 'title', r ->> 'channel', o ->> 'status', n ->> 'status');
    else s := format('%s promotion plan point “%s” (%s)', verb, r ->> 'title', r ->> 'channel'); end if;
  when 'consents' then$x$);
  if position('promotion plan point' in d) = 0 then raise exception 'audit_row patch did not apply'; end if;
  execute d;
end $do$;

create trigger audit after insert or update or delete on public.strategies for each row execute function private.audit_row();

notify pgrst, 'reload schema';
