create or replace function atlas_v2_private.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
     and exists (
       select 1
       from public.aml_allowed_users u
       where u.email = lower(coalesce((select auth.jwt())->>'email',''))
         and u.enabled
     );
$$;

revoke all on function atlas_v2_private.is_allowed() from public, anon;
grant execute on function atlas_v2_private.is_allowed() to authenticated, service_role;

grant usage on schema atlas_v2_private to authenticated;

create or replace function atlas_v2_private.public_spend_query(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','')));
  v_search text := nullif(trim(coalesce(p_request->>'search','')),'');
  v_buyer_id text := nullif(trim(coalesce(p_request->>'buyer_id','')),'');
  v_supplier_id text := nullif(trim(coalesce(p_request->>'supplier_id','')),'');
  v_pair_id text := nullif(trim(coalesce(p_request->>'pair_id','')),'');
  v_family text := nullif(trim(coalesce(p_request->>'family','')),'');
  v_severity text := nullif(trim(coalesce(p_request->>'severity','')),'');
  v_limit integer := greatest(1, least(coalesce((p_request->>'limit')::integer,50),100));
  v_offset integer := greatest(0, least(coalesce((p_request->>'offset')::integer,0),10000));
  v_min_priority numeric := case when p_request ? 'min_priority' then nullif(p_request->>'min_priority','')::numeric else null end;
  v_snapshot_id text;
  v_items jsonb := '[]'::jsonb;
  v_detail jsonb;
  v_count integer := 0;
begin
  if not atlas_v2_private.is_allowed() then
    raise exception 'ATLAS_V2_FORBIDDEN' using errcode='42501';
  end if;

  select h.snapshot_id into v_snapshot_id
  from public.atlas_v2_model_head h
  where h.model_key='public_spend_overview'
    and h.scope_key='global'
    and h.status='READY'
  limit 1;

  if v_snapshot_id is null then
    raise exception 'ATLAS_V2_PUBLIC_SPEND_NOT_READY';
  end if;

  if v_kind='buyers' then
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb), count(*)
      into v_items, v_count
    from (
      select buyer_id,buyer_label,amount_12m,order_count_12m,supplier_count,
             top_supplier_id,top_supplier_share,hhi,concentration_percentile,
             materiality_percentile,review_priority
      from public.ps_buyer_metric
      where snapshot_id=v_snapshot_id
        and (v_min_priority is null or review_priority >= v_min_priority)
        and (v_search is null or buyer_id ilike '%'||v_search||'%' or coalesce(buyer_label,'') ilike '%'||v_search||'%')
      order by review_priority desc nulls last, amount_12m desc, buyer_id
      limit v_limit offset v_offset
    ) x;

  elsif v_kind='suppliers' then
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb), count(*)
      into v_items, v_count
    from (
      select supplier_id,supplier_label,amount_12m,order_count_12m,buyer_count,
             top_buyer_id,top_buyer_share,hhi,concentration_percentile,
             materiality_percentile,recent_6m_amount,previous_6m_amount,growth_ratio,
             growth_percentile,active_months,first_seen,last_seen,review_priority
      from public.ps_supplier_metric
      where snapshot_id=v_snapshot_id
        and (v_min_priority is null or review_priority >= v_min_priority)
        and (v_search is null or supplier_id ilike '%'||v_search||'%' or coalesce(supplier_label,'') ilike '%'||v_search||'%')
      order by review_priority desc nulls last, amount_12m desc, supplier_id
      limit v_limit offset v_offset
    ) x;

  elsif v_kind='pairs' then
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb), count(*)
      into v_items, v_count
    from (
      select pair_id,buyer_id,supplier_id,buyer_label,supplier_label,amount_12m,
             order_count_12m,buyer_share,supplier_share,active_months,first_seen,last_seen,
             recent_3m_amount,previous_3m_amount,acceleration_ratio,acceleration_percentile,
             price_signal_count,max_price_priority,max_price_ratio,convergence_count,
             review_priority,flags
      from public.ps_pair_metric
      where snapshot_id=v_snapshot_id
        and (v_buyer_id is null or buyer_id=v_buyer_id)
        and (v_supplier_id is null or supplier_id=v_supplier_id)
        and (v_min_priority is null or review_priority >= v_min_priority)
      order by review_priority desc nulls last, amount_12m desc, pair_id
      limit v_limit offset v_offset
    ) x;

  elsif v_kind='findings' then
    select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb), count(*)
      into v_items, v_count
    from (
      select finding_id,finding_type,family,supplier_id,buyer_id,pair_id,review_priority,
             severity_band,materiality_clp,title,summary,metrics,evidence,source_status,created_at
      from public.ps_finding
      where snapshot_id=v_snapshot_id
        and (v_buyer_id is null or buyer_id=v_buyer_id)
        and (v_supplier_id is null or supplier_id=v_supplier_id)
        and (v_pair_id is null or pair_id=v_pair_id)
        and (v_family is null or family=v_family)
        and (v_severity is null or severity_band=v_severity)
        and (v_min_priority is null or review_priority >= v_min_priority)
      order by review_priority desc nulls last, materiality_clp desc nulls last, finding_id
      limit v_limit offset v_offset
    ) x;

  elsif v_kind='buyer_detail' then
    if v_buyer_id is null then raise exception 'ATLAS_V2_BUYER_ID_REQUIRED'; end if;
    select jsonb_build_object(
      'entity',to_jsonb(b),
      'pairs',coalesce((select jsonb_agg(to_jsonb(p)) from (
        select pair_id,buyer_id,supplier_id,buyer_label,supplier_label,amount_12m,order_count_12m,
               buyer_share,supplier_share,active_months,first_seen,last_seen,acceleration_ratio,
               acceleration_percentile,price_signal_count,max_price_ratio,convergence_count,
               review_priority,flags
        from public.ps_pair_metric
        where snapshot_id=v_snapshot_id and buyer_id=v_buyer_id
        order by review_priority desc nulls last, amount_12m desc
        limit 50
      ) p),'[]'::jsonb),
      'findings',coalesce((select jsonb_agg(to_jsonb(f)) from (
        select finding_id,finding_type,family,supplier_id,buyer_id,pair_id,review_priority,
               severity_band,materiality_clp,title,summary,metrics,evidence,source_status,created_at
        from public.ps_finding
        where snapshot_id=v_snapshot_id and buyer_id=v_buyer_id
        order by review_priority desc, materiality_clp desc nulls last
        limit 50
      ) f),'[]'::jsonb)
    ) into v_detail
    from public.ps_buyer_metric b
    where b.snapshot_id=v_snapshot_id and b.buyer_id=v_buyer_id;

  elsif v_kind='supplier_detail' then
    if v_supplier_id is null then raise exception 'ATLAS_V2_SUPPLIER_ID_REQUIRED'; end if;
    select jsonb_build_object(
      'entity',to_jsonb(s),
      'pairs',coalesce((select jsonb_agg(to_jsonb(p)) from (
        select pair_id,buyer_id,supplier_id,buyer_label,supplier_label,amount_12m,order_count_12m,
               buyer_share,supplier_share,active_months,first_seen,last_seen,acceleration_ratio,
               acceleration_percentile,price_signal_count,max_price_ratio,convergence_count,
               review_priority,flags
        from public.ps_pair_metric
        where snapshot_id=v_snapshot_id and supplier_id=v_supplier_id
        order by review_priority desc nulls last, amount_12m desc
        limit 50
      ) p),'[]'::jsonb),
      'findings',coalesce((select jsonb_agg(to_jsonb(f)) from (
        select finding_id,finding_type,family,supplier_id,buyer_id,pair_id,review_priority,
               severity_band,materiality_clp,title,summary,metrics,evidence,source_status,created_at
        from public.ps_finding
        where snapshot_id=v_snapshot_id and supplier_id=v_supplier_id
        order by review_priority desc, materiality_clp desc nulls last
        limit 50
      ) f),'[]'::jsonb)
    ) into v_detail
    from public.ps_supplier_metric s
    where s.snapshot_id=v_snapshot_id and s.supplier_id=v_supplier_id;

  elsif v_kind='pair_detail' then
    if v_pair_id is null then raise exception 'ATLAS_V2_PAIR_ID_REQUIRED'; end if;
    select jsonb_build_object(
      'entity',to_jsonb(p),
      'findings',coalesce((select jsonb_agg(to_jsonb(f)) from (
        select finding_id,finding_type,family,supplier_id,buyer_id,pair_id,review_priority,
               severity_band,materiality_clp,title,summary,metrics,evidence,source_status,created_at
        from public.ps_finding
        where snapshot_id=v_snapshot_id and pair_id=v_pair_id
        order by review_priority desc, materiality_clp desc nulls last
        limit 50
      ) f),'[]'::jsonb)
    ) into v_detail
    from public.ps_pair_metric p
    where p.snapshot_id=v_snapshot_id and p.pair_id=v_pair_id;

  else
    raise exception 'ATLAS_V2_PUBLIC_SPEND_QUERY_KIND_INVALID';
  end if;

  if v_kind in ('buyer_detail','supplier_detail','pair_detail') then
    return jsonb_build_object(
      'schema','ATLAS_PUBLIC_SPEND_QUERY_V2',
      'snapshot_id',v_snapshot_id,
      'kind',v_kind,
      'detail',v_detail
    );
  end if;

  return jsonb_build_object(
    'schema','ATLAS_PUBLIC_SPEND_QUERY_V2',
    'snapshot_id',v_snapshot_id,
    'kind',v_kind,
    'items',v_items,
    'page',jsonb_build_object(
      'offset',v_offset,
      'limit',v_limit,
      'returned',v_count,
      'has_more',v_count=v_limit,
      'next_offset',case when v_count=v_limit then v_offset+v_limit else null end
    )
  );
end;
$$;

revoke all on function atlas_v2_private.public_spend_query(jsonb) from public, anon;
grant execute on function atlas_v2_private.public_spend_query(jsonb) to authenticated, service_role;

create or replace function public.atlas_v2_public_spend_query(p_request jsonb)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
  select atlas_v2_private.public_spend_query(p_request);
$$;

revoke all on function public.atlas_v2_public_spend_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_public_spend_query(jsonb) to authenticated, service_role;