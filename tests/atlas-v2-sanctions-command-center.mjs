import fs from 'node:fs';
import assert from 'node:assert/strict';

const adapter = fs.readFileSync('src/v2/sanctions-adapter.js', 'utf8');
const surface = fs.readFileSync('src/v2/sanctions-surface.js', 'utf8');
const css = fs.readFileSync('src/v2/sanctions-surface.css', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/core-migrations/20260908132200_atlas_v2_sanctions_command_center.sql', 'utf8');

assert.match(adapter, /ATLAS_SANCTIONS_QUERY_V2/);
assert.match(adapter, /operation: 'sanctions_query'/);
assert.match(adapter, /AtlasV2Session\.getAccessToken\(async \(\) => coreToken\)/);
assert.match(adapter, /dashboard\(filters/);
assert.match(adapter, /detail\(eventId/);
assert.doesNotMatch(adapter, /ldmtlwzqaqmegedktlxr|rest\/v1|supabase\.from|raw\.githubusercontent/);

for (const marker of [
  "registerSurface('sanciones'",
  'Monitoreo consolidado de sanciones sobre universos UAF, SII y OSFL',
  'Universos analizados',
  'Sanciones por supervisor',
  'Sanciones por región',
  'Sanciones por tipo',
  'Evolución de sanciones',
  'Casos prioritarios',
  'Ficha de sanción',
  'Documento de la sanción',
  'Entidad 360',
  'CGR',
  'Prioridad analítica ≠ probabilidad LA/FT',
]) assert.ok(surface.includes(marker), marker);
assert.match(surface, /AtlasV2Sanctions\.dashboard/);
assert.match(surface, /AtlasV2Sanctions\.events/);
assert.match(surface, /AtlasV2Sanctions\.detail/);
assert.doesNotMatch(surface, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent|ldmtlwzqaqmegedktlxr/);

for (const selector of [
  '.atlas-v2-sanctions', '.san-filterbar', '.san-kpis', '.san-universes', '.san-supervisors',
  '.san-regions', '.san-types', '.san-evolution', '.san-events', '.san-event', '.san-detail', '.san-document'
]) assert.ok(css.includes(selector), selector);
assert.match(css, /@media \(max-width: 1250px\)/);
assert.match(css, /@media \(max-width: 860px\)/);

assert.match(edge, /operation === "sanctions_query"/);
assert.match(edge, /atlas_v2_sanctions_query/);
assert.match(edge, /x-atlas-core-authorization/);

assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /aml_allowed_users/);
assert.match(migration, /v_kind = 'dashboard'/);
assert.match(migration, /v_kind = 'events'/);
assert.match(migration, /v_kind = 'detail'/);
assert.match(migration, /REGULATORY_SANCTION_OBSERVED/);
assert.match(migration, /CGR_ENFORCEMENT_ACTION/);
assert.match(migration, /UF y CLP permanecen separados/);
assert.match(migration, /Prioridad analítica explicable/);
assert.match(migration, /revoke all on function public\.atlas_v2_sanctions_query\(jsonb\) from public, anon/);
assert.match(migration, /grant execute on function public\.atlas_v2_sanctions_query\(jsonb\) to authenticated, service_role/);
assert.doesNotMatch(migration, /grant execute .* to anon/i);

assert.match(boot, /sanctions-adapter\.js/);
assert.match(boot, /sanctions-surface\.js/);
assert.match(boot, /ASSET_REVISION = 'sanctions-command-center-1'/);

new Function(adapter);
new Function(surface);
console.log('ATLAS v2 sanctions command center contract OK');
