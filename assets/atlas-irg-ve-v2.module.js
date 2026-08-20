'use strict';
/* ATLAS AML · IRG V/E v2 · IRG-LAFT-0.33.0
 * Evolves only the internal Vulnerabilidad/Exposición component.
 * Top-level IRG weights remain 45/20/20/15.
 */
const ATLAS_VE2_METHOD='IRG-LAFT-0.33.0';
const ATLAS_VE2_CONFIG='./data/irg_ve_enrichment_v2.json';
const ATLAS_VE2_ICR='https://raw.githubusercontent.com/smoralesm07-source/Radar_UAF/main/docs/data/ros_conversion_sector_2021_2025.json';
const ATLAS_VE2_REPORT='https://raw.githubusercontent.com/smoralesm07-source/Radar_UAF/main/docs/data/reportability_sector_2025.json';
let atlasVe2InputsPromise=null;
let atlasVe2Applying=false;

function atlasVe2Norm(v){
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/N[°º]/g,'N').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim()
    .replace(/ADMINISTRADORAS DE FONDOS DE PENSIONES(?: AFP)?/g,'ADMINISTRADORES DE FONDOS DE PENSIONES')
    .replace(/EMPRESAS DE DEPOSITOS DE VALORES/g,'EMPRESAS DE DEPOSITO DE VALORES')
    .replace(/COMPANIAS DE SEGURO$/g,'COMPANIAS DE SEGUROS');
}
function atlasVe2Tokens(v){
  const stop=new Set(['DE','DEL','LA','LAS','LOS','Y','O','U','EL','EN','POR','PARA','CON','REGIDAS','LEY']);
  return new Set(atlasVe2Norm(v).split(' ').filter(x=>x.length>1&&!stop.has(x)));
}
function atlasVe2Similarity(a,b){
  const A=atlasVe2Tokens(a),B=atlasVe2Tokens(b);if(!A.size||!B.size)return 0;
  let inter=0;for(const x of A)if(B.has(x))inter++;
  return inter/Math.max(A.size,B.size);
}
function atlasVe2Finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function atlasVe2Clamp(v,a=0,b=100){return atlasVe2Finite(v)?Math.max(a,Math.min(b,Number(v))):null;}
function atlasVe2Fmt(v,d=1){return atlasVe2Finite(v)?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function atlasVe2Pct(v,d=1){return atlasVe2Finite(v)?`${atlasVe2Fmt(v,d)}%`:'—';}
function atlasVe2Esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function atlasVe2FetchJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();}
function atlasVe2LoadInputs(){
  if(atlasVe2InputsPromise)return atlasVe2InputsPromise;
  atlasVe2InputsPromise=Promise.allSettled([atlasVe2FetchJson(ATLAS_VE2_CONFIG),atlasVe2FetchJson(ATLAS_VE2_ICR),atlasVe2FetchJson(ATLAS_VE2_REPORT)]).then(([cfg,icr,report])=>{
    if(cfg.status!=='fulfilled')throw cfg.reason||new Error('Configuración V/E v2 no disponible');
    return {config:cfg.value,icr:icr.status==='fulfilled'?icr.value:null,report:report.status==='fulfilled'?report.value:null,status:{config:true,icr:icr.status==='fulfilled',report:report.status==='fulfilled'}};
  });
  return atlasVe2InputsPromise;
}

