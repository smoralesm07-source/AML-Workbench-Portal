-- ATLAS v2 · Territory + Vigilance core contract
-- Target: ATLAS core project. This file versions the contract deployed on 2026-09-07.
-- It is intentionally stored under core-contracts, not under the v2 project's migrations.
--
-- Binding semantics:
--   TERRITORY: IGR v4 = BETA_CONTEXTUAL; context never inherits to entity risk;
--              CEAD is contextual; missing != zero; priority != probability.
--   WATCH: signal != finding; priority != probability; follow-up optional;
--          READY snapshots are captured immutably; NEW/CHANGED/REMOVED are snapshot diffs;
--          REMOVED != resolved/closed; BASELINE_ONLY != no change.

create schema if not exists atlas_v2_private;
revoke all on schema atlas_v2_private from public, anon;
grant usage on schema atlas_v2_private to authenticated, service_role;

create table if not exists atlas_v2_private.watch_alert_history (
  snapshot_id text not null,
  published_at timestamptz not null,
  alert_id text not null,
  family text,
  pattern_type text,
  scope_type text,
  scope_id text,
  scope_label text,
  strength numeric,
  priority text,
  title text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  primary key (snapshot_id, alert_id)
);
create index if not exists watch_alert_history_published_idx on atlas_v2_private.watch_alert_history (published_at desc, family, priority);
create index if not exists watch_alert_history_scope_idx on atlas_v2_private.watch_alert_history (scope_type, scope_id, published_at desc);

create table if not exists atlas_v2_private.watch_source_history (
  snapshot_id text not null,
  published_at timestamptz not null,
  source_code text not null,
  source_name text,
  source_class text,
  integration_mode text,
  authoritative_source text,
  software_status text,
  data_status text,
  last_source_record_at timestamptz,
  last_successful_ingest_at timestamptz,
  records_24h bigint,
  error_rate_24h numeric,
  notes text,
  captured_at timestamptz not null default now(),
  primary key (snapshot_id, source_code)
);
create index if not exists watch_source_history_published_idx on atlas_v2_private.watch_source_history (published_at desc, data_status, source_code);
revoke all on atlas_v2_private.watch_alert_history from public, anon, authenticated;
revoke all on atlas_v2_private.watch_source_history from public, anon, authenticated;

