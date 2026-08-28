'use strict';
/* ATLAS AML · Active runtime route authority 0.80.5 · navigation performance
 * Una sola autoridad de rutas, sin observers. Trabajo cosmético/telemetría se
 * difiere fuera de la transición crítica para que el cambio de sección sea inmediato.
 * NO_BODY_TREEWALK_NO_FORCED_SOURCE_REFRESH: no body TreeWalker and no forced source-health refresh.
 */
(function atlasOperationalRecovery0805(){
  if(window.AtlasOperationalRecovery0805)return;
  const VERSION='0.80.5',RELEASE='0.90.1',BUILD='0901',VIEW_SO='sujetos-obligados',VIEW_ENTITIES='entities',VIEW_TERRITORY='territory',VIEW_OSFL='osfl';
  let opening=false,lastView='',sectorRiskPromise=null;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const fn=name=>{try{return typeof window[name]==='function'?window[name]:null;}catch{return null;}};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const idle=cb=>{if(typeof requestIdleCallback==='function')requestIdleCallback(cb,{timeout:500});else setTimeout(cb,60);};
  function enforceRelease(){window.AtlasRelease?.apply?.();window.__ATLAS_RELEASE__={...(window.__ATLAS_RELEASE__||{}),version:RELEASE,build:BUILD,active:true,freezeGuard:'TARGETED_ONLY',checkedAt:new Date().toISOString()};}
  function neutralizeLegacyStartupVersion(){const noop=()=>{};try{if(typeof v024ApplyVersion==='function')v024ApplyVersion=noop;}catch{}try{if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=()=>enforceRelease();}catch{}window.__ATLAS_STARTUP_AUTHORITY_0804__={active:true,version:VERSION,release:RELEASE,build:BUILD,legacyV024VersionWriter:false,renderGate:'BODY_AML_RUNTIME_READY',policy:'ONE_VISIBLE_RENDER_AFTER_FINAL_RUNTIME',installedAt:new Date().toISOString()};}
  function publish(status,extra={}){window.__ATLAS_OPERATIONAL_RECOVERY_0704__={active:true,version:VERSION,release:RELEASE,build:BUILD,status,radar:!!(fn('v019LoadOverview')||fn('loadOverview')),territory:!!fn('v019LoadTerritory'),osfl:!!fn('v030LoadOsfl'),questions:!!fn('v019LoadQuestions'),entities:!!window.__ATLAS_ENTITY_ENTRY__,universo080:!!window.AtlasUniversoSO0800,publicSpend:!!window.AtlasPublicSpendV2,indicatorMethodology:!!window.AtlasIndicatorMethodologyV1,irarE:!!(window.ATLAS_IRAR_E_CURRENT&&window.AtlasRadarIrarE0961),routePolicy:'SINGLE_CAPTURE_FAST_TRANSITION',startupPolicy:'ONE_VISIBLE_RENDER_AFTER_FINAL_RUNTIME',freezeGuard:'NO_BODY_TREEWALK_NO_FORCED_SOURCE_REFRESH:DEFER_NONCRITICAL_UI_AND_SOURCE_HEALTH',checkedAt:new Date().toISOString(),...extra};}
  function viewFrom(target){if(!target)return '';const explicit=target.dataset?.view||target.dataset?.atlasMobileView||'';if(explicit)return explicit;const text=norm(target.textContent);if(text==='radar integrado')return 'overview';if(text==='entidades')return VIEW_ENTITIES;if(text==='territorio')return VIEW_TERRITORY;if(text==='osfl')return VIEW_OSFL;if(text==='preguntas')return 'questions';if(text==='universo so')return VIEW_SO;if(text==='gasto publico')return 'public-spend';return '';}
  function setState(view){try{if(window.state)window.state.view=view;}catch{}}
  function markBusy(view,busy){document.documentElement.toggleAttribute('data-atlas-navigating',!!busy);document.querySelectorAll('.v019-nav-btn[data-view],.atlas-nav-btn[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(busy){const c=document.querySelector('#content,.v019-content');if(c&&!c.querySelector('[data-atlas-route-loading]'))c.insertAdjacentHTML('afterbegin','<div data-atlas-route-loading="1" class="loading">Cargando sección…</div>');}}
  function ensureIndicatorMethodology(){
    if(!document.querySelector('link[data-atlas-indicator-methodology]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./assets/atlas-indicator-methodology-0910.css?v=0910-1';l.dataset.atlasIndicatorMethodology='style';document.head.appendChild(l);}
    if(window.AtlasIndicatorMethodologyV1){window.AtlasIndicatorMethodologyV1.refresh?.();return true;}
    if(!document.querySelector('script[data-atlas-indicator-methodology]')){const s=document.createElement('script');s.src='./assets/atlas-indicator-methodology-0910.js?v=0910-1';s.defer=true;s.dataset.atlasIndicatorMethodology='script';s.addEventListener('load',()=>window.AtlasIndicatorMethodologyV1?.refresh?.());document.body.appendChild(s);}
    return false;
  }
  function ensureSectorRiskIrarE(){
    if(window.ATLAS_IRAR_E_CURRENT&&window.AtlasRadarIrarE0961)return Promise.resolve(true);
    if(sectorRiskPromise)return sectorRiskPromise;
    if(!document.querySelector('link[data-atlas-irar-e="0961"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./assets/atlas-radar-irar-e-0961.css?v=0961-1';l.dataset.atlasIrarE='0961';document.head.appendChild(l);}
    const loadScript=(selector,src,key)=>new Promise(resolve=>{
      if((key==='core'&&window.ATLAS_IRAR_E_CURRENT)||(key==='ui'&&window.AtlasRadarIrarE0961)){resolve(true);return;}
      let s=document.querySelector(selector);
      if(s){s.addEventListener('load',()=>resolve(true),{once:true});s.addEventListener('error',()=>resolve(false),{once:true});return;}
      s=document.createElement('script');s.src=src;s.dataset.atlasIrarE=key;s.addEventListener('load',()=>resolve(true),{once:true});s.addEventListener('error',()=>resolve(false),{once:true});document.body.appendChild(s);
    });
    sectorRiskPromise=(async()=>{
      const coreOk=await loadScript('script[data-atlas-irar-e="core"]','./assets/atlas-irar-e-current.js?v=0961-1','core');
      if(!coreOk||!window.ATLAS_IRAR_E_CURRENT)return false;
      const uiOk=await loadScript('script[data-atlas-irar-e="ui"]','./assets/atlas-radar-irar-e-0961.js?v=0961-1','ui');
      window.AtlasRadarIrarE0961?.refresh?.();publish('irar-e-ready',{irarE:!!window.AtlasRadarIrarE0961});return !!uiOk;
    })().catch(error=>{console.warn('[ATLAS] IRAR-E runtime unavailable',error);return false;});
    return sectorRiskPromise;
  }
  function deferredHousekeeping(){idle(()=>{try{ensureMenu();ensureIndicatorMethodology();void ensureSectorRiskIrarE();window.AtlasIndicatorMethodologyV1?.refresh?.();window.AtlasCurrentUI?.refresh?.();window.AtlasGlobalSourceHealth?.schedule?.();}catch{}});}
  async function refreshUniversoState(){const client=db(),core=window.__ATLAS_OBLIGATED__;if(!client||!core?.state)return false;const [uni,sec]=await Promise.all([client.from('aml_v_uaf_universe_current_v0671').select('*').maybeSingle(),client.from('aml_v_uaf_potential_sector_current_v0671').select('*').order('potential_ruts',{ascending:false}).order('sector',{ascending:true})]);if(uni.error)throw uni.error;if(sec.error)throw sec.error;if(!uni.data)return false;const row=uni.data,sectors=sec.data||[];core.state.overview=core.state.overview||{};core.state.overview.registry=core.state.overview.registry||{};core.state.overview.registry.subjects=Number(row.obligated_ruts||0);core.state.overview.potential=core.state.overview.potential||{};core.state.overview.potential.universe={...(core.state.overview.potential.universe||{}),candidates:Number(row.potential_ruts||0),actionable:Number(row.potential_ruts||0),res_overlap:Number(row.potential_res_overlap_ruts||0),sectors:sectors.length,definition:'ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',sii_cutoff:row.sii_cutoff||null,refreshed_at:row.refreshed_at||null};core.state.overview.potential.sectors=sectors.map(r=>({sector:r.sector,candidates:Number(r.potential_ruts||0),actionable:Number(r.potential_ruts||0),res_overlap:Number(r.res_overlap_ruts||0)}));return true;}
  async function openUniverso(){setState(VIEW_SO);const current=window.AtlasUniversoSO0800;if(typeof current?.open==='function')return current.open('inscritos');const old=window.AtlasUniversoSO0720;if(typeof old?.open==='function')return old.open('panorama');const core=window.__ATLAS_OBLIGATED__;if(typeof core?.open==='function')return core.open();throw new Error('Universo SO Intelligence 0.80 no disponible');}
  async function openTerritory(){setState(VIEW_TERRITORY);const loader=fn('v019LoadTerritory');if(!loader)throw new Error('Loader Territorio no disponible');return loader();}
  async function openOsfl(){setState(VIEW_OSFL);const loader=fn('v030LoadOsfl');if(!loader)throw new Error('Loader OSFL canónico no disponible');const result=await loader();window.__ATLAS_OSFL_CURRENT__={release:RELEASE,build:BUILD,authority:'OSFL_CANONICAL_ROUTE_0801',entityRuntime:'aml_osfl_entity_runtime_snapshot',regionRuntime:'aml_osfl_region_runtime_snapshot',renderedAt:new Date().toISOString()};return result;}
  async function openEntities(){setState(VIEW_ENTITIES);const entry=window.__ATLAS_ENTITY_ENTRY__;if(!entry||typeof entry.load!=='function')throw new Error('Explorador de Entidades canónico no disponible');const result=await entry.load();window.__ATLAS_ENTITY360_CURRENT__={...(window.__ATLAS_ENTITY360_CURRENT__||{}),release:RELEASE,build:BUILD,authority:'ENTITY_EXPLORER_0512_CANONICAL_ROUTE',mode:'idle',routeAuthority:'OPERATIONAL_RECOVERY_0805',renderedAt:new Date().toISOString()};return result;}
  async function open(view,source='delegated-click'){
    if(opening){if(view===lastView)return false;return false;}
    opening=true;lastView=view;setState(view);markBusy(view,true);publish('opening',{view,source});
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
      let result;
      if(view==='overview'){await ensureSectorRiskIrarE();const loader=fn('v019LoadOverview')||fn('loadOverview');if(!loader)throw new Error('Loader Radar Integrado no disponible');result=await loader();window.AtlasRadarIrarE0961?.refresh?.();}
      else if(view===VIEW_ENTITIES)result=await openEntities();
      else if(view===VIEW_TERRITORY)result=await openTerritory();
      else if(view===VIEW_OSFL)result=await openOsfl();
      else if(view==='questions'){const loader=fn('v019LoadQuestions');if(!loader)throw new Error('Loader Preguntas no disponible');result=await loader();}
      else if(view===VIEW_SO)result=await openUniverso();
      else if(view==='public-spend'){const api=window.AtlasPublicSpendV2;if(typeof api?.open!=='function')throw new Error('Gasto Público Intelligence no disponible');result=await api.open();}
      else return false;
      window.AtlasIndicatorMethodologyV1?.refresh?.();publish('ready',{view,source});deferredHousekeeping();return result===undefined?true:result;
    }catch(error){publish('error',{view,source,error:String(error?.message||error)});console.error('[ATLAS route 0.80.5]',view,error);return false;}
    finally{markBusy(view,false);opening=false;}
  }
  function ensureMenu(){const nav=document.querySelector('.v019-nav');if(!nav)return false;let gp=nav.querySelector('[data-view="public-spend"]');if(!gp&&typeof window.AtlasPublicSpendV2?.open==='function'){gp=document.createElement('button');gp.type='button';gp.className='v019-nav-btn atlas-nav-btn';gp.dataset.view='public-spend';gp.textContent='Gasto público';nav.appendChild(gp);}return true;}
  function installShellHook(){const current=window.shell;if(typeof current!=='function'||current.__atlas0805Shell)return;const wrapped=function(...args){const out=current.apply(this,args);requestAnimationFrame(()=>{ensureMenu();ensureIndicatorMethodology();void ensureSectorRiskIrarE();window.AtlasIndicatorMethodologyV1?.refresh?.();});return out;};Object.defineProperty(wrapped,'__atlas0805Shell',{value:true});window.shell=wrapped;}
  const HANDLED=new Set(['overview',VIEW_ENTITIES,VIEW_TERRITORY,VIEW_OSFL,'questions',VIEW_SO,'public-spend']);
  document.addEventListener('click',event=>{const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button,a');const view=viewFrom(target);if(!HANDLED.has(view))return;event.preventDefault();event.stopImmediatePropagation();void open(view,'capture-click');},true);
  window.addEventListener('pageshow',()=>{neutralizeLegacyStartupVersion();installShellHook();ensureMenu();ensureIndicatorMethodology();void ensureSectorRiskIrarE();enforceRelease();deferredHousekeeping();});
  window.addEventListener('atlas:nav-refresh',()=>requestAnimationFrame(()=>{ensureMenu();window.AtlasIndicatorMethodologyV1?.refresh?.();window.AtlasRadarIrarE0961?.refresh?.();}));
  window.addEventListener('atlas:public-spend-v2-ready',()=>{ensureMenu();window.AtlasIndicatorMethodologyV1?.refresh?.();});
  const API={open,openTerritory,openOsfl,openUniverso,openEntities,ensureMenu,ensureIndicatorMethodology,ensureSectorRiskIrarE,refreshUniversoState,enforceRelease,neutralizeLegacyStartupVersion,health:()=>window.__ATLAS_OPERATIONAL_RECOVERY_0704__};
  window.AtlasOperationalRecovery0805=API;window.AtlasOperationalRecovery0804=API;window.AtlasOperationalRecovery0801=API;window.AtlasOperationalRecovery0800=API;window.AtlasOperationalRecovery0721=API;window.AtlasOperationalRecovery0705=API;window.AtlasOperationalRecovery0704=API;
  neutralizeLegacyStartupVersion();installShellHook();enforceRelease();ensureIndicatorMethodology();void ensureSectorRiskIrarE();requestAnimationFrame(()=>ensureMenu());deferredHousekeeping();publish('installed');
})();
