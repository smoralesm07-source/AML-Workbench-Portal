-- ATLAS AML 0.68 · Contexto RES multifuente
-- Alcance: descriptivo, RUT exacto, sin scoring ni inferencias AML.
-- Fuera de Atlas por decisión de producto: intensidad temprana, vida corta,
-- cambios alrededor de eventos, ratios capital/magnitud, clusters territoriales,
-- beneficiario final probabilístico e índice de complejidad societaria.

create or replace view public.aml_entity_mp_summary_v0680
with (security_invoker=true)
as
select
  upper(regexp_replace(supplier_rut,'[^0-9Kk]','','g')) as rut_key,
  max(supplier_name) as supplier_name,
  count(*)::bigint as order_count,
  count(distinct buyer_rut) filter (where buyer_rut is not null)::bigint as buyer_count,
  sum(coalesce(clp_amount,0::numeric))::numeric as total_clp,
  min(order_date)::date as first_order_date,
  max(order_date)::date as last_order_date,
  count(*) filter (where purchase_mechanism ilike '%direct%')::bigint as direct_order_count
from public.aml_mp_order_fact
where order_date >= date '2023-01-01'
  and order_date < date '2027-01-01'
  and supplier_rut is not null
group by upper(regexp_replace(supplier_rut,'[^0-9Kk]','','g'));

revoke all on public.aml_entity_mp_summary_v0680 from anon;
grant select on public.aml_entity_mp_summary_v0680 to authenticated, service_role;

create or replace view public.aml_entity_lifecycle_v0680
with (security_invoker=true)
as
select * from (
  select t.entity_id,t.actuation_date::date as event_date,
    ('RES_'||coalesce(nullif(upper(regexp_replace(t.actuation_type,'[^A-Za-z0-9]+','_','g')),''),'ACTUACION'))::text as event_type,
    coalesce(nullif(t.actuation_type,''),'Actuación societaria RES')::text as event_label,
    'RES'::text as source_system,
    ('Registro '||coalesce(t.registry_date::text,'sin fecha adicional'))::text as source_detail,
    t.public_document_url::text as source_url,'DOCUMENTADO'::text as evidence_status,t.refreshed_at::timestamptz as refreshed_at
  from public.aml_entity_res_timeline_v0553 t where t.actuation_date is not null

  union all
  select b.entity_id,r.constitution_date::date,'RES_CONSTITUCION'::text,'Constitución societaria'::text,'RES'::text,
    concat_ws(' · ',nullif(r.company_code,''),nullif(r.legal_name,''))::text,null::text,'DOCUMENTADO'::text,r.refreshed_at::timestamptz
  from public.aml_res_company r join public.aml_res_entity_bridge b on b.rut=r.rut
  where r.constitution_date is not null and not exists (
    select 1 from public.aml_entity_res_timeline_v0553 t where t.entity_id=b.entity_id and t.actuation_date is not null)

  union all
  select b.entity_id,s.activity_start_date::date,'SII_INICIO_ACTIVIDADES'::text,'Inicio de actividades ante SII'::text,'SII'::text,
    s.legal_name::text,null::text,'PUBLICADO'::text,s.refreshed_at::timestamptz
  from public.aml_sii_registry_company s join public.aml_res_entity_bridge b on b.rut=s.rut
  where s.activity_start_date is not null

  union all
  select b.entity_id,s.termination_date::date,'SII_TERMINO_GIRO'::text,'Término de giro publicado por SII'::text,'SII'::text,
    coalesce(s.current_status,'TERMINATED_AS_PUBLISHED')::text,null::text,'PUBLICADO'::text,s.refreshed_at::timestamptz
  from public.aml_sii_registry_company s join public.aml_res_entity_bridge b on b.rut=s.rut
  where s.termination_date is not null

  union all
  select b.entity_id,u.registry_observed_at::date,'UAF_PADRON_OBSERVADO'::text,'Presente en padrón UAF del corte'::text,'UAF'::text,
    coalesce(u.uaf_sector_canonical,u.uaf_sector,'Sector no materializado')::text,u.registry_source_ref::text,
    'OBSERVADO_EN_CORTE'::text,u.refreshed_at::timestamptz
  from public.aml_uaf_obligated_subject_snapshot u join public.aml_res_entity_bridge b on b.rut=u.rut
  where u.registry_observed_at is not null

  union all
  select b.entity_id,mp.first_order_date::date,'MP_PRIMERA_ORDEN_2023_2026'::text,
    'Primera orden de compra registrada (2023–2026)'::text,'MERCADO_PUBLICO'::text,
    concat(mp.order_count::text,' órdenes · ',mp.buyer_count::text,' compradores')::text,null::text,'RUT_EXACTO'::text,r.refreshed_at::timestamptz
  from public.aml_entity_mp_summary_v0680 mp
  join public.aml_res_company r on r.rut_key=mp.rut_key
  join public.aml_res_entity_bridge b on b.rut=r.rut
  where mp.first_order_date is not null
) e;

revoke all on public.aml_entity_lifecycle_v0680 from anon;
grant select on public.aml_entity_lifecycle_v0680 to authenticated, service_role;

