/* ATLAS AML · IRG adapter for canonical IRAR · IRG-LAFT-0.34.0 */
const ATLAS_IRG_IRAR_METHOD='IRG-LAFT-0.34.0';
const irarCore=window.ATLAS_IRAR_CURRENT;
let irarApplying=false;

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function clamp(v,a=0,b=100){return finite(v)?Math.max(a,Math.min(b,Number(v))):null;}
function metricForSector(sector,dataset){
  if(!irarCore||!sector)return null;
  let m=irarCore.findMetric(sector.sector_name,dataset);if(m)return m;
  for(const alias of sector.aliases||[]){m=irarCore.findMetric(alias,dataset);if(m)return m;}
  return null;
}
function currentWeights(config){
  return config?.formula?.sector_core_current||{
    base_structural_vulnerability:.35,
    enr_chile_exposure:.25,
    irar_analytical_yield:.20,
    gafilat_sector_materiality:.20
  };
}
function patchSectorRow(row,c){
  if(!row||!c?.ve_v2)return row;
  const v=c.ve_v2;
  Object.assign(row,{
    risk_base_0_100:v.base,
    risk_0_100:v.composite,
    enr_score:v.enr,
    irar_score:v.irar_score,
    irar_observed_pct:v.irar_observed_pct,
    irar_adjusted_pct:v.irar_adjusted_pct,
    irar_peer_expected_pct:v.irar_peer_expected_pct,
    irar_relative_peer:v.irar_relative_peer,
    irar_confidence_pct:v.irar_confidence_pct,
    irar_family:v.irar_family,
    irar_profile:v.irar_profile,
    gafilat_score:v.gafilat,
    gafilat_label:v.gafilat_label
  });
  return row;
}
function rebuildTerritory(rows,computed,config){
  const tw=config?.formula?.territory_ve||{sector_core:.85,economic_materiality_sii:.15};
  for(const r of rows||[]){
    const sectors=[...(r.exposure?.bySector?.values?.()||[])];let num=0,den=0,baseNum=0;
    for(const s of sectors){
      const c=computed.catalog.byId.get(Number(s.sector_id)),p=Number(s.potential)||0;
      if(!c?.ve_v2||p<=0)continue;
      num+=p*Number(c.ve_v2.composite||0);baseNum+=p*Number(c.ve_v2.base||0);den+=p;
    }
    const previous=r.meta?.ve_v2||{};
    const sectorCore=den?num/den:(finite(previous.sector_core)?Number(previous.sector_core):50);
    const baseCore=den?baseNum/den:(finite(previous.base_core)?Number(previous.base_core):sectorCore);
    const econ=finite(previous.economic_materiality)?Number(previous.economic_materiality):50;
    const finalVe=clamp((Number(tw.sector_core)||.85)*sectorCore+(Number(tw.economic_materiality_sii)||.15)*econ);
    r.meta=r.meta||{};
    r.meta.ve_v2={...previous,method:ATLAS_IRG_IRAR_METHOD,base_core:baseCore,sector_core:sectorCore,economic_materiality:econ,analytical_yield_method:'IRAR-1.0'};
    r.parts=r.parts||{};r.parts.vulnerability=finalVe;
    if(r.exposure){
      r.exposure.vulnerability=finalVe;r.exposure.vulnerability_base=baseCore;r.exposure.sector_core=sectorCore;r.exposure.economic_materiality=econ;
      if(r.exposure.bySector)for(const s of r.exposure.bySector.values()){const c=computed.catalog.byId.get(Number(s.sector_id));patchSectorRow(s,c);}
      if(Array.isArray(r.exposure.top_sectors))for(const s of r.exposure.top_sectors){const c=computed.catalog.byId.get(Number(s.sector_id));patchSectorRow(s,c);}
    }
    if(Array.isArray(r.meta?.coverage?.rows))for(const s of r.meta.coverage.rows){const c=computed.catalog.byId.get(Number(s.sector_id));patchSectorRow(s,c);}
    const p=r.parts;
    r.irg=['vulnerability','density','gap','threat'].every(k=>finite(p[k])) ? .45*Number(p.vulnerability)+.20*Number(p.density)+.20*Number(p.gap)+.15*Number(p.threat) : null;
    r.method=ATLAS_IRG_IRAR_METHOD;
  }
}
function decorateIrg(){
  const state=window.AML_IRG_TERRITORY?.state,computed=state?.computed;if(!computed?.__atlasIrarApplied)return;
  const method=document.querySelector('.v032-formula>div>span');if(method)method.textContent=`MODELO PRINCIPAL · ${ATLAS_IRG_IRAR_METHOD}`;
  const comp=document.querySelector('.v032-components article:first-child small');if(comp)comp.textContent='V/E: 85% núcleo sectorial enriquecido + 15% materialidad territorial SII. Núcleo: base estructural, ENR Chile, IRAR ajustado y materialidad GAFILAT.';
  document.querySelectorAll('.atlas-ve2-source').forEach(el=>{if(/ICR/i.test(el.textContent||''))el.textContent='IRAR UAF 2021–25';});
  const panel=[...document.querySelectorAll('.v032-card')].find(x=>x.querySelector('.v032-card-head span')?.textContent?.includes('VULNERABILIDAD / EXPOSICIÓN'));
  if(panel){
    const p=panel.querySelector('.v032-card-head p');if(p)p.textContent='V/E pondera la presencia potencial SII por un perfil sectorial enriquecido con riesgo estructural, ENR Chile, rendimiento analítico de ROS ajustado por pares (IRAR) y materialidad GAFILAT; añade materialidad territorial SII.';
    panel.querySelectorAll('.atlas-ve2-sector-mix span').forEach(span=>{if(/^ICR\b/i.test((span.textContent||'').trim())){const b=span.querySelector('b')?.outerHTML||'';span.innerHTML=`IRAR ${b}`;}});
    const footer=panel.querySelector('footer');if(footer)footer.textContent='V/E es una priorización territorial comparativa. IRAR usa rendimiento analítico histórico ajustado por pares y credibilidad; no es una probabilidad de conversión, calidad del ROS, riesgo de entidad ni cumplimiento. ENR y GAFILAT son adaptadores explícitos y la materialidad SII representa exposición.';
  }
  const note=document.querySelector('.v032-method-note span');if(note){
    note.textContent=(note.textContent||'').replace(/\bICR\b/g,'IRAR');
    if(!note.textContent.includes('ajustado por pares'))note.textContent+=' IRAR se ajusta por pares y credibilidad estadística antes de entrar al núcleo sectorial.';
  }
}
function queueDecorate(){requestAnimationFrame(()=>requestAnimationFrame(decorateIrg));}

