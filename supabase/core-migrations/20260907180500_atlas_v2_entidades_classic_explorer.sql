create or replace function atlas_v2_private.entity_search(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_kind text := lower(btrim(coalesce(p_request->>'kind','results')));
  v_mode text := lower(btrim(coalesce(p_request->>'mode','legacy_mixed')));
  v_q text := btrim(coalesce(p_request->>'search',''));
  v_qkey text;
  v_rut_compact text;
  v_limit integer := least(greatest(coalesce(nullif(p_request->>'limit','')::integer, 20), 1), 50);
  v_offset integer := greatest(coalesce(nullif(p_request->>'offset','')::integer, 0), 0);
  v_region text := btrim(coalesce(p_request->>'region',''));
  v_type text := btrim(coalesce(p_request->>'entity_type',''));
  v_uaf boolean := lower(coalesce(p_request->>'uaf','false')) in ('true','1','yes');
  v_sanctioned boolean := lower(coalesce(p_request->>'sanctioned','false')) in ('true','1','yes');
  v_min_sources integer := least(greatest(coalesce(nullif(p_request->>'min_sources','')::integer, 0), 0), 5);
  v_sort text := lower(btrim(coalesce(p_request->>'sort','coverage')));
  v_items jsonb := '[]'::jsonb;
  v_regions jsonb := '[]'::jsonb;
  v_types jsonb := '[]'::jsonb;
  v_quick jsonb := '{}'::jsonb;
  v_total bigint := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u where u.user_id = auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode = '42501';
  end if;

  if v_kind = 'explorer_meta' then
    select coalesce(jsonb_agg(jsonb_build_object('value',x.region,'count',x.n) order by x.n desc, x.region),'[]'::jsonb)
      into v_regions
    from (
      select e.region, count(*)::bigint n
      from public.aml_entities e
      where e.region is not null and btrim(e.region) <> ''
      group by e.region
    ) x;

    select coalesce(jsonb_agg(jsonb_build_object('value',x.entity_type,'count',x.n) order by x.n desc, x.entity_type),'[]'::jsonb)
      into v_types
    from (
      select e.entity_type, count(*)::bigint n
      from public.aml_entities e
      where e.entity_type is not null and btrim(e.entity_type) <> ''
      group by e.entity_type
    ) x;

    select jsonb_build_object(
      'total', count(*)::bigint,
      'uaf', count(*) filter (where e.is_uaf_observed is true)::bigint,
      'sanctioned', count(*) filter (where e.is_sanctioned is true)::bigint,
      'uaf_and_sanctioned', count(*) filter (where e.is_uaf_observed is true and e.is_sanctioned is true)::bigint,
      'multi_source_3', count(*) filter (where coalesce(e.source_count,0) >= 3)::bigint,
      'osfl', count(*) filter (where e.entity_type = 'OSFL')::bigint,
      'public_bodies', count(*) filter (where e.entity_type = 'Organismo público')::bigint
    ) into v_quick
    from public.aml_entities e;

    return jsonb_build_object(
      'schema','ATLAS_ENTITY_SEARCH_V2',
      'kind','explorer_meta',
      'generated_at',now(),
      'items','[]'::jsonb,
      'facets',jsonb_build_object('regions',v_regions,'entity_types',v_types,'quick_counts',v_quick),
      'page',jsonb_build_object('limit',0,'offset',0,'returned',0),
      'semantics',jsonb_build_object(
        'mode','ENTITY_EXPLORER_CLASSIC_V2',
        'coverage_not_risk',true,
        'priority_not_probability',true,
        'missing_not_zero',true
      )
    );
  end if;

  if v_kind = 'explorer' then
    if v_sort not in ('coverage','name','updated','priority') then v_sort := 'coverage'; end if;

    select count(*)::bigint into v_total
    from public.aml_entities e
    where (v_region = '' or e.region = v_region)
      and (v_type = '' or e.entity_type = v_type)
      and (not v_uaf or e.is_uaf_observed is true)
      and (not v_sanctioned or e.is_sanctioned is true)
      and coalesce(e.source_count,0) >= v_min_sources;

    with page_rows as (
      select
        e.entity_id,e.rut,e.name,e.entity_type,e.region,e.commune,e.source_count,e.is_uaf_observed,e.is_sanctioned,
        e.updated_at,
        coalesce(e.profile->'fuentes','[]'::jsonb) as sources,
        coalesce(e.profile->'roles_es',e.profile->'roles','[]'::jsonb) as roles,
        case when coalesce(e.profile->>'event_count','') ~ '^\d+$' then (e.profile->>'event_count')::integer else null end as event_count,
        case when coalesce(e.profile->>'identity_confidence','') ~ '^[0-9]+([.][0-9]+)?$' then (e.profile->>'identity_confidence')::numeric else null end as identity_confidence,
        s.ipa3_score,s.priority_band_shadow,s.registry_group_score,s.economic_group_score,s.sanctions_group_score,
        s.dominant_mark_id,s.score_confidence_pct,s.coverage_index_pct
      from public.aml_entities e
      left join public.aml_ipa3_entity_score_snapshot_v0_4 s on s.entity_id = e.entity_id
      where (v_region = '' or e.region = v_region)
        and (v_type = '' or e.entity_type = v_type)
        and (not v_uaf or e.is_uaf_observed is true)
        and (not v_sanctioned or e.is_sanctioned is true)
        and coalesce(e.source_count,0) >= v_min_sources
      order by
        case when v_sort='name' then e.name end asc nulls last,
        case when v_sort='updated' then e.updated_at end desc nulls last,
        case when v_sort='priority' then s.ipa3_score end desc nulls last,
        case when v_sort='coverage' then e.source_count end desc nulls last,
        e.name asc nulls last,
        e.entity_id
      offset v_offset limit v_limit
    )
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'entity_id',entity_id,'rut',rut,'name',name,'entity_type',entity_type,'region',region,'commune',commune,
      'source_count',source_count,'is_uaf_observed',is_uaf_observed,'is_sanctioned',is_sanctioned,'updated_at',updated_at,
      'identity_confidence',identity_confidence,'sources',sources,'roles',roles,'event_count',event_count,
      'ipa3_score',ipa3_score,'priority_band_shadow',priority_band_shadow,
      'registry_group_score',registry_group_score,'economic_group_score',economic_group_score,'sanctions_group_score',sanctions_group_score,
      'dominant_mark_id',dominant_mark_id,'score_confidence_pct',score_confidence_pct,'coverage_index_pct',coverage_index_pct,
      'result_tier','EXPLORER_ENTITY','tier_priority',2
    ))),'[]'::jsonb) into v_items
    from page_rows;

    return jsonb_build_object(
      'schema','ATLAS_ENTITY_SEARCH_V2',
      'kind','explorer',
      'generated_at',now(),
      'items',v_items,
      'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',jsonb_array_length(v_items),'total',v_total),
      'semantics',jsonb_build_object(
        'mode','ENTITY_EXPLORER_CLASSIC_V2',
        'coverage_not_risk',true,
        'priority_not_probability',true,
        'missing_not_zero',true,
        'filters',jsonb_build_object('region',nullif(v_region,''),'entity_type',nullif(v_type,''),'uaf',v_uaf,'sanctioned',v_sanctioned,'min_sources',v_min_sources,'sort',v_sort)
      )
    );
  end if;

  if length(v_q) >= 2 and length(v_q) <= 180 then
    v_qkey := upper(translate(v_q,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNAEIOUUN'));
    v_qkey := btrim(regexp_replace(regexp_replace(v_qkey, '[^A-Z0-9K]+', ' ', 'g'), '\s+', ' ', 'g'));
    v_rut_compact := regexp_replace(upper(v_q), '[^0-9K]', '', 'g');
  end if;

  if v_kind = 'suggest' then
    if length(v_q) < 2 or length(v_q) > 180 then
      return jsonb_build_object('schema','ATLAS_ENTITY_SEARCH_V2','kind','suggest','generated_at',now(),'items','[]'::jsonb,'page',jsonb_build_object('limit',7,'offset',0,'returned',0));
    end if;

    with suggestions as (
      select e.entity_id,e.rut,e.name,e.entity_type,e.region,e.commune,e.source_count,
        coalesce(e.profile->'fuentes','[]'::jsonb) as sources,
        case when length(v_rut_compact) >= 2 and regexp_replace(upper(coalesce(e.rut,'')), '[^0-9K]', '', 'g') like v_rut_compact || '%' then 'rut_prefix' else 'name_prefix' end as match_type
      from public.aml_entities e
      where lower(e.entity_id) not like 'entity:press:%'
        and (
          (length(v_rut_compact) >= 2 and regexp_replace(upper(coalesce(e.rut,'')), '[^0-9K]', '', 'g') like v_rut_compact || '%')
          or upper(translate(coalesce(e.name,''),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNAEIOUUN')) like v_qkey || '%'
        )
      order by e.source_count desc nulls last, e.name
      limit 7
    )
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'entity_id',entity_id,'rut',rut,'name',name,'entity_type',entity_type,'region',region,'commune',commune,
      'source_count',source_count,'sources',sources,'match_source','CANONICAL','match_type',match_type,'result_tier','SUGGESTION','tier_priority',1
    ))),'[]'::jsonb) into v_items from suggestions;

    return jsonb_build_object(
      'schema','ATLAS_ENTITY_SEARCH_V2','kind','suggest','generated_at',now(),'items',v_items,
      'page',jsonb_build_object('limit',7,'offset',0,'returned',jsonb_array_length(v_items)),
      'semantics',jsonb_build_object('suggestions_are_prefix_only',true,'press_excluded',true,'identity_not_promoted',true)
    );
  end if;

  if v_kind <> 'results' then
    return jsonb_build_object('schema','ATLAS_ENTITY_SEARCH_V2','kind',v_kind,'generated_at',now(),'items','[]'::jsonb,'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',0),'semantics',jsonb_build_object('query_status','UNSUPPORTED_KIND'));
  end if;

  if length(v_q) < 2 or length(v_q) > 180 then
    return jsonb_build_object(
      'schema','ATLAS_ENTITY_SEARCH_V2','kind','results','generated_at',now(),'items','[]'::jsonb,
      'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',0),
      'semantics',jsonb_build_object('query_status','INVALID_OR_TOO_SHORT')
    );
  end if;

  if v_mode = 'exact_reconciled' then
    with canonical as (
      select r.entity_id,r.rut,r.name,r.entity_type,r.region,r.commune,r.source_count,r.source_identity_confidence,
        r.name as matched_label,'CANONICAL'::text as match_source,
        case when regexp_replace(upper(coalesce(r.rut,'')), '[^0-9K]', '', 'g') = v_rut_compact and length(v_rut_compact) >= 7 then 'rut_exact' else 'name_exact' end as match_type,
        case when regexp_replace(upper(coalesce(r.rut,'')), '[^0-9K]', '', 'g') = v_rut_compact and length(v_rut_compact) >= 7 then 1.0 else 0.995 end::numeric as match_score,
        null::text as registry_class
      from public.aml_entity_resolution_index_v1 r
      where lower(r.entity_id) not like 'entity:press:%'
        and (
          (length(v_rut_compact) >= 7 and regexp_replace(upper(coalesce(r.rut,'')), '[^0-9K]', '', 'g') = v_rut_compact)
          or r.resolution_key = v_qkey
        )
    ),
    uaf_alias as (
      select r.entity_id,r.rut,r.name,r.entity_type,r.region,r.commune,r.source_count,r.source_identity_confidence,
        u.registry_name as matched_label,'UAF_NAME'::text as match_source,'alias_exact'::text as match_type,0.99::numeric as match_score,u.registry_class
      from public.aml_uaf_registry_name_index_v0712 u
      join public.aml_entity_resolution_index_v1 r on r.rut = u.rut
      where lower(r.entity_id) not like 'entity:press:%' and u.resolution_key = v_qkey
    ),
    ranked as (
      select *, row_number() over (partition by entity_id order by match_score desc, case match_source when 'CANONICAL' then 0 else 1 end) rn
      from (select * from canonical union all select * from uaf_alias) q
    ),
    page_rows as (
      select * from ranked where rn=1
      order by match_score desc, source_count desc nulls last, name
      offset v_offset limit v_limit
    ),
    enriched as (
      select p.*,coalesce(e.profile->'fuentes','[]'::jsonb) sources,coalesce(e.profile->'roles_es',e.profile->'roles','[]'::jsonb) roles,
        case when coalesce(e.profile->>'event_count','') ~ '^\d+$' then (e.profile->>'event_count')::integer else null end event_count,
        s.ipa3_score,s.priority_band_shadow,s.registry_group_score,s.economic_group_score,s.sanctions_group_score,s.dominant_mark_id,s.score_confidence_pct,s.coverage_index_pct
      from page_rows p
      left join public.aml_entities e on e.entity_id=p.entity_id
      left join public.aml_ipa3_entity_score_snapshot_v0_4 s on s.entity_id=p.entity_id
    )
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'entity_id',entity_id,'rut',rut,'name',name,'entity_type',entity_type,'region',region,'commune',commune,
      'source_count',source_count,'identity_confidence',source_identity_confidence,'matched_label',matched_label,'match_source',match_source,
      'match_type',match_type,'match_score',round(match_score,4),'registry_class',registry_class,'sources',sources,'roles',roles,'event_count',event_count,
      'ipa3_score',ipa3_score,'priority_band_shadow',priority_band_shadow,'registry_group_score',registry_group_score,'economic_group_score',economic_group_score,
      'sanctions_group_score',sanctions_group_score,'dominant_mark_id',dominant_mark_id,'score_confidence_pct',score_confidence_pct,'coverage_index_pct',coverage_index_pct,
      'result_tier','EXACT_IDENTITY','tier_priority',1
    )) order by match_score desc, source_count desc nulls last, name),'[]'::jsonb) into v_items from enriched;

    return jsonb_build_object(
      'schema','ATLAS_ENTITY_SEARCH_V2','kind','results','generated_at',now(),'items',v_items,
      'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',jsonb_array_length(v_items)),
      'semantics',jsonb_build_object(
        'search_stage','EXACT_RECONCILED','fallback_policy','EXACT_RECONCILED_THEN_PRESS_HIGH','press_min_confidence',0.86,
        'priority_not_probability',true,'match_not_identity_assertion',true,
        'screening_sources',jsonb_build_array('UN_SANCTIONS','OFAC','EU_SANCTIONS','UK_SANCTIONS','IDB_SANCTIONS','WORLD_BANK')
      )
    );
  end if;

  if v_mode = 'press_high' then
    if length(v_qkey) < 5 then
      return jsonb_build_object('schema','ATLAS_ENTITY_SEARCH_V2','kind','results','generated_at',now(),'items','[]'::jsonb,'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',0),'semantics',jsonb_build_object('search_stage','PRESS_HIGH','press_min_confidence',0.86,'query_status','TOO_SHORT_FOR_PRESS_FALLBACK'));
    end if;

    with candidates as (
      select r.entity_id,r.rut,r.name,r.entity_type,r.region,r.commune,r.source_count,r.source_identity_confidence,
        r.name as matched_label,'PRESS'::text as match_source,
        case when r.resolution_key = v_qkey then 'press_name_exact' else 'press_name_high_confidence' end as match_type,
        case when r.resolution_key = v_qkey then 0.99 else extensions.similarity(r.resolution_key,v_qkey) end::numeric as match_score,
        null::text as registry_class,
        coalesce(e.profile->'fuentes','[]'::jsonb) as sources,
        coalesce(e.profile->'roles_es',e.profile->'roles','[]'::jsonb) as roles,
        case when coalesce(e.profile->>'event_count','') ~ '^\d+$' then (e.profile->>'event_count')::integer else null end as event_count,
        s.ipa3_score,s.priority_band_shadow,s.registry_group_score,s.economic_group_score,s.sanctions_group_score,s.dominant_mark_id,s.score_confidence_pct,s.coverage_index_pct
      from public.aml_entity_resolution_index_v1 r
      join public.aml_entities e on e.entity_id=r.entity_id
      left join public.aml_ipa3_entity_score_snapshot_v0_4 s on s.entity_id=r.entity_id
      where (lower(r.entity_id) like 'entity:press:%' or coalesce(e.profile->'fuentes','[]'::jsonb) ? 'RADAR_PRENSA')
        and (r.resolution_key = v_qkey or extensions.similarity(r.resolution_key,v_qkey) >= 0.86)
      order by match_score desc, r.source_count desc nulls last, r.name
      offset v_offset limit v_limit
    )
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'entity_id',entity_id,'rut',rut,'name',name,'entity_type',entity_type,'region',region,'commune',commune,
      'source_count',source_count,'identity_confidence',source_identity_confidence,'matched_label',matched_label,'match_source',match_source,
      'match_type',match_type,'match_score',round(match_score,4),'sources',sources,'roles',roles,'event_count',event_count,
      'ipa3_score',ipa3_score,'priority_band_shadow',priority_band_shadow,'registry_group_score',registry_group_score,'economic_group_score',economic_group_score,
      'sanctions_group_score',sanctions_group_score,'dominant_mark_id',dominant_mark_id,'score_confidence_pct',score_confidence_pct,'coverage_index_pct',coverage_index_pct,
      'result_tier','PRESS_CONTEXT','tier_priority',3,'context_only',true
    )) order by match_score desc, source_count desc nulls last, name),'[]'::jsonb) into v_items from candidates;

    return jsonb_build_object(
      'schema','ATLAS_ENTITY_SEARCH_V2','kind','results','generated_at',now(),'items',v_items,
      'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',jsonb_array_length(v_items)),
      'semantics',jsonb_build_object(
        'search_stage','PRESS_HIGH','fallback_policy','EXACT_RECONCILED_THEN_PRESS_HIGH','press_min_confidence',0.86,
        'context_only',true,'identity_not_promoted',true,'priority_not_probability',true,
        'screening_sources',jsonb_build_array('UN_SANCTIONS','OFAC','EU_SANCTIONS','UK_SANCTIONS','IDB_SANCTIONS','WORLD_BANK')
      )
    );
  end if;

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
    select *, row_number() over (partition by entity_id order by match_score desc, case match_source when 'CANONICAL' then 0 when 'UAF_NAME' then 1 else 2 end) as rn
    from (select * from canonical union all select * from uaf_alias) x
    where match_score >= case when length(v_qkey) <= 3 then 0.72 else 0.30 end
  ),
  page_rows as (
    select * from ranked where rn=1
    order by match_score desc, source_count desc nulls last, name
    offset v_offset limit v_limit
  ),
  enriched as (
    select p.*,coalesce(e.profile->'fuentes','[]'::jsonb) sources,coalesce(e.profile->'roles_es',e.profile->'roles','[]'::jsonb) roles,
      case when coalesce(e.profile->>'event_count','') ~ '^\d+$' then (e.profile->>'event_count')::integer else null end event_count,
      s.ipa3_score,s.priority_band_shadow,s.registry_group_score,s.economic_group_score,s.sanctions_group_score,s.dominant_mark_id,s.score_confidence_pct,s.coverage_index_pct
    from page_rows p
    left join public.aml_entities e on e.entity_id=p.entity_id
    left join public.aml_ipa3_entity_score_snapshot_v0_4 s on s.entity_id=p.entity_id
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'entity_id',entity_id,'rut',rut,'name',name,'entity_type',entity_type,'region',region,'commune',commune,
    'source_count',source_count,'identity_confidence',source_identity_confidence,'matched_label',matched_label,
    'match_source',case when sources ? 'RADAR_PRENSA' then 'PRESS' else match_source end,
    'match_type',match_type,'match_score',round(match_score,4),'registry_class',registry_class,
    'sources',sources,'roles',roles,'event_count',event_count,
    'ipa3_score',ipa3_score,'priority_band_shadow',priority_band_shadow,'registry_group_score',registry_group_score,'economic_group_score',economic_group_score,
    'sanctions_group_score',sanctions_group_score,'dominant_mark_id',dominant_mark_id,'score_confidence_pct',score_confidence_pct,'coverage_index_pct',coverage_index_pct,
    'result_tier',case when match_type in ('rut_exact','name_exact','alias_exact') then 'EXACT_IDENTITY' when match_source='PRESS' then 'PRESS_CONTEXT' else 'APPROX_IDENTITY' end,
    'tier_priority',case when match_type in ('rut_exact','name_exact','alias_exact') then 1 when match_source='PRESS' then 3 else 2 end
  )) order by match_score desc, source_count desc nulls last, name),'[]'::jsonb) into v_items from enriched;

  return jsonb_build_object(
    'schema','ATLAS_ENTITY_SEARCH_V2','kind','results','generated_at',now(),'items',v_items,
    'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'returned',jsonb_array_length(v_items)),
    'semantics',jsonb_build_object(
      'search_stage','LEGACY_MIXED','priority_not_probability',true,'match_not_identity_assertion',true,
      'sources',jsonb_build_array('CANONICAL','UAF_NAME','PRESS'),
      'screening_sources',jsonb_build_array('UN_SANCTIONS','OFAC','EU_SANCTIONS','UK_SANCTIONS','IDB_SANCTIONS','WORLD_BANK'),
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
