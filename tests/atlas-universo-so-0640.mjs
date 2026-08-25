import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0640.js','utf8');
const css=fs.readFileSync('assets/atlas-universo-so-0640.css','utf8');
const js66=fs.readFileSync('assets/atlas-universo-so-0660.js','utf8');
const sql64=fs.readFileSync('sql/atlas_v0640_so_operational_universe.sql','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/aml_uaf_potential_screening_scope_0650/);
assert.match(js,/aml_v_uaf_potential_sector_current_v0671/);
assert.match(js,/aml_v_uaf_universe_current_v0671/);
assert.match(js,/RUT_LEVEL|RUT únicos|RUT exacto/i);
assert.match(js,/candidate_use=SI/);
assert.match(js,/ACTIVE_AS_PUBLISHED/);
assert.match(js,/sectoriales no son aditivas|más de un sector/i);
assert.match(js,/legacy2033:false/);
assert.doesNotMatch(js,/79449|79\.449|2026-05/);
assert.doesNotMatch(js,/A_ALTA|B_MEDIA|C_EXPLORATORIA/);
assert.match(css,/uso72-sector-list/);
assert.match(css,/atlas-universo-so-0660\.css/);
assert.match(js66,/aml_v_uaf_universe_current_v0671/);
assert.match(js66,/RES · Registro de Empresas y Sociedades/);
assert.match(js66,/ANTI-JOIN RUT/);
assert.doesNotMatch(js66,/79449|79\.449|BASELINE_DECLARED/);
assert.match(sql64,/sujetos obligados operativos\s*= 10\.294/);
assert.match(index,/atlas-universo-so-0640\.css\?v=0672-1/);
assert.match(index,/atlas-universo-so-0640\.js\?v=0672-1/);

console.log('Universo SO 0.67.2 current SII/UAF presentation contract OK');