'use strict';
/* ATLAS AML · IRAR-E current authority 1.0
 * Risk inherent sectorial: 40% structural vulnerability + 30% materiality + 30% LA/FT/FP threat.
 * All three components are mandatory. Missing != 0; weights are never renormalized.
 * IRAR (ROS analytical yield) remains a separate reportability diagnostic and never feeds IRAR-E.
 */
(function atlasIrarECurrent(){
  if(window.ATLAS_IRAR_E_CURRENT)return;
  const VERSION='IRAR-E-1.0';
  const SNAPSHOT='./data/irar_e_sector_snapshot_v1.json';
  let loadPromise=null;
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const clamp=v=>finite(v)?Math.max(0,Math.min(100,Number(v))):null;
  function norm(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
      .replace(/N[°º]/g,'N').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim()
      .replace(/COMPANIAS DE SEGURO$/g,'COMPANIAS DE SEGUROS')
      .replace(/EMPRESAS DE DEPOSITO DE VALORES REGIDAS POR LA LEY N 18 876/g,'EMPRESAS DE DEPOSITOS DE VALORES REGIDAS POR LA LEY N 18 876')
      .replace(/ORGANIZACIONES DEPORTIVAS PROFESIONALES REGIDAS POR LEY 20 019/g,'ORGANIZACIONES DEPORTIVAS PROFESIONALES REGIDAS POR LA LEY N 20 019')
      .replace(/ADMINISTRADORAS DE FONDOS DE PENSIONES AFP/g,'ADMINISTRADORAS DE FONDOS DE PENSIONES');
  }
  function compute({vulnerability,materiality,threat}={}){
    if(![vulnerability,materiality,threat].every(finite))return null;
    return Math.round((.40*clamp(vulnerability)+.30*clamp(materiality)+.30*clamp(threat))*10)/10;
  }
  function enrich(row){
    if(!row)return null;
    const vulnerability=clamp(row.v),materiality=clamp(row.m),threat=clamp(row.t);
    const score=compute({vulnerability,materiality,threat});
    const missing=[];if(vulnerability===null)missing.push('vulnerabilidad');if(materiality===null)missing.push('materialidad');if(threat===null)missing.push('amenaza');
    return {...row,key:norm(row.name),vulnerability,materiality,threat,score,status:score===null?'INCOMPLETE':'READY',missing};
  }
  function build(snapshot){
    const rows=(Array.isArray(snapshot?.sectors)?snapshot.sectors:[]).map(enrich);
    const byKey=new Map(rows.map(r=>[r.key,r]));
    return {snapshot,rows,byKey,coverage:snapshot?.coverage||{},version:snapshot?.version||'1.0.0'};
  }
  function findMetric(name,dataset){
    if(!dataset)return null;const key=norm(name);if(dataset.byKey?.has(key))return dataset.byKey.get(key);
    let best=null,bestLen=0;
    for(const r of dataset.rows||[]){
      if(!r?.key||r.key.length<8||key.length<8)continue;
      if(r.key.includes(key)||key.includes(r.key)){const len=Math.min(r.key.length,key.length);if(len>bestLen){best=r;bestLen=len;}}
    }
    return best;
  }
  async function load(){
    if(loadPromise)return loadPromise;
    loadPromise=fetch(SNAPSHOT,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`IRAR-E snapshot ${r.status}`);return r.json();}).then(snapshot=>({snapshot,dataset:build(snapshot)}));
    try{return await loadPromise;}catch(error){loadPromise=null;throw error;}
  }
  window.ATLAS_IRAR_E_CURRENT={
    version:VERSION,acronym:'IRAR-E',name:'Riesgo inherente sectorial',snapshot_url:SNAPSHOT,
    formula:'0.40*V + 0.30*M + 0.30*T',weights:{vulnerability:.40,materiality:.30,threat:.30},
    normalize:norm,compute,build,findMetric,load,
    policy:{allComponentsRequired:true,missingIsNotZero:true,noWeightRenormalization:true,irarExcluded:true,notEntityRisk:true,notCompliance:true},
    guardrail:'SECTOR_INHERENT_RISK_NOT_ENTITY_RISK_NOT_COMPLIANCE_ALL_COMPONENTS_REQUIRED'
  };
})();
