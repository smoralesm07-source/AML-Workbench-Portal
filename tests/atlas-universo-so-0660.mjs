import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0660.js','utf8');
const sql=fs.readFileSync('sql/atlas_v0660_potential_multisource_architecture.sql','utf8');
const docs=fs.readFileSync('docs/universo-so-multisource-0660.md','utf8');

assert.match(js,/Universo potencial materializado por RUT/i);
assert.match(js,/aml_v_uaf_universe_current_v0671/);
assert.match(js,/SII · ACTECO/);
assert.match(js,/RES · Registro de Empresas y Sociedades/);
assert.match(js,/UAF · padrón inscrito/);
assert.match(js,/no incorpora por sí sola|no como gatillante/i);
assert.match(js,/headline.*RUT únicos/i);
assert.doesNotMatch(js,/79449|79\.449|BASELINE_DECLARED/);
assert.match(sql,/candidate_status in \('ELIGIBLE','PENDING_VALIDATION','CONTEXT_ONLY','REJECTED'\)/);
assert.match(sql,/unique\(source_id,source_candidate_key\)/i);
assert.match(sql,/array_agg\(distinct e\.source_id/i);
assert.match(docs,/La misma entidad puede ser detectada por SII y RES y cuenta una sola vez/);
assert.match(docs,/RES.*no.*Potencial SO/is);

console.log('Universo SO 0.67.2 live materialization contract OK');