import fs from 'node:fs';
import assert from 'node:assert/strict';

const alias=fs.readFileSync('assets/atlas-entity-search-alias-0522.js','utf8');
const entity=fs.readFileSync('assets/atlas-entity-sherlock-0521.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(alias,/DIGITAL-IDENTITY-EXPLORER-0524\.1/);
assert.match(alias,/aml-digital-identity-live/);
assert.match(alias,/Sherlock \+ WhatsMyName/);
assert.match(alias,/Maigret rules/);
assert.match(alias,/consensus_2plus/);
assert.match(alias,/identityAssertion:false/);
assert.match(alias,/scoreMutation:false/);
assert.match(entity,/Identidad Digital/);
assert.match(entity,/Abrir explorador de identidad digital/);
assert.match(entity,/aml-digital-identity-live/);
assert.match(index,/data-atlas-release="0\.51\.1"/);
assert.match(index,/data-atlas-release-policy="single-active"/);
assert.match(index,/atlas-entity-search-alias-0522\.js\?v=0524-1/);
assert.match(index,/atlas-entity-sherlock-0521\.js\?v=0524-1/);
console.log('ATLAS digital identity explorer 0524 contract OK');
