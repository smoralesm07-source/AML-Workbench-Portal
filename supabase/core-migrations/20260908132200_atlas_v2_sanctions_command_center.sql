-- ATLAS v2 · Sanciones command center
-- Applied to Core on 2026-09-08. Keeps the existing allow-list boundary and
-- extends ATLAS_SANCTIONS_QUERY_V2 with dashboard/detail plus filtered priority reads.

create or replace function public.atlas_v2_sanctions_query(p_request jsonb)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_kind text := lower(trim(coalesce(p_request->>'kind','overview')));
  v_limit integer := greatest(1, least(coalesce(nullif(p_request->>'limit','')::integer, 40), 100));
  v_offset integer := greatest(0, coalesce(nullif(p_request->>'offset','')::integer, 0));
  v_search text := lower(trim(coalesce(p_request->>'search',p_request->>'q','')));
  v_regulator text := upper(trim(coalesce(p_request->>'regulator','')));
  v_region text := trim(coalesce(p_request->>'region',''));
  v_event_class text := upper(trim(coalesce(p_request->>'event_class','')));
  v_event_kind text := trim(coalesce(p_request->>'event_kind',''));
  v_subject_condition text := upper(trim(coalesce(p_request->>'subject_condition','')));
  v_universe text := upper(trim(coalesce(p_request->>'universe','')));
  v_amount_band text := upper(trim(coalesce(p_request->>'amount_band','')));
  v_event_id text := trim(coalesce(p_request->>'event_id',''));
  v_year integer := nullif(p_request->>'year','')::integer;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = auth.uid() and au.enabled
  ) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if v_kind = 'overview' then
    select jsonb_build_object(
      'schema','ATLAS_SANCTIONS_QUERY_V2','kind','overview','generated_at',now(),
      'snapshot_id',coalesce((select max(refreshed_at)::text from public.aml_v_sanctions_radiography_current_v0960),now()::text),
      'overview',coalesce((select to_jsonb(o) from public.aml_v_sanctions_overview_current_v0960 o limit 1),'{}'::jsonb),
      'universe',coalesce((select to_jsonb(u) from public.aml_v_sanctions_universe_summary_current_v0960 u limit 1),'{}'::jsonb),
      'year_source',coalesce((select jsonb_agg(to_jsonb(y) order by y.event_year,y.regulator,y.event_class) from public.aml_v_sanctions_year_source_current_v0960 y),'[]'::jsonb),
      'regions',coalesce((select jsonb_agg(to_jsonb(r) order by r.event_count desc,r.region,r.regulator) from public.aml_v_sanctions_region_current_v0960 r),'[]'::jsonb),
      'sectors',coalesce((select jsonb_agg(to_jsonb(s) order by s.event_count desc,s.subject_condition,s.sector,s.regulator) from public.aml_v_sanctions_sector_current_v0960 s),'[]'::jsonb),
      'semantics',jsonb_build_object(
        'universe','SII + padrón UAF + padrón OSFL, deduplicados por RUT. La membresía puede superponerse.',
        'regulatory','CMF/UAF/SCJ se conservan como eventos regulatorios según su fuente.',
        'cgr','Las acciones CGR se muestran separadas como enforcement. No se promueven automáticamente a sanción regulatoria firme.',
        'aml','Sanción administrativa no equivale por sí sola a evidencia LA/FT.',
        'currency','Montos UF y CLP no se suman entre sí.'
      )
    ) into v_result;
    return v_result;

  elsif v_kind = 'dashboard' then
    with filtered as materialized (
      select r.*
      from public.aml_v_sanctions_radiography_current_v0960 r
      where (v_search='' or lower(coalesce(r.canonical_name,'')) like '%'||v_search||'%' or lower(coalesce(r.source_entity_name,'')) like '%'||v_search||'%' or lower(coalesce(r.rut,'')) like '%'||v_search||'%' or lower(coalesce(r.reason,'')) like '%'||v_search||'%' or lower(coalesce(r.resolution_ref,'')) like '%'||v_search||'%')
        and (v_regulator='' or upper(coalesce(r.regulator,''))=v_regulator)
        and (v_region='' or coalesce(r.region,'')=v_region)
        and (v_event_class='' or upper(coalesce(r.event_class,''))=v_event_class)
        and (v_event_kind='' or coalesce(r.event_kind,'')=v_event_kind)
        and (v_year is null or r.event_year=v_year)
        and (v_universe='' or (case v_universe when 'UAF' then coalesce(r.in_uaf_registry,false) when 'SII' then coalesce(r.in_sii_registry,false) when 'OSFL' then coalesce(r.in_osfl_registry,false) else true end))
        and (v_amount_band='' or (case v_amount_band when 'CLP' then coalesce(r.amount_clp,0)>0 when 'UF' then coalesce(r.amount_uf,0)>0 when 'NO_AMOUNT' then coalesce(r.amount_clp,0)=0 and coalesce(r.amount_uf,0)=0 else true end))
        and (v_subject_condition='' or (case v_subject_condition when 'SO' then coalesce(r.is_uaf_registered,false) when 'POTENTIAL_SO' then coalesce(r.is_potential_screening,false) when 'OSFL' then coalesce(r.is_osfl_observed,false) when 'RES' then coalesce(r.is_res_observed,false) else true end))
    ), universe_meta as (
      select * from public.aml_v_sanctions_universe_summary_current_v0960 limit 1
    ), metrics as (
      select count(*)::bigint event_count,
             count(distinct entity_key) filter (where entity_key is not null)::bigint entity_count,
             count(*) filter (where event_class='REGULATORY_SANCTION_OBSERVED')::bigint regulatory_event_count,
             count(*) filter (where event_class='CGR_ENFORCEMENT_ACTION')::bigint cgr_event_count,
             count(*) filter (where document_url is not null and document_url<>'')::bigint document_count,
             count(distinct regulator)::bigint supervisor_count,
             coalesce(sum(amount_clp),0)::numeric amount_clp,
             coalesce(sum(amount_uf),0)::double precision amount_uf,
             min(event_date) min_date,
             max(event_date) max_date
      from filtered
    ), universe_cards as (
      select 'UAF' code, (select uaf_registry_count from universe_meta)::bigint evaluated_count,
             count(*) filter (where in_uaf_registry)::bigint event_count,
             count(distinct entity_key) filter (where in_uaf_registry and entity_key is not null)::bigint entity_count from filtered
      union all
      select 'SII', (select sii_registry_count from universe_meta)::bigint,
             count(*) filter (where in_sii_registry)::bigint,
             count(distinct entity_key) filter (where in_sii_registry and entity_key is not null)::bigint from filtered
      union all
      select 'OSFL', (select osfl_registry_count from universe_meta)::bigint,
             count(*) filter (where in_osfl_registry)::bigint,
             count(distinct entity_key) filter (where in_osfl_registry and entity_key is not null)::bigint from filtered
    ), supervisors as (
      select regulator, count(*)::bigint event_count,
             count(distinct entity_key) filter (where entity_key is not null)::bigint entity_count,
             count(*) filter (where event_class='REGULATORY_SANCTION_OBSERVED')::bigint regulatory_event_count,
             count(*) filter (where event_class='CGR_ENFORCEMENT_ACTION')::bigint cgr_event_count,
             coalesce(sum(amount_clp),0)::numeric amount_clp, coalesce(sum(amount_uf),0)::double precision amount_uf
      from filtered group by regulator
    ), regions as (
      select coalesce(nullif(region,''),'Sin región informada') region, count(*)::bigint event_count,
             count(distinct entity_key) filter (where entity_key is not null)::bigint entity_count,
             coalesce(sum(amount_clp),0)::numeric amount_clp, coalesce(sum(amount_uf),0)::double precision amount_uf
      from filtered group by 1
    ), types as (
      select coalesce(nullif(event_kind,''),'Sin clasificación') event_kind, count(*)::bigint event_count,
             count(distinct entity_key) filter (where entity_key is not null)::bigint entity_count from filtered group by 1
    ), years as (
      select event_year, count(*)::bigint event_count,
             count(distinct entity_key) filter (where entity_key is not null)::bigint entity_count,
             count(*) filter (where event_class='REGULATORY_SANCTION_OBSERVED')::bigint regulatory_event_count,
             count(*) filter (where event_class='CGR_ENFORCEMENT_ACTION')::bigint cgr_event_count
      from filtered where event_year is not null group by event_year
    )
    select jsonb_build_object(
      'schema','ATLAS_SANCTIONS_QUERY_V2','kind','dashboard','generated_at',now(),
      'snapshot_id',coalesce((select max(refreshed_at)::text from public.aml_v_sanctions_radiography_current_v0960),now()::text),
      'metrics',(select to_jsonb(m) || jsonb_build_object('unified_universe_count',(select unified_universe_count from universe_meta)) from metrics m),
      'universes',coalesce((select jsonb_agg(to_jsonb(u) order by case code when 'UAF' then 1 when 'SII' then 2 else 3 end) from universe_cards u),'[]'::jsonb),
      'supervisors',coalesce((select jsonb_agg(to_jsonb(s) order by s.event_count desc,s.regulator) from supervisors s),'[]'::jsonb),
      'regions',coalesce((select jsonb_agg(to_jsonb(r) order by r.event_count desc,r.region) from regions r),'[]'::jsonb),
      'types',coalesce((select jsonb_agg(to_jsonb(t) order by t.event_count desc,t.event_kind) from types t),'[]'::jsonb),
      'years',coalesce((select jsonb_agg(to_jsonb(y) order by y.event_year) from years y),'[]'::jsonb),
      'filters',jsonb_build_object(
        'regulators',coalesce((select jsonb_agg(x order by x) from (select distinct regulator x from public.aml_v_sanctions_radiography_current_v0960 where regulator is not null and regulator<>'') q),'[]'::jsonb),
        'regions',coalesce((select jsonb_agg(x order by x) from (select distinct region x from public.aml_v_sanctions_radiography_current_v0960 where region is not null and region<>'') q),'[]'::jsonb),
        'types',coalesce((select jsonb_agg(x order by x) from (select distinct event_kind x from public.aml_v_sanctions_radiography_current_v0960 where event_kind is not null and event_kind<>'') q),'[]'::jsonb),
        'years',coalesce((select jsonb_agg(x order by x desc) from (select distinct event_year x from public.aml_v_sanctions_radiography_current_v0960 where event_year is not null) q),'[]'::jsonb)
      ),
      'semantics',jsonb_build_object(
        'universe','UAF, SII y OSFL son membresías superpuestas dentro del universo consolidado; sus conteos no deben sumarse.',
        'regulatory','CMF/UAF/SCJ son sanciones regulatorias observadas.',
        'cgr','CGR se presenta como acciones de enforcement separadas.',
        'priority','La priorización de casos es una ayuda de revisión explicable; no es probabilidad LA/FT ni juicio de culpabilidad.',
        'currency','UF y CLP permanecen separados.'
      )
    ) into v_result;
    return v_result;

  elsif v_kind = 'events' then
    with filtered_base as materialized (
      select r.*, count(*) over (partition by r.entity_key) as recurrence_count
      from public.aml_v_sanctions_radiography_current_v0960 r
      where (v_search='' or lower(coalesce(r.canonical_name,'')) like '%'||v_search||'%' or lower(coalesce(r.source_entity_name,'')) like '%'||v_search||'%' or lower(coalesce(r.rut,'')) like '%'||v_search||'%' or lower(coalesce(r.reason,'')) like '%'||v_search||'%' or lower(coalesce(r.resolution_ref,'')) like '%'||v_search||'%')
        and (v_regulator='' or upper(coalesce(r.regulator,''))=v_regulator)
        and (v_region='' or coalesce(r.region,'')=v_region)
        and (v_event_class='' or upper(coalesce(r.event_class,''))=v_event_class)
        and (v_event_kind='' or coalesce(r.event_kind,'')=v_event_kind)
        and (v_year is null or r.event_year=v_year)
        and (v_universe='' or (case v_universe when 'UAF' then coalesce(r.in_uaf_registry,false) when 'SII' then coalesce(r.in_sii_registry,false) when 'OSFL' then coalesce(r.in_osfl_registry,false) else true end))
        and (v_amount_band='' or (case v_amount_band when 'CLP' then coalesce(r.amount_clp,0)>0 when 'UF' then coalesce(r.amount_uf,0)>0 when 'NO_AMOUNT' then coalesce(r.amount_clp,0)=0 and coalesce(r.amount_uf,0)=0 else true end))
        and (coalesce(p_request->>'unified_only','')='' or coalesce(r.in_unified_universe,false)=(p_request->>'unified_only')::boolean)
        and (v_subject_condition='' or (case v_subject_condition when 'SO' then coalesce(r.is_uaf_registered,false) when 'POTENTIAL_SO' then coalesce(r.is_potential_screening,false) when 'OSFL' then coalesce(r.is_osfl_observed,false) when 'RES' then coalesce(r.is_res_observed,false) else true end))
    ), scored as (
      select f.*,
        least(100,
          (case when f.is_uaf_registered then 20 else 0 end) +
          (case when f.is_osfl_observed then 10 else 0 end) +
          (case when coalesce(f.amount_clp,0)>0 or coalesce(f.amount_uf,0)>0 then 15 else 0 end) +
          (case when f.document_url is not null and f.document_url<>'' then 10 else 0 end) +
          (case when f.recurrence_count>=3 then 20 when f.recurrence_count=2 then 12 else 0 end) +
          (case when lower(coalesce(f.event_kind,'')||' '||coalesce(f.reason,'')) ~ '(ala/cft|la/ft|lavado|debida diligencia)' then 20 else 0 end) +
          (case when coalesce(f.identity_confidence,0)>=0.9 then 5 else 0 end)
        )::integer as priority_score
      from filtered_base f
    ), page_rows as (
      select * from scored order by priority_score desc, event_date desc nulls last, regulator, event_id limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'schema','ATLAS_SANCTIONS_QUERY_V2','kind','events','generated_at',now(),
      'snapshot_id',coalesce((select max(refreshed_at)::text from public.aml_v_sanctions_radiography_current_v0960),now()::text),
      'page',jsonb_build_object('limit',v_limit,'offset',v_offset,'total',(select count(*) from scored)),
      'items',coalesce((select jsonb_agg(to_jsonb(p) order by p.priority_score desc,p.event_date desc nulls last,p.regulator,p.event_id) from page_rows p),'[]'::jsonb),
      'semantics',jsonb_build_object('priority','Prioridad analítica explicable para ordenar revisión; no es probabilidad LA/FT.','cgr','CGR enforcement se conserva separado de sanciones regulatorias.','identity','Identidades candidatas o no resueltas mantienen su estado y confianza.','document','El enlace documental se expone solo cuando existe evidencia pública registrada.')
    ) into v_result;
    return v_result;

  elsif v_kind = 'detail' then
    if v_event_id='' then
      return jsonb_build_object('schema','ATLAS_SANCTIONS_QUERY_V2','kind','detail','error','EVENT_ID_REQUIRED','generated_at',now());
    end if;
    with chosen as (
      select r.* from public.aml_v_sanctions_radiography_current_v0960 r where r.event_id=v_event_id limit 1
    ), related as (
      select r.* from public.aml_v_sanctions_radiography_current_v0960 r
      where r.entity_key is not null and r.entity_key=(select entity_key from chosen)
      order by r.event_date desc nulls last limit 20
    )
    select jsonb_build_object(
      'schema','ATLAS_SANCTIONS_QUERY_V2','kind','detail','generated_at',now(),
      'snapshot_id',coalesce((select max(refreshed_at)::text from public.aml_v_sanctions_radiography_current_v0960),now()::text),
      'event',coalesce((select to_jsonb(c) from chosen c),'{}'::jsonb),
      'related_events',coalesce((select jsonb_agg(to_jsonb(r) order by r.event_date desc nulls last) from related r),'[]'::jsonb),
      'semantics',jsonb_build_object('cgr','CGR enforcement se conserva separado de sanciones regulatorias.','document','El documento corresponde a evidencia pública registrada por la fuente.','aml','Una sanción administrativa no equivale por sí sola a evidencia LA/FT.')
    ) into v_result;
    return v_result;
  else
    return jsonb_build_object('schema','ATLAS_SANCTIONS_QUERY_V2','kind',v_kind,'error','UNSUPPORTED_KIND','generated_at',now());
  end if;
end;
$function$;

revoke all on function public.atlas_v2_sanctions_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_sanctions_query(jsonb) to authenticated, service_role;
