import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-source-health-audit-0536.js','utf8');
const css=fs.readFileSync('assets/atlas-source-health-audit-0536.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/SOURCE-HEALTH-AUDIT-0536\.1/);
assert.match(js,/aml-source-health-monitor/);
assert.match(js,/aml_external_source_health/);
assert.match(js,/Frescura de datos/);
assert.match(js,/Salud de integraciones/);
assert.match(js,/Cobertura operacional efectiva/);
assert.match(js,/critical_down/);
assert.match(js,/fallback/i);
assert.match(js,/impact_if_down/);
assert.match(js,/availability/);
assert.match(js,/upstream/);
assert.match(js,/latency_ms/);
assert.match(css,/\.ash-audit/);
assert.match(css,/\.ash-opdetail/);
assert.match(index,/data-atlas-release="0\.51\.1"/);
assert.match(index,/atlas-source-health-audit-0536\.css\?v=0536-1/);
assert.match(index,/atlas-source-health-audit-0536\.js\?v=0536-1/);
console.log('ATLAS source health audit 0536 contract OK');
