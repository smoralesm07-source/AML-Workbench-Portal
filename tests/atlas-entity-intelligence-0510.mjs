import fs from 'node:fs';
import assert from 'node:assert/strict';

/* Contrato de producto de la seccion Entidades 0510.
 * Verifica lo que no puede romperse sin cambiar la semantica declarada:
 * fuentes de lectura, guardarrailes, aislamiento del resto de la aplicacion y
 * coherencia entre los tres archivos de contrato. */

const read = path => fs.readFileSync(path, 'utf8');
const explorer = read('assets/atlas-entity-explorer-0510.js');
const dossier = read('assets/atlas-entity-dossier-0510.js');
const explorerCss = read('assets/atlas-entity-explorer-0510.css');
const dossierCss = read('assets/atlas-entity-dossier-0510.css');
const sql = read('sql/atlas_v0510_entity_intelligence.sql');
const html = read('index.html');
const release = JSON.parse(read('atlas-release.json'));
const build = JSON.parse(read('build.json'));
const runtime = JSON.parse(read('atlas-runtime-manifest.json'));

/* --- coherencia de release --- */
assert.equal(release.release, build.app_version);
assert.equal(release.build, build.build);
assert.equal(release.release, runtime.release);
assert.equal(release.build, runtime.build);
assert.equal(release.build, '0510');

/* --- montaje en el runtime publicado --- */
assert.match(html, /atlas-entity-explorer-0510\.css\?v=0510-1/);
assert.match(html, /atlas-entity-dossier-0510\.css\?v=0510-1/);
assert.match(html, /atlas-entity-explorer-0510\.js\?v=0510-1/);
assert.match(html, /atlas-entity-dossier-0510\.js\?v=0510-1/);
assert.ok(html.indexOf('atlas-entity-explorer-0510.js') < html.indexOf('atlas-entity-dossier-0510.js'),
  'el explorador se monta antes que el expediente');
assert.ok(html.indexOf('atlas-pep-discovery.js') < html.indexOf('atlas-entity-explorer-0510.js'),
  'la extension 0510 carga despues del runtime compilado y de las extensiones previas');
assert.match(html, new RegExp(`data-atlas-release="${release.release.replace(/\./g, '\\.')}"`));

/* --- aislamiento: la extension envuelve autoridades, no las reemplaza --- */
assert.match(explorer, /window\.__ATLAS_ENTITY_ENTRY__/);
assert.match(explorer, /const BASE_LOAD=ENTRY\.load/);
assert.match(explorer, /ENTRY\.legacyEmptyWorkspace=BASE_LOAD/);
assert.match(dossier, /const BASE_RENDER=typeof window\.v0203RenderEntity==='function'/);
assert.match(dossier, /const result=BASE_RENDER\(pkg,preserve\)/);
/* Las prohibiciones se verifican sobre codigo, no sobre la prosa que las declara. */
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const source of [strip(explorer), strip(dossier)]) {
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /signOut|refresh_token|setSession/);
  /* Lectura pura: ninguna escritura contra PostgREST. Map.delete no cuenta. */
  assert.doesNotMatch(source, /\.(insert|upsert|update)\(/);
  assert.doesNotMatch(source, /\.from\([^)]*\)[^;]*\.delete\(/);
  assert.match(source, /MEMORY_ONLY/);
  assert.match(source, /authMutation:false/);
}

