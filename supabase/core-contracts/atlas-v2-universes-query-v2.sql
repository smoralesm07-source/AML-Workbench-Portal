-- ATLAS v2 · Universos core contract
-- Target project: ldmtlwzqaqmegedktlxr (ATLAS core)
-- This file versions the deployed core contract. It is intentionally NOT part of
-- the v2 project's migration history under supabase/migrations/.
--
-- Product semantics:
--   * SII, UAF/SO, OSFL, RES and Sanciones are lenses, not one additive universe.
--   * Cross-lens membership is EXACT_RUT_ONLY.
--   * Missing in a lens means NOT_OBSERVED_IN_THIS_SNAPSHOT, never inexistence.
--   * Potential SO is a screening hypothesis, not an accredited UAF obligation.
--   * Administrative sanction/enforcement is not an AML/FT signal by itself.

create schema if not exists atlas_v2_private;
revoke all on schema atlas_v2_private from public, anon;
grant usage on schema atlas_v2_private to authenticated, service_role;

create table if not exists atlas_v2_private.universe_overview_snapshot (
  lens text primary key,
  total_count bigint not null,
  source_snapshot text,
  source_refreshed_at timestamptz,
  generated_at timestamptz not null default now(),
  aux jsonb not null default '{}'::jsonb,
  quality jsonb not null default '{}'::jsonb,
  semantics text not null
);

create table if not exists atlas_v2_private.universe_distribution_snapshot (
  lens text not null,
  dimension text not null,
  key text not null,
  label text not null,
  entity_count bigint not null,
  metrics jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  primary key (lens, dimension, key)
);

revoke all on atlas_v2_private.universe_overview_snapshot from public, anon, authenticated;
revoke all on atlas_v2_private.universe_distribution_snapshot from public, anon, authenticated;

create or replace function atlas_v2_private.refresh_universe_read_models()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_now timestamptz := now();
  v_latest_year integer;
