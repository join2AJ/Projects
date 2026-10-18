-- Policy helpers live outside the API schema so they are not callable as /rest/v1/rpc endpoints.
-- Policies reference functions by id, so moving them keeps every policy working.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_owner() set schema private;
alter function public.is_member(uuid) set schema private;
alter function public.handle_new_user() set schema private;
notify pgrst, 'reload schema';
