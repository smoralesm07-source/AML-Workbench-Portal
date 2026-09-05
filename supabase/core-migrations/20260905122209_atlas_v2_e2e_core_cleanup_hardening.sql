create or replace function atlas_v2_ci.cleanup_expired_principals()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row record;
  v_deleted integer := 0;
  v_orphan_deleted integer := 0;
begin
  for v_row in
    select user_id
    from public.atlas_v2_e2e_principal
    where expires_at <= now()
  loop
    delete from public.aml_allowed_users where user_id = v_row.user_id;
    delete from auth.users where id = v_row.user_id;
    delete from public.atlas_v2_e2e_principal where user_id = v_row.user_id;
    v_deleted := v_deleted + 1;
  end loop;

  delete from public.aml_allowed_users a
  using auth.users u
  where a.user_id = u.id
    and u.email ~ '^atlas-v2-e2e-[a-z0-9-]+@example\.invalid$'
    and u.created_at <= now() - interval '30 minutes'
    and not exists (
      select 1
      from public.atlas_v2_e2e_principal p
      where p.user_id = u.id
        and p.expires_at > now()
    );

  with removed as (
    delete from auth.users u
    where u.email ~ '^atlas-v2-e2e-[a-z0-9-]+@example\.invalid$'
      and u.created_at <= now() - interval '30 minutes'
      and not exists (
        select 1
        from public.atlas_v2_e2e_principal p
        where p.user_id = u.id
          and p.expires_at > now()
      )
    returning u.id
  )
  select count(*)::integer into v_orphan_deleted from removed;

  return v_deleted + v_orphan_deleted;
end;
$$;

revoke all on function atlas_v2_ci.cleanup_expired_principals() from public, anon, authenticated;
grant execute on function atlas_v2_ci.cleanup_expired_principals() to service_role;