begin
  truncate table atlas_v2_private.universe_overview_snapshot;
  truncate table atlas_v2_private.universe_distribution_snapshot;

  insert into atlas_v2_private.universe_overview_snapshot
    (lens,total_count,source_snapshot,source_refreshed_at,generated_at,aux,quality,semantics)
  select 'SII',coalesce(s.accepted_count,s.record_count,0),s.snapshot_id,
         coalesce(s.refreshed_at,s.source_updated_at),v_now,
         jsonb_build_object('record_count',s.record_count,'accepted_count',s.accepted_count,'status',s.status),
         jsonb_build_object(
           'future_activity_start_dates',(select count(*) from public.aml_sii_registry_company where activity_start_date>current_date),
           'future_termination_dates',(select count(*) from public.aml_sii_registry_company where termination_date>current_date)
         ),
         'Padrón tributario observado; fechas futuras se reportan como incidencias de calidad, no se normalizan silenciosamente.'
  from public.aml_sii_registry_snapshot s
  order by s.refreshed_at desc nulls last limit 1;

  insert into atlas_v2_private.universe_overview_snapshot
    (lens,total_count,source_snapshot,source_refreshed_at,generated_at,aux,quality,semantics)
  select 'UAF',coalesce((u.payload#>>'{registry,subjects}')::bigint,0),u.snapshot_key,u.refreshed_at,v_now,
         jsonb_build_object(
           'sectors',u.payload#>'{registry,sectors}',
           'legal_persons',u.payload#>'{registry,legal_persons}',
           'natural_persons',u.payload#>'{registry,natural_persons}',
           'public_bodies',u.payload#>'{registry,public_bodies}',
           'potential_actionable',u.payload#>'{potential,universe,actionable}',
           'potential_semantics',u.payload#>'{potential,methodology,semantics}'
         ),
         jsonb_build_object(
           'sii_coverage_pct',u.payload#>'{sii,coverage_pct}',
           'without_territory',coalesce((
             select (x->>'count')::bigint
             from jsonb_array_elements(coalesce(u.payload->'gaps','[]'::jsonb)) x
             where x->>'code'='SIN_TERRITORIO_OBSERVADO' limit 1
           ),0)
         ),
         'Registro de sujetos obligados observado. Candidatos potenciales son hipótesis de screening y no obligación acreditada.'
  from public.aml_uaf_obligated_overview_snapshot u
  order by u.refreshed_at desc nulls last limit 1;

  insert into atlas_v2_private.universe_overview_snapshot
    (lens,total_count,source_snapshot,source_refreshed_at,generated_at,aux,quality,semantics)
  select 'OSFL',coalesce((o.quality->>'canonical_entities')::bigint,(o.meta#>>'{universe,expanded}')::bigint,0),
         o.source_snapshot,o.generated_at,v_now,
         jsonb_build_object(
           'expanded_profiles',o.meta#>'{universe,expanded}',
           'r8_candidates',o.meta#>'{universe,r8_candidates}',
           'confirmed_direct',o.meta#>'{universe,confirmed_direct}',
           'public_registry_entities',o.source_coverage->'public_registry_entities'
         ),
         jsonb_build_object(
           'with_rut',o.quality->'with_rut',
           'with_region',o.quality->'with_region',
           'pending_entity_hub',o.source_coverage->'pending_entity_hub'
         ),
         'Universo OSFL observado y reconciliado en el corte; no representa por sí mismo el total legal nacional de OSFL.'
  from public.aml_osfl_dashboard_runtime_snapshot o
  order by o.generated_at desc nulls last limit 1;

  insert into atlas_v2_private.universe_overview_snapshot
    (lens,total_count,source_snapshot,source_refreshed_at,generated_at,aux,quality,semantics)
  select 'RES',coalesce(r.record_count,0),r.snapshot_id,coalesce(r.refreshed_at,r.source_updated_at),v_now,
         jsonb_build_object('cutoff_date',r.cutoff_date,'resource_name',r.resource_name,'status',r.status),
         jsonb_build_object('future_constitution_dates',(select count(*) from public.aml_res_company where constitution_date>current_date)),
         'Registro de Empresas y Sociedades observado; constitución y presencia registral no equivalen a actividad tributaria vigente.'
  from public.aml_res_source_snapshot r
  order by r.refreshed_at desc nulls last limit 1;

  insert into atlas_v2_private.universe_overview_snapshot
    (lens,total_count,source_snapshot,source_refreshed_at,generated_at,aux,quality,semantics)
  select 'SANCIONES',coalesce(s.entity_key_count,0),'SANCTIONS_RUNTIME_V0961',s.refreshed_at,v_now,
         jsonb_build_object(
           'event_count',s.event_count,
           'regulatory_events',s.regulatory_sanction_event_count,
           'cgr_enforcement_events',s.cgr_enforcement_event_count,
           'sanctioned_universe_entities',s.sanctioned_universe_entity_count,
           'events_with_document',s.events_with_document,
           'amount_uf_total',s.amount_uf_total,
           'amount_clp_total',s.amount_clp_total,
           'last_event_date',s.last_event_date
         ),
         jsonb_build_object('events_outside_or_unresolved_universe',s.events_outside_or_unresolved_universe),
         coalesce(s.semantics,'Sanción administrativa o enforcement no equivale a señal AML/FT.')
  from public.aml_sanctions_overview_runtime_snapshot_v0961 s limit 1;

  select max(commercial_year) into v_latest_year from public.aml_sii_entity_year;

  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'SII','region',coalesce(nullif(region,''),'SIN_REGION'),coalesce(nullif(region,''),'Sin región observada'),count(*),v_now
  from public.aml_sii_entity_year where commercial_year=v_latest_year group by 1,2,3,4;
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'SII','sector',coalesce(nullif(economic_sector,''),'SIN_SECTOR'),coalesce(nullif(economic_sector,''),'Sin sector observado'),count(*),v_now
  from public.aml_sii_entity_year where commercial_year=v_latest_year group by 1,2,3,4;
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'SII','status',coalesce(nullif(current_status,''),'SIN_ESTADO'),coalesce(nullif(current_status,''),'Sin estado observado'),count(*),v_now
  from public.aml_sii_registry_company group by 1,2,3,4;

  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'UAF','region',coalesce(nullif(region,''),'SIN_REGION'),coalesce(nullif(region,''),'Sin territorio observado'),count(*),v_now
  from public.aml_uaf_obligated_subject_snapshot group by 1,2,3,4;
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'UAF','sector',coalesce(nullif(uaf_sector_canonical,''),'SIN_SECTOR'),coalesce(nullif(uaf_sector_canonical,''),'Sin sector observado'),count(*),v_now
  from public.aml_uaf_obligated_subject_snapshot group by 1,2,3,4;
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'UAF','band',coalesce(nullif(ipf_band,''),'SIN_BANDA'),coalesce(nullif(ipf_band,''),'Sin banda'),count(*),v_now
  from public.aml_uaf_obligated_subject_snapshot group by 1,2,3,4;

  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,metrics,generated_at)
  select 'OSFL','region',coalesce(nullif(x->>'name',''),'SIN_REGION'),coalesce(nullif(x->>'name',''),'Sin región observada'),
         coalesce((x->>'n')::bigint,0),jsonb_build_object('r8_candidates',coalesce((x->>'r8')::bigint,0)),v_now
  from public.aml_osfl_dashboard_runtime_snapshot o
  cross join lateral jsonb_array_elements(coalesce(o.meta->'regions','[]'::jsonb)) x
  where o.snapshot_key='CURRENT';
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,metrics,generated_at)
  select 'OSFL','activity',coalesce(nullif(x->>'name',''),'SIN_ACTIVIDAD'),coalesce(nullif(x->>'name',''),'Sin actividad observada'),
         coalesce((x->>'n')::bigint,0),jsonb_build_object('r8_candidates',coalesce((x->>'r8')::bigint,0)),v_now
  from public.aml_osfl_dashboard_runtime_snapshot o
  cross join lateral jsonb_array_elements(coalesce(o.meta->'activities','[]'::jsonb)) x
  where o.snapshot_key='CURRENT';
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'OSFL','confirmation',coalesce(nullif(x->>'k',''),'SIN_NIVEL'),coalesce(nullif(x->>'k',''),'Sin nivel'),coalesce((x->>'n')::bigint,0),v_now
  from public.aml_osfl_dashboard_runtime_snapshot o
  cross join lateral jsonb_array_elements(coalesce(o.meta->'confirmation','[]'::jsonb)) x
  where o.snapshot_key='CURRENT';

  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'RES','region',coalesce(social_region::text,'SIN_REGION'),coalesce(social_region::text,'Sin región observada'),count(*),v_now
  from public.aml_res_company group by 1,2,3,4;
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,generated_at)
  select 'RES','constitution_year',extract(year from constitution_date)::int::text,extract(year from constitution_date)::int::text,count(*),v_now
  from public.aml_res_company where constitution_date is not null and constitution_date<=current_date group by 1,2,3,4;

  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,metrics,generated_at)
  select 'SANCIONES','region',coalesce(nullif(region,''),'SIN_REGION'),coalesce(nullif(region,''),'Sin región observada'),count(*),
         jsonb_build_object('events',sum(event_count)),v_now
  from public.aml_v_sanctions_entity_dossier_current_v0960 group by 1,2,3,4;
  insert into atlas_v2_private.universe_distribution_snapshot(lens,dimension,key,label,entity_count,metrics,generated_at)
  select 'SANCIONES','entity_type',coalesce(nullif(entity_type,''),'SIN_TIPO'),coalesce(nullif(entity_type,''),'Sin tipo observado'),count(*),
         jsonb_build_object('events',sum(event_count)),v_now
  from public.aml_v_sanctions_entity_dossier_current_v0960 group by 1,2,3,4;
