import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0620.js','utf8');
const sql=fs.readFileSync('sql/atlas_v0620_reporting_behavior.sql','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/aml_v_uaf_reporting_obligation_0620/);
assert.match(js,/aml_v_uaf_entity_reporting_behavior_0620/);
assert.match(js,/NOT_MATERIALIZED/);
assert.match(js,/Esto no significa cero reportes/);
assert.match(sql,/aml_uaf_reporting_sector_alias_0620/);
assert.match(sql,/GOVERNED_ALIAS/);
assert.match(sql,/aml_uaf_entity_reporting_observation_0620/);
assert.match(sql,/enable row level security/);
assert.match(sql,/revoke all on public\.aml_uaf_entity_reporting_observation_0620 from anon, authenticated/);
assert.match(sql,/grant select on public\.aml_uaf_entity_reporting_observation_0620 to authenticated/);
assert.match(index,/atlas-universo-so-0620\.js\?v=0620-1/);

console.log('Universo SO 0.62 reporting behavior contract OK');
