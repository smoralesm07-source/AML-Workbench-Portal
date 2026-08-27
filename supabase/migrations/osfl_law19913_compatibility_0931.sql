-- ATLAS OSFL Law 19.913 compatibility refinement 0.93.1
-- Preserve the general potential-subject universe but stratify OSFL by evidence strength.

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
    when pot.rut is not null then 'Coincidencia con el universo Atlas de potenciales sujetos; la fuerza del vínculo se estratifica según carácter principal/secundario de la actividad y tier de detección.'
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
  o.refreshed_at,
  case
    when so.rut is not null then 'DIRECT'
    when pot.rut is null then null
    when pot.evidence_class='GIRO_PRINCIPAL_CARACTERISTICO' and pot.detection_tier in ('A_ALTA','B_MEDIA') then 'HIGH'
    when pot.detection_tier in ('A_ALTA','B_MEDIA') then 'MEDIUM'
    else 'EXPLORATORY'
  end as potential_relevance_tier,
  case
    when so.rut is not null then 0
    when pot.rut is null then null
    when pot.evidence_class='GIRO_PRINCIPAL_CARACTERISTICO' and pot.detection_tier in ('A_ALTA','B_MEDIA') then 1
    when pot.detection_tier in ('A_ALTA','B_MEDIA') then 2
    else 3
  end as potential_relevance_rank,
  pot.matched_activity as potential_matched_activity,
  pot.type_coherence_class as potential_type_coherence_class,
  pot.type_share_in_sector as potential_type_share_in_sector,
  pot.ivo_credibility_pct as potential_ivo_credibility_pct
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
    count(*) filter (where bridge_class='POTENTIAL_SUBJECT' and potential_relevance_tier='HIGH')::bigint as potential_high,
    count(*) filter (where bridge_class='POTENTIAL_SUBJECT' and potential_relevance_tier='MEDIUM')::bigint as potential_medium,
    count(*) filter (where bridge_class='POTENTIAL_SUBJECT' and potential_relevance_tier='EXPLORATORY')::bigint as potential_exploratory,
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
  now() as monitor_refreshed_at,
  b.potential_high,
  b.potential_medium,
  b.potential_exploratory,
  (b.direct_obligated+b.potential_high)::bigint as law19913_core_total,
  (b.direct_obligated+b.potential_high+b.potential_medium)::bigint as law19913_review_total,
  round(100.0*(b.direct_obligated+b.potential_high)/nullif(o.atlas_observed,0),2) as law19913_core_pct_observed
from latest_ref r cross join registry_live rl cross join observed o cross join bridge b;

grant select on public.aml_v_osfl_national_monitor_current to authenticated;

comment on view public.aml_v_osfl_law19913_bridge_current is 'Puente analítico OSFL hacia Ley 19.913 con estratificación HIGH/MEDIUM/EXPLORATORY para potenciales sujetos. Las clases son contexto de aplicabilidad/evidencia, no inferencias de ilicitud.';
