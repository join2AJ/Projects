-- The client's fee table shows the standard price next to their fee, so they see the discount.
-- Only the standard price is shared: the discount note and hours stay private. Clients only while fees are shown; the admin also in the preview.
create or replace function public.client_fee_standards(p uuid)
returns table (service_id uuid, list_price numeric)
language sql stable security definer set search_path = '' as $$
  select s.id, f.list_price
    from public.project_services s
    join public.fee_private f on f.project_service_id = s.id
    join public.projects pr on pr.id = s.project_id
   where s.project_id = p and s.client_visible
     and ((pr.money_open and private.is_member(p)) or (select private.is_owner()))
$$;
revoke execute on function public.client_fee_standards(uuid) from public, anon;
grant execute on function public.client_fee_standards(uuid) to authenticated;
