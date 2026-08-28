-- ATLAS OSFL 0.95.0
-- Economic characterisation + public-transfer evidence contracts.
-- Applied live to Supabase project ldmtlwzqaqmegedktlxr on 2026-08-28.
--
-- Guardrails:
-- 1) Registro 19.862 membership is contextual registration, not proof of transfer receipt.
-- 2) A confirmed transfer requires row-level evidence in aml_osfl_public_transfer_evidence_v0950.
-- 3) SII sales are tax-derived bands, not exact accounting revenue.
-- 4) Sales + workers describe economic/operational scale, not accounting working capital or AML risk.

create table if not exists public.aml_osfl_public_transfer_evidence_v0950 (
  transfer_id text primary key,
  source_code text not null default 'REGISTRO_19862',
  source_record_id text,
  source_url text,
  source_snapshot_date date,
  observed_at timestamptz not null default now(),
  transfer_date date,
  budget_year integer,
  issuer_rut text,
  issuer_name text,
  receiver_rut text not null,
  receiver_name text,
  transfer_class text,
  transfer_type text,
  amount_clp numeric,
  objective text,
  legal_basis text,
  region text,
  commune text,
  entity_id text,
  match_method text,
  match_confidence numeric,
  raw_payload jsonb,
  inserted_at timestamptz not null default now(),
  constraint aml_osfl_public_transfer_amount_nonnegative_v0950 check (amount_clp is null or amount_clp >= 0),
  constraint aml_osfl_public_transfer_match_confidence_v0950 check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1))
);

comment on table public.aml_osfl_public_transfer_evidence_v0950 is
'ATLAS OSFL 0.95 row-level evidence for actual public transfers, intended primarily for Registro 19.862 ingestion. Membership in Registro 19.862 is not evidence of receipt; only rows in this table support transfer_received=true.';

create index if not exists aml_osfl_public_transfer_receiver_rut_0950_idx
  on public.aml_osfl_public_transfer_evidence_v0950 ((regexp_replace(upper(receiver_rut), '[^0-9K]', '', 'g')));
create index if not exists aml_osfl_public_transfer_entity_0950_idx
  on public.aml_osfl_public_transfer_evidence_v0950 (entity_id);
create index if not exists aml_osfl_public_transfer_date_0950_idx
  on public.aml_osfl_public_transfer_evidence_v0950 (transfer_date desc);
create index if not exists aml_osfl_public_transfer_issuer_0950_idx
  on public.aml_osfl_public_transfer_evidence_v0950 ((regexp_replace(upper(coalesce(issuer_rut,'')), '[^0-9K]', '', 'g')));

alter table public.aml_osfl_public_transfer_evidence_v0950 enable row level security;
revoke all on table public.aml_osfl_public_transfer_evidence_v0950 from anon;
grant select on table public.aml_osfl_public_transfer_evidence_v0950 to authenticated;
grant all on table public.aml_osfl_public_transfer_evidence_v0950 to service_role;

drop policy if exists aml_osfl_public_transfer_authorized_select_v0950 on public.aml_osfl_public_transfer_evidence_v0950;
create policy aml_osfl_public_transfer_authorized_select_v0950
on public.aml_osfl_public_transfer_evidence_v0950
for select
to authenticated
using (
  exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  )
);

create table if not exists public.aml_osfl_public_transfer_source_snapshot_v0950 (
  source_code text primary key,
  source_name text not null,
  source_url text,
  snapshot_date date,
  ingestion_status text not null,
  row_count bigint not null default 0,
  recipient_rut_count bigint not null default 0,
  amount_clp numeric,
  semantics text not null,
  refreshed_at timestamptz not null default now()
);

comment on table public.aml_osfl_public_transfer_source_snapshot_v0950 is
'Governed source-state contract for OSFL public-transfer ingestion. A registry membership flag is never promoted to transfer receipt.';

