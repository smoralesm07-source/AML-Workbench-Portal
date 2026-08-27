'use strict';
/* ATLAS AML · IGR v2A production authority 0.91.4
 * Legacy filename retained only as the synchronous production load point.
 * Visible indicator: IGR. Current score: 100% CEAD-LA territorial threat.
 * Presentation: standalone HTML is the visual authority; ATLAS only mounts and resizes it.
 */
(function atlasIgrV2AAuthority0914(){
  if(window.AtlasIGRV2A)return;
  const VERSION='IGR-2A-1.0.0';
  const SOURCE='https://raw.githubusercontent.com/smoralesm07-source/Radar_delictual/radar-data/data/processed/cead_geographic_score_v1.json';
  const VIEW='territory';
  const IFRAME='./assets/territorio-aml-beta.html?v=0914-html1';
  const state={status:'idle',rows:[],computed:{regions:[],communes:[]},loadedAt:null,error:null};
  let loadPromise=null;
  let activeFrame=null;
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const band=v=>!finite(v)?'Sin cálculo':Number(v)>=80?'Muy alto':Number(v)>=60?'Alto':Number(v)>=40?'Medio':Number(v)>=20?'Moderado':'Bajo';
  const confLabel=v=>!finite(v)?'No informada':Number(v)>=85?'Alta':Number(v)>=70?'Media':'Baja';
  const regionName=v=>String(v||'').trim();
  const idCommune=r=>`CL-COM-${String(r.commune_code||'').padStart(5,'0')}`;
  const cloneLayers=r=>r?.layers&&typeof r.layers==='object'?r.layers:null;

  function communeRow(r){
    const score=finite(r.score)?Number(r.score):null,confidence=finite(r.confidence)?Number(r.confidence):null;
    return {id:idCommune(r),territory_id:idCommune(r),level:'COMMUNE',region:regionName(r.region_name),name:r.commune_name,commune:r.commune_name,commune_code:String(r.commune_code||'').padStart(5,'0'),irg:score,score,risk_band:band(score),method_version:VERSION,period:r.period||r.year||null,parts:{cead_la:score,threat:score,vulnerability:null,density:null,gap:null},cead:{...r,score,layers:cloneLayers(r)},layers:cloneLayers(r),confidence:{score:confidence,label:confLabel(confidence),inputs:{cead_coverage:confidence,geographic_quality:null,freshness:null}},guardrail:'TERRITORIAL_CONTEXT_NOT_ENTITY_ATTRIBUTION'};
  }
  function regionRows(communes){
    const groups=new Map();for(const r of communes){if(!r.region||!finite(r.irg))continue;if(!groups.has(r.region))groups.set(r.region,[]);groups.get(r.region).push(r);}
    const out=[];
    for(const [region,items] of groups){
      let weighted=0,totalWeight=0;const confs=[];
      for(const r of items){const c=finite(r.confidence?.score)?Math.max(1,Number(r.confidence.score)):1;weighted+=Number(r.irg)*c;totalWeight+=c;if(finite(r.confidence?.score))confs.push(Number(r.confidence.score));}
      const score=totalWeight?weighted/totalWeight:null,confidence=confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:null;
      out.push({id:`CL-REG-${norm(region).replace(/ /g,'-')}`,territory_id:`CL-REG-${norm(region).replace(/ /g,'-')}`,level:'REGION',region,name:region,irg:score,score,risk_band:band(score),method_version:VERSION,period:items.find(x=>x.period)?.period||null,parts:{cead_la:score,threat:score,vulnerability:null,density:null,gap:null},confidence:{score:confidence,label:confLabel(confidence),inputs:{cead_coverage:confidence,geographic_quality:null,freshness:null}},communes_observed:items.length,aggregation:'CONFIDENCE_WEIGHTED_COMMUNE_MEAN',guardrail:'TERRITORIAL_CONTEXT_NOT_ENTITY_ATTRIBUTION'});
    }
    return out.sort((a,b)=>(b.irg??-1)-(a.irg??-1));
  }
  function build(raw){
    const communes=(Array.isArray(raw)?raw:[]).filter(r=>r&&r.commune_name&&finite(r.score)).map(communeRow),regions=regionRows(communes);
    state.rows=raw;state.computed={regions,communes};state.loadedAt=new Date().toISOString();state.status='ready';state.error=null;syncCompatibility();return state.computed;
  }
  function patchMethodology(){
    try{
      const c=window.AtlasIndicatorMethodologyV1?.catalog?.IGR;
      if(c){c.label='IGR';c.name='Índice de Riesgo Geográfico';c.status='Territorio · IGR v2A · activo';c.method='IGR v2A mide actualmente amenaza territorial LA con CEAD-LA. Usa 55% amenazas precedentes LA, 35% economía criminal/facilitadores y 10% contexto criminógeno; cada driver combina 40% intensidad, 25% persistencia, 20% tendencia y 15% anomalía. No incorpora vulnerabilidad sectorial, densidad SO, brecha, reportabilidad, IPA ni IVO. Las futuras capas transfronteriza y evidencia territorial LA no puntúan hasta estar materializadas.';}
      window.AtlasIndicatorMethodologyV1?.refresh?.();
    }catch(error){console.warn('[ATLAS IGR v2A] metodología',error);}
  }
  function syncCompatibility(){
    try{if(typeof V032_STATE!=='undefined'&&V032_STATE){V032_STATE.computed=state.computed;V032_STATE.layer='irg';V032_STATE.raw={...(V032_STATE.raw||{}),igrV2A:true,igrV2AVersion:VERSION};}if(typeof V022_STATE!=='undefined'&&V022_STATE)V022_STATE.computed=state.computed;}catch(error){console.warn('[ATLAS IGR v2A] legacy sync',error);}
    const api={version:VERSION,methodVersion:VERSION,weights:{cead_la:1},confidenceWeights:null,state,computed:state.computed,load,open,byCommune,byRegion,scoreFor,exportRows,method:{formula:'1.00*CEAD_LA',ceadLayers:{predicate_direct:.55,criminal_economy:.35,criminogenic_context:.10},features:{intensity:.40,persistence:.25,trend:.20,anomaly:.15},roadmap:{v2A:'1.00*CEAD_LA',v2B:'0.85*CEAD_LA+0.15*CROSS_BORDER',v2C:'0.75*CEAD_LA+0.15*CROSS_BORDER+0.10*TERRITORIAL_LA_EVIDENCE'}}};
    window.AML_IRG_TERRITORY=api;window.__ATLAS_IGR_CURRENT__={version:VERSION,visibleName:'IGR',formula:'100% CEAD-LA',source:SOURCE,sectorInputs:false,entityInputs:false,computed:state.computed,updatedAt:state.loadedAt};patchMethodology();window.dispatchEvent(new CustomEvent('atlas:igr-v2a-ready',{detail:{version:VERSION,regions:state.computed.regions.length,communes:state.computed.communes.length}}));
  }
  async function load(force=false){
    if(state.status==='ready'&&!force)return state.computed;if(loadPromise&&!force)return loadPromise;state.status='loading';
    loadPromise=(async()=>{const r=await fetch(`${SOURCE}${SOURCE.includes('?')?'&':'?'}atlas=${Date.now()}`,{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`CEAD-LA HTTP ${r.status}`);return build(await r.json());})().catch(error=>{state.status='error';state.error=String(error?.message||error);throw error;}).finally(()=>{loadPromise=null;});return loadPromise;
  }
  function byCommune(value){const k=norm(value);return state.computed.communes.find(r=>norm(r.commune_code)===k||norm(r.name)===k)||null;}
  function byRegion(value){const k=norm(value);return state.computed.regions.find(r=>norm(r.region)===k||norm(r.name)===k)||null;}
  function scoreFor({commune,commune_code,region}={}){const r=commune_code?byCommune(commune_code):(commune?byCommune(commune):byRegion(region));return r?.irg??null;}
  function exportRows(level='all'){const rows=level==='region'?state.computed.regions:level==='commune'?state.computed.communes:[...state.computed.regions,...state.computed.communes];return rows.map(r=>({territory_id:r.territory_id,territory_level:r.level,region:r.region,territory_name:r.name,indicator:'IGR',method_version:VERSION,irg:r.irg,risk_band:r.risk_band,cead_la:r.parts?.cead_la??null,confidence_score:r.confidence?.score??null,guardrail:r.guardrail}));}

  function ensureHostStyle(){
    if(document.querySelector('style[data-atlas-igr-v2a-host]'))return;
    const s=document.createElement('style');s.dataset.atlasIgrV2aHost='1';
    s.textContent=`
      [data-atlas-territory-fullscreen="1"]{width:100%!important;max-width:none!important;background:var(--atlas-bg,#07111f)!important}
      [data-atlas-igr-v2a-host]{display:block!important;width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:visible!important;background:var(--atlas-bg,#07111f)!important;box-shadow:none!important}
      [data-atlas-igr-v2a-host] iframe{display:block!important;width:100%!important;max-width:100%!important;height:1200px;border:0!important;border-radius:0!important;overflow:hidden!important;background:var(--atlas-bg,#07111f)!important;box-shadow:none!important}
      @media(max-width:767.98px){
        .v019-content[data-atlas-territory-fullscreen="1"]{padding-left:0!important;padding-right:0!important}
        [data-atlas-igr-v2a-host],[data-atlas-igr-v2a-host] iframe{width:100%!important;max-width:100%!important;min-width:0!important}
      }
    `;
    document.head.appendChild(s);
  }
  function outerTokens(){
    const cs=getComputedStyle(document.documentElement),read=(name,fallback)=>cs.getPropertyValue(name).trim()||fallback;
    return {bg:read('--atlas-bg','#07111f'),panel:read('--atlas-surface','#0c1728'),panel2:read('--atlas-surface-2','#101d30'),line:read('--atlas-border','rgba(148,163,184,.18)'),lineStrong:read('--atlas-border-strong','rgba(148,163,184,.28)'),text:read('--atlas-text','#e8eef7'),muted:read('--atlas-muted','#9aa8bc'),accent:read('--atlas-accent','#f28c28'),radius:read('--atlas-radius','14px'),radiusSm:read('--atlas-radius-sm','10px')};
  }
  function resizeFrame(frame){
    try{
      const d=frame.contentDocument;if(!d)return;
      requestAnimationFrame(()=>{const h=Math.max(d.documentElement?.scrollHeight||0,d.body?.scrollHeight||0,760);frame.style.height=`${Math.ceil(h+4)}px`;});
    }catch(error){console.warn('[ATLAS IGR v2A] resize',error);}
  }
  function applySeamlessFrame(frame){
    try{
      const d=frame.contentDocument;if(!d?.documentElement||!d.body)return;
      const t=outerTokens(),r=d.documentElement;
      r.dataset.atlasEmbedded='true';d.body.dataset.atlasEmbedded='true';
      r.style.setProperty('--bg',t.bg);r.style.setProperty('--panel',t.panel);r.style.setProperty('--panel2',t.panel2);r.style.setProperty('--line',t.line);r.style.setProperty('--line-strong',t.lineStrong);r.style.setProperty('--text',t.text);r.style.setProperty('--muted',t.muted);r.style.setProperty('--accent',t.accent);r.style.setProperty('--cyan',t.accent);r.style.setProperty('--radius',t.radius);r.style.setProperty('--radius-sm',t.radiusSm);
      r.style.background=t.bg;d.body.style.background=t.bg;frame.style.background=t.bg;
      let style=d.querySelector('style[data-atlas-territory-seamless]');
      if(!style){style=d.createElement('style');style.dataset.atlasTerritorySeamless='1';d.head.appendChild(style);}
      style.textContent=`
        html,body{width:100%!important;height:auto!important;min-height:0!important;overflow-x:hidden!important;overflow-y:hidden!important;background:var(--bg,#07111f)!important}
        body>.shell{width:100%!important;max-width:100%!important;margin:0!important;background:var(--bg,#07111f)!important}
        body>.shell>.header{display:none!important}
        .card{box-shadow:none!important}
      `;
      if(frame.__atlasTerritoryRO)try{frame.__atlasTerritoryRO.disconnect();}catch{}
      if(typeof ResizeObserver==='function'){
        frame.__atlasTerritoryRO=new ResizeObserver(()=>resizeFrame(frame));
        frame.__atlasTerritoryRO.observe(d.body);
      }
      resizeFrame(frame);setTimeout(()=>resizeFrame(frame),120);setTimeout(()=>resizeFrame(frame),900);setTimeout(()=>resizeFrame(frame),2200);
    }catch(error){console.warn('[ATLAS IGR v2A] seamless host',error);}
  }
  function syncFramePresentation(){if(activeFrame?.isConnected)applySeamlessFrame(activeFrame);}
  async function open(){
    try{if(window.state)window.state.view=VIEW;}catch{}
    try{if(typeof shell==='function')shell('Territorio','IGR · amenaza territorial LA · historia real 2020–2025');}catch{}
    ensureHostStyle();
    const root=document.querySelector('#content,.v019-content');if(!root)throw new Error('Contenedor Territorio no disponible');
    root.dataset.atlasTerritoryFullscreen='1';root.style.width='100%';root.style.maxWidth='none';root.style.background='var(--atlas-bg,#07111f)';
    root.innerHTML=`<section data-atlas-igr-v2a-host="1" aria-label="Territorio IGR"><iframe title="ATLAS Territorio · IGR" src="${IFRAME}" loading="eager" scrolling="no" referrerpolicy="no-referrer"></iframe></section>`;
    activeFrame=root.querySelector('iframe');
    activeFrame?.addEventListener('load',()=>applySeamlessFrame(activeFrame),{once:true});
    try{await load();}catch(error){console.warn('[ATLAS IGR v2A] data authority',error);}patchMethodology();return true;
  }
  const API={version:VERSION,state,load,open,byCommune,byRegion,scoreFor,exportRows,patchMethodology,syncFramePresentation,method:{formula:'1.00*CEAD_LA',weights:{cead_la:1}}};
  window.AtlasIGRV2A=API;window.v019LoadTerritory=open;window.loadTerritory=open;
  window.ATLAS_TERRITORY_THREAT_CEAD_V1={source:SOURCE,scoreVersion:'1.0.0',topLevelWeight:1,aggregation:'IGR_V2A_CEAD_LA_AUTHORITY',replacedLegacy15Percent:true,seamlessAtlasHost:true,fullWidthAtlasLayout:true,standaloneHtmlAuthority:true};
  window.addEventListener('atlas:nav-refresh',()=>{patchMethodology();syncFramePresentation();});
  window.addEventListener('atlas:theme-change',syncFramePresentation);window.addEventListener('atlas:appearance-change',syncFramePresentation);window.addEventListener('pageshow',()=>{patchMethodology();syncFramePresentation();});window.addEventListener('resize',()=>resizeFrame(activeFrame));
  setTimeout(()=>{void load().catch(()=>{});patchMethodology();},0);setTimeout(patchMethodology,700);setTimeout(patchMethodology,2500);
})();
