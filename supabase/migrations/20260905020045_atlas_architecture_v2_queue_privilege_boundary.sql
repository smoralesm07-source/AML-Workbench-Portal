-- Keep PGMQ inaccessible to service_role. Queue access is encapsulated by two narrowly granted private functions.
create or replace function atlas_v2_private.ingest_source_snapshot(
  p_source_key text,
  p_snapshot_id text,
  p_contract text,
  p_generated_at timestamptz,
  p_payload jsonb,
  p_source_versions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, atlas_v2_private, pgmq
as $$
declare
  v_checksum text;
  v_msg_id bigint;
begin
  if p_source_key <> 'presupuesto_abierto_l12' then raise exception 'ATLAS_V2_SOURCE_NOT_ALLOWED'; end if;
  if p_contract <> 'ATLAS_BUDGET_EXECUTION_SOURCE_V2' then raise exception 'ATLAS_V2_SOURCE_CONTRACT_INVALID'; end if;
  if p_snapshot_id is null or length(trim(p_snapshot_id)) < 3 or length(p_snapshot_id) > 180 then raise exception 'ATLAS_V2_SOURCE_SNAPSHOT_INVALID'; end if;
  if p_generated_at is null then raise exception 'ATLAS_V2_SOURCE_GENERATED_AT_REQUIRED'; end if;
  if jsonb_typeof(p_payload) <> 'object'
     or p_payload->>'contract' <> p_contract
     or jsonb_typeof(p_payload->'overview') <> 'object'
     or jsonb_typeof(p_payload->'window') <> 'object'
     or jsonb_typeof(p_payload->'monthly') <> 'array'
     or jsonb_typeof(p_payload->'top_services') <> 'array'
     or jsonb_typeof(p_payload->'top_providers') <> 'array' then
    raise exception 'ATLAS_V2_SOURCE_PAYLOAD_INVALID';
  end if;

  v_checksum := md5(p_payload::text);
  insert into atlas_v2_private.source_snapshot(
    source_key,snapshot_id,contract,generated_at,received_at,source_versions,payload,payload_checksum
  ) values (
    p_source_key,p_snapshot_id,p_contract,p_generated_at,now(),coalesce(p_source_versions,'{}'::jsonb),p_payload,v_checksum
  )
  on conflict (source_key,snapshot_id) do update set
    contract=excluded.contract,generated_at=excluded.generated_at,received_at=now(),
    source_versions=excluded.source_versions,payload=excluded.payload,payload_checksum=excluded.payload_checksum;

  select pgmq.send('atlas_v2_jobs',jsonb_build_object(
    'job_type','REFRESH_PUBLIC_SPEND_MONITOR',
    'payload',jsonb_build_object('source_key',p_source_key,'snapshot_id',p_snapshot_id),
    'enqueued_at',now(),'source','source_snapshot_ingest'
  )) into v_msg_id;

  return jsonb_build_object('ok',true,'source_key',p_source_key,'snapshot_id',p_snapshot_id,'payload_checksum',v_checksum,'queue_msg_id',v_msg_id);
end;
$$;
revoke all on function atlas_v2_private.ingest_source_snapshot(text,text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function atlas_v2_private.ingest_source_snapshot(text,text,text,timestamptz,jsonb,jsonb) to service_role;

create or replace function atlas_v2_private.finalize_budget_detail(p_snapshot_id text)
returns jsonb
language plpgsql
security definer
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
    payload=v_payload,payload_checksum=md5(v_payload::text),received_at=now(),
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
revoke all on function atlas_v2_private.finalize_budget_detail(text) from public, anon, authenticated;
grant execute on function atlas_v2_private.finalize_budget_detail(text) to service_role;