alter table public.aml_osfl_public_transfer_source_snapshot_v0950 enable row level security;
revoke all on table public.aml_osfl_public_transfer_source_snapshot_v0950 from anon;
grant select on table public.aml_osfl_public_transfer_source_snapshot_v0950 to authenticated;
grant all on table public.aml_osfl_public_transfer_source_snapshot_v0950 to service_role;

drop policy if exists aml_osfl_public_transfer_source_authorized_select_v0950 on public.aml_osfl_public_transfer_source_snapshot_v0950;
create policy aml_osfl_public_transfer_source_authorized_select_v0950
on public.aml_osfl_public_transfer_source_snapshot_v0950
for select
to authenticated
using (
  exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  )
);

insert into public.aml_osfl_public_transfer_source_snapshot_v0950
(source_code,source_name,source_url,ingestion_status,row_count,recipient_rut_count,amount_clp,semantics)
values (
  'REGISTRO_19862',
  'Registro Central de Colaboradores del Estado y Municipalidades · Ley 19.862',
  'https://registros19862.gob.cl/',
  'SCHEMA_READY_PENDING_ROW_LEVEL_INGEST',
  0,0,0,
  'Registro19862 membership is contextual registration only. transfer_received requires row-level transfer evidence.'
)
on conflict (source_code) do nothing;

