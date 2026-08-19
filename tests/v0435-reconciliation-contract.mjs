import fs from 'node:fs';
import assert from 'node:assert/strict';

const command=fs.readFileSync('v0434-reconciliation-command.js','utf8');
const hardening=fs.readFileSync('v0435-reconciliation-fix.js','utf8');
const css=fs.readFileSync('v0434-reconciliation-command.css','utf8');
const sql=fs.readFileSync('sql/atlas_v0434_uaf_sii_reconciliation_analytics.sql','utf8');
const manifest=JSON.parse(fs.readFileSync('atlas-runtime-manifest.json','utf8'));
const release=JSON.parse(fs.readFileSync('atlas-release.json','utf8'));
const build=JSON.parse(fs.readFileSync('build.json','utf8'));

assert.equal(release.release,'0.43.6');
assert.equal(release.build,'0436');
assert.equal(manifest.release,'0.43.6');
assert.equal(manifest.build,'0436');
assert.equal(build.app_version,'0.43.6');
assert.equal(build.build,'0436');

for(const needle of [
  'aml_v0434_uaf_sii_sector',
  'aml_v0434_uaf_sii_sector_matrix',
  'aml_v0210_uaf_sii_reconciliation',
  'aml_v019_gap_sector',
  'uaf_sii_screening_policy.csv',
  "candidate_use||'').toUpperCase()==='SI'",
  "eq('is_uaf_observed',false)",
  'Entity 360',
  'Potenciales SO',
  'Situación tributaria',
  'Términos de giro'
]) assert.ok(command.includes(needle),`missing reconciliation contract: ${needle}`);

assert.ok(command.includes('no prueba')||command.includes('no prueban'));
assert.ok(command.includes('no son SO confirmados'));
assert.ok(command.includes('no equivale a inexistencia en SII'));
assert.ok(hardening.includes("eq('termination_year',Number(s.year))"));
assert.ok(hardening.includes('GOVERNED_TERMINATION_YEAR'));
assert.ok(hardening.includes('RADAR_SII_CANDIDATE_USE_SI_ONLY'));
assert.ok(hardening.includes("release='0.43.6'"));
assert.ok(!command.includes("script-src 'unsafe-inline'"));
assert.ok(css.includes('var(--atlas-accent-hi)'));
assert.ok(css.includes('.v0434-matrix'));
assert.ok(css.includes('.v0434-candidate-layout'));
assert.ok(sql.includes('security_invoker = true'));
assert.ok(sql.includes('grant select on public.aml_v0434_uaf_sii_sector to authenticated'));
assert.ok(manifest.styles.at(-2)==='v0434-reconciliation-command.css');
assert.ok(manifest.styles.at(-1)==='v0435-reconciliation-fix.css');
assert.ok(manifest.scripts.at(-2).path==='v0434-reconciliation-command.js');
assert.ok(manifest.scripts.at(-1).path==='v0435-reconciliation-fix.js');
assert.ok(manifest.scripts.some(x=>x.path==='atlas-sanctions-v12-route.js'));
assert.match(build.reconciliation_candidate_policy,/PRESELECTION_NOT_LEGAL_STATUS/);
assert.match(release.reconciliation_policy,/ENTITY360_VALIDATION/);

console.log('ATLAS reconciliation 0.43.6 contract OK');