end;
$function$;

revoke all on function atlas_v2_private.refresh_universe_read_models() from public, anon, authenticated;
grant execute on function atlas_v2_private.refresh_universe_read_models() to service_role;

-- Governed browser-facing contract. The SECURITY DEFINER function remains in an
-- unexposed schema and performs its own allow-list authorization check.
create or replace function atlas_v2_private.universes_query(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','overview')));
  v_lens text := upper(trim(coalesce(p_request->>'lens','')));
  v_dimension text := lower(trim(coalesce(p_request->>'dimension','')));
  v_search text := nullif(trim(coalesce(p_request->>'search','')),'');
  v_rut text := upper(regexp_replace(coalesce(p_request->>'rut',''),'[^0-9Kk]','','g'));
  v_limit integer := greatest(1,least(coalesce(nullif(p_request->>'limit','')::integer,40),100));
  v_offset integer := greatest(0,least(coalesce(nullif(p_request->>'offset','')::integer,0),10000));
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_generated_at timestamptz;
  v_latest_year integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u
    where u.user_id=auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;

  if v_kind='overview' then
    select max(generated_at) into v_generated_at from atlas_v2_private.universe_overview_snapshot;
    select coalesce(jsonb_agg(jsonb_build_object(
      'lens',lens,'total_count',total_count,'source_snapshot',source_snapshot,
      'source_refreshed_at',source_refreshed_at,'generated_at',generated_at,
      'aux',aux,'quality',quality,'semantics',semantics
    ) order by case lens when 'SII' then 1 when 'UAF' then 2 when 'OSFL' then 3 when 'RES' then 4 else 5 end),'[]'::jsonb)
    into v_items from atlas_v2_private.universe_overview_snapshot;
    return jsonb_build_object(
      'schema','ATLAS_UNIVERSES_QUERY_V2','kind',v_kind,'generated_at',v_generated_at,'items',v_items,
      'semantics',jsonb_build_object('lenses_are_not_union',true,'absence_is_zero',false,'identity_join','EXACT_RUT_ONLY','sanction_is_aml_signal',false)
    );
  elsif v_kind='distribution' then
    if v_lens not in ('SII','UAF','OSFL','RES','SANCIONES') then raise exception 'ATLAS_UNIVERSE_LENS_REQUIRED'; end if;
    if v_dimension='' then
      v_dimension := case v_lens when 'SII' then 'region' when 'UAF' then 'sector' when 'OSFL' then 'activity' when 'RES' then 'constitution_year' else 'region' end;
    end if;
    select max(generated_at) into v_generated_at
    from atlas_v2_private.universe_distribution_snapshot where lens=v_lens and dimension=v_dimension;
    select coalesce(jsonb_agg(jsonb_build_object('key',key,'label',label,'entity_count',entity_count,'metrics',metrics) order by entity_count desc,label),'[]'::jsonb)
    into v_items from (
      select * from atlas_v2_private.universe_distribution_snapshot
      where lens=v_lens and dimension=v_dimension
      order by entity_count desc,label limit v_limit offset v_offset
    ) q;
    return jsonb_build_object('schema','ATLAS_UNIVERSES_QUERY_V2','kind',v_kind,'lens',v_lens,'dimension',v_dimension,
      'generated_at',v_generated_at,'items',v_items,'semantics',jsonb_build_object('distribution_is_snapshot',true,'absence_is_zero',false));
  elsif v_kind='entities' then
    if v_lens not in ('SII','UAF','OSFL','RES','SANCIONES') then raise exception 'ATLAS_UNIVERSE_LENS_REQUIRED'; end if;
    if v_lens in ('SII','RES') and coalesce(length(v_search),0)<2 then
      return jsonb_build_object('schema','ATLAS_UNIVERSES_QUERY_V2','kind',v_kind,'lens',v_lens,'items','[]'::jsonb,
        'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',0,'has_more',false),
        'semantics',jsonb_build_object('search_required',true,'minimum_search_length',2));
    end if;

    if v_lens='SII' then
      select max(commercial_year) into v_latest_year from public.aml_sii_entity_year;
      with ranked as (
        select c.entity_id,c.rut,c.legal_name as name,c.current_status as status,c.activity_start_date,c.termination_date,
               y.region,y.economic_sector as sector,y.sales_band_code as sales_band,y.workers_numeric as workers,c.refreshed_at
        from public.aml_sii_registry_company c
        left join public.aml_sii_entity_year y on y.entity_id=c.entity_id and y.commercial_year=v_latest_year
        where v_search is not null and (c.rut ilike '%'||v_search||'%' or c.legal_name ilike '%'||v_search||'%')
        order by case when upper(regexp_replace(c.rut,'[^0-9K]','','g'))=upper(regexp_replace(v_search,'[^0-9K]','','g')) then 0 else 1 end,c.legal_name
        limit v_limit offset v_offset
      ) select coalesce(jsonb_agg(to_jsonb(ranked)),'[]'::jsonb),count(*) into v_items,v_count from ranked;
    elsif v_lens='UAF' then
      with ranked as (
        select entity_id,rut,coalesce(nullif(entity_name,''),registry_name) as name,region,commune,uaf_sector_canonical as sector,
               sii_status as status,sii_sales_band as sales_band,sii_workers as workers,ipf_score,ipf_band,ipf_percentile,
               sanction_event_count,source_count,refreshed_at
        from public.aml_uaf_obligated_subject_snapshot
        where v_search is null or rut ilike '%'||v_search||'%' or registry_name ilike '%'||v_search||'%' or coalesce(entity_name,'') ilike '%'||v_search||'%'
        order by ipf_score desc nulls last,registry_name limit v_limit offset v_offset
      ) select coalesce(jsonb_agg(to_jsonb(ranked)),'[]'::jsonb),count(*) into v_items,v_count from ranked;
    elsif v_lens='OSFL' then
      with ranked as (
        select entity_id,rut,name,region,commune,confirmation_level,current_status as status,main_activity,
               sales_band,workers_numeric as workers,sanction_count,ipa3_score,coverage_index_pct,osfl_snapshot
        from public.aml_v029_osfl_entity_live
        where v_search is null or rut ilike '%'||v_search||'%' or name ilike '%'||v_search||'%'
        order by ipa3_score desc nulls last,name limit v_limit offset v_offset
      ) select coalesce(jsonb_agg(to_jsonb(ranked)),'[]'::jsonb),count(*) into v_items,v_count from ranked;
    elsif v_lens='RES' then
      with ranked as (
        select rut as entity_id,rut,legal_name as name,constitution_date,registry_date,sii_approval_date,
               social_region as region,social_commune as commune,capital,source_snapshot_id,refreshed_at
        from public.aml_res_company
        where v_search is not null and (rut ilike '%'||v_search||'%' or legal_name ilike '%'||v_search||'%')
        order by case when upper(regexp_replace(rut,'[^0-9K]','','g'))=upper(regexp_replace(v_search,'[^0-9K]','','g')) then 0 else 1 end,
                 constitution_date desc nulls last,legal_name
        limit v_limit offset v_offset
      ) select coalesce(jsonb_agg(to_jsonb(ranked)),'[]'::jsonb),count(*) into v_items,v_count from ranked;
    else
      with ranked as (
        select entity_id,rut,canonical_name as name,entity_type,region,commune,event_count,regulator_count,first_event_date,last_event_date,
               amount_uf_total,amount_clp_total,regulators,is_uaf_registered,is_osfl_observed,is_res_observed
        from public.aml_v_sanctions_entity_dossier_current_v0960
        where v_search is null or coalesce(rut,'') ilike '%'||v_search||'%' or canonical_name ilike '%'||v_search||'%'
        order by event_count desc,last_event_date desc nulls last,canonical_name limit v_limit offset v_offset
      ) select coalesce(jsonb_agg(to_jsonb(ranked)),'[]'::jsonb),count(*) into v_items,v_count from ranked;
    end if;

    return jsonb_build_object('schema','ATLAS_UNIVERSES_QUERY_V2','kind',v_kind,'lens',v_lens,'items',v_items,
      'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit,
        'next_offset',case when v_count=v_limit then v_offset+v_limit else null end),
      'semantics',jsonb_build_object('lens_semantics_preserved',true,'absence_is_zero',false,'priority_is_probability',false));
  elsif v_kind='membership' then
    if v_rut='' then raise exception 'ATLAS_UNIVERSE_RUT_REQUIRED'; end if;
    return jsonb_build_object(
      'schema','ATLAS_UNIVERSES_QUERY_V2','kind',v_kind,'rut',v_rut,
      'membership',jsonb_build_object(
        'SII',coalesce((select jsonb_build_object('present',true,'entity_id',entity_id,'name',legal_name,'status',current_status)
                        from public.aml_sii_registry_company where upper(regexp_replace(rut,'[^0-9K]','','g'))=v_rut limit 1),jsonb_build_object('present',false)),
        'UAF',coalesce((select jsonb_build_object('present',true,'entity_id',entity_id,'name',coalesce(nullif(entity_name,''),registry_name),'sector',uaf_sector_canonical)
                        from public.aml_uaf_obligated_subject_snapshot where upper(regexp_replace(rut,'[^0-9K]','','g'))=v_rut limit 1),jsonb_build_object('present',false)),
        'OSFL',coalesce((select jsonb_build_object('present',true,'entity_id',entity_id,'name',name,'confirmation_level',confirmation_level)
                         from public.aml_v029_osfl_entity_live where upper(regexp_replace(rut,'[^0-9K]','','g'))=v_rut limit 1),jsonb_build_object('present',false)),
        'RES',coalesce((select jsonb_build_object('present',true,'entity_id',rut,'name',legal_name,'constitution_date',constitution_date)
                        from public.aml_res_company where upper(regexp_replace(rut,'[^0-9K]','','g'))=v_rut limit 1),jsonb_build_object('present',false)),
        'SANCIONES',coalesce((select jsonb_build_object('present',true,'entity_id',entity_id,'name',canonical_name,'event_count',event_count,'last_event_date',last_event_date)
                              from public.aml_v_sanctions_entity_dossier_current_v0960
                              where upper(regexp_replace(coalesce(rut,''),'[^0-9K]','','g'))=v_rut limit 1),jsonb_build_object('present',false))
      ),
      'semantics',jsonb_build_object('identity_join','EXACT_RUT_ONLY','absence_means','NOT_OBSERVED_IN_THIS_SNAPSHOT','risk_inheritance',false)
    );
  end if;

  raise exception 'ATLAS_UNIVERSES_INVALID_KIND';
end;
$function$;

revoke all on function atlas_v2_private.universes_query(jsonb) from public, anon;
grant execute on function atlas_v2_private.universes_query(jsonb) to authenticated, service_role;

create or replace function public.atlas_v2_universes_query(p_request jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog','public'
as $$
  select atlas_v2_private.universes_query(p_request);
$$;

revoke all on function public.atlas_v2_universes_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_universes_query(jsonb) to authenticated, service_role;