create or replace view public.aml_v_osfl_economic_profile_current_v0950
with (security_invoker = true)
as
with transfer_agg as (
  select
    regexp_replace(upper(receiver_rut), '[^0-9K]', '', 'g') as rut_key,
    count(*)::bigint as confirmed_transfer_count,
    count(distinct regexp_replace(upper(coalesce(issuer_rut,'')), '[^0-9K]', '', 'g'))
      filter (where coalesce(issuer_rut,'') <> '')::bigint as public_funder_count,
    coalesce(sum(amount_clp),0)::numeric as confirmed_transfer_amount_clp,
    min(transfer_date) as first_transfer_date,
    max(transfer_date) as last_transfer_date
  from public.aml_osfl_public_transfer_evidence_v0950
  group by 1
), sales_pct as (
  select entity_id, percent_rank() over (order by sales_band_rank)::numeric as sales_band_percentile
  from public.aml_osfl_entity_runtime_snapshot
  where sales_band_rank is not null
), worker_pct as (
  select entity_id, percent_rank() over (order by workers_numeric)::numeric as workers_percentile
  from public.aml_osfl_entity_runtime_snapshot
  where workers_numeric is not null
)
select
  r.entity_id,r.rut,r.name,r.region,r.commune,r.activity_group,r.main_activity,r.activity_codes,r.activity_names,
  r.current_status,r.activity_start_date,r.termination_date,r.latest_year as sii_latest_year,
  r.sales_band_rank,r.sales_band,
  case r.sales_band_rank
    when 1 then 'SIN VENTAS'
    when 2 then 'MICRO 1 · 0,01 a 200 UF'
    when 3 then 'MICRO 2 · 200,01 a 600 UF'
    when 4 then 'MICRO 3 · 600,01 a 2.400 UF'
    when 5 then 'PEQUEÑA 1 · 2.400,01 a 5.000 UF'
    when 6 then 'PEQUEÑA 2 · 5.000,01 a 10.000 UF'
    when 7 then 'PEQUEÑA 3 · 10.000,01 a 25.000 UF'
    when 8 then 'MEDIANA 1 · 25.000,01 a 50.000 UF'
    when 9 then 'MEDIANA 2 · 50.000,01 a 100.000 UF'
    when 10 then 'GRANDE 1 · 100.000,01 a 200.000 UF'
    when 11 then 'GRANDE 2 · 200.000,01 a 600.000 UF'
    when 12 then 'GRANDE 3 · 600.000,01 a 1.000.000 UF'
    when 13 then 'GRANDE 4 · más de 1.000.000 UF'
    else 'SIN DATO SII'
  end as sales_band_label,
  case
    when r.sales_band_rank = 1 then 'SIN_VENTAS'
    when r.sales_band_rank between 2 and 4 then 'MICRO'
    when r.sales_band_rank between 5 and 7 then 'PEQUENA'
    when r.sales_band_rank between 8 and 9 then 'MEDIANA'
    when r.sales_band_rank between 10 and 13 then 'GRANDE'
    else 'SIN_DATO'
  end as sii_size_class,
  case r.sales_band_rank
    when 1 then 0::numeric when 2 then 0.01 when 3 then 200.01 when 4 then 600.01
    when 5 then 2400.01 when 6 then 5000.01 when 7 then 10000.01 when 8 then 25000.01
    when 9 then 50000.01 when 10 then 100000.01 when 11 then 200000.01 when 12 then 600000.01
    when 13 then 1000000.01 else null::numeric
  end as sales_band_lower_uf,
  case r.sales_band_rank
    when 1 then 0::numeric when 2 then 200 when 3 then 600 when 4 then 2400
    when 5 then 5000 when 6 then 10000 when 7 then 25000 when 8 then 50000
    when 9 then 100000 when 10 then 200000 when 11 then 600000 when 12 then 1000000
    else null::numeric
  end as sales_band_upper_uf,
  sp.sales_band_percentile,
  r.workers_numeric,wp.workers_percentile,
  case
    when r.workers_numeric is null then 'SIN_DATO'
    when r.workers_numeric = 0 then '0_TRABAJADORES'
    when r.workers_numeric between 1 and 9 then '1_9'
    when r.workers_numeric between 10 and 49 then '10_49'
    when r.workers_numeric between 50 and 199 then '50_199'
    else '200_MAS'
  end as workers_band,
  case
    when r.sales_band_rank is null and r.workers_numeric is null then 'SIN_DATO_SII'
    when r.sales_band_rank = 1 and coalesce(r.workers_numeric,0) = 0 then 'SIN_VENTAS_SIN_DOTACION'
    when coalesce(r.sales_band_rank,0) >= 10 or coalesce(r.workers_numeric,0) >= 200 then 'GRAN_ESCALA'
    when coalesce(r.sales_band_rank,0) >= 8 or coalesce(r.workers_numeric,0) >= 50 then 'ESCALA_MEDIA_ALTA'
    when coalesce(r.sales_band_rank,0) >= 5 or coalesce(r.workers_numeric,0) >= 10 then 'ESCALA_MEDIA'
    else 'MICRO_BAJA'
  end as operational_scale_band,
  case
    when r.sales_band_rank is not null and r.workers_numeric is not null then 'VENTAS_Y_TRABAJADORES'
    when r.sales_band_rank is not null then 'SOLO_VENTAS'
    when r.workers_numeric is not null then 'SOLO_TRABAJADORES'
    else 'SIN_CARACTERIZACION_ECONOMICA'
  end as economic_coverage_state,
  (coalesce(r.sales_band_rank,0) >= 8 and coalesce(r.workers_numeric,0) <= 2) as low_staff_high_sales_context,
  r.max_sales_band_increase,r.max_sales_band_decrease,r.main_activity_change_years,
  r.registro19862 as registro19862_observed,
  coalesce(t.confirmed_transfer_count,0) as confirmed_transfer_count,
  coalesce(t.public_funder_count,0) as public_funder_count,
  coalesce(t.confirmed_transfer_amount_clp,0) as confirmed_transfer_amount_clp,
  t.first_transfer_date,t.last_transfer_date,
  (coalesce(t.confirmed_transfer_count,0) > 0) as transfer_received_confirmed,
  r.refreshed_at
from public.aml_osfl_entity_runtime_snapshot r
left join sales_pct sp using (entity_id)
left join worker_pct wp using (entity_id)
left join transfer_agg t on t.rut_key = regexp_replace(upper(r.rut), '[^0-9K]', '', 'g');

comment on view public.aml_v_osfl_economic_profile_current_v0950 is
'OSFL 0.95 economic/operational profile. SII sales are ranges derived from tax declarations, not exact accounting revenue. operational_scale_band is descriptive capacity context, not AML risk and not accounting working capital.';
grant select on public.aml_v_osfl_economic_profile_current_v0950 to authenticated;
revoke all on public.aml_v_osfl_economic_profile_current_v0950 from anon;