create or replace function atlas_v2_private.capture_watch_snapshot(p_snapshot_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_published_at timestamptz;
begin
  select coalesce(published_at, generated_at) into v_published_at
  from public.obs_snapshot where snapshot_id=p_snapshot_id and status='READY';
  if v_published_at is null then return; end if;

  insert into atlas_v2_private.watch_alert_history
    (snapshot_id,published_at,alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,payload)
  select p_snapshot_id,v_published_at,a.alert_id,a.family,a.pattern_type,a.scope_type,a.scope_id,a.scope_label,a.strength,a.priority,a.title,a.summary,coalesce(a.payload,'{}'::jsonb)
  from public.obs_alert a where a.snapshot_id=p_snapshot_id
  on conflict (snapshot_id,alert_id) do nothing;

  insert into atlas_v2_private.watch_source_history
    (snapshot_id,published_at,source_code,source_name,source_class,integration_mode,authoritative_source,software_status,data_status,last_source_record_at,last_successful_ingest_at,records_24h,error_rate_24h,notes)
  select p_snapshot_id,v_published_at,s.source_code,s.source_name,s.source_class,s.integration_mode,s.authoritative_source,s.software_status,s.data_status,s.last_source_record_at,s.last_successful_ingest_at,s.records_24h,s.error_rate_24h,s.notes
  from public.obs_source_health s where s.snapshot_id=p_snapshot_id
  on conflict (snapshot_id,source_code) do nothing;
end;
$$;

create or replace function atlas_v2_private.capture_watch_snapshot_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status='READY' and (old.status is distinct from new.status or old.published_at is distinct from new.published_at) then
    perform atlas_v2_private.capture_watch_snapshot(new.snapshot_id);
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_v2_watch_capture_ready on public.obs_snapshot;
create trigger atlas_v2_watch_capture_ready
after update of status,published_at on public.obs_snapshot
for each row execute function atlas_v2_private.capture_watch_snapshot_trigger();

create or replace function atlas_v2_private.territory_query(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','overview')));
  v_region text := nullif(trim(coalesce(p_request->>'region','')),'');
  v_commune text := nullif(trim(coalesce(p_request->>'commune','')),'');
  v_commune_code text := nullif(trim(coalesce(p_request->>'commune_code','')),'');
  v_priority text := nullif(upper(trim(coalesce(p_request->>'priority',''))),'');
  v_search text := nullif(trim(coalesce(p_request->>'search','')),'');
  v_limit integer := greatest(1,least(coalesce(nullif(p_request->>'limit','')::integer,40),200));
  v_offset integer := greatest(0,least(coalesce(nullif(p_request->>'offset','')::integer,0),10000));
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_count integer := 0;
  v_generated_at timestamptz;
  v_method text;
  v_cead_year integer;
begin
  if auth.uid() is null or not exists (select 1 from public.aml_allowed_users u where u.user_id=auth.uid() and u.enabled) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;

  select max(coalesce(snapshot_generated_at,generated_at,updated_at)),max(method),max(cead_year)
    into v_generated_at,v_method,v_cead_year from public.aml_beta_territory_igr_snapshot_v4;

  if v_kind in ('overview','regions') then
    with base as (
      select b.region,count(*)::int commune_count,round(avg(b.igr),2) igr_mean,round(max(b.igr),2) igr_max,
             round(avg(b.vulnerability),2) vulnerability_mean,round(avg(b.density),2) density_mean,
             round(avg(b.gap),2) gap_mean,round(avg(b.threat),2) threat_mean,
             sum(coalesce(b.potential_total,0)) potential_total,sum(coalesce(b.uaf_observed,0)) uaf_observed,
             round(avg(b.mapping_quality),2) mapping_quality_mean,round(avg(b.cead_confidence),2) cead_confidence_mean,max(b.cead_year) cead_year
      from public.aml_beta_territory_igr_snapshot_v4 b group by b.region
    ), joined as (
      select b.*,e.entity_count economic_entities,e.active_entity_count active_entities,e.workers_total,e.entities_started_since_2024,
             c.finding_count,c.osfl_entity_count,c.press_finding_count,c.press_territorial_count,
             i.scored_entities,i.high_entities,i.very_high_entities,i.multi_group_entities,i.avg_coverage_index_pct,i.avg_score_confidence_pct
      from base b
      left join public.aml_v022_geo_economic_region e on e.region=b.region
      left join public.aml_v022_geo_context_region c on c.region=b.region
      left join public.aml_v026_geo_ipa_region i on i.region=b.region
      where v_region is null or b.region=v_region
    )
    select coalesce(jsonb_agg(to_jsonb(j) order by j.igr_mean desc nulls last,j.region),'[]'::jsonb),count(*) into v_items,v_count from joined j;

    return jsonb_build_object('schema','ATLAS_TERRITORY_QUERY_V2','kind',v_kind,'generated_at',v_generated_at,'method',v_method,'cead_year',v_cead_year,'items',v_items,
      'summary',jsonb_build_object('region_count',(select count(distinct region) from public.aml_beta_territory_igr_snapshot_v4),'commune_count',(select count(*) from public.aml_beta_territory_igr_snapshot_v4),'territorial_alert_count',(select count(*) from public.obs_alert where family='TERRITORIO'),'geo_coverage_pct',(select round(max(geo_coverage_pct),2) from public.aml_v032_geo_uaf_territory where level='REGION')),
      'semantics',jsonb_build_object('igr_status','BETA_CONTEXTUAL','territory_is_entity_risk',false,'context_inherits_to_entity',false,'missing_equals_zero',false,'priority_is_probability',false,'cead_is_context',true));

  elsif v_kind='communes' then
    with q as (
      select b.region,b.commune,b.commune_code,b.igr,b.vulnerability,b.density,b.gap,b.threat,b.density_raw_per_1000,b.potential_total,b.uaf_observed,b.mapping_quality,b.ve_sector_core,b.ve_economic_materiality,b.cead_confidence,b.cead_year,b.method,coalesce(b.snapshot_generated_at,b.generated_at,b.updated_at) refreshed_at
      from public.aml_beta_territory_igr_snapshot_v4 b
      where (v_region is null or b.region=v_region) and (v_search is null or b.commune ilike '%'||v_search||'%' or b.region ilike '%'||v_search||'%' or b.commune_code=v_search)
      order by b.igr desc nulls last,b.region,b.commune limit v_limit offset v_offset
    ) select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),count(*) into v_items,v_count from q;
    return jsonb_build_object('schema','ATLAS_TERRITORY_QUERY_V2','kind',v_kind,'region',v_region,'generated_at',v_generated_at,'items',v_items,'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit),'semantics',jsonb_build_object('igr_status','BETA_CONTEXTUAL','territory_is_entity_risk',false,'missing_equals_zero',false));

  elsif v_kind='detail' then
    select to_jsonb(b) into v_item from public.aml_beta_territory_igr_snapshot_v4 b
    where (v_commune_code is not null and b.commune_code=v_commune_code) or (v_commune_code is null and v_region is not null and v_commune is not null and b.region=v_region and b.commune=v_commune)
    order by b.igr desc nulls last limit 1;
    if v_item is null then return jsonb_build_object('schema','ATLAS_TERRITORY_QUERY_V2','kind',v_kind,'item',null,'generated_at',v_generated_at,'semantics',jsonb_build_object('absence_means','NOT_OBSERVED_IN_THIS_SNAPSHOT')); end if;
    select v_item || jsonb_build_object('uaf_context',coalesce((select jsonb_build_object('uaf_observed',u.uaf_observed,'uaf_profiled',u.uaf_profiled,'sector_entity_count',u.sector_entity_count,'sector_counts',u.sector_counts,'geo_coverage_pct',u.geo_coverage_pct,'snapshot_generated_at',u.snapshot_generated_at) from public.aml_v032_geo_uaf_territory u where u.level='COMMUNE' and u.region=v_item->>'region' and u.commune=v_item->>'commune' limit 1),'{}'::jsonb)) into v_item;
    return jsonb_build_object('schema','ATLAS_TERRITORY_QUERY_V2','kind',v_kind,'item',v_item,'generated_at',v_generated_at,'semantics',jsonb_build_object('igr_status','BETA_CONTEXTUAL','territory_is_entity_risk',false,'context_inherits_to_entity',false,'cead_is_context',true));

  elsif v_kind='signals' then
    with q as (
      select a.alert_id,a.family,a.pattern_type,a.scope_type,a.scope_id,a.scope_label,a.strength,a.priority,a.title,a.summary,a.payload,a.snapshot_id,a.refreshed_at
      from public.obs_alert a where a.family='TERRITORIO' and (v_priority is null or upper(a.priority)=v_priority) and (v_region is null or a.scope_label ilike '%'||v_region||'%' or a.payload::text ilike '%'||v_region||'%')
      order by case upper(a.priority) when 'MUY ALTA' then 4 when 'ALTA' then 3 when 'MEDIA' then 2 else 1 end desc,a.strength desc nulls last,a.title limit v_limit offset v_offset
    ) select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),count(*) into v_items,v_count from q;
    return jsonb_build_object('schema','ATLAS_TERRITORY_QUERY_V2','kind',v_kind,'items',v_items,'generated_at',v_generated_at,'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit),'semantics',jsonb_build_object('alert_is_finding',false,'priority_is_probability',false,'territorial_alert_inherits_to_entity',false));

  elsif v_kind='entities' then
    if v_region is null then raise exception 'ATLAS_TERRITORY_REGION_REQUIRED'; end if;
    with q as (
      select e.entity_id,e.rut,e.name,e.entity_type,e.region,e.commune,e.source_count,e.sources,e.roles,e.is_uaf_observed,e.is_sanctioned,e.uaf_sector,e.event_count,e.finding_count,e.alert_count,e.sanction_count,e.refreshed_at
      from public.obs_entity e where e.region=v_region and (v_commune is null or e.commune=v_commune) and (v_search is null or e.name ilike '%'||v_search||'%' or coalesce(e.rut,'') ilike '%'||v_search||'%')
      order by e.alert_count desc,e.finding_count desc,e.source_count desc,e.name limit v_limit offset v_offset
    ) select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),count(*) into v_items,v_count from q;
    return jsonb_build_object('schema','ATLAS_TERRITORY_QUERY_V2','kind',v_kind,'region',v_region,'commune',v_commune,'items',v_items,'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit),'semantics',jsonb_build_object('ordering_basis','OBSERVABILITY_NOT_RISK','territory_is_entity_risk',false,'context_inherits_to_entity',false));
  end if;
  raise exception 'ATLAS_TERRITORY_INVALID_KIND';
end;
$$;

create or replace function public.atlas_v2_territory_query(p_request jsonb)
returns jsonb language sql set search_path = pg_catalog, public
as $$ select atlas_v2_private.territory_query(p_request); $$;
revoke all on function public.atlas_v2_territory_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_territory_query(jsonb) to authenticated;

create or replace function atlas_v2_private.watch_query(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','overview')));
  v_family text := nullif(upper(trim(coalesce(p_request->>'family',''))),'');
  v_priority text := nullif(upper(trim(coalesce(p_request->>'priority',''))),'');
  v_scope_type text := nullif(upper(trim(coalesce(p_request->>'scope_type',''))),'');
  v_search text := nullif(trim(coalesce(p_request->>'search','')),'');
  v_limit integer := greatest(1,least(coalesce(nullif(p_request->>'limit','')::integer,40),200));
  v_offset integer := greatest(0,least(coalesce(nullif(p_request->>'offset','')::integer,0),10000));
  v_latest text; v_previous text; v_latest_at timestamptz; v_previous_at timestamptz;
  v_items jsonb := '[]'::jsonb; v_count integer := 0;
begin
  if auth.uid() is null or not exists (select 1 from public.aml_allowed_users u where u.user_id=auth.uid() and u.enabled) then raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501'; end if;
  select snapshot_id,published_at into v_latest,v_latest_at from public.obs_snapshot where status='READY' order by published_at desc nulls last limit 1;
  select snapshot_id,published_at into v_previous,v_previous_at from atlas_v2_private.watch_alert_history where snapshot_id<>coalesce(v_latest,'') group by snapshot_id,published_at order by published_at desc limit 1;

  if v_kind='overview' then
    return jsonb_build_object('schema','ATLAS_WATCH_QUERY_V2','kind',v_kind,'snapshot_id',v_latest,'generated_at',v_latest_at,
      'comparison',jsonb_build_object('available',v_previous is not null,'previous_snapshot_id',v_previous,'previous_at',v_previous_at),
      'summary',jsonb_build_object('alert_count',(select count(*) from public.obs_alert),'very_high_count',(select count(*) from public.obs_alert where upper(priority)='MUY ALTA'),'high_count',(select count(*) from public.obs_alert where upper(priority)='ALTA'),'family_count',(select count(distinct family) from public.obs_alert),'source_count',(select count(*) from public.obs_source_health),'source_attention_count',(select count(*) from public.obs_source_health where coalesce(lower(data_status),'') not in ('fresh','healthy','ok')),'history_snapshot_count',(select count(distinct snapshot_id) from atlas_v2_private.watch_alert_history)),
      'families',coalesce((select jsonb_agg(to_jsonb(x) order by x.n desc,x.family) from (select family,count(*)::int n,round(avg(strength),2) avg_strength,count(*) filter (where upper(priority) in ('MUY ALTA','ALTA'))::int high_priority from public.obs_alert group by family) x),'[]'::jsonb),
      'semantics',jsonb_build_object('signal_is_case',false,'signal_is_finding',false,'priority_is_probability',false,'absence_of_changes_means_low_risk',false,'follow_up_optional',true));

  elsif v_kind='signals' then
    with q as (
      select a.alert_id,a.family,a.pattern_type,a.scope_type,a.scope_id,a.scope_label,a.strength,a.priority,a.title,a.summary,a.payload,a.snapshot_id,a.refreshed_at
      from public.obs_alert a where (v_family is null or upper(a.family)=v_family) and (v_priority is null or upper(a.priority)=v_priority) and (v_scope_type is null or upper(a.scope_type)=v_scope_type) and (v_search is null or a.title ilike '%'||v_search||'%' or coalesce(a.summary,'') ilike '%'||v_search||'%' or coalesce(a.scope_label,'') ilike '%'||v_search||'%')
      order by case upper(a.priority) when 'MUY ALTA' then 4 when 'ALTA' then 3 when 'MEDIA' then 2 else 1 end desc,a.strength desc nulls last,a.family,a.title limit v_limit offset v_offset
    ) select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),count(*) into v_items,v_count from q;
    return jsonb_build_object('schema','ATLAS_WATCH_QUERY_V2','kind',v_kind,'snapshot_id',v_latest,'generated_at',v_latest_at,'items',v_items,'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit),'semantics',jsonb_build_object('signal_is_case',false,'signal_is_finding',false,'priority_is_probability',false,'follow_up_optional',true));

  elsif v_kind='changes' then
    if v_previous is null then return jsonb_build_object('schema','ATLAS_WATCH_QUERY_V2','kind',v_kind,'snapshot_id',v_latest,'generated_at',v_latest_at,'comparison',jsonb_build_object('available',false,'reason','BASELINE_ONLY'),'items','[]'::jsonb,'semantics',jsonb_build_object('no_comparison_is_not_no_change',true,'change_is_case',false,'priority_is_probability',false)); end if;
    with latest as (select * from atlas_v2_private.watch_alert_history where snapshot_id=v_latest),
    previous as (select * from atlas_v2_private.watch_alert_history where snapshot_id=v_previous),
    diff as (
      select coalesce(l.alert_id,p.alert_id) alert_id,
             case when p.alert_id is null then 'NEW' when l.alert_id is null then 'REMOVED'
                  when l.family is distinct from p.family or l.pattern_type is distinct from p.pattern_type or l.scope_type is distinct from p.scope_type or l.scope_id is distinct from p.scope_id or l.strength is distinct from p.strength or l.priority is distinct from p.priority or l.title is distinct from p.title or l.summary is distinct from p.summary or l.payload is distinct from p.payload then 'CHANGED' else 'UNCHANGED' end change_type,
             coalesce(l.family,p.family) family,coalesce(l.pattern_type,p.pattern_type) pattern_type,coalesce(l.scope_type,p.scope_type) scope_type,coalesce(l.scope_id,p.scope_id) scope_id,coalesce(l.scope_label,p.scope_label) scope_label,l.strength current_strength,p.strength previous_strength,l.priority current_priority,p.priority previous_priority,coalesce(l.title,p.title) title,coalesce(l.summary,p.summary) summary,coalesce(l.payload,p.payload) payload
      from latest l full outer join previous p using(alert_id)
    ), q as (
      select * from diff where change_type<>'UNCHANGED' and (v_family is null or upper(family)=v_family) and (v_priority is null or upper(coalesce(current_priority,previous_priority,''))=v_priority) and (v_search is null or title ilike '%'||v_search||'%' or coalesce(summary,'') ilike '%'||v_search||'%' or coalesce(scope_label,'') ilike '%'||v_search||'%')
      order by case change_type when 'NEW' then 3 when 'CHANGED' then 2 else 1 end desc,greatest(coalesce(current_strength,0),coalesce(previous_strength,0)) desc,title limit v_limit offset v_offset
    ) select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),count(*) into v_items,v_count from q;
    return jsonb_build_object('schema','ATLAS_WATCH_QUERY_V2','kind',v_kind,'snapshot_id',v_latest,'generated_at',v_latest_at,'comparison',jsonb_build_object('available',true,'previous_snapshot_id',v_previous,'previous_at',v_previous_at),'items',v_items,'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit),'semantics',jsonb_build_object('change_is_case',false,'change_is_finding',false,'priority_is_probability',false,'removed_means','NOT_PRESENT_IN_LATEST_SNAPSHOT'));

  elsif v_kind='sources' then
    with q as (
      select s.source_code,s.source_name,s.source_class,s.integration_mode,s.authoritative_source,s.software_status,s.data_status,s.last_source_record_at,s.last_successful_ingest_at,s.records_24h,s.error_rate_24h,s.notes,s.snapshot_id,s.refreshed_at
      from public.obs_source_health s where v_search is null or s.source_name ilike '%'||v_search||'%' or s.source_code ilike '%'||v_search||'%'
      order by case when coalesce(lower(s.data_status),'') in ('fresh','healthy','ok') then 1 else 0 end,s.source_name limit v_limit offset v_offset
    ) select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),count(*) into v_items,v_count from q;
    return jsonb_build_object('schema','ATLAS_WATCH_QUERY_V2','kind',v_kind,'snapshot_id',v_latest,'generated_at',v_latest_at,'items',v_items,'page',jsonb_build_object('offset',v_offset,'limit',v_limit,'returned',v_count,'has_more',v_count=v_limit),'semantics',jsonb_build_object('source_silence_means_no_findings',false,'source_health_is_entity_risk',false));

  elsif v_kind='timeline' then
    with q as (select s.snapshot_id,s.published_at,count(*)::int alert_count,count(*) filter (where upper(s.priority)='MUY ALTA')::int very_high_count,count(*) filter (where upper(s.priority)='ALTA')::int high_count,count(distinct s.family)::int family_count from atlas_v2_private.watch_alert_history s group by s.snapshot_id,s.published_at order by s.published_at desc limit v_limit offset v_offset)
    select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb),count(*) into v_items,v_count from q;
    return jsonb_build_object('schema','ATLAS_WATCH_QUERY_V2','kind',v_kind,'snapshot_id',v_latest,'generated_at',v_latest_at,'items',v_items,'semantics',jsonb_build_object('timeline_is_snapshot_history',true,'absence_of_change_means_low_risk',false));
  end if;
  raise exception 'ATLAS_WATCH_INVALID_KIND';
end;
$$;

create or replace function public.atlas_v2_watch_query(p_request jsonb)
returns jsonb language sql set search_path = pg_catalog, public
as $$ select atlas_v2_private.watch_query(p_request); $$;
revoke all on function public.atlas_v2_watch_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_watch_query(jsonb) to authenticated;

-- Seed the current published state as the immutable baseline. Future READY publications
-- are captured by atlas_v2_watch_capture_ready.
select atlas_v2_private.capture_watch_snapshot(s.snapshot_id)
from public.obs_snapshot s
where s.status='READY'
order by s.published_at desc nulls last
limit 1;
