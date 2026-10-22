-- Business and tax details. GST is charged only when the business has a GSTIN, and then on every project
-- unless that project is switched off. Without a GSTIN no GST is charged: the client pays directly.
create table public.business_settings (
  id boolean primary key default true check (id),
  company_name text check (length(company_name) <= 200),
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  address text check (length(address) <= 1000),
  gst_rate numeric(4,2) not null default 18 check (gst_rate between 0 and 28),
  updated_at timestamptz not null default now()
);
insert into public.business_settings (id) values (true);
alter table public.business_settings enable row level security;
create policy owner_all on public.business_settings for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
-- Clients see the business name and GSTIN (they appear on every invoice anyway)
create policy signed_in_read on public.business_settings for select to authenticated using (true);

alter table public.projects add column gst_applies boolean not null default true;

notify pgrst, 'reload schema';
