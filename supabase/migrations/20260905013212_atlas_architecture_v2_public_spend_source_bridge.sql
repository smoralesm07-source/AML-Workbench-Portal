create table if not exists atlas_v2_private.source_snapshot (
  source_key text not null,
  snapshot_id text not null,
  contract text not null,
  generated_at timestamptz not null,
  received_at timestamptz not null default now(),
  source_versions jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  payload_checksum text not null,
  primary key (source_key, snapshot_id),
  constraint atlas_v2_source_snapshot_source_key_check check (source_key in ('presupuesto_abierto_l12'))
);

revoke all on atlas_v2_private.source_snapshot from public, anon, authenticated;
grant select, insert, update on atlas_v2_private.source_snapshot to service_role;

create index if not exists atlas_v2_source_snapshot_latest_idx
  on atlas_v2_private.source_snapshot(source_key, generated_at desc, received_at desc);

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
security invoker
set search_path = pg_catalog, public, atlas_v2_private, pgmq
as $$
declare
  v_checksum text;
  v_msg_id bigint;
begin
  if p_source_key <> 'presupuesto_abierto_l12' then
    raise exception 'ATLAS_V2_SOURCE_NOT_ALLOWED';
  end if;
  if p_contract <> 'ATLAS_BUDGET_EXECUTION_SOURCE_V2' then
    raise exception 'ATLAS_V2_SOURCE_CONTRACT_INVALID';
  end if;
  if p_snapshot_id is null or length(trim(p_snapshot_id)) < 3 or length(p_snapshot_id) > 180 then
    raise exception 'ATLAS_V2_SOURCE_SNAPSHOT_INVALID';
  end if;
  if p_generated_at is null then
    raise exception 'ATLAS_V2_SOURCE_GENERATED_AT_REQUIRED';
  end if;
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
    source_key, snapshot_id, contract, generated_at, received_at,
    source_versions, payload, payload_checksum
  ) values (
    p_source_key, p_snapshot_id, p_contract, p_generated_at, now(),
    coalesce(p_source_versions,'{}'::jsonb), p_payload, v_checksum
  )
  on conflict (source_key, snapshot_id)
  do update set
    contract=excluded.contract,
    generated_at=excluded.generated_at,
    received_at=now(),
    source_versions=excluded.source_versions,
    payload=excluded.payload,
    payload_checksum=excluded.payload_checksum;

  select pgmq.send(
    'atlas_v2_jobs',
    jsonb_build_object(
      'job_type','REFRESH_PUBLIC_SPEND_MONITOR',
      'payload',jsonb_build_object('source_key',p_source_key,'snapshot_id',p_snapshot_id),
      'enqueued_at',now(),
      'source','source_snapshot_ingest'
    )
  ) into v_msg_id;

  return jsonb_build_object(
    'ok',true,
    'source_key',p_source_key,
    'snapshot_id',p_snapshot_id,
    'payload_checksum',v_checksum,
    'queue_msg_id',v_msg_id
  );
end;
$$;

