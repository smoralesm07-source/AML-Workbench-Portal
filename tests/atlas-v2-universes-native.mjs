import fs from 'node:fs';
import assert from 'node:assert/strict';

const adapter = fs.readFileSync('src/v2/universes-adapter.js', 'utf8');
const surface = fs.readFileSync('src/v2/universes-surface.js', 'utf8');
const css = fs.readFileSync('src/v2/universes-surface.css', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');
const auth = fs.readFileSync('src/v2/atlas-v2-core-auth.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');
const core = fs.readFileSync('supabase/core-contracts/atlas-v2-universes-query-v2.sql', 'utf8');
const migration = fs.readFileSync('supabase/core-migrations/20260908002000_atlas_v2_universos_intelligence.sql', 'utf8');
const cacheMigration = fs.readFileSync('supabase/core-migrations/20260908123000_atlas_v2_universos_intelligence_cache.sql', 'utf8');

// Analytical adapters reach only the v2 gateway. The core host is owned by the
// dedicated auth/session boundary and must never leak into a surface/adapter.
assert.match(adapter, /operation: 'universes_query'/);
assert.match(adapter, /x-atlas-core-authorization/);
assert.match(adapter, /ATLAS_UNIVERSES_QUERY_V2/);
assert.match(adapter, /AtlasV2Session\.getAccessToken/);
assert.match(adapter, /POPULATION_INTELLIGENCE_V2/);
assert.match(adapter, /query\('intelligence'/);
assert.match(adapter, /query\('slice'/);
assert.doesNotMatch(adapter, /ldmtlwzqaqmegedktlxr|rest\/v1|supabase\.from|raw\.githubusercontent/);

assert.match(surface, /registerSurface\('universos'/);
assert.match(surface, /POPULATION_INTELLIGENCE_V2/);
for (const lens of ["SII", "UAF / SO", "OSFL", "RES", "Sanciones"]) assert.ok(surface.includes(lens), lens);
for (const marker of [
  'Dónde se concentra el universo',
  'Presencia en otros universos',
  'Qué mirar primero',
  'Entidades que conviene mirar',
  'RUT exacto',
  'Candidatas R.8',
  'no constituye una conclusión AML/FT',
]) assert.ok(surface.includes(marker), marker);
assert.match(surface, /AtlasV2Universes\.slice/);
assert.match(surface, /AtlasV2Universes\.membership/);
assert.match(surface, /api\.navigate\('entidad'/);
assert.match(surface, /api\.navigate\('relaciones'/);
assert.doesNotMatch(surface, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent|ldmtlwzqaqmegedktlxr/);

for (const selector of ['.uiv2-shell','.uiv2-lens-rail','.uiv2-kpis','.uiv2-bar-row','.uiv2-overlap-row','.uiv2-insight','.uiv2-entity-row']) {
  assert.ok(css.includes(selector), selector);
}
assert.match(css, /@media\(max-width:1180px\)/);
assert.match(css, /@media\(max-width:620px\)/);

// v2 gateway owns the cross-project federation and never returns the core token.
assert.match(edge, /operation === "universes_query"/);
assert.match(edge, /atlas_v2_universes_query/);
assert.match(edge, /ATLAS_UNIVERSES_QUERY_V2/);
assert.match(edge, /x-atlas-core-authorization/);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*coreAuth/s);
assert.doesNotMatch(edge, /response\(\{[^}]*coreAuth/s);

// Original core contract remains allow-list authorized and the new migration
// only extends the read API with governed intelligence/slice functions.
assert.match(core, /auth\.uid\(\)/);
assert.match(core, /public\.aml_allowed_users/);
assert.match(core, /EXACT_RUT_ONLY/);
assert.match(core, /NOT_OBSERVED_IN_THIS_SNAPSHOT/);
assert.match(core, /sanction_is_aml_signal',false/);
assert.match(core, /security invoker/);
assert.match(core, /revoke all on function public\.atlas_v2_universes_query\(jsonb\) from public, anon/);
assert.match(core, /grant execute on function public\.atlas_v2_universes_query\(jsonb\) to authenticated, service_role/);
assert.match(core, /universe_overview_snapshot/);
assert.match(core, /universe_distribution_snapshot/);
assert.doesNotMatch(core, /grant execute .* to anon/i);

assert.match(migration, /universe_intelligence/);
assert.match(migration, /universe_slice/);
assert.match(migration, /REGISTRY_COMPANY_MATERIALIZED/);
assert.match(migration, /UAF_OBLIGATED_SUBJECT_SNAPSHOT/);
assert.match(migration, /OSFL_OBSERVED_MATERIALIZATION/);
assert.match(migration, /RES_COMPANY_MATERIALIZED_ALL_FILES/);
assert.match(migration, /SANCTIONS_ENTITY_DOSSIER_CURRENT/);
assert.match(migration, /slice_is_exact_category/);
assert.match(migration, /risk_inheritance',false/);

// Massive SII/RES intelligence reads must not execute their large exact joins in
// the interactive request path. They are materialized and refreshed by cron.
assert.match(cacheMigration, /universe_intelligence_cache/);
assert.match(cacheMigration, /refresh_universe_intelligence_cache_lens/);
assert.match(cacheMigration, /universe_intelligence_cached/);
assert.match(cacheMigration, /MATERIALIZED_POPULATION_INTELLIGENCE/);
assert.match(cacheMigration, /interactive_heavy_joins',false/);
assert.match(cacheMigration, /atlas_v2_universe_cache_sii/);
assert.match(cacheMigration, /atlas_v2_universe_cache_res/);
assert.match(cacheMigration, /return atlas_v2_private\.universe_intelligence_cached\(p_request\)/);
assert.doesNotMatch(cacheMigration, /grant execute .* to anon/i);

// The primary document can connect to core only for authentication/authorization.
assert.match(html, /atlas-v2-core-auth\.js/);
assert.match(html, /atlas-v2-session\.js/);
assert.match(html, /ldmtlwzqaqmegedktlxr\.supabase\.co/);
assert.match(auth, /aml_allowed_users/);
assert.match(auth, /getAccessToken/);
assert.match(boot, /AtlasCoreSession\.ready/);
assert.match(boot, /universes-adapter\.js/);
assert.match(boot, /universes-surface\.js/);
assert.match(boot, /ASSET_REVISION = 'universos-intelligence-1'/);

new Function(adapter);
new Function(surface);

console.log('ATLAS v2 dynamic Universos population intelligence + heavy-read cache contract OK');
