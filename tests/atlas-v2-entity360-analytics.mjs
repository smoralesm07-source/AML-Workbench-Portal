import fs from 'node:fs';
import assert from 'node:assert/strict';

const access = fs.readFileSync('src/v2/atlas-v2-access.js', 'utf8');
const adapter = fs.readFileSync('src/v2/entity360-adapter.js', 'utf8');
const surface = fs.readFileSync('src/v2/entity360-surface.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const shell = fs.readFileSync('src/v2/atlas-v2-shell.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');

assert.match(access, /AtlasV2Data\.create/);
assert.match(access, /__ATLAS_V2_ACCESS_TOKEN_PROVIDER__/);
assert.match(adapter, /AtlasV2Access\.data/);
assert.match(adapter, /operation: 'entity360_read'/);
assert.match(adapter, /ATLAS_ENTITY360_READ_V2/);
assert.match(adapter, /x-atlas-core-authorization/);
assert.match(adapter, /publicSpend\.budgetProviders/);
assert.match(adapter, /publicSpend\.suppliers/);
assert.doesNotMatch(adapter, /rest\/v1|supabase\.from|raw\.githubusercontent/);

assert.match(edge, /entity360_read/);
assert.match(edge, /atlas_v2_entity360_read/);
assert.match(edge, /ATLAS_ENTITY360_READ_V2/);
assert.match(edge, /x-atlas-core-authorization/);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*rut/s);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*entity_id/s);

assert.match(surface, /registerSurface\('entidad'/);
assert.match(surface, /api\.navigate\(route, \{ rut \}\)/);
assert.match(surface, /No se crea expediente de gestión, propietario ni estado/);
assert.match(surface, /Compras públicas/);
assert.match(surface, /Presupuesto Abierto v2/);
assert.doesNotMatch(surface, /SLA|kanban|asignar caso|cerrar caso/i);

assert.match(boot, /atlas-v2-access\.js/);
assert.match(boot, /entity360-adapter\.js/);
assert.match(boot, /entity360-surface\.js/);
assert.match(shell, /Guardar una vista, seguir una entidad o registrar un resultado nunca será requisito/);
assert.doesNotMatch(shell, /Comercial Andina SpA|76\.123\.456-7/);

console.log('ATLAS v2 Entity 360 governed single-read analytical contract OK');
