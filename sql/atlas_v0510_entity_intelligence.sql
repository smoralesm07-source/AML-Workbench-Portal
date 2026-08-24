-- ATLAS AML 0.51.0 · build 0510
-- Caracterización profunda de entidades: snapshots de lectura y restitución del
-- registro de disposición del lente 06.
--
-- Por qué existe este archivo
-- ---------------------------
-- La sección Entidades necesita tres bloques analíticos que ya están calculados
-- en el esquema pero que ninguna pantalla podía usar, porque consultarlos por
-- entidad recomputaba ventanas sobre decenas de miles de filas:
--
--   aml_v_ipa3_mark_scores_v0_4      3.393 ms por entidad
--   aml_v_ipa3_entity_score_v0_4     5.985 ms por entidad   (ya tenía snapshot)
--   aml_v_ipa3_sii_peer_benchmark      542 ms por entidad
--   aml_v_entity_relations           2.316 ms por entidad, para 20 filas totales
--
-- Medido sobre el corte del 24-08-2026 con explain analyze. Una ficha que abre
-- cuatro de estas consultas en paralelo tardaría más de seis segundos y dejaría
-- al planificador ordenando en disco, de modo que el dato existía pero era
-- inutilizable en pantalla.
--
-- Se sigue exactamente el patrón ya establecido en este esquema por
-- aml_ipa3_entity_score_snapshot_v0_4: tabla de sólo lectura, RLS con la misma
-- política de usuarios habilitados, función de refresco y disparo condicional
-- por pg_cron contra el sello de aml_sync_state.
--
-- Semántica deliberada
-- --------------------
-- - Un snapshot declara su propio corte en refreshed_at. La interfaz lo muestra:
--   una entidad ausente del snapshot se lee como "no materializada en el corte",
--   nunca como "sin marcas" ni como cero.
-- - Ninguna de estas tablas introduce cálculo nuevo. Copian la vista gobernada
--   vigente sin transformar valores, de modo que el snapshot no puede discrepar
--   semánticamente de la metodología.
-- - Los vínculos de identidad conservan requiere_revision. Un vínculo probable
--   por nombre normalizado sigue siendo candidato y no promueve identidad.

begin;

-- ---------------------------------------------------------------------------
-- 1. Marcas IPA3 v0.4-shadow por entidad
-- ---------------------------------------------------------------------------
create table if not exists public.aml_ipa3_mark_scores_snapshot_v0_4 (
  entity_id          text    not null,
  mark_id            text    not null,
  mark_name          text,
  semantic_class     text,
  primary_dimension  text,
  score_group        text,
  correlation_group  text,
  included_in_score  boolean,
  raw_intensity      numeric,
  standalone_cap     numeric,
  contribution       numeric,
  confidence         numeric,
  readiness          text,
  source_ids         text[],
  evidence           jsonb,
  score_version      text,
  refreshed_at       timestamptz not null default now(),
  primary key (entity_id, mark_id)
);

comment on table public.aml_ipa3_mark_scores_snapshot_v0_4 is
  'Copia de lectura de aml_v_ipa3_mark_scores_v0_4. Misma semántica, sin recálculo. Prioridad analítica, no probabilidad de LA/FT.';

create index if not exists aml_ipa3_mark_snapshot_entity_contrib_idx
  on public.aml_ipa3_mark_scores_snapshot_v0_4 (entity_id, contribution desc);

-- ---------------------------------------------------------------------------
-- 2. Posición frente a pares por año comercial
-- ---------------------------------------------------------------------------
create table if not exists public.aml_entity_peer_position_snapshot (
  entity_id             text not null,
  commercial_year       integer not null,
  peer_level            text,
  peer_n                bigint,
  size_bucket           text,
  age_bucket            text,
  sales_peer_percentile double precision,
  sales_band_code       text,
  sales_band_rank       smallint,
  sales_band_delta      smallint,
  prior_sales_band_rank smallint,
  workers_numeric       bigint,
  prior_workers_numeric bigint,
  workforce_ratio       numeric,
  entity_age_years      integer,
  region                text,
  region_changed        boolean,
  main_activity         text,
  main_activity_changed boolean,
  economic_sector       text,
  economic_subsector    text,
  refreshed_at          timestamptz not null default now(),
  primary key (entity_id, commercial_year)
);

comment on table public.aml_entity_peer_position_snapshot is
  'Copia de lectura de aml_v_ipa3_sii_peer_benchmark. El percentil describe posición dentro del grupo de pares del año, no desempeño ni riesgo.';

create index if not exists aml_entity_peer_position_entity_year_idx
  on public.aml_entity_peer_position_snapshot (entity_id, commercial_year desc);

-- ---------------------------------------------------------------------------
-- 3. Vínculos de identidad entre entidades
-- ---------------------------------------------------------------------------
create table if not exists public.aml_entity_identity_link_snapshot (
  relacion_id           text primary key,
  entidad_origen_id     text not null,
  entidad_destino_id    text not null,
  tipo_relacion         text,
  estado_relacion       text,
  metodo_relacion       text,
  confianza             numeric,
  utilizable_en_analisis boolean,
  requiere_revision     boolean,
  detalle               jsonb,
  actualizado_en        timestamptz,
  refreshed_at          timestamptz not null default now()
);

comment on table public.aml_entity_identity_link_snapshot is
  'Copia de lectura de aml_v_entity_relations. Un vínculo con requiere_revision sigue siendo candidato: no promueve identidad canónica.';

create index if not exists aml_entity_identity_link_origen_idx
  on public.aml_entity_identity_link_snapshot (entidad_origen_id);
create index if not exists aml_entity_identity_link_destino_idx
  on public.aml_entity_identity_link_snapshot (entidad_destino_id);

