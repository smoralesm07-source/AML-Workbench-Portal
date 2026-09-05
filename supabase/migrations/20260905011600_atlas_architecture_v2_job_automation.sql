-- ATLAS Architecture v2 job automation
-- Ensures read models are only published after dependent public-spend metrics are complete.

create extension if not exists pg_cron;

create schema if not exists atlas_v2_private;
revoke all on schema atlas_v2_private from public, anon, authenticated;

create or replace function atlas_v2_private.public_spend_snapshot_ready(p_snapshot_id text)
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  s public.ps_snapshot%rowtype;
  v_buyers bigint;
  v_suppliers bigint;
  v_pairs bigint;
begin
  select * into s from public.ps_snapshot where snapshot_id=p_snapshot_id;
  if not found then return false; end if;
  select count(*) into v_buyers from public.ps_buyer_metric where snapshot_id=p_snapshot_id;
  select count(*) into v_suppliers from public.ps_supplier_metric where snapshot_id=p_snapshot_id;
  select count(*) into v_pairs from public.ps_pair_metric where snapshot_id=p_snapshot_id;
  return v_buyers >= s.buyer_count and v_suppliers >= s.supplier_count and v_pairs >= s.pair_count;
end;
$$;

revoke all on function atlas_v2_private.public_spend_snapshot_ready(text) from public, anon, authenticated;
grant execute on function atlas_v2_private.public_spend_snapshot_ready(text) to service_role;

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

create or replace function atlas_v2_private.queue_public_spend_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
begin
  if tg_op='UPDATE' and new.generated_at is not distinct from old.generated_at then
    return new;
  end if;
  perform pgmq.send(
    'atlas_v2_jobs',
    jsonb_build_object(
      'job_type','REFRESH_PUBLIC_SPEND_OVERVIEW',
      'payload',jsonb_build_object('snapshot_id',new.snapshot_id),
      'enqueued_at',now(),
      'source','ps_snapshot_trigger'
    )
  );
  return new;
end;
$$;

revoke all on function atlas_v2_private.queue_public_spend_snapshot() from public, anon, authenticated;

drop trigger if exists atlas_v2_public_spend_snapshot_enqueue on public.ps_snapshot;
create trigger atlas_v2_public_spend_snapshot_enqueue
after insert or update on public.ps_snapshot
for each row execute function atlas_v2_private.queue_public_spend_snapshot();

select cron.schedule(
  'atlas-v2-job-worker',
  '* * * * *',
  $$select public.atlas_v2_process_jobs(5);$$
);
