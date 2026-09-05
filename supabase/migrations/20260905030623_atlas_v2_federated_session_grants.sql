create table if not exists public.atlas_v2_session_grant (
  email text primary key,
  core_user_id uuid not null,
  core_role text not null,
  source_project text not null default 'ldmtlwzqaqmegedktlxr',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint atlas_v2_session_grant_email_lower check (email = lower(email)),
  constraint atlas_v2_session_grant_source check (source_project = 'ldmtlwzqaqmegedktlxr'),
  constraint atlas_v2_session_grant_ttl check (expires_at > issued_at and expires_at <= issued_at + interval '15 minutes')
);

alter table public.atlas_v2_session_grant enable row level security;
revoke all on table public.atlas_v2_session_grant from public, anon, authenticated;
grant select on table public.atlas_v2_session_grant to authenticated;
grant all on table public.atlas_v2_session_grant to service_role;

create policy atlas_v2_session_grant_read_own_active
on public.atlas_v2_session_grant
for select
to authenticated
using (
  email = lower(coalesce((select auth.jwt())->>'email',''))
  and expires_at > now()
);

create index if not exists atlas_v2_session_grant_expires_idx
  on public.atlas_v2_session_grant (expires_at);

create or replace function public.atlas_v2_is_session_granted()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.atlas_v2_session_grant g
       where g.email = lower(coalesce((select auth.jwt())->>'email',''))
         and g.expires_at > now()
     );
$$;
revoke all on function public.atlas_v2_is_session_granted() from public, anon;
grant execute on function public.atlas_v2_is_session_granted() to authenticated, service_role;

create or replace function atlas_v2_private.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.aml_allowed_users u
       where u.email = lower(coalesce((select auth.jwt())->>'email',''))
         and u.enabled
     )
     and exists (
       select 1
       from public.atlas_v2_session_grant g
       where g.email = lower(coalesce((select auth.jwt())->>'email',''))
         and g.expires_at > now()
     );
$$;

alter policy atlas_v2_model_head_allowed on public.atlas_v2_model_head
using ((select public.aml_is_allowed()) and (select public.atlas_v2_is_session_granted()));

alter policy atlas_v2_read_model_allowed on public.atlas_v2_read_model
using ((select public.aml_is_allowed()) and (select public.atlas_v2_is_session_granted()));

alter policy atlas_v2_client_event_insert_own on public.atlas_v2_client_event
with check (
  user_id = (select auth.uid())
  and (select public.aml_is_allowed())
  and (select public.atlas_v2_is_session_granted())
);

do $$
begin
  if exists (select 1 from cron.job where jobname='atlas-v2-session-grant-retention') then
    perform cron.unschedule('atlas-v2-session-grant-retention');
  end if;
  perform cron.schedule(
    'atlas-v2-session-grant-retention',
    '17 * * * *',
    $cmd$delete from public.atlas_v2_session_grant where expires_at < now() - interval '1 day'$cmd$
  );
end $$;
