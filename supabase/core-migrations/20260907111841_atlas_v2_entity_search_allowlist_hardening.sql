create schema if not exists atlas_v2_private;

create or replace function atlas_v2_private.entity_search(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_q text := btrim(coalesce(p_request->>'search',''));
  v_qkey text;
  v_rut_compact text;
  v_limit integer := least(greatest(coalesce(nullif(p_request->>'limit','')::integer, 20), 1), 50);
  v_offset integer := greatest(coalesce(nullif(p_request->>'offset','')::integer, 0), 0);
  v_items jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u where u.user_id = auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode = '42501';
  end if;

  if length(v_q) < 2 or length(v_q) > 180 then
    return jsonb_build_object(
      'schema','ATLAS_ENTITY_SEARCH_V2','kind','results','generated_at',now(),'items','[]'::jsonb,
      'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',0),
      'semantics',jsonb_build_object('query_status','INVALID_OR_TOO_SHORT')
    );
  end if;

  v_qkey := upper(translate(v_q,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNAEIOUUN'));
  v_qkey := btrim(regexp_replace(regexp_replace(v_qkey, '[^A-Z0-9K]+', ' ', 'g'), '\s+', ' ', 'g'));
  v_rut_compact := regexp_replace(upper(v_q), '[^0-9K]', '', 'g');

  with canonical as (
    select r.entity_id,r.rut,r.name,r.entity_type,r.region,r.commune,r.source_count,r.source_identity_confidence,
      r.name as matched_label,
      case when lower(r.entity_id) like 'entity:press:%' then 'PRESS' else 'CANONICAL' end as match_source,
      case when regexp_replace(upper(coalesce(r.rut,'')), '[^0-9K]', '', 'g') = v_rut_compact and length(v_rut_compact) >= 7 then 'rut_exact'
           when r.resolution_key = v_qkey then 'name_exact'
           when r.resolution_key like v_qkey || '%' then 'name_prefix' else 'name_fuzzy' end as match_type,
      case when regexp_replace(upper(coalesce(r.rut,'')), '[^0-9K]', '', 'g') = v_rut_compact and length(v_rut_compact) >= 7 then 1.0
           when r.resolution_key = v_qkey then 0.99
           when r.resolution_key like v_qkey || '%' then greatest(0.88, extensions.similarity(r.resolution_key, v_qkey))
           else extensions.similarity(r.resolution_key, v_qkey) end::numeric as match_score,
      null::text as registry_class
    from public.aml_entity_resolution_index_v1 r
    where (length(v_rut_compact) >= 7 and regexp_replace(upper(coalesce(r.rut,'')), '[^0-9K]', '', 'g') = v_rut_compact)
       or r.resolution_key = v_qkey or r.resolution_key like v_qkey || '%' or r.resolution_key OPERATOR(extensions.%) v_qkey
    order by match_score desc, r.source_count desc nulls last, r.name
    limit least(v_limit * 4, 120)
  ),
  uaf_alias as (
    select r.entity_id,r.rut,r.name,r.entity_type,r.region,r.commune,r.source_count,r.source_identity_confidence,
      u.registry_name as matched_label,'UAF_NAME'::text as match_source,
      case when u.resolution_key = v_qkey then 'alias_exact' else 'alias_prefix' end as match_type,
      case when u.resolution_key = v_qkey then 0.985 else 0.86 end::numeric as match_score,
      u.registry_class
    from public.aml_uaf_registry_name_index_v0712 u
    join public.aml_entity_resolution_index_v1 r on r.rut=u.rut
    where u.resolution_key = v_qkey or u.resolution_key like v_qkey || '%'
    order by match_score desc, r.source_count desc nulls last, r.name
    limit least(v_limit * 2, 80)
  ),
  ranked as (
    select *, row_number() over (
      partition by entity_id
      order by match_score desc, case match_source when 'CANONICAL' then 0 when 'UAF_NAME' then 1 else 2 end
    ) as rn
    from (select * from canonical union all select * from uaf_alias) x
    where match_score >= case when length(v_qkey) <= 3 then 0.72 else 0.30 end
  ),
  page_rows as (
    select * from ranked where rn=1
    order by match_score desc, source_count desc nulls last, name
    offset v_offset limit v_limit
  ),
  enriched as (
    select p.*,
      coalesce(m.profile->'fuentes','[]'::jsonb) as sources,
      coalesce(m.profile->'roles','[]'::jsonb) as roles,
      case when coalesce(m.profile->>'event_count','') ~ '^\d+$' then (m.profile->>'event_count')::integer else null end as event_count
    from page_rows p
    left join public.aml_entity_master_v0553 m on m.entity_id=p.entity_id
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'entity_id',entity_id,'rut',rut,'name',name,'entity_type',entity_type,'region',region,'commune',commune,
    'source_count',source_count,'identity_confidence',source_identity_confidence,'matched_label',matched_label,
    'match_source',case when sources ? 'RADAR_PRENSA' then 'PRESS' else match_source end,
    'match_type',match_type,'match_score',round(match_score,4),'registry_class',registry_class,
    'sources',sources,'roles',roles,'event_count',event_count
  )) order by match_score desc, source_count desc nulls last, name),'[]'::jsonb)
  into v_items from enriched;

  return jsonb_build_object(
    'schema','ATLAS_ENTITY_SEARCH_V2','kind','results','generated_at',now(),'items',v_items,
    'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',jsonb_array_length(v_items)),
    'semantics',jsonb_build_object(
      'priority_not_probability',true,
      'match_not_identity_assertion',true,
      'sources',jsonb_build_array('CANONICAL','UAF_NAME','PRESS'),
      'query',v_q
    )
  );
end;
$$;

create or replace function public.atlas_v2_entity_search(p_request jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$ select atlas_v2_private.entity_search(p_request); $$;

revoke all on function atlas_v2_private.entity_search(jsonb) from public, anon;
revoke all on function public.atlas_v2_entity_search(jsonb) from public, anon;
grant execute on function atlas_v2_private.entity_search(jsonb) to authenticated, service_role;
grant execute on function public.atlas_v2_entity_search(jsonb) to authenticated, service_role;
