import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('v0447-entity-workspace.js','utf8');
const route=fs.readFileSync('v0448-entity-route-authority.js','utf8');
const docauth=fs.readFileSync('v0449-entity-tax-docauth.js','utf8');
const css=fs.readFileSync('v0447-entity-workspace.css','utf8');
const docauthCss=fs.readFileSync('v0449-entity-tax-docauth.css','utf8');
const finalModule=fs.readFileSync('v0442-session-stability.module.js','utf8');
const manifest=JSON.parse(fs.readFileSync('atlas-runtime-manifest.json','utf8'));
const release=JSON.parse(fs.readFileSync('atlas-release.json','utf8'));
const build=JSON.parse(fs.readFileSync('build.json','utf8'));

assert.equal(release.release,manifest.release);
assert.equal(release.release,build.app_version);
assert.equal(release.build,manifest.build);
assert.equal(release.build,build.build);
assert.equal(release.release,'0.44.9');
assert.equal(release.build,'0449');

assert.ok(manifest.styles.includes('v0447-entity-workspace.css'));
assert.ok(manifest.styles.includes('v0449-entity-tax-docauth.css'));
const entitySearch=manifest.scripts.find(x=>x.path==='v0447-entity-workspace.js');
const entityRoute=manifest.scripts.find(x=>x.path==='v0448-entity-route-authority.js');
const entityDocauth=manifest.scripts.find(x=>x.path==='v0449-entity-tax-docauth.js');
assert.ok(entitySearch,'0447 Entity 360 workspace authority missing from manifest');
assert.ok(entityRoute,'0448 Entity 360 route authority missing from manifest');
assert.ok(entityDocauth,'0449 Entity 360 SII document authorization authority missing from manifest');
assert.equal(entitySearch.role,'entity360-single-workspace-autocomplete-current');
assert.equal(entityRoute.role,'entity360-route-current-authority');
assert.equal(entityDocauth.role,'entity360-sii-document-authorization-current');
assert.ok(manifest.scripts.indexOf(entityRoute)>manifest.scripts.indexOf(entitySearch));
assert.ok(manifest.scripts.indexOf(entityDocauth)>manifest.scripts.indexOf(entityRoute));
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

for(const needle of [
  "ENTITY360_ROUTE_AUTHORITY_0448",
  "if(view==='entities')return entityLoad(...args)",
  "legacyCapturedLoaderBypassed:true",
  "window.navigate=navigate0448",
  "window.loadEntities=entityLoad"
]) assert.ok(route.includes(needle),`missing 0448 entity route contract: ${needle}`);

for(const needle of [
  "aml_v0449_sii_latest_document_authorization",
  "LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE",
  "Última autorización documental observada",
  "SPECIFIC_DOCUMENT_VERIFICATION",
  "AtlasSiiDocumentAuthorization"
]) assert.ok(docauth.includes(needle),`missing 0449 SII document authorization contract: ${needle}`);

assert.ok(!js.includes('MutationObserver'));
assert.ok(!js.includes('auth.setSession('));
assert.ok(!js.includes('refresh_token:'));
assert.ok(!route.includes('auth.setSession('));
assert.ok(!route.includes('refresh_token:'));
assert.ok(!docauth.includes('MutationObserver'));
assert.ok(!docauth.includes('auth.setSession('));
assert.ok(!docauth.includes('refresh_token:'));
assert.ok(css.includes('var(--atlas-panel)'));
assert.ok(css.includes('.a47-search-shell'));
assert.ok(css.includes('.a47-suggestions'));
assert.ok(css.includes('#v0344-entities-note{display:none'));
assert.ok(css.includes('#content>.panel:has(#entity-search)'));
assert.ok(docauthCss.includes('.a49-docauth'));
assert.ok(docauthCss.includes('.a49-timeline'));
assert.ok(finalModule.includes('singleWorkspacePinned:true'));
assert.ok(finalModule.includes('routePinned:true'));
assert.ok(finalModule.includes('legacyCapturedLoaderBypassed:true'));
assert.ok(finalModule.includes('autocompletePinned'));
assert.ok(finalModule.includes('siiDocumentAuthorizationPinned'));
assert.ok(finalModule.includes('LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE'));
assert.match(build.entity360_search_ux,/AUTOCOMPLETE_0447/);
assert.match(build.entity360_workspace_policy,/ENTITIES_ROUTE_ALWAYS_CALLS_CURRENT_ENTRY_LOAD/);
assert.match(build.entity360_document_authorization_policy,/LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE/);
assert.match(release.entity_search_policy,/ENTITY360_ROUTE_AUTHORITY_0448/);
assert.match(release.entity360_document_authorization_policy,/MISSING_IS_NOT_NO_TIMBRAJE/);

console.log(`ATLAS Entity 360 workspace + route + SII document authorization contract OK under release ${release.release}/${release.build}`);
