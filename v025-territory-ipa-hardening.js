'use strict';

/* v0.25.0 hardening: missing IPA regions never enter the percentile as zero. */
const v025HardBaseLoadRaw=v022LoadRaw;
const v025HardBaseCompute=v022Compute;

v022LoadRaw=async function(){
  const raw=await v025HardBaseLoadRaw();
  raw.sourceStatus={...(raw.sourceStatus||{}),ipa:Array.isArray(raw.ipaRegion)&&raw.ipaRegion.length>0};
  return raw;
};

function v025StrictPercentile(rows,valueFn,assign){
  const valid=rows.map(r=>({r,v:valueFn(r)})).filter(x=>x.v!==null&&x.v!==undefined&&Number.isFinite(Number(x.v))).map(x=>({...x,v:Number(x.v)})).sort((a,b)=>a.v-b.v);
  for(const r of rows)assign(r,null);
  if(!valid.length)return;
  const groups=new Map();
  valid.forEach((x,i)=>{const k=String(x.v);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
  for(const x of valid){const inds=groups.get(String(x.v));const rank=inds.reduce((s,i)=>s+i,0)/inds.length;assign(x.r,valid.length===1?50:100*rank/(valid.length-1));}
}

v022Compute=function(raw){
  const computed=v025HardBaseCompute(raw);
  v025StrictPercentile(computed.regions,r=>r.ipa?.ipa_pressure_mean_all,(r,p)=>{r.ipa_percentile=p;});
  for(const r of computed.regions){
    if(r.ipa&&Number.isFinite(Number(r.ipa_percentile))){r.ipa.score=r.ipa_percentile;r.parts.ipa=r.ipa_percentile;}else{r.parts.ipa=null;if(r.ipa)r.ipa.score=null;}
    r.scores.B=v022Weighted(r.parts,V025_B_REGION_WEIGHTS);
    r.score_b_ipa_delta=Number.isFinite(Number(r.scores.B))&&Number.isFinite(Number(r.score_b_without_ipa))?r.scores.B-r.score_b_without_ipa:null;
    r.primary_driver=v025PrimaryDriver(r.parts);
    r.elevated_components=v025Elevated(r.parts);
    r.coverage=v025RegionCoverage(r.parts,raw);
    r.confidence=r.coverage>=90?'ALTA':r.coverage>=75?'MEDIA':'BAJA';
    r.fit_for_secure_matrix=r.coverage>=80&&['sector','cead','budget','cgr','ipa'].every(k=>Number.isFinite(Number(r.parts[k])));
    r.export_status=r.fit_for_secure_matrix?'APTO':'PROVISIONAL_NO_APTO';
  }
  return computed;
};
