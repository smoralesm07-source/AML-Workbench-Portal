import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0640.js','utf8');
const css=fs.readFileSync('assets/atlas-universo-so-0640.css','utf8');
const sql=fs.readFileSync('sql/atlas_v0640_so_operational_universe.sql','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/operationalSO:10294/);
assert.match(js,/A_ALTA/);
assert.match(js,/B_MEDIA/);
assert.match(js,/C_EXPLORATORIA/);
assert.match(js,/TIPO_ENTIDAD|tipo de entidad/i);
assert.match(css,/\.uso61-truth,\.uso63-scope\{display:none!important\}/);
assert.match(sql,/sujetos obligados operativos\s*= 10\.294/);
assert.match(sql,/potenciales detectados\s*= 2\.033/);
assert.match(sql,/type coherence is SOFT evidence/);
assert.doesNotMatch(sql,/ts\.cuota\s*>?=\s*0\.05/);
assert.match(index,/atlas-universo-so-0640\.css\?v=0640-1/);
assert.match(index,/atlas-universo-so-0640\.js\?v=0640-1/);

console.log('Universo SO 0.64 operational universe contract OK');
