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

assert.equal(release.release, '0.50.0');
assert.equal(release.build, '0500');
assert.equal(build.app_version, '0.50.0');
assert.equal(build.build, '0500');
assert.equal(runtime.release, '0.50.0');
assert.equal(runtime.build, '0500');

assert.match(html, /atlas-pep-discovery\.css\?v=0500-1/);
assert.match(html, /atlas-pep-runtime-state-bridge\.js\?v=0500-1/);
assert.match(html, /atlas-pep-discovery\.js\?v=0500-1/);
assert.ok(html.indexOf('atlas-pep-runtime-state-bridge.js') < html.indexOf('atlas-pep-discovery.js'));
assert.match(html, /data-atlas-release="0\.50\.0"/);

assert.match(bridge, /typeof state === 'undefined'/);
assert.match(bridge, /Object\.defineProperty\(window, 'state'/);
assert.doesNotMatch(bridge, /MutationObserver/);
assert.doesNotMatch(bridge, /localStorage/);

assert.match(js, /const VIEW='pep-discovery'/);
assert.match(js, /aml_pep_discovery_snapshot/);
assert.match(js, /ATLAS_PEP_DISCOVERY_LATEST_V1/);
assert.match(js, /SUPABASE_RLS/);
assert.match(js, /MEMORY_ONLY/);
assert.match(js, /PEP-03/);
assert.match(js, /PEP-04/);
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

console.log('ATLAS PEP discovery 0500 contract: OK');
