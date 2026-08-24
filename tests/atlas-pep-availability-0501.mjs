import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path,'utf8');
const js = read('assets/atlas-pep-availability-0501.js');
const html = read('index.html');
const release = JSON.parse(read('atlas-release.json'));
const build = JSON.parse(read('build.json'));
const runtime = JSON.parse(read('atlas-runtime-manifest.json'));

assert.equal(release.release,'0.50.0');
assert.equal(release.build,'0500');
assert.equal(build.app_version,'0.50.0');
assert.equal(build.build,'0500');
assert.equal(runtime.release,'0.50.0');
assert.equal(runtime.build,'0500');

assert.match(html,/atlas-pep-availability-0501\.js\?v=0501-1/);
assert.ok(html.indexOf('atlas-pep-discovery.js?v=0501-1') < html.indexOf('atlas-pep-availability-0501.js?v=0501-1'));

assert.match(js,/const VIEW = 'pep-discovery'/);
assert.match(js,/aml_pep_discovery_snapshot/);
assert.match(js,/maybeSingle\(\)/);
assert.match(js,/status:'EMPTY'/);
assert.match(js,/Snapshot latest/);
assert.match(js,/Sin inventar/);
assert.match(js,/AUTO|Activación automática|Activacion automatica/i);
assert.match(js,/AtlasPepDiscovery\?\.open/);
assert.match(js,/if \(view === VIEW\) return open\(false\)/);
assert.doesNotMatch(js,/MutationObserver/);
assert.doesNotMatch(js,/localStorage/);
assert.doesNotMatch(js,/sessionStorage/);
assert.doesNotMatch(js,/service[_-]?role/i);
assert.doesNotMatch(js,/insert\(|update\(|upsert\(|delete\(/i);

assert.match(release.pep_discovery_policy,/EMPTY_SNAPSHOT_IS_OPERATIONAL_STATE_NOT_ZERO_RESULTS/);
assert.match(release.pep_discovery_policy,/AUTO_ACTIVATE_ON_LATEST/);

console.log('ATLAS Personas y control availability hotfix 0501: OK');