revoke all on function atlas_v2_private.ingest_source_snapshot(text,text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function atlas_v2_private.ingest_source_snapshot(text,text,text,timestamptz,jsonb,jsonb) to service_role;

create or replace function public.atlas_v2_materialize_public_spend_monitor()
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, atlas_v2_private
as $$
declare
  v_budget atlas_v2_private.source_snapshot%rowtype;
  v_proc jsonb;
  v_proc_snapshot text;
  v_proc_generated timestamptz;
  v_snapshot_id text;
  v_generated_at timestamptz;
  v_payload jsonb;
  v_sources jsonb;
  v_checksum text;
begin
  select * into v_budget
  from atlas_v2_private.source_snapshot
  where source_key='presupuesto_abierto_l12'
  order by generated_at desc, received_at desc
  limit 1;

  select r.payload, r.snapshot_id, r.generated_at
    into v_proc, v_proc_snapshot, v_proc_generated
  from public.atlas_v2_model_head h
  join public.atlas_v2_read_model r
    on r.model_key=h.model_key
   and r.scope_key=h.scope_key
   and r.snapshot_id=h.snapshot_id
   and r.model_version=h.model_version
  where h.model_key='public_spend_overview'
    and h.scope_key='global'
    and h.status='READY'
  limit 1;

  if v_budget.snapshot_id is null and v_proc_snapshot is null then
    raise exception 'ATLAS_V2_PUBLIC_SPEND_MONITOR_NO_SOURCE';
  end if;

  v_snapshot_id := 'PSM-' || substr(md5(coalesce(v_budget.snapshot_id,'none') || '|' || coalesce(v_proc_snapshot,'none')),1,16);
  v_generated_at := greatest(
    coalesce(v_budget.generated_at,'epoch'::timestamptz),
    coalesce(v_proc_generated,'epoch'::timestamptz)
  );

  v_sources := jsonb_build_object(
    'budget_execution', case when v_budget.snapshot_id is null then null else jsonb_build_object(
      'source_key',v_budget.source_key,
      'snapshot_id',v_budget.snapshot_id,
      'generated_at',v_budget.generated_at,
      'received_at',v_budget.received_at,
      'checksum',v_budget.payload_checksum,
      'versions',v_budget.source_versions
    ) end,
    'procurement', case when v_proc_snapshot is null then null else jsonb_build_object(
      'model','public_spend_overview',
      'snapshot_id',v_proc_snapshot,
      'generated_at',v_proc_generated
    ) end
  );

  v_payload := jsonb_build_object(
    'contract','ATLAS_PUBLIC_SPEND_MONITOR_V2',
    'domains',jsonb_build_object(
      'budget_execution', case when v_budget.snapshot_id is null then null else v_budget.payload end,
      'procurement', v_proc
    ),
    'availability',jsonb_build_object(
      'budget_execution', v_budget.snapshot_id is not null,
      'procurement', v_proc_snapshot is not null
    ),
    'comparability',jsonb_build_object(
      'mode','PARALLEL_DOMAINS',
      'budget_execution_scope','Ejecución presupuestaria/devengo según Presupuesto Abierto-DIPRES',
      'procurement_scope','Órdenes y procesos de compra según ChileCompra materializados por ATLAS',
      'rule','No sumar, restar ni interpretar ambos montos como universos equivalentes sin homologación explícita de cobertura.'
    ),
    'guardrail','Señales y prioridades orientan revisión analítica; no constituyen por sí mismas evidencia de irregularidad, fraude o LA/FT.'
  );

  v_checksum := md5(v_payload::text);

  insert into public.atlas_v2_read_model(
    model_key, scope_key, snapshot_id, model_version, status,
    generated_at, refreshed_at, source_versions, payload, payload_checksum
  ) values (
    'public_spend_monitor','global',v_snapshot_id,1,'READY',
    v_generated_at,now(),v_sources,v_payload,v_checksum
  )
  on conflict (model_key, scope_key, snapshot_id, model_version)
  do update set
    status='READY',
    generated_at=excluded.generated_at,
    refreshed_at=now(),
    source_versions=excluded.source_versions,
    payload=excluded.payload,
    payload_checksum=excluded.payload_checksum,
    error_code=null,
    error_detail=null;

  insert into public.atlas_v2_model_head(
    model_key, scope_key, snapshot_id, model_version, status,
    generated_at, refreshed_at, payload_checksum
  ) values (
    'public_spend_monitor','global',v_snapshot_id,1,'READY',
    v_generated_at,now(),v_checksum
  )
  on conflict (model_key, scope_key)
  do update set
    snapshot_id=excluded.snapshot_id,
    model_version=excluded.model_version,
    status='READY',
    generated_at=excluded.generated_at,
    refreshed_at=now(),
    payload_checksum=excluded.payload_checksum;

  return jsonb_build_object(
    'ok',true,
    'model','public_spend_monitor',
    'snapshot_id',v_snapshot_id,
    'budget_snapshot',v_budget.snapshot_id,
    'procurement_snapshot',v_proc_snapshot,
    'payload_checksum',v_checksum,
    'payload_bytes',pg_column_size(v_payload)
  );
end;
$$;

revoke all on function public.atlas_v2_materialize_public_spend_monitor() from public, anon, authenticated;
grant execute on function public.atlas_v2_materialize_public_spend_monitor() to service_role;

create or replace function public.atlas_v2_process_jobs(p_qty integer default 5)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pgmq, atlas_v2_private
as $$
declare
  r record;
  v_processed integer := 0;
  v_deferred integer := 0;
  v_failed integer := 0;
  v_job_type text;
  v_payload jsonb;
  v_snapshot_id text;
begin
  p_qty := greatest(1, least(coalesce(p_qty,5), 20));
  for r in select * from pgmq.read('atlas_v2_jobs', 120, p_qty)
  loop
    begin
      v_job_type := r.message->>'job_type';
      v_payload := coalesce(r.message->'payload','{}'::jsonb);
      if v_job_type='REFRESH_PUBLIC_SPEND_OVERVIEW' then
        v_snapshot_id := nullif(v_payload->>'snapshot_id','');
        if v_snapshot_id is not null and not atlas_v2_private.public_spend_snapshot_ready(v_snapshot_id) then
          v_deferred := v_deferred + 1;
          continue;
        end if;
        perform public.atlas_v2_materialize_public_spend_overview(v_snapshot_id);
        if exists(select 1 from atlas_v2_private.source_snapshot where source_key='presupuesto_abierto_l12') then
          perform public.atlas_v2_materialize_public_spend_monitor();
        end if;
      elsif v_job_type='REFRESH_PUBLIC_SPEND_MONITOR' then
        perform public.atlas_v2_materialize_public_spend_monitor();
      else
        raise exception 'ATLAS_V2_UNSUPPORTED_JOB_TYPE: %', v_job_type;
      end if;
      perform pgmq.archive('atlas_v2_jobs', r.msg_id);
      v_processed := v_processed + 1;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;
  return jsonb_build_object('processed',v_processed,'deferred',v_deferred,'failed',v_failed);
end;
$$;

revoke all on function public.atlas_v2_process_jobs(integer) from public, anon, authenticated;
grant execute on function public.atlas_v2_process_jobs(integer) to service_role;