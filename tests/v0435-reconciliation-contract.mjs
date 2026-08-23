import fs from 'node:fs';
import assert from 'node:assert/strict';

const command=fs.readFileSync('v0434-reconciliation-command.js','utf8');
const hardening=fs.readFileSync('v0435-reconciliation-fix.js','utf8');
const css=fs.readFileSync('v0434-reconciliation-command.css','utf8');
const sql=fs.readFileSync('sql/atlas_v0434_uaf_sii_reconciliation_analytics.sql','utf8');
const manifest=JSON.parse(fs.readFileSync('atlas-runtime-manifest.json','utf8'));
const release=JSON.parse(fs.readFileSync('atlas-release.json','utf8'));
const build=JSON.parse(fs.readFileSync('build.json','utf8'));

// The reconciliation feature remains valid across future ATLAS releases.
assert.equal(release.release,manifest.release);
assert.equal(release.release,build.app_version);
assert.equal(release.build,manifest.build);
assert.equal(release.build,build.build);

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

// Current 0.44.0 hardening: preserve governed year filtering while shedding load.
for(const needle of [
  "const RELEASE='0.44.0',BUILD='0440'",
  'let navigationToken=0',
  "state?.view==='reconciliation'",
  'safeRows(',
  'COUNT_TTL=5*60*1000',
  '__unavailable:true',
  "eq('termination_year',Number(s.year))",
  "sb.from(V0434_YEAR_VIEW).select('termination_year,entity_count')",
  'q=q.order(',
  '.range(from,to)',
  's.__hasNext=rows.length>V0434_PAGE_SIZE',
  'if(!counts.__unavailable)',
  'renderFatal(error,token)',
  'parallelExactCounts:false',
  'pageExactCount:false',
  'secondaryConcurrency:1'
]) assert.ok(hardening.includes(needle),`missing reconciliation load-shedding contract: ${needle}`);

// Regression guard for the production race seen as: Sanciones header + Conciliación error.
const shellPos=hardening.indexOf("shell('Conciliación UAF ↔ SII'");
const metaPos=hardening.indexOf('await v0434LoadMeta()',shellPos);
assert.ok(shellPos>=0&&metaPos>shellPos,'Conciliación shell must render before async metadata load');
assert.ok(hardening.includes('error.message,error.details,error.hint,error.code'),'structured Supabase errors must be surfaced');
assert.ok(!hardening.includes('e?.message||e'),'legacy [object Object] fallback must not remain in hotfix authority');
assert.ok(hardening.includes('await v0434LoadMeta();if(!isCurrent(token))return;'),'stale metadata response must be rejected');
assert.ok(hardening.includes('await v0434RenderPage();if(!isCurrent(token))return;'),'stale page response must be rejected');
assert.ok(hardening.includes('renderFatal(error,token)'),'fatal errors must be view-scoped');

// Sequential aggregate loading is deliberate under backend pressure.
const sectorsPos=hardening.indexOf('const sectors=await safeRows');
const yearsPos=hardening.indexOf('const years=await safeRows');
const matrixPos=hardening.indexOf('matrix=await safeRows');
assert.ok(sectorsPos>=0&&yearsPos>sectorsPos&&matrixPos>yearsPos,'secondary reconciliation aggregates must remain sequential');

assert.ok(!command.includes("script-src 'unsafe-inline'"));
assert.ok(css.includes('var(--atlas-accent-hi)'));
assert.ok(css.includes('.v0434-matrix'));
assert.ok(css.includes('.v0434-candidate-layout'));
assert.ok(sql.includes('security_invoker = true'));
assert.ok(sql.includes('grant select on public.aml_v0434_uaf_sii_sector to authenticated'));

const styleCommand=manifest.styles.indexOf('v0434-reconciliation-command.css');
const styleFix=manifest.styles.indexOf('v0435-reconciliation-fix.css');
assert.ok(styleCommand>=0&&styleFix>styleCommand,'reconciliation CSS order must be preserved');
const scriptCommand=manifest.scripts.findIndex(x=>x.path==='v0434-reconciliation-command.js');
const scriptFix=manifest.scripts.findIndex(x=>x.path==='v0435-reconciliation-fix.js');
assert.ok(scriptCommand>=0&&scriptFix>scriptCommand,'reconciliation JS order must be preserved');
assert.ok(manifest.scripts.some(x=>x.path==='atlas-sanctions-v12-route.js'));
assert.match(build.reconciliation_candidate_policy,/PRESELECTION_NOT_LEGAL_STATUS/);
assert.match(build.reconciliation_runtime_guard,/VIEW_SCOPED_TOKEN/);
assert.match(build.reconciliation_runtime_guard,/FAIL_SOFT_AGGREGATES/);
assert.match(release.reconciliation_policy,/VIEW_SCOPED_ASYNC_GUARD/);

console.log(`ATLAS reconciliation current contract OK under release ${release.release}/${release.build}`);
