import fs from 'node:fs';
import assert from 'node:assert/strict';

const explore = fs.readFileSync('src/v2/explore-surface.js', 'utf8');
const css = fs.readFileSync('src/v2/explore-surface.css', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const universes = fs.readFileSync('src/v2/universes-adapter.js', 'utf8');
const territory = fs.readFileSync('src/v2/territory-adapter.js', 'utf8');
const watch = fs.readFileSync('src/v2/watch-adapter.js', 'utf8');
const builder = fs.readFileSync('tools/build_atlas_v2_primary.py', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');
const release = JSON.parse(fs.readFileSync('atlas-v2-release.json', 'utf8'));

assert.equal(release.release, '2.0.1');
assert.equal(String(release.build), '2001');
assert.match(release.release_notes, /primera prueba de experiencia usuaria/i);

assert.match(explore, /registerSurface\('explorar'/);
assert.match(explore, /AtlasV2Universes\.overview/);
assert.match(explore, /AtlasV2Watch\.overview/);
assert.match(explore, /AtlasV2Territory\.overview/);
assert.match(explore, /AtlasV2Access\.data\(\)\.publicSpend\.monitor/);
assert.match(explore, /Promise\.all\(tasks\)/);
assert.match(explore, /Una prioridad orienta atención/);
assert.match(explore, /faltante no equivale a cero/i);
assert.match(explore, /sanción administrativa no constituye por sí sola evidencia AML\/FT/i);
assert.match(explore, /contexto territorial no se hereda a la entidad/i);
assert.doesNotMatch(explore, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent|ldmtlwzqaqmegedktlxr/);

assert.match(css, /grid-template-columns: repeat\(2/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}/);

assert.match(boot, /explore-surface\.js/);
assert.match(boot, /warmFederatedSession/);
assert.match(boot, /FEDERATION_WARM/);
assert.match(boot, /STRUCTURAL_VERSION = 'v2-primary-2'/);
assert.match(boot, /warmFederatedSession\(\);[\s\S]*installAnalyticalSurfaces\(\)/);

for (const [name, adapter] of [['universes', universes], ['territory', territory], ['watch', watch]]) {
  assert.match(adapter, /OVERVIEW_CACHE_TTL_MS = 30000/, `${name} overview cache TTL`);
  assert.match(adapter, /cacheStatus: 'memory'/, `${name} memory-cache metadata`);
  assert.match(adapter, /clearCache/, `${name} cache clear`);
}

assert.match(builder, /"explore-surface\.js"/);
assert.match(builder, /"explore-surface\.css"/);
assert.match(builder, /V2_VERSION = "v2-primary-2"/);
assert.match(builder, /v2_explore_mode/);
assert.match(builder, /v2_federation_prewarm/);

for (const marker of [
  'atlas-v2-shell.css?v=v2-primary-2',
  'atlas-v2-core-auth.css?v=v2-primary-2',
  'atlas-v2-boot.js?v=v2-primary-2',
  'atlas-v2-session.js?v=v2-primary-2',
]) assert.ok(html.includes(marker), marker);

console.log('ATLAS v2 live Explore + UX preflight contract OK');
