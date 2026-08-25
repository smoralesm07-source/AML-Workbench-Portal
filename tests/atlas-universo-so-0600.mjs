import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0600.js','utf8');
const css=fs.readFileSync('assets/atlas-universo-so-0600.css','utf8');
const sql=fs.readFileSync('sql/atlas_v0600_universo_so_supervision.sql','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(js,/aml_v_uaf_supervision_360_current/);
assert.match(js,/Gestión de cobertura/);
assert.match(js,/Reportabilidad entidad/);
assert.match(js,/Mercado Público \/ Lobby \/ CGR/);
assert.match(js,/Lente OSFL/);
assert.match(js,/Línea de tiempo societaria/);
assert.match(js,/INVITADO/);
assert.match(js,/EN_SEGUIMIENTO/);
assert.match(js,/INSCRITO/);
assert.doesNotMatch(js,/user_id\s*:/,'user_id must be assigned by the database, never by the browser payload');
assert.doesNotMatch(js,/localStorage|sessionStorage/,'workflow state must not live in browser storage');
assert.match(sql,/grant select on public\.aml_v_uaf_supervision_360_current to authenticated/);
assert.match(sql,/revoke all on public\.aml_v_uaf_supervision_360_current from anon/);
for(const s of ['ELEGIBLE','PRIORIZADO','INVITACION_PREPARADA','INVITADO','EN_SEGUIMIENTO','INSCRITO','CERRADO']) assert.match(sql,new RegExp(s));
assert.match(html,/atlas-universo-so-0600\.css/);
assert.match(html,/atlas-universo-so-0600\.js/);
assert.match(css,/uso60-sourcegrid/);
console.log('Universo SO 0.60 contract OK');
