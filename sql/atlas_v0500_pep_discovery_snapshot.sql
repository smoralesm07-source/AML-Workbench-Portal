-- ATLAS AML v0.50.0 · Personas, PEP, propiedad y compras
-- Snapshot privado de solo lectura para el frontend autenticado.
-- La escritura del payload corresponde exclusivamente al pipeline gobernado
-- (service role / backend). El navegador nunca recibe privilegios de INSERT,
-- UPDATE o DELETE sobre esta tabla.

create table if not exists public.aml_pep_discovery_snapshot (
  snapshot_key text primary key,
  schema_version text not null,
  payload jsonb not null,
  source_generated_at timestamptz null,
  source_run text null,
  source_sha256 text null,
  coverage_status text null,
  ingested_at timestamptz not null default now(),
  constraint aml_pep_discovery_snapshot_latest_key
    check (snapshot_key = 'latest'),
  constraint aml_pep_discovery_snapshot_schema
    check (schema_version = 'ATLAS_PEP_DISCOVERY_LATEST_V1')
);

alter table public.aml_pep_discovery_snapshot enable row level security;

-- Denegación por defecto: anon no debe poder observar el universo persona–empresa.
-- authenticated recupera únicamente SELECT y queda sujeto a RLS.
revoke all on table public.aml_pep_discovery_snapshot from anon, authenticated;
grant select on table public.aml_pep_discovery_snapshot to authenticated;

drop policy if exists aml_pep_discovery_enabled_users_read
  on public.aml_pep_discovery_snapshot;

create policy aml_pep_discovery_enabled_users_read
on public.aml_pep_discovery_snapshot
for select
to authenticated
using (
  exists (
    select 1
    from public.aml_allowed_users u
    where u.user_id = (select auth.uid())
      and u.enabled = true
  )
);

comment on table public.aml_pep_discovery_snapshot is
  'ATLAS AML v0.50.0 private latest snapshot for PEP/beneficial ownership/public procurement analytical discovery. Read-only from authenticated browser under RLS; writes are backend-only.';
comment on column public.aml_pep_discovery_snapshot.payload is
  'ATLAS_PEP_DISCOVERY_LATEST_V1. PEP/BF/procurement analytical context; PEP is not adverse and triage is not an AML risk score.';
