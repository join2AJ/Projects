-- The client can approve or price finished work too (e.g. an audit already delivered); only stopped or declined
-- services are closed. Same function as 0008 otherwise.

create or replace function public.respond_fee(service uuid, choice text, amount numeric default null, note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.project_services;
begin
  select * into s from public.project_services where id = service;
  if s.id is null or not s.client_visible or not private.is_member(s.project_id) then raise exception 'Service not found'; end if;
  if s.status in ('Declined','Stopped') then raise exception 'This fee can no longer be changed'; end if;
  if choice = 'approved' then
    update public.project_services set client_response = 'approved', client_offer = null, client_note = nullif(btrim(respond_fee.note), ''),
      client_response_at = now(), status = case when status = 'Proposed' then 'Agreed' else status end where id = service;
  elsif choice = 'offer' then
    if amount is null or amount <= 0 then raise exception 'Enter the fee you propose'; end if;
    update public.project_services set client_response = 'offer', client_offer = round(amount, 2), client_note = nullif(btrim(respond_fee.note), ''),
      client_response_at = now() where id = service;
  else raise exception 'Choose approve or offer';
  end if;
end $$;
