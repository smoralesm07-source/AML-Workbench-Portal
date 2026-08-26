import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const js=read('assets/atlas-indicator-methodology-0910.js');
const css=read('assets/atlas-indicator-methodology-0910.css');
const route=read('assets/atlas-operational-recovery-0704.js');
const territory=read('assets/territorio-igr-real-beta-v4.html');
const doc=read('docs/atlas-indicator-architecture-v1.md');
const registry=JSON.parse(read('data/atlas_indicator_methodology_v1.json'));

assert.equal(registry.schema,'ATLAS_INDICATOR_METHODOLOGY_V1');
assert.equal(registry.presentation_policy.ipa_display_name,'IPA');
assert.ok(registry.presentation_policy.ipa_technical_aliases.includes('IPA3'));
assert.equal(registry.indicators.IRAR.name,'Índice de Rendimiento Analítico de ROS');
assert.equal(registry.indicators.IRAR_E.name,'Riesgo inherente sectorial');
assert.notEqual(registry.indicators.IRAR.name,registry.indicators.IRAR_E.name);
assert.deepEqual(registry.indicators.IRAR_E.weights,{vulnerabilidad_estructural:.40,materialidad:.30,amenaza_laft_fp:.30});
assert.deepEqual(registry.indicators.PRIORIDAD_FISCALIZACION.excluded_inputs,['IVO']);
assert.match(registry.indicators.IPA.methodology,/No estima probabilidad de LA\/FT/i);
assert.match(registry.indicators.IVO.methodology,/no mide riesgo LA\/FT/i);
assert.match(registry.indicators.MITIGACION.status,/NO_SCORE_UNTIL_COVERAGE/);

assert.match(js,/replace\(\/\\bIPA3\\b\/g,'IPA'\)/);
assert.match(js,/technicalAliases:\{IPA:\['IPA3','ipa3','ipa3_\*'\]\}/);
assert.match(js,/\.40\*score\(vulnerability\)\+\.30\*score\(materiality\)\+\.30\*score\(threat\)/);
assert.match(js,/100\*p\/d/);
assert.match(js,/Math\.abs\(total-1\)>\.0001/);
assert.doesNotMatch(js,/new\s+MutationObserver\s*\(/);
assert.doesNotMatch(js,/\.createTreeWalker\s*\(/);
assert.match(js,/noBodyTreeWalk:true/);

assert.match(route,/ensureIndicatorMethodology/);
assert.match(route,/atlas-indicator-methodology-0910\.js/);
assert.match(route,/AtlasIndicatorMethodologyV1\?\.refresh/);
assert.match(territory,/atlas-indicator-methodology-0910\.css/);
assert.match(territory,/atlas-indicator-methodology-0910\.js/);
assert.match(territory,/AtlasIndicatorMethodologyV1\?\.refresh/);
assert.match(css,/\[data-atlas-indicator-key\]::after/);
assert.match(css,/atlas-indicator-methodology-tip/);
assert.match(doc,/IRAR-E = 0,40/);
assert.match(doc,/IPA3.*aliases técnicos/i);
assert.match(doc,/missing != 0/);
assert.match(doc,/Prioridad de Fiscalización = f\(IRAR-E, IGR, IPA, debilidad mitigadora\)/);

console.log('atlas-indicator-methodology-0910: OK');
