import fs from 'node:fs';
import assert from 'node:assert/strict';

const universo=fs.readFileSync('assets/atlas-universo-so-0640.js','utf8');
const multi=fs.readFileSync('assets/atlas-universo-so-0660.js','utf8');
const spend=fs.readFileSync('assets/atlas-public-spend-context-0571.js','utf8');

// Universo SO: 0.61/0.63 may keep hidden legacy nodes; 0.67 must never
// delete them from a broad MutationObserver because their own observers recreate them.
assert.doesNotMatch(universo,/querySelectorAll\('\.uso61-truth,\.uso63-scope/);
assert.match(universo,/setTextIfChanged/);
assert.match(universo,/requestAnimationFrame/);
assert.match(universo,/scopePromise/);
assert.match(multi,/loadPromise/);
assert.match(multi,/requestAnimationFrame/);

// Gasto Público: contextual panel rendering must be idempotent. Its observer
// may schedule a check, but must not directly re-render on every DOM mutation.
assert.match(spend,/renderSig/);
assert.match(spend,/function signature\(/);
assert.match(spend,/if\(!force&&existing&&C\.renderSig===sig\)/);
assert.match(spend,/new MutationObserver\(\(\)=>\{if\(!C\.patching\)schedule\(\);\}\)/);
assert.doesNotMatch(spend,/new MutationObserver\(\(\)=>\{if\(C\.patching\)return;setTimeout\(schedule,0\)\}\)/);

console.log('Runtime freeze 0.67 regression contract OK');
