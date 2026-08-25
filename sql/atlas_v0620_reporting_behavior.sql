-- ATLAS AML 0.62.0 · Universo SO · reportabilidad efectiva
-- Resuelve alias gobernados sin inferencia y crea contrato de comportamiento ROS/ROE por entidad.

begin;

create table if not exists public.aml_uaf_reporting_sector_alias_0620 (
  uaf_sector_canonical text primary key,
  reporting_rule_sector_name text not null,
  match_method text not null default 'GOVERNED_ALIAS',
  notes text,
  created_at timestamptz not null default now()
);

insert into public.aml_uaf_reporting_sector_alias_0620
  (uaf_sector_canonical, reporting_rule_sector_name, match_method, notes)
values
  ('Emisoras y Operadoras de Tarjetas de Pago',
   'Emisoras u Operadoras de Tarjetas de Crédito, Tarjetas de Pago con provisión de fondos, o cualquier otro sistema similar a los referidos medios de pago',
   'GOVERNED_ALIAS','Equivalencia terminológica entre padrón y regla sectorial vigente.'),
  ('Organizaciones Deportivas Profesionales regidas por la Ley N° 20.019',
   'Organizaciones Deportivas Profesionales regidas por Ley 20.019',
   'GOVERNED_ALIAS','Equivalencia ortográfica/legal; misma categoría normativa.'),
  ('Fintec: Otros Fiscalizados por la CMF',
   'Fintec: Otros fiscalizados por CMF',
   'GOVERNED_ALIAS','Equivalencia de mayúsculas y artículo; misma categoría normativa.')
on conflict (uaf_sector_canonical) do update set
  reporting_rule_sector_name=excluded.reporting_rule_sector_name,
  match_method=excluded.match_method,
  notes=excluded.notes;

create or replace view public.aml_v_uaf_reporting_obligation_0620 as
with mapped as (
  select s.*,
         coalesce(a.reporting_rule_sector_name,s.uaf_sector_canonical) as rule_lookup_name,
         case when a.uaf_sector_canonical is not null then a.match_method else 'EXACT_CANONICAL' end as rule_match_method
  from public.aml_uaf_obligated_subject_snapshot s
  left join public.aml_uaf_reporting_sector_alias_0620 a
    on a.uaf_sector_canonical=s.uaf_sector_canonical
)
select m.rut,m.entity_id,coalesce(m.registry_name,m.entity_name) as entity_name,
       m.uaf_sector_canonical,
       r.sector_group,r.ros_required,r.ros_trigger,r.roe_required,r.roe_frequency,
       r.roe_threshold_usd,r.roe_deadline,r.legal_basis,r.as_of_date,
       (r.sector_name is not null) as reporting_rule_mapped,
       case when r.sector_name is not null then 'MAPPED' else 'PENDING_RULE' end as reporting_rule_status,
       m.rule_match_method,
       r.sector_name as reporting_rule_sector_name
from mapped m
left join public.aml_reporting_rules r
  on lower(trim(r.sector_name))=lower(trim(m.rule_lookup_name));

grant select on public.aml_v_uaf_reporting_obligation_0620 to authenticated;
revoke all on public.aml_v_uaf_reporting_obligation_0620 from anon;

create table if not exists public.aml_uaf_entity_reporting_observation_0620 (
  observation_id uuid primary key default gen_random_uuid(),
  rut text not null,
  entity_id text,
  period_start date not null,
  period_end date not null,
  ros_count integer,
  roe_count integer,
  roe_operation_count bigint,
  source_system text not null,
  source_record_id text,
  source_cutoff_date date,
  observed_at timestamptz not null default now(),
  loaded_at timestamptz not null default now(),
  constraint aml_uaf_entity_reporting_observation_0620_period_ck check (period_end >= period_start),
  constraint aml_uaf_entity_reporting_observation_0620_nonnegative_ck check (
    coalesce(ros_count,0) >= 0 and coalesce(roe_count,0) >= 0 and coalesce(roe_operation_count,0) >= 0
  ),
  constraint aml_uaf_entity_reporting_observation_0620_unique unique (rut,period_start,period_end,source_system,source_record_id)
);

