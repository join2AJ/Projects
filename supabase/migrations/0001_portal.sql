-- Client portal schema: projects, client access by email, updates, issues, money, files, requests, time, metrics.
-- Access rules (row level security):
--   * the studio owner (profiles.is_owner) can read and write everything;
--   * a client can read a project only if their login email is in project_members for it,
--     and within it only rows marked client_visible (drafts and internal notes stay private);
--   * clients can add requests and upload files to their own projects, nothing else.

-- ───────── owner and people ─────────
create table public.settings (
  id boolean primary key default true check (id),
  owner_email text not null check (owner_email = lower(owner_email))
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, is_owner)
  values (new.id, lower(new.email), exists (select 1 from public.settings s where s.owner_email = lower(new.email)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_owner from public.profiles where id = (select auth.uid())), false)
$$;

-- ───────── clients and projects ─────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  client_id uuid references public.clients on delete set null,
  name text not null,
  stage text not null default 'enquiry'
    check (stage in ('enquiry','discovery','proposal','onboarding','delivery','review','offboarding','closed')),
  summary text,
  brief text,
  started_on date,
  ended_on date,
  next_meeting_at timestamptz,
  next_meeting_note text,
  report_key text, -- links a custom report module in the code, e.g. 'tailbone-ads-2026-10'
  created_at timestamptz not null default now()
);

-- Who may log in and see a project: by email, so you can add a client before they ever sign in.
create table public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  email text not null check (email = lower(email)),
  name text,
  role text not null default 'client' check (role in ('client','viewer')),
  added_at timestamptz not null default now(),
  primary key (project_id, email)
);

create or replace function public.is_member(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p and m.email = lower((select auth.jwt()) ->> 'email')
  )
$$;

-- ───────── work ─────────
create table public.project_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  service_key text not null, -- key in src/data/studio.js SERVICES, or 'custom'
  name text not null,
  kind text not null check (kind in ('one-time','monthly','hourly')),
  price numeric(12,2) not null default 0, -- agreed fee, ex-GST
  status text not null default 'Proposed'
    check (status in ('Proposed','Agreed','In progress','Live','Done','Paused','Stopped','Declined')),
  start_on date,
  end_on date,
  note text,
  client_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  happened_on date not null default current_date,
  kind text not null default 'work' check (kind in ('work','milestone','meeting','decision','note')),
  title text not null,
  body text,
  status text not null default 'Done' check (status in ('Done','In progress','Scheduled','Blocked')),
  client_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  title text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_client','blocked','resolved','superseded')),
  evidence text,
  fix text,
  now_note text,
  owner text not null default 'me' check (owner in ('me','client','third_party')),
  raised_on date not null default current_date,
  resolved_on date,
  sort int not null default 0,
  client_visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────── money ─────────
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  number text not null unique,
  description text,
  issued_on date not null default current_date,
  due_on date not null default (current_date + 7),
  amount numeric(12,2) not null check (amount >= 0), -- ex-GST
  gst numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  paid_on date,
  paid_amount numeric(12,2),
  last_reminded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade, -- null = studio overhead
  spent_on date not null default current_date,
  category text not null default 'other'
    check (category in ('software','hosting','domain','ads','stock','travel','contractor','other')),
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  paid_by text not null default 'me' check (paid_by in ('me','client')),
  rebillable boolean not null default false,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at is null or ended_at > started_at),
  task text not null,
  billable boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────── client input and files ─────────
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  created_by uuid default auth.uid() references auth.users on delete set null,
  author_email text default lower(auth.jwt() ->> 'email'),
  type text not null default 'New work' check (type in ('New work','Change','Something is broken','Question')),
  priority text not null default 'This week' check (priority in ('Urgent: today','This week','This month','Whenever')),
  details text not null check (length(details) between 1 and 5000),
  link text,
  status text not null default 'new' check (status in ('new','accepted','in_progress','done','declined')),
  reply text,
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  name text not null,
  storage_path text not null unique, -- <project_id>/<uuid>-<name> in the project-files bucket
  size bigint,
  mime text,
  category text not null default 'other' check (category in ('report','design','contract','invoice','data','asset','other')),
  note text,
  client_visible boolean not null default true,
  uploaded_by text default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

-- Any number over time, for any project: ad spend, clicks, calls, visits, rankings, revenue…
create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  metric text not null,
  period date not null, -- first day of the month (or the day) the value belongs to
  value numeric not null,
  unit text, -- '₹', 'clicks', '%', …
  source text,
  client_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, metric, period)
);

-- Foreign-key indexes
create index on public.projects (client_id);
create index on public.project_services (project_id);
create index on public.updates (project_id, happened_on desc);
create index on public.issues (project_id);
create index on public.invoices (project_id);
create index on public.expenses (project_id);
create index on public.time_entries (project_id, started_at desc);
create index on public.requests (project_id, created_at desc);
create index on public.requests (created_by);
create index on public.files (project_id);
create index on public.metrics (project_id, metric, period);

-- ───────── row level security ─────────
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_services enable row level security;
alter table public.updates enable row level security;
alter table public.issues enable row level security;
alter table public.invoices enable row level security;
alter table public.expenses enable row level security;
alter table public.time_entries enable row level security;
alter table public.requests enable row level security;
alter table public.files enable row level security;
alter table public.metrics enable row level security;

-- Owner: everything (settings is managed from the SQL editor only).
create policy owner_all on public.clients for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.projects for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.project_members for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.project_services for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.updates for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.issues for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.invoices for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.expenses for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.time_entries for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.requests for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.files for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.metrics for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- Profiles: you see your own; the owner sees all.
create policy own_profile on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_owner()));

-- Clients: read what belongs to their projects.
create policy member_read on public.projects for select to authenticated using (public.is_member(id));
create policy member_read on public.clients for select to authenticated
  using (exists (select 1 from public.projects p where p.client_id = clients.id and public.is_member(p.id)));
create policy member_read on public.project_members for select to authenticated using (public.is_member(project_id));
create policy member_read on public.project_services for select to authenticated using (client_visible and public.is_member(project_id));
create policy member_read on public.updates for select to authenticated using (client_visible and public.is_member(project_id));
create policy member_read on public.issues for select to authenticated using (client_visible and public.is_member(project_id));
create policy member_read on public.invoices for select to authenticated using (status <> 'draft' and public.is_member(project_id));
create policy member_read on public.expenses for select to authenticated using (client_visible and public.is_member(project_id));
create policy member_read on public.files for select to authenticated using (client_visible and public.is_member(project_id));
create policy member_read on public.metrics for select to authenticated using (client_visible and public.is_member(project_id));
create policy member_read on public.requests for select to authenticated using (public.is_member(project_id));

-- Clients: write requests and file records for their own projects only.
create policy member_insert on public.requests for insert to authenticated
  with check (public.is_member(project_id) and created_by = (select auth.uid()) and status = 'new' and reply is null);
create policy member_insert on public.files for insert to authenticated
  with check (public.is_member(project_id) and client_visible and storage_path like project_id::text || '/%');

-- ───────── file storage ─────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do nothing;

create policy owner_all on storage.objects for all to authenticated
  using (bucket_id = 'project-files' and (select public.is_owner()))
  with check (bucket_id = 'project-files' and (select public.is_owner()));

create policy member_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and exists (
    select 1 from public.files f where f.storage_path = objects.name and f.client_visible and public.is_member(f.project_id)));

create policy member_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_member(((storage.foldername(name))[1])::uuid));

-- Policy helpers: signed-in users only. The trigger function is never callable directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
