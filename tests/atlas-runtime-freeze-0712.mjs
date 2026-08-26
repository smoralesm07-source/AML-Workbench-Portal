import fs from 'node:fs';
import assert from 'node:assert/strict';

const guard=fs.readFileSync('atlas-release-guard.js','utf8');
const health=fs.readFileSync('assets/atlas-source-health-global-0694.js','utf8');
const recovery=fs.readFileSync('assets/atlas-operational-recovery-0704.js','utf8');

const globalChildObserver=/observe\(\s*document\.documentElement\s*,\s*\{[^}]*childList\s*:\s*true[^}]*subtree\s*:\s*true/s;

assert.equal(globalChildObserver.test(guard),false,'release guard must not observe the full DOM child tree');
assert.equal(/new MutationObserver\(queueApply\)/.test(guard),false,'release guard must not self-schedule from child mutations');
assert.equal(/small\.textContent\s*=\s*label\s*;/.test(guard),false,'version label writes must be idempotent');
assert.equal(globalChildObserver.test(health),false,'source health must not observe the full DOM child tree');
assert.equal(/createTreeWalker\(\s*document\.body/.test(recovery),false,'recovery must not walk the whole body');
assert.equal(/AtlasGlobalSourceHealth\?\.refresh\?\.\(\)/.test(recovery),false,'shell recovery must not force source-health queries');
assert.match(guard,/NO_GLOBAL_CHILD_MUTATION_OBSERVER/);
assert.match(health,/NO_GLOBAL_DOM_OBSERVER/);
assert.match(recovery,/NO_BODY_TREEWALK_NO_FORCED_SOURCE_REFRESH/);

console.log('ATLAS freeze guard 0712 OK');
