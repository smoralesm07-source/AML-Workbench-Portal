import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('atlas-reportability-current.js','utf8');
const manifest=JSON.parse(fs.readFileSync('atlas-runtime-manifest.json','utf8'));
const release=JSON.parse(fs.readFileSync('atlas-release.json','utf8'));
const build=JSON.parse(fs.readFileSync('build.json','utf8'));

assert.equal(release.release,manifest.release);
assert.equal(release.release,build.app_version);
assert.equal(release.build,manifest.build);
assert.equal(release.build,build.build);
const authority=manifest.scripts.find(x=>x.path==='atlas-reportability-current.js');
assert.ok(authority,'reportability methodology authority must remain in runtime manifest');
assert.equal(authority.role,'reportability-methodology-current-authority');

for(const needle of [
  "rosPerSo:so?ros/so:0",
  "iir:shareSO?shareROS/shareSO:0",
  "data-v036-sort=\"rosPerSo\">ROS/SO",
  "data-v036-sort=\"iir\">IIR",
  "IIR = %ROS / %SO",
  "legacy_ros_per_100:'TRACEABILITY_ONLY'",
  "SECTOR_COMPARISON_NOT_RISK_OR_COMPLIANCE",
  "muy_bajo",
  "proporcional",
  "muy_alto"
]) assert.ok(js.includes(needle),`missing reportability contract: ${needle}`);

assert.match(release.reportability_policy,/ROS_PER_SO_PRIMARY/);
assert.match(release.reportability_policy,/IIR_SHARE_ROS_OVER_SHARE_SO/);
assert.match(build.radar_integrado_reportability_metrics,/LEGACY_ROS_PER_100_TRACEABILITY_ONLY/);
assert.match(build.radar_integrado_iir_guardrail,/NOT_RISK/);

// Governed source example: Casinos de Juego, 2025.
const so=25,ros=285,totalSO=9911,totalROS=21828;
const rosPerSo=ros/so;
const iir=(ros/totalROS)/(so/totalSO);
assert.equal(rosPerSo,11.4);
assert.ok(Math.abs(iir-5.176168224299065)<1e-12);
assert.ok(iir>3,'Casinos should be classified as very high relative intensity, not proportional');

console.log(`ATLAS reportability contract OK under release ${release.release}/${release.build}`);
