create or replace function atlas_v2_private.budget_flow_query(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'atlas_v2_private'
as $function$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','')));
  v_search text := nullif(trim(coalesce(p_request->>'search','')),'');
  v_region text := nullif(trim(coalesce(p_request->>'region','')),'');
  v_category text := nullif(trim(coalesce(p_request->>'category','')),'');
  v_month text := nullif(trim(coalesce(p_request->>'month','')),'');
  v_service_id text := nullif(trim(coalesce(p_request->>'service_id','')),'');
  v_provider_id text := nullif(trim(coalesce(p_request->>'provider_id','')),'');
  v_limit integer := greatest(1,least(coalesce((p_request->>'limit')::integer,50),100));
  v_offset integer := greatest(0,least(coalesce((p_request->>'offset')::integer,0),10000));
  v_snapshot_id text;
  v_items jsonb := '[]'::jsonb;
  v_detail jsonb;
  v_count integer := 0;
begin
  if not atlas_v2_private.is_allowed() then
    raise exception 'ATLAS_V2_FORBIDDEN' using errcode='42501';
  end if;
  if v_month is not null and v_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then
    raise exception 'ATLAS_V2_BUDGET_MONTH_INVALID';
  end if;

  select s.snapshot_id into v_snapshot_id
  from atlas_v2_private.budget_detail_state s
  join atlas_v2_private.source_snapshot x
    on x.source_key=s.source_key and x.snapshot_id=s.snapshot_id
  where s.source_key='presupuesto_abierto_l12' and s.status='READY'
  order by x.generated_at desc,x.received_at desc
  limit 1;
  if v_snapshot_id is null then raise exception 'ATLAS_V2_BUDGET_DETAIL_NOT_READY'; end if;

  if v_kind='budget_flow_detail' then
    if v_service_id is null or v_provider_id is null then
      raise exception 'ATLAS_V2_BUDGET_FLOW_IDS_REQUIRED';
    end if;
    with row0 as (
      select f.payload flow_payload,s.payload service_payload,p.payload provider_payload,
        case when v_month is null then coalesce(f.amount_l12,0)
             else coalesce((select sum(coalesce((m->>'amount_clp')::numeric,0))
                            from jsonb_array_elements(coalesce(f.payload->'monthly','[]'::jsonb)) m
                            where m->>'period'=v_month),0)
        end::numeric context_amount
      from atlas_v2_private.budget_flow f
      join atlas_v2_private.budget_service s
        on s.snapshot_id=f.snapshot_id and s.service_id=f.service_id
      left join atlas_v2_private.budget_provider p
        on p.snapshot_id=f.snapshot_id and p.provider_id=f.provider_id
      where f.snapshot_id=v_snapshot_id
        and f.service_id=v_service_id
        and f.provider_id=v_provider_id
        and (v_region is null or s.region=v_region)
        and (v_category is null or s.category=v_category)
      limit 1
    )
    select jsonb_build_object(
      'relation',flow_payload || jsonb_build_object('_context_amount',context_amount),
      'service',service_payload,
      'provider',coalesce(provider_payload,'{}'::jsonb),
      'filters',jsonb_build_object('region',v_region,'category',v_category,'month',v_month,'service_id',v_service_id,'provider_id',v_provider_id)
    ) into v_detail from row0;

    return jsonb_build_object(
      'schema','ATLAS_PUBLIC_SPEND_QUERY_V2','domain','budget_execution','snapshot_id',v_snapshot_id,
      'kind',v_kind,'detail',v_detail
    );
  end if;

  if v_kind<>'budget_flows' then raise exception 'ATLAS_V2_BUDGET_FLOW_QUERY_KIND_INVALID'; end if;

  with svc as (
    select s.service_id,s.service_name
    from atlas_v2_private.budget_service s
    where s.snapshot_id=v_snapshot_id
      and (v_region is null or s.region=v_region)
      and (v_category is null or s.category=v_category)
      and (v_service_id is null or s.service_id=v_service_id)
  ), rows as (
    select f.service_id,f.provider_id,
      f.payload || jsonb_build_object('_context_amount',
        case when v_month is null then coalesce(f.amount_l12,0)
             else coalesce((select sum(coalesce((m->>'amount_clp')::numeric,0))
                            from jsonb_array_elements(coalesce(f.payload->'monthly','[]'::jsonb)) m
                            where m->>'period'=v_month),0)
        end
      ) payload,
      case when v_month is null then coalesce(f.amount_l12,0)
           else coalesce((select sum(coalesce((m->>'amount_clp')::numeric,0))
                          from jsonb_array_elements(coalesce(f.payload->'monthly','[]'::jsonb)) m
                          where m->>'period'=v_month),0)
      end::numeric context_amount
    from atlas_v2_private.budget_flow f
    join svc s on s.service_id=f.service_id
    left join atlas_v2_private.budget_provider p
      on p.snapshot_id=f.snapshot_id and p.provider_id=f.provider_id
    where f.snapshot_id=v_snapshot_id
      and (v_provider_id is null or f.provider_id=v_provider_id)
      and (
        v_search is null
        or f.service_id ilike '%'||v_search||'%'
        or f.provider_id ilike '%'||v_search||'%'
        or coalesce(s.service_name,'') ilike '%'||v_search||'%'
        or coalesce(p.provider_name,'') ilike '%'||v_search||'%'
        or coalesce(p.rut,'') ilike '%'||v_search||'%'
      )
  ), page_rows as (
    select * from rows
    where context_amount<>0
    order by context_amount desc nulls last,service_id,provider_id
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(payload order by context_amount desc nulls last),'[]'::jsonb),count(*)
    into v_items,v_count from page_rows;

  return jsonb_build_object(
    'schema','ATLAS_PUBLIC_SPEND_QUERY_V2','domain','budget_execution','snapshot_id',v_snapshot_id,
    'kind',v_kind,
    'filters',jsonb_build_object('region',v_region,'category',v_category,'month',v_month,'service_id',v_service_id,'provider_id',v_provider_id),
    'items',v_items,
    'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit,
      'next_offset',case when v_count=v_limit then v_offset+v_limit else null end)
  );
end;
$function$;

revoke execute on function atlas_v2_private.budget_flow_query(jsonb) from public, anon;
grant execute on function atlas_v2_private.budget_flow_query(jsonb) to authenticated, service_role;

create or replace function public.atlas_v2_public_spend_query(p_request jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'atlas_v2_private'
as $function$
  select case
    when lower(coalesce(p_request->>'domain',''))='budget_execution'
      and lower(coalesce(p_request->>'kind',''))='budget_context'
      then atlas_v2_private.budget_context(p_request)
    when lower(coalesce(p_request->>'domain',''))='budget_execution'
      and lower(coalesce(p_request->>'kind','')) in ('budget_flows','budget_flow_detail')
      then atlas_v2_private.budget_flow_query(p_request)
    when lower(coalesce(p_request->>'domain',''))='budget_execution'
      then atlas_v2_private.budget_query(p_request)
    else atlas_v2_private.public_spend_query(p_request)
  end;
$function$;

revoke execute on function public.atlas_v2_public_spend_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_public_spend_query(jsonb) to authenticated, service_role;