function atlasVe2FindRow(sector,dataset){
  const rows=Array.isArray(dataset)?dataset:[];
  const candidates=[sector?.sector_name,...(sector?.aliases||[])].filter(Boolean);
  const keys=candidates.map(atlasVe2Norm);
  for(const row of rows){if(keys.includes(atlasVe2Norm(row.sector_name)))return row;}
  let best=null,score=0;
  for(const row of rows){
    for(const c of candidates){const s=atlasVe2Similarity(c,row.sector_name);if(s>score){score=s;best=row;}}
  }
  return score>=0.72?best:null;
}
function atlasVe2PercentilePairs(pairs){
  const valid=pairs.filter(x=>atlasVe2Finite(x.value)).sort((a,b)=>Number(a.value)-Number(b.value));
  const out=new Map();if(!valid.length)return out;
  const groups=new Map();valid.forEach((x,i)=>{const k=String(Number(x.value));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
  for(const x of valid){const is=groups.get(String(Number(x.value))),rank=is.reduce((a,i)=>a+i,0)/is.length;out.set(x.key,valid.length===1?50:100*rank/(valid.length-1));}
  return out;
}
function atlasVe2RuleStrength(name,patterns){
  const n=atlasVe2Norm(name);let best=0;
  for(const p of patterns||[]){if(n.includes(atlasVe2Norm(p.contains)))best=Math.max(best,Number(p.strength)||0);}
  return best;
}
function atlasVe2EnrScore(sector,cfg){
  const names=[sector.sector_name,...(sector.aliases||[])].join(' | '),enr=cfg.enr||{};let weighted=0;
  for(const d of enr.dimensions||[])weighted+=(Number(d.weight)||0)*atlasVe2RuleStrength(names,d.patterns);
  const baseline=Number(enr.baseline_score)||0;return atlasVe2Clamp(baseline+(100-baseline)*weighted);
}
function atlasVe2Gafilat(sector,cfg){
  const names=atlasVe2Norm([sector.sector_name,...(sector.aliases||[])].join(' | '));
  for(const tier of cfg.gafilat?.tiers||[]){
    if(!(tier.patterns||[]).length)return {score:Number(tier.score)||25,label:tier.label||'Resto de sectores'};
    if((tier.patterns||[]).some(p=>names.includes(atlasVe2Norm(p))))return {score:Number(tier.score)||25,label:tier.label||''};
  }
  return {score:25,label:'Resto de sectores'};
}
function atlasVe2BuildSectorScores(computed,inputs){
  const cfg=inputs.config,cat=[...(computed?.catalog?.byId?.values?.()||[])];
  const icrRows=inputs.icr?.sectors||[],reportRows=inputs.report?.sectors||[];
  const totalInd=Number(inputs.icr?.totals?.ros_con_indicios_total_2021_2025)||0;
  const totalSent=Number(inputs.report?.totals?.ros_total_2021_2025)||0;
  const priorRate=totalSent>0?totalInd/totalSent:0.06,priorStrength=Number(cfg.icr?.prior_strength_ros)||100;
  const temp=[];
  for(const c of cat){
    const sentRow=atlasVe2FindRow(c,reportRows),indRow=atlasVe2FindRow(c,icrRows);
    const sent=Number(sentRow?.ros_total_2021_2025),ind=Number(indRow?.ros_con_indicios_total_2021_2025);
    const hasSent=Number.isFinite(sent)&&sent>0,hasInd=Number.isFinite(ind);
    const post=hasSent?(Math.max(0,hasInd?ind:0)+priorStrength*priorRate)/(sent+priorStrength):null;
    temp.push({c,sent:hasSent?sent:0,ind:hasInd?Math.max(0,ind):null,post});
  }
  const icrPct=atlasVe2PercentilePairs(temp.filter(x=>x.sent>0).map(x=>({key:x.c.uaf_sector_id,value:x.post})));
  for(const x of temp){
    const c=x.c,base=atlasVe2Clamp(c.risk_0_100),enr=atlasVe2EnrScore(c,cfg),gf=atlasVe2Gafilat(c,cfg);
    const icrScore=x.sent>0?(icrPct.get(c.uaf_sector_id)??50):Number(cfg.icr?.neutral_score_without_sent_ros)||50;
    const rawIcr=x.sent>0&&x.ind!==null?100*x.ind/x.sent:null,postIcr=x.sent>0?100*x.post:null;
    const w=cfg.formula?.sector_core||{};
    const composite=atlasVe2Clamp((Number(w.base_structural_vulnerability)||0.35)*base+(Number(w.enr_chile_exposure)||0.25)*enr+(Number(w.icr_ros_convertibility)||0.20)*icrScore+(Number(w.gafilat_sector_materiality)||0.20)*gf.score);
    c.ve_v2={base,enr,icr_score:icrScore,icr_raw_pct:rawIcr,icr_posterior_pct:postIcr,ros_sent_5y:x.sent,ros_indications_5y:x.ind,gafilat:gf.score,gafilat_label:gf.label,composite};
  }
  return {prior_rate_pct:100*priorRate,matched_icr:temp.filter(x=>x.sent>0&&x.ind!==null).length,sectors:cat.length};
}
function atlasVe2Rank(rows,getter){return atlasVe2PercentilePairs(rows.map((r,i)=>({key:i,value:getter(r)})));}
function atlasVe2EnrichLevel(rows,computed,cfg){
  const salesPct=atlasVe2Rank(rows,r=>Number(r.economy?.avg_sales_band_rank));
  const laborPct=atlasVe2Rank(rows,r=>{const a=Number(r.economy?.active_entities),w=Number(r.economy?.workers);return a>0&&Number.isFinite(w)?w/a:null;});
  const formationPct=atlasVe2Rank(rows,r=>{const p=Number(r.exposure?.potential_total),s=Number(r.exposure?.started_2024);return p>0&&Number.isFinite(s)?s/p:null;});
  rows.forEach((r,i)=>{
    const sectors=[...(r.exposure?.bySector?.values?.()||[])];let num=0,den=0,baseNum=0;
    for(const s of sectors){const c=computed.catalog.byId.get(Number(s.sector_id)),p=Number(s.potential)||0;if(!c?.ve_v2||p<=0)continue;num+=p*c.ve_v2.composite;baseNum+=p*c.ve_v2.base;den+=p;}
    const sectorCore=den?num/den:(atlasVe2Finite(r.parts?.vulnerability)?Number(r.parts.vulnerability):50);
    const baseCore=den?baseNum/den:sectorCore;
    const sp=salesPct.get(i)??50,lp=laborPct.get(i)??50,fp=formationPct.get(i)??50,ew=cfg.formula?.economic_materiality_sii||{};
    const ws=Number(ew.sales_band_percentile)||0.50,wl=Number(ew.workers_per_active_entity_percentile)||0.30,wf=Number(ew.recent_activity_start_percentile)||0.20,wd=ws+wl+wf||1;
    const econ=(ws*sp+wl*lp+wf*fp)/wd;
    const tw=cfg.formula?.territory_ve||{},finalVe=atlasVe2Clamp((Number(tw.sector_core)||0.85)*sectorCore+(Number(tw.economic_materiality_sii)||0.15)*econ);
    const potential=Number(r.exposure?.potential_total),started=Number(r.exposure?.started_2024),formationRate=potential>0&&Number.isFinite(started)?100*started/potential:null;
    r.meta=r.meta||{};r.meta.ve_v2={method:ATLAS_VE2_METHOD,base_core:baseCore,sector_core:sectorCore,economic_materiality:econ,sales_percentile:sp,labor_percentile:lp,recent_activity_start_percentile:fp,recent_activity_start_rate_pct:formationRate,avg_sales_band_rank:r.economy?.avg_sales_band_rank??null,workers_per_active_entity:Number(r.economy?.active_entities)>0?Number(r.economy?.workers||0)/Number(r.economy.active_entities):null};
    r.parts.vulnerability=finalVe;if(r.exposure){r.exposure.vulnerability=finalVe;r.exposure.vulnerability_base=baseCore;r.exposure.sector_core=sectorCore;r.exposure.economic_materiality=econ;}
    const patchSector=s=>{const c=computed.catalog.byId.get(Number(s.sector_id));if(!c?.ve_v2)return s;return Object.assign(s,{risk_base_0_100:c.ve_v2.base,risk_0_100:c.ve_v2.composite,enr_score:c.ve_v2.enr,icr_score:c.ve_v2.icr_score,icr_raw_pct:c.ve_v2.icr_raw_pct,icr_posterior_pct:c.ve_v2.icr_posterior_pct,gafilat_score:c.ve_v2.gafilat,gafilat_label:c.ve_v2.gafilat_label});};
    if(r.exposure?.bySector)for(const s of r.exposure.bySector.values())patchSector(s);
    if(Array.isArray(r.exposure?.top_sectors))r.exposure.top_sectors.forEach(patchSector);
    if(Array.isArray(r.meta?.coverage?.rows))r.meta.coverage.rows.forEach(patchSector);
    const p=r.parts||{};r.irg=['vulnerability','density','gap','threat'].every(k=>atlasVe2Finite(p[k]))?0.45*Number(p.vulnerability)+0.20*Number(p.density)+0.20*Number(p.gap)+0.15*Number(p.threat):null;
    r.method=ATLAS_VE2_METHOD;
  });
}
function atlasVe2ApplyComputed(state,inputs){
  const computed=state?.computed;if(!computed||computed.__atlasVe2Applied)return;
  const diagnostics=atlasVe2BuildSectorScores(computed,inputs);
  atlasVe2EnrichLevel(computed.regions||[],computed,inputs.config);atlasVe2EnrichLevel(computed.communes||[],computed,inputs.config);
  computed.__atlasVe2Applied={method:ATLAS_VE2_METHOD,diagnostics,status:inputs.status};
  window.ATLAS_IRG_VE_V2={method:ATLAS_VE2_METHOD,config:inputs.config,status:inputs.status,diagnostics,state};
}

function atlasVe2Selected(){const s=window.AML_IRG_TERRITORY?.state,c=s?.computed;return c?.regions?.find(r=>r.region===s.selectedRegion)||c?.regions?.[0]||null;}
function atlasVe2Decorate(){
  const state=window.AML_IRG_TERRITORY?.state;if(!state?.computed?.__atlasVe2Applied)return;
  const method=document.querySelector('.v032-formula>div>span');if(method)method.textContent=`MODELO PRINCIPAL · ${ATLAS_VE2_METHOD}`;
  const comp=document.querySelector('.v032-components article:first-child small');if(comp)comp.textContent='V/E v2: 85% núcleo sectorial enriquecido + 15% materialidad territorial SII. Núcleo: base estructural, ENR Chile, ICR y materialidad GAFILAT.';
  const strip=document.querySelector('.v032-source-strip');if(strip&&!strip.querySelector('.atlas-ve2-source')){
    const status=state.computed.__atlasVe2Applied.status||{};
    strip.insertAdjacentHTML('beforeend',`<span class="atlas-ve2-source ${status.icr&&status.report?'ok':'partial'}">ICR UAF 2021–25</span><span class="atlas-ve2-source ok">ENR Chile · act. 2023</span><span class="atlas-ve2-source ok">GAFILAT 2021</span><span class="atlas-ve2-source ok">Materialidad SII</span>`);
  }
  const panel=[...document.querySelectorAll('.v032-card')].find(x=>x.querySelector('.v032-card-head span')?.textContent?.includes('VULNERABILIDAD / EXPOSICIÓN'));
  const row=atlasVe2Selected();if(panel&&row){
    const p=panel.querySelector('.v032-card-head p');if(p)p.textContent='V/E v2 pondera la presencia potencial SII por un perfil sectorial enriquecido con riesgo estructural, ENR Chile, convertibilidad histórica de ROS y materialidad GAFILAT; añade una capa territorial SII con ventas, empleo relativo y dinamismo reciente.';
    const grid=panel.querySelector('.v032-sector-grid');if(grid&&!panel.querySelector('.atlas-ve2-breakdown')){
      const v=row.meta.ve_v2||{};
      grid.insertAdjacentHTML('beforebegin',`<div class="atlas-ve2-breakdown"><div><span>V/E final</span><b>${atlasVe2Fmt(row.parts.vulnerability,1)}</b></div><div><span>Núcleo sectorial · 85%</span><b>${atlasVe2Fmt(v.sector_core,1)}</b></div><div><span>Materialidad SII · 15%</span><b>${atlasVe2Fmt(v.economic_materiality,1)}</b></div><div><span>Ventas · pctl</span><b>${atlasVe2Fmt(v.sales_percentile,0)}</b></div><div><span>Empleo/entidad · pctl</span><b>${atlasVe2Fmt(v.labor_percentile,0)}</b></div><div><span>Inicios 2024+ · pctl</span><b>${atlasVe2Fmt(v.recent_activity_start_percentile,0)}</b></div></div>`);
    }
    panel.querySelectorAll('.v032-sector-grid>article').forEach(card=>{
      if(card.querySelector('.atlas-ve2-sector-mix'))return;const name=card.querySelector('header span')?.textContent||'';
      let c=null,best=0;for(const s of state.computed.catalog.byId.values()){const sim=atlasVe2Similarity(name,s.sector_name);if(sim>best){best=sim;c=s;}}
      if(!c?.ve_v2||best<0.7)return;const x=c.ve_v2;
      card.insertAdjacentHTML('beforeend',`<div class="atlas-ve2-sector-mix"><span>Base <b>${atlasVe2Fmt(x.base,0)}</b></span><span>ENR <b>${atlasVe2Fmt(x.enr,0)}</b></span><span>ICR <b>${atlasVe2Fmt(x.icr_score,0)}</b></span><span>GAFILAT <b>${atlasVe2Fmt(x.gafilat,0)}</b></span></div>`);
    });
    const footer=panel.querySelector('footer');if(footer)footer.textContent='V/E es una priorización territorial comparativa. ENR y GAFILAT se adaptan de forma explícita; ICR es histórico y suavizado por tamaño. “Inicios 2024+” usa inicio de actividades SII como proxy de dinamismo, no como fecha legal de constitución de una persona jurídica.';
  }
  const note=document.querySelector('.v032-method-note span');if(note&&!note.textContent.includes('V/E v2'))note.textContent+=' V/E v2 conserva el 45% superior, pero enriquece su interior con ENR Chile, ICR, materialidad sectorial GAFILAT y materialidad/dinamismo SII.';
}
function atlasVe2QueueDecorate(){requestAnimationFrame(()=>requestAnimationFrame(atlasVe2Decorate));}

function atlasVe2ExportRows(level){
  const s=window.AML_IRG_TERRITORY?.state,rows=level==='region'?s?.computed?.regions:s?.computed?.communes;
  return (rows||[]).map(r=>({territory_id:r.territory_id,territory_level:r.level,region:r.region,territory_name:r.name,indicator:'IRG-LA/FT',method_version:ATLAS_VE2_METHOD,irg:r.irg,risk_band:null,vulnerability_exposure_v2:r.parts?.vulnerability,ve_sector_core:r.meta?.ve_v2?.sector_core,ve_economic_materiality_sii:r.meta?.ve_v2?.economic_materiality,ve_sales_percentile:r.meta?.ve_v2?.sales_percentile,ve_labor_percentile:r.meta?.ve_v2?.labor_percentile,ve_recent_activity_start_percentile:r.meta?.ve_v2?.recent_activity_start_percentile,ve_recent_activity_start_rate_pct:r.meta?.ve_v2?.recent_activity_start_rate_pct,density_so_percentile:r.parts?.density,coverage_gap_potential:r.parts?.gap,territorial_threat:r.parts?.threat,active_entities:r.economy?.active_entities??null,uaf_observed:r.uaf?.uaf_observed??0,cead_cases:r.cead?.cases??null,guardrail:'TERRITORIAL_PRIORITY_NOT_ENTITY_ATTRIBUTION'}));
}
function atlasVe2Csv(rows){if(!rows.length)return '';const cols=Object.keys(rows[0]),q=v=>{if(v===null||v===undefined)return '';const s=String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};return [cols.join(','),...rows.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');}
function atlasVe2Download(name,text,type){const b=new Blob([text],{type}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
function atlasVe2HandleExport(e){
  const btn=e.target.closest?.('#v032-export-csv,#v032-export-json');if(!btn||!window.ATLAS_IRG_VE_V2)return;
  e.preventDefault();e.stopImmediatePropagation();const rows=[...atlasVe2ExportRows('region'),...atlasVe2ExportRows('commune')],date=new Date().toISOString().slice(0,10);
  if(btn.id==='v032-export-csv')atlasVe2Download(`irg_laft_territorial_${date}.csv`,atlasVe2Csv(rows),'text/csv;charset=utf-8');
  else atlasVe2Download(`irg_laft_territorial_${date}.json`,JSON.stringify({schema:'IRG_LAFT_TERRITORIAL_V2',generated_at:new Date().toISOString(),method:{version:ATLAS_VE2_METHOD,formula:'0.45*V_E_V2 + 0.20*SO_DENSITY + 0.20*COVERAGE_GAP + 0.15*TERRITORIAL_THREAT',ve_formula:window.ATLAS_IRG_VE_V2.config.formula},guardrails:window.ATLAS_IRG_VE_V2.config.guardrails,rows},null,2),'application/json;charset=utf-8');
}
document.addEventListener('click',atlasVe2HandleExport,true);

async function atlasVe2ApplyAfterTerritory(){
  const state=window.AML_IRG_TERRITORY?.state;if(!state?.computed||state.computed.__atlasVe2Applied||atlasVe2Applying)return;
  atlasVe2Applying=true;
  try{
    const inputs=await atlasVe2LoadInputs();atlasVe2ApplyComputed(state,inputs);window.AML_IRG_TERRITORY.version=ATLAS_VE2_METHOD;window.AML_IRG_TERRITORY.render();atlasVe2QueueDecorate();
  }catch(error){
    console.warn('[ATLAS IRG] V/E v2 no disponible; se conserva V/E base',error);window.ATLAS_IRG_VE_V2={method:ATLAS_VE2_METHOD,status:'degraded',error:String(error?.message||error)};
  }finally{atlasVe2Applying=false;}
}

const atlasVe2BaseTerritory=window.v019LoadTerritory;
if(typeof atlasVe2BaseTerritory==='function'){
  window.v019LoadTerritory=async function(...args){const preload=atlasVe2LoadInputs().catch(()=>null);const result=await atlasVe2BaseTerritory(...args);await preload;await atlasVe2ApplyAfterTerritory();return result;};
}
const atlasVe2Observer=new MutationObserver(()=>{
  const computed=window.AML_IRG_TERRITORY?.state?.computed;if(!computed)return;
  if(!computed.__atlasVe2Applied){void atlasVe2ApplyAfterTerritory();return;}atlasVe2QueueDecorate();
});
atlasVe2Observer.observe(document.documentElement,{subtree:true,childList:true});
atlasVe2LoadInputs().catch(()=>null);
setTimeout(()=>{if(window.AML_IRG_TERRITORY?.state?.computed)void atlasVe2ApplyAfterTerritory();},500);
