-- ATLAS v2 · Universos Intelligence
-- Adds a population-analysis read contract without reactivating legacy runtime.

create or replace function atlas_v2_private.universe_intelligence(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','atlas_v2_private'
as $$
declare
  v_lens text := upper(trim(coalesce(p_request->>'lens','UAF')));
  v_total bigint := 0;
  v_summary jsonb := '{}'::jsonb;
  v_distributions jsonb := '{}'::jsonb;
  v_focus jsonb := '[]'::jsonb;
  v_intersections jsonb := '[]'::jsonb;
  v_semantics jsonb := '{}'::jsonb;
  v_generated_at timestamptz := now();
  v_latest_year integer;
  v_profiled bigint := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u where u.user_id=auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;
  if v_lens not in ('SII','UAF','OSFL','RES','SANCIONES') then
    raise exception 'ATLAS_UNIVERSE_LENS_REQUIRED';
  end if;

  if v_lens='SII' then
    select count(*) into v_total from public.aml_sii_registry_company;
    select max(commercial_year) into v_latest_year from public.aml_sii_entity_year;
    select count(*) into v_profiled from public.aml_sii_entity_year where commercial_year=v_latest_year;
    select jsonb_build_object(
      'total',v_total,
      'active',(select count(*) from public.aml_sii_registry_company where current_status='ACTIVE_AS_PUBLISHED'),
      'terminated',(select count(*) from public.aml_sii_registry_company where current_status='TERMINATED_AS_PUBLISHED'),
      'latest_profile_year',v_latest_year,
      'profiled_latest_year',v_profiled,
      'profile_coverage_pct',round(100.0*v_profiled/nullif(v_total,0),1),
      'future_dates',(select count(*) from public.aml_sii_registry_company where activity_start_date>current_date or termination_date>current_date),
      'source_refreshed_at',(select max(refreshed_at) from public.aml_sii_registry_company)
    ) into v_summary;
    select coalesce(jsonb_agg(jsonb_build_object(
      'entity_id',entity_id,'rut',rut,'name',legal_name,'reason','Término de giro reciente',
      'status',current_status,'event_date',termination_date,'source','SII'
    ) order by termination_date desc nulls last),'[]'::jsonb)
    into v_focus from (
      select entity_id,rut,legal_name,current_status,termination_date
      from public.aml_sii_registry_company
      where termination_date is not null and termination_date<=current_date
      order by termination_date desc nulls last limit 24
    ) q;
    v_semantics := jsonb_build_object(
      'population_basis','REGISTRY_COMPANY_MATERIALIZED',
      'regional_sector_basis','LATEST_COMMERCIAL_YEAR_PROFILE',
      'regional_sector_coverage_pct',round(100.0*v_profiled/nullif(v_total,0),1),
      'absence_is_zero',false
    );

  elsif v_lens='UAF' then
    select count(*) into v_total from public.aml_uaf_obligated_subject_snapshot;
    select jsonb_build_object(
      'total',v_total,
      'active_sii',(select count(*) from public.aml_uaf_obligated_subject_snapshot where sii_status='ACTIVE_AS_PUBLISHED'),
      'terminated_sii',(select count(*) from public.aml_uaf_obligated_subject_snapshot where sii_status='TERMINATED_AS_PUBLISHED'),
      'without_sii',(select count(*) from public.aml_uaf_obligated_subject_snapshot where sii_status='SIN_PERFIL_SII'),
      'sanctioned',(select count(*) from public.aml_uaf_obligated_subject_snapshot where coalesce(sanction_event_count,0)>0),
      'high_ipf',(select count(*) from public.aml_uaf_obligated_subject_snapshot where ipf_band in ('MUY_ALTA','ALTA')),
      'without_territory',(select count(*) from public.aml_uaf_obligated_subject_snapshot where region is null or trim(region)=''),
      'source_refreshed_at',(select max(refreshed_at) from public.aml_uaf_obligated_subject_snapshot)
    ) into v_summary;
    select coalesce(jsonb_agg(to_jsonb(q) order by q.priority,q.ipf_score desc nulls last,q.name),'[]'::jsonb)
    into v_focus from (
      select entity_id,rut,coalesce(nullif(entity_name,''),registry_name) as name,uaf_sector_canonical as sector,region,commune,
             sii_status as status,ipf_score,ipf_band,sanction_event_count,
             case when sii_status='TERMINATED_AS_PUBLISHED' then 'Término de giro SII'
                  when sii_status='SIN_PERFIL_SII' then 'Sin perfil SII'
                  when coalesce(sanction_event_count,0)>0 then 'Antecedente sancionatorio'
                  when ipf_band in ('MUY_ALTA','ALTA') then 'IPF alto / muy alto'
                  else 'Prioridad relativa' end as reason,
             case when sii_status='TERMINATED_AS_PUBLISHED' then 1
                  when sii_status='SIN_PERFIL_SII' then 2
                  when coalesce(sanction_event_count,0)>0 then 3
                  when ipf_band in ('MUY_ALTA','ALTA') then 4 else 5 end as priority
      from public.aml_uaf_obligated_subject_snapshot
      order by priority,ipf_score desc nulls last limit 24
    ) q;
    v_semantics := jsonb_build_object(
      'population_basis','UAF_OBLIGATED_SUBJECT_SNAPSHOT',
      'priority_is_probability',false,
      'termination_is_aml_signal',false,
      'absence_is_zero',false
    );

  elsif v_lens='OSFL' then
    select count(*) into v_total from public.aml_v029_osfl_entity_live;
    select jsonb_build_object(
      'total',v_total,
      'with_region',(select count(*) from public.aml_v029_osfl_entity_live where region is not null and trim(region)<>''),
      'r8_candidates',(select count(*) from public.aml_v029_osfl_entity_live where fatf_r8_candidate),
      'direct_confirmed',(select count(*) from public.aml_v029_osfl_entity_live where direct_confirmed),
      'uaf_observed',(select count(*) from public.aml_v029_osfl_entity_live where is_uaf_observed),
      'sanctioned',(select count(*) from public.aml_v029_osfl_entity_live where coalesce(sanction_count,0)>0),
      'source_refreshed_at',(select max(source_refreshed_at) from atlas_v2_private.universe_overview_snapshot where lens='OSFL')
    ) into v_summary;
    select coalesce(jsonb_agg(to_jsonb(q) order by q.priority,q.ipa3_score desc nulls last,q.name),'[]'::jsonb)
    into v_focus from (
      select entity_id,rut,name,region,commune,activity_group as sector,current_status as status,ipa3_score,priority_band_shadow,
             sanction_count,fatf_r8_candidate,direct_confirmed,
             case when coalesce(sanction_count,0)>0 then 'Antecedente sancionatorio'
                  when fatf_r8_candidate then 'Candidato R.8'
                  when not coalesce(direct_confirmed,false) then 'Confirmación parcial'
                  else 'Prioridad analítica' end as reason,
             case when coalesce(sanction_count,0)>0 then 1 when fatf_r8_candidate then 2 when not coalesce(direct_confirmed,false) then 3 else 4 end as priority
      from public.aml_v029_osfl_entity_live
      order by priority,ipa3_score desc nulls last limit 24
    ) q;
    v_semantics := jsonb_build_object(
      'population_basis','OSFL_OBSERVED_MATERIALIZATION',
      'not_legal_national_total',true,
      'r8_is_candidate',true,
      'absence_is_zero',false
    );

  elsif v_lens='RES' then
    select count(*) into v_total from public.aml_res_company;
    select jsonb_build_object(
      'total',v_total,
      'latest_constitution_year',(select max(extract(year from constitution_date)::int) from public.aml_res_company where constitution_date<=current_date),
      'latest_year_count',(select count(*) from public.aml_res_company where extract(year from constitution_date)::int=(select max(extract(year from constitution_date)::int) from public.aml_res_company where constitution_date<=current_date)),
      'with_region',(select count(*) from public.aml_res_company where social_region is not null),
      'future_dates',(select count(*) from public.aml_res_company where constitution_date>current_date),
      'source_refreshed_at',(select max(refreshed_at) from public.aml_res_company)
    ) into v_summary;
    select coalesce(jsonb_agg(jsonb_build_object(
      'entity_id',rut,'rut',rut,'name',legal_name,'region',social_region,'commune',social_commune,
      'event_date',constitution_date,'reason','Constitución reciente observada','capital',capital,'source','RES'
    ) order by constitution_date desc nulls last),'[]'::jsonb)
    into v_focus from (
      select rut,legal_name,social_region,social_commune,constitution_date,capital
      from public.aml_res_company
      where constitution_date is not null and constitution_date<=current_date
      order by constitution_date desc nulls last limit 24
    ) q;
    v_semantics := jsonb_build_object(
      'population_basis','RES_COMPANY_MATERIALIZED_ALL_FILES',
      'constitution_is_activity',false,
      'absence_is_zero',false
    );

  else
    select count(*) into v_total from public.aml_v_sanctions_entity_dossier_current_v0960;
    select jsonb_build_object(
      'total',v_total,
      'events',(select coalesce(sum(event_count),0) from public.aml_v_sanctions_entity_dossier_current_v0960),
      'uaf_registered',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 where is_uaf_registered),
      'osfl_observed',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 where is_osfl_observed),
      'res_observed',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 where is_res_observed),
      'amount_uf_total',(select coalesce(sum(amount_uf_total),0) from public.aml_v_sanctions_entity_dossier_current_v0960),
      'amount_clp_total',(select coalesce(sum(amount_clp_total),0) from public.aml_v_sanctions_entity_dossier_current_v0960),
      'last_event_date',(select max(last_event_date) from public.aml_v_sanctions_entity_dossier_current_v0960),
      'source_refreshed_at',(select max(source_refreshed_at) from atlas_v2_private.universe_overview_snapshot where lens='SANCIONES')
    ) into v_summary;
    select coalesce(jsonb_agg(to_jsonb(q) order by q.event_count desc,q.last_event_date desc nulls last),'[]'::jsonb)
    into v_focus from (
      select entity_id,rut,canonical_name as name,entity_type as sector,region,commune,event_count,regulator_count,last_event_date,
             amount_uf_total,amount_clp_total,'Mayor volumen de eventos administrativos'::text as reason
      from public.aml_v_sanctions_entity_dossier_current_v0960
      order by event_count desc,last_event_date desc nulls last limit 24
    ) q;
    v_semantics := jsonb_build_object(
      'population_basis','SANCTIONS_ENTITY_DOSSIER_CURRENT',
      'sanction_is_aml_signal',false,
      'event_is_entity',false,
      'absence_is_zero',false
    );
  end if;

  select coalesce(jsonb_object_agg(x.dimension,x.items),'{}'::jsonb)
  into v_distributions
  from (
    select dimension,jsonb_agg(jsonb_build_object(
      'key',key,'label',label,'entity_count',entity_count,'metrics',metrics
    ) order by entity_count desc,label) as items
    from atlas_v2_private.universe_distribution_snapshot
    where lens=v_lens
    group by dimension
  ) x;

  if v_lens='SII' then
    select jsonb_agg(x) into v_intersections from (values
      (jsonb_build_object('lens','UAF','entity_count',(select count(*) from public.aml_uaf_obligated_subject_snapshot u join public.aml_sii_registry_company s using(rut)))),
      (jsonb_build_object('lens','OSFL','entity_count',(select count(*) from public.aml_v029_osfl_entity_live o join public.aml_sii_registry_company s using(rut)))),
      (jsonb_build_object('lens','RES','entity_count',(select count(*) from public.aml_res_company r join public.aml_sii_registry_company s using(rut)))),
      (jsonb_build_object('lens','SANCIONES','entity_count',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 z join public.aml_sii_registry_company s using(rut))))
    ) t(x);
  elsif v_lens='UAF' then
    select jsonb_agg(x) into v_intersections from (values
      (jsonb_build_object('lens','SII','entity_count',(select count(*) from public.aml_uaf_obligated_subject_snapshot u join public.aml_sii_registry_company s using(rut)))),
      (jsonb_build_object('lens','OSFL','entity_count',(select count(*) from public.aml_uaf_obligated_subject_snapshot u join public.aml_v029_osfl_entity_live o using(rut)))),
      (jsonb_build_object('lens','RES','entity_count',(select count(*) from public.aml_uaf_obligated_subject_snapshot u join public.aml_res_company r using(rut)))),
      (jsonb_build_object('lens','SANCIONES','entity_count',(select count(*) from public.aml_uaf_obligated_subject_snapshot u join public.aml_v_sanctions_entity_dossier_current_v0960 z using(rut))))
    ) t(x);
  elsif v_lens='OSFL' then
    select jsonb_agg(x) into v_intersections from (values
      (jsonb_build_object('lens','SII','entity_count',(select count(*) from public.aml_v029_osfl_entity_live o join public.aml_sii_registry_company s using(rut)))),
      (jsonb_build_object('lens','UAF','entity_count',(select count(*) from public.aml_v029_osfl_entity_live o join public.aml_uaf_obligated_subject_snapshot u using(rut)))),
      (jsonb_build_object('lens','RES','entity_count',(select count(*) from public.aml_v029_osfl_entity_live o join public.aml_res_company r using(rut)))),
      (jsonb_build_object('lens','SANCIONES','entity_count',(select count(*) from public.aml_v029_osfl_entity_live o join public.aml_v_sanctions_entity_dossier_current_v0960 z using(rut))))
    ) t(x);
  elsif v_lens='RES' then
    select jsonb_agg(x) into v_intersections from (values
      (jsonb_build_object('lens','SII','entity_count',(select count(*) from public.aml_res_company r join public.aml_sii_registry_company s using(rut)))),
      (jsonb_build_object('lens','UAF','entity_count',(select count(*) from public.aml_res_company r join public.aml_uaf_obligated_subject_snapshot u using(rut)))),
      (jsonb_build_object('lens','OSFL','entity_count',(select count(*) from public.aml_res_company r join public.aml_v029_osfl_entity_live o using(rut)))),
      (jsonb_build_object('lens','SANCIONES','entity_count',(select count(*) from public.aml_res_company r join public.aml_v_sanctions_entity_dossier_current_v0960 z using(rut))))
    ) t(x);
  else
    select jsonb_agg(x) into v_intersections from (values
      (jsonb_build_object('lens','SII','entity_count',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 z join public.aml_sii_registry_company s using(rut)))),
      (jsonb_build_object('lens','UAF','entity_count',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 z join public.aml_uaf_obligated_subject_snapshot u using(rut)))),
      (jsonb_build_object('lens','OSFL','entity_count',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 z join public.aml_v029_osfl_entity_live o using(rut)))),
      (jsonb_build_object('lens','RES','entity_count',(select count(*) from public.aml_v_sanctions_entity_dossier_current_v0960 z join public.aml_res_company r using(rut))))
    ) t(x);
  end if;

  return jsonb_build_object(
    'schema','ATLAS_UNIVERSES_QUERY_V2','kind','intelligence','lens',v_lens,
    'generated_at',v_generated_at,'summary',v_summary,'distributions',v_distributions,
    'intersections',coalesce(v_intersections,'[]'::jsonb),'items',coalesce(v_focus,'[]'::jsonb),
    'semantics',v_semantics
  );
