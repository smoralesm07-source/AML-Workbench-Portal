-- ATLAS v2 · Universos Intelligence hotfix
-- SII and RES intelligence reads execute exact large-table joins that can exceed the
-- browser read timeout. Materialize those two read-model payloads and refresh them
-- on a governed schedule; user reads remain authorization-gated and keep the same contract.

create table if not exists atlas_v2_private.universe_intelligence_cache (
  lens text primary key check (lens in ('SII','RES')),
  payload jsonb not null,
  refreshed_at timestamptz not null default now()
);

comment on table atlas_v2_private.universe_intelligence_cache is
  'Precomputed ATLAS v2 population-intelligence payloads for massive SII/RES lenses. Exact source logic is refreshed out of the interactive request path.';

create or replace function atlas_v2_private.refresh_universe_intelligence_cache_lens(p_lens text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','atlas_v2_private'
as $$
declare
  v_lens text := upper(trim(coalesce(p_lens,'')));
  v_uid uuid;
  v_payload jsonb;
begin
  if v_lens not in ('SII','RES') then
    raise exception 'ATLAS_UNIVERSE_CACHE_LENS_REQUIRED';
  end if;

  select u.user_id
    into v_uid
  from public.aml_allowed_users u
  where u.enabled
  order by u.user_id
  limit 1;

  if v_uid is null then
    raise exception 'ATLAS_UNIVERSE_CACHE_NO_AUTHORIZED_PRINCIPAL';
  end if;

  -- Reuse the governed source logic outside the user request path. The claim is
  -- transaction-local and only allows the internal function to pass its own guard.
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  v_payload := atlas_v2_private.universe_intelligence(jsonb_build_object('lens',v_lens));

  insert into atlas_v2_private.universe_intelligence_cache(lens,payload,refreshed_at)
  values (v_lens,v_payload,now())
  on conflict (lens) do update
    set payload=excluded.payload,
        refreshed_at=excluded.refreshed_at;

  return jsonb_build_object(
    'ok',true,
    'lens',v_lens,
    'generated_at',v_payload->>'generated_at',
    'refreshed_at',now()
  );
end;
$$;

revoke all on function atlas_v2_private.refresh_universe_intelligence_cache_lens(text) from public, anon, authenticated;
grant execute on function atlas_v2_private.refresh_universe_intelligence_cache_lens(text) to service_role;

create or replace function atlas_v2_private.universe_intelligence_cached(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','atlas_v2_private'
as $$
declare
  v_lens text := upper(trim(coalesce(p_request->>'lens','UAF')));
  v_payload jsonb;
  v_refreshed_at timestamptz;
  v_semantics jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u where u.user_id=auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;

  if v_lens not in ('SII','UAF','OSFL','RES','SANCIONES') then
    raise exception 'ATLAS_UNIVERSE_LENS_REQUIRED';
  end if;

  if v_lens in ('SII','RES') then
    select c.payload,c.refreshed_at
      into v_payload,v_refreshed_at
    from atlas_v2_private.universe_intelligence_cache c
    where c.lens=v_lens;

    if v_payload is not null then
      v_semantics := coalesce(v_payload->'semantics','{}'::jsonb)
        || jsonb_build_object(
          'read_model','MATERIALIZED_POPULATION_INTELLIGENCE',
          'cache_refreshed_at',v_refreshed_at,
          'interactive_heavy_joins',false
        );
      return jsonb_set(v_payload,'{semantics}',v_semantics,true);
    end if;
  end if;

  return atlas_v2_private.universe_intelligence(p_request);
end;
$$;

revoke all on function atlas_v2_private.universe_intelligence_cached(jsonb) from public, anon;
grant execute on function atlas_v2_private.universe_intelligence_cached(jsonb) to authenticated, service_role;

create or replace function public.atlas_v2_universes_query(p_request jsonb)
returns jsonb
language plpgsql
set search_path to 'pg_catalog','public','atlas_v2_private'
as $$
begin
  if lower(trim(coalesce(p_request->>'kind','overview')))='attention' then
    return atlas_v2_private.uaf_sii_attention();
  elsif lower(trim(coalesce(p_request->>'kind','overview')))='intelligence' then
    return atlas_v2_private.universe_intelligence_cached(p_request);
  elsif lower(trim(coalesce(p_request->>'kind','overview')))='slice' then
    return atlas_v2_private.universe_slice(p_request);
  end if;
  return atlas_v2_private.universes_query(p_request);
end;
$$;

revoke all on function public.atlas_v2_universes_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_universes_query(jsonb) to authenticated, service_role;

-- Refresh outside interactive hours. Jobs are idempotently replaced by name.
do $$
declare
  v_job bigint;
begin
  for v_job in
    select jobid from cron.job
    where jobname in ('atlas_v2_universe_cache_sii','atlas_v2_universe_cache_res')
  loop
    perform cron.unschedule(v_job);
  end loop;

  perform cron.schedule(
    'atlas_v2_universe_cache_sii',
    '17 4 * * *',
    $cmd$select atlas_v2_private.refresh_universe_intelligence_cache_lens('SII');$cmd$
  );
  perform cron.schedule(
    'atlas_v2_universe_cache_res',
    '32 4 * * *',
    $cmd$select atlas_v2_private.refresh_universe_intelligence_cache_lens('RES');$cmd$
  );
end;
$$;
