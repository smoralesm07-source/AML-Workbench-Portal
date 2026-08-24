import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('assets/atlas-entity-osint-sherlock-0520.js','utf8');
const css=fs.readFileSync('assets/atlas-entity-osint-sherlock-0520.css','utf8');
const config=fs.readFileSync('assets/atlas-osint-config.js','utf8');
const service=fs.readFileSync('services/atlas-osint-sherlock/app.py','utf8');
const requirements=fs.readFileSync('services/atlas-osint-sherlock/requirements.txt','utf8');

assert.match(index,/data-aml-version="0\.51\.1"/);
assert.match(index,/atlas-entity-osint-sherlock-0520\.css/);
assert.match(index,/atlas-osint-config\.js/);
assert.match(index,/atlas-entity-osint-sherlock-0520\.js/);
assert.ok(index.indexOf('atlas-entity-dossier-0510.js')<index.indexOf('atlas-entity-osint-sherlock-0520.js'),'OSINT must wrap the final Entity renderer');

assert.match(js,/USERNAME_COINCIDENCE_ONLY/);
assert.match(js,/MEMORY=new Map\(\)/);
assert.doesNotMatch(js,/localStorage|sessionStorage/);
assert.match(js,/getSession\(\)/);
assert.match(js,/Authorization.*Bearer/);
assert.match(js,/data-a45-panel="identity"/);
assert.match(js,/No promover identidad automáticamente/);
assert.match(js,/crypto\.subtle\.digest\('SHA-256'/);
assert.match(js,/credentials:'omit'/);
assert.match(js,/referrerPolicy:'no-referrer'/);

assert.match(config,/apiBase:''/);
assert.doesNotMatch(config,/service_role|secret|password|token\s*:/i);
assert.ok(css.includes('.aos-card'));
assert.ok(css.includes('@media(max-width:780px)'));

assert.match(service,/sherlock_project\.sherlock import sherlock/);
assert.match(service,/SitesInformation\(honor_exclusions=True\)/);
assert.match(service,/remove_nsfw_sites\(\)/);
assert.match(service,/PyJWKClient/);
assert.match(service,/audience="authenticated"/);
assert.match(service,/RATE_LIMIT_PER_HOUR/);
assert.match(service,/asyncio\.Semaphore/);
assert.match(service,/USERNAME_RE/);
assert.match(service,/USERNAME_COINCIDENCE_ONLY/);
assert.doesNotMatch(service,/shell=True/);
assert.doesNotMatch(service,/subprocess/);
assert.match(requirements,/sherlock-project==0\.16\.1/);

console.log('atlas-entity-osint-sherlock-0520: contract OK');
