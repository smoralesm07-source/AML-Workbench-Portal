-- ATLAS AML 0.96.2 · pre-QA security hardening
-- Applied to production on 2026-09-04 before being recorded here.
-- Purpose: remove SECURITY DEFINER API views, move aggregate materialized views
-- out of the exposed public schema, restrict privileged refresh functions,
-- optimize RLS auth evaluation, and remove verified duplicate indexes.

create schema if not exists atlas_private;
revoke all on schema atlas_private from public;

alter materialized view public.aml_mv_gp10_pair set schema atlas_private;
alter materialized view public.aml_mv_gp10_res set schema atlas_private;
alter materialized view public.aml_mv_gp10_buyer_total set schema atlas_private;
alter materialized view public.aml_mv_gp10_supplier_total set schema atlas_private;
alter materialized view public.aml_mv_gp10_supplier_risk set schema atlas_private;
alter materialized view public.aml_mv_gp10_buyer_risk set schema atlas_private;
alter materialized view public.aml_mv_gp10_finding set schema atlas_private;
alter materialized view public.aml_mv_gp12_order set schema atlas_private;
alter materialized view public.aml_mv_gp12_supplier set schema atlas_private;
alter materialized view public.aml_mv_gp12_buyer set schema atlas_private;
alter materialized view public.aml_mv_gp12_industry set schema atlas_private;
alter materialized view public.aml_mv_gp12_industry_region set schema atlas_private;
alter materialized view public.aml_mv_gp12_industry_stat set schema atlas_private;
alter materialized view public.aml_mv_gp12_market_finding set schema atlas_private;

grant usage on schema atlas_private to authenticated, service_role;
grant select on all tables in schema atlas_private to authenticated, service_role;

create view public.aml_mv_gp10_pair with (security_invoker=true) as select * from atlas_private.aml_mv_gp10_pair;
create view public.aml_mv_gp10_res with (security_invoker=true) as select * from atlas_private.aml_mv_gp10_res;
create view public.aml_mv_gp10_buyer_total with (security_invoker=true) as select * from atlas_private.aml_mv_gp10_buyer_total;
create view public.aml_mv_gp10_supplier_total with (security_invoker=true) as select * from atlas_private.aml_mv_gp10_supplier_total;
create view public.aml_mv_gp10_supplier_risk with (security_invoker=true) as select * from atlas_private.aml_mv_gp10_supplier_risk;
create view public.aml_mv_gp10_buyer_risk with (security_invoker=true) as select * from atlas_private.aml_mv_gp10_buyer_risk;
create view public.aml_mv_gp10_finding with (security_invoker=true) as select * from atlas_private.aml_mv_gp10_finding;
create view public.aml_mv_gp12_order with (security_invoker=true) as select * from atlas_private.aml_mv_gp12_order;
create view public.aml_mv_gp12_supplier with (security_invoker=true) as select * from atlas_private.aml_mv_gp12_supplier;
create view public.aml_mv_gp12_buyer with (security_invoker=true) as select * from atlas_private.aml_mv_gp12_buyer;
create view public.aml_mv_gp12_industry with (security_invoker=true) as select * from atlas_private.aml_mv_gp12_industry;
create view public.aml_mv_gp12_industry_region with (security_invoker=true) as select * from atlas_private.aml_mv_gp12_industry_region;
create view public.aml_mv_gp12_industry_stat with (security_invoker=true) as select * from atlas_private.aml_mv_gp12_industry_stat;
create view public.aml_mv_gp12_market_finding with (security_invoker=true) as select * from atlas_private.aml_mv_gp12_market_finding;

grant select on public.aml_mv_gp10_pair, public.aml_mv_gp10_res,
  public.aml_mv_gp10_buyer_total, public.aml_mv_gp10_supplier_total,
  public.aml_mv_gp10_supplier_risk, public.aml_mv_gp10_buyer_risk,
  public.aml_mv_gp10_finding, public.aml_mv_gp12_order,
  public.aml_mv_gp12_supplier, public.aml_mv_gp12_buyer,
  public.aml_mv_gp12_industry, public.aml_mv_gp12_industry_region,
  public.aml_mv_gp12_industry_stat, public.aml_mv_gp12_market_finding
  to authenticated, service_role;
