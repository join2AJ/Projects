-- 1. Every clinic (client) has a permanent code, e.g. CLN-001.
-- 2. One login can belong to several clinics (profile_clients); projects stay ticked per login on People.
-- 3. Every point can be linked to the service it belongs to (service_id).
-- 4. Hours a month per service, private to the admin.
-- 5. Clients see only what clients did in the activity record; the admin's own edits, sharing and unsharing stay private.

-- ───────── 1. clinic codes ─────────
create sequence if not exists private.clinic_seq;
alter table public.clients add column code text unique check (code ~ '^[A-Z]{2,6}-[0-9]{3,4}$');
create or replace function private.fill_clinic_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.code is null or btrim(new.code) = '' then
    loop
      new.code := 'CLN-' || lpad(nextval('private.clinic_seq')::text, 3, '0');
      exit when not exists (select 1 from public.clients where code = new.code);
    end loop;
  else
    new.code := upper(btrim(new.code));
  end if;
  return new;
end $$;
create trigger fill_code before insert or update of code on public.clients for each row execute function private.fill_clinic_code();
update public.clients c set code = null from (select id from public.clients order by created_at) o where c.id = o.id and c.code is null;
alter table public.clients alter column code set not null;

-- ───────── 2. a login can belong to several clinics ─────────
create table public.profile_clients (
  profile_id uuid not null references public.profiles on delete cascade,
  client_id uuid not null references public.clients on delete cascade,
  added_at timestamptz not null default now(),
  primary key (profile_id, client_id)
);
alter table public.profile_clients enable row level security;
create policy owner_all on public.profile_clients for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
create policy own_read on public.profile_clients for select to authenticated using (profile_id = (select auth.uid()));
insert into public.profile_clients (profile_id, client_id) select id, client_id from public.profiles where client_id is not null on conflict do nothing;

-- ───────── 3. which service each point belongs to ─────────
do $do$
declare t text;
begin
  foreach t in array array['updates','issues','decisions','meeting_items','requests','deliverables','strategies','cycles'] loop
    execute format('alter table public.%I add column service_id uuid references public.project_services on delete set null', t);
    execute format('create index on public.%I (service_id)', t);
  end loop;
end $do$;

-- ───────── 4. hours a month (private) ─────────
alter table public.fee_private add column hours_month numeric(6,1) check (hours_month >= 0);

-- ───────── 5. clients see only client actions in the activity record ─────────
alter policy member_read on public.audit_log using (
  (client_visible and project_id is not null and actor_role = 'client' and private.is_member(project_id))
  or actor_id = (select auth.uid())
);

notify pgrst, 'reload schema';
