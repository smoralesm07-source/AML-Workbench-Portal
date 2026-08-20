import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('v0447-entity-workspace.js','utf8');
const css=fs.readFileSync('v0447-entity-workspace.css','utf8');
const finalModule=fs.readFileSync('v0442-session-stability.module.js','utf8');
const manifest=JSON.parse(fs.readFileSync('atlas-runtime-manifest.json','utf8'));
const release=JSON.parse(fs.readFileSync('atlas-release.json','utf8'));
const build=JSON.parse(fs.readFileSync('build.json','utf8'));

assert.equal(release.release,manifest.release);
assert.equal(release.release,build.app_version);
assert.equal(release.build,manifest.build);
assert.equal(release.build,build.build);
assert.equal(release.release,'0.44.7');
assert.equal(release.build,'0447');

assert.ok(manifest.styles.includes('v0447-entity-workspace.css'));
const entitySearch=manifest.scripts.find(x=>x.path==='v0447-entity-workspace.js');
assert.ok(entitySearch,'0447 Entity 360 workspace authority missing from manifest');
assert.equal(entitySearch.role,'entity360-single-workspace-autocomplete-current');
assert.ok(manifest.forbidden_runtime_assets.includes('v041-entity-search-ux.js'));
assert.ok(manifest.forbidden_runtime_assets.includes('v041-entity-search-ux.css'));
assert.ok(manifest.forbidden_runtime_assets.includes('atlas-entity-search-current.js'));
assert.ok(manifest.forbidden_runtime_assets.includes('atlas-entity-search-current.css'));

for(const needle of [
  "ENTITY360_INLINE_AUTOCOMPLETE_0447",
  "const LIMIT=8",
  "FETCH_LIMIT=20",
  "CACHE_TTL=2*60*1000",
  "setTimeout(()=>void suggest(term),220)",
  "aria-autocomplete=\"list\"",
  "a47-suggestions",
  "a47-entity-q",
  "SINGLE_DARK_DOSSIER_NO_SEPARATE_SEARCH_LANDING",
  "DEBOUNCED_AUTOCOMPLETE_RLS_NAME_RUT_ENTITY_ID_NO_FUZZY_JOIN",
  "selectionScopesAllEntityGraphics:true",
  "window.loadEntities=loadWorkspace",
  "window.openEntity=openWorkspace"
]) assert.ok(js.includes(needle),`missing 0447 entity workspace contract: ${needle}`);

assert.ok(!js.includes('MutationObserver'));
assert.ok(!js.includes('auth.setSession('));
assert.ok(!js.includes('refresh_token:'));
assert.ok(css.includes('var(--atlas-panel)'));
assert.ok(css.includes('.a47-search-shell'));
assert.ok(css.includes('.a47-suggestions'));
assert.ok(css.includes('#v0344-entities-note{display:none'));
assert.ok(css.includes('#content>.panel:has(#entity-search)'));
assert.ok(finalModule.includes('singleWorkspacePinned:true'));
assert.ok(finalModule.includes('autocompletePinned'));
assert.match(build.entity360_search_ux,/AUTOCOMPLETE_0447/);
assert.match(build.entity360_search_policy,/DEBOUNCED_AUTOCOMPLETE/);
assert.match(release.entity_search_policy,/ENTITY360_INLINE_AUTOCOMPLETE_0447/);

console.log(`ATLAS Entity 360 single-workspace autocomplete contract OK under release ${release.release}/${release.build}`);
