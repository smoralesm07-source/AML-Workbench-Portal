'use strict';
/* ATLAS AML · Active runtime route authority 0.72.1 · freeze-safe
 * Autoridad final y única para rutas superiores críticas.
 * No muta window.navigate y no usa MutationObserver.
 */
(function atlasOperationalRecovery0721(){
  if(window.AtlasOperationalRecovery0721)return;
  const VERSION='0.72.1',RELEASE='0.70.5',VIEW_SO='sujetos-obligados',VIEW_ENTITIES='entities',VIEW_TERRITORY='territory';
  let opening=false;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const fn=name=>{try{return typeof window[name]==='function'?window[name]:null;}catch{return null;}};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function enforceRelease(){
    window.AtlasRelease?.apply?.();
    /* Mantiene la versión de release del producto; 0.72.1 identifica solo la autoridad de rutas. */
    window.__ATLAS_RELEASE__={...(window.__ATLAS_RELEASE__||{}),version:RELEASE,build:'0705',active:true,freezeGuard:'TARGETED_ONLY',checkedAt:new Date().toISOString()};
  }
  function publish(status,extra={}){
    enforceRelease();
    window.__ATLAS_OPERATIONAL_RECOVERY_0704__={
      active:true,version:VERSION,status,
      radar:!!(fn('v019LoadOverview')||fn('loadOverview')),
      territory:!!fn('v019LoadTerritory'),
      questions:!!fn('v019LoadQuestions'),
      entities:!!window.__ATLAS_ENTITY_ENTRY__,
      universo072:!!window.AtlasUniversoSO0720,
      publicSpend:!!window.AtlasPublicSpendV2,
      routePolicy:'SINGLE_CAPTURE_NO_NAVIGATE_MUTATION',
      freezeGuard:'NO_BODY_TREEWALK_NO_FORCED_SOURCE_REFRESH',
      checkedAt:new Date().toISOString(),...extra
    };
  }
  function viewFrom(target){
    if(!target)return '';
    const explicit=target.dataset?.view||target.dataset?.atlasMobileView||'';
    if(explicit)return explicit;
    const text=norm(target.textContent);
    if(text==='radar integrado')return 'overview';
    if(text==='entidades')return VIEW_ENTITIES;
    if(text==='territorio')return VIEW_TERRITORY;
    if(text==='preguntas')return 'questions';
    if(text==='universo so')return VIEW_SO;
    if(text==='gasto publico')return 'public-spend';
    return '';
  }
  function setState(view){try{if(window.state)window.state.view=view;}catch{}}

  async function refreshUniversoState(){
    const client=db(),core=window.__ATLAS_OBLIGATED__;if(!client||!core?.state)return false;
    const [uni,sec]=await Promise.all([
      client.from('aml_v_uaf_universe_current_v0671').select('*').maybeSingle(),
      client.from('aml_v_uaf_potential_sector_current_v0671').select('*').order('potential_ruts',{ascending:false}).order('sector',{ascending:true})
    ]);
    if(uni.error)throw uni.error;if(sec.error)throw sec.error;if(!uni.data)return false;
    const row=uni.data,sectors=sec.data||[];
    core.state.overview=core.state.overview||{};core.state.overview.registry=core.state.overview.registry||{};core.state.overview.registry.subjects=Number(row.obligated_ruts||0);
    core.state.overview.potential=core.state.overview.potential||{};
    core.state.overview.potential.universe={...(core.state.overview.potential.universe||{}),candidates:Number(row.potential_ruts||0),actionable:Number(row.potential_ruts||0),res_overlap:Number(row.potential_res_overlap_ruts||0),sectors:sectors.length,definition:'ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',sii_cutoff:row.sii_cutoff||null,refreshed_at:row.refreshed_at||null};
    core.state.overview.potential.sectors=sectors.map(r=>({sector:r.sector,candidates:Number(r.potential_ruts||0),actionable:Number(r.potential_ruts||0),res_overlap:Number(r.res_overlap_ruts||0)}));
    return true;
  }
  async function openUniverso(){
    setState(VIEW_SO);
    const current=window.AtlasUniversoSO0720;
    if(typeof current?.open==='function')return current.open('panorama');
    const compat=window.AtlasUniversoSO0710;
    if(typeof compat?.open==='function')return compat.open('panorama');
    const core=window.__ATLAS_OBLIGATED__;
    if(typeof core?.open==='function')return core.open();
    throw new Error('Universo SO 0.72 no disponible');
  }
  async function openTerritory(){
    setState(VIEW_TERRITORY);
    const loader=fn('v019LoadTerritory');
    if(!loader)throw new Error('Loader Territorio no disponible');
    return loader();
  }
  async function openEntities(){
    setState(VIEW_ENTITIES);
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.load!=='function')throw new Error('Explorador de Entidades canónico no disponible');
    const result=await entry.load();
    window.__ATLAS_ENTITY360_CURRENT__={...(window.__ATLAS_ENTITY360_CURRENT__||{}),release:RELEASE,build:'0705',authority:'ENTITY_EXPLORER_0512_CANONICAL_ROUTE',mode:'idle',routeAuthority:'OPERATIONAL_RECOVERY_0721',renderedAt:new Date().toISOString()};
    return result;
  }

  async function open(view,source='delegated-click'){
    if(opening)return false;opening=true;publish('opening',{view,source});
    try{
      setState(view);let result;
      if(view==='overview'){
        const loader=fn('v019LoadOverview')||fn('loadOverview');
        if(!loader)throw new Error('Loader Radar Integrado no disponible');
        result=await loader();
      }else if(view===VIEW_ENTITIES)result=await openEntities();
      else if(view===VIEW_TERRITORY)result=await openTerritory();
      else if(view==='questions'){
        const loader=fn('v019LoadQuestions');if(!loader)throw new Error('Loader Preguntas no disponible');result=await loader();
      }else if(view===VIEW_SO)result=await openUniverso();
      else if(view==='public-spend'){
        const api=window.AtlasPublicSpendV2;if(typeof api?.open!=='function')throw new Error('Gasto Público GP2 no disponible');result=await api.open();
      }else return false;
      queueMicrotask(()=>{try{ensureMenu();window.AtlasCurrentUI?.refresh?.();window.AtlasGlobalSourceHealth?.schedule?.();window.AtlasRelease?.apply?.();}catch{}});
      publish('ready',{view,source});return result===undefined?true:result;
    }catch(error){
      publish('error',{view,source,error:String(error?.message||error)});
      console.error('[ATLAS route 0.72.1]',view,error);return false;
    }finally{opening=false;}
  }

  function ensureMenu(){
    const nav=document.querySelector('.v019-nav');if(!nav)return false;
    let gp=nav.querySelector('[data-view="public-spend"]');
    if(!gp&&typeof window.AtlasPublicSpendV2?.open==='function'){
      gp=document.createElement('button');gp.type='button';gp.className='v019-nav-btn atlas-nav-btn';gp.dataset.view='public-spend';gp.textContent='Gasto público';nav.appendChild(gp);
      try{window.AtlasCurrentUI?.refresh?.();}catch{}
    }
    return true;
  }
  function installShellHook(){
    const current=window.shell;if(typeof current!=='function'||current.__atlas0721Shell)return;
    const wrapped=function(...args){const out=current.apply(this,args);queueMicrotask(()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();window.AtlasRelease?.apply?.();});return out;};
    Object.defineProperty(wrapped,'__atlas0721Shell',{value:true});window.shell=wrapped;
  }

  const HANDLED=new Set(['overview',VIEW_ENTITIES,VIEW_TERRITORY,'questions',VIEW_SO,'public-spend']);
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button,a');
    const view=viewFrom(target);
    if(!HANDLED.has(view))return;
    event.preventDefault();event.stopImmediatePropagation();void open(view,'capture-click');
  },true);
  window.addEventListener('pageshow',()=>{installShellHook();ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();});
  window.addEventListener('atlas:nav-refresh',()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();});
  window.addEventListener('atlas:public-spend-v2-ready',()=>ensureMenu());

  window.AtlasOperationalRecovery0721={open,openTerritory,openUniverso,openEntities,ensureMenu,refreshUniversoState,enforceRelease,health:()=>window.__ATLAS_OPERATIONAL_RECOVERY_0704__};
  window.AtlasOperationalRecovery0705=window.AtlasOperationalRecovery0721;
  window.AtlasOperationalRecovery0704=window.AtlasOperationalRecovery0721;
  installShellHook();enforceRelease();
  setTimeout(()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();},0);
  setTimeout(()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();},400);
  publish('installed');
})();
