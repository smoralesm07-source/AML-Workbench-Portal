import fs from 'node:fs';
import assert from 'node:assert/strict';

const osfl = fs.readFileSync('src/v2/osfl-adapter.js', 'utf8');
const sanctions = fs.readFileSync('src/v2/sanctions-adapter.js', 'utf8');
const html = fs.readFileSync('atlas-v2.html', 'utf8');
const loading = fs.readFileSync('assets/atlas-v2-explore-loading-1.css', 'utf8');
const migration = fs.readFileSync('supabase/core-migrations/20260908130033_optimize_atlas_v2_uaf_sii_attention.sql', 'utf8');

for (const [label, source, operation, contract] of [
  ['OSFL', osfl, 'osfl_query', 'ATLAS_OSFL_QUERY_V2'],
  ['Sanciones', sanctions, 'sanctions_query', 'ATLAS_SANCTIONS_QUERY_V2'],
]) {
  assert.ok(source.includes(`operation: '${operation}'`), `${label}: governed operation missing`);
  assert.ok(source.includes(contract), `${label}: contract missing`);
  assert.match(source, /AtlasV2Access\.getAccessToken/);
  assert.match(source, /AtlasV2Session\.getAccessToken\(async \(\) => coreToken\)/);
  assert.match(source, /x-atlas-core-authorization/);
  assert.doesNotMatch(source, /AtlasV2Session\.getAccessToken\(\s*\)/);
}

assert.ok(html.includes('atlas-v2-explore-loading-1.css?v=explore-loading-1'));
assert.ok(html.includes('osfl-sanctions-federation-2'));
for (const marker of ['Cargando panorama analítico…', '@keyframes atlas-v2-explore-spin', ':has(']) {
  assert.ok(loading.includes(marker), `Explore loading guard missing ${marker}`);
}

assert.ok(migration.includes('create or replace function atlas_v2_private.uaf_sii_attention()'));
assert.ok(migration.includes("'res_detail'"));
assert.doesNotMatch(migration, /res_timeline_event_count|res_last_event_date/);
assert.doesNotMatch(migration, /select\s+s\.\*/i);

new Function(osfl);
new Function(sanctions);
console.log('ATLAS v2 recovered module federation + Explore loading guard: OK');