create or replace function public.aml_entity_res_discovery_v0680(p_preset text,p_limit integer default 25,p_offset integer default 0)
returns table(entity_id text,rut text,name text,entity_type text,region text,commune text,res_constitution_date date,
  res_company_code text,sii_current_status text,uaf_state text,potential_so_current boolean,mp_order_count bigint,
  mp_total_clp numeric,res_relationship_count integer,preset_reason text)
language plpgsql stable security invoker set search_path=public
as $$
declare
  v_preset text:=upper(coalesce(p_preset,''));
  v_limit integer:=least(greatest(coalesce(p_limit,25),1),50);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if v_preset='RES_SII' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
      coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
      coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
      case when u.rut is not null then 'OBSERVADO_UAF' else 'NO_OBSERVADO_UAF' end,(p.rut is not null),null::bigint,null::numeric,
      coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel where rel.entity_id=b.entity_id),0),
      'Identidad presente por RUT exacto en RES y padrón SII'::text
    from public.aml_res_company r join public.aml_res_entity_bridge b on b.rut=r.rut
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
      coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel where rel.entity_id=b.entity_id),0),
      ('RES + padrón UAF · '||coalesce(u.uaf_sector_canonical,u.uaf_sector,'sector no materializado'))::text
    from public.aml_uaf_obligated_subject_snapshot u join public.aml_res_company r on r.rut=u.rut
    join public.aml_res_entity_bridge b on b.rut=r.rut
    left join public.aml_sii_registry_company s on s.rut=r.rut left join public.aml_entities e on e.entity_id=b.entity_id
    limit v_limit offset v_offset;
  elsif v_preset='RES_MP' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
      coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
      coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
      case when u.rut is not null then 'OBSERVADO_UAF' else 'NO_OBSERVADO_UAF' end,(p.rut is not null),mp.order_count,mp.total_clp,
      coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel where rel.entity_id=b.entity_id),0),
      'RES + órdenes de compra de Mercado Público 2023–2026 por RUT exacto'::text
    from public.aml_entity_mp_summary_v0680 mp join public.aml_res_company r on r.rut_key=mp.rut_key
    join public.aml_res_entity_bridge b on b.rut=r.rut left join public.aml_sii_registry_company s on s.rut=r.rut
    left join public.aml_entities e on e.entity_id=b.entity_id left join public.aml_uaf_obligated_subject_snapshot u on u.rut=r.rut
    left join public.aml_uaf_potential_registry_snapshot_v0650 p on p.rut=r.rut
    limit v_limit offset v_offset;
  elsif v_preset='RES_POTENTIAL_SO' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
      coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
      coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
      'NO_OBSERVADO_UAF'::text,true,null::bigint,null::numeric,
      coalesce((select count(*)::integer from public.aml_entity_res_relationship_v0553 rel where rel.entity_id=b.entity_id),0),
      'RES + screening potencial SO vigente; no equivale a incumplimiento'::text
    from public.aml_uaf_potential_registry_snapshot_v0650 p join public.aml_res_company r on r.rut=p.rut
    join public.aml_res_entity_bridge b on b.rut=r.rut left join public.aml_sii_registry_company s on s.rut=r.rut
    left join public.aml_entities e on e.entity_id=b.entity_id where coalesce(p.uaf_registered_exact,false)=false
    limit v_limit offset v_offset;
  elsif v_preset='RES_RELATIONS' then
    return query
    select b.entity_id,r.rut,r.legal_name,coalesce(e.entity_type,'Persona jurídica'),
      coalesce(e.region,case when r.social_region is not null then 'Región '||r.social_region::text end),
      coalesce(e.commune,r.social_commune,r.tax_commune),r.constitution_date,r.company_code,s.current_status,
      case when u.rut is not null then 'OBSERVADO_UAF' else 'NO_OBSERVADO_UAF' end,(p.rut is not null),null::bigint,null::numeric,
      rel.rel_count::integer,'RES con relaciones societarias respaldadas por evidencia documental'::text
    from (select entity_id,count(*)::bigint rel_count from public.aml_entity_res_relationship_v0553 group by entity_id) rel
    join public.aml_res_entity_bridge b on b.entity_id=rel.entity_id join public.aml_res_company r on r.rut=b.rut
    left join public.aml_sii_registry_company s on s.rut=r.rut left join public.aml_entities e on e.entity_id=b.entity_id
    left join public.aml_uaf_obligated_subject_snapshot u on u.rut=r.rut
    left join public.aml_uaf_potential_registry_snapshot_v0650 p on p.rut=r.rut
    limit v_limit offset v_offset;
  end if;
  return;
end;
$$;

revoke all on function public.aml_entity_res_discovery_v0680(text,integer,integer) from public, anon;
grant execute on function public.aml_entity_res_discovery_v0680(text,integer,integer) to authenticated, service_role;

comment on view public.aml_entity_lifecycle_v0680 is 'ATLAS 0.68: línea de tiempo factual RES+SII+UAF+Mercado Público. No calcula riesgo ni anomalías.';
comment on function public.aml_entity_res_discovery_v0680(text,integer,integer) is 'ATLAS 0.68: consultas descriptivas por tablas fuente indexadas y RUT exacto. No altera scores ni afirma incumplimiento.';
