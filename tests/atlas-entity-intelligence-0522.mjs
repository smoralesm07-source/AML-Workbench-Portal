import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-entity-intelligence-0520.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(js,/const RELEASE='0\.52\.2',BUILD='0522'/);
assert.match(js,/órdenes de compra/);
assert.match(js,/compra neta observada/);
assert.match(js,/licitaciones · contexto/);
assert.match(js,/audiencias únicas/);
assert.match(js,/registros de participantes/);
assert.match(js,/PURCHASE_ORDERS_PRIMARY/);
assert.match(js,/PURCHASE_ORDER_INFOLOBBY/);
assert.match(js,/mercado_publico_ordenes/);
assert.match(js,/monto_compra_observado/);
assert.match(js,/No prueba causalidad, trato preferente ni irregularidad/);
assert.match(html,/atlas-entity-intelligence-0520\.js\?v=0522-1/);
assert.ok(html.indexOf('atlas-entity-intelligence-0520.js') < html.indexOf('atlas-entity-consolidation-0521.js'));

console.log('ATLAS Entity Intelligence 0522 · purchase orders + InfoLobby OK');
