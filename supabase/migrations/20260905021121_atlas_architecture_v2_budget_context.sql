create or replace function atlas_v2_private.budget_context(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_region text := nullif(trim(coalesce(p_request->>'region','')),'');
  v_category text := nullif(trim(coalesce(p_request->>'category','')),'');
  v_month text := nullif(trim(coalesce(p_request->>'month','')),'');
  v_service_id text := nullif(trim(coalesce(p_request->>'service_id','')),'');
  v_provider_id text := nullif(trim(coalesce(p_request->>'provider_id','')),'');
  v_snapshot_id text;
  v_source_payload jsonb;
  v_result jsonb;
begin
  if not atlas_v2_private.is_allowed() then raise exception 'ATLAS_V2_FORBIDDEN' using errcode='42501'; end if;
  if v_month is not null and v_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'ATLAS_V2_BUDGET_MONTH_INVALID'; end if;

  select s.snapshot_id,x.payload into v_snapshot_id,v_source_payload
  from atlas_v2_private.budget_detail_state s
  join atlas_v2_private.source_snapshot x on x.source_key=s.source_key and x.snapshot_id=s.snapshot_id
  where s.source_key='presupuesto_abierto_l12' and s.status='READY'
  order by x.generated_at desc,x.received_at desc limit 1;
  if v_snapshot_id is null then raise exception 'ATLAS_V2_BUDGET_DETAIL_NOT_READY'; end if;

  with
  svc as (
    select s.*,
      case when v_month is null then coalesce(s.amount_l12,0)
           else coalesce((select sum(coalesce((m->>'amount_clp')::numeric,0)) from jsonb_array_elements(coalesce(s.payload->'monthly','[]'::jsonb)) m where m->>'period'=v_month),0)
      end as service_amount
    from atlas_v2_private.budget_service s
    where s.snapshot_id=v_snapshot_id
      and (v_region is null or s.region=v_region)
      and (v_category is null or s.category=v_category)
      and (v_service_id is null or s.service_id=v_service_id)
  ),
  flw0 as (
    select f.*,
      case when v_month is null then coalesce(f.amount_l12,0)
           else coalesce((select sum(coalesce((m->>'amount_clp')::numeric,0)) from jsonb_array_elements(coalesce(f.payload->'monthly','[]'::jsonb)) m where m->>'period'=v_month),0)
      end as flow_amount
    from atlas_v2_private.budget_flow f
    join svc s on s.service_id=f.service_id
    where f.snapshot_id=v_snapshot_id and (v_provider_id is null or f.provider_id=v_provider_id)
  ),
  flw as (select * from flw0 where flow_amount<>0),
  pa as (select provider_id,sum(flow_amount) amount,count(distinct service_id) service_count from flw group by provider_id),
  sa as (select service_id,sum(flow_amount) flow_amount,count(distinct provider_id) provider_count from flw group by service_id),
  service_rows as (
    select s.*,case when v_provider_id is null then s.service_amount else coalesce(sa.flow_amount,0) end context_amount,
      coalesce(sa.provider_count,0) context_provider_count
    from svc s left join sa on sa.service_id=s.service_id
    where v_provider_id is null or sa.service_id is not null
  ),
  provider_rows as (
    select p.*,pa.amount context_amount,pa.service_count context_service_count
    from pa join atlas_v2_private.budget_provider p on p.snapshot_id=v_snapshot_id and p.provider_id=pa.provider_id
  ),
  metrics as (
    select coalesce((select sum(context_amount) from service_rows),0)::numeric service_amount_total,
      coalesce((select sum(flow_amount) from flw),0)::numeric provider_flow_total,
      coalesce((select count(*) from service_rows),0)::integer service_count,
      coalesce((select count(*) from provider_rows),0)::integer provider_count,
      coalesce((select count(*) from flw),0)::integer relation_count
  ),
  concentration as (
    select case when m.provider_flow_total=0 then 0 else coalesce((select sum(amount) from (select amount from pa order by amount desc limit 10) z),0)/m.provider_flow_total end top10_share,
      case when m.provider_flow_total=0 then 0 else coalesce((select sum(power(amount/m.provider_flow_total,2)) from pa),0) end hhi
    from metrics m
  ),
  months as (select value#>>'{}' period from jsonb_array_elements(coalesce(v_source_payload#>'{window,months}','[]'::jsonb))),
  trend as (
    select mo.period,
      case when v_provider_id is null then
        coalesce((select sum(coalesce((mm->>'amount_clp')::numeric,0)) from svc s cross join lateral jsonb_array_elements(coalesce(s.payload->'monthly','[]'::jsonb)) mm where mm->>'period'=mo.period),0)
      else
        coalesce((select sum(coalesce((mm->>'amount_clp')::numeric,0)) from atlas_v2_private.budget_flow f join svc s on s.service_id=f.service_id cross join lateral jsonb_array_elements(coalesce(f.payload->'monthly','[]'::jsonb)) mm where f.snapshot_id=v_snapshot_id and f.provider_id=v_provider_id and mm->>'period'=mo.period),0)
      end amount_clp
    from months mo
  ),
  top_s as (
    select jsonb_agg(payload || jsonb_build_object('_context_amount',context_amount,'_context_provider_count',context_provider_count) order by context_amount desc nulls last) items
    from (select * from service_rows order by context_amount desc nulls last,service_id limit 12) q
  ),
  top_p as (
    select jsonb_agg(payload || jsonb_build_object('_context_amount',context_amount,'_context_service_count',context_service_count) order by context_amount desc nulls last) items
    from (select * from provider_rows order by context_amount desc nulls last,provider_id limit 12) q
  ),
  top_f as (
    select jsonb_agg(payload || jsonb_build_object('_context_amount',flow_amount) order by flow_amount desc nulls last) items
    from (select * from flw order by flow_amount desc nulls last,service_id,provider_id limit 30) q
  ),
  opts as (
    select (select jsonb_agg(x order by x) from (select distinct region x from atlas_v2_private.budget_service where snapshot_id=v_snapshot_id and region is not null) z) regions,
      (select jsonb_agg(x order by x) from (select distinct category x from atlas_v2_private.budget_service where snapshot_id=v_snapshot_id and category is not null) z) categories
  )
  select jsonb_build_object(
    'schema','ATLAS_PUBLIC_SPEND_QUERY_V2','domain','budget_execution','snapshot_id',v_snapshot_id,'kind','budget_context',
    'filters',jsonb_build_object('region',v_region,'category',v_category,'month',v_month,'service_id',v_service_id,'provider_id',v_provider_id),
    'metrics',jsonb_build_object('service_amount_total',m.service_amount_total,'provider_flow_total',m.provider_flow_total,'service_count',m.service_count,'provider_count',m.provider_count,'relation_count',m.relation_count,'top10_provider_share',c.top10_share,'provider_hhi',c.hhi),
    'trend',coalesce((select jsonb_agg(jsonb_build_object('period',period,'amount_clp',amount_clp) order by period) from trend),'[]'::jsonb),
    'top_services',coalesce(ts.items,'[]'::jsonb),'top_providers',coalesce(tp.items,'[]'::jsonb),'top_relations',coalesce(tf.items,'[]'::jsonb),
    'options',jsonb_build_object('regions',coalesce(o.regions,'[]'::jsonb),'categories',coalesce(o.categories,'[]'::jsonb),'months',coalesce(v_source_payload#>'{window,months}','[]'::jsonb))
  ) into v_result
  from metrics m cross join concentration c cross join top_s ts cross join top_p tp cross join top_f tf cross join opts o;

  return v_result;
end;
$$;
revoke all on function atlas_v2_private.budget_context(jsonb) from public, anon;
grant execute on function atlas_v2_private.budget_context(jsonb) to authenticated, service_role;

create or replace function public.atlas_v2_public_spend_query(p_request jsonb)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
  select case
    when lower(coalesce(p_request->>'domain',''))='budget_execution' and lower(coalesce(p_request->>'kind',''))='budget_context'
      then atlas_v2_private.budget_context(p_request)
    when lower(coalesce(p_request->>'domain',''))='budget_execution'
      then atlas_v2_private.budget_query(p_request)
    else atlas_v2_private.public_spend_query(p_request)
  end;
$$;
revoke all on function public.atlas_v2_public_spend_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_public_spend_query(jsonb) to authenticated, service_role;
