create or replace function public.atlas_v2_ingest_source_snapshot(
  p_source_key text,
  p_snapshot_id text,
  p_contract text,
  p_generated_at timestamptz,
  p_payload jsonb,
  p_source_versions jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
  select atlas_v2_private.ingest_source_snapshot(
    p_source_key,
    p_snapshot_id,
    p_contract,
    p_generated_at,
    p_payload,
    p_source_versions
  );
$$;

revoke all on function public.atlas_v2_ingest_source_snapshot(text,text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.atlas_v2_ingest_source_snapshot(text,text,text,timestamptz,jsonb,jsonb) to service_role;