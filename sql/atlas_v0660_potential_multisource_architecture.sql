-- ATLAS AML 0.66 · arquitectura multisource para Potenciales SO
-- Permite que SII, RES y futuras fuentes produzcan candidatos sin reemplazar ni recortar el universo base.
-- La mera presencia en RES NO califica como potencial SO: RES debe emitir evidencia vinculada a una categoría/actividad de la Ley 19.913.

begin;

create table if not exists public.aml_uaf_potential_source_registry_v0660 (
  source_id text primary key,
  source_name text not null,
  producer_kind text not null,
  enabled boolean not null default true,
  may_add_candidates boolean not null default true,
  qualification_rule text not null,
  current_cutoff text,
  declared_candidate_count bigint,
  materialized_candidate_count bigint not null default 0,
  source_status text not null default 'READY',
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.aml_uaf_potential_candidate_evidence_v0660 (
  evidence_id uuid primary key default gen_random_uuid(),
  source_id text not null references public.aml_uaf_potential_source_registry_v0660(source_id),
  source_candidate_key text not null,
  rut text not null,
  entity_id text,
  legal_name text,
  candidate_status text not null check (candidate_status in ('ELIGIBLE','PENDING_VALIDATION','CONTEXT_ONLY','REJECTED')),
  qualifying_rule text not null,
  implied_sectors text[] not null default '{}'::text[],
  evidence_type text not null,
  evidence_payload jsonb not null default '{}'::jsonb,
  source_reference text,
  source_url text,
  source_cutoff text,
  confidence numeric,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  unique(source_id,source_candidate_key)
);

create index if not exists aml_uaf_potential_candidate_evidence_v0660_rut_idx on public.aml_uaf_potential_candidate_evidence_v0660(rut);
create index if not exists aml_uaf_potential_candidate_evidence_v0660_source_idx on public.aml_uaf_potential_candidate_evidence_v0660(source_id,candidate_status,active);
create index if not exists aml_uaf_potential_candidate_evidence_v0660_entity_idx on public.aml_uaf_potential_candidate_evidence_v0660(entity_id) where entity_id is not null;

insert into public.aml_uaf_potential_source_registry_v0660
(source_id,source_name,producer_kind,enabled,may_add_candidates,qualification_rule,current_cutoff,declared_candidate_count,materialized_candidate_count,source_status,notes,updated_at)
values
('SII_ACTECO','SII · actividades económicas vigentes','DETERMINISTIC_ACTIVITY',true,true,'ACTECO relacionado con categorías Ley 19.913 (candidate_use=SI) + ACTIVE_AS_PUBLISHED + RUT no observado en padrón UAF','2026-05',79449,0,'BASELINE_DECLARED','Fuente base del universo amplio; el total declarado permanece como piso hasta materializar los RUT individuales.',now()),
('RES','Registro de Empresas y Sociedades','CORPORATE_REGISTRY',true,true,'RES puede proponer candidatos sólo cuando un adaptador produce evidencia vinculante con una categoría/actividad de la Ley 19.913. La mera existencia de una sociedad en RES no basta.',null,null,0,'ADAPTER_READY','Preparado para recibir candidatos RES, deduplicarlos por RUT y conservar evidencia/proveniencia.',now())
on conflict(source_id) do update set source_name=excluded.source_name,producer_kind=excluded.producer_kind,enabled=excluded.enabled,may_add_candidates=excluded.may_add_candidates,qualification_rule=excluded.qualification_rule,current_cutoff=coalesce(excluded.current_cutoff,public.aml_uaf_potential_source_registry_v0660.current_cutoff),declared_candidate_count=coalesce(excluded.declared_candidate_count,public.aml_uaf_potential_source_registry_v0660.declared_candidate_count),source_status=excluded.source_status,notes=excluded.notes,updated_at=now();

drop view if exists public.aml_v_uaf_potential_multisource_current_v0660;
create view public.aml_v_uaf_potential_multisource_current_v0660 as
with eligible as (
  select e.* from public.aml_uaf_potential_candidate_evidence_v0660 e
  join public.aml_uaf_potential_source_registry_v0660 s on s.source_id=e.source_id
  where e.active and s.enabled and s.may_add_candidates and e.candidate_status='ELIGIBLE'
), grouped as (
  select e.rut,
    max(e.entity_id) filter(where e.entity_id is not null) entity_id,
    max(e.legal_name) filter(where e.legal_name is not null and e.legal_name<>'') legal_name,
    count(*)::integer evidence_count,
    count(distinct e.source_id)::integer source_count,
    array_agg(distinct e.source_id order by e.source_id) candidate_sources,
    array_agg(distinct e.evidence_type order by e.evidence_type) evidence_types,
    coalesce(array_agg(distinct sec order by sec) filter(where sec is not null),'{}'::text[]) implied_sectors,
    max(e.confidence) max_confidence,min(e.first_seen_at) first_seen_at,max(e.last_seen_at) last_seen_at,max(e.refreshed_at) refreshed_at
  from eligible e left join lateral unnest(e.implied_sectors) sec on true group by e.rut
)
select g.*,(r.rut is not null) res_available,r.constitution_date res_constitution_date,r.company_code res_company_code,
'MULTISOURCE_SCREENING_HYPOTHESIS_NOT_PROVEN_OBLIGATION'::text semantics
from grouped g
left join public.aml_res_entity_profile_v1 r on r.rut=g.rut
left join public.aml_uaf_obligated_subject_snapshot u on u.rut=g.rut
where u.rut is null;

drop view if exists public.aml_v_uaf_potential_architecture_status_v0660;
create view public.aml_v_uaf_potential_architecture_status_v0660 as
with actual as (
 select source_id,count(*) filter(where active and candidate_status='ELIGIBLE')::bigint eligible_evidence_rows,
 count(distinct rut) filter(where active and candidate_status='ELIGIBLE')::bigint eligible_ruts
 from public.aml_uaf_potential_candidate_evidence_v0660 group by source_id
), unioned as (select count(*)::bigint unified_materialized_ruts from public.aml_v_uaf_potential_multisource_current_v0660),
base as (
 select coalesce(max(s.declared_candidate_count) filter(where s.source_id='SII_ACTECO'),0)::bigint sii_declared,
 coalesce(max(a.eligible_ruts) filter(where s.source_id='SII_ACTECO'),0)::bigint sii_materialized,
 coalesce(max(a.eligible_ruts) filter(where s.source_id='RES'),0)::bigint res_materialized
 from public.aml_uaf_potential_source_registry_v0660 s left join actual a using(source_id)
)
select s.source_id,s.source_name,s.producer_kind,s.enabled,s.may_add_candidates,s.qualification_rule,s.current_cutoff,s.declared_candidate_count,
coalesce(a.eligible_ruts,0)::bigint eligible_materialized_ruts,coalesce(a.eligible_evidence_rows,0)::bigint eligible_evidence_rows,s.source_status,s.notes,s.updated_at,
b.sii_declared baseline_declared_ruts,b.sii_materialized baseline_materialized_ruts,b.res_materialized res_materialized_ruts,u.unified_materialized_ruts,
(b.sii_declared>0 and b.sii_materialized>=b.sii_declared) unified_count_authoritative,
case when b.sii_declared>0 and b.sii_materialized>=b.sii_declared then u.unified_materialized_ruts else b.sii_declared end display_floor_ruts
from public.aml_uaf_potential_source_registry_v0660 s left join actual a using(source_id) cross join base b cross join unioned u;

alter table public.aml_uaf_potential_source_registry_v0660 enable row level security;
alter table public.aml_uaf_potential_candidate_evidence_v0660 enable row level security;
revoke all on public.aml_uaf_potential_source_registry_v0660 from anon;
revoke all on public.aml_uaf_potential_candidate_evidence_v0660 from anon;
revoke insert,update,delete on public.aml_uaf_potential_source_registry_v0660 from authenticated;
revoke insert,update,delete on public.aml_uaf_potential_candidate_evidence_v0660 from authenticated;
grant select on public.aml_uaf_potential_source_registry_v0660,public.aml_uaf_potential_candidate_evidence_v0660,public.aml_v_uaf_potential_multisource_current_v0660,public.aml_v_uaf_potential_architecture_status_v0660 to authenticated;

drop policy if exists aml_uaf_potential_source_registry_v0660_allowed_read on public.aml_uaf_potential_source_registry_v0660;
create policy aml_uaf_potential_source_registry_v0660_allowed_read on public.aml_uaf_potential_source_registry_v0660 for select using (exists(select 1 from public.aml_allowed_users au where au.user_id=(select auth.uid()) and au.enabled));
drop policy if exists aml_uaf_potential_candidate_evidence_v0660_allowed_read on public.aml_uaf_potential_candidate_evidence_v0660;
create policy aml_uaf_potential_candidate_evidence_v0660_allowed_read on public.aml_uaf_potential_candidate_evidence_v0660 for select using (exists(select 1 from public.aml_allowed_users au where au.user_id=(select auth.uid()) and au.enabled));

commit;
