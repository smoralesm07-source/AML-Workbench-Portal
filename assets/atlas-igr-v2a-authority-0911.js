'use strict';
/* ATLAS AML · IGR v2A production authority 0.91.1
 * Visible indicator: IGR.
 * Current score: 100% CEAD-LA territorial threat.
 * No sector, SO-density, coverage-gap, reportability, IPA or IVO inputs.
 * Future cross-border and territorial-LA-evidence layers are gated until materialized.
 */
(function atlasIgrV2AAuthority0911(){
  if(window.AtlasIGRV2A)return;
  const VERSION='IGR-2A-1.0.0';
  const SOURCE='https://raw.githubusercontent.com/smoralesm07-source/Radar_delictual/radar-data/data/processed/cead_geographic_score_v1.json';
  const VIEW='territory';
  const IFRAME='./assets/territorio-aml-beta.html?v=0916-layout1';
  const state={status:'idle',rows:[],computed:{regions:[],communes:[]},loadedAt:null,error:null};
  let loadPromise=null;
  let hostCleanup=null;
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const band=v=>!finite(v)?'Sin cálculo':Number(v)>=80?'Muy alto':Number(v)>=60?'Alto':Number(v)>=40?'Medio':Number(v)>=20?'Moderado':'Bajo';
  const confLabel=v=>!finite(v)?'No informada':Number(v)>=85?'Alta':Number(v)>=70?'Media':'Baja';
  const regionName=v=>String(v||'').trim();
  const idCommune=r=>`CL-COM-${String(r.commune_code||'').padStart(5,'0')}`;
  const cloneLayers=r=>r?.layers&&typeof r.layers==='object'?r.layers:null;

  function communeRow(r){
    const score=finite(r.score)?Number(r.score):null,confidence=finite(r.confidence)?Number(r.confidence):null;
    return {
      id:idCommune(r),territory_id:idCommune(r),level:'COMMUNE',region:regionName(r.region_name),name:r.commune_name,commune:r.commune_name,commune_code:String(r.commune_code||'').padStart(5,'0'),
      irg:score,score,risk_band:band(score),method_version:VERSION,period:r.period||r.year||null,
      parts:{cead_la:score,threat:score,vulnerability:null,density:null,gap:null},
      cead:{...r,score,layers:cloneLayers(r)},
      layers:cloneLayers(r),
      confidence:{score:confidence,label:confLabel(confidence),inputs:{cead_coverage:confidence,geographic_quality:null,freshness:null}},
      guardrail:'TERRITORIAL_CONTEXT_NOT_ENTITY_ATTRIBUTION'
    };
  }
  function regionRows(communes){
    const groups=new Map();
    for(const r of communes){if(!r.region||!finite(r.irg))continue;if(!groups.has(r.region))groups.set(r.region,[]);groups.get(r.region).push(r);}
    const out=[];
    for(const [region,items] of groups){
      let weighted=0,totalWeight=0;const confs=[];
      for(const r of items){const c=finite(r.confidence?.score)?Math.max(1,Number(r.confidence.score)):1;weighted+=Number(r.irg)*c;totalWeight+=c;if(finite(r.confidence?.score))confs.push(Number(r.confidence.score));}
      const score=totalWeight?weighted/totalWeight:null,confidence=confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:null;
      out.push({
        id:`CL-REG-${norm(region).replace(/ /g,'-')}`,territory_id:`CL-REG-${norm(region).replace(/ /g,'-')}`,level:'REGION',region,name:region,
        irg:score,score,risk_band:band(score),method_version:VERSION,period:items.find(x=>x.period)?.period||null,
        parts:{cead_la:score,threat:score,vulnerability:null,density:null,gap:null},
        confidence:{score:confidence,label:confLabel(confidence),inputs:{cead_coverage:confidence,geographic_quality:null,freshness:null}},
        communes_observed:items.length,aggregation:'CONFIDENCE_WEIGHTED_COMMUNE_MEAN',
        guardrail:'TERRITORIAL_CONTEXT_NOT_ENTITY_ATTRIBUTION'
      });
    }
    return out.sort((a,b)=>(b.irg??-1)-(a.irg??-1));
  }
  function build(raw){
    const communes=(Array.isArray(raw)?raw:[]).filter(r=>r&&r.commune_name&&finite(r.score)).map(communeRow);
    const regions=regionRows(communes);
    state.rows=raw;state.computed={regions,communes};state.loadedAt=new Date().toISOString();state.status='ready';state.error=null;
    syncCompatibility();
    return state.computed;
  }
  function patchMethodology(){
    try{
      const c=window.AtlasIndicatorMethodologyV1?.catalog?.IGR;
      if(c){
        c.label='IGR';c.name='Índice de Riesgo Geográfico';c.status='Territorio · IGR v2A · activo';
        c.method='IGR v2A mide actualmente amenaza territorial LA con CEAD-LA. Usa 55% amenazas precedentes LA, 35% economía criminal/facilitadores y 10% contexto criminógeno; cada driver combina 40% intensidad, 25% persistencia, 20% tendencia y 15% anomalía. No incorpora vulnerabilidad sectorial, densidad SO, brecha, reportabilidad, IPA ni IVO. Las futuras capas transfronteriza y evidencia territorial LA no puntúan hasta estar materializadas.';
      }
      window.AtlasIndicatorMethodologyV1?.refresh?.();
    }catch(error){console.warn('[ATLAS IGR v2A] metodología',error);}
  }
  function syncCompatibility(){
    try{
      if(typeof V032_STATE!=='undefined'&&V032_STATE){V032_STATE.computed=state.computed;V032_STATE.layer='irg';V032_STATE.raw={...(V032_STATE.raw||{}),igrV2A:true,igrV2AVersion:VERSION};}
      if(typeof V022_STATE!=='undefined'&&V022_STATE)V022_STATE.computed=state.computed;
    }catch(error){console.warn('[ATLAS IGR v2A] legacy sync',error);}
    const api={version:VERSION,methodVersion:VERSION,weights:{cead_la:1},confidenceWeights:null,state,computed:state.computed,load,open,byCommune,byRegion,scoreFor,exportRows,method:{formula:'1.00*CEAD_LA',ceadLayers:{predicate_direct:.55,criminal_economy:.35,criminogenic_context:.10},features:{intensity:.40,persistence:.25,trend:.20,anomaly:.15},roadmap:{v2A:'1.00*CEAD_LA',v2B:'0.85*CEAD_LA+0.15*CROSS_BORDER',v2C:'0.75*CEAD_LA+0.15*CROSS_BORDER+0.10*TERRITORIAL_LA_EVIDENCE'}}};
    window.AML_IRG_TERRITORY=api;
    window.__ATLAS_IGR_CURRENT__={version:VERSION,visibleName:'IGR',formula:'100% CEAD-LA',source:SOURCE,sectorInputs:false,entityInputs:false,computed:state.computed,updatedAt:state.loadedAt};
    patchMethodology();
    window.dispatchEvent(new CustomEvent('atlas:igr-v2a-ready',{detail:{version:VERSION,regions:state.computed.regions.length,communes:state.computed.communes.length}}));
  }
  async function load(force=false){
    if(state.status==='ready'&&!force)return state.computed;if(loadPromise&&!force)return loadPromise;
    state.status='loading';
    loadPromise=(async()=>{const r=await fetch(`${SOURCE}${SOURCE.includes('?')?'&':'?'}atlas=${Date.now()}`,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`CEAD-LA HTTP ${r.status}`);return build(await r.json());})().catch(error=>{state.status='error';state.error=String(error?.message||error);throw error;}).finally(()=>{loadPromise=null;});
    return loadPromise;
  }
  function byCommune(value){const k=norm(value);return state.computed.communes.find(r=>norm(r.commune_code)===k||norm(r.name)===k)||null;}
  function byRegion(value){const k=norm(value);return state.computed.regions.find(r=>norm(r.region)===k||norm(r.name)===k)||null;}
  function scoreFor({commune,commune_code,region}={}){const r=commune_code?byCommune(commune_code):(commune?byCommune(commune):byRegion(region));return r?.irg??null;}
  function exportRows(level='all'){const rows=level==='region'?state.computed.regions:level==='commune'?state.computed.communes:[...state.computed.regions,...state.computed.communes];return rows.map(r=>({territory_id:r.territory_id,territory_level:r.level,region:r.region,territory_name:r.name,indicator:'IGR',method_version:VERSION,igr:r.irg,risk_band:r.risk_band,cead_la:r.parts?.cead_la??null,confidence_score:r.confidence?.score??null,guardrail:r.guardrail}));}
  function ensureHostStyle(){
    if(document.querySelector('style[data-atlas-igr-v2a-host]'))return;
    const s=document.createElement('style');s.dataset.atlasIgrV2aHost='1';
    s.textContent=`
      .atlas-igr-v2a-content{box-sizing:border-box!important;min-width:0!important;width:100%!important;max-width:none!important;grid-column:1/-1!important;justify-self:stretch!important;align-self:stretch!important;flex:1 1 auto!important}
      .atlas-igr-v2a-content>[data-atlas-igr-v2a-host]{box-sizing:border-box!important;height:calc(100vh - 86px);min-height:760px;width:100%!important;max-width:none!important;margin:0!important;border:1px solid rgba(91,126,149,.22);border-radius:14px;overflow:hidden;background:#071019}
      .atlas-igr-v2a-content>[data-atlas-igr-v2a-host] iframe{display:block;width:100%!important;max-width:none!important;height:100%;border:0;background:#071019}
    `;
    document.head.appendChild(s);
  }
  function activateWideHost(root){
    if(hostCleanup){try{hostCleanup();}catch{}hostCleanup=null;}
    root.classList.add('atlas-igr-v2a-content');
    const fit=()=>{
      if(!root.isConnected||!root.querySelector('[data-atlas-igr-v2a-host]'))return;
      const left=Math.max(0,root.getBoundingClientRect().left);
      const viewport=document.documentElement.clientWidth||window.innerWidth||0;
      const rightGap=viewport>=900?16:0;
      const available=Math.max(320,viewport-left-rightGap);
      root.style.setProperty('width',`${available}px`,'important');
      root.style.setProperty('max-width','none','important');
      root.style.setProperty('min-width','0','important');
      root.style.setProperty('grid-column','1 / -1','important');
      root.style.setProperty('justify-self','stretch','important');
      root.style.setProperty('align-self','stretch','important');
      root.style.setProperty('flex','1 1 auto','important');
    };
    fit();
    requestAnimationFrame(fit);
    const onResize=()=>requestAnimationFrame(fit);
    window.addEventListener('resize',onResize,{passive:true});
    const observer=new MutationObserver(()=>{
      if(root.querySelector('[data-atlas-igr-v2a-host]'))return;
      cleanup();
    });
    observer.observe(root,{childList:true});
    function cleanup(){
      window.removeEventListener('resize',onResize);
      observer.disconnect();
      root.classList.remove('atlas-igr-v2a-content');
      ['width','max-width','min-width','grid-column','justify-self','align-self','flex'].forEach(p=>root.style.removeProperty(p));
      if(hostCleanup===cleanup)hostCleanup=null;
    }
    hostCleanup=cleanup;
  }
  async function open(){
    try{if(window.state)window.state.view=VIEW;}catch{}
    try{if(typeof shell==='function')shell('Territorio','IGR · amenaza territorial LA · historia real 2020–2025');}catch{}
    ensureHostStyle();
    const root=document.querySelector('#content,.v019-content');if(!root)throw new Error('Contenedor Territorio no disponible');
    root.innerHTML=`<section data-atlas-igr-v2a-host="1" aria-label="Territorio IGR"><iframe title="ATLAS Territorio · IGR" src="${IFRAME}" loading="eager"></iframe></section>`;
    activateWideHost(root);
    try{await load();}catch(error){console.warn('[ATLAS IGR v2A] data authority',error);}
    patchMethodology();
    return true;
  }
  const API={version:VERSION,state,load,open,byCommune,byRegion,scoreFor,exportRows,patchMethodology,method:{formula:'1.00*CEAD_LA',weights:{cead_la:1}}};
  window.AtlasIGRV2A=API;
  window.v019LoadTerritory=open;
  window.loadTerritory=open;
  setTimeout(()=>{void load().catch(()=>{});patchMethodology();},0);
  setTimeout(patchMethodology,700);
})();