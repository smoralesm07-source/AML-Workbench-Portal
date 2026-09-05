-- ATLAS Architecture v2 hardening
-- Minimal privileges for service worker and authenticated telemetry inserts.

grant usage on schema atlas_v2_private to service_role;
grant usage on sequence public.atlas_v2_client_event_event_id_seq to authenticated, service_role;

create index if not exists atlas_v2_client_event_time_idx
  on public.atlas_v2_client_event(event_at desc);

select cron.schedule(
  'atlas-v2-telemetry-retention',
  '20 3 * * *',
  $$delete from public.atlas_v2_client_event where event_at < now() - interval '30 days';$$
);
