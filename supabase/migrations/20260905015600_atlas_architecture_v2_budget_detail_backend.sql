create table if not exists atlas_v2_private.budget_detail_state (
  source_key text not null default 'presupuesto_abierto_l12',
  snapshot_id text not null,
  status text not null default 'PROCESSING',
  expected_services integer not null default 0,
  expected_providers integer not null default 0,
  expected_flows integer not null default 0,
  loaded_services integer not null default 0,
  loaded_providers integer not null default 0,
  loaded_flows integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (source_key, snapshot_id),
  constraint atlas_v2_budget_detail_state_status_check check (status in ('PROCESSING','READY','FAILED')),
  constraint atlas_v2_budget_detail_state_source_check check (source_key='presupuesto_abierto_l12'),
  constraint atlas_v2_budget_detail_state_source_fk foreign key (source_key,snapshot_id)
    references atlas_v2_private.source_snapshot(source_key,snapshot_id) on delete cascade
);

create table if not exists atlas_v2_private.budget_service (
  snapshot_id text not null,
  service_id text not null,
  service_name text,
  region text,
  category text,
  amount_l12 numeric,
  payload jsonb not null,
  primary key (snapshot_id, service_id)
);

create table if not exists atlas_v2_private.budget_provider (
  snapshot_id text not null,
  provider_id text not null,
  provider_name text,
  rut text,
  amount_l12 numeric,
  payload jsonb not null,
  primary key (snapshot_id, provider_id)
);

create table if not exists atlas_v2_private.budget_flow (
  snapshot_id text not null,
  service_id text not null,
  provider_id text not null,
  amount_l12 numeric,
  payload jsonb not null,
  primary key (snapshot_id, service_id, provider_id)
);

revoke all on atlas_v2_private.budget_detail_state from public, anon, authenticated;
revoke all on atlas_v2_private.budget_service from public, anon, authenticated;
revoke all on atlas_v2_private.budget_provider from public, anon, authenticated;
revoke all on atlas_v2_private.budget_flow from public, anon, authenticated;
grant select, insert, update, delete on atlas_v2_private.budget_detail_state to service_role;
grant select, insert, update, delete on atlas_v2_private.budget_service to service_role;
grant select, insert, update, delete on atlas_v2_private.budget_provider to service_role;
grant select, insert, update, delete on atlas_v2_private.budget_flow to service_role;

create index if not exists atlas_v2_budget_service_amount_idx on atlas_v2_private.budget_service(snapshot_id, amount_l12 desc nulls last);
create index if not exists atlas_v2_budget_provider_amount_idx on atlas_v2_private.budget_provider(snapshot_id, amount_l12 desc nulls last);
create index if not exists atlas_v2_budget_flow_service_amount_idx on atlas_v2_private.budget_flow(snapshot_id, service_id, amount_l12 desc nulls last);
create index if not exists atlas_v2_budget_flow_provider_amount_idx on atlas_v2_private.budget_flow(snapshot_id, provider_id, amount_l12 desc nulls last);
create index if not exists atlas_v2_budget_service_name_trgm_idx on atlas_v2_private.budget_service using gin (service_name gin_trgm_ops);
create index if not exists atlas_v2_budget_provider_name_trgm_idx on atlas_v2_private.budget_provider using gin (provider_name gin_trgm_ops);

