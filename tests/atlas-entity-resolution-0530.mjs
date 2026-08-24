import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync(new URL('../assets/atlas-entity-resolution-0530.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/atlas-entity-resolution-0530.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../sql/atlas_v0530_entity_resolution.sql',import.meta.url),'utf8');

assert.match(html,/atlas-entity-resolution-0530\.css\?v=0530-1/);
assert.match(html,/atlas-entity-resolution-0530\.js\?v=0530-1/);
assert.match(js,/aml_v_entity_resolution_top_v1/);
assert.match(js,/OBSERVED_ENTITY_PRESERVED\+NO_AUTO_MERGE\+NO_RISK_TRANSFER/);
assert.match(js,/HEURISTIC_CONFIDENCE_NOT_CALIBRATED_PROBABILITY/);
assert.match(js,/Number\(row\.score\)<50/);
assert.match(css,/atlas-er-match\.very-high/);
assert.match(sql,/PROBABLE_MISMA_ENTIDAD/);
assert.match(sql,/EVIDENCIA_INSUFICIENTE/);
assert.match(sql,/security_invoker=true/);
assert.match(sql,/enable row level security/);

console.log('atlas entity resolution 0530 guardrails: ok');
