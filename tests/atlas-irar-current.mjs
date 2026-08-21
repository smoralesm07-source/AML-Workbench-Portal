import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-irar-current.js','utf8');
const sandbox={window:{},console,fetch:async()=>{throw new Error('fetch not expected in unit test')}};
vm.runInNewContext(js,sandbox,{filename:'atlas-irar-current.js'});
const core=sandbox.window.ATLAS_IRAR_CURRENT;
assert.ok(core,'IRAR authority must be exposed');
assert.equal(core.version,'IRAR-1.0');
assert.match(core.guardrail,/NOT_COHORT_CONVERSION/);

const sectors=[
  ['Vehículos: Automotoras',17,1,7],
  ['Vehículos: Comercializadoras de Vehículos Nuevos o Usados',413,101,163],
  ['Vehículos: Empresas de Arriendo de Vehículos',41,8,9],
  ['Comerciantes de Joyas y Piedras Preciosas',25,8,8],
  ['Comerciantes de Metales Preciosos',9,80,82],
  ['Casas de Remate y Martillo',287,3,10],
  ['Bancos',17,14103,43101],
  ['Instituciones Financieras',50,114,256],
  ['Cooperativas de Ahorro y Crédito',47,366,938],
  ['Cajas de Compensación',4,982,4175],
  ['Empresas de Factoraje (Factoring)',188,155,349],
  ['Empresas de Arrendamiento Financiero (Leasing)',63,29,113],
  ['Casinos de Juego',25,285,1105],
  ['Hipódromos',6,7,32]
];
const indications={
  'VEHÍCULOS: AUTOMOTORAS':1,
  'VEHÍCULOS: COMERCIALIZADORAS DE VEHÍCULOS NUEVOS O USADOS':1,
  'VEHÍCULOS: EMPRESAS DE ARRIENDO DE VEHÍCULOS':0,
  'COMERCIANTES DE JOYAS Y PIEDRAS PRECIOSAS':0,
  'COMERCIANTES DE METALES PRECIOSOS':0,
  'CASAS DE REMATE Y MARTILLO':1,
  'BANCOS':2339,
  'INSTITUCIONES FINANCIERAS':5,
  'COOPERATIVAS DE AHORRO Y CRÉDITO':18,
  'CAJAS DE COMPENSACIÓN':1,
  'EMPRESAS DE FACTORAJE (FACTORING)':27,
  'EMPRESAS DE ARRENDAMIENTO FINANCIERO (LEASING)':16,
  'CASINOS DE JUEGO':818,
  'HIPÓDROMOS':4
};
const report={
  totals:{registered_so_2025:sectors.reduce((a,x)=>a+x[1],0),ros_2025:sectors.reduce((a,x)=>a+x[2],0)},
  sectors:sectors.map(([sector_name,registered_so_2025,ros_2025,ros_total_2021_2025])=>({sector_name,registered_so_2025,ros_2025,ros_total_2021_2025}))
};
const conversion={sectors:Object.entries(indications).map(([sector_name,ros_con_indicios_total_2021_2025])=>({sector_name,ros_con_indicios_total_2021_2025}))};
const data=core.buildDataset(report,conversion);

const auto=core.findMetric('Vehículos: Automotoras',data);
assert.ok(auto);
assert.ok(Math.abs(auto.observed_pct-(100/7))<1e-10);
// Peers in BIENES_ALTO_VALOR excluding Automotoras: 272 ROS and 2 indications.
const peerRate=2/272;
const expectedAdjusted=100*(1+100*peerRate)/(7+100);
assert.ok(Math.abs(auto.peer_expected_pct-100*peerRate)<1e-10);
assert.ok(Math.abs(auto.adjusted_pct-expectedAdjusted)<1e-10);
assert.ok(Math.abs(auto.confidence_pct-100*7/107)<1e-10);
assert.equal(auto.peer_source,'familia_leave_one_out');
assert.equal(auto.confidence_band,'baja');
assert.equal(auto.ranking_eligible,false);
assert.ok(auto.adjusted_pct<auto.observed_pct,'small samples should shrink toward peers');

const bank=core.findMetric('Bancos',data);
assert.ok(bank.confidence_pct>99.7,'large-volume banking result should remain data-dominated');
assert.ok(Math.abs(bank.adjusted_pct-bank.observed_pct)<0.1,'large-volume adjustment should be small');

const hip=core.findMetric('Hipódromos',data);
assert.equal(hip.peer_source,'nacional_leave_one_out','two-sector gaming family must fall back instead of borrowing only from Casinos');

const low=core.relativeScore(4,0.02),high=core.relativeScore(4,0.95);
assert.ok(Math.abs(low-50)<Math.abs(high-50),'credibility must neutralize low-volume extremes');
assert.equal(core.profileFor(2,1.5,.9).key,'INTENSIVO_PRODUCTIVO');
assert.equal(core.profileFor(.5,1.5,.9).key,'SELECTIVO_PRODUCTIVO');
assert.equal(core.profileFor(2,.5,.9).key,'INTENSIVO_BAJO_RENDIMIENTO');
assert.equal(core.profileFor(.5,.5,.9).key,'BAJA_ACTIVACION');
assert.equal(core.profileFor(1,1,.9).key,'COMPORTAMIENTO_ESPERADO');

console.log('ATLAS IRAR-1.0 contract OK');
