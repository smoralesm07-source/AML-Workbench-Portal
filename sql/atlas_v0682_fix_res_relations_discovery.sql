-- ATLAS AML 0.68.2 · corrección del preset RES_RELATIONS
-- Debe ejecutarse después de atlas_v0680_res_entity_context.sql.
-- La salida de la función se llama entity_id; por ello la agregación interna
-- debe calificar explícitamente rr.entity_id para evitar ambigüedad PL/pgSQL.

create or replace function public.aml_entity_res_discovery_v0680(
  p_preset text,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(
  entity_id text,
  rut text,
  name text,
  entity_type text,
  region text,
  commune text,
  res_constitution_date date,
  res_company_code text,
  sii_current_status text,
  uaf_state text,
  potential_so_current boolean,
  mp_order_count bigint,
  mp_total_clp numeric,
  res_relationship_count integer,
  preset_reason text
)
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  v_preset text := upper(coalesce(p_preset,''));
  v_limit integer := least(greatest(coalesce(p_limit,25),1),50);
  v_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if v_preset='RES_SII' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
           coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
           coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
           case when u.rut is not null then 'OBSERVADO_UAF' else 'NO_OBSERVADO_UAF' end,(p.rut is not null),
           null::bigint,null::numeric,
           coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel0 where rel0.entity_id=b.entity_id),0),
           'Identidad presente por RUT exacto en RES y padrón SII'::text
    from public.aml_res_company r
    join public.aml_res_entity_bridge b on b.rut=r.rut
    join public.aml_sii_registry_company s on s.rut=r.rut
    left join public.aml_entities e on e.entity_id=b.entity_id
    left join public.aml_uaf_obligated_subject_snapshot u on u.rut=r.rut
    left join public.aml_uaf_potential_registry_snapshot_v0650 p on p.rut=r.rut
    limit v_limit offset v_offset;

  elsif v_preset='RES_UAF' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
           coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
           coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
           'OBSERVADO_UAF'::text,false,null::bigint,null::numeric,
           coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel0 where rel0.entity_id=b.entity_id),0),
           ('RES + padrón UAF · '||coalesce(u.uaf_sector_canonical,u.uaf_sector,'sector no materializado'))::text
    from public.aml_uaf_obligated_subject_snapshot u
    join public.aml_res_company r on r.rut=u.rut
    join public.aml_res_entity_bridge b on b.rut=r.rut
    left join public.aml_sii_registry_company s on s.rut=r.rut
    left join public.aml_entities e on e.entity_id=b.entity_id
    limit v_limit offset v_offset;

  elsif v_preset='RES_MP' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
           coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
           coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
           case when u.rut is not null then 'OBSERVADO_UAF' else 'NO_OBSERVADO_UAF' end,(p.rut is not null),
           mp.order_count,mp.total_clp,
           coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel0 where rel0.entity_id=b.entity_id),0),
           'RES + órdenes de compra de Mercado Público 2023–2026 por RUT exacto'::text
    from public.aml_entity_mp_summary_v0680 mp
    join public.aml_res_company r on r.rut_key=mp.rut_key
    join public.aml_res_entity_bridge b on b.rut=r.rut
    left join public.aml_sii_registry_company s on s.rut=r.rut
    left join public.aml_entities e on e.entity_id=b.entity_id
    left join public.aml_uaf_obligated_subject_snapshot u on u.rut=r.rut
    left join public.aml_uaf_potential_registry_snapshot_v0650 p on p.rut=r.rut
    limit v_limit offset v_offset;

  elsif v_preset='RES_POTENTIAL_SO' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
           coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
           coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
           'NO_OBSERVADO_UAF'::text,true,null::bigint,null::numeric,
           coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel0 where rel0.entity_id=b.entity_id),0),
           'RES + screening potencial SO vigente; no equivale a incumplimiento'::text
    from public.aml_uaf_potential_registry_snapshot_v0650 p
    join public.aml_res_company r on r.rut=p.rut
    join public.aml_res_entity_bridge b on b.rut=r.rut
    left join public.aml_sii_registry_company s on s.rut=r.rut
    left join public.aml_entities e on e.entity_id=b.entity_id
    where coalesce(p.uaf_registered_exact,false)=false
    limit v_limit offset v_offset;

  elsif v_preset='RES_RELATIONS' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
           coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
           coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
           case when u.rut is not null then 'OBSERVADO_UAF' else 'NO_OBSERVADO_UAF' end,(p.rut is not null),
           null::bigint,null::numeric,rel.rel_count::integer,
           'RES con relaciones societarias respaldadas por evidencia documental'::text
    from (
      select rr.entity_id,count(*)::bigint rel_count
      from public.aml_entity_res_relationship_v0553 rr
      group by rr.entity_id
    ) rel
    join public.aml_res_entity_bridge b on b.entity_id=rel.entity_id
    join public.aml_res_company r on r.rut=b.rut
    left join public.aml_sii_registry_company s on s.rut=r.rut
    left join public.aml_entities e on e.entity_id=b.entity_id
    left join public.aml_uaf_obligated_subject_snapshot u on u.rut=r.rut
    left join public.aml_uaf_potential_registry_snapshot_v0650 p on p.rut=r.rut
    limit v_limit offset v_offset;
  end if;
  return;
end;
$$;
