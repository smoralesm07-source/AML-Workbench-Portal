-- ATLAS OSFL National Monitor 0.93.0
-- Additive architecture: national legal universe -> Atlas observability -> Law 19.913 bridge.

create table if not exists public.aml_osfl_registry_source_snapshot (
  snapshot_date date primary key,
  official_active_total integer not null check (official_active_total >= 0),
  source_name text not null,
  source_url text not null,
  evidence_url text,
  ingestion_status text not null default 'REFERENCE_ONLY' check (ingestion_status in ('REFERENCE_ONLY','PARTIAL','COMPLETE')),
  ingested_row_count integer not null default 0 check (ingested_row_count >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aml_osfl_registry_master (
  registry_number text primary key,
  legal_name text not null,
  rut text,
  origin text,
  commune text,
  region text,
  address text,
  organization_type text,
  classification text,
  grant_date date,
  registration_date date,
  legal_status text,
  is_active boolean,
  source_snapshot_date date not null,
  source_file_name text,
  source_record_hash text,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aml_osfl_registry_entity_link (
  registry_number text not null references public.aml_osfl_registry_master(registry_number) on delete cascade,
  entity_id text not null,
  rut text,
  match_status text not null check (match_status in ('MATCH_EXACT','MATCH_HIGH','MATCH_PROBABLE','UNMATCHED','REJECTED')),
  match_method text not null,
  match_confidence numeric(5,4) check (match_confidence between 0 and 1),
  review_status text not null default 'AUTO' check (review_status in ('AUTO','PENDING_REVIEW','CONFIRMED','REJECTED')),
  match_basis jsonb not null default '{}'::jsonb,
  linked_at timestamptz not null default now(),
  reviewed_at timestamptz,
  primary key (registry_number, entity_id)
);

create index if not exists aml_osfl_registry_master_rut_norm_idx
  on public.aml_osfl_registry_master ((regexp_replace(upper(coalesce(rut,'')), '[^0-9K]', '', 'g')));
create index if not exists aml_osfl_registry_master_region_idx on public.aml_osfl_registry_master(region);
create index if not exists aml_osfl_registry_master_type_idx on public.aml_osfl_registry_master(organization_type);
create index if not exists aml_osfl_registry_master_status_idx on public.aml_osfl_registry_master(is_active, legal_status);
create index if not exists aml_osfl_registry_master_name_trgm_idx on public.aml_osfl_registry_master using gin (legal_name gin_trgm_ops);
create index if not exists aml_osfl_registry_link_entity_idx on public.aml_osfl_registry_entity_link(entity_id);
create index if not exists aml_osfl_registry_link_status_idx on public.aml_osfl_registry_entity_link(match_status, review_status);
create index if not exists aml_osfl_runtime_rut_norm_0930_idx on public.aml_osfl_entity_runtime_snapshot ((regexp_replace(upper(coalesce(rut,'')), '[^0-9K]', '', 'g')));
create index if not exists aml_uaf_obligated_rut_norm_0930_idx on public.aml_uaf_obligated_subject_snapshot ((regexp_replace(upper(coalesce(rut,'')), '[^0-9K]', '', 'g')));

alter table public.aml_osfl_registry_source_snapshot enable row level security;
alter table public.aml_osfl_registry_master enable row level security;
alter table public.aml_osfl_registry_entity_link enable row level security;

drop policy if exists aml_osfl_registry_source_authorized_select on public.aml_osfl_registry_source_snapshot;
create policy aml_osfl_registry_source_authorized_select on public.aml_osfl_registry_source_snapshot
for select to authenticated using (
  exists (select 1 from public.aml_allowed_users au where au.user_id = (select auth.uid()) and au.enabled)
);

drop policy if exists aml_osfl_registry_master_authorized_select on public.aml_osfl_registry_master;
create policy aml_osfl_registry_master_authorized_select on public.aml_osfl_registry_master
for select to authenticated using (
  exists (select 1 from public.aml_allowed_users au where au.user_id = (select auth.uid()) and au.enabled)
);

drop policy if exists aml_osfl_registry_link_authorized_select on public.aml_osfl_registry_entity_link;
create policy aml_osfl_registry_link_authorized_select on public.aml_osfl_registry_entity_link
for select to authenticated using (
  exists (select 1 from public.aml_allowed_users au where au.user_id = (select auth.uid()) and au.enabled)
);

grant select on public.aml_osfl_registry_source_snapshot, public.aml_osfl_registry_master, public.aml_osfl_registry_entity_link to authenticated;

insert into public.aml_osfl_registry_source_snapshot (
  snapshot_date, official_active_total, source_name, source_url, evidence_url, ingestion_status, ingested_row_count, notes
) values (
  date '2025-08-31',
  363703,
  'Servicio de Registro Civil e Identificación · Registro Nacional de Personas Jurídicas sin Fines de Lucro',
  'https://www.registrocivil.cl/principal/nuestras-oficinas/portal-registro-nacional-de-personas-juridicas-sin-fines-de-lucro',
  'https://organizacionessociales.gob.cl/wp-content/uploads/2026/02/Informe-Final-Mujeres-que-Sostienen.pdf',
  'REFERENCE_ONLY',
  0,
  'Total oficial de organizaciones vigentes informado por la División de Organizaciones Sociales a partir de descarga del Registro Civil al 31-08-2025. La carga fila a fila queda separada del total de referencia para no confundir cobertura con vigencia jurídica.'
) on conflict (snapshot_date) do update set
  official_active_total = excluded.official_active_total,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  evidence_url = excluded.evidence_url,
  notes = excluded.notes,
  updated_at = now();

create or replace view public.aml_v_osfl_law19913_bridge_current
with (security_invoker = true)
as
select
  o.entity_id,
  o.rut,
  o.name,
  o.region,
  o.commune,
  o.activity_group,
  o.source_count,
  o.coverage_index_pct,
  o.score_confidence_pct,
  o.ipa3_score,
  o.priority_band_shadow,
  o.fatf_r8_candidate,
  case
    when so.rut is not null then 'DIRECT_OBLIGATED'
    when pot.rut is not null then 'POTENTIAL_SUBJECT'
    when coalesce(o.ipa3_score,0) > 0 then 'AML_ANALYTIC_SIGNAL'
    when coalesce(o.fatf_r8_candidate,false) then 'FATF_R8_CONTEXT'
    else 'GENERAL_OSFL'
  end as bridge_class,
  case
    when so.rut is not null then 1
    when pot.rut is not null then 2
    when coalesce(o.ipa3_score,0) > 0 then 3
    when coalesce(o.fatf_r8_candidate,false) then 4
    else 5
  end as bridge_rank,
  case
    when so.rut is not null then 'SO UAF registrado'
    when pot.rut is not null then 'Potencial sujeto 19.913'
    when coalesce(o.ipa3_score,0) > 0 then 'Señal analítica AML'
    when coalesce(o.fatf_r8_candidate,false) then 'Contexto FATF R.8'
    else 'OSFL general'
  end as bridge_label,
  case
    when so.rut is not null then 'Coincidencia exacta de identidad con el universo de sujetos obligados UAF; describe condición registral, no riesgo ni incumplimiento.'
    when pot.rut is not null then 'Coincidencia con el universo Atlas de potenciales sujetos; requiere revisión de actividad y evidencia antes de concluir aplicabilidad de la Ley 19.913.'
    when coalesce(o.ipa3_score,0) > 0 then 'Presenta señales analíticas Atlas; no implica por sí misma calidad de sujeto obligado ni actividad ilícita.'
    when coalesce(o.fatf_r8_candidate,false) then 'Cumple criterios funcionales de contexto para Recomendación 8; esta condición no puntúa por sí sola ni constituye una señal adversa.'
    else 'Sin evidencia actual de relación directa con el universo 19.913 en las fuentes disponibles.'
  end as bridge_semantics,
  so.uaf_sector_canonical as direct_uaf_sector,
  so.uaf_sector as direct_uaf_sector_raw,
  so.subject_nature as direct_subject_nature,
  pot.implied_sector as potential_uaf_sector,
  pot.evidence_class as potential_evidence_class,
  pot.detection_tier as potential_detection_tier,
  pot.is_actionable as potential_is_actionable,
  pot.ivo_score as potential_ivo_score,
  pot.materiality_score as potential_materiality_score,
  o.refreshed_at
from public.aml_osfl_entity_runtime_snapshot o
left join public.aml_uaf_obligated_subject_snapshot so
  on regexp_replace(upper(coalesce(so.rut,'')), '[^0-9K]', '', 'g') = regexp_replace(upper(coalesce(o.rut,'')), '[^0-9K]', '', 'g')
left join public.aml_uaf_potential_subject_snapshot pot
  on regexp_replace(upper(coalesce(pot.rut,'')), '[^0-9K]', '', 'g') = regexp_replace(upper(coalesce(o.rut,'')), '[^0-9K]', '', 'g');

grant select on public.aml_v_osfl_law19913_bridge_current to authenticated;

create or replace view public.aml_v_osfl_national_monitor_current
with (security_invoker = true)
as
with latest_ref as (
  select * from public.aml_osfl_registry_source_snapshot order by snapshot_date desc limit 1
), registry_live as (
  select
    count(*)::bigint as loaded_rows,
    count(*) filter (where coalesce(is_active, upper(coalesce(legal_status,''))='VIGENTE'))::bigint as loaded_active,
    count(*) filter (where nullif(regexp_replace(upper(coalesce(rut,'')), '[^0-9K]', '', 'g'),'') is not null)::bigint as loaded_with_rut
  from public.aml_osfl_registry_master
), observed as (
  select
    count(*)::bigint as atlas_observed,
    count(*) filter (where source_count >= 2)::bigint as enriched_2plus,
    count(*) filter (where coverage_index_pct >= 70)::bigint as evidence_coverage_70plus,
    max(refreshed_at) as atlas_refreshed_at
  from public.aml_osfl_entity_runtime_snapshot
), bridge as (
  select
    count(*) filter (where bridge_class='DIRECT_OBLIGATED')::bigint as direct_obligated,
    count(*) filter (where bridge_class='POTENTIAL_SUBJECT')::bigint as potential_subject,
    count(*) filter (where bridge_class='AML_ANALYTIC_SIGNAL')::bigint as aml_analytic_signal,
    count(*) filter (where bridge_class='FATF_R8_CONTEXT')::bigint as fatf_r8_context,
    count(*) filter (where bridge_class='GENERAL_OSFL')::bigint as general_osfl
  from public.aml_v_osfl_law19913_bridge_current
)
select
  r.snapshot_date as legal_snapshot_date,
  r.official_active_total::bigint as official_active_total,
  rl.loaded_rows,
  rl.loaded_active,
  rl.loaded_with_rut,
  case when r.ingestion_status='COMPLETE' and rl.loaded_active>0 then rl.loaded_active else r.official_active_total::bigint end as legal_universe_count,
  r.ingestion_status,
  r.source_name,
  r.source_url,
  r.evidence_url,
  o.atlas_observed,
  o.enriched_2plus,
  o.evidence_coverage_70plus,
  b.direct_obligated,
  b.potential_subject,
  (b.direct_obligated+b.potential_subject)::bigint as law19913_bridge_total,
  b.aml_analytic_signal,
  b.fatf_r8_context,
  b.general_osfl,
  round(100.0*o.atlas_observed/nullif(case when r.ingestion_status='COMPLETE' and rl.loaded_active>0 then rl.loaded_active else r.official_active_total::bigint end,0),2) as atlas_legal_coverage_pct,
  round(100.0*o.enriched_2plus/nullif(o.atlas_observed,0),2) as enriched_pct_observed,
  round(100.0*(b.direct_obligated+b.potential_subject)/nullif(o.atlas_observed,0),2) as law19913_bridge_pct_observed,
  o.atlas_refreshed_at,
  now() as monitor_refreshed_at
from latest_ref r cross join registry_live rl cross join observed o cross join bridge b;

grant select on public.aml_v_osfl_national_monitor_current to authenticated;

create or replace view public.aml_v_osfl_national_region_current
with (security_invoker = true)
as
with legal as (
  select region, count(*)::bigint as legal_loaded
  from public.aml_osfl_registry_master
  where coalesce(is_active, upper(coalesce(legal_status,''))='VIGENTE')
  group by region
), observed as (
  select region, count(*)::bigint as atlas_observed
  from public.aml_osfl_entity_runtime_snapshot
  group by region
), bridge as (
  select region,
    count(*) filter (where bridge_class='DIRECT_OBLIGATED')::bigint as direct_obligated,
    count(*) filter (where bridge_class='POTENTIAL_SUBJECT')::bigint as potential_subject,
    count(*) filter (where bridge_class='AML_ANALYTIC_SIGNAL')::bigint as aml_analytic_signal
  from public.aml_v_osfl_law19913_bridge_current
  group by region
)
select
  coalesce(l.region,o.region,b.region,'SIN_REGION') as region,
  l.legal_loaded,
  coalesce(o.atlas_observed,0)::bigint as atlas_observed,
  coalesce(b.direct_obligated,0)::bigint as direct_obligated,
  coalesce(b.potential_subject,0)::bigint as potential_subject,
  coalesce(b.aml_analytic_signal,0)::bigint as aml_analytic_signal,
  case when coalesce(l.legal_loaded,0)>0 then round(100.0*coalesce(o.atlas_observed,0)/l.legal_loaded,2) end as atlas_coverage_pct
from legal l
full join observed o on o.region is not distinct from l.region
full join bridge b on b.region is not distinct from coalesce(l.region,o.region);

grant select on public.aml_v_osfl_national_region_current to authenticated;

comment on table public.aml_osfl_registry_master is 'Padrón jurídico vigente/corriente de PJSFL del Registro Civil. Fuente maestra del universo legal; no implica actividad económica ni riesgo AML.';
comment on view public.aml_v_osfl_law19913_bridge_current is 'Puente analítico OSFL hacia Ley 19.913. Las clases son contexto de aplicabilidad/evidencia, no inferencias de ilicitud.';
comment on view public.aml_v_osfl_national_monitor_current is 'Embudo nacional OSFL: universo jurídico oficial, cobertura Atlas, enriquecimiento y relación trazable con universos 19.913.';
