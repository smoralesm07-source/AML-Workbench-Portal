import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('atlas-entity-search-current.js','utf8');
const css=fs.readFileSync('atlas-entity-search-current.css','utf8');
const manifest=JSON.parse(fs.readFileSync('atlas-runtime-manifest.json','utf8'));
const release=JSON.parse(fs.readFileSync('atlas-release.json','utf8'));
const build=JSON.parse(fs.readFileSync('build.json','utf8'));

assert.equal(release.release,'0.43.8');
assert.equal(release.build,'0438');
assert.equal(manifest.release,'0.43.8');
assert.equal(manifest.build,'0438');
assert.equal(build.app_version,'0.43.8');
assert.equal(build.build,'0438');
assert.equal(manifest.styles.at(-1),'atlas-entity-search-current.css');
assert.equal(manifest.scripts.at(-1).path,'atlas-entity-search-current.js');
assert.equal(manifest.scripts.at(-1).role,'entity-search-current-authority');
assert.ok(manifest.forbidden_runtime_assets.includes('v041-entity-search-ux.js'));
assert.ok(manifest.forbidden_runtime_assets.includes('v041-entity-search-ux.css'));

for(const needle of [
  "PREVIEW_LIMIT=8",
  "FULL_LIMIT=50",
  "DEBOUNCE_MS=260",
  "count:'exact'",
  "attempt('planned')",
  "aria-autocomplete=\"list\"",
  "atlas-entity-suggestions",
  "atlas-entity-hit-count",
  "SO / observado UAF",
  "Con sanciones",
  "ENTITY 360 · IDENTIDAD CANÓNICA",
  "NO_FUZZY_IDENTITY_JOIN",
  "FILTERED_EXACT_WITH_PLANNED_FALLBACK",
  "window.loadEntities=loadEntitiesCurrent"
]) assert.ok(js.includes(needle),`missing entity search contract: ${needle}`);

assert.ok(!js.includes('MutationObserver'));
assert.ok(!js.includes("src='./v041-entity-search-ux.js"));
assert.ok(css.includes('var(--atlas-panel)'));
assert.ok(css.includes('var(--atlas-accent)'));
assert.ok(css.includes('.atlas-entity-suggestions'));
assert.ok(css.includes('.atlas-entity-metrics'));
assert.ok(css.includes('html[data-atlas-theme="light"]'));
assert.match(build.entity360_search_ux,/ATLAS_ENTITY_SEARCH_CURRENT_0438/);
assert.match(build.entity360_search_policy,/PREVIEW_8\+FULL_50/);
assert.match(release.entity_search_policy,/DEBOUNCED_RLS_SUGGESTIONS/);

console.log('ATLAS Entity 360 search 0.43.8 contract OK');
