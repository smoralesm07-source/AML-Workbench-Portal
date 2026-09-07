import fs from 'node:fs';
import assert from 'node:assert/strict';

const data = fs.readFileSync('src/v2/atlas-v2-data.js', 'utf8');
const surface = fs.readFileSync('src/v2/relations-surface.js', 'utf8');
const boot = fs.readFileSync('src/v2/atlas-v2-boot.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/atlas-v2-read/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260907023000_atlas_v2_relations_query.sql', 'utf8');

assert.match(data, /governedQuery\('relations_query', 'ATLAS_RELATIONS_QUERY_V2'/);
assert.match(data, /const relations = Object\.freeze/);
assert.match(data, /function relationFocus/);
assert.match(data, /hasExplicitId/);
assert.match(data, /neighborhood:/);
assert.match(data, /convergences:/);
assert.match(data, /hypotheses:/);
assert.match(data, /detail:/);

assert.match(surface, /registerSurface\('relaciones'/);
assert.match(surface, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg'/);
assert.match(surface, /Documentada · vínculo observado/);
assert.match(surface, /Convergencia · señales sobre un vínculo/);
assert.match(surface, /Hipótesis · no es arista hasta corroboración/);
assert.match(surface, /No se concilian identidades por similitud de nombre/);
assert.match(surface, /nunca transfiere riesgo automáticamente entre nodos/);
assert.match(surface, /api\.navigate\('entidad'/);
assert.match(surface, /api\.navigate\('gasto-publico'/);
assert.doesNotMatch(surface, /innerHTML|MutationObserver|supabase\.from|rest\/v1|raw\.githubusercontent/);
assert.doesNotMatch(surface, /risk.*propagat|inherit.*risk|transfer.*score/i);

assert.match(boot, /relations-surface\.js/);
assert.match(edge, /relations_query/);
assert.match(edge, /atlas_v2_relations_query/);
assert.match(edge, /ATLAS_RELATIONS_QUERY_V2/);

assert.match(migration, /atlas_v2_private\.is_allowed\(\)/);
assert.match(migration, /relation_class','DOCUMENTED'/);
assert.match(migration, /relation_class','CONVERGENCE'/);
assert.match(migration, /'hypothesis_is_edge',false/);
assert.match(migration, /'identity_inference','DISABLED'/);
assert.match(migration, /'risk_inheritance',false/);
assert.match(migration, /revoke all on function public\.atlas_v2_relations_query\(jsonb\) from public, anon/);
assert.match(migration, /grant execute on function public\.atlas_v2_relations_query\(jsonb\) to authenticated, service_role/);
assert.doesNotMatch(migration, /grant execute .* to anon/i);

console.log('ATLAS v2 native Relations analytical contract OK');
