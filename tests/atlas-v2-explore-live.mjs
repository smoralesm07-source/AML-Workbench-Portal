import fs from 'node:fs';
import assert from 'node:assert/strict';

const explore = fs.readFileSync('src/v2/explore-surface.js', 'utf8');
const css = fs.readFileSync('src/v2/explore-surface.css', 'utf8');
const viz = fs.readFileSync('src/v2/atlas-v2-viz.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const universes = fs.readFileSync('src/v2/universes-adapter.js', 'utf8');
const territory = fs.readFileSync('src/v2/territory-adapter.js', 'utf8');
const watch = fs.readFileSync('src/v2/watch-adapter.js', 'utf8');
const builder = fs.readFileSync('tools/build_atlas_v2_primary.py', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');
const reconciliationSql = fs.readFileSync('supabase/core-migrations/20260907185500_atlas_v2_uaf_sii_attention_sectors.sql', 'utf8');
const reportability = JSON.parse(fs.readFileSync('data/uaf_reportability_sector_2025.json', 'utf8'));
const uafSnapshot = JSON.parse(fs.readFileSync('data/uaf_dashboard_snapshot.json', 'utf8'));
const release = JSON.parse(fs.readFileSync('atlas-v2-release.json', 'utf8'));

assert.equal(release.release, '2.0.2');
assert.equal(String(release.build), '2002');
assert.equal(release.visual_navigation, 'INTERACTIVE_FIRST');
assert.equal(release.entity_search, 'RUT_NAME_UAF_PRESS');
assert.equal(reportability.schema, 'UAF_SECTOR_REPORTABILITY_V1');
assert.equal(reportability.period, '2021-2025');
assert.equal(reportability.totals.registered_so_2025, 9911);
assert.equal(reportability.totals.ros_2025, 21828);
assert.ok(Array.isArray(reportability.sectors) && reportability.sectors.length > 20);
assert.equal(uafSnapshot.kpis.registered_total_latest, 10294);

assert.match(explore, /registerSurface\('explorar'/);
assert.match(explore, /LEGACY_PULSE_NATIVE_V2/);
assert.match(explore, /uaf_reportability_sector_2025\.json/);
assert.match(explore, /uaf_dashboard_snapshot\.json/);
assert.match(explore, /RUT, entidad o tema…/);
assert.match(explore, /Reportabilidad ROS/);
assert.match(explore, /ROS recibidos por año/);
assert.match(explore, /Quién explica el volumen/);
assert.match(explore, /areaLineChart/);
assert.match(explore, /proportionalBars/);
assert.match(explore, /statusComposition/);
assert.match(explore, /AtlasV2Universes\.overview/);
assert.match(explore, /AtlasV2Universes\.attention/);
assert.match(explore, /UAF ↔ SII/);
assert.match(explore, /attentionPanel/);
assert.match(explore, /Padrón operativo UAF/);
assert.match(explore, /Término de giro/);
assert.match(explore, /AtlasV2Watch\.overview/);
assert.match(explore, /AtlasV2Territory\.overview/);
assert.match(explore, /AtlasV2Access\.data\(\)\.publicSpend\.monitor/);
assert.match(explore, /selectedYear/);
assert.match(explore, /aria-selected/);
assert.match(explore, /return api\.navigate\('entidad', \{ q: query \}\)/);
assert.doesNotMatch(explore, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent/);

assert.match(reconciliationSql, /v_sectors jsonb/);
assert.match(reconciliationSql, /aml_v0434_uaf_sii_sector/);
assert.match(reconciliationSql, /terminated_pct/);
assert.match(reconciliationSql, /sector_aggregation/);
assert.match(reconciliationSql, /security definer/i);
assert.match(reconciliationSql, /aml_allowed_users/);

assert.match(viz, /function horizontalBars/);
assert.match(viz, /function lineChart/);
assert.match(viz, /function segmented/);
assert.match(viz, /widthPct\.toFixed/);
assert.match(viz, /style: `width:/);
assert.doesNotMatch(viz, /innerHTML|MutationObserver/);

assert.match(css, /\.atlas-v2-home-search\{/);
assert.match(css, /\.atlas-v2-home-pulse\{/);
assert.match(css, /\.atlas-v2-pulse-svg\{/);
assert.match(css, /\.atlas-v2-recon-track\{/);
assert.match(css, /\.atlas-v2-context-card\{/);
assert.match(css, /grid-template-columns:repeat\(4/);
assert.match(css, /@media\(max-width:860px\)/);
assert.match(css, /@media\(max-width:560px\)/);

assert.match(boot, /atlas-v2-viz\.js/);
assert.match(boot, /entity-search-adapter\.js/);
assert.match(boot, /warmFederatedSession/);
assert.match(boot, /STRUCTURAL_VERSION = 'v2-primary-5'/);
assert.match(boot, /SURFACE_VERSION = 'v2-primary-6-explore-legacy-pulse-1'/);
assert.match(boot, /VISUAL_SEARCH_CAPABILITY_MISSING/);

for (const [name, adapter] of [['universes', universes], ['territory', territory], ['watch', watch]]) {
  assert.match(adapter, /OVERVIEW_CACHE_TTL_MS = 30000/, `${name} overview cache TTL`);
  assert.match(adapter, /cacheStatus: 'memory'/, `${name} memory-cache metadata`);
  assert.match(adapter, /clearCache/, `${name} cache clear`);
}
assert.match(universes, /attention:\s*\(options = \{\}\)\s*=>\s*query\('attention'/);
assert.match(universes, /recentTerminated/);
assert.match(universes, /terminatedByYear/);
assert.match(builder, /"atlas-v2-viz\.js"/);
assert.match(builder, /"entity-search-adapter\.js"/);
assert.match(builder, /V2_VERSION = "v2-primary-5"/);
assert.match(builder, /LEGACY_PULSE_NATIVE_V2/);
assert.match(builder, /v2_visual_navigation/);
assert.match(builder, /v2_entity_search/);
assert.match(builder, /v2_entity_intelligence/);

for (const marker of [
  'atlas-v2-shell.css?v=v2-primary-5',
  'atlas-v2-core-auth.css?v=v2-primary-5',
  'atlas-v2-boot.js?v=v2-primary-6-explore-legacy-pulse-1',
  'atlas-v2-session.js?v=v2-primary-5',
  'atlas-v2-viz.css?v=v2-primary-5-viz1',
]) assert.ok(html.includes(marker), marker);

console.log('ATLAS 2.0.2 Explore native legacy pulse + UAF-SII contract OK');
