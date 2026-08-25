import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0610.js','utf8');
const sql=fs.readFileSync('sql/atlas_v0610_uaf_universe_integrity.sql','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.match(js,/aml_v_uaf_universe_integrity_0610/);
assert.match(js,/aml_v_uaf_reporting_obligation_0610/);
assert.match(js,/10\.294 no equivale|no equivale a sujetos obligados inscritos/);
assert.match(js,/Organismos públicos observados por fuente UAF/);
assert.match(js,/EXACT_NORMALIZED_UNAMBIGUOUS/);
assert.match(js,/No muestra aún la conducta efectiva de reportes/);

assert.match(sql,/registered_subjects/);
assert.match(sql,/uaf_public_bodies/);
assert.match(sql,/canonical_sector_catalog/);
assert.match(sql,/reporting_rule_mapped/);
assert.match(sql,/revoke all on public\.aml_v_uaf_universe_integrity_0610 from anon/);

assert.match(html,/atlas-universo-so-0610\.js\?v=0610-1/);
assert.match(html,/atlas-public-spend-signal-command-v2\.css\?v=0451-1/);
assert.doesNotMatch(html,/rel="stylesheet" href="\.\/assets\/atlas-public-spend-signal-command-v2\.js/);

console.log('Universo SO 0610 contract: OK');
