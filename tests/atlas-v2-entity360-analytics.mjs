import fs from 'node:fs';
import assert from 'node:assert/strict';

const access = fs.readFileSync('src/v2/atlas-v2-access.js', 'utf8');
const search = fs.readFileSync('src/v2/entity-search-adapter.js', 'utf8');
const adapter = fs.readFileSync('src/v2/entity360-adapter.js', 'utf8');
const surface = fs.readFileSync('src/v2/entity360-surface.js', 'utf8');
const viz = fs.readFileSync('src/v2/atlas-v2-viz.js', 'utf8');
const vizCss = fs.readFileSync('src/v2/atlas-v2-viz.css', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const shell = fs.readFileSync('src/v2/atlas-v2-shell.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');
const sql = fs.readFileSync('supabase/core-migrations/20260907111841_atlas_v2_entity_search_allowlist_hardening.sql', 'utf8');
const searchPerfSql = fs.readFileSync('supabase/core-migrations/20260907115225_optimize_atlas_v2_entity_search_enrichment.sql', 'utf8');

assert.match(access, /AtlasV2Data\.create/);
assert.match(adapter, /AtlasV2Access\.data/);
assert.match(adapter, /gateway\('entity360_read'/);
assert.match(adapter, /ATLAS_ENTITY360_READ_V2/);
assert.match(adapter, /gateway\('entity_intelligence'/);
assert.match(adapter, /ATLAS_ENTITY_INTELLIGENCE_V2/);
assert.match(adapter, /gateway\('entity_screening_live'/);
assert.match(adapter, /ATLAS_ENTITY_SCREENING_LIVE_V2/);
assert.match(adapter, /gateway\('digital_identity_live'/);
assert.match(adapter, /ATLAS_DIGITAL_IDENTITY_LIVE_V2/);
assert.match(adapter, /searchDigitalIdentity/);
assert.match(adapter, /normalizeReference/);
assert.match(adapter, /entityId/);
assert.match(adapter, /RUT_NOT_RESOLVED/);
assert.match(adapter, /publicSpend\.budgetProviders/);
assert.match(adapter, /publicSpend\.suppliers/);
assert.doesNotMatch(adapter, /rest\/v1|supabase\.from|raw\.githubusercontent/);

assert.match(search, /ATLAS_ENTITY_SEARCH_V2/);
assert.match(search, /operation: 'entity_search'/);
assert.match(search, /resultTier/);
assert.match(search, /tierPriority/);
assert.match(search, /x-atlas-core-authorization/);
assert.doesNotMatch(search, /supabase\.from|raw\.githubusercontent|rest\/v1/);

assert.match(edge, /entity_search/);
assert.match(edge, /atlas_v2_entity_search/);
assert.match(edge, /ATLAS_ENTITY_SEARCH_V2/);
assert.match(edge, /entity360_read/);
assert.match(edge, /atlas_v2_entity360_read/);
assert.match(edge, /entity_intelligence/);
assert.match(edge, /entity_screening_live/);
assert.match(edge, /digital_identity_live/);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*rut/s);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*entity_id/s);

assert.match(sql, /security definer/i);
assert.match(sql, /security invoker/i);
assert.match(sql, /aml_allowed_users/);
assert.match(sql, /auth\.uid\(\)/);
assert.match(sql, /ATLAS_CORE_FORBIDDEN/);
assert.match(sql, /PRESS/);
assert.match(sql, /UAF_NAME/);
assert.match(sql, /match_not_identity_assertion/);

assert.match(searchPerfSql, /security definer/i);
assert.match(searchPerfSql, /aml_allowed_users/);
assert.match(searchPerfSql, /left join public\.aml_entities e on e\.entity_id=p\.entity_id/);
assert.match(searchPerfSql, /e\.profile->'fuentes'/);
assert.match(searchPerfSql, /e\.profile->'roles'/);
assert.doesNotMatch(searchPerfSql, /aml_entity_master_v0553/);

assert.match(surface, /registerSurface\('entidad'/);
assert.match(surface, /AtlasV2EntitySearch\.search/);
assert.match(surface, /Radar Prensa/);
assert.match(surface, /Sin RUT resuelto/);
assert.match(surface, /entity_id/);
assert.match(surface, /PRENSA · CONTEXTO/);
assert.match(surface, /TRAYECTORIA SII/);
assert.match(surface, /AtlasV2Viz\.lineChart/);
assert.match(surface, /reconciliationPanel/);
assert.match(surface, /UAF ↔ SII/);
assert.match(surface, /reportingPanel/);
assert.match(surface, /ROS \/ ROE observados/);
assert.match(surface, /faltante como “0”/);
assert.match(surface, /screeningPanel/);
assert.match(surface, /SCREENING INTERNACIONAL/);
assert.match(surface, /digitalIdentityPanel/);
assert.match(surface, /Buscar identidad digital/);
assert.match(surface, /Username ≠ identidad/);
for (const route of ['gasto-publico', 'relaciones', 'territorio']) {
  assert.match(surface, new RegExp(`'${route}'`), `missing analytical move ${route}`);
}
assert.match(surface, /api\.navigate\(route, params\)/);
assert.match(surface, /if \(reference\?\.rut\) params\.rut = reference\.rut/);
assert.match(surface, /if \(reference\?\.entityId\) params\.entity_id = reference\.entityId/);
assert.doesNotMatch(surface, /SLA|kanban|asignar caso|cerrar caso/i);
assert.doesNotMatch(surface, /innerHTML|MutationObserver|raw\.githubusercontent/);

assert.match(viz, /lineChart/);
assert.match(viz, /atlas-v2-viz-line-hit/);
assert.match(viz, /r: 14, class: 'atlas-v2-viz-line-hit'/);
assert.match(viz, /svg\.append\(group\);[\s\S]*svg\.append\(tx\);/);
assert.match(vizCss, /\.atlas-v2-viz-line-hit\s*\{[^}]*pointer-events:\s*all/s);
assert.match(vizCss, /\.atlas-v2-viz-axis-label\s*\{[^}]*pointer-events:\s*none/s);
assert.match(vizCss, /\.atlas-v2-viz-line-path\s*\{[^}]*pointer-events:\s*none/s);
assert.match(boot, /atlas-v2-viz\.js/);
assert.match(boot, /entity-search-adapter\.js/);
assert.match(boot, /entity360-adapter\.js/);
assert.match(boot, /entity360-surface\.js/);
assert.match(boot, /STRUCTURAL_VERSION = 'v2-primary-5'/);
assert.match(shell, /Guardar una vista, seguir una entidad o registrar un resultado nunca será requisito/);
assert.doesNotMatch(shell, /Comercial Andina SpA|76\.123\.456-7/);

console.log('ATLAS 2.0.2 Entity 360 governed intelligence + screening + digital identity contract OK');