create or replace function atlas_v2_private.init_budget_detail(
  p_snapshot_id text,
  p_expected_services integer,
  p_expected_providers integer,
  p_expected_flows integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
begin
  if not exists (
    select 1 from atlas_v2_private.source_snapshot
    where source_key='presupuesto_abierto_l12' and snapshot_id=p_snapshot_id
  ) then raise exception 'ATLAS_V2_BUDGET_SOURCE_SNAPSHOT_NOT_FOUND'; end if;
  if p_expected_services < 0 or p_expected_providers < 0 or p_expected_flows < 0 then
    raise exception 'ATLAS_V2_BUDGET_EXPECTED_COUNT_INVALID';
  end if;

  delete from atlas_v2_private.budget_flow where snapshot_id=p_snapshot_id;
  delete from atlas_v2_private.budget_provider where snapshot_id=p_snapshot_id;
  delete from atlas_v2_private.budget_service where snapshot_id=p_snapshot_id;

  insert into atlas_v2_private.budget_detail_state(
    source_key,snapshot_id,status,expected_services,expected_providers,expected_flows,
    loaded_services,loaded_providers,loaded_flows,started_at,completed_at
  ) values (
    'presupuesto_abierto_l12',p_snapshot_id,'PROCESSING',p_expected_services,p_expected_providers,p_expected_flows,
    0,0,0,now(),null
  )
  on conflict (source_key,snapshot_id) do update set
    status='PROCESSING',
    expected_services=excluded.expected_services,
    expected_providers=excluded.expected_providers,
    expected_flows=excluded.expected_flows,
    loaded_services=0,loaded_providers=0,loaded_flows=0,started_at=now(),completed_at=null;

  return jsonb_build_object('ok',true,'snapshot_id',p_snapshot_id,'status','PROCESSING');
end;
$$;

create or replace function atlas_v2_private.ingest_budget_detail_batch(
  p_snapshot_id text,
  p_kind text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind,'')));
  v_count integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'ATLAS_V2_BUDGET_ROWS_ARRAY_REQUIRED'; end if;
  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 500 then raise exception 'ATLAS_V2_BUDGET_BATCH_SIZE_INVALID'; end if;
  if not exists (
    select 1 from atlas_v2_private.budget_detail_state
    where source_key='presupuesto_abierto_l12' and snapshot_id=p_snapshot_id and status='PROCESSING'
  ) then raise exception 'ATLAS_V2_BUDGET_DETAIL_NOT_PROCESSING'; end if;

  if v_kind='services' then
    insert into atlas_v2_private.budget_service(snapshot_id,service_id,service_name,region,category,amount_l12,payload)
    select p_snapshot_id,
           coalesce(nullif(x->>'organization_id',''),nullif(x->>'buyer_id',''),nullif(x->>'id','')),
           coalesce(x->>'organization_name',x->>'buyer_name',x->>'name'),
           coalesce(x->>'main_region',x->>'region'),
           coalesce(x->>'dominant_subtitle',x->>'category'),
           coalesce(nullif(x->>'amount_l12','')::numeric,nullif(x->>'amount_clp','')::numeric),
           x
    from jsonb_array_elements(p_rows) x
    where coalesce(nullif(x->>'organization_id',''),nullif(x->>'buyer_id',''),nullif(x->>'id','')) is not null
    on conflict (snapshot_id,service_id) do update set
      service_name=excluded.service_name,region=excluded.region,category=excluded.category,
      amount_l12=excluded.amount_l12,payload=excluded.payload;
  elsif v_kind='providers' then
    insert into atlas_v2_private.budget_provider(snapshot_id,provider_id,provider_name,rut,amount_l12,payload)
    select p_snapshot_id,
           coalesce(nullif(x->>'provider_id',''),nullif(x->>'supplier_id',''),nullif(x->>'id','')),
           coalesce(x->>'provider_name',x->>'supplier_name',x->>'name'),
           nullif(x->>'rut',''),
           coalesce(nullif(x->>'amount_l12','')::numeric,nullif(x->>'amount_clp','')::numeric),
           x
    from jsonb_array_elements(p_rows) x
    where coalesce(nullif(x->>'provider_id',''),nullif(x->>'supplier_id',''),nullif(x->>'id','')) is not null
    on conflict (snapshot_id,provider_id) do update set
      provider_name=excluded.provider_name,rut=excluded.rut,amount_l12=excluded.amount_l12,payload=excluded.payload;
  elsif v_kind='flows' then
    insert into atlas_v2_private.budget_flow(snapshot_id,service_id,provider_id,amount_l12,payload)
    select p_snapshot_id,
           coalesce(nullif(x->>'organization_id',''),nullif(x->>'buyer_id','')),
           coalesce(nullif(x->>'provider_id',''),nullif(x->>'supplier_id','')),
           coalesce(nullif(x->>'amount_l12','')::numeric,nullif(x->>'amount_clp','')::numeric),
           x
    from jsonb_array_elements(p_rows) x
    where coalesce(nullif(x->>'organization_id',''),nullif(x->>'buyer_id','')) is not null
      and coalesce(nullif(x->>'provider_id',''),nullif(x->>'supplier_id','')) is not null
    on conflict (snapshot_id,service_id,provider_id) do update set
      amount_l12=excluded.amount_l12,payload=excluded.payload;
  else
    raise exception 'ATLAS_V2_BUDGET_KIND_INVALID';
  end if;

  update atlas_v2_private.budget_detail_state s set
    loaded_services=(select count(*) from atlas_v2_private.budget_service where snapshot_id=p_snapshot_id),
    loaded_providers=(select count(*) from atlas_v2_private.budget_provider where snapshot_id=p_snapshot_id),
    loaded_flows=(select count(*) from atlas_v2_private.budget_flow where snapshot_id=p_snapshot_id)
  where s.source_key='presupuesto_abierto_l12' and s.snapshot_id=p_snapshot_id;

  return jsonb_build_object('ok',true,'snapshot_id',p_snapshot_id,'kind',v_kind,'accepted_rows',v_count);
