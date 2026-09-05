create table if not exists public.atlas_v2_e2e_principal (
  user_id uuid primary key,
  email text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint atlas_v2_e2e_email_shape check (email ~ '^atlas-v2-e2e-[a-z0-9-]+@example\.invalid$'),
  constraint atlas_v2_e2e_ttl check (expires_at > created_at and expires_at <= created_at + interval '30 minutes')
);

alter table public.atlas_v2_e2e_principal enable row level security;
revoke all on table public.atlas_v2_e2e_principal from public, anon, authenticated;
grant all on table public.atlas_v2_e2e_principal to service_role;
create index if not exists atlas_v2_e2e_principal_expires_idx on public.atlas_v2_e2e_principal(expires_at);

create schema if not exists atlas_v2_ci;
revoke all on schema atlas_v2_ci from public, anon, authenticated;

create or replace function atlas_v2_ci.cleanup_expired_principals()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted integer := 0;
begin
  with expired as (
    select user_id from public.atlas_v2_e2e_principal where expires_at <= now()
  ), removed as (
    delete from public.aml_allowed_users a
    using expired e
    where a.user_id=e.user_id
    returning a.user_id
  )
  select count(*)::integer into v_deleted from removed;

  delete from public.atlas_v2_e2e_principal where expires_at <= now();
  return v_deleted;
end;
$$;
revoke all on function atlas_v2_ci.cleanup_expired_principals() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname='atlas-v2-e2e-principal-retention') then
    perform cron.unschedule('atlas-v2-e2e-principal-retention');
  end if;
  perform cron.schedule(
    'atlas-v2-e2e-principal-retention',
    '* * * * *',
    $cmd$select atlas_v2_ci.cleanup_expired_principals()$cmd$
  );
end $$;
