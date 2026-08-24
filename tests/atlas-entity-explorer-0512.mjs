import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-entity-explorer-0512.js','utf8');
const css=fs.readFileSync('assets/atlas-entity-explorer-0512.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/ENTITY-EXPLORER-0512\.1/);
assert.match(js,/Busca una entidad o explora una nómina/);
assert.match(js,/Nóminas rápidas/);
assert.match(js,/Observadas UAF/);
assert.match(js,/UAF \+ sanciones/);
assert.match(js,/Multi-fuente 3\+/);
assert.match(js,/Fuentes de datos/);
assert.match(js,/aex-source-pop-inline/);
assert.match(js,/\.ilike\('name'/,'autocomplete must query approximate names');
assert.doesNotMatch(js,/pop\.style\.(left|top)/,'source popup must not depend on CSP-blocked inline positioning');
assert.match(css,/\.aex-blank\{/);
assert.match(css,/\.aex-suggest\{/);
assert.match(css,/\.aex-quick-lists\{/);
assert.match(css,/\.aex-source-pop-inline\{/);
assert.match(index,/atlas-entity-explorer-0512\.css\?v=0512-2/);
assert.match(index,/atlas-entity-explorer-0512\.js\?v=0512-2/);

console.log('ATLAS entity explorer 0512 contract OK');