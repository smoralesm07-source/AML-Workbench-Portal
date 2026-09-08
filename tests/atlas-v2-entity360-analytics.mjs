import fs from 'node:fs';
import assert from 'node:assert/strict';

const access = fs.readFileSync('src/v2/atlas-v2-access.js', 'utf8');
const search = fs.readFileSync('src/v2/entity-search-adapter.js', 'utf8');
const explorerAdapter = fs.readFileSync('src/v2/entity-explorer-adapter.js', 'utf8');
const classicExplorer = fs.readFileSync('src/v2/entity-explorer-classic-surface.js', 'utf8');
const classicExplorerCss = fs.readFileSync('src/v2/entity-explorer-classic-surface.css', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');
const adapter = fs.readFileSync('src/v2/entity360-adapter.js', 'utf8');
const executive = fs.readFileSync('src/v2/entity360-surface.js', 'utf8');
const executiveCss = fs.readFileSync('src/v2/entity360-surface.css', 'utf8');
const parity = fs.readFileSync('src/v2/entity360-parity-surface.js', 'utf8');
const parityCss = fs.readFileSync('src/v2/entity360-parity-surface.css', 'utf8');
const expediente = fs.readFileSync('src/v2/entity360-expediente-surface.js', 'utf8');
const expedienteCss = fs.readFileSync('src/v2/entity360-expediente-surface.css', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');
const sql = fs.readFileSync('supabase/core-migrations/20260907111841_atlas_v2_entity_search_allowlist_hardening.sql', 'utf8');
const searchPerfSql = fs.readFileSync('supabase/core-migrations/20260907115225_optimize_atlas_v2_entity_search_enrichment.sql', 'utf8');
const classicSql = fs.readFileSync('supabase/core-migrations/20260907180500_atlas_v2_entidades_classic_explorer.sql', 'utf8');

new Function(explorerAdapter);
new Function(classicExplorer);
new Function(executive);
new Function(parity);
new Function(expediente);

assert.match(access, /AtlasV2Data\.create/);
for (const marker of [
  'gateway(\'entity360_read\'', 'ATLAS_ENTITY360_READ_V2',
  'gateway(\'entity_intelligence\'', 'ATLAS_ENTITY_INTELLIGENCE_V2',
  'gateway(\'entity_screening_live\'', 'ATLAS_ENTITY_SCREENING_LIVE_V2',
  'gateway(\'digital_identity_live\'', 'ATLAS_DIGITAL_IDENTITY_LIVE_V2',
  'searchDigitalIdentity', 'normalizeReference', 'RUT_NOT_RESOLVED',
  'publicSpend.budgetProviders', 'publicSpend.suppliers',
]) assert.ok(adapter.includes(marker), `Entity adapter missing ${marker}`);
assert.doesNotMatch(adapter, /rest\/v1|supabase\.from|raw\.githubusercontent/);

for (const marker of [
  'ATLAS_ENTITY_SEARCH_V2', "operation: 'entity_search'", 'resultTier', 'tierPriority',
  'EXACT_RECONCILED_THEN_PRESS_HIGH', 'exact_reconciled', 'press_high', 'pressMinimumConfidence: 0.86',
]) assert.ok(search.includes(marker), `Search adapter missing ${marker}`);
assert.doesNotMatch(search, /supabase\.from|raw\.githubusercontent|rest\/v1/);

for (const marker of [
  'ENTITY_EXPLORER_CLASSIC_V2', 'explorer_meta', "request('explorer'", "request('suggest'", 'x-atlas-core-authorization',
]) assert.ok(explorerAdapter.includes(marker), `Explorer adapter missing ${marker}`);
for (const marker of [
  'ENTIDADES', 'Observadas UAF', 'Con sanciones', 'UAF + sanciones', 'Multi-fuente 3+', 'OSFL',
  'Organismos públicos', 'Prioridad analítica', 'Cobertura × condición', 'Territorios observados',
  'Ficha', 'Expediente', 'SCREENING INTERNACIONAL', 'Identidad digital', 'readScreening', 'searchDigitalIdentity',
  'EXACT_RECONCILED_THEN_PRESS_HIGH', 'EVERY_IDENTITY_SEARCH', 'ENTITY_EXPLORER_CLASSIC_V2',
]) assert.ok(classicExplorer.includes(marker), `Classic Entidades missing ${marker}`);
assert.match(classicExplorer, /Username ≠ identidad/);
assert.doesNotMatch(classicExplorer, /innerHTML|MutationObserver|raw\.githubusercontent/);
for (const selector of ['.aex2-command', '.aex2-facets', '.aex2-panorama', '.aex2-result-row', '.aex2-sheet', '.aex2-screening']) {
  assert.ok(classicExplorerCss.includes(selector), `Classic Entidades CSS missing ${selector}`);
}

// Capas históricas conservadas como fallback/paridad de datos.
for (const marker of [
  'timelineEvents', 'timelinePanel', 'whatToReview', 'Qué mirar primero', 'Línea de tiempo de hechos críticos',
  'Término de giro publicado en SII', 'reconciliationPanel', 'UAF ↔ SII', 'reportingPanel',
  'Ausencia de dato ≠ cero ROS/ROE', 'screeningPanel', 'SCREENING INTERNACIONAL', 'digitalIdentityPanel',
]) assert.ok(executive.includes(marker), `Executive Entity 360 fallback missing ${marker}`);
for (const selector of ['.atlas-v2-h360', '.atlas-v2-h360-priority-grid', '.atlas-v2-h360-timeline', '.atlas-v2-h360-focus-list']) {
  assert.ok(executiveCss.includes(selector), `Executive Entity 360 fallback CSS missing ${selector}`);
}
assert.doesNotMatch(executive, /innerHTML|MutationObserver|raw\.githubusercontent/);

for (const marker of [
  'SIX_LENS_NATIVE_V2', 'ENTITY360_LEGACY_PARITY_V2', 'e360p-identidad', 'e360p-caracterizacion',
  'e360p-relaciones', 'e360p-contexto', 'e360p-senales', 'e360p-evidencia', 'ipa3_score',
  'peer_positions', 'res_lifecycle', 'sanction_resolution', 'AtlasV2Entity360.read', "registerSurface('entidad'",
]) assert.ok(parity.includes(marker), `Recovered Entity 360 parity missing ${marker}`);
for (const selector of ['.e360p-hero', '.e360p-lens-nav', '.e360p-score-ring', '.e360p-rail', '.e360p-mark', '.e360p-timeline']) {
  assert.ok(parityCss.includes(selector), `Recovered Entity 360 parity CSS missing ${selector}`);
}
assert.doesNotMatch(parity, /innerHTML|MutationObserver|raw\.githubusercontent/);

// Autoridad visible vigente: expediente ejecutivo 360, registrado después de la paridad histórica.
for (const marker of [
  'ENTITY360_EXPEDIENTE_EXECUTIVE_V2_20260908', "registerSurface('entidad'",
  '__ATLAS_V2_ENTITY360_EXPEDIENTE__', 'Línea de tiempo', 'Sanciones', 'Gasto público', 'OSFL', 'RES',
]) assert.ok(expediente.includes(marker), `Entity 360 expediente missing ${marker}`);
for (const selector of ['.e36x{', '.e36x-hero', '.e36x-tabs', '.e36x-timeline']) {
  assert.ok(expedienteCss.includes(selector), `Entity 360 expediente CSS missing ${selector}`);
}
assert.doesNotMatch(expediente, /MutationObserver|raw\.githubusercontent/);

assert.match(boot, /SURFACE_VERSION = 'v2-primary-7-executive-pulse-entity360-classic-1'/);
assert.match(boot, /ASSET_REVISION = 'entity360-expediente-1'/);
assert.match(boot, /entity360-surface\.js/);
assert.match(boot, /entity360-parity-surface\.js/);
assert.match(boot, /entity360-expediente-surface\.js/);
assert.ok(boot.indexOf("'entity360-surface.js'") < boot.indexOf("'entity360-parity-surface.js'"));
assert.ok(boot.indexOf("'entity360-parity-surface.js'") < boot.indexOf("'entity360-expediente-surface.js'"));
assert.match(html, /entity360-parity-surface\.css\?v=v2-primary-5-entity360-parity-1/);
assert.match(html, /e=e360-expediente-1/);
assert.doesNotMatch(html, /entity360-parity-surface\.js\?v=/);

assert.match(classicSql, /kind','explorer_meta'/);
assert.match(classicSql, /v_kind = 'explorer'/);
assert.match(classicSql, /v_kind = 'suggest'/);
assert.match(classicSql, /v_mode = 'exact_reconciled'/);
assert.match(classicSql, /v_mode = 'press_high'/);
assert.match(classicSql, /identity_not_promoted/);

assert.match(edge, /atlas_v2_entity_search/);
for (const marker of ['entity_search', 'entity360_read', 'entity_intelligence', 'entity_screening_live', 'digital_identity_live']) {
  assert.ok(edge.includes(marker), `Read gateway missing ${marker}`);
}
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*rut/s);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*entity_id/s);

assert.match(sql, /security definer/i);
assert.match(sql, /security invoker/i);
assert.match(sql, /aml_allowed_users/);
assert.match(sql, /auth\.uid\(\)/);
assert.match(sql, /ATLAS_CORE_FORBIDDEN/);
assert.match(searchPerfSql, /security definer/i);
assert.match(searchPerfSql, /aml_allowed_users/);
assert.match(searchPerfSql, /left join public\.aml_entities e on e\.entity_id=p\.entity_id/);
assert.doesNotMatch(searchPerfSql, /aml_entity_master_v0553/);

console.log('ATLAS 2.0.2 Entidades + Entity 360 expediente authority contract OK');