/* --- busqueda gobernada --- */
assert.match(explorer, /function normalizeRut/);
assert.match(explorer, /\$\{raw\.slice\(0,-1\)\}-\$\{raw\.slice\(-1\)\}/);
assert.match(explorer, /normalize\('NFD'\)\.replace\(\/\[\\u0300-\\u036f\]\/g,''\)/);
assert.match(explorer, /for\(const token of parsed\.value\)query=query\.ilike\('name'/);
assert.match(explorer, /query\.eq\('rut',parsed\.value\)/);
assert.match(explorer, /count:'planned'/);
assert.match(explorer, /PLANNED_ESTIMATE_LABELLED_EXACT_LOADED_ONLY/);
assert.match(explorer, /facets:\['region','entity_type','is_uaf_observed','is_sanctioned','source_count'\]/);
assert.match(explorer, /aml_v019_gap_region/);
assert.match(explorer, /queryHash/);
assert.doesNotMatch(explorer, /audit\('SEARCH',\{[^}]*query:/);

/* --- lecturas por snapshot, no por vista pesada --- */
assert.match(dossier, /const SCORE_SNAPSHOT='aml_ipa3_entity_score_snapshot_v0_4'/);
assert.match(dossier, /const MARK_SNAPSHOT='aml_ipa3_mark_scores_snapshot_v0_4'/);
assert.match(dossier, /const PEER_SNAPSHOT='aml_entity_peer_position_snapshot'/);
assert.match(dossier, /const LINK_SNAPSHOT='aml_entity_identity_link_snapshot'/);
assert.doesNotMatch(dossier, /aml_v_ipa3_entity_score_v0_4/);
assert.doesNotMatch(dossier, /aml_v_ipa3_mark_scores_v0_4/);
assert.doesNotMatch(dossier, /aml_v_ipa3_sii_peer_benchmark/);
assert.doesNotMatch(dossier, /aml_v_entity_relations/);

/* --- bloques de caracterizacion --- */
for (const source of ['aml_v_ipa3_structure_peer_benchmark', 'aml_v_ipa3_sii_trajectory_summary',
  'aml_v_ipa3_sanction_entity_summary', 'aml_sanction_identity_resolution',
  'aml_uaf_entity_profile', 'aml_osfl_profile', 'aml_v0460_entity_disposition_current']) {
  assert.ok(dossier.includes(source), `el expediente debe leer ${source}`);
}
assert.match(dossier, /ATLAS_ENTITY_CHARACTERIZATION_V1/);
assert.match(dossier, /function markDrawer/);
assert.match(dossier, /aporte           = min\(intensidad_bruta, tope_individual\) × confianza/);

/* --- guardarrailes visibles, no solo declarados --- */
assert.match(explorer, /Cobertura ≠ riesgo/);
assert.match(explorer, /Prioridad ≠ probabilidad/);
assert.match(explorer, /Identidad ≠ similitud/);
assert.match(explorer, /Ausencia ≠ cero/);
assert.match(explorer, /sin marca/);
assert.match(dossier, /no es probabilidad de LA\/FT|Prioridad analítica, no probabilidad/);
assert.match(dossier, /no describe desempeño|posición relativa|no es riesgo/);
assert.match(dossier, /no promueve identidad/);
assert.match(dossier, /no acredita por sí sola lavado de activos|no acredita delito|no acredita conducta/);
assert.match(dossier, /Ausencia en el corte no equivale a puntaje cero/);
/* Un IPA3 en cero es ausencia de marca y se muestra como raya, nunca como banda baja. */
assert.match(explorer, /if\(!score\|\|value==null\|\|value<=0\)return`<b>—<\/b>/);
assert.match(dossier, /ninguna marca activa/);

/* --- estilo aislado: ninguna regla global --- */
for (const css of [explorerCss, dossierCss]) {
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /var\(--atlas-/);
  assert.doesNotMatch(css, /^\s*(body|html|#app|#content|\*)\s*\{/m);
}
assert.match(explorerCss, /\.aex\{/);
assert.match(dossierCss, /\.aed-card\{/);

/* --- contrato de datos declarado --- */
assert.match(release.entity_search_policy, /ENTITY_EXPLORER_0510/);
assert.match(release.entity_search_policy, /NO_FUZZY_IDENTITY_JOIN/);
assert.match(release.entity360_policy, /DEEP_CHARACTERIZATION_0510/);
assert.match(release.entity360_policy, /PEER_POSITION_IS_POSITION_NOT_PERFORMANCE/);
assert.match(release.entity_intelligence_policy, /ABSENT_FROM_CUT_IS_NOT_ZERO/);
assert.match(release.entity_intelligence_policy, /ZERO_SCORE_IS_NO_ACTIVE_MARK_SHOWN_AS_DASH/);
assert.match(release.analyst_disposition_policy, /APPEND_ONLY/);
assert.match(build.entity_intelligence_contract, /SNAPSHOT_FIRST_NO_HEAVY_VIEW_PER_ENTITY/);
assert.match(build.data_contract, /ENTITY_PEER_POSITION_SNAPSHOT_0510/);

/* --- la migracion declara autorizacion y refresco --- */
assert.match(sql, /aml_ipa3_mark_scores_snapshot_v0_4/);
assert.match(sql, /aml_entity_peer_position_snapshot/);
assert.match(sql, /aml_entity_identity_link_snapshot/);
assert.match(sql, /enable row level security/);
assert.match(sql, /aml_allowed_users/);
assert.match(sql, /grant select on public\.%I to authenticated/);
assert.match(sql, /revoke all on public\.%I from anon/);
assert.match(sql, /refresh_aml_entity_intel_snapshots_0510/);
assert.match(sql, /pg_try_advisory_xact_lock/);
assert.doesNotMatch(sql, /security definer/i);

console.log(`ATLAS Entidades 0510: explorador + caracterizacion profunda OK bajo release ${release.release}/${release.build}`);
