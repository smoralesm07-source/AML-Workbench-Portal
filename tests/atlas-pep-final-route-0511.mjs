import fs from 'node:fs';
import assert from 'node:assert/strict';

const finalPin = fs.readFileSync('v0442-session-stability.module.js','utf8');
const pep = fs.readFileSync('assets/atlas-pep-discovery.js','utf8');

assert.match(finalPin, /view === 'pep-discovery'/);
assert.match(finalPin, /window\.AtlasPepDiscovery\?\.open/);
assert.match(finalPin, /AtlasPepDiscovery\.open\(false\)/);
assert.match(finalPin, /pepDiscoveryRoutePinned/);
assert.match(finalPin, /PRESERVED_BY_FINAL_NAVIGATION_AUTHORITY/);
assert.match(pep, /const VIEW='pep-discovery'/);

console.log('ATLAS Personas y control final route authority 0511: OK');
