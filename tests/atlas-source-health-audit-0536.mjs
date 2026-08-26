import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-source-health-audit-0536.js','utf8');
const css=fs.readFileSync('assets/atlas-source-health-audit-0536.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.doesNotThrow(()=>new Function(js));
assert.match(js,/SOURCE-HEALTH-AUDIT-0536\.\d+/);
assert.match(js,/FRESHNESS_PIPELINE='SOURCE_FRESHNESS'/);
assert.match(js,/from\('aml_sync_state'\)/);
assert.match(js,/eq\('pipeline',FRESHNESS_PIPELINE\)/);
assert.match(js,/loadFreshness/);
assert.match(js,/getFreshnessState/);
assert.match(js,/getCatalogSources/);
assert.doesNotMatch(js,/const freshness=\(\)=>window\.AtlasDataAudit/);

assert.match(js,/aml-source-health-monitor/);
assert.match(js,/aml_external_source_health/);
assert.match(js,/critical_down/);
assert.match(js,/fallback/i);
assert.match(js,/impact_if_down/);
assert.match(js,/availability/);
assert.match(js,/upstream/);
assert.match(js,/latency_ms/);
assert.match(js,/loadState='loading'/);
assert.match(js,/pending\?'—'/);
assert.match(js,/telemetría no disponible/i);
assert.match(js,/const waits=\[0,400,1000,2000,4000\]/);
assert.match(js,/Promise\.allSettled\(\[loadOps\(true\),loadFreshness\(true\),loadRes\(true\)\]\)/);
assert.match(js,/operational-fallback/);
assert.doesNotMatch(js,/for\(const d of \[0,300,1000,2500\]\)/);
assert.doesNotMatch(js,/a\.dataset\.ash0536='';render\(\)/);

assert.match(css,/\.ash-audit/);
assert.match(css,/\.ash-opdetail/);
assert.match(index,/atlas-source-health-audit-0536\.css\?v=0536-2/);
assert.match(index,/atlas-source-health-audit-0536\.js\?v=0536-2/);

console.log('ATLAS source health audit governed freshness catalog contract OK');
