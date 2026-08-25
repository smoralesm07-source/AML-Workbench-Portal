'use strict';
/* ATLAS AML · Navigation recovery 0.70.4
 *
 * Bootstrap pasivo de recuperación operacional. Mantiene la recuperación
 * directa de Universo SO / Territorio / OSFL y carga la autoridad transversal
 * 0.70.4 para Radar Integrado, Preguntas y Gasto Público.
 */
(function atlasRouteRecovery0704Bootstrap(){
  if(window.AtlasRouteRecovery0703)return;

  const VERSION='0.70.4';
  const SO_VIEW='sujetos-obligados';
  const TERRITORY_VIEW='territory';
  const OSFL_VIEW='osfl';
  const OVERVIEW='aml_uaf_obligated_overview_snapshot';
  const SECTORS='aml_uaf_obligated_sector_snapshot';
  const CURRENT_UNIVERSE='aml_v_uaf_universe_current_v0671';
  const CURRENT_POTENTIAL_SECTORS='aml_v_uaf_potential_sector_current_v0671';
  let dispatching=false;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const soCore=()=>window.__ATLAS_OBLIGATED__||null;
  const host=()=>document.querySelector('#content');

  function loadCss(href,key){if(document.querySelector(`link[data-atlas-${key}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset[`atlas${key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}`]='1';document.head.appendChild(l);}
  function loadScript(src,key,onload){
    const selector=`script[data-atlas-${key}]`,existing=document.querySelector(selector);
    if(existing){if(onload)onload();return existing;}
    const s=document.createElement('script');s.src=src;s.dataset[`atlas${key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}`]='1';if(onload)s.addEventListener('load',onload,{once:true});document.head.appendChild(s);return s;
  }
  function bootstrapOperational(){
    loadCss('./assets/atlas-public-spend-v2.css?v=gp2-2','gp2-css');
    const ready=()=>loadScript('./assets/atlas-operational-recovery-0704.js?v=0704-1','op-0704');
    if(window.AtlasPublicSpendV2)ready();else loadScript('./assets/atlas-public-spend-v2.js?v=gp2-2','gp2-js',ready);
  }

  function publish(status,extra={}){
    window.__ATLAS_ROUTE_RECOVERY_0703__={
      active:true,
      version:VERSION,
      passive:true,
      navigateMutation:false,
      mutationObserver:false,
      status,
      territoryLoader:typeof window.v019LoadTerritory==='function'||typeof v019LoadTerritory==='function',
      osflLoader:typeof window.v030LoadOsfl==='function'||typeof v030LoadOsfl==='function',
      obligatedCore:!!soCore(),
      checkedAt:new Date().toISOString(),
      ...extra
    };
    window.__ATLAS_UNIVERSO_SO_0700__={
      active:true,
      workbench:false,
      routeAuthority:false,
      passiveRecovery:true,
      version:VERSION,
      status,
      checkedAt:new Date().toISOString(),
      ...extra
    };
  }

  async function hydrateUniverso(){
    const api=soCore();
    if(!api)throw new Error('El núcleo de Universo SO no está disponible.');
    const client=db();
    if(!client)throw new Error('La sesión de datos no está disponible.');

    /* Always refresh CURRENT on route entry. This prevents a previously loaded
       overview payload from pinning Universo SO to an older potential universe. */
    const [ov,sec,current,currentSectors]=await Promise.all([
      client.from(OVERVIEW).select('payload,refreshed_at').eq('snapshot_key','CURRENT').maybeSingle(),
      client.from(SECTORS).select('*').order('subject_count',{ascending:false}),
      client.from(CURRENT_UNIVERSE).select('*').maybeSingle(),
      client.from(CURRENT_POTENTIAL_SECTORS).select('*').order('potential_ruts',{ascending:false}).order('sector',{ascending:true})
    ]);
    if(ov.error)throw ov.error;
    if(sec.error)throw sec.error;
    if(current.error)throw current.error;
    if(currentSectors.error)throw currentSectors.error;
    if(!ov.data)throw new Error('El panorama del padrón aún no está materializado en este corte.');
    if(!current.data)throw new Error('El universo potencial vigente aún no está materializado.');

    api.state.overview=ov.data.payload||{};
    api.state.overviewAt=ov.data.refreshed_at||null;
    api.state.sectors=sec.data||[];

    const row=current.data,potentialSectors=currentSectors.data||[];
    api.state.overview.registry=api.state.overview.registry||{};
    api.state.overview.registry.subjects=Number(row.obligated_ruts||0);
    api.state.overview.potential=api.state.overview.potential||{};
    api.state.overview.potential.universe={
      ...(api.state.overview.potential.universe||{}),
      candidates:Number(row.potential_ruts||0),
      actionable:Number(row.potential_ruts||0),
      res_overlap:Number(row.potential_res_overlap_ruts||0),
      sectors:potentialSectors.length,
      definition:'ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',
      sii_cutoff:row.sii_cutoff||null,
      refreshed_at:row.refreshed_at||null
    };
    api.state.overview.potential.sectors=potentialSectors.map(r=>({
      sector:r.sector,
      candidates:Number(r.potential_ruts||0),
      actionable:Number(r.potential_ruts||0),
      res_overlap:Number(r.res_overlap_ruts||0)
    }));
    window.__ATLAS_UNIVERSO_CURRENT_0704__={
      obligatedRuts:Number(row.obligated_ruts||0),
      potentialRuts:Number(row.potential_ruts||0),
      resOverlap:Number(row.potential_res_overlap_ruts||0),
      siiCutoff:row.sii_cutoff||null,
      sectorCount:potentialSectors.length,
      refreshedAt:row.refreshed_at||null
    };
    return true;
  }

  async function openUniverso(source='delegated-click'){
    const api=soCore();
    if(!api)throw new Error('Universo SO no terminó de cargar.');
    if(typeof window.shell==='function'){
      window.shell('Universo SO','Padrón de sujetos obligados UAF y universo de potenciales SO, con priorización fiscalizadora, evidencia y límites metodológicos explícitos.');
    }
    const box=host();
    if(box)box.innerHTML='<section class="so-root"><div class="so-loading">Consultando el padrón de sujetos obligados bajo la sesión autorizada…</div></section>';
    await hydrateUniverso();
    api.state.error=null;
    api.state.mode='panorama';
    api.state.dossier=null;
    api.render();
    try{window.__ATLAS_UNIVERSO_SO_0640__?.patch?.();}catch(_e){}
    window.dispatchEvent(new CustomEvent('atlas:nav-refresh'));
    publish('ready',{view:SO_VIEW,source,current:window.__ATLAS_UNIVERSO_CURRENT_0704__||null});
    return true;
  }

  async function openTerritory(source='delegated-click'){
    const loader=typeof window.v019LoadTerritory==='function'?window.v019LoadTerritory:(typeof v019LoadTerritory==='function'?v019LoadTerritory:null);
    if(!loader)throw new Error('El loader canónico de Territorio no está disponible.');
    const result=await loader();
    publish('ready',{view:TERRITORY_VIEW,source});
    return result;
  }

  async function openOsfl(source='delegated-click'){
    const loader=typeof window.v030LoadOsfl==='function'?window.v030LoadOsfl:(typeof v030LoadOsfl==='function'?v030LoadOsfl:null);
    if(!loader)throw new Error('El loader canónico de OSFL no está disponible.');
    const result=await loader();
    publish('ready',{view:OSFL_VIEW,source});
    return result;
  }

  async function open(view,source='api'){
    if(dispatching)return false;
    dispatching=true;
    publish('opening',{view,source});
    try{
      if(view===SO_VIEW)return await openUniverso(source);
      if(view===TERRITORY_VIEW)return await openTerritory(source);
      if(view===OSFL_VIEW)return await openOsfl(source);
      return false;
    }catch(error){
      const message=String(error?.message||error);
      if(view===SO_VIEW){
        const api=soCore();
        if(api?.state){api.state.error=message;api.state.mode='panorama';}
        try{api?.render?.();}catch(_e){const box=host();if(box)box.innerHTML='<section class="so-root"><div class="so-error">No fue posible abrir Universo SO.</div></section>';}
      }
      publish('error',{view,source,error:message});
      console.error('[ATLAS route recovery 0.70.4]',view,error);
      return false;
    }finally{
      dispatching=false;
    }
  }

  function viewFromTarget(target){
    if(!target)return '';
    const explicit=target.dataset?.view||target.dataset?.atlasMobileView||'';
    if([SO_VIEW,TERRITORY_VIEW,OSFL_VIEW].includes(explicit))return explicit;
    const text=String(target.textContent||'').trim();
    if(/^Universo SO\b/i.test(text))return SO_VIEW;
    if(/^Territorio\b/i.test(text))return TERRITORY_VIEW;
    if(/^OSFL\b/i.test(text))return OSFL_VIEW;
    return '';
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button');
    const view=viewFromTarget(target);
    if(!view)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void open(view,'capture-click');
  },true);

  window.AtlasRouteRecovery0703={
    open,
    health:()=>window.__ATLAS_ROUTE_RECOVERY_0703__||null,
    hydrateUniverso,
    policy:'PASSIVE_DELEGATED_NO_NAVIGATE_MUTATION_NO_OBSERVER'
  };

  bootstrapOperational();
  publish('installed');
})();