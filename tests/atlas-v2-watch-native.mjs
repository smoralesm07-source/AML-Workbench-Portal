import fs from 'node:fs';
import assert from 'node:assert/strict';

const adapter = fs.readFileSync('src/v2/watch-adapter.js', 'utf8');
const surface = fs.readFileSync('src/v2/watch-surface.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');

assert.match(adapter, /operation: 'watch_query'/);
assert.match(adapter, /x-atlas-core-authorization/);
assert.match(adapter, /ATLAS_WATCH_QUERY_V2/);
assert.match(adapter, /AtlasV2Session\.getAccessToken/);
assert.doesNotMatch(adapter, /ldmtlwzqaqmegedktlxr|rest\/v1|supabase\.from|raw\.githubusercontent/);

assert.match(surface, /registerSurface\('vigilancia'/);
for (const mode of ['Resumen','Cambios','Señales','Fuentes','Historial','Método']) assert.ok(surface.includes(mode), mode);
for (const change of ['NEW','CHANGED','REMOVED']) assert.ok(surface.includes(change), change);
assert.match(surface, /BASELINE_ONLY/);
assert.match(surface, /no existe un snapshot anterior comparable/i);
assert.match(surface, /Prioridad ≠ probabilidad/);
assert.match(surface, /Señal ≠ hallazgo/);
assert.match(surface, /seguimiento es opcional/i);
assert.match(surface, /REMOVED significa .*ya no aparece/i);
assert.doesNotMatch(surface, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent/);

// Vigilancia is an analytical read surface, not a workflow authority.
assert.doesNotMatch(surface, /registerSurface\('(casos|tareas|cola|asignaciones|sla)'/i);
assert.doesNotMatch(surface, /assigned_to|owner_id|due_date|closed_at|case_status/i);

assert.match(edge, /watch_query/);
assert.match(edge, /atlas_v2_watch_query/);
assert.match(edge, /ATLAS_WATCH_QUERY_V2/);
assert.match(edge, /x-atlas-core-authorization/);
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*coreAuth/s);
assert.doesNotMatch(edge, /response\(\{[^}]*coreAuth/s);

assert.match(boot, /watch-adapter\.js/);
assert.match(boot, /watch-surface\.js/);
console.log('ATLAS v2 native Vigilance analytical contract OK');
