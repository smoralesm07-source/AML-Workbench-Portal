import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-source-health-global-0694.js','utf8');
const css=fs.readFileSync('assets/atlas-source-health-global-0694.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/Auditoría y salud de fuentes global/);
assert.match(js,/findTopbar/);
assert.match(js,/ensureSeed/);
assert.match(js,/data\.topbarMode|dataset\.topbarMode/);
assert.match(js,/AtlasGlobalSourceHealth/);
assert.match(js,/MutationObserver/);
assert.match(js,/hashchange/);
assert.match(js,/atlas:nav-refresh/);
assert.match(css,/data-atlas-global-audit-fallback/);
assert.match(index,/atlas-source-health-global-0694\.css\?v=0694-1/);
assert.match(index,/atlas-source-health-global-0694\.js\?v=0694-1/);
console.log('atlas-source-health-global-0694: ok');