revoke all on public.aml_mv_gp10_pair, public.aml_mv_gp10_res,
  public.aml_mv_gp10_buyer_total, public.aml_mv_gp10_supplier_total,
  public.aml_mv_gp10_supplier_risk, public.aml_mv_gp10_buyer_risk,
  public.aml_mv_gp10_finding, public.aml_mv_gp12_order,
  public.aml_mv_gp12_supplier, public.aml_mv_gp12_buyer,
  public.aml_mv_gp12_industry, public.aml_mv_gp12_industry_region,
  public.aml_mv_gp12_industry_stat, public.aml_mv_gp12_market_finding
  from anon;

alter view public.aml_v_gp12_segment set (security_invoker=true);
alter view public.aml_v_gp12_finding set (security_invoker=true);
alter view public.aml_v_gp12_supplier_lite set (security_invoker=true);
alter view public.aml_v_gp10_order set (security_invoker=true);
alter view public.aml_v_gp10_buyer_total set (security_invoker=true);
alter view public.aml_v_gp10_supplier_total set (security_invoker=true);
alter view public.aml_v_gp10_context set (security_invoker=true);
alter view public.aml_v_gp10_percentile set (security_invoker=true);
alter view public.aml_v_gp10_lorenz set (security_invoker=true);
alter view public.aml_v_gp10_region set (security_invoker=true);
alter view public.aml_v_gp10_scatter set (security_invoker=true);
alter view public.aml_v_gp10_coverage set (security_invoker=true);

create or replace function public.aml_gp10_refresh()
returns void
language plpgsql
security definer
set search_path to pg_catalog, public, atlas_private
as $$
begin
  refresh materialized view atlas_private.aml_mv_gp10_pair;
  refresh materialized view atlas_private.aml_mv_gp10_res;
  refresh materialized view atlas_private.aml_mv_gp10_buyer_total;
  refresh materialized view atlas_private.aml_mv_gp10_supplier_total;
  refresh materialized view atlas_private.aml_mv_gp10_supplier_risk;
  refresh materialized view atlas_private.aml_mv_gp10_buyer_risk;
  refresh materialized view atlas_private.aml_mv_gp10_finding;
end
$$;

create or replace function public.aml_gp12_refresh()
returns void
language plpgsql
security definer
set search_path to pg_catalog, public, atlas_private
as $$
begin
  perform public.aml_gp10_refresh();
  refresh materialized view atlas_private.aml_mv_gp12_order;
  refresh materialized view atlas_private.aml_mv_gp12_supplier;
  refresh materialized view atlas_private.aml_mv_gp12_buyer;
  refresh materialized view atlas_private.aml_mv_gp12_industry;
  refresh materialized view atlas_private.aml_mv_gp12_industry_region;
  refresh materialized view atlas_private.aml_mv_gp12_industry_stat;
  refresh materialized view atlas_private.aml_mv_gp12_market_finding;
end
$$;

revoke execute on function public.aml_gp10_refresh() from public, anon, authenticated;
revoke execute on function public.aml_gp12_refresh() from public, anon, authenticated;
grant execute on function public.aml_gp10_refresh() to service_role;
grant execute on function public.aml_gp12_refresh() to service_role;

alter policy candidate_contact_insert_allowed on public.aml_uaf_candidate_contact_osint
  with check (captured_by = (select auth.uid()) and exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ));
alter policy candidate_contact_select_allowed on public.aml_uaf_candidate_contact_osint
  using (exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ));
alter policy candidate_contact_update_allowed on public.aml_uaf_candidate_contact_osint
  using (exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ))
  with check (exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ));

alter policy candidate_enrichment_job_insert_self on public.aml_uaf_candidate_enrichment_job
  with check (requested_by = (select auth.uid()) and exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ));
alter policy candidate_enrichment_job_read_allowed on public.aml_uaf_candidate_enrichment_job
  using (exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ));
alter policy candidate_enrichment_job_update_self on public.aml_uaf_candidate_enrichment_job
  using (requested_by = (select auth.uid()) and exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ))
  with check (requested_by = (select auth.uid()) and exists (
    select 1 from public.aml_allowed_users au
    where au.user_id = (select auth.uid()) and au.enabled
  ));

drop index if exists public.aml_res_relationship_related_idx;
drop index if exists public.uq_candidate_contact_identity;
drop index if exists public.idx_candidate_enrichment_job_rut;
drop index if exists public.aml_uaf_potential_review_rut_idx;