end;
$$;

create or replace function atlas_v2_private.universe_slice(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','atlas_v2_private'
as $$
declare
  v_lens text := upper(trim(coalesce(p_request->>'lens','')));
  v_dimension text := lower(trim(coalesce(p_request->>'dimension','')));
  v_key text := trim(coalesce(p_request->>'key',''));
  v_limit integer := greatest(1,least(coalesce(nullif(p_request->>'limit','')::integer,40),80));
  v_items jsonb := '[]'::jsonb;
  v_count bigint := 0;
  v_latest_year integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u where u.user_id=auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;
  if v_lens not in ('SII','UAF','OSFL','RES','SANCIONES') or v_dimension='' or v_key='' then
    raise exception 'ATLAS_UNIVERSE_SLICE_REQUIRED';
  end if;

  if v_lens='SII' then
    select max(commercial_year) into v_latest_year from public.aml_sii_entity_year;
    with base as (
      select c.entity_id,c.rut,c.legal_name as name,c.current_status as status,c.termination_date,
             y.region,y.economic_sector as sector,y.sales_band_code as sales_band,y.workers_numeric as workers
      from public.aml_sii_registry_company c
      left join public.aml_sii_entity_year y on y.entity_id=c.entity_id and y.commercial_year=v_latest_year
      where (v_dimension='status' and coalesce(nullif(c.current_status,''),'SIN_ESTADO')=v_key)
         or (v_dimension='region' and coalesce(nullif(y.region,''),'SIN_REGION')=v_key)
         or (v_dimension='sector' and coalesce(nullif(y.economic_sector,''),'SIN_SECTOR')=v_key)
    ), counted as (select count(*) n from base), ranked as (
      select * from base order by termination_date desc nulls last,name limit v_limit
    )
    select (select n from counted),coalesce((select jsonb_agg(to_jsonb(ranked)) from ranked),'[]'::jsonb) into v_count,v_items;

  elsif v_lens='UAF' then
    with base as (
      select entity_id,rut,coalesce(nullif(entity_name,''),registry_name) as name,uaf_sector_canonical as sector,region,commune,
             sii_status as status,sii_sales_band as sales_band,sii_workers as workers,ipf_score,ipf_band,sanction_event_count
      from public.aml_uaf_obligated_subject_snapshot
      where (v_dimension='region' and coalesce(nullif(region,''),'SIN_REGION')=v_key)
         or (v_dimension='sector' and coalesce(nullif(uaf_sector_canonical,''),'SIN_SECTOR')=v_key)
         or (v_dimension='band' and coalesce(nullif(ipf_band,''),'SIN_BANDA')=v_key)
    ), counted as (select count(*) n from base), ranked as (
      select * from base order by ipf_score desc nulls last,name limit v_limit
    )
    select (select n from counted),coalesce((select jsonb_agg(to_jsonb(ranked)) from ranked),'[]'::jsonb) into v_count,v_items;

  elsif v_lens='OSFL' then
    with base as (
      select entity_id,rut,name,activity_group as sector,region,commune,current_status as status,sales_band,workers_numeric as workers,
             ipa3_score,priority_band_shadow,sanction_count,fatf_r8_candidate,confirmation_level
      from public.aml_v029_osfl_entity_live
      where (v_dimension='region' and coalesce(nullif(region,''),'Sin región observada')=v_key)
         or (v_dimension='activity' and (case when activity_group='Sin actividad detallada' then 'Sin actividad declarada' else activity_group end)=v_key)
         or (v_dimension='confirmation' and coalesce(nullif(confirmation_level,''),'SIN_NIVEL')=v_key)
    ), counted as (select count(*) n from base), ranked as (
      select * from base order by sanction_count desc nulls last,ipa3_score desc nulls last,name limit v_limit
    )
    select (select n from counted),coalesce((select jsonb_agg(to_jsonb(ranked)) from ranked),'[]'::jsonb) into v_count,v_items;

  elsif v_lens='RES' then
    with base as (
      select rut as entity_id,rut,legal_name as name,social_region as region,social_commune as commune,constitution_date,capital
      from public.aml_res_company
      where (v_dimension='region' and coalesce(social_region::text,'SIN_REGION')=v_key)
         or (v_dimension='constitution_year' and extract(year from constitution_date)::int::text=v_key)
    ), counted as (select count(*) n from base), ranked as (
      select * from base order by constitution_date desc nulls last,name limit v_limit
    )
    select (select n from counted),coalesce((select jsonb_agg(to_jsonb(ranked)) from ranked),'[]'::jsonb) into v_count,v_items;

  else
    with base as (
      select entity_id,rut,canonical_name as name,entity_type as sector,region,commune,event_count,regulator_count,last_event_date,
             amount_uf_total,amount_clp_total,is_uaf_registered,is_osfl_observed,is_res_observed
      from public.aml_v_sanctions_entity_dossier_current_v0960
      where (v_dimension='region' and coalesce(nullif(region,''),'SIN_REGION')=v_key)
         or (v_dimension='entity_type' and coalesce(nullif(entity_type,''),'SIN_TIPO')=v_key)
    ), counted as (select count(*) n from base), ranked as (
      select * from base order by event_count desc,last_event_date desc nulls last,name limit v_limit
    )
    select (select n from counted),coalesce((select jsonb_agg(to_jsonb(ranked)) from ranked),'[]'::jsonb) into v_count,v_items;
  end if;

  return jsonb_build_object(
    'schema','ATLAS_UNIVERSES_QUERY_V2','kind','slice','lens',v_lens,'dimension',v_dimension,'key',v_key,
    'summary',jsonb_build_object('entity_count',v_count,'returned',jsonb_array_length(v_items)),
    'items',v_items,'generated_at',now(),
    'semantics',jsonb_build_object('slice_is_exact_category',true,'absence_is_zero',false,'risk_inheritance',false)
  );
end;
$$;

create or replace function public.atlas_v2_universes_query(p_request jsonb)
returns jsonb
language plpgsql
set search_path to 'pg_catalog','public','atlas_v2_private'
as $$
begin
  if lower(trim(coalesce(p_request->>'kind','overview')))='attention' then
    return atlas_v2_private.uaf_sii_attention();
  elsif lower(trim(coalesce(p_request->>'kind','overview')))='intelligence' then
    return atlas_v2_private.universe_intelligence(p_request);
  elsif lower(trim(coalesce(p_request->>'kind','overview')))='slice' then
    return atlas_v2_private.universe_slice(p_request);
  end if;
  return atlas_v2_private.universes_query(p_request);
end;
$$;
