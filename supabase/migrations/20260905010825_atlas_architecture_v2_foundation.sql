-- ATLAS Architecture v2 foundation
-- Applied to production as migration 20260905010825.
-- Additive only: current production routes do not depend on these objects.

create extension if not exists pgmq;

create table if not exists public.atlas_v2_read_model (
  model_key text not null,
  scope_key text not null default 'global',
  snapshot_id text not null,
  model_version integer not null default 1 check (model_version > 0),
  status text not null default 'READY' check (status in ('BUILDING','READY','FAILED')),
  generated_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  source_versions jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  payload_checksum text not null,
  error_code text,
  error_detail text,
  primary key (model_key, scope_key, snapshot_id, model_version)
);

create table if not exists public.atlas_v2_model_head (
  model_key text not null,
  scope_key text not null default 'global',
  snapshot_id text not null,
  model_version integer not null,
  status text not null check (status in ('BUILDING','READY','FAILED')),
  generated_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  payload_checksum text not null,
  primary key (model_key, scope_key),
  foreign key (model_key, scope_key, snapshot_id, model_version)
    references public.atlas_v2_read_model(model_key, scope_key, snapshot_id, model_version)
    on update cascade on delete restrict
);

create index if not exists atlas_v2_read_model_latest_idx
  on public.atlas_v2_read_model(model_key, scope_key, generated_at desc);

create table if not exists public.atlas_v2_client_event (
  event_id bigint generated always as identity primary key,
  event_at timestamptz not null default now(),
  trace_id text not null check (char_length(trace_id) between 8 and 128),
  user_id uuid not null default auth.uid(),
  route text not null check (char_length(route) <= 120),
  operation text not null check (char_length(operation) <= 160),
  phase text not null check (char_length(phase) <= 80),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 600000),
  status text not null check (status in ('OK','ERROR','TIMEOUT','CANCELLED','PARTIAL')),
  error_code text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists atlas_v2_client_event_trace_idx
  on public.atlas_v2_client_event(trace_id, event_at);
create index if not exists atlas_v2_client_event_route_time_idx
  on public.atlas_v2_client_event(route, event_at desc);

alter table public.atlas_v2_read_model enable row level security;
alter table public.atlas_v2_model_head enable row level security;
alter table public.atlas_v2_client_event enable row level security;

revoke all on public.atlas_v2_read_model, public.atlas_v2_model_head, public.atlas_v2_client_event from anon;
revoke insert, update, delete, truncate, references, trigger on public.atlas_v2_read_model, public.atlas_v2_model_head from authenticated;
grant select on public.atlas_v2_read_model, public.atlas_v2_model_head to authenticated;
grant insert on public.atlas_v2_client_event to authenticated;

create policy atlas_v2_read_model_allowed
  on public.atlas_v2_read_model
  for select to authenticated
  using ((select public.aml_is_allowed()));

create policy atlas_v2_model_head_allowed
  on public.atlas_v2_model_head
  for select to authenticated
  using ((select public.aml_is_allowed()));

create policy atlas_v2_client_event_insert_own
  on public.atlas_v2_client_event
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.aml_is_allowed())
  );

create or replace function public.atlas_v2_get_read_model(
  p_model_key text,
  p_scope_key text default 'global'
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'schema', 'ATLAS_READ_API_V2',
    'model', r.model_key,
    'scope', r.scope_key,
    'snapshot_id', r.snapshot_id,
    'model_version', r.model_version,
    'status', r.status,
    'generated_at', r.generated_at,
    'refreshed_at', r.refreshed_at,
    'source_versions', r.source_versions,
    'payload_checksum', r.payload_checksum,
    'data', r.payload
  )
  from public.atlas_v2_model_head h
  join public.atlas_v2_read_model r
    on r.model_key=h.model_key
   and r.scope_key=h.scope_key
   and r.snapshot_id=h.snapshot_id
   and r.model_version=h.model_version
  where h.model_key=p_model_key
    and h.scope_key=p_scope_key
    and h.status='READY'
  limit 1;
$$;

revoke all on function public.atlas_v2_get_read_model(text,text) from public, anon;
grant execute on function public.atlas_v2_get_read_model(text,text) to authenticated, service_role;

