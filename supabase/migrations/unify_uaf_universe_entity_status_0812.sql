-- ATLAS AML 0.81.2 · Universo SO / Entidades canonical status
-- Canonical screening universe: registry snapshot (74,087 current rows at migration time).
-- Potential SO remains screening only; it is not a legal conclusion or non-compliance finding.

create unique index if not exists aml_uaf_potential_registry_rut_key_uidx
  on public.aml_uaf_potential_registry_snapshot_v0650 ((regexp_replace(upper(rut),'[^0-9K]','','g')));
create unique index if not exists aml_uaf_potential_subject_rut_key_uidx
  on public.aml_uaf_potential_subject_snapshot ((regexp_replace(upper(rut),'[^0-9K]','','g')));

create or replace view public.aml_v_uaf_potential_screening_current_v0812
with (security_invoker=true) as
with review_counts as (
  select regexp_replace(upper(rut),'[^0-9K]','','g') as rut_key,
         count(*)::bigint as review_count,
         count(distinct user_id)::bigint as reviewer_count
  from public.aml_uaf_potential_review
  group by 1
), review_ranked as (
  select r.*,
         regexp_replace(upper(r.rut),'[^0-9K]','','g') as rut_key,
         row_number() over (
           partition by regexp_replace(upper(r.rut),'[^0-9K]','','g')
           order by r.created_at desc,r.review_id desc
         ) as rn
  from public.aml_uaf_potential_review r
), latest_review as (
  select rr.*,au.email as reviewed_by_email,rc.review_count,rc.reviewer_count
  from review_ranked rr
  left join public.aml_allowed_users au on au.user_id=rr.user_id
  left join review_counts rc on rc.rut_key=rr.rut_key
  where rr.rn=1
)
select
  r.rut,
  coalesce(s.entity_id,r.entity_id) as entity_id,
  coalesce(s.entity_name,r.legal_name) as entity_name,
  s.entity_type,s.subject_nature,
  coalesce(s.implied_sector,r.uaf_sectors[1]) as implied_sector,
  coalesce(s.evidence_class,r.qualification_tier) as evidence_class,
  coalesce(s.matched_activity,r.activity_codes[1]) as matched_activity,
  s.activity_concentration,s.activity_registered_n,s.activity_universe_n,
  coalesce(s.uaf_sanction_events,0) as uaf_sanction_events,s.uaf_sanction_last_date,s.uaf_sanction_refs,
  s.region,s.commune,
  coalesce(s.sii_status,r.current_status) as sii_status,
  s.sii_main_activity,s.sii_activity_names,s.sii_sales_band,s.sii_sales_band_rank,s.sii_workers,
  coalesce(s.sii_activity_start_date,r.activity_start_date) as sii_activity_start_date,
  coalesce(s.sii_termination_date,r.termination_date) as sii_termination_date,
  s.ownership_edge_count,s.legal_entity_partner_count,s.societies_as_partner_count,
  coalesce(s.source_count,1+case when r.res_available then 1 else 0 end) as source_count,
  s.ipa3_score,s.ipa3_band,
  s.ivo_regulatory_evidence,s.ivo_activity_match,s.ivo_operational_status,s.ivo_score,s.ivo_band,s.ivo_credibility_pct,s.ivo_components,
  s.materiality_score,s.materiality_components,s.flags,s.index_version,
  coalesce(s.semantics,r.semantics) as semantics,
  greatest(coalesce(s.refreshed_at,'epoch'::timestamptz),coalesce(r.refreshed_at,'epoch'::timestamptz)) as refreshed_at,
  coalesce(s.is_actionable,false) as is_actionable,s.actionability_basis,s.type_share_in_sector,s.detection_tier,s.type_coherence_class,
  r.qualification_tier,r.uaf_sectors,r.activity_codes,r.evidence_count as screening_evidence_count,r.res_available,r.res_constitution_date,r.res_company_code,
  false as uaf_registered_exact,
  lr.review_state,lr.reason_code as review_reason_code,lr.rationale as review_rationale,lr.created_at as reviewed_at,
  lr.user_id as reviewed_by_user_id,lr.reviewed_by_email,
  coalesce(lr.review_count,0)::bigint as review_count,coalesce(lr.reviewer_count,0)::bigint as reviewer_count,
  case
    when lr.review_state='CANDIDATO_SELECCIONADO' then 'CANDIDATO_SELECCIONADO'
    when lr.review_state='NO_CANDIDATO' then 'NO_CANDIDATO'
    else 'POTENCIAL_PENDIENTE'
  end as management_bucket
from public.aml_uaf_potential_registry_snapshot_v0650 r
left join public.aml_uaf_potential_subject_snapshot s
  on regexp_replace(upper(s.rut),'[^0-9K]','','g')=regexp_replace(upper(r.rut),'[^0-9K]','','g')
