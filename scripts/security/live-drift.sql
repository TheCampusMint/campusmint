-- CHECKPOINT SEC-DB-LIVE: READ ONLY. Run in the Supabase SQL editor or a protected
-- psql connection after staging migrations 028–030. No account rows or secrets return.
begin read only;

-- Any result means an exposed application table is missing RLS.
select n.nspname as schema, c.relname as table_name, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;

-- Any result means browser mutations bypass the intended API-only boundary.
select c.relname as table_name, r.rolname as role,
  has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as table_write,
  has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES') as column_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
where n.nspname='public' and c.relkind in ('r','p') and r.rolname in ('anon','authenticated')
  and (has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES'));

-- Compare this full effective policy inventory with repository migrations.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select table_name, grantee, privilege_type from information_schema.table_privileges
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated','service_role')
order by table_name,grantee,privilege_type;
select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
where table_schema='public' and grantee in ('PUBLIC','anon','authenticated') order by table_name,column_name,grantee;

-- Security-definer RPCs must have safe search paths and no unexpected EXECUTE.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer, p.proconfig as settings,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.proname,arguments;
select c.relname as view_name,c.reloptions,
  has_table_privilege('anon',c.oid,'SELECT') as anon_read,
  has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_read
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v' order by c.relname;
select pg_get_userbyid(defaclrole) as owner, coalesce(n.nspname,'ALL') as schema,
  defaclobjtype,defaclacl from pg_default_acl a left join pg_namespace n on n.oid=a.defaclnamespace;
select rolname,has_schema_privilege(rolname,'public','CREATE') as public_create
from pg_roles where rolname in ('anon','authenticated');

-- Private buckets must stay private. Storage bytes need independent backups.
select id,public,file_size_limit,allowed_mime_types from storage.buckets
where id in ('avatars','mint-media','message-media','mint-archive') order by id;
select pubname,schemaname,tablename from pg_publication_tables
where pubname='supabase_realtime' order by schemaname,tablename;

-- Report object existence without reading private payloads or actor identities.
select to_regclass('public.security_rate_limits') is not null as limiter_present,
  to_regclass('public.security_audit_events') is not null as audit_present,
  to_regclass('public.security_administrators') is not null as administrators_present,
  to_regclass('public.place_identity') is not null as places_present,
  to_regclass('public.native_auth_sessions') is not null as native_sessions_present,
  to_regclass('public.native_attest_keys') is not null as native_keys_present,
  to_regclass('public.native_attest_challenges') is not null as native_challenges_present;

-- Explicit native/Places private boundary. All browser booleans must be false;
-- service CRUD is deliberately narrower than blanket ALL on these relations.
select c.relname as table_name,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anonymous_access,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as client_access,
  has_table_privilege('service_role',c.oid,'INSERT') as service_insert,
  has_table_privilege('service_role',c.oid,'UPDATE') as service_update,
  has_table_privilege('service_role',c.oid,'DELETE') as service_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
  'place_identity','place_areas','place_saves','place_student_reviews','place_student_photos',
  'native_auth_sessions','native_attest_keys','native_attest_challenges')
order by c.relname;
-- Counts only: legacy orphan remediation must be reviewed before FK validation.
select 'community_submissions' as table_name, count(*) as orphan_count from public.community_submissions row
where submitted_by is not null and not exists(select 1 from auth.users account where account.id=row.submitted_by)
union all select 'community_submission_confirmations', count(*) from public.community_submission_confirmations row
where not exists(select 1 from auth.users account where account.id=row.user_id)
union all select 'campus_reviews', count(*) from public.campus_reviews row
where reviewer_user_id is not null and not exists(select 1 from auth.users account where account.id=row.reviewer_user_id);
rollback;
