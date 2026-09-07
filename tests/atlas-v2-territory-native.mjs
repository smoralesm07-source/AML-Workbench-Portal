import fs from 'node:fs';
import assert from 'node:assert/strict';

const adapter = fs.readFileSync('src/v2/territory-adapter.js', 'utf8');
const surface = fs.readFileSync('src/v2/territory-surface.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');

assert.match(adapter, /operation: 'territory_query'/);
assert.match(adapter, /x-atlas-core-authorization/);
assert.match(adapter, /ATLAS_TERRITORY_QUERY_V2/);
assert.match(adapter, /AtlasV2Session\.getAccessToken/);
assert.doesNotMatch(adapter, /ldmtlwzqaqmegedktlxr|rest\/v1|supabase\.from|raw\.githubusercontent/);

assert.match(surface, /registerSurface\('territorio'/);
for (const mode of ['Panorama','Comunas','Señales','Entidades','Método']) assert.ok(surface.includes(mode), mode);
assert.match(surface, /BETA_CONTEXTUAL/);
assert.match(surface, /IGR v4 es un indicador territorial beta\/contextual/i);
assert.match(surface, /no se imputa automáticamente como riesgo/i);
assert.match(surface, /faltantes tampoco equivalen a cero/i);
assert.match(surface, /CEAD se usa como contexto territorial/i);
assert.match(surface, /api\.navigate\('entidad'/);
assert.doesNotMatch(surface, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent/);

assert.match(edge, /territory_query/);
assert.match(edge, /atlas_v2_territory_query/);
assert.match(edge, /ATLAS_TERRITORY_QUERY_V2/);
assert.match(edge, /x-atlas-core-authorization/);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*coreAuth/s);
assert.doesNotMatch(edge, /response\(\{[^}]*coreAuth/s);

assert.match(boot, /territory-adapter\.js/);
assert.match(boot, /territory-surface\.js/);
console.log('ATLAS v2 native Territory analytical contract OK');
