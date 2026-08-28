-- ATLAS OSFL Growth Monitor 0.93.4
-- Annual growth of the largest row-level OSFL universe currently observable in Atlas.
-- Method: reconstruct year-end observable stock from SII activity_start_date and termination_date.
-- The main annual series closes at the last complete calendar year; current-year starts are metadata only.

create or replace view public.aml_v_osfl_growth_yearly_current
with (security_invoker = true)
as
with params as (
  select
    extract(year from current_date)::int as current_year,
    extract(year from current_date)::int - 1 as last_complete_year,
    make_date(extract(year from current_date)::int - 1, 12, 31) as last_complete_date
), raw as (
  select
    entity_id,
    nullif(trim(region), '') as region,
    activity_start_date,
    termination_date
  from public.aml_osfl_entity_runtime_snapshot
), base as (
  select r.*
  from raw r
  cross join params p
  where r.activity_start_date between date '1900-01-01' and p.last_complete_date
), stats as (
  select
    (select count(*) from raw)::bigint as observed_universe,
    (select count(*) from raw where activity_start_date between date '1900-01-01' and current_date)::bigint as valid_start_count,
    (select count(*) from base)::bigint as series_eligible_count,
    (select count(*) from base where region is not null)::bigint as regional_series_eligible_count,
    (select count(*) from raw cross join params p where activity_start_date between make_date(p.current_year,1,1) and current_date)::bigint as current_year_starts,
    (select current_year from params)::int as current_year,
    (select last_complete_year from params)::int as last_complete_year
), bounds as (
  select
    coalesce(min(extract(year from activity_start_date)::int), (select last_complete_year from params)) as min_year,
    (select last_complete_year from params) as max_year
  from base
), geos as (
  select 'CHILE'::text as scope, null::text as region
  union all
  select 'REGION'::text, region
  from base
  where region is not null
  group by region
), years as (
  select generate_series((select min_year from bounds), (select max_year from bounds))::int as year
), event_rows as (
  select 'CHILE'::text as scope, null::text as region,
         extract(year from activity_start_date)::int as year,
         1::bigint as starts, 0::bigint as terminations, 1::bigint as net_change
  from base
  union all
  select 'REGION'::text, region,
         extract(year from activity_start_date)::int,
         1::bigint, 0::bigint, 1::bigint
  from base
  where region is not null
  union all
  select 'CHILE'::text, null::text,
         extract(year from termination_date)::int,
         0::bigint, 1::bigint, (-1)::bigint
  from base
  cross join params p
  where termination_date between date '1900-01-01' and p.last_complete_date
  union all
  select 'REGION'::text, region,
         extract(year from termination_date)::int,
         0::bigint, 1::bigint, (-1)::bigint
  from base
  cross join params p
  where region is not null
    and termination_date between date '1900-01-01' and p.last_complete_date
), events as (
  select
    scope,
    region,
    year,
    sum(starts)::bigint as starts,
    sum(terminations)::bigint as terminations,
    sum(net_change)::bigint as net_change
  from event_rows
  group by scope, region, year
), annual as (
  select
    g.scope,
    g.region,
    y.year,
    coalesce(e.starts, 0)::bigint as starts,
    coalesce(e.terminations, 0)::bigint as terminations,
    coalesce(e.net_change, 0)::bigint as net_change
  from geos g
  cross join years y
  left join events e
    on e.scope = g.scope
   and e.region is not distinct from g.region
   and e.year = y.year
), stocked as (
  select
    a.*,
    sum(net_change) over (
      partition by scope, region
      order by year
      rows between unbounded preceding and current row
    )::bigint as stock_year_end
  from annual a
), lagged as (
  select
    s.*,
    lag(stock_year_end) over (partition by scope, region order by year) as prev_stock
  from stocked s
)
select
  l.scope,
  l.region,
  l.year,
  l.stock_year_end,
  l.starts,
  l.terminations,
  l.net_change,
  case
    when l.prev_stock > 0 then round(100.0 * (l.stock_year_end - l.prev_stock) / l.prev_stock, 2)
  end as growth_pct,
  st.observed_universe,
  st.valid_start_count,
  st.series_eligible_count,
  st.regional_series_eligible_count,
  st.current_year_starts,
  st.current_year,
  st.last_complete_year
from lagged l
cross join stats st;

grant select on public.aml_v_osfl_growth_yearly_current to authenticated;

comment on view public.aml_v_osfl_growth_yearly_current is
'OSFL annual growth monitor over the largest row-level Atlas observable universe. Reconstructs year-end observable stock using SII activity_start_date and termination_date. It is an Atlas/SII observability proxy, not the legal Registry Civil historical stock. Region uses the current Atlas region assignment. Main annual series ends at the last complete year; current-year starts are exposed only as metadata.';
