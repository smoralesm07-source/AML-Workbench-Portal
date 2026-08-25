-- ATLAS AML 0.64.0 · RES como fuente formadora del Entity Master
-- Identidad: RUT exacto/canónico únicamente. El nombre nunca promueve identidad.
-- Este archivo documenta el estado aplicado en Supabase mediante la migración
-- res_federated_entity_master_v0620.

create table if not exists public.aml_entity_classification_override_v0620 (
  entity_id text primary key references public.aml_entities(entity_id) on delete cascade,
  original_type text not null,
  effective_type text not null,
  basis text not null,
  source_system text not null,
  source_rut text not null,
  source_company_code text,
  evidence jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now()
);
alter table public.aml_entity_classification_override_v0620 enable row level security;
revoke all on public.aml_entity_classification_override_v0620 from anon;
revoke all on public.aml_entity_classification_override_v0620 from authenticated;
grant select on public.aml_entity_classification_override_v0620 to authenticated;
grant all on public.aml_entity_classification_override_v0620 to service_role;
drop policy if exists aml_entity_classification_override_v0620_allowed_read on public.aml_entity_classification_override_v0620;
create policy aml_entity_classification_override_v0620_allowed_read
on public.aml_entity_classification_override_v0620
for select to authenticated
using (exists (select 1 from public.aml_allowed_users au where au.user_id=(select auth.uid()) and au.enabled));

-- Corrección gobernada: si un RUT clasificado OSFL figura en RES como EIRL,
-- SpA o SRL, RES resuelve la forma jurídica. Se conserva RADAR_OSFL en fuentes.
insert into public.aml_entity_classification_override_v0620(entity_id,original_type,effective_type,basis,source_system,source_rut,source_company_code,evidence)
select e.entity_id,e.entity_type,'Persona jurídica','RES_RUT_EXACTO_FORMA_SOCIETARIA','RES',c.rut,c.company_code,
       jsonb_build_object('legal_name',c.legal_name,'company_code',c.company_code,'constitution_date',c.constitution_date,'source_snapshot_id',c.source_snapshot_id,'preserve_source_evidence',true)
from public.aml_entities e
join public.aml_res_company c on c.rut=e.rut
where e.entity_type='OSFL' and c.company_code in ('EIRL','SpA','SRL')
on conflict (entity_id) do update set
  effective_type=excluded.effective_type,basis=excluded.basis,source_system=excluded.source_system,
  source_rut=excluded.source_rut,source_company_code=excluded.source_company_code,
  evidence=excluded.evidence,applied_at=now();

-- El bridge pasa a representar IDs del maestro lógico, no sólo filas físicas de
-- aml_entities. Por eso el FK hacia la tabla base deja de ser correcto.
alter table public.aml_res_entity_bridge drop constraint if exists aml_res_entity_bridge_entity_id_fkey;
create unique index if not exists aml_res_entity_bridge_entity_id_uidx on public.aml_res_entity_bridge(entity_id);

create or replace function public.refresh_aml_res_entity_bridge_v1()
returns integer
language plpgsql
security invoker
set search_path=public
as $$
declare n integer;
begin
  delete from public.aml_res_entity_bridge b
  where not exists (select 1 from public.aml_res_company c where c.rut=b.rut);

  insert into public.aml_res_entity_bridge(rut,entity_id,match_method,confidence,refreshed_at)
  select c.rut,
         coalesce(e.entity_id,'ENT-RUT-'||c.rut),
         case when e.entity_id is not null then 'RUT_EXACTO' else 'RES_RUT_CANONICO' end,
         1.0,now()
  from public.aml_res_company c
  left join public.aml_entities e on e.rut=c.rut
  on conflict (rut) do update set
    entity_id=excluded.entity_id,match_method=excluded.match_method,
    confidence=excluded.confidence,refreshed_at=excluded.refreshed_at;
  get diagnostics n = row_count;
  return n;
end;
$$;

create index if not exists aml_res_relationship_company_rut_idx on public.aml_res_relationship(company_rut);

create or replace view public.aml_res_entity_profile_v1
with (security_invoker=true)
as
with rel as (
  select rr.company_rut,count(*)::integer as relationship_count,
         count(*) filter (where rr.relationship_type in ('SOCIO_DE','ACCIONISTA_DE'))::integer as partner_count,
         count(*) filter (where rr.relationship_type in ('ADMINISTRA','REPRESENTA','DIRECTOR_DE'))::integer as admin_count
  from public.aml_res_relationship rr group by rr.company_rut
)
select b.entity_id,c.rut,c.legal_name,c.constitution_date,c.registry_date,c.sii_approval_date,c.company_code,c.capital,
       c.social_commune,c.social_region,c.tax_commune,c.tax_region,
       coalesce(rel.relationship_count,0) as relationship_count,
       coalesce(rel.partner_count,0) as partner_count,
       coalesce(rel.admin_count,0) as admin_count,
       c.source_snapshot_id,c.refreshed_at
from public.aml_res_company c
join public.aml_res_entity_bridge b on b.rut=c.rut
left join rel on rel.company_rut=c.rut;

