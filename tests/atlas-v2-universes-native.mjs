import fs from 'node:fs';
import assert from 'node:assert/strict';

const adapter = fs.readFileSync('src/v2/universes-adapter.js', 'utf8');
const surface = fs.readFileSync('src/v2/universes-surface.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');
const auth = fs.readFileSync('src/v2/atlas-v2-core-auth.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');
const core = fs.readFileSync('supabase/core-contracts/atlas-v2-universes-query-v2.sql', 'utf8');

// Analytical adapters reach only the v2 gateway. The core host is owned by the
// dedicated auth/session boundary and must never leak into a surface/adapter.
assert.match(adapter, /operation: 'universes_query'/);
assert.match(adapter, /x-atlas-core-authorization/);
assert.match(adapter, /ATLAS_UNIVERSES_QUERY_V2/);
assert.match(adapter, /AtlasV2Session\.getAccessToken/);
assert.doesNotMatch(adapter, /ldmtlwzqaqmegedktlxr|rest\/v1|supabase\.from|raw\.githubusercontent/);

assert.match(surface, /registerSurface\('universos'/);
for (const lens of ["SII", "UAF / SO", "OSFL", "RES", "Sanciones"]) assert.ok(surface.includes(lens), lens);
for (const mode of ["Panorama", "Distribución", "Entidades", "Cruces", "Método"]) assert.ok(surface.includes(mode), mode);
assert.match(surface, /RUT exacto/);
assert.match(surface, /No observado en este snapshot/);
assert.match(surface, /universo observado\/materializado/);
assert.match(surface, /screening.*hipótesis/i);
assert.match(surface, /no equivale por sí sola a riesgo o evidencia LA\/FT/i);
assert.match(surface, /api\.navigate\('entidad'/);
assert.match(surface, /api\.navigate\('relaciones'/);
assert.doesNotMatch(surface, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent|ldmtlwzqaqmegedktlxr/);

// v2 gateway owns the cross-project federation and never returns the core token.
assert.match(edge, /operation === "universes_query"/);
assert.match(edge, /atlas_v2_universes_query/);
assert.match(edge, /ATLAS_UNIVERSES_QUERY_V2/);
assert.match(edge, /x-atlas-core-authorization/);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*coreAuth/s);
assert.doesNotMatch(edge, /response\(\{[^}]*coreAuth/s);

// Core contract is allow-list authorized and not callable by anon.
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

// The primary document can connect to core only for authentication/authorization.
assert.match(html, /atlas-v2-core-auth\.js/);
assert.match(html, /atlas-v2-session\.js/);
assert.match(html, /ldmtlwzqaqmegedktlxr\.supabase\.co/);
assert.match(auth, /aml_allowed_users/);
assert.match(auth, /getAccessToken/);
assert.match(boot, /AtlasCoreSession\.ready/);
assert.match(boot, /universes-adapter\.js/);
assert.match(boot, /universes-surface\.js/);

console.log('ATLAS v2 native Universes analytical contract OK');
