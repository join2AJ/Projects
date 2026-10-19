-- Credentials and tool access, admin only. Passwords are stored encrypted in Supabase Vault (never in this
-- table) and can be read back only through credential_reveal(), which checks the admin and logs every view.

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade,   -- null = studio-wide
  tool text not null,                 -- e.g. Google Ads, GA4, Tag Manager, Hosting, Domain
  url text,
  username text,
  access_level text,                  -- e.g. Admin, Standard, Editor, Owner's login
  granted_by text,
  granted_on date,
  status text not null default 'active' check (status in ('active','pending','revoked')),
  notes text,
  secret_id uuid,                     -- vault.secrets id; the password itself is never stored here
  secret_set_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.credentials (project_id);
alter table public.credentials enable row level security;
create policy owner_all on public.credentials for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

create or replace function public.credential_set_secret(cred uuid, secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.credentials; a record; sid uuid;
begin
  if not private.is_owner() then raise exception 'Only the admin can store passwords'; end if;
  select * into c from public.credentials where id = cred;
  if c.id is null then raise exception 'Not found'; end if;
  if secret is null or length(secret) = 0 then raise exception 'Enter the password'; end if;
  if c.secret_id is null then
    sid := vault.create_secret(secret, 'credential-' || cred::text, c.tool);
    update public.credentials set secret_id = sid, secret_set_at = now(), updated_at = now() where id = cred;
  else
    perform vault.update_secret(c.secret_id, secret);
    update public.credentials set secret_set_at = now(), updated_at = now() where id = cred;
  end if;
  select * into a from private.actor();
  insert into public.audit_log (actor_id, actor_name, actor_role, action, table_name, row_id, project_id, summary)
  values (a.uid, a.name, a.role, 'secret.set', 'credentials', cred::text, c.project_id, format('Saved password for %s', c.tool));
end $$;

create or replace function public.credential_reveal(cred uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.credentials; a record; v text;
begin
  if not private.is_owner() then raise exception 'Only the admin can view passwords'; end if;
  select * into c from public.credentials where id = cred;
  if c.id is null or c.secret_id is null then raise exception 'No password stored'; end if;
  select decrypted_secret into v from vault.decrypted_secrets where id = c.secret_id;
  select * into a from private.actor();
  insert into public.audit_log (actor_id, actor_name, actor_role, action, table_name, row_id, project_id, summary)
  values (a.uid, a.name, a.role, 'secret.view', 'credentials', cred::text, c.project_id, format('Viewed password for %s', c.tool));
  return v;
end $$;

revoke execute on function public.credential_set_secret(uuid, text) from public, anon;
revoke execute on function public.credential_reveal(uuid) from public, anon;
grant execute on function public.credential_set_secret(uuid, text) to authenticated;
grant execute on function public.credential_reveal(uuid) to authenticated;

create trigger audit after insert or update or delete on public.credentials for each row execute function private.audit_row();

notify pgrst, 'reload schema';
