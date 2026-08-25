import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0640.js','utf8');
const css=fs.readFileSync('assets/atlas-universo-so-0640.css','utf8');
const sql64=fs.readFileSync('sql/atlas_v0640_so_operational_universe.sql','utf8');
const sql65=fs.readFileSync('sql/atlas_v0650_potential_screening_scope.sql','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/operationalSO:10294/);
assert.match(js,/potentialSO:79449/);
assert.match(js,/ACTECO_19913_VIGENTE_SII_NO_UAF/);
assert.match(js,/candidate_use=SI/);
assert.match(js,/ACTIVE_AS_PUBLISHED/);
assert.match(js,/legacy2033:false/);
assert.doesNotMatch(js,/A_ALTA|B_MEDIA|C_EXPLORATORIA/);
assert.match(css,/\.uso61-truth,\.uso63-scope,\.uso64-tier-strip\{display:none!important\}/);
assert.match(sql64,/sujetos obligados operativos\s*= 10\.294/);
assert.match(sql65,/79449/);
assert.match(sql65,/candidate_use=SI/);
assert.match(sql65,/ACTIVE_AS_PUBLISHED/);
assert.match(sql65,/restrictive_filters/);
assert.match(sql65,/2\.033/);
assert.match(index,/atlas-universo-so-0640\.css\?v=0640-1/);
assert.match(index,/atlas-universo-so-0640\.js\?v=0640-1/);

console.log('Universo SO 0.65 broad ACTECO screening contract OK');