end;
$$;

create or replace function atlas_v2_private.finalize_budget_detail(p_snapshot_id text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, atlas_v2_private, pgmq
as $$
declare
  s atlas_v2_private.budget_detail_state%rowtype;
  v_payload jsonb;
  v_msg_id bigint;
begin
  select * into s from atlas_v2_private.budget_detail_state
  where source_key='presupuesto_abierto_l12' and snapshot_id=p_snapshot_id for update;
  if not found then raise exception 'ATLAS_V2_BUDGET_DETAIL_STATE_NOT_FOUND'; end if;

  select count(*) into s.loaded_services from atlas_v2_private.budget_service where snapshot_id=p_snapshot_id;
  select count(*) into s.loaded_providers from atlas_v2_private.budget_provider where snapshot_id=p_snapshot_id;
  select count(*) into s.loaded_flows from atlas_v2_private.budget_flow where snapshot_id=p_snapshot_id;

  if s.loaded_services <> s.expected_services or s.loaded_providers <> s.expected_providers or s.loaded_flows <> s.expected_flows then
    update atlas_v2_private.budget_detail_state set
      loaded_services=s.loaded_services,loaded_providers=s.loaded_providers,loaded_flows=s.loaded_flows,status='FAILED'
    where source_key='presupuesto_abierto_l12' and snapshot_id=p_snapshot_id;
    raise exception 'ATLAS_V2_BUDGET_DETAIL_COUNT_MISMATCH expected %/%/% loaded %/%/%',
      s.expected_services,s.expected_providers,s.expected_flows,s.loaded_services,s.loaded_providers,s.loaded_flows;
  end if;

  select payload into v_payload from atlas_v2_private.source_snapshot
  where source_key='presupuesto_abierto_l12' and snapshot_id=p_snapshot_id for update;
  v_payload := jsonb_set(v_payload,'{quality,detail_mode}','"FULL_BACKEND"'::jsonb,true);
  v_payload := jsonb_set(v_payload,'{quality,loaded_services}',to_jsonb(s.loaded_services),true);
  v_payload := jsonb_set(v_payload,'{quality,loaded_providers}',to_jsonb(s.loaded_providers),true);
  v_payload := jsonb_set(v_payload,'{quality,loaded_flows}',to_jsonb(s.loaded_flows),true);

  update atlas_v2_private.source_snapshot set
    payload=v_payload,
    payload_checksum=md5(v_payload::text),
    received_at=now(),
    source_versions=jsonb_set(coalesce(source_versions,'{}'::jsonb),'{detail_mode}','"FULL_BACKEND"'::jsonb,true)
  where source_key='presupuesto_abierto_l12' and snapshot_id=p_snapshot_id;

  update atlas_v2_private.budget_detail_state set
    loaded_services=s.loaded_services,loaded_providers=s.loaded_providers,loaded_flows=s.loaded_flows,
    status='READY',completed_at=now()
  where source_key='presupuesto_abierto_l12' and snapshot_id=p_snapshot_id;

  select pgmq.send('atlas_v2_jobs',jsonb_build_object(
    'job_type','REFRESH_PUBLIC_SPEND_MONITOR',
    'payload',jsonb_build_object('source_key','presupuesto_abierto_l12','snapshot_id',p_snapshot_id),
    'enqueued_at',now(),'source','budget_detail_finalize'
  )) into v_msg_id;

  return jsonb_build_object('ok',true,'snapshot_id',p_snapshot_id,'status','READY',
    'services',s.loaded_services,'providers',s.loaded_providers,'flows',s.loaded_flows,'queue_msg_id',v_msg_id);
end;
$$;

revoke all on function atlas_v2_private.init_budget_detail(text,integer,integer,integer) from public, anon, authenticated;
revoke all on function atlas_v2_private.ingest_budget_detail_batch(text,text,jsonb) from public, anon, authenticated;
revoke all on function atlas_v2_private.finalize_budget_detail(text) from public, anon, authenticated;
grant execute on function atlas_v2_private.init_budget_detail(text,integer,integer,integer) to service_role;
grant execute on function atlas_v2_private.ingest_budget_detail_batch(text,text,jsonb) to service_role;
grant execute on function atlas_v2_private.finalize_budget_detail(text) to service_role;

create or replace function public.atlas_v2_ingest_budget_detail(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_operation text := lower(trim(coalesce(p_request->>'operation','')));
  v_snapshot_id text := nullif(trim(coalesce(p_request->>'snapshot_id','')),'');
begin
  if v_snapshot_id is null then raise exception 'ATLAS_V2_BUDGET_SNAPSHOT_REQUIRED'; end if;
  if v_operation='init' then
    return atlas_v2_private.init_budget_detail(
      v_snapshot_id,
      coalesce((p_request->>'expected_services')::integer,0),
      coalesce((p_request->>'expected_providers')::integer,0),
      coalesce((p_request->>'expected_flows')::integer,0)
    );
  elsif v_operation='batch' then
    return atlas_v2_private.ingest_budget_detail_batch(v_snapshot_id,p_request->>'kind',p_request->'rows');
  elsif v_operation='finalize' then
    return atlas_v2_private.finalize_budget_detail(v_snapshot_id);
  end if;
  raise exception 'ATLAS_V2_BUDGET_INGEST_OPERATION_INVALID';
end;
$$;
revoke all on function public.atlas_v2_ingest_budget_detail(jsonb) from public, anon, authenticated;
grant execute on function public.atlas_v2_ingest_budget_detail(jsonb) to service_role;

create or replace function atlas_v2_private.budget_query(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','')));
  v_search text := nullif(trim(coalesce(p_request->>'search','')),'');
  v_service_id text := nullif(trim(coalesce(p_request->>'service_id','')),'');
  v_provider_id text := nullif(trim(coalesce(p_request->>'provider_id','')),'');
  v_limit integer := greatest(1,least(coalesce((p_request->>'limit')::integer,50),100));
  v_offset integer := greatest(0,least(coalesce((p_request->>'offset')::integer,0),10000));
  v_snapshot_id text;
  v_items jsonb := '[]'::jsonb;
  v_detail jsonb;
  v_count integer := 0;
begin
  if not atlas_v2_private.is_allowed() then raise exception 'ATLAS_V2_FORBIDDEN' using errcode='42501'; end if;

  select s.snapshot_id into v_snapshot_id
  from atlas_v2_private.budget_detail_state s
  join atlas_v2_private.source_snapshot x on x.source_key=s.source_key and x.snapshot_id=s.snapshot_id
  where s.source_key='presupuesto_abierto_l12' and s.status='READY'
  order by x.generated_at desc,x.received_at desc limit 1;
  if v_snapshot_id is null then raise exception 'ATLAS_V2_BUDGET_DETAIL_NOT_READY'; end if;

  if v_kind='budget_services' then
    select coalesce(jsonb_agg(payload order by amount_l12 desc nulls last),'[]'::jsonb),count(*) into v_items,v_count
    from (select payload,amount_l12 from atlas_v2_private.budget_service
      where snapshot_id=v_snapshot_id and (v_search is null or service_id ilike '%'||v_search||'%' or coalesce(service_name,'') ilike '%'||v_search||'%')
      order by amount_l12 desc nulls last,service_id limit v_limit offset v_offset) q;
  elsif v_kind='budget_providers' then
    select coalesce(jsonb_agg(payload order by amount_l12 desc nulls last),'[]'::jsonb),count(*) into v_items,v_count
    from (select payload,amount_l12 from atlas_v2_private.budget_provider
      where snapshot_id=v_snapshot_id and (v_search is null or provider_id ilike '%'||v_search||'%' or coalesce(provider_name,'') ilike '%'||v_search||'%' or coalesce(rut,'') ilike '%'||v_search||'%')
      order by amount_l12 desc nulls last,provider_id limit v_limit offset v_offset) q;
  elsif v_kind='budget_flows' then
    select coalesce(jsonb_agg(payload order by amount_l12 desc nulls last),'[]'::jsonb),count(*) into v_items,v_count
    from (select payload,amount_l12 from atlas_v2_private.budget_flow
      where snapshot_id=v_snapshot_id and (v_service_id is null or service_id=v_service_id) and (v_provider_id is null or provider_id=v_provider_id)
      order by amount_l12 desc nulls last,service_id,provider_id limit v_limit offset v_offset) q;
  elsif v_kind='budget_service_detail' then
    if v_service_id is null then raise exception 'ATLAS_V2_BUDGET_SERVICE_ID_REQUIRED'; end if;
    select jsonb_build_object('entity',s.payload,'flows',coalesce((select jsonb_agg(f.payload order by f.amount_l12 desc nulls last) from atlas_v2_private.budget_flow f where f.snapshot_id=v_snapshot_id and f.service_id=v_service_id),'[]'::jsonb)) into v_detail
    from atlas_v2_private.budget_service s where s.snapshot_id=v_snapshot_id and s.service_id=v_service_id;
  elsif v_kind='budget_provider_detail' then
    if v_provider_id is null then raise exception 'ATLAS_V2_BUDGET_PROVIDER_ID_REQUIRED'; end if;
    select jsonb_build_object('entity',p.payload,'flows',coalesce((select jsonb_agg(f.payload order by f.amount_l12 desc nulls last) from atlas_v2_private.budget_flow f where f.snapshot_id=v_snapshot_id and f.provider_id=v_provider_id),'[]'::jsonb)) into v_detail
    from atlas_v2_private.budget_provider p where p.snapshot_id=v_snapshot_id and p.provider_id=v_provider_id;
  else
    raise exception 'ATLAS_V2_BUDGET_QUERY_KIND_INVALID';
  end if;

  if v_kind in ('budget_service_detail','budget_provider_detail') then
    return jsonb_build_object('schema','ATLAS_PUBLIC_SPEND_QUERY_V2','domain','budget_execution','snapshot_id',v_snapshot_id,'kind',v_kind,'detail',v_detail);
  end if;
  return jsonb_build_object('schema','ATLAS_PUBLIC_SPEND_QUERY_V2','domain','budget_execution','snapshot_id',v_snapshot_id,'kind',v_kind,'items',v_items,
    'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit,'next_offset',case when v_count=v_limit then v_offset+v_limit else null end));
end;
$$;
revoke all on function atlas_v2_private.budget_query(jsonb) from public, anon;
grant execute on function atlas_v2_private.budget_query(jsonb) to authenticated, service_role;

create or replace function public.atlas_v2_public_spend_query(p_request jsonb)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
  select case
    when lower(coalesce(p_request->>'domain',''))='budget_execution' then atlas_v2_private.budget_query(p_request)
    else atlas_v2_private.public_spend_query(p_request)
  end;
$$;
revoke all on function public.atlas_v2_public_spend_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_public_spend_query(jsonb) to authenticated, service_role;
