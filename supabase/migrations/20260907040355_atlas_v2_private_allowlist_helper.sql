-- ATLAS v2 launch hardening: keep SECURITY DEFINER authorization helpers
-- outside the exposed public schema while preserving the existing RLS contract.

create schema if not exists atlas_v2_private;
revoke all on schema atlas_v2_private from public, anon;
grant usage on schema atlas_v2_private to authenticated, service_role;

create or replace function atlas_v2_private.aml_is_allowed()
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select exists (
    select 1
    from public.aml_allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email',''))
      and enabled
  );
$function$;

revoke all on function atlas_v2_private.aml_is_allowed() from public, anon;
grant execute on function atlas_v2_private.aml_is_allowed() to authenticated, service_role;

DO $migration$
DECLARE
  r record;
  stmt text;
  new_qual text;
  new_check text;
BEGIN
  FOR r IN
    select schemaname,tablename,policyname,qual,with_check
    from pg_policies
    where coalesce(qual,'') like '%aml_is_allowed()%'
       or coalesce(with_check,'') like '%aml_is_allowed()%'
    order by schemaname,tablename,policyname
  LOOP
    new_qual := case when r.qual is null then null else replace(r.qual,'aml_is_allowed()','atlas_v2_private.aml_is_allowed()') end;
    new_check := case when r.with_check is null then null else replace(r.with_check,'aml_is_allowed()','atlas_v2_private.aml_is_allowed()') end;
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if new_qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
  END LOOP;
END
$migration$;

revoke all on function public.aml_is_allowed() from public, anon, authenticated, service_role;
drop function public.aml_is_allowed();
