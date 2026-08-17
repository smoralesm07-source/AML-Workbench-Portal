'use strict';

/* v0.20.1 hardening: semantic dedupe, context cache and visible version. */
const V0201_CONTEXT_CACHE=new Map();
const v0201BaseFindingContext=v0201FindingContext;
const v0201BaseShell=shell;

shell=function(title,subtitle){
  v0201BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0201}`;
};

function v0201AnomalyCategory(label){
  const k=v0201Norm(label);
  if(k.includes('DOMICIL'))return 'ADDRESS';
  if(k.includes('TRAMO')&&k.includes('VENT'))return 'SALES_BAND';
  if(k.includes('DOTACION')||k.includes('WORKFORCE'))return 'WORKFORCE';
  if(k.includes('ACTIVIDAD PRINCIPAL'))return 'MAIN_ACTIVITY';
  if(k.includes('UAF')&&k.includes('SII'))return 'UAF_SII_ACTIVITY';
  if(k.includes('ACTIVIDADES REGISTRADAS'))return 'ACTIVITY_BREADTH';
  if(k.includes('REGION'))return 'REGION';
  if(k.includes('REACTIV'))return 'REACTIVATION';
  if(k.includes('CAPITAL')&&k.includes('NEGAT'))return 'NEGATIVE_EQUITY';
  return k;
}

v0201AnomalyItems=function(f,related,tax){
  const out=[],seen=new Set();
  const add=label=>{const s=String(label||'').trim(),cat=v0201AnomalyCategory(s);if(s&&!seen.has(cat)){seen.add(cat);out.push(s);}};
  for(const row of related||[]){if(row.finding_type==='CONTEXTUAL_ANOMALY')v0201ParseAnomalyText(row.payload?.explanation).forEach(add);}
  if(f.finding_type==='CONTEXTUAL_ANOMALY')v0201ParseAnomalyText(f.payload?.explanation).forEach(add);
  v0201TaxSignals(tax).forEach(add);
  return out;
};

v0201FindingContext=async function(f){
  if(!f?.entity_id)return v0201BaseFindingContext(f);
  if(V0201_CONTEXT_CACHE.has(f.entity_id))return V0201_CONTEXT_CACHE.get(f.entity_id);
  const promise=v0201BaseFindingContext(f).catch(()=>({related:[f],tax:null,sanctions:[]}));
  V0201_CONTEXT_CACHE.set(f.entity_id,promise);
  return promise;
};
