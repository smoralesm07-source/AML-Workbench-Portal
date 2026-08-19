-- ATLAS AML 0.43.4 · Conciliación UAF ↔ SII analytical views
-- Applied to Supabase on 2026-08-19.
-- Aggregation only: no risk score and no legal SO inference.

create or replace view public.aml_v0434_uaf_sii_sector
with (security_invoker = true)
as
with exploded as (
  select r.entity_id,r.reconciliation_status,r.sii_latest_commercial_year,r.sales_band_rank,r.workers_numeric,r.sii_signal_count,r.sanction_count,r.max_finding_sources,r.economic_sector,r.main_activity,u.sector_name
  from public.aml_v0210_uaf_sii_reconciliation r
  cross join lateral unnest(case when coalesce(cardinality(r.uaf_sector_names),0)>0 then r.uaf_sector_names else array[coalesce(nullif(r.uaf_category_hint,''),'Sin sector UAF')]::text[] end) as u(sector_name)
)
select sector_name,
 count(distinct entity_id)::bigint entity_count,
 count(distinct entity_id) filter (where reconciliation_status='SII_ACTIVE')::bigint active_count,
 count(distinct entity_id) filter (where reconciliation_status='SII_TERMINATED')::bigint terminated_count,
 count(distinct entity_id) filter (where reconciliation_status='NO_SII_PROFILE')::bigint no_sii_count,
 count(distinct entity_id) filter (where reconciliation_status in ('SII_ACTIVE','SII_TERMINATED'))::bigint with_sii_count,
 count(distinct entity_id) filter (where coalesce(sii_signal_count,0)>0)::bigint sii_signal_entity_count,
 count(distinct entity_id) filter (where coalesce(sanction_count,0)>0)::bigint sanctioned_entity_count,
 count(distinct entity_id) filter (where coalesce(max_finding_sources,0)>=3)::bigint multi_source_entity_count,
 round(avg(sales_band_rank) filter (where sales_band_rank is not null)::numeric,1) avg_sales_band_rank,
 round(avg(workers_numeric) filter (where workers_numeric is not null)::numeric,1) avg_workers,
 max(sii_latest_commercial_year) latest_sii_year
from exploded group by sector_name;

create or replace view public.aml_v0434_uaf_sii_sector_matrix
with (security_invoker = true)
as
with exploded as (
  select r.entity_id,r.reconciliation_status,r.sales_band_rank,r.workers_numeric,coalesce(nullif(r.economic_sector,''),'Sin sector SII') sii_economic_sector,u.sector_name
  from public.aml_v0210_uaf_sii_reconciliation r
  cross join lateral unnest(case when coalesce(cardinality(r.uaf_sector_names),0)>0 then r.uaf_sector_names else array[coalesce(nullif(r.uaf_category_hint,''),'Sin sector UAF')]::text[] end) as u(sector_name)
)
select sector_name,sii_economic_sector,
 count(distinct entity_id)::bigint entity_count,
 count(distinct entity_id) filter (where reconciliation_status='SII_ACTIVE')::bigint active_count,
 count(distinct entity_id) filter (where reconciliation_status='SII_TERMINATED')::bigint terminated_count,
 count(distinct entity_id) filter (where reconciliation_status='NO_SII_PROFILE')::bigint no_sii_count,
 round(avg(sales_band_rank) filter (where sales_band_rank is not null)::numeric,1) avg_sales_band_rank,
 round(avg(workers_numeric) filter (where workers_numeric is not null)::numeric,1) avg_workers
from exploded group by sector_name,sii_economic_sector;

grant select on public.aml_v0434_uaf_sii_sector to authenticated;
grant select on public.aml_v0434_uaf_sii_sector_matrix to authenticated;
