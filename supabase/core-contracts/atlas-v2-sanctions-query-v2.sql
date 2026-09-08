-- Canonical governed browser contract for ATLAS v2 Sanciones.
-- The live implementation is versioned by the matching core migration.
-- Contract invariants:
--   * authenticated allow-listed users only
--   * browser reaches Core through atlas-v2-read federation
--   * UAF/SII/OSFL are overlapping universe memberships
--   * REGULATORY_SANCTION_OBSERVED is distinct from CGR_ENFORCEMENT_ACTION
--   * UF and CLP are never implicitly converted or summed
--   * priority_score is an explainable review aid, not LA/FT probability

-- Implementation source of truth:
-- supabase/core-migrations/20260908132200_atlas_v2_sanctions_command_center.sql

-- Public entry point:
-- public.atlas_v2_sanctions_query(jsonb) -> jsonb
-- kinds: overview | dashboard | events | detail
-- schema: ATLAS_SANCTIONS_QUERY_V2

revoke all on function public.atlas_v2_sanctions_query(jsonb) from public, anon;
grant execute on function public.atlas_v2_sanctions_query(jsonb) to authenticated, service_role;
