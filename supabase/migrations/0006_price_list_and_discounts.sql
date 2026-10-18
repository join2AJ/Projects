-- Price list (managed in the dashboard) and per-client discounts.
--
-- services: the catalogue every signed-in user may read (clients see the standard price, market range and
--           "why this price"). service_notes: the admin's private side (what changes the price, talking tips).
-- project_services gains list_price and discount_note: price stays the fee actually charged, so
--           list_price - price is the discount the client sees.

create table public.services (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  kind text not null check (kind in ('one-time','monthly','hourly')),
  avg_price numeric(12,2) not null check (avg_price >= 0),   -- your standard (typical) price, ex-GST
  market_low numeric(12,2),                                   -- what others typically charge, ex-GST
  market_high numeric(12,2),
  summary text,
  includes text,                                              -- one item per line
  why text,                                                   -- client-facing: why this much
  min_months int,
  sort int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (market_low is null or market_high is null or market_low <= market_high)
);

create table public.service_notes (
  service_id text primary key references public.services on delete cascade on update cascade,
  factors text,   -- what moves the price up or down
  tips text       -- how to explain it, where there is room to discount
);

alter table public.services enable row level security;
alter table public.service_notes enable row level security;
create policy owner_all on public.services for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy signed_in_read on public.services for select to authenticated using (active);
create policy owner_all on public.service_notes for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

alter table public.project_services
  add column list_price numeric(12,2) check (list_price is null or list_price >= 0),
  add column discount_note text;

notify pgrst, 'reload schema';
