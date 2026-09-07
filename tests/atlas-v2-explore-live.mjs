import fs from 'node:fs';
import assert from 'node:assert/strict';

const explore = fs.readFileSync('src/v2/explore-surface.js', 'utf8');
const css = fs.readFileSync('src/v2/explore-surface.css', 'utf8');
const viz = fs.readFileSync('src/v2/atlas-v2-viz.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const universes = fs.readFileSync('src/v2/universes-adapter.js', 'utf8');
const builder = fs.readFileSync('tools/build_atlas_v2_primary.py', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');
const reportability = JSON.parse(fs.readFileSync('data/uaf_reportability_sector_2025.json', 'utf8'));
const uafSnapshot = JSON.parse(fs.readFileSync('data/uaf_dashboard_snapshot.json', 'utf8'));
const release = JSON.parse(fs.readFileSync('atlas-v2-release.json', 'utf8'));

assert.equal(release.release, '2.0.2');
assert.equal(String(release.build), '2002');
assert.equal(release.visual_navigation, 'INTERACTIVE_FIRST');
assert.equal(reportability.schema, 'UAF_SECTOR_REPORTABILITY_V1');
assert.equal(reportability.period, '2021-2025');
assert.equal(reportability.totals.ros_2021, 9738);
assert.equal(reportability.totals.ros_2022, 11400);
assert.equal(reportability.totals.ros_2023, 12900);
assert.equal(reportability.totals.ros_2024, 17417);
assert.equal(reportability.totals.ros_2025, 21828);
assert.equal(uafSnapshot.kpis.registered_total_latest, 10294);

for (const marker of [
  "registerSurface('explorar'",
  'IMAGE_STANDARD_EXECUTIVE_V3',
  'EXECUTIVE_PULSE_V2',
  'LEGACY_PULSE_NATIVE_V2',
  'YTD_DASHED_NO_FABRICATION',
  'RUT, entidad o tema…',
  'rosTrendChart',
  'rosYearChart',
  'areaLineChart',
  '2026 · acumulado',
  'corte pendiente',
  'reportabilityInsight',
  'Quién explica el volumen',
  'proportionalBars',
  'statusComposition',
  'attentionTable',
  'managementSectorPanel',
  'AtlasV2Universes.overview',
  'AtlasV2Universes.attention',
  'UAF ↔ SII',
  'Padrón operativo UAF',
  'Término de giro',
  'Sin perfil SII',
]) assert.ok(explore.includes(marker), `Explore missing ${marker}`);

assert.doesNotMatch(explore, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent/);

for (const selector of [
  '.atlas-v2-studio-home', '.atlas-v2-studio-search', '.atlas-v2-studio-kpis', '.atlas-v2-studio-panel',
  '.atlas-v2-studio-ros-chart', '.atlas-v2-studio-ros-insight', '.atlas-v2-studio-ring',
  '.atlas-v2-studio-status-track', '.atlas-v2-studio-attention-item', '.atlas-v2-studio-sector-row',
]) assert.ok(css.includes(selector), `Explore image-standard CSS missing ${selector}`);
assert.match(css, /grid-template-columns:repeat\(4/);
assert.match(css, /stroke-dasharray:6 6/);
assert.match(css, /conic-gradient/);
assert.match(css, /@media\(max-width:1180px\)/);
assert.match(css, /@media\(max-width:560px\)/);

assert.match(viz, /function horizontalBars/);
assert.match(viz, /function lineChart/);
assert.match(viz, /function segmented/);
assert.match(viz, /widthPct\.toFixed/);
assert.doesNotMatch(viz, /innerHTML|MutationObserver/);

assert.match(boot, /STRUCTURAL_VERSION = 'v2-primary-5'/);
assert.match(boot, /SURFACE_VERSION = 'v2-primary-7-executive-pulse-entity360-classic-1'/);
assert.match(boot, /ASSET_REVISION = 'image-standard-3'/);
assert.match(boot, /entity360-surface\.js/);
assert.match(boot, /entity360-parity-surface\.js/);
assert.ok(boot.indexOf("'entity360-surface.js'") < boot.indexOf("'entity360-parity-surface.js'"));
assert.match(boot, /ENTITY360_LEGACY_PARITY_V2/);

assert.match(universes, /attention:\s*\(options = \{\}\)\s*=>\s*query\('attention'/);
assert.match(universes, /recentTerminated/);
assert.match(universes, /terminatedByYear/);

assert.match(builder, /SURFACE_VERSION = "v2-primary-7-executive-pulse-entity360-classic-1"/);
assert.match(builder, /"v2_explore_design": "EXECUTIVE_PULSE_V2"/);
assert.match(builder, /"v2_entity360_authority": "ENTITY360_LEGACY_PARITY_V2"/);
assert.match(builder, /"v2_ros_2026_semantics": "YTD_DASHED_NO_FABRICATION"/);

for (const marker of [
  'atlas-v2-shell.css?v=v2-primary-5',
  'atlas-v2-core-auth.css?v=v2-primary-5',
  'atlas-v2-boot.js?v=v2-primary-7-executive-pulse-entity360-classic-1&r=image-standard-3',
  'atlas-v2-session.js?v=v2-primary-5',
  'atlas-v2-viz.css?v=v2-primary-5-viz1',
  'entity360-parity-surface.css?v=v2-primary-5-entity360-parity-1',
]) assert.ok(html.includes(marker), marker);
assert.doesNotMatch(html, /entity360-parity-surface\.js\?v=/);

console.log('ATLAS 2.0.2 Explore image-standard + recovered Entity 360 boot contract OK');
