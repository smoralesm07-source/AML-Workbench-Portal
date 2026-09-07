-- ATLAS v2 · portada analítica: ampliar conciliación UAF↔SII con lectura sectorial.
-- Backward compatible con ATLAS_UNIVERSES_QUERY_V2 / kind=attention.
create or replace function atlas_v2_private.uaf_sii_attention()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'atlas_v2_private'
as $function$
declare
  v_summary jsonb := '{}'::jsonb;
  v_reporting jsonb := '{}'::jsonb;
  v_years jsonb := '[]'::jsonb;
  v_recent_terminated jsonb := '[]'::jsonb;
  v_sectors jsonb := '[]'::jsonb;
  v_generated_at timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aml_allowed_users u where u.user_id=auth.uid() and u.enabled
  ) then
    raise exception 'ATLAS_CORE_FORBIDDEN' using errcode='42501';
  end if;

  select to_jsonb(s) into v_summary
  from public.aml_v0444_uaf_sii_summary s
  limit 1;

  select max(greatest(coalesce(r.entity_updated_at,'epoch'::timestamptz),coalesce(r.sii_updated_at,'epoch'::timestamptz)))
  into v_generated_at
  from public.aml_v0210_uaf_sii_reconciliation r;

  select jsonb_build_object(
    'entity_count',count(*),
    'observed_entity_count',count(*) filter(where behavior_source_state='OBSERVED'),
    'not_materialized_entity_count',count(*) filter(where behavior_source_state<>'OBSERVED' or behavior_source_state is null),
    'source_state',case when count(*) filter(where behavior_source_state='OBSERVED')>0 then 'PARTIALLY_MATERIALIZED' else 'NOT_MATERIALIZED' end,
    'source_cutoff_date',max(source_cutoff_date),
    'last_observed_at',max(last_observed_at),
    'ros_total',case when count(*) filter(where behavior_source_state='OBSERVED')>0 then sum(ros_total) filter(where behavior_source_state='OBSERVED') else null end,
    'ros_12m',case when count(*) filter(where behavior_source_state='OBSERVED')>0 then sum(ros_12m) filter(where behavior_source_state='OBSERVED') else null end,
    'roe_total',case when count(*) filter(where behavior_source_state='OBSERVED')>0 then sum(roe_total) filter(where behavior_source_state='OBSERVED') else null end,
    'roe_12m',case when count(*) filter(where behavior_source_state='OBSERVED')>0 then sum(roe_12m) filter(where behavior_source_state='OBSERVED') else null end
  ) into v_reporting
  from public.aml_v_uaf_entity_reporting_behavior_0620;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'sector_name',sector_name,
        'entity_count',entity_count,
        'active_count',active_count,
        'terminated_count',terminated_count,
        'no_sii_count',no_sii_count,
        'with_sii_count',with_sii_count,
        'sii_signal_entity_count',sii_signal_entity_count,
        'sanctioned_entity_count',sanctioned_entity_count,
        'multi_source_entity_count',multi_source_entity_count,
        'avg_sales_band_rank',avg_sales_band_rank,
        'avg_workers',avg_workers,
        'latest_sii_year',latest_sii_year,
        'terminated_pct',case when entity_count>0 then round(100.0*terminated_count/entity_count,2) else null end,
        'no_sii_pct',case when entity_count>0 then round(100.0*no_sii_count/entity_count,2) else null end
      )
      order by terminated_count desc, no_sii_count desc, entity_count desc, sector_name
    ),
    '[]'::jsonb
  ) into v_sectors
  from public.aml_v0434_uaf_sii_sector;

  select coalesce(
    jsonb_agg(jsonb_build_object('termination_year',termination_year,'entity_count',entity_count) order by termination_year desc nulls last),
    '[]'::jsonb
  ) into v_years
  from public.aml_v0210_uaf_sii_terminated_year;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.termination_date desc nulls last,x.resolved_name),'[]'::jsonb)
  into v_recent_terminated
  from (
    select entity_id,rut,resolved_name,uaf_sector_label,reconciliation_status,reconciliation_label,sii_current_status,
           termination_date,activity_start_date,main_activity,sii_region,sii_commune,operational_priority,suggested_action
    from public.aml_v0210_uaf_sii_reconciliation
    where reconciliation_status='SII_TERMINATED'
    order by termination_date desc nulls last,resolved_name
    limit 12
  ) x;

  return jsonb_build_object(
    'schema','ATLAS_UNIVERSES_QUERY_V2',
    'kind','attention',
    'generated_at',v_generated_at,
    'summary',coalesce(v_summary,'{}'::jsonb),
    'reporting',v_reporting,
    'sectors',v_sectors,
    'terminated_by_year',v_years,
    'recent_terminated',v_recent_terminated,
    'semantics',jsonb_build_object(
      'uaf_sii_join','EXACT_RUT_GOVERNED_RECONCILIATION',
      'termination_is_tax_status_not_aml_signal',true,
      'reporting_absence_is_not_zero',true,
      'ros_totals_published_only_when_observed',true,
      'sector_aggregation','UAF_SECTOR_LABEL_ON_GOVERNED_RECONCILIATION'
    )
  );
end;
$function$;
