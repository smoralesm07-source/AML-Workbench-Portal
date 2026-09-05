alter table public.atlas_v2_session_grant
  add column if not exists v2_user_id uuid;

create or replace function atlas_v2_private.cleanup_e2e_federated_principals()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  target_emails text[];
  target_ids uuid[];
  removed integer := 0;
begin
  select array_agg(g.email), array_agg(g.v2_user_id)
    into target_emails, target_ids
  from public.atlas_v2_session_grant g
  where g.expires_at < now()
    and g.email like 'atlas-v2-e2e-%@example.invalid';

  if target_emails is null or cardinality(target_emails) = 0 then
    return 0;
  end if;

  delete from public.aml_allowed_users u
  where u.email = any(target_emails)
    and coalesce(u.notes, '') like 'federated:ldmtlwzqaqmegedktlxr:%';

  delete from public.atlas_v2_session_grant g
  where g.email = any(target_emails);
  get diagnostics removed = row_count;

  if target_ids is not null then
    delete from auth.users u
    where u.id = any(target_ids)
      and lower(coalesce(u.email, '')) like 'atlas-v2-e2e-%@example.invalid';
  end if;

  return removed;
end;
$$;

revoke all on function atlas_v2_private.cleanup_e2e_federated_principals() from public, anon, authenticated;
grant execute on function atlas_v2_private.cleanup_e2e_federated_principals() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'atlas-v2-e2e-mirror-cleanup') then
    perform cron.unschedule('atlas-v2-e2e-mirror-cleanup');
  end if;
  perform cron.schedule(
    'atlas-v2-e2e-mirror-cleanup',
    '* * * * *',
    $cmd$select atlas_v2_private.cleanup_e2e_federated_principals();$cmd$
  );
end $$;
