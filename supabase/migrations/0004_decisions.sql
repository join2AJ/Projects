-- Meeting decision checklist: the admin asks, the client answers Yes / No / Other, the admin closes with the outcome.
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  meeting_on date,                -- groups the checklist by meeting
  question text not null,
  details text,                   -- background the client needs to answer
  recommendation text,            -- what Ajay recommends
  due_on date,
  sort int not null default 0,
  client_visible boolean not null default false,  -- draft until sent to the client
  answer text check (answer in ('yes','no','other')),
  answer_note text check (length(answer_note) <= 2000),
  answered_by uuid references auth.users on delete set null,
  answered_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  outcome text,                   -- final decision recorded by the admin
  created_at timestamptz not null default now()
);
create index on public.decisions (project_id, meeting_on, sort);
create index on public.decisions (answered_by);

alter table public.decisions enable row level security;
create policy owner_all on public.decisions for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy member_read on public.decisions for select to authenticated
  using (client_visible and private.is_member(project_id));

-- Clients change only their answer, only on sent and still-open items, through this function.
create or replace function public.answer_decision(decision uuid, choice text, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.decisions;
begin
  select * into d from public.decisions where id = decision;
  if d.id is null or not d.client_visible or not private.is_member(d.project_id) then
    raise exception 'Decision not found';
  end if;
  if d.status = 'closed' then raise exception 'This decision is already closed'; end if;
  if choice is not null and choice not in ('yes','no','other') then raise exception 'Answer must be yes, no or other'; end if;
  if choice = 'other' and coalesce(btrim(note), '') = '' then raise exception 'Please say what you would like instead'; end if;
  update public.decisions
     set answer = choice, answer_note = nullif(btrim(note), ''),
         answered_by = case when choice is null then null else (select auth.uid()) end,
         answered_at = case when choice is null then null else now() end
   where id = decision;
end $$;
revoke execute on function public.answer_decision(uuid, text, text) from public, anon;
grant execute on function public.answer_decision(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
