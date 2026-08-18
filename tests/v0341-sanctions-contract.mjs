import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx={console,Intl,Date,Map,Set,Math,Number,String,Array,Object,RegExp,URL,Promise,JSON,
  window:{},document:{querySelector:()=>null},loadSanctions:async()=>{},content:()=>({}),state:{},
  fetch:async()=>{throw new Error('not used')},sb:{from(){throw new Error('not used')}}};
vm.createContext(ctx);
const core=fs.readFileSync('v034-sanctions-v12-core.js','utf8');
const ui=fs.readFileSync('v034-sanctions-v12-ui.js','utf8');
const charts=fs.readFileSync('v034-sanctions-v12-charts.js','utf8');
const hard=fs.readFileSync('v0341-sanctions-hardening.js','utf8');
vm.runInContext(`${core}\n${ui}\n${charts}\n${hard}`,ctx,{filename:'sanctions-bundle.js'});

const sample={supervisor:'CMF',fecha:'2026-08-11',resolucion:'8401',sujeto_fuente:'UNIDAD MUTUOS HIPOTECARIOS S.A',rut_fuente:'77342206-0',entity_id:'ENT-RUT-773422060',id:'EVT-0001',source_record_id:'CMF:8401:2026-08-11:77342206-0',evidence_id:'EVD-X',document_status:'partial',document_confidence:0.65,resolution_url:'https://www.cmfchile.cl/x',monto:null,unidad:'',categoria:'Cumplimiento regulatorio',laft_directo:false,resumen:'RUT 77342206-0'};
ctx.__sample=sample;
const e=vm.runInContext('v034NormalizeRaw(__sample)',ctx);
assert.equal(e.rut,'77342206-0');
assert.equal(e.entityId,'ENT-RUT-77342206-0');
assert.equal(e.rawId,'EVT-0001');
assert.equal(e.sourceRecordId,sample.source_record_id);
assert.equal(e.evidenceId,'EVD-X');
assert.equal(e.documentStatus,'partial');
assert.equal(e.sourceUrl,'https://www.cmfchile.cl/x');
ctx.__bad={...sample,resolution_url:'javascript:alert(1)'};
assert.equal(vm.runInContext('v034NormalizeRaw(__bad).sourceUrl',ctx),'');
ctx.__name='CAMERON PARTNERS ADMINISTRADORA DE FONDOS S.A. 210 UF';
assert.equal(vm.runInContext('v0341CleanName(__name)',ctx),'CAMERON PARTNERS ADMINISTRADORA DE FONDOS S.A.');
assert.equal(vm.runInContext('window.AML_SANCTIONS_V12.version',ctx),'0.34.1');
console.log('v034.1 sanctions contract OK');