alter table public.aml_uaf_entity_reporting_observation_0620 enable row level security;
revoke all on public.aml_uaf_entity_reporting_observation_0620 from anon, authenticated;
grant select on public.aml_uaf_entity_reporting_observation_0620 to authenticated;

drop policy if exists aml_uaf_reporting_observation_read_0620 on public.aml_uaf_entity_reporting_observation_0620;
create policy aml_uaf_reporting_observation_read_0620
on public.aml_uaf_entity_reporting_observation_0620
for select to authenticated using (true);

create index if not exists aml_uaf_entity_reporting_observation_0620_rut_idx
  on public.aml_uaf_entity_reporting_observation_0620(rut,period_end desc);

create or replace view public.aml_v_uaf_entity_reporting_behavior_0620 as
with obs as (
  select o.rut,
         count(*)::int as observed_periods,
         min(o.period_start) as first_period_start,
         max(o.period_end) as last_period_end,
         sum(coalesce(o.ros_count,0))::bigint as ros_total,
         sum(coalesce(o.roe_count,0))::bigint as roe_total,
         sum(coalesce(o.roe_operation_count,0))::bigint as roe_operation_total,
         max(o.source_cutoff_date) as source_cutoff_date,
         max(o.observed_at) as last_observed_at
  from public.aml_uaf_entity_reporting_observation_0620 o
  group by o.rut
), recent as (
  select o.rut,
         sum(coalesce(o.ros_count,0)) filter (where o.period_end >= current_date - interval '365 days')::bigint as ros_12m,
         sum(coalesce(o.roe_count,0)) filter (where o.period_end >= current_date - interval '365 days')::bigint as roe_12m,
         sum(coalesce(o.roe_operation_count,0)) filter (where o.period_end >= current_date - interval '365 days')::bigint as roe_operations_12m
  from public.aml_uaf_entity_reporting_observation_0620 o
  group by o.rut
)
select s.rut,s.entity_id,coalesce(s.registry_name,s.entity_name) as entity_name,
       s.uaf_sector_canonical,
       case when o.rut is null then 'NOT_MATERIALIZED' else 'OBSERVED' end as behavior_source_state,
       o.observed_periods,o.first_period_start,o.last_period_end,
       o.ros_total,o.roe_total,o.roe_operation_total,
       r.ros_12m,r.roe_12m,r.roe_operations_12m,
       o.source_cutoff_date,o.last_observed_at,
       case when o.rut is null then null else percent_rank() over (partition by s.uaf_sector_canonical order by coalesce(r.ros_12m,0)) end as ros_12m_sector_percentile,
       case when o.rut is null then null else percent_rank() over (partition by s.uaf_sector_canonical order by coalesce(r.roe_12m,0)) end as roe_12m_sector_percentile
from public.aml_uaf_obligated_subject_snapshot s
left join obs o on o.rut=s.rut
left join recent r on r.rut=s.rut;

grant select on public.aml_v_uaf_entity_reporting_behavior_0620 to authenticated;
revoke all on public.aml_v_uaf_entity_reporting_behavior_0620 from anon;

create or replace view public.aml_v_uaf_reporting_integrity_0620 as
select
  count(*)::int as registered_subjects,
  count(*) filter (where reporting_rule_mapped)::int as mapped_reporting_rule,
  count(*) filter (where not reporting_rule_mapped)::int as pending_reporting_rule,
  count(*) filter (where rule_match_method='GOVERNED_ALIAS')::int as mapped_by_governed_alias,
  (select count(*)::int from public.aml_uaf_entity_reporting_observation_0620) as behavior_observation_rows,
  (select count(distinct rut)::int from public.aml_uaf_entity_reporting_observation_0620) as behavior_entities,
  now() as checked_at
from public.aml_v_uaf_reporting_obligation_0620;

grant select on public.aml_v_uaf_reporting_integrity_0620 to authenticated;
revoke all on public.aml_v_uaf_reporting_integrity_0620 from anon;

commit;
