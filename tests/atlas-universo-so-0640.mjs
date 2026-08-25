import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0640.js','utf8');
const css=fs.readFileSync('assets/atlas-universo-so-0640.css','utf8');
const js66=fs.readFileSync('assets/atlas-universo-so-0660.js','utf8');
const sql64=fs.readFileSync('sql/atlas_v0640_so_operational_universe.sql','utf8');
const sql65=fs.readFileSync('sql/atlas_v0650_potential_screening_scope.sql','utf8');
const sql66=fs.readFileSync('sql/atlas_v0660_potential_multisource_architecture.sql','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/operationalSO:10294/);
assert.match(js,/potentialSO:79449/);
assert.match(js,/multisource:true/);
assert.match(js,/atlas-universo-so-0660\.js/);
assert.match(js,/ACTECO_19913_VIGENTE_SII_NO_UAF/);
assert.match(js,/candidate_use=SI/);
assert.match(js,/ACTIVE_AS_PUBLISHED/);
assert.match(js,/legacy2033:false/);
assert.doesNotMatch(js,/A_ALTA|B_MEDIA|C_EXPLORATORIA/);
assert.match(css,/atlas-universo-so-0660\.css/);
assert.match(js66,/aml_v_uaf_potential_architecture_status_v0660/);
assert.match(js66,/RES · Registro de Empresas y Sociedades/);
assert.match(js66,/Estar en RES, por sí solo, no basta/);
assert.match(sql66,/aml_uaf_potential_source_registry_v0660/);
assert.match(sql66,/aml_uaf_potential_candidate_evidence_v0660/);
assert.match(sql66,/aml_v_uaf_potential_multisource_current_v0660/);
assert.match(sql66,/count\(distinct e\.source_id\)/i);
assert.match(sql66,/where u\.rut is null/i);
assert.match(sql66,/La mera existencia de una sociedad en RES no basta/i);
assert.match(sql64,/sujetos obligados operativos\s*= 10\.294/);
assert.match(sql65,/79449/);
assert.match(index,/atlas-universo-so-0640\.css\?v=0640-1/);
assert.match(index,/atlas-universo-so-0640\.js\?v=0640-1/);

console.log('Universo SO 0.66 multisource architecture contract OK');