create or replace view public.aml_v_osfl_activity_distribution_current_v0950
with (security_invoker = true)
as
with base as (select * from public.aml_v_osfl_economic_profile_current_v0950),
totals as (
  select count(*)::numeric observed_total,
         count(*) filter (where sales_band_rank is not null)::numeric economic_total
  from base
), grouped as (
  select 'OSFL_ACTIVITY_GROUP'::text activity_dimension,
         coalesce(activity_group,'Sin actividad detallada')::text activity_label,
         count(*)::bigint entity_count,
         count(*) filter (where sales_band_rank is not null)::bigint with_sii_economic_data,
         count(*) filter (where registro19862_observed)::bigint registro19862_count,
         count(*) filter (where transfer_received_confirmed)::bigint confirmed_transfer_recipient_count,
         coalesce(sum(confirmed_transfer_amount_clp),0)::numeric confirmed_transfer_amount_clp,
         coalesce(sum(workers_numeric),0)::numeric workers_total,
         round(avg(workers_numeric) filter (where workers_numeric is not null),2) workers_avg,
         round(avg(sales_band_rank) filter (where sales_band_rank is not null),2) sales_band_rank_avg
  from base group by 2
  union all
  select 'SII_MAIN_ACTIVITY'::text,
         coalesce(nullif(main_activity,''),'SIN ACTIVIDAD SII')::text,
         count(*)::bigint,
         count(*) filter (where sales_band_rank is not null)::bigint,
         count(*) filter (where registro19862_observed)::bigint,
         count(*) filter (where transfer_received_confirmed)::bigint,
         coalesce(sum(confirmed_transfer_amount_clp),0)::numeric,
         coalesce(sum(workers_numeric),0)::numeric,
         round(avg(workers_numeric) filter (where workers_numeric is not null),2),
         round(avg(sales_band_rank) filter (where sales_band_rank is not null),2)
  from base group by 2
)
select g.*,
       round(100*g.entity_count/nullif(t.observed_total,0),2) share_observed_pct,
       case when g.activity_dimension='SII_MAIN_ACTIVITY'
            then round(100*g.with_sii_economic_data/nullif(t.economic_total,0),2)
            else round(100*g.entity_count/nullif(t.observed_total,0),2)
       end share_dimension_pct
from grouped g cross join totals t;

grant select on public.aml_v_osfl_activity_distribution_current_v0950 to authenticated;
revoke all on public.aml_v_osfl_activity_distribution_current_v0950 from anon;

create or replace view public.aml_v_osfl_public_funds_current_v0950
with (security_invoker = true)
as
select e.entity_id,e.rut,e.name,e.region,e.commune,e.activity_group,e.main_activity,e.sii_size_class,
       e.sales_band_rank,e.sales_band_label,e.workers_numeric,e.operational_scale_band,
       e.registro19862_observed,e.transfer_received_confirmed,e.confirmed_transfer_count,
       e.public_funder_count,e.confirmed_transfer_amount_clp,e.first_transfer_date,e.last_transfer_date,
       case
         when e.transfer_received_confirmed then 'TRANSFERENCIA_CONFIRMADA'
         when e.registro19862_observed then 'REGISTRO_19862_SIN_TRANSFERENCIA_FILA_A_FILA'
         else 'SIN_EVIDENCIA_TRANSFERENCIA_FILA_A_FILA'
       end as public_funds_state,
       s.ingestion_status transfer_source_status,s.snapshot_date transfer_source_snapshot_date,
       s.refreshed_at transfer_source_refreshed_at,
       'Registro 19.862 observado no implica recepción. Solo aml_osfl_public_transfer_evidence_v0950 confirma transferencias.'::text semantics
from public.aml_v_osfl_economic_profile_current_v0950 e
left join public.aml_osfl_public_transfer_source_snapshot_v0950 s on s.source_code='REGISTRO_19862';

grant select on public.aml_v_osfl_public_funds_current_v0950 to authenticated;
revoke all on public.aml_v_osfl_public_funds_current_v0950 from anon;

