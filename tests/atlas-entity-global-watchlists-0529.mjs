import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js=readFileSync(new URL('../assets/atlas-entity-global-watchlists-0529.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(js,/aml-entity-global-watchlists-live/,'global live edge function must be invoked');
assert.match(js,/ICIJ_OFFSHORE/,'ICIJ source must be represented');
assert.match(js,/OPENSANCTIONS/,'OpenSanctions source must be represented');
for(const code of ['UN_SANCTIONS','OFAC','EU_SANCTIONS','UK_SANCTIONS','WORLD_BANK','IDB_SANCTIONS']) assert.match(js,new RegExp(code),`${code} coverage must be visible`);
assert.match(js,/candidato; requiere revisión/,'UI must preserve analyst-review semantics');
assert.match(js,/identityPromotion:false/,'global screening must never promote canonical identity');
assert.match(js,/scoreMutation:false/,'global screening must never mutate IPA3');
assert.match(html,/atlas-entity-global-watchlists-0529\.css\?v=0529-1/,'watchlists CSS must be loaded');
assert.match(html,/atlas-entity-global-watchlists-0529\.js\?v=0529-1/,'watchlists runtime must be loaded');

console.log('atlas-entity-global-watchlists-0529: ok');
