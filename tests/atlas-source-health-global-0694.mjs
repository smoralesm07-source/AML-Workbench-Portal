import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-source-health-global-0694.js','utf8');
const css=fs.readFileSync('assets/atlas-source-health-global-0694.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/Auditoría y salud de fuentes/);
assert.match(js,/findTopbar/);
assert.match(js,/ensureSeed/);
assert.match(js,/setData\(audit,'topbarMode','1'\)/);
assert.match(js,/AtlasGlobalSourceHealth/);
assert.match(js,/NO_GLOBAL_DOM_OBSERVER/);
assert.doesNotMatch(js,/new\s+MutationObserver\s*\(/,'global source health must remain observer-free');
assert.match(js,/atlas:nav-refresh/);
assert.match(js,/atlas:runtime-ready/);
assert.match(css,/data-atlas-global-audit-fallback/);
assert.match(index,/atlas-source-health-global-0694\.css\?v=0715-noflash1/);
assert.match(index,/atlas-source-health-global-0694\.js\?v=0714-perf1/);
console.log('atlas-source-health-global-0694 current low-overhead contract: ok');
