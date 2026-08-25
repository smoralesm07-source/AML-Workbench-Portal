-- ATLAS AML 0.67.2 · Universo SO · presentación sobre corte vigente
-- Autoridad de datos:
--   SO inscritos        -> aml_uaf_obligated_subject_snapshot
--   Potenciales SO      -> aml_uaf_potential_registry_snapshot_v0650
--   Scope vigente       -> aml_uaf_potential_screening_scope_0650
-- Semántica del potencial:
-- candidate_use=SI + ACTIVE_AS_PUBLISHED + RUT exacto no observado en UAF.
-- La distribución sectorial NO es aditiva: un RUT puede mapear a más de un sector.

create or replace view public.aml_v_uaf_potential_sector_current_v0671
with (security_invoker=true)
as
select
  s.sector,
  count(distinct p.rut)::bigint as potential_ruts,
  count(distinct p.rut) filter (where p.res_available)::bigint as res_overlap_ruts,
  max(p.refreshed_at) as refreshed_at
from public.aml_uaf_potential_registry_snapshot_v0650 p
cross join lateral unnest(p.uaf_sectors) as s(sector)
where p.current_status='ACTIVE_AS_PUBLISHED'
group by s.sector;

create or replace view public.aml_v_uaf_universe_current_v0671
with (security_invoker=true)
as
select
  (select count(*)::bigint from public.aml_uaf_obligated_subject_snapshot) as obligated_ruts,
  (select count(*)::bigint from public.aml_uaf_potential_registry_snapshot_v0650 where current_status='ACTIVE_AS_PUBLISHED') as potential_ruts,
  (select count(*)::bigint from public.aml_uaf_potential_registry_snapshot_v0650 where current_status='ACTIVE_AS_PUBLISHED' and res_available) as potential_res_overlap_ruts,
  (select sii_cutoff from public.aml_uaf_potential_screening_scope_0650 where snapshot_key='CURRENT') as sii_cutoff,
  (select source_policy_sha from public.aml_uaf_potential_screening_scope_0650 where snapshot_key='CURRENT') as source_policy_sha,
  greatest(
    coalesce((select max(refreshed_at) from public.aml_uaf_obligated_subject_snapshot),'-infinity'::timestamptz),
    coalesce((select max(refreshed_at) from public.aml_uaf_potential_registry_snapshot_v0650),'-infinity'::timestamptz)
  ) as refreshed_at;

create or replace function public.refresh_aml_uaf_potential_overview_0580()
returns integer
language plpgsql
set search_path=public
as $$
declare doc jsonb;
begin
  select jsonb_build_object(
    'universe',(
      select jsonb_build_object(
        'candidates',count(distinct p.rut) filter(where p.current_status='ACTIVE_AS_PUBLISHED'),
        'actionable',count(distinct p.rut) filter(where p.current_status='ACTIVE_AS_PUBLISHED'),
        'sectors',(select count(*) from public.aml_v_uaf_potential_sector_current_v0671),
        'res_overlap',count(distinct p.rut) filter(where p.current_status='ACTIVE_AS_PUBLISHED' and p.res_available),
        'characteristic_activities',count(distinct ac) filter(where p.current_status='ACTIVE_AS_PUBLISHED'),
        'definition','ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',
        'refreshed_at',max(p.refreshed_at))
      from public.aml_uaf_potential_registry_snapshot_v0650 p
      left join lateral unnest(p.activity_codes) ac on true
    ),
    'sectors',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'sector',sector,'candidates',potential_ruts,'actionable',potential_ruts,'res_overlap',res_overlap_ruts
      ) order by potential_ruts desc,sector),'[]'::jsonb)
      from public.aml_v_uaf_potential_sector_current_v0671
    ),
    'methodology',jsonb_build_object(
      'candidate_use','SI','sii_status','ACTIVE_AS_PUBLISHED','uaf_exclusion','RUT_EXACT',
      'semantics','SCREENING_HYPOTHESIS_NOT_PROVEN_OBLIGATION','sector_counts_non_additive',true)
  ) into doc;
  update public.aml_uaf_obligated_overview_snapshot
     set payload=payload||jsonb_build_object('potential',doc),refreshed_at=now()
   where snapshot_key='CURRENT';
  return 1;
end;
$$;

-- El worker de la carga SII debe ejecutar, después del refresh principal:
--   perform public.refresh_aml_uaf_potential_overview_0580();
-- y sincronizar SII_ACTECO en aml_uaf_potential_source_registry_v0660 con
-- potential_count/current_cutoff del scope CURRENT.
