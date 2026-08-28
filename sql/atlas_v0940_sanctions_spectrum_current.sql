-- ATLAS AML · Sanciones 0.94.0
-- Contratos de lectura actuales para espectro sancionatorio y consumo inter-sección.
-- Aplicado en Supabase el 2026-08-28. Las vistas usan security_invoker para
-- conservar RLS/permisos de las fuentes subyacentes.

create or replace view public.aml_v_sanctions_spectrum_current_v0940
with (security_invoker = true) as
select
  s.sanction_id,
  s.event_date,
  extract(year from s.event_date)::int as event_year,
  s.regulator,
  s.entity_name as source_entity_name,
  s.entity_id,
  coalesce(e.rut,u.rut,o.rut,rb.rut) as rut,
  coalesce(e.name,u.entity_name,o.name,s.entity_name) as canonical_name,
  coalesce(e.entity_type,case when o.entity_id is not null then 'OSFL' end) as entity_type,
  s.identity_status,
  s.resolution_method as identity_method,
  s.identity_confidence,
  s.laft_direct,
  s.amount_uf,
  s.subject,
  s.payload,
  s.snapshot_id,
  s.updated_at,
  coalesce(u.region,e.region,o.region) as region,
  coalesce(u.commune,e.commune,o.commune) as commune,
  case when u.region is not null or u.commune is not null then 'UAF_CURRENT'
       when e.region is not null or e.commune is not null then 'ENTITY_MASTER'
       when o.region is not null or o.commune is not null then 'OSFL_CURRENT'
       else 'NOT_OBSERVED' end as territory_basis,
  u.universe_status,
  coalesce(u.is_uaf_registered,false) as is_uaf_registered,
  coalesce(u.is_potential_screening,false) as is_potential_screening,
  u.management_bucket,
  u.uaf_sector,
  u.sii_status,
  (o.entity_id is not null) as is_osfl_observed,
  o.confirmation_level as osfl_confirmation_level,
  o.activity_group as osfl_activity_group,
  o.fatf_r8_candidate as osfl_fatf_r8_candidate,
  o.direct_confirmed as osfl_direct_confirmed,
  o.refreshed_at as osfl_refreshed_at,
  (rb.entity_id is not null) as is_res_observed,
  rb.match_method as res_match_method,
  rb.confidence as res_confidence,
  rb.refreshed_at as res_refreshed_at,
  coalesce(e.source_count,0) as entity_source_count,
  case
    when s.entity_id is null then 'UNRESOLVED_IDENTITY'
    when coalesce(u.is_uaf_registered,false) then 'SO_REGISTERED'
    when coalesce(u.is_potential_screening,false) then 'POTENTIAL_SO_CURRENT'
    else 'OTHER_SANCTIONED_ENTITY'
  end as current_condition,
  case
    when s.entity_id is null then 'Sanción observada sin identidad canónica conciliada'
    when coalesce(u.is_uaf_registered,false) then 'Condición SO tomada del contrato UAF vigente'
    when coalesce(u.is_potential_screening,false) then 'Potencial SO tomado del screening UAF vigente'
    else 'Entidad sancionada fuera del universo UAF vigente observado'
  end as condition_basis,
  (case when e.entity_id is not null then 1 else 0 end
   + case when u.entity_id is not null then 1 else 0 end
   + case when o.entity_id is not null then 1 else 0 end
   + case when rb.entity_id is not null then 1 else 0 end)::int as cross_source_count
from public.aml_v028_sanctions_with_identity s
left join public.aml_entities e on e.entity_id=s.entity_id
left join public.aml_v_entity_uaf_status_current_v0812 u on u.entity_id=s.entity_id
left join public.aml_osfl_entity_runtime_snapshot o on o.entity_id=s.entity_id
left join public.aml_res_entity_bridge rb on rb.entity_id=s.entity_id;

grant select on public.aml_v_sanctions_spectrum_current_v0940 to authenticated;

