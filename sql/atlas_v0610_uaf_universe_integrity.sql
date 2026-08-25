-- ATLAS AML 0.61.0 · Universo SO · verdad registral y obligaciones de reportabilidad
begin;

create or replace view public.aml_v_uaf_universe_integrity_0610 as
with registered as (
  select count(*)::integer as n from public.aml_uaf_entity_profile
), observed as (
  select count(*)::integer as n from public.aml_entity_master_v0553 where is_uaf_observed is true
), public_bodies as (
  select count(*)::integer as n
  from public.aml_entity_master_v0553 m
  where m.is_uaf_observed is true
    and m.entity_type='Organismo público'
    and not exists (select 1 from public.aml_uaf_entity_profile p where p.rut=m.rut)
), raw_sectors as (
  select count(distinct s)::integer as n
  from public.aml_uaf_entity_profile p
  cross join lateral unnest(p.sector_names) s
), populated_canonical as (
  select count(*)::integer as n from public.aml_uaf_obligated_sector_snapshot
), catalog as (
  select count(distinct sector_canonical_name)::integer as n from public.aml_uaf_sector_vulnerability_ref
)
select registered.n as registered_subjects,
       public_bodies.n as uaf_public_bodies,
       observed.n as uaf_observed_entities,
       raw_sectors.n as raw_sector_labels,
       populated_canonical.n as populated_canonical_sectors,
       catalog.n as canonical_sector_catalog,
       (observed.n = registered.n + public_bodies.n) as reconciled,
       now() as checked_at
from registered, observed, public_bodies, raw_sectors, populated_canonical, catalog;

create or replace view public.aml_v_uaf_reporting_obligation_0610 as
select s.rut,
       s.entity_id,
       coalesce(s.registry_name,s.entity_name) as entity_name,
       s.uaf_sector_canonical,
       r.sector_group,
       r.ros_required,
       r.ros_trigger,
       r.roe_required,
       r.roe_frequency,
       r.roe_threshold_usd,
       r.roe_deadline,
       r.legal_basis,
       r.as_of_date,
       (r.sector_name is not null) as reporting_rule_mapped,
       case when r.sector_name is null then 'REGLA_SECTORIAL_NO_MATERIALIZADA' else 'REGLA_SECTORIAL_VIGENTE' end as reporting_rule_status
from public.aml_uaf_obligated_subject_snapshot s
left join public.aml_reporting_rules r
  on lower(trim(r.sector_name))=lower(trim(s.uaf_sector_canonical));

grant select on public.aml_v_uaf_universe_integrity_0610 to authenticated;
grant select on public.aml_v_uaf_reporting_obligation_0610 to authenticated;
revoke all on public.aml_v_uaf_universe_integrity_0610 from anon;
revoke all on public.aml_v_uaf_reporting_obligation_0610 from anon;

commit;