-- La vista conserva el contrato histórico de columnas y suma un segundo brazo
-- para RUT RES que todavía no existen en aml_entities.
create or replace view public.aml_entity_master_v0553
with (security_invoker=true)
as
with base as (
  select e.entity_id,e.rut,e.name,coalesce(o.effective_type,e.entity_type) as entity_type,e.region,e.commune,e.source_count,
         e.source_count + case when r.entity_id is not null then 1 else 0 end as effective_source_count,
         e.is_uaf_observed,e.is_sanctioned,
         case when o.entity_id is null then e.profile else jsonb_set(jsonb_set(coalesce(e.profile,'{}'::jsonb),'{tipo_entidad}',to_jsonb('LEGAL_ENTITY'::text),true),'{tipo_entidad_es}',to_jsonb('Persona jurídica'::text),true) end as profile,
         e.snapshot_id,e.updated_at,r.entity_id is not null as res_available,
         r.legal_name as res_legal_name,r.constitution_date as res_constitution_date,r.registry_date as res_registry_date,
         r.sii_approval_date as res_sii_approval_date,r.company_code as res_company_code,r.capital as res_capital,
         r.social_commune as res_social_commune,r.social_region as res_social_region,r.tax_commune as res_tax_commune,r.tax_region as res_tax_region,
         r.relationship_count as res_relationship_count,r.partner_count as res_partner_count,r.admin_count as res_admin_count,
         s.cutoff_date as res_cutoff_date,s.source_updated_at as res_source_updated_at,s.resource_id as res_resource_id,s.resource_name as res_resource_name,s.status as res_snapshot_status,
         regexp_replace(upper(coalesce(e.rut,'')),'[^0-9K]','','g') as rut_key
  from public.aml_entities e
  left join public.aml_entity_classification_override_v0620 o on o.entity_id=e.entity_id
  left join public.aml_res_entity_profile_v1 r on r.entity_id=e.entity_id
  left join public.aml_res_source_snapshot s on s.snapshot_id=r.source_snapshot_id
), res_only as (
  select r.entity_id,r.rut,r.legal_name as name,'Persona jurídica'::text as entity_type,
         case coalesce(r.social_region,r.tax_region)
           when 1 then 'Tarapacá' when 2 then 'Antofagasta' when 3 then 'Atacama' when 4 then 'Coquimbo' when 5 then 'Valparaíso'
           when 6 then 'Libertador Gral. Bernardo O''Higgins' when 7 then 'Maule' when 8 then 'Biobío' when 9 then 'La Araucanía' when 10 then 'Los Lagos'
           when 11 then 'Aysén del General Carlos Ibáñez del Campo' when 12 then 'Magallanes y de la Antártica Chilena' when 13 then 'Metropolitana de Santiago'
           when 14 then 'Los Ríos' when 15 then 'Arica y Parinacota' when 16 then 'Ñuble' else null end as region,
         coalesce(r.social_commune,r.tax_commune) as commune,1::integer as source_count,1::integer as effective_source_count,
         false as is_uaf_observed,false as is_sanctioned,
         jsonb_build_object('entity_id',r.entity_id,'rut',r.rut,'nombre',r.legal_name,'tipo_entidad','LEGAL_ENTITY','tipo_entidad_es','Persona jurídica',
           'identity_method','RES_RUT_CANONICO','identity_method_es','RUT exacto · RES','identity_confidence',1,
           'roles',jsonb_build_array('ECONOMIC_ENTITY'),'roles_es',jsonb_build_array('Entidad económica'),'fuentes',jsonb_build_array('RES'),
           'eventos','[]'::jsonb,'senales','[]'::jsonb,'relaciones','[]'::jsonb,'evidence_ids','[]'::jsonb,'event_count',0,
           'aml',jsonb_build_object('score',null),'red',jsonb_build_object('degree',0,'component_id',null,'distance_to_nearest_signal',null,'direct_signal_neighbor_count',0),
           'ubicacion',jsonb_build_object('comuna',coalesce(r.social_commune,r.tax_commune),'geo_confidence',case when coalesce(r.social_region,r.tax_region) between 1 and 16 then 1 else null end),
           'contexto',jsonb_build_object('res',jsonb_build_object('company_code',r.company_code,'constitution_date',r.constitution_date,'capital',r.capital),'sujeto_obligado',false)) as profile,
         r.source_snapshot_id as snapshot_id,r.refreshed_at as updated_at,true as res_available,
         r.legal_name as res_legal_name,r.constitution_date as res_constitution_date,r.registry_date as res_registry_date,r.sii_approval_date as res_sii_approval_date,
         r.company_code as res_company_code,r.capital as res_capital,r.social_commune as res_social_commune,r.social_region as res_social_region,
         r.tax_commune as res_tax_commune,r.tax_region as res_tax_region,r.relationship_count as res_relationship_count,r.partner_count as res_partner_count,r.admin_count as res_admin_count,
         s.cutoff_date as res_cutoff_date,s.source_updated_at as res_source_updated_at,s.resource_id as res_resource_id,s.resource_name as res_resource_name,s.status as res_snapshot_status,
         regexp_replace(upper(coalesce(r.rut,'')),'[^0-9K]','','g') as rut_key
  from public.aml_res_entity_profile_v1 r
  left join public.aml_res_source_snapshot s on s.snapshot_id=r.source_snapshot_id
  where not exists (select 1 from public.aml_entities e where e.entity_id=r.entity_id)
)
select * from base union all select * from res_only;

grant select on public.aml_entity_master_v0553 to authenticated;
grant select on public.aml_res_entity_profile_v1 to authenticated;