async function applyIrarToIrg(){
  if(!irarCore||irarApplying)return false;
  const state=window.AML_IRG_TERRITORY?.state,computed=state?.computed;
  if(!computed||computed.__atlasIrarApplied)return Boolean(computed?.__atlasIrarApplied);
  if(!computed.__atlasVe2Applied)return false;
  irarApplying=true;
  try{
    const loaded=await irarCore.load(),dataset=loaded.dataset,config=window.ATLAS_IRG_VE_V2?.config||{};
    const w=currentWeights(config),sectors=[...(computed.catalog?.byId?.values?.()||[])];let matched=0;
    for(const c of sectors){
      const m=metricForSector(c,dataset);if(!m)continue;matched++;
      const v=c.ve_v2||{},legacyIcrScore=v.icr_score;
      const irarScore=finite(m.score)?Number(m.score):50;
      const base=finite(v.base)?Number(v.base):50,enr=finite(v.enr)?Number(v.enr):50,gf=finite(v.gafilat)?Number(v.gafilat):25;
      const composite=clamp((Number(w.base_structural_vulnerability)||.35)*base+(Number(w.enr_chile_exposure)||.25)*enr+(Number(w.irar_analytical_yield)||.20)*irarScore+(Number(w.gafilat_sector_materiality)||.20)*gf);
      c.ve_v2={...v,
        legacy_icr_score:legacyIcrScore,
        irar_score:irarScore,
        irar_observed_pct:m.observed_pct,
        irar_adjusted_pct:m.adjusted_pct,
        irar_peer_expected_pct:m.peer_expected_pct,
        irar_relative_peer:m.relative_peer,
        irar_confidence_pct:m.confidence_pct,
        irar_confidence_band:m.confidence_band,
        irar_family:m.family?.label||null,
        irar_peer_source:m.peer_source,
        irar_profile:m.profile?.label||null,
        irar_ranking_eligible:Boolean(m.ranking_eligible),
        ros_sent_5y:m.sent,
        ros_indications_5y:m.ind,
        composite,
        // Compatibility alias for older downstream readers. Value is now IRAR score.
        icr_score:irarScore
      };
    }
    rebuildTerritory(computed.regions||[],computed,config);rebuildTerritory(computed.communes||[],computed,config);
    computed.__atlasIrarApplied={method:ATLAS_IRG_IRAR_METHOD,irar_version:irarCore.version,matched,sectors:sectors.length,applied_at:new Date().toISOString()};
    window.ATLAS_IRG_IRAR={method:ATLAS_IRG_IRAR_METHOD,irar_version:irarCore.version,config,status:'ready',diagnostics:computed.__atlasIrarApplied,state};
    window.AML_IRG_TERRITORY.version=ATLAS_IRG_IRAR_METHOD;
    window.AML_IRG_TERRITORY.render?.();queueDecorate();return true;
  }catch(error){
    console.warn('[ATLAS IRG] IRAR adapter unavailable; prior V/E retained',error);
    window.ATLAS_IRG_IRAR={method:ATLAS_IRG_IRAR_METHOD,status:'degraded',error:String(error?.message||error)};return false;
  }finally{irarApplying=false;}
}

const baseTerritory=window.v019LoadTerritory;
if(typeof baseTerritory==='function')window.v019LoadTerritory=async function(...args){const result=await baseTerritory(...args);await applyIrarToIrg();return result;};
for(const ms of [0,250,800,1800,4000])setTimeout(()=>void applyIrarToIrg().then(ok=>{if(ok)queueDecorate();}),ms);
window.addEventListener('atlas:themechange',queueDecorate);
