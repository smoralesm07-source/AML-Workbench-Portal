import fs from 'node:fs';
import assert from 'node:assert/strict';

// Contrato de aislamiento: el bridge agrega contexto de prensa sin promover
// identidad por nombre ni alterar score, autenticación o RLS.
const js=fs.readFileSync('assets/atlas-entity-press-0523.js','utf8');
const css=fs.readFileSync('assets/atlas-entity-press-0523.css','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(js,/atlas-press-state\/atlas_prensa\.json/);
assert.match(js,/PRESS_ONLY/);
assert.match(js,/RUT_EXACT_CANONICAL\+NAME_ONLY_CANDIDATE/);
assert.match(js,/scoreMutation:false/);
assert.match(js,/authMutation:false/);
assert.match(js,/canonicalCandidates/);
assert.match(js,/Radar Prensa/);
assert.match(css,/\.aep-profile/);
assert.match(css,/\.aep-badge/);
assert.match(html,/atlas-entity-press-0523\.css/);
assert.match(html,/atlas-entity-press-0523\.js/);
assert.match(html,/connect-src[^;]*https:\/\/raw\.githubusercontent\.com/);

console.log('ATLAS Entity Press 0523 contract OK');
