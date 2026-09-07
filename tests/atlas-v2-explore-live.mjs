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
const release = JSON.parse(fs.readFileSync('atlas-v2-release.json', 'utf8'));

assert.equal(release.release, '2.0.2');
assert.equal(String(release.build), '2002');
assert.equal(release.visual_navigation, 'INTERACTIVE_FIRST');
assert.equal(release.entity_search, 'RUT_NAME_UAF_PRESS');

assert.match(explore, /registerSurface\('explorar'/);
assert.match(explore, /AtlasV2Universes\.overview/);
assert.match(explore, /AtlasV2Universes\.attention/);
assert.match(explore, /SO UAF ↔ SII/);
assert.match(explore, /attentionPanel/);
assert.match(explore, /AtlasV2Watch\.overview/);
assert.match(explore, /AtlasV2Territory\.overview/);
assert.match(explore, /AtlasV2Access\.data\(\)\.publicSpend\.monitor/);
assert.match(explore, /AtlasV2Viz\.horizontalBars/);
assert.match(explore, /AtlasV2Viz\.segmented/);
assert.match(explore, /onSelect:\s*item\s*=>\s*api\.navigate/);
assert.match(explore, /return api\.navigate\('entidad', \{ q: query \}\)/);
assert.doesNotMatch(explore, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent/);

assert.match(viz, /function horizontalBars/);
assert.match(viz, /function lineChart/);
assert.match(viz, /function segmented/);
assert.match(viz, /onclick:\s*\(\)\s*=>\s*options\.onSelect/);
assert.doesNotMatch(viz, /innerHTML|MutationObserver/);

assert.match(css, /grid-template-columns: repeat\(2/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/);

assert.match(boot, /atlas-v2-viz\.js/);
assert.match(boot, /entity-search-adapter\.js/);
assert.match(boot, /warmFederatedSession/);
assert.match(boot, /STRUCTURAL_VERSION = 'v2-primary-5'/);
assert.match(boot, /SURFACE_VERSION = 'v2-primary-5-entity-intelligence-1'/);
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
assert.match(builder, /v2_visual_navigation/);
assert.match(builder, /v2_entity_search/);
assert.match(builder, /v2_entity_intelligence/);

for (const marker of [
  'atlas-v2-shell.css?v=v2-primary-5',
  'atlas-v2-core-auth.css?v=v2-primary-5',
  'atlas-v2-boot.js?v=v2-primary-5-entity-intelligence-1',
  'atlas-v2-session.js?v=v2-primary-5',
  'atlas-v2-viz.css?v=v2-primary-5-viz1',
]) assert.ok(html.includes(marker), marker);

console.log('ATLAS 2.0.2 UAF-SII Explore + entity-intelligence asset contract OK');