create or replace view public.aml_v_osfl_public_funds_summary_current_v0950
with (security_invoker = true)
as
select count(*)::bigint atlas_observed_osfl,
       count(*) filter (where registro19862_observed)::bigint registro19862_observed,
       count(*) filter (where transfer_received_confirmed)::bigint confirmed_transfer_recipients,
       coalesce(sum(confirmed_transfer_count),0)::bigint confirmed_transfer_events,
       coalesce(sum(confirmed_transfer_amount_clp),0)::numeric confirmed_transfer_amount_clp,
       count(*) filter (where transfer_received_confirmed and workers_numeric <= 2)::bigint confirmed_transfer_low_staff_entities,
       count(*) filter (where transfer_received_confirmed and sales_band_rank >= 8)::bigint confirmed_transfer_medium_large_sales_entities,
       max(transfer_source_status) transfer_source_status,
       max(transfer_source_snapshot_date) transfer_source_snapshot_date,
       max(transfer_source_refreshed_at) transfer_source_refreshed_at
from public.aml_v_osfl_public_funds_current_v0950;

grant select on public.aml_v_osfl_public_funds_summary_current_v0950 to authenticated;
revoke all on public.aml_v_osfl_public_funds_summary_current_v0950 from anon;

create or replace view public.aml_v_osfl_economic_concentration_current_v0950
with (security_invoker = true)
as
with b as (select * from public.aml_v_osfl_economic_profile_current_v0950),
activity_counts as (select coalesce(activity_group,'Sin actividad detallada') activity_group,count(*)::numeric n from b group by 1),
sales_counts as (select sales_band_rank,count(*)::numeric n from b where sales_band_rank is not null group by 1),
workers_ranked as (select workers_numeric,cume_dist() over (order by workers_numeric) cd from b where workers_numeric is not null),
totals as (
  select count(*)::numeric observed_total,
         count(*) filter (where sales_band_rank is not null)::numeric economic_total,
         count(*) filter (where workers_numeric is not null)::numeric workers_data_total,
         coalesce(sum(workers_numeric),0)::numeric workers_total
  from b
), transfer_summary as (select * from public.aml_v_osfl_public_funds_summary_current_v0950)
select t.observed_total::bigint atlas_observed_osfl,t.economic_total::bigint sii_economic_observed,
       round(100*t.economic_total/nullif(t.observed_total,0),2) sii_economic_coverage_pct,
       count(*) filter (where b.sales_band_rank=1)::bigint no_sales_entities,
       count(*) filter (where b.sales_band_rank between 2 and 4)::bigint micro_entities,
       count(*) filter (where b.sales_band_rank between 5 and 7)::bigint small_entities,
       count(*) filter (where b.sales_band_rank between 8 and 9)::bigint medium_entities,
       count(*) filter (where b.sales_band_rank between 10 and 13)::bigint large_entities,
       round(100*count(*) filter (where b.sales_band_rank between 10 and 13)/nullif(t.economic_total,0),2) large_share_economic_pct,
       percentile_disc(0.50) within group (order by b.sales_band_rank) filter (where b.sales_band_rank is not null) sales_band_p50,
       percentile_disc(0.75) within group (order by b.sales_band_rank) filter (where b.sales_band_rank is not null) sales_band_p75,
       percentile_disc(0.90) within group (order by b.sales_band_rank) filter (where b.sales_band_rank is not null) sales_band_p90,
       percentile_disc(0.99) within group (order by b.sales_band_rank) filter (where b.sales_band_rank is not null) sales_band_p99,
       count(*) filter (where b.workers_numeric=0)::bigint zero_worker_entities,
       percentile_cont(0.50) within group (order by b.workers_numeric) filter (where b.workers_numeric is not null) workers_p50,
       percentile_cont(0.75) within group (order by b.workers_numeric) filter (where b.workers_numeric is not null) workers_p75,
       percentile_cont(0.90) within group (order by b.workers_numeric) filter (where b.workers_numeric is not null) workers_p90,
       percentile_cont(0.99) within group (order by b.workers_numeric) filter (where b.workers_numeric is not null) workers_p99,
       max(b.workers_numeric) workers_max,t.workers_total::bigint workers_total,
       round(100*(select coalesce(sum(workers_numeric),0) from workers_ranked where cd > 0.99)/nullif(t.workers_total,0),2) workers_top1pct_headcount_share_pct,
       count(*) filter (where b.low_staff_high_sales_context)::bigint low_staff_high_sales_context_count,
       round((select coalesce(sum(power(ac.n/nullif(t.observed_total,0),2)),0)*10000 from activity_counts ac),2) activity_group_hhi,
       round((select coalesce(sum(power(sc.n/nullif(t.economic_total,0),2)),0)*10000 from sales_counts sc),2) sales_band_distribution_hhi,
       count(*) filter (where b.registro19862_observed)::bigint registro19862_observed,
       ts.confirmed_transfer_recipients,ts.confirmed_transfer_events,ts.confirmed_transfer_amount_clp,ts.transfer_source_status,
       'Concentración de ventas se mide sobre distribución de tramos SII, no sobre ingresos exactos. Dotación usa trabajadores informados por SII. No corresponde a capital de trabajo contable ni a un score de riesgo.'::text methodology,
       max(b.refreshed_at) refreshed_at