create or replace view public.aml_v_sanction_entity_signal_current_v0940
with (security_invoker = true) as
with b as (
  select *,coalesce(entity_id,'UNRESOLVED:'||md5(upper(regexp_replace(coalesce(source_entity_name,''),'[^A-Z0-9ÁÉÍÓÚÜÑ]+','','g')))) as entity_key
  from public.aml_v_sanctions_spectrum_current_v0940
), a as (
  select entity_key,
         count(*)::int as sanction_event_count,
         count(*) filter(where laft_direct)::int as laft_direct_event_count,
         count(distinct regulator)::int as regulator_count,
         sum(coalesce(amount_uf,0))::numeric as total_amount_uf,
         min(event_date) as first_sanction_date,
         max(event_date) as last_sanction_date,
         array_agg(distinct regulator) filter(where regulator is not null) as regulators,
         max(identity_confidence) as max_identity_confidence,
         bool_or(is_uaf_registered) as is_uaf_registered,
         bool_or(is_potential_screening) as is_potential_screening,
         bool_or(is_osfl_observed) as is_osfl_observed,
         bool_or(is_res_observed) as is_res_observed,
         max(cross_source_count) as cross_source_count
  from b group by entity_key
), latest as (
  select distinct on (entity_key) entity_key,entity_id,rut,canonical_name,source_entity_name,
         identity_status,identity_method,current_condition,condition_basis,uaf_sector,region,commune,
         territory_basis,management_bucket,sii_status,entity_type,updated_at
  from b order by entity_key,event_date desc nulls last,updated_at desc nulls last
)
select l.*,a.sanction_event_count,a.laft_direct_event_count,a.regulator_count,a.total_amount_uf,
       a.first_sanction_date,a.last_sanction_date,a.regulators,a.max_identity_confidence,
       a.is_uaf_registered,a.is_potential_screening,a.is_osfl_observed,a.is_res_observed,
       a.cross_source_count,
       case when a.sanction_event_count>=4 or a.regulator_count>=2 or a.laft_direct_event_count>=2 then 'HIGH'
            when a.sanction_event_count>=2 or a.laft_direct_event_count>=1 then 'MEDIUM'
            else 'CONTEXT' end as analytic_signal_band
from a join latest l using(entity_key);

grant select on public.aml_v_sanction_entity_signal_current_v0940 to authenticated;

create or replace view public.aml_v_sanction_region_signal_current_v0940
with (security_invoker = true) as
select region,
       count(*)::int as sanction_events,
       count(distinct coalesce(entity_id,upper(source_entity_name)))::int as sanctioned_entities,
       count(*) filter(where laft_direct)::int as laft_direct_events,
       count(*) filter(where is_uaf_registered)::int as registered_so_events,
       count(*) filter(where is_potential_screening)::int as potential_so_events,
       count(*) filter(where is_osfl_observed)::int as osfl_events,
       count(*) filter(where is_res_observed)::int as res_events,
       sum(coalesce(amount_uf,0))::numeric as amount_uf,
       max(event_date) as last_event_date
from public.aml_v_sanctions_spectrum_current_v0940
where region is not null and region<>''
group by region;

grant select on public.aml_v_sanction_region_signal_current_v0940 to authenticated;

create or replace view public.aml_v_sanction_sector_signal_current_v0940
with (security_invoker = true) as
select coalesce(uaf_sector,'Sin sector UAF observado') as sector,
       current_condition,
       count(*)::int as sanction_events,
       count(distinct coalesce(entity_id,upper(source_entity_name)))::int as sanctioned_entities,
       count(*) filter(where laft_direct)::int as laft_direct_events,
       sum(coalesce(amount_uf,0))::numeric as amount_uf,
       max(event_date) as last_event_date
from public.aml_v_sanctions_spectrum_current_v0940
group by coalesce(uaf_sector,'Sin sector UAF observado'),current_condition;

grant select on public.aml_v_sanction_sector_signal_current_v0940 to authenticated;
