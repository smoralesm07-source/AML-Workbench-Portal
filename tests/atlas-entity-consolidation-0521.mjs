import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-entity-consolidation-0521.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/ENTITY-CONSOLIDATION-0521\.1/);
assert.match(js,/personas y control/);
assert.match(js,/Personas, propiedad y control/);
assert.match(js,/dataDeletion:false/);
assert.match(js,/relationshipDeletion:false/);
assert.match(js,/standalonePeopleControl:false/);
assert.match(js,/Vínculos de identidad y relaciones gobernadas/);
assert.match(index,/atlas-entity-consolidation-0521\.js\?v=0521-1/);
assert.ok(index.indexOf('atlas-entity-consolidation-0521.js')>index.indexOf('atlas-entity-intelligence-0520.js'),'consolidation must load after Entity Intelligence');

console.log('ATLAS entity consolidation 0521 contract OK');