from b cross join totals t cross join transfer_summary ts
group by t.observed_total,t.economic_total,t.workers_data_total,t.workers_total,
         ts.confirmed_transfer_recipients,ts.confirmed_transfer_events,ts.confirmed_transfer_amount_clp,ts.transfer_source_status;

grant select on public.aml_v_osfl_economic_concentration_current_v0950 to authenticated;
revoke all on public.aml_v_osfl_economic_concentration_current_v0950 from anon;

create or replace view public.aml_v_osfl_economic_distribution_current_v0950
with (security_invoker = true)
as
with b as (select * from public.aml_v_osfl_economic_profile_current_v0950),
totals as (
  select count(*)::numeric observed_total,
         count(*) filter (where sales_band_rank is not null)::numeric economic_total,
         count(*) filter (where workers_numeric is not null)::numeric workers_total
  from b
), sales as (
  select 'SALES_BAND'::text distribution_dimension,sales_band_rank::text bucket_key,
         max(sales_band_label)::text bucket_label,min(sales_band_rank)::integer bucket_order,
         count(*)::bigint entity_count,
         count(*) filter (where registro19862_observed)::bigint registro19862_count,
         count(*) filter (where transfer_received_confirmed)::bigint confirmed_transfer_recipient_count
  from b where sales_band_rank is not null group by sales_band_rank
), workers as (
  select 'WORKER_BAND'::text,workers_band::text,
         case workers_band
           when '0_TRABAJADORES' then '0 trabajadores'
           when '1_9' then '1 a 9 trabajadores'
           when '10_49' then '10 a 49 trabajadores'
           when '50_199' then '50 a 199 trabajadores'
           when '200_MAS' then '200 o más trabajadores'
           else 'Sin dato'
         end::text,
         case workers_band
           when '0_TRABAJADORES' then 1 when '1_9' then 2 when '10_49' then 3
           when '50_199' then 4 when '200_MAS' then 5 else 99
         end::integer,
         count(*)::bigint,
         count(*) filter (where registro19862_observed)::bigint,
         count(*) filter (where transfer_received_confirmed)::bigint
  from b where workers_numeric is not null group by workers_band
), u as (select * from sales union all select * from workers)
select u.*,
       case when u.distribution_dimension='SALES_BAND'
            then round(100*u.entity_count/nullif(t.economic_total,0),2)
            else round(100*u.entity_count/nullif(t.workers_total,0),2)
       end share_dimension_pct,
       round(100*u.entity_count/nullif(t.observed_total,0),2) share_observed_pct
from u cross join totals t;

grant select on public.aml_v_osfl_economic_distribution_current_v0950 to authenticated;
revoke all on public.aml_v_osfl_economic_distribution_current_v0950 from anon;