left join latest_review lr
  on lr.rut_key=regexp_replace(upper(r.rut),'[^0-9K]','','g')
where r.uaf_registered_exact=false;

-- Keep the existing contract name used by Universo SO, but make it the full screening universe.
create or replace view public.aml_v_uaf_potential_current
with (security_invoker=true) as
select rut,entity_id,entity_name,entity_type,subject_nature,implied_sector,evidence_class,matched_activity,activity_concentration,
activity_registered_n,activity_universe_n,uaf_sanction_events,uaf_sanction_last_date,uaf_sanction_refs,region,commune,sii_status,
sii_main_activity,sii_activity_names,sii_sales_band,sii_sales_band_rank,sii_workers,sii_activity_start_date,sii_termination_date,
ownership_edge_count,legal_entity_partner_count,societies_as_partner_count,source_count,ipa3_score,ipa3_band,ivo_regulatory_evidence,
ivo_activity_match,ivo_operational_status,ivo_score,ivo_band,ivo_credibility_pct,ivo_components,materiality_score,materiality_components,
flags,index_version,semantics,refreshed_at,is_actionable,actionability_basis,type_share_in_sector,review_state,review_reason_code,
review_rationale,reviewed_at,reviewed_by_user_id,reviewed_by_email,review_count::integer as review_count,reviewer_count::integer as reviewer_count
from public.aml_v_uaf_potential_screening_current_v0812;

-- Management is now defined over the full screening universe. Selecting a candidate moves it
-- out of POTENCIAL_PENDIENTE but does not erase its membership in the canonical screening universe.
drop view if exists public.aml_v_uaf_potential_management_summary_v0803;
drop view if exists public.aml_v_uaf_not_candidate_v0803;
drop view if exists public.aml_v_uaf_candidate_selected_v0803;
drop view if exists public.aml_v_uaf_potential_pending_v0803;
drop view if exists public.aml_v_uaf_potential_management_current;
create view public.aml_v_uaf_potential_management_current with (security_invoker=true) as
  select * from public.aml_v_uaf_potential_screening_current_v0812;
create view public.aml_v_uaf_potential_pending_v0803 with (security_invoker=true) as
  select * from public.aml_v_uaf_potential_management_current where management_bucket='POTENCIAL_PENDIENTE';
create view public.aml_v_uaf_candidate_selected_v0803 with (security_invoker=true) as
  select * from public.aml_v_uaf_potential_management_current where management_bucket='CANDIDATO_SELECCIONADO';
create view public.aml_v_uaf_not_candidate_v0803 with (security_invoker=true) as
  select * from public.aml_v_uaf_potential_management_current where management_bucket='NO_CANDIDATO';
create view public.aml_v_uaf_potential_management_summary_v0803 with (security_invoker=true) as
select count(*) filter(where management_bucket='POTENCIAL_PENDIENTE')::bigint as potential_pending,
       count(*) filter(where management_bucket='CANDIDATO_SELECCIONADO')::bigint as selected_candidates,
       count(*) filter(where management_bucket='NO_CANDIDATO')::bigint as not_candidates,
       count(*)::bigint as screened_total,now() as calculated_at
from public.aml_v_uaf_potential_management_current;

-- One exact-RUT authority shared by Entidades and Universo SO.
create or replace view public.aml_v_entity_uaf_status_current_v0812
with (security_invoker=true) as
select regexp_replace(upper(o.rut),'[^0-9K]','','g') as rut_key,o.rut,o.entity_id,coalesce(o.registry_name,o.entity_name) as entity_name,
       'SO_INSCRITO'::text as universe_status,true as is_uaf_registered,false as is_potential_screening,null::text as management_bucket,
       o.uaf_sector_canonical as uaf_sector,o.sii_status,o.region,o.commune,o.refreshed_at,
       'RUT exacto observado en padrón UAF vigente materializado.'::text as status_basis
from public.aml_uaf_obligated_subject_snapshot o
union all
select regexp_replace(upper(p.rut),'[^0-9K]','','g'),p.rut,p.entity_id,p.entity_name,
       'POTENCIAL_SO_SCREENING'::text,false,true,p.management_bucket,p.implied_sector,p.sii_status,p.region,p.commune,p.refreshed_at,
       'Actividad SII vigente compatible con screening Ley 19.913 y RUT no observado en padrón UAF; no constituye conclusión jurídica.'::text
from public.aml_v_uaf_potential_screening_current_v0812 p;

grant select on public.aml_v_uaf_potential_screening_current_v0812,public.aml_v_uaf_potential_current,
public.aml_v_uaf_potential_management_current,public.aml_v_uaf_potential_pending_v0803,public.aml_v_uaf_candidate_selected_v0803,
public.aml_v_uaf_not_candidate_v0803,public.aml_v_uaf_potential_management_summary_v0803,public.aml_v_entity_uaf_status_current_v0812
to authenticated;
