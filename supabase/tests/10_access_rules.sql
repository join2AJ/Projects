-- Access-rule checks. Run against a scratch Postgres after 00_supabase_stub.sql, the migration and the seed.
-- Expected: client sees only its project and client-visible rows; stranger and anon see nothing.
\set ON_ERROR_STOP 0
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-000000000001','Join2AjKumar@gmail.com'),
 ('00000000-0000-0000-0000-000000000002','doc@example.com'),
 ('00000000-0000-0000-0000-000000000003','stranger@example.com');
insert into public.project_members (project_id,email) select id,'doc@example.com' from projects;
insert into public.projects (slug,name) values ('other-project','Other');
insert into public.updates (project_id,title) select id,'other secret' from projects where slug='other-project';
select email,is_owner from profiles order by email;

create function pg_temp.as_user(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-00000000000'||n,
    'email', case n when 1 then 'join2ajkumar@gmail.com' when 2 then 'Doc@Example.com' else 'stranger@example.com' end)::text, false);
end $$;

\echo '--- OWNER'
select pg_temp.as_user(1); set role authenticated;
select (select count(*) from projects) projects,(select count(*) from updates) updates,(select count(*) from invoices) invoices,(select count(*) from time_entries) time;
reset role;

\echo '--- CLIENT (doc, email in different case)'
select pg_temp.as_user(2); set role authenticated;
select (select count(*) from projects) projects,(select count(*) from updates) updates,(select count(*) from issues) issues,(select count(*) from invoices) invoices,(select count(*) from time_entries) time,(select count(*) from metrics) metrics,(select count(*) from profiles) profiles,(select count(*) from clients) clients;
\echo 'client: insert request on own project (expect INSERT 0 1)'
insert into requests (project_id,details) select id,'Add Lucknow page' from projects where slug='tailbone-treatment';
\echo 'client: request on other project (expect RLS error)'
insert into requests (project_id,details) values ((select id from public.projects where slug='other-project'),'x');
\echo 'client: forge status done (expect RLS error)'
insert into requests (project_id,details,status) select id,'x','done' from projects where slug='tailbone-treatment';
\echo 'client: edit issue (expect UPDATE 0)'
update issues set status='resolved';
\echo 'client: add update (expect RLS error)'
insert into updates (project_id,title) select id,'hack' from projects;
\echo 'client: add self to other project (expect RLS error)'
insert into project_members (project_id,email) values ((select id from public.projects where slug='other-project'),'doc@example.com');
\echo 'client: upload to own project folder (expect INSERT 0 1)'
insert into storage.objects (bucket_id,name) select 'project-files', id||'/a.pdf' from projects where slug='tailbone-treatment';
\echo 'client: upload to other folder (expect RLS error)'
insert into storage.objects (bucket_id,name) values ('project-files', (select id from public.projects where slug='other-project')||'/b.pdf');
\echo 'client: read objects (file row not created yet, expect 0)'
select count(*) from storage.objects;
reset role;

\echo '--- owner sends invoice; client then sees it'
update invoices set status='sent';
select pg_temp.as_user(2); set role authenticated;
select number,status from invoices;
\echo 'client: request rows author'
select author_email, created_by is not null as has_creator, status from requests;
reset role;

\echo '--- STRANGER'
select pg_temp.as_user(3); set role authenticated;
select (select count(*) from projects) projects,(select count(*) from updates) updates,(select count(*) from requests) requests,(select count(*) from invoices) invoices;
insert into requests (project_id,details) select id,'x' from public.projects;
reset role;

\echo '--- ANON'
set role anon;
select count(*) from projects;
reset role;
