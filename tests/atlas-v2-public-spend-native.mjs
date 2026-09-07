import fs from 'node:fs';
import assert from 'node:assert/strict';

const access = fs.readFileSync('src/v2/atlas-v2-access.js', 'utf8');
const surface = fs.readFileSync('src/v2/public-spend-surface.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');

assert.match(access, /AtlasV2Data\.create/);
assert.match(surface, /registerSurface\('gasto-publico'/);
assert.match(surface, /publicSpend\.monitor/);
assert.match(surface, /publicSpend\.budgetContext/);
assert.match(surface, /publicSpend\.suppliers/);
assert.match(surface, /publicSpend\.buyers/);
assert.match(surface, /publicSpend\.pairs/);
assert.match(surface, /publicSpend\.findings/);
assert.match(surface, /publicSpend\.budgetProviders/);
assert.match(surface, /publicSpend\.budgetFlows/);
assert.match(surface, /params\.get\('rut'\)/);
assert.match(surface, /rut \? 'providers' : 'overview'/);
assert.match(surface, /api\.navigate\('entidad', \{ rut \}\)/);
assert.match(surface, /api\.navigate\('relaciones'/);
assert.match(surface, /Concentración ≠ irregularidad/);
assert.match(surface, /Ejecución ≠ flujo proveedor/);
assert.match(surface, /Ausencia ≠ cero/);
assert.match(surface, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg'/);
assert.doesNotMatch(surface, /innerHTML|rest\/v1|supabase\.from|MutationObserver|data-view="public-spend"/);
assert.doesNotMatch(surface, /kanban|SLA|asignar caso|cerrar caso/i);

assert.match(boot, /public-spend-surface\.js/);
assert.match(html, /connect-src 'self' https:\/\/bzqxvidggykkdouotylg\.supabase\.co/);
assert.doesNotMatch(html, /'unsafe-inline'/);

console.log('ATLAS v2 native Public Spend analytical contract OK');
