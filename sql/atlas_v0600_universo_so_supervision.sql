-- ATLAS AML 0.60.0 · Universo SO · Supervision 360
-- Backward-compatible expansion of the 0.56/0.58 model.

begin;

alter table public.aml_uaf_potential_review
  add column if not exists due_at timestamptz,
  add column if not exists contact_channel text,
  add column if not exists external_reference text,
  add column if not exists workflow_note text;

alter table public.aml_uaf_potential_review
  drop constraint if exists aml_uaf_potential_review_review_state_check;

alter table public.aml_uaf_potential_review
  add constraint aml_uaf_potential_review_review_state_check
  check (review_state = any (array[
    'REVISADO'::text,
    'ELEGIBLE'::text,
    'PRIORIZADO'::text,
    'SELECCIONADO_PARA_INSCRIPCION'::text,
    'INVITACION_PREPARADA'::text,
    'INVITADO'::text,
    'EN_SEGUIMIENTO'::text,
    'INSCRITO'::text,
    'CERRADO'::text,
    'DESCARTADO'::text,
    'NO_APLICA'::text,
    'YA_INSCRITO'::text,
    'SIN_ACTIVIDAD_VIGENTE'::text
  ]));

create or replace view public.aml_v_uaf_supervision_360_current as
with spend as (
  select provider_rut as rut,
         max(evidence_count)::bigint as public_spend_evidence_count,
         max(presupuesto_count)::bigint as public_spend_purchase_count,
         max(lobby_count)::bigint as public_spend_lobby_count,
         max(cgr_count)::bigint as public_spend_cgr_count,
         max(max_amount_clp)::numeric as public_spend_max_amount_clp,
         max(max_confidence)::numeric as public_spend_match_confidence,
         max(refreshed_at) as public_spend_refreshed_at
  from public.aml_v_public_spend_context_provider
  where provider_rut is not null
  group by provider_rut
), osfl as (
  select rut,
         true as osfl_observed,
         max(source_count) as osfl_source_count,
         bool_or(fatf_r8_candidate) as osfl_fatf_r8_candidate,
         bool_or(law21440_active) as osfl_law21440_active,
         max(coverage_index_pct) as osfl_coverage_index_pct,
         max(refreshed_at) as osfl_refreshed_at
  from public.aml_osfl_entity_runtime_snapshot
  where rut is not null
  group by rut
), res as (
  select rut,
         max(res_relationship_count) as res_relationship_count,
         max(res_partner_count) as res_partner_count,
         max(res_admin_count) as res_admin_count,
         max(res_constitution_date) as res_constitution_date,
         max(res_capital) as res_capital,
         max(res_source_updated_at) as res_refreshed_at
  from public.aml_entity_master_v0553
  where rut is not null
  group by rut
), timeline as (
  select rut,
         count(*)::bigint as res_timeline_event_count,
         max(actuation_date) as res_last_event_date
  from public.aml_entity_res_timeline_v0556
  where rut is not null
  group by rut
), registered as (
  select
    'INSCRITO'::text as universe_status,
    s.rut, s.entity_id,
    coalesce(s.registry_name,s.entity_name) as entity_name,
    s.subject_nature,
    s.uaf_sector_canonical as uaf_sector,
    null::text as potential_evidence_class,
    null::numeric as ivo_score,
    null::numeric as materiality_score,
    null::text as workflow_state,
    s.region, s.commune,
    s.sii_status, s.sii_main_activity, s.sii_sales_band,
    s.sii_sales_band_rank, s.sii_workers,
    s.sanction_event_count, s.sanction_last_event_date,
    s.ipf_score as supervision_priority_score,
    s.ipf_band as supervision_priority_band,
    s.ipf_credibility_pct as supervision_priority_credibility_pct,
    s.source_count,
    s.refreshed_at
  from public.aml_uaf_obligated_subject_snapshot s
), potential as (
  select
    'POTENCIAL'::text as universe_status,
    p.rut, p.entity_id, p.entity_name, p.subject_nature,
    p.implied_sector as uaf_sector,
    p.evidence_class as potential_evidence_class,
    p.ivo_score, p.materiality_score,
    p.review_state as workflow_state,
    p.region, p.commune,
    p.sii_status, p.sii_main_activity, p.sii_sales_band,
    p.sii_sales_band_rank, p.sii_workers,
    p.uaf_sanction_events as sanction_event_count,
    p.uaf_sanction_last_date as sanction_last_event_date,
    null::numeric as supervision_priority_score,
    null::text as supervision_priority_band,
    p.ivo_credibility_pct as supervision_priority_credibility_pct,
    p.source_count,
    p.refreshed_at
  from public.aml_v_uaf_potential_current p
)
select u.*,
       coalesce(sp.public_spend_evidence_count,0) as public_spend_evidence_count,
       coalesce(sp.public_spend_purchase_count,0) as public_spend_purchase_count,
       coalesce(sp.public_spend_lobby_count,0) as public_spend_lobby_count,
       coalesce(sp.public_spend_cgr_count,0) as public_spend_cgr_count,
       sp.public_spend_max_amount_clp,
       sp.public_spend_match_confidence,
       sp.public_spend_refreshed_at,
       coalesce(o.osfl_observed,false) as osfl_observed,
       o.osfl_source_count,
       o.osfl_fatf_r8_candidate,
       o.osfl_law21440_active,
       o.osfl_coverage_index_pct,
       o.osfl_refreshed_at,
       r.res_relationship_count,
       r.res_partner_count,
       r.res_admin_count,
       r.res_constitution_date,
       r.res_capital,
       r.res_refreshed_at,
       t.res_timeline_event_count,
       t.res_last_event_date,
       jsonb_build_object(
         'uaf', true,
         'sii', u.sii_status is not null,
         'territory', u.region is not null,
         'sanctions', true,
         'public_spend', sp.rut is not null,
         'osfl', o.rut is not null,
         'res', r.rut is not null,
         'reportability_entity_level', false,
         'press_entity_level', false
       ) as source_coverage
from (
  select * from registered
  union all
  select * from potential
) u
left join spend sp on sp.rut=u.rut
left join osfl o on o.rut=u.rut
left join res r on r.rut=u.rut
left join timeline t on t.rut=u.rut;

grant select on public.aml_v_uaf_supervision_360_current to authenticated;
revoke all on public.aml_v_uaf_supervision_360_current from anon;

commit;