-- ---------------------------------------------------------------------------
-- 4. Autorización: la misma política de los demás objetos analíticos
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'aml_ipa3_mark_scores_snapshot_v0_4',
    'aml_entity_peer_position_snapshot',
    'aml_entity_identity_link_snapshot'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t||'_allowed_read', t);
    execute format($p$create policy %I on public.%I for select
      using (exists (select 1 from public.aml_allowed_users au
                     where au.user_id = (select auth.uid()) and au.enabled))$p$, t||'_allowed_read', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Refresco
-- ---------------------------------------------------------------------------
create or replace function public.refresh_aml_entity_intel_snapshots_0510()
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare marks integer; peers integer; links integer;
begin
  delete from public.aml_ipa3_mark_scores_snapshot_v0_4;
  insert into public.aml_ipa3_mark_scores_snapshot_v0_4
    (entity_id,mark_id,mark_name,semantic_class,primary_dimension,score_group,correlation_group,
     included_in_score,raw_intensity,standalone_cap,contribution,confidence,readiness,source_ids,
     evidence,score_version,refreshed_at)
  select m.entity_id,m.mark_id,m.mark_name,m.semantic_class,m.primary_dimension,m.score_group,
         m.correlation_group,m.included_in_score,m.raw_intensity,m.standalone_cap,m.contribution,
         m.confidence,m.readiness,m.source_ids,m.evidence,m.score_version,now()
  from public.aml_v_ipa3_mark_scores_v0_4 m;
  get diagnostics marks = row_count;

  delete from public.aml_entity_peer_position_snapshot;
  insert into public.aml_entity_peer_position_snapshot
    (entity_id,commercial_year,peer_level,peer_n,size_bucket,age_bucket,sales_peer_percentile,
     sales_band_code,sales_band_rank,sales_band_delta,prior_sales_band_rank,workers_numeric,
     prior_workers_numeric,workforce_ratio,entity_age_years,region,region_changed,main_activity,
     main_activity_changed,economic_sector,economic_subsector,refreshed_at)
  select p.entity_id,p.commercial_year,p.peer_level,p.peer_n,p.size_bucket,p.age_bucket,
         p.sales_peer_percentile,p.sales_band_code,p.sales_band_rank,p.sales_band_delta,
         p.prior_sales_band_rank,p.workers_numeric,p.prior_workers_numeric,p.workforce_ratio,
         p.entity_age_years,p.region,p.region_changed,p.main_activity,p.main_activity_changed,
         p.economic_sector,p.economic_subsector,now()
  from public.aml_v_ipa3_sii_peer_benchmark p;
  get diagnostics peers = row_count;

  delete from public.aml_entity_identity_link_snapshot;
  insert into public.aml_entity_identity_link_snapshot
    (relacion_id,entidad_origen_id,entidad_destino_id,tipo_relacion,estado_relacion,metodo_relacion,
     confianza,utilizable_en_analisis,requiere_revision,detalle,actualizado_en,refreshed_at)
  select r.relacion_id,r.entidad_origen_id,r.entidad_destino_id,r.tipo_relacion,r.estado_relacion,
         r.metodo_relacion,r.confianza,r.utilizable_en_analisis,r.requiere_revision,r.detalle,
         r.actualizado_en,now()
  from public.aml_v_entity_relations r;
  get diagnostics links = row_count;

  return jsonb_build_object('marks',marks,'peer_positions',peers,'identity_links',links);
end;
$function$;

-- Disparo condicional propio. No se toca refresh_aml_runtime_if_stale para que
-- una falla aquí no pueda arrastrar el snapshot de overview del que depende el
-- resto del portal.
create or replace function public.refresh_aml_entity_intel_if_stale_0510()
returns text
language plpgsql
set search_path to 'public'
as $function$
declare
  own_at timestamptz;
  source_at timestamptz;
  result jsonb;
begin
  if not pg_try_advisory_xact_lock(8142,5100) then
    return 'SKIPPED_LOCKED';
  end if;

  select updated_at into own_at from public.aml_sync_state where pipeline='ENTITY_INTEL_0510';
  select max(updated_at) into source_at from public.aml_sync_state
   where pipeline in ('AML_MAIN','SII_ENTITY_YEAR','SANCTION_IDENTITY');

  if source_at is null then return 'NO_SOURCE_SEAL'; end if;
  if own_at is not null and own_at >= source_at then return 'CURRENT'; end if;

  result := public.refresh_aml_entity_intel_snapshots_0510();

  insert into public.aml_sync_state(pipeline,status,detail,updated_at)
  values('ENTITY_INTEL_0510','SUCCESS',
         jsonb_build_object('version','0.51.0','build','0510','rows',result,
                            'refresh_mode','PG_CRON_CONDITIONAL_LOCKED',
                            'source_max_updated_at',source_at),
         now())
  on conflict(pipeline) do update
    set status=excluded.status, detail=excluded.detail, updated_at=excluded.updated_at;

  return 'REFRESHED '||result::text;
exception when others then
  insert into public.aml_sync_state(pipeline,status,detail,updated_at)
  values('ENTITY_INTEL_0510','ERROR',
         jsonb_build_object('version','0.51.0','build','0510','error',left(sqlerrm,300)),
         now())
  on conflict(pipeline) do update
    set status=excluded.status, detail=excluded.detail, updated_at=excluded.updated_at;
  raise;
end;
$function$;

commit;

-- Programación (fuera de la transacción, idempotente):
--   select cron.schedule('aml-entity-intel-0510-if-stale','*/15 * * * *',
--                        'select public.refresh_aml_entity_intel_if_stale_0510();');
