import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ui=fs.readFileSync('assets/atlas-reportability-irar.js','utf8');
const css=fs.readFileSync('assets/atlas-reportability-irar.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(ui,/IRAR-UI-1\.5/);
assert.match(ui,/Credibilidad estadística IRAR/);
assert.match(ui,/Number\.isFinite\(Number\(r\.iir\)\)&&Number\(r\.iir\)>=0/,'IIR=0 must remain visible in the profile map');
assert.match(ui,/buildColorLegend/,'profile map must publish a color legend');
assert.match(ui,/Quién reporta más y con qué rendimiento/,'profile map must use plain-language title');
assert.match(ui,/Derecha = más reporte · Arriba = mejor rendimiento/,'profile map must explain the axes in plain language');
assert.match(ui,/clientWidth\|\|1000/,'svg map must measure the live plane width to preserve circular markers');
assert.match(ui,/<circle class="atlas-irar-dot/,'profile points must render as SVG circles');
assert.doesNotMatch(ui,/<button class="atlas-irar-dot/,'empty button markers must not return');
assert.match(css,/\.atlas-irar-svg\{/,'svg canvas styles must exist');
assert.match(css,/\.atlas-irar-color-legend\{/,'color legend styles must exist');
assert.match(css,/\.atlas-irar-dot\{[^}]*cursor:pointer/s,'svg markers must remain interactive');
assert.match(index,/atlas-reportability-irar\.css\?v=0468-6/);
assert.match(index,/atlas-reportability-irar\.js\?v=0468-6/);

const metric={
  iir:.62,
  observed_pct:4.2,
  adjusted_pct:3.8,
  peer_expected_pct:3.1,
  relative_peer:1.23,
  confidence_pct:61,
  confidence_band:'media',
  score:57,
  family:{label:'Familia de prueba'},
  peer_source:'familia_leave_one_out',
  peer_count:5,
  peer_ros:500,
  ranking_eligible:true,
  profile:{key:'COMPORTAMIENTO_ESPERADO',label:'Comportamiento esperado',limited:false}
};
const core={
  version:'IRAR-1.0',
  findMetric:()=>metric,
  profileRead:()=> 'Lectura de prueba.',
  load:async()=>({dataset:{}})
};
const sandbox={
  window:{ATLAS_IRAR_CURRENT:core},
  console,
  V036_HELP:{},
  V036_SEG:{TEST:{label:'Segmento prueba',color:'#3366cc'}},
  v036PrepareRows:()=>[{name:'Sector prueba',seg:'TEST',total:120,raw:{sector_name:'Sector prueba'},marks:[]}],
  v036Dashboard:()=>'<div class="v036-mxhead"><button data-v036-sort="name">Sector</button><button data-v036-sort="so">SO</button><button data-v036-sort="ros">ROS</button><button data-v036-sort="rosPerSo">ROS/SO</button><button data-v036-sort="iir">IIR</button><button data-v036-sort="delta">Delta</button><span>Serie</span><span>Marca</span><span></span></div><h2>Análisis de reportabilidad · silencios por industria</h2><p>Los filtros gobiernan la matriz; cada sector abre un dossier explicativo en el mismo lugar.</p>',
  v036Help:key=>`[${key}]`,
  v036F:v=>String(v),
  esc:v=>String(v)
};
vm.runInNewContext(ui,sandbox,{filename:'atlas-reportability-irar.js'});

const prepared=sandbox.v036PrepareRows({__atlasIrar:{dataset:{}}});
assert.equal(prepared.length,1);
assert.equal(prepared[0].iir,.62,'IRAR overlay must defensively preserve/recover IIR');
assert.equal(prepared[0].irarAdjusted,3.8);
assert.equal(prepared[0].irarCredibility,61);
assert.equal(prepared[0].irarConfidence,61,'legacy confidence alias must remain compatible');

const html=sandbox.v036Dashboard({rows:[]});
const iirPos=html.indexOf('data-v036-sort="iir"');
const irarPos=html.indexOf('data-v036-sort="irarAdjusted"');
const deltaPos=html.indexOf('data-v036-sort="delta"');
assert.ok(iirPos>=0&&irarPos>iirPos&&deltaPos>irarPos,'header order must be IIR → IRAR → delta');
assert.equal((html.match(/data-v036-sort="iir"/g)||[]).length,1,'IIR header must not be duplicated');
assert.equal((html.match(/data-v036-sort="irarAdjusted"/g)||[]).length,1,'IRAR header must appear exactly once');
assert.match(html,/intensidad y rendimiento por industria/);
assert.match(html,/IIR describe intensidad relativa 2025 e IRAR el rendimiento analítico ajustado 2021–2025/);
assert.equal(sandbox.window.ATLAS_IRAR_UI.integration_version,'IRAR-UI-1.5');
assert.equal(sandbox.window.ATLAS_IRAR_UI.credibility_label,'CREDIBILIDAD_IRAR');

console.log('ATLAS IRAR UI integration contract OK');