create or replace function public.atlas_v2_materialize_public_spend_overview(
  p_snapshot_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_snapshot_id text;
  v_snapshot public.ps_snapshot%rowtype;
  v_top_suppliers jsonb := '[]'::jsonb;
  v_top_buyers jsonb := '[]'::jsonb;
  v_top_pairs jsonb := '[]'::jsonb;
  v_top_findings jsonb := '[]'::jsonb;
  v_finding_families jsonb := '[]'::jsonb;
  v_finding_severity jsonb := '[]'::jsonb;
  v_readiness jsonb := '[]'::jsonb;
  v_finding_count bigint := 0;
  v_payload jsonb;
  v_sources jsonb;
  v_checksum text;
begin
  select coalesce(
    p_snapshot_id,
    (select s.snapshot_id from public.ps_snapshot s order by s.period_end desc, s.generated_at desc limit 1)
  ) into v_snapshot_id;

  if v_snapshot_id is null then
    raise exception 'ATLAS_V2_NO_PUBLIC_SPEND_SNAPSHOT';
  end if;

  select * into v_snapshot
  from public.ps_snapshot
  where snapshot_id=v_snapshot_id;

  if not found then
    raise exception 'ATLAS_V2_UNKNOWN_PUBLIC_SPEND_SNAPSHOT: %', v_snapshot_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_top_suppliers
  from (
    select supplier_id, supplier_label, amount_12m, order_count_12m, buyer_count,
           top_buyer_id, top_buyer_share, hhi, concentration_percentile,
           materiality_percentile, growth_ratio, growth_percentile,
           active_months, first_seen, last_seen, review_priority
    from public.ps_supplier_metric
    where snapshot_id=v_snapshot_id
    order by review_priority desc nulls last, amount_12m desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_top_buyers
  from (
    select buyer_id, buyer_label, amount_12m, order_count_12m, supplier_count,
           top_supplier_id, top_supplier_share, hhi, concentration_percentile,
           materiality_percentile, review_priority
    from public.ps_buyer_metric
    where snapshot_id=v_snapshot_id
    order by review_priority desc nulls last, amount_12m desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_top_pairs
  from (
    select pair_id, buyer_id, supplier_id, buyer_label, supplier_label,
           amount_12m, order_count_12m, buyer_share, supplier_share,
           active_months, first_seen, last_seen, acceleration_ratio,
           acceleration_percentile, price_signal_count, max_price_priority,
           max_price_ratio, convergence_count, review_priority, flags
    from public.ps_pair_metric
    where snapshot_id=v_snapshot_id
    order by review_priority desc nulls last, amount_12m desc
    limit 20
  ) x;

  select count(*) into v_finding_count
  from public.ps_finding where snapshot_id=v_snapshot_id;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_finding_families
  from (
    select family, count(*)::bigint as finding_count,
           round(avg(review_priority),1) as avg_priority,
           max(review_priority) as max_priority,
           coalesce(sum(materiality_clp),0) as materiality_clp
    from public.ps_finding
    where snapshot_id=v_snapshot_id
    group by family
    order by count(*) desc, family
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_finding_severity
  from (
    select severity_band, count(*)::bigint as finding_count,
           coalesce(sum(materiality_clp),0) as materiality_clp
    from public.ps_finding
    where snapshot_id=v_snapshot_id
    group by severity_band
    order by count(*) desc, severity_band
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_top_findings
  from (
    select finding_id, finding_type, family, supplier_id, buyer_id, pair_id,
           review_priority, severity_band, materiality_clp, title, summary,
           metrics, evidence, source_status, created_at
    from public.ps_finding
    where snapshot_id=v_snapshot_id
    order by review_priority desc, materiality_clp desc nulls last
    limit 30
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_readiness
  from (
    select hypothesis_id, title, family, status, explanation,
           required_sources, available_sources, sort_order, updated_at
    from public.ps_readiness
    order by sort_order, hypothesis_id
  ) x;

  v_sources := jsonb_build_object(
    'public_spend_snapshot', v_snapshot.snapshot_id,
    'source_coverage', v_snapshot.source_coverage,
    'methodology', v_snapshot.notes
  );

  v_payload := jsonb_build_object(
    'contract', 'ATLAS_PUBLIC_SPEND_OVERVIEW_V2',
    'summary', jsonb_build_object(
      'snapshot_id', v_snapshot.snapshot_id,
      'period_start', v_snapshot.period_start,
      'period_end', v_snapshot.period_end,
      'window_months', v_snapshot.window_months,
      'source_generated_at', v_snapshot.generated_at,
      'amount_total_clp', v_snapshot.amount_total_clp,
      'order_count', v_snapshot.order_count,
      'buyer_count', v_snapshot.buyer_count,
      'supplier_count', v_snapshot.supplier_count,
      'pair_count', v_snapshot.pair_count,
      'signal_count', v_snapshot.signal_count,
      'finding_count', v_finding_count
    ),
    'finding_families', v_finding_families,
    'finding_severity', v_finding_severity,
    'top_findings', v_top_findings,
    'top_suppliers', v_top_suppliers,
    'top_buyers', v_top_buyers,
    'top_pairs', v_top_pairs,
    'readiness', v_readiness,
    'guardrail', 'Prioridad de revisión; no probabilidad de irregularidad'
  );

  v_checksum := md5(v_payload::text);

  insert into public.atlas_v2_read_model(
    model_key, scope_key, snapshot_id, model_version, status,
    generated_at, refreshed_at, source_versions, payload, payload_checksum
  ) values (
    'public_spend_overview', 'global', v_snapshot.snapshot_id, 1, 'READY',
    v_snapshot.generated_at, now(), v_sources, v_payload, v_checksum
  )
  on conflict (model_key, scope_key, snapshot_id, model_version)
  do update set
    status=excluded.status,
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
    'public_spend_overview', 'global', v_snapshot.snapshot_id, 1, 'READY',
    v_snapshot.generated_at, now(), v_checksum
  )
  on conflict (model_key, scope_key)
  do update set
    snapshot_id=excluded.snapshot_id,
    model_version=excluded.model_version,
    status=excluded.status,
    generated_at=excluded.generated_at,
    refreshed_at=now(),
    payload_checksum=excluded.payload_checksum;

  return jsonb_build_object(
    'ok', true,
    'model', 'public_spend_overview',
    'scope', 'global',
    'snapshot_id', v_snapshot.snapshot_id,
    'model_version', 1,
    'payload_checksum', v_checksum,
    'payload_bytes', pg_column_size(v_payload)
  );
end;
$$;

revoke all on function public.atlas_v2_materialize_public_spend_overview(text) from public, anon, authenticated;
grant execute on function public.atlas_v2_materialize_public_spend_overview(text) to service_role;

select pgmq.create('atlas_v2_jobs');

create or replace function public.atlas_v2_enqueue_job(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public, pgmq
as $$
declare
  v_id bigint;
begin
  if p_job_type not in ('REFRESH_PUBLIC_SPEND_OVERVIEW') then
    raise exception 'ATLAS_V2_UNSUPPORTED_JOB_TYPE: %', p_job_type;
  end if;
  select send into v_id
  from pgmq.send(
    'atlas_v2_jobs',
    jsonb_build_object(
      'job_type', p_job_type,
      'payload', coalesce(p_payload,'{}'::jsonb),
      'enqueued_at', now()
    )
  ) limit 1;
  return v_id;
end;
$$;

revoke all on function public.atlas_v2_enqueue_job(text,jsonb) from public, anon, authenticated;
grant execute on function public.atlas_v2_enqueue_job(text,jsonb) to service_role;

create or replace function public.atlas_v2_process_jobs(p_qty integer default 5)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pgmq
as $$
declare
  r record;
  v_processed integer := 0;
  v_failed integer := 0;
  v_job_type text;
  v_payload jsonb;
begin
  p_qty := greatest(1, least(coalesce(p_qty,5), 20));
  for r in select * from pgmq.read('atlas_v2_jobs', 120, p_qty)
  loop
    begin
      v_job_type := r.message->>'job_type';
      v_payload := coalesce(r.message->'payload','{}'::jsonb);
      if v_job_type='REFRESH_PUBLIC_SPEND_OVERVIEW' then
        perform public.atlas_v2_materialize_public_spend_overview(nullif(v_payload->>'snapshot_id',''));
      else
        raise exception 'ATLAS_V2_UNSUPPORTED_JOB_TYPE: %', v_job_type;
      end if;
      perform pgmq.archive('atlas_v2_jobs', r.msg_id);
      v_processed := v_processed + 1;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;
  return jsonb_build_object('processed',v_processed,'failed',v_failed);
end;
$$;

revoke all on function public.atlas_v2_process_jobs(integer) from public, anon, authenticated;
grant execute on function public.atlas_v2_process_jobs(integer) to service_role;
