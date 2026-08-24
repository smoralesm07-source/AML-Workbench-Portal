import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const js = read('assets/atlas-pep-discovery.js');
const bridge = read('assets/atlas-pep-runtime-state-bridge.js');
const css = read('assets/atlas-pep-discovery.css');
const html = read('index.html');
const release = JSON.parse(read('atlas-release.json'));
const build = JSON.parse(read('build.json'));
const runtime = JSON.parse(read('atlas-runtime-manifest.json'));

// El contrato PEP es de producto, no un pin de numero de release: sigue siendo
// exigible en cualquier release posterior. Se verifica coherencia entre los tres
// archivos de contrato, igual que hace tests/atlas-entity-search-current.mjs.
assert.equal(release.release, build.app_version);
assert.equal(release.build, build.build);
assert.equal(release.release, runtime.release);
assert.equal(release.build, runtime.build);
assert.match(release.release, /^\d+\.\d+\.\d+$/);

assert.match(html, /atlas-pep-discovery\.css\?v=0500-2/);
assert.match(html, /atlas-pep-runtime-state-bridge\.js\?v=0500-2/);
assert.match(html, /atlas-pep-discovery\.js\?v=0500-2/);
assert.ok(html.indexOf('atlas-pep-runtime-state-bridge.js') < html.indexOf('atlas-pep-discovery.js'));
assert.match(html, new RegExp(`data-atlas-release="${release.release.replace(/\./g,'\\.')}"`));

assert.match(bridge, /typeof state !== 'undefined'/);
assert.match(bridge, /Object\.defineProperty\(window, 'state'/);
assert.match(bridge, /typeof window\.navigate !== 'function'/);
assert.match(bridge, /typeof navigate === 'function'/);
assert.match(bridge, /typeof window\.shell !== 'function'/);
assert.match(bridge, /typeof shell === 'function'/);
assert.doesNotMatch(bridge, /MutationObserver/);
assert.doesNotMatch(bridge, /localStorage/);

assert.match(js, /const VIEW='pep-discovery'/);
assert.match(js, /aml_pep_discovery_snapshot/);
assert.match(js, /ATLAS_PEP_DISCOVERY_LATEST_V1/);
assert.match(js, /active_or_recent_confirmed/);
assert.match(js, /downstream_target_count/);
assert.match(js, /declared_interest_company_ruts/);
assert.match(js, /declared_interest_provider_matches/);
assert.match(js, /declared_interest_orders_matched|orders_matched/);
assert.match(js, /DECLARED_INTEREST:'Interés societario declarado'/);
assert.match(js, /Interés societario declarado/);
assert.match(js, /no implica control ni BF/i);
assert.match(js, /no acredita porcentaje de propiedad, control ni beneficiario final/i);
assert.match(js, /function topCases\(p\).*\.top/);
assert.match(js, /requested_periods/);
assert.match(js, /downloaded_periods/);
assert.match(js, /failed_periods/);
assert.match(js, /IFL_SCHEMA_EXACT_NO_INVENTED_FIELDS/);
assert.doesNotMatch(js, /top_cases/);
assert.doesNotMatch(js, /confirmed_for_discovery/);
assert.doesNotMatch(js, /downstream_targets/);
assert.doesNotMatch(js, /supplier_targets/);
assert.doesNotMatch(js, /suppliers_with_pep_bf/);

assert.match(js, /SUPABASE_RLS/);
assert.match(js, /MEMORY_ONLY/);
assert.match(js, /PEP-03/);
assert.match(js, /PEP-04/);
assert.match(js, /Interés declarado, PEP-01, PEP-02 y PEP-05 son contexto/);
assert.match(js, /triage, no score AML/);
assert.doesNotMatch(js, /MutationObserver/);
assert.doesNotMatch(js, /localStorage/);
assert.doesNotMatch(js, /\.\/data\/pep_discovery_latest\.json/);
assert.doesNotMatch(js, /service[_-]?role/i);

assert.match(css, /\.atlas-pep\{/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /prefers-reduced-motion/);

assert.match(release.pep_discovery_policy, /PEP_NOT_ADVERSE/);
assert.match(release.pep_discovery_policy, /PEP_01_02_05_CONTEXT_ONLY/);
assert.match(release.pep_discovery_policy, /PEP_03_04_REVIEW/);
assert.match(release.pep_discovery_policy, /NO_NAME_ONLY_JOIN/);
assert.match(build.pep_discovery_contract, /SUPABASE_RLS_PRIVATE_LATEST_ONLY/);

console.log('ATLAS PEP discovery 0500-2 governed bridge + IFL contract: OK');
