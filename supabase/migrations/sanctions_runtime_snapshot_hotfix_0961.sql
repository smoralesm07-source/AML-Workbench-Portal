-- ATLAS AML · Sanciones runtime hotfix 0.96.1
-- Purpose: keep the analytical source definition for refresh work, while serving
-- the browser from a small indexed snapshot. This removes the 30–40 s joins
-- against the multi-million-row SII registry from the interactive request path.

-- 1) Materialize current sanction/enforcement events once.
create table public.aml_sanctions_radiography_runtime_snapshot_v0961 as
select * from public.aml_v_sanctions_radiography_current_v0960;

alter table public.aml_sanctions_radiography_runtime_snapshot_v0961
  add column snapshot_generated_at timestamptz not null default now();

create index aml_sanctions_runtime_0961_event_date_idx
  on public.aml_sanctions_radiography_runtime_snapshot_v0961 (event_date desc nulls last);
create index aml_sanctions_runtime_0961_regulator_idx
  on public.aml_sanctions_radiography_runtime_snapshot_v0961 (regulator);
create index aml_sanctions_runtime_0961_year_idx
  on public.aml_sanctions_radiography_runtime_snapshot_v0961 (event_year);
create index aml_sanctions_runtime_0961_region_idx
  on public.aml_sanctions_radiography_runtime_snapshot_v0961 (region);
create index aml_sanctions_runtime_0961_entity_idx
  on public.aml_sanctions_radiography_runtime_snapshot_v0961 (entity_id);
create index aml_sanctions_runtime_0961_rut_idx
  on public.aml_sanctions_radiography_runtime_snapshot_v0961 (rut);

alter table public.aml_sanctions_radiography_runtime_snapshot_v0961 enable row level security;
revoke all on public.aml_sanctions_radiography_runtime_snapshot_v0961 from anon;
revoke all on public.aml_sanctions_radiography_runtime_snapshot_v0961 from authenticated;
grant select on public.aml_sanctions_radiography_runtime_snapshot_v0961 to authenticated;
create policy aml_sanctions_runtime_authorized_select_v0961
on public.aml_sanctions_radiography_runtime_snapshot_v0961
for select to authenticated
using (
  exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  )
);

-- 2) Produce the one-row overview from the small event snapshot.
create table public.aml_sanctions_overview_runtime_snapshot_v0961 as
select
  u.unified_universe_count,
  u.sii_registry_count,
  u.uaf_registry_count,
  u.osfl_registry_count,
  u.potential_so_count,
  u.res_bridge_count,
  count(*)::bigint as event_count,
  count(*) filter (where e.sanction_record)::bigint as regulatory_sanction_event_count,
  count(*) filter (where e.regulator='CGR')::bigint as cgr_enforcement_event_count,
  count(distinct e.entity_key)::bigint as entity_key_count,
  count(distinct e.entity_key) filter (where e.in_unified_universe)::bigint as sanctioned_universe_entity_count,
  count(*) filter (where e.in_unified_universe)::bigint as events_in_unified_universe,
  count(*) filter (where not coalesce(e.in_unified_universe,false))::bigint as events_outside_or_unresolved_universe,
  count(*) filter (where e.is_uaf_registered)::bigint as so_event_count,
  count(distinct e.entity_key) filter (where e.is_uaf_registered)::bigint as so_sanctioned_entity_count,
  count(*) filter (where e.is_potential_screening)::bigint as potential_so_event_count,
  count(distinct e.entity_key) filter (where e.is_potential_screening)::bigint as potential_so_sanctioned_entity_count,
  count(distinct e.entity_key) filter (where e.is_osfl_observed)::bigint as osfl_sanctioned_entity_count,
  count(distinct e.entity_key) filter (where e.is_res_observed)::bigint as res_sanctioned_entity_count,
  count(*) filter (where e.document_url is not null and btrim(e.document_url)<>'')::bigint as events_with_document,
  count(*) filter (where e.amount_uf is not null)::bigint as events_with_amount_uf,
  count(*) filter (where e.amount_clp is not null)::bigint as events_with_amount_clp,
  coalesce(sum(e.amount_uf),0)::numeric as amount_uf_total,
  coalesce(sum(e.amount_clp),0)::numeric as amount_clp_total,
  min(e.event_date) as first_event_date,
  max(e.event_date) as last_event_date,
  max(e.snapshot_generated_at) as refreshed_at,
  'CMF/UAF/SCJ son registros sancionatorios; CGR se consolida como acciones de enforcement con semántica separada.'::text as semantics
from public.aml_sanctions_radiography_runtime_snapshot_v0961 e
cross join public.aml_v_sanctions_universe_summary_current_v0960 u
group by u.unified_universe_count,u.sii_registry_count,u.uaf_registry_count,u.osfl_registry_count,u.potential_so_count,u.res_bridge_count;

alter table public.aml_sanctions_overview_runtime_snapshot_v0961 enable row level security;
revoke all on public.aml_sanctions_overview_runtime_snapshot_v0961 from anon;
revoke all on public.aml_sanctions_overview_runtime_snapshot_v0961 from authenticated;
grant select on public.aml_sanctions_overview_runtime_snapshot_v0961 to authenticated;
create policy aml_sanctions_overview_runtime_authorized_select_v0961
on public.aml_sanctions_overview_runtime_snapshot_v0961
for select to authenticated
using (
  exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  )
);

-- 3) Preserve the expensive analytical definitions as internal refresh sources,
-- then redirect the existing public contracts to the snapshots. Keeping the
-- contract names avoids a frontend redeploy/cache dependency.
do $$
declare
  events_def text;
  overview_def text;
  event_cols text;
begin
  if to_regclass('public.aml_v_sanctions_radiography_source_v0960') is null then
    select pg_get_viewdef('public.aml_v_sanctions_radiography_current_v0960'::regclass, true) into events_def;
    execute 'create view public.aml_v_sanctions_radiography_source_v0960 with (security_invoker=true) as ' || events_def;
    execute 'revoke all on public.aml_v_sanctions_radiography_source_v0960 from anon';
    execute 'revoke all on public.aml_v_sanctions_radiography_source_v0960 from authenticated';
  end if;

  if to_regclass('public.aml_v_sanctions_overview_source_v0960') is null then
    select pg_get_viewdef('public.aml_v_sanctions_overview_current_v0960'::regclass, true) into overview_def;
    execute 'create view public.aml_v_sanctions_overview_source_v0960 with (security_invoker=true) as ' || overview_def;
    execute 'revoke all on public.aml_v_sanctions_overview_source_v0960 from anon';
    execute 'revoke all on public.aml_v_sanctions_overview_source_v0960 from authenticated';
  end if;

  select string_agg(format('%I', a.attname), ', ' order by a.attnum)
  into event_cols
  from pg_attribute a
  where a.attrelid='public.aml_v_sanctions_radiography_current_v0960'::regclass
    and a.attnum>0 and not a.attisdropped;

  execute format(
    'create or replace view public.aml_v_sanctions_radiography_current_v0960 with (security_invoker=true) as select %s from public.aml_sanctions_radiography_runtime_snapshot_v0961',
    event_cols
  );

  execute 'create or replace view public.aml_v_sanctions_overview_current_v0960 with (security_invoker=true) as select * from public.aml_sanctions_overview_runtime_snapshot_v0961';
end $$;

grant select on public.aml_v_sanctions_radiography_current_v0960 to authenticated;
grant select on public.aml_v_sanctions_overview_current_v0960 to authenticated;
revoke all on public.aml_v_sanctions_radiography_current_v0960 from anon;
revoke all on public.aml_v_sanctions_overview_current_v0960 from anon;
