-- ATLAS AML 0.81.4 · Stable filter sampling for Universo SO
-- The legacy client builds dropdowns from an initial row sample. Order each view so the first API page
-- contains representation of every observed sector/region combination, preventing rare sectors from disappearing.

create or replace view public.aml_v_universo_so_entity_explorer_0810
with (security_invoker=true) as
with e1 as (
  select distinct on (rut) entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,profile,snapshot_id,updated_at
  from public.aml_entities where rut is not null
  order by rut,source_count desc nulls last,updated_at desc nulls last,entity_id
), s1 as (
  select distinct on (entity_id) entity_id,rut,name,entity_type,region,commune,is_uaf_observed,ipa3_score,priority_band_shadow,
    registry_group_score,registry_driver_mark,economic_group_score,economic_driver_mark,sanctions_group_score,sanctions_driver_mark,
    dominant_mark_id,included_mark_count,independent_group_count,absorbed_or_correlated_mark_count,diagnostic_mark_count,context_mark_count,
    included_mark_ids,diagnostic_mark_ids,score_confidence_pct,coverage_index_pct,sii_year_count,sii_years_with_sales_delta,
    sii_years_with_workforce_ratio,economic_coverage_pct,sanctions_identity_coverage_pct,registry_coverage_pct,reconciliation_status,
    score_as_of,score_version,production_enabled,semantics,refreshed_at
  from public.aml_ipa3_entity_score_snapshot_v0_4 where entity_id is not null
  order by entity_id,refreshed_at desc nulls last
)
select
  coalesce(o.entity_id,e.entity_id) as entity_id,o.rut,coalesce(e.name,o.registry_name,o.entity_name) as name,
  coalesce(e.entity_type,o.entity_type) as entity_type,coalesce(e.region,o.region) as region,coalesce(e.commune,o.commune) as commune,
  coalesce(e.source_count,o.source_count,1) as source_count,coalesce(e.profile,'{}'::jsonb) as profile,true as is_uaf_observed,
  coalesce(e.is_sanctioned,false) or coalesce(o.sanction_event_count,0)>0 as is_sanctioned,o.uaf_sector_canonical as sector,
  o.sii_status,o.sii_termination_date,o.sii_activity_changed,o.sii_region_changed,o.sanction_event_count,o.sanction_event_count_5y,
  o.ownership_edge_count,o.legal_entity_partner_count,o.ipf_score,o.ipf_band,s.ipa3_score,s.priority_band_shadow,
  s.registry_group_score,s.economic_group_score,s.sanctions_group_score,s.dominant_mark_id,s.score_confidence_pct,s.coverage_index_pct,
  case when coalesce(e.profile->'fuentes','[]'::jsonb) ? 'RADAR_PRENSA' then true else false end as has_press,
  (case when coalesce(o.sanction_event_count,0)>0 then 1 else 0 end + case when o.sii_status='TERMINATED_AS_PUBLISHED' then 1 else 0 end +
   case when coalesce(o.sii_activity_changed,false) then 1 else 0 end + case when coalesce(o.sii_region_changed,false) then 1 else 0 end +
   case when coalesce(e.profile->'fuentes','[]'::jsonb) ? 'RADAR_PRENSA' then 1 else 0 end) as alert_count,o.refreshed_at
from public.aml_uaf_obligated_subject_snapshot o
left join e1 e on e.rut=o.rut
left join s1 s on s.entity_id=coalesce(o.entity_id,e.entity_id)
order by row_number() over (partition by o.uaf_sector_canonical,coalesce(e.region,o.region) order by o.rut),
         o.uaf_sector_canonical,coalesce(e.region,o.region),o.rut;

create or replace view public.aml_v_universo_potential_entity_explorer_0813
with (security_invoker=true) as
with e1 as (
  select distinct on (rut) entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,profile,snapshot_id,updated_at
  from public.aml_entities where rut is not null
  order by rut,source_count desc nulls last,updated_at desc nulls last,entity_id
), s1 as (
  select distinct on (entity_id) entity_id,rut,name,entity_type,region,commune,is_uaf_observed,ipa3_score,priority_band_shadow,
    registry_group_score,registry_driver_mark,economic_group_score,economic_driver_mark,sanctions_group_score,sanctions_driver_mark,
    dominant_mark_id,included_mark_count,independent_group_count,absorbed_or_correlated_mark_count,diagnostic_mark_count,context_mark_count,
    included_mark_ids,diagnostic_mark_ids,score_confidence_pct,coverage_index_pct,sii_year_count,sii_years_with_sales_delta,
    sii_years_with_workforce_ratio,economic_coverage_pct,sanctions_identity_coverage_pct,registry_coverage_pct,reconciliation_status,
    score_as_of,score_version,production_enabled,semantics,refreshed_at
  from public.aml_ipa3_entity_score_snapshot_v0_4 where entity_id is not null
  order by entity_id,refreshed_at desc nulls last
)
select
  coalesce(p.entity_id,e.entity_id) as entity_id,p.rut,coalesce(e.name,p.entity_name) as name,coalesce(e.entity_type,p.entity_type) as entity_type,
  coalesce(e.region,p.region) as region,coalesce(e.commune,p.commune) as commune,coalesce(e.source_count,p.source_count,1) as source_count,
  coalesce(e.profile,'{}'::jsonb) as profile,false as is_uaf_observed,
  coalesce(e.is_sanctioned,false) or coalesce(p.uaf_sanction_events,0)>0 as is_sanctioned,p.implied_sector as sector,p.sii_status,
  p.sii_termination_date,p.uaf_sanction_events as sanction_event_count,p.ownership_edge_count,p.legal_entity_partner_count,p.ipa3_score,p.ipa3_band,
  s.priority_band_shadow,s.registry_group_score,s.economic_group_score,s.sanctions_group_score,s.dominant_mark_id,s.score_confidence_pct,s.coverage_index_pct,
  p.ivo_score,p.ivo_band,p.ivo_credibility_pct,p.materiality_score,p.evidence_class,p.matched_activity,p.review_state,p.review_reason_code,
  p.review_rationale,p.reviewed_at,p.reviewed_by_user_id,p.review_count::integer as review_count,p.reviewer_count::integer as reviewer_count,
  p.management_bucket,case when coalesce(e.profile->'fuentes','[]'::jsonb) ? 'RADAR_PRENSA' then true else false end as has_press,
  (case when coalesce(p.uaf_sanction_events,0)>0 then 1 else 0 end + case when p.sii_status='TERMINATED_AS_PUBLISHED' then 1 else 0 end +
   case when coalesce(e.profile->'fuentes','[]'::jsonb) ? 'RADAR_PRENSA' then 1 else 0 end + case when coalesce(p.ivo_score,0)>=70 then 1 else 0 end) as alert_count,
  p.refreshed_at
from public.aml_v_uaf_potential_screening_current_v0812 p
left join e1 e on regexp_replace(upper(e.rut),'[^0-9K]','','g')=regexp_replace(upper(p.rut),'[^0-9K]','','g')
left join s1 s on s.entity_id=coalesce(p.entity_id,e.entity_id)
order by row_number() over (partition by p.implied_sector,coalesce(e.region,p.region) order by p.rut),
         p.implied_sector,coalesce(e.region,p.region),p.rut;
