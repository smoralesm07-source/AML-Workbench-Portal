'use strict';
/* ATLAS AML · Active runtime authority 0.70.5 · freeze-safe */
(function atlasOperationalRecovery0705(){
  if(window.AtlasOperationalRecovery0705)return;
  const VERSION='0.70.5',VIEW_SO='sujetos-obligados',VIEW_ENTITIES='entities';
  let opening=false;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const fn=name=>{try{return typeof window[name]==='function'?window[name]:null;}catch{return null;}};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function enforceRelease(){
    window.AtlasRelease?.apply?.();
    window.__ATLAS_RELEASE__={version:VERSION,build:'0705',active:true,freezeGuard:'TARGETED_ONLY',checkedAt:new Date().toISOString()};
  }
  function publish(status,extra={}){
    enforceRelease();
    window.__ATLAS_OPERATIONAL_RECOVERY_0704__={active:true,version:VERSION,status,radar:!!fn('v019LoadOverview'),questions:!!fn('v019LoadQuestions'),entities:!!window.__ATLAS_ENTITY_ENTRY__,universo:!!window.__ATLAS_OBLIGATED__,publicSpend:!!window.AtlasPublicSpendV2,freezeGuard:'NO_BODY_TREEWALK_NO_FORCED_SOURCE_REFRESH',checkedAt:new Date().toISOString(),...extra};
  }
  function viewFrom(target){
    if(!target)return '';
    const explicit=target.dataset?.view||target.dataset?.atlasMobileView||'';
    if(explicit)return explicit;
    const text=norm(target.textContent);
    if(text==='radar integrado')return 'overview';
    if(text==='entidades')return VIEW_ENTITIES;
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
    if(uni.error)throw uni.error;if(sec.error)throw sec.error;if(!uni.data)throw new Error('Universo SO vigente no materializado');
    const row=uni.data,sectors=sec.data||[];
    core.state.overview=core.state.overview||{};core.state.overview.registry=core.state.overview.registry||{};core.state.overview.registry.subjects=Number(row.obligated_ruts||0);
    core.state.overview.potential=core.state.overview.potential||{};
    core.state.overview.potential.universe={...(core.state.overview.potential.universe||{}),candidates:Number(row.potential_ruts||0),actionable:Number(row.potential_ruts||0),res_overlap:Number(row.potential_res_overlap_ruts||0),sectors:sectors.length,definition:'ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',sii_cutoff:row.sii_cutoff||null,refreshed_at:row.refreshed_at||null};
    core.state.overview.potential.sectors=sectors.map(r=>({sector:r.sector,candidates:Number(r.potential_ruts||0),actionable:Number(r.potential_ruts||0),res_overlap:Number(r.res_overlap_ruts||0)}));
    window.__ATLAS_UNIVERSO_CURRENT_0705__={obligatedRuts:Number(row.obligated_ruts||0),potentialRuts:Number(row.potential_ruts||0),resOverlap:Number(row.potential_res_overlap_ruts||0),siiCutoff:row.sii_cutoff||null,sectorCount:sectors.length,refreshedAt:row.refreshed_at||null};
    return true;
  }
  async function openUniverso(){setState(VIEW_SO);const canonical=window.AtlasUniversoSO0705;if(canonical?.open)return canonical.open();const recovery=window.AtlasRouteRecovery0703;if(recovery?.open)return recovery.open(VIEW_SO,'0705');throw new Error('Universo SO canónico no disponible');}
  async function openEntities(){
    setState(VIEW_ENTITIES);
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.load!=='function')throw new Error('Explorador de Entidades canónico no disponible');
    const result=await entry.load();
    window.__ATLAS_ENTITY360_CURRENT__={...(window.__ATLAS_ENTITY360_CURRENT__||{}),release:VERSION,build:'0705',authority:'ENTITY_EXPLORER_0512_CANONICAL_ROUTE',mode:'idle',routeAuthority:'OPERATIONAL_RECOVERY_0714',renderedAt:new Date().toISOString()};
    return result;
  }

  async function open(view,source='delegated-click'){
    if(opening)return false;opening=true;publish('opening',{view,source});
    try{
      setState(view);let result;
      if(view==='overview'){const loader=fn('v019LoadOverview')||fn('loadOverview');if(!loader)throw new Error('Loader Radar Integrado no disponible');result=await loader();}
      else if(view===VIEW_ENTITIES)result=await openEntities();
      else if(view==='questions'){const loader=fn('v019LoadQuestions');if(!loader)throw new Error('Loader Preguntas no disponible');result=await loader();}
      else if(view===VIEW_SO)result=await openUniverso();
      else if(view==='public-spend'){const api=window.AtlasPublicSpendV2;if(typeof api?.open!=='function')throw new Error('Gasto Público GP2 no disponible');result=await api.open();}
      else return false;
      queueMicrotask(()=>{try{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();window.AtlasRelease?.apply?.();}catch{}});
      publish('ready',{view,source});return result===undefined?true:result;
    }catch(error){publish('error',{view,source,error:String(error?.message||error)});console.error('[ATLAS 0.70.5]',view,error);return false;}
    finally{opening=false;}
  }

  function ensureMenu(){
    const nav=document.querySelector('.v019-nav');if(!nav)return false;
    let gp=nav.querySelector('[data-view="public-spend"]');
    if(!gp&&typeof window.AtlasPublicSpendV2?.open==='function'){
      gp=document.createElement('button');gp.type='button';gp.className='v019-nav-btn atlas-nav-btn';gp.dataset.view='public-spend';gp.textContent='Gasto público';nav.appendChild(gp);
      try{window.AtlasCurrentUI?.refresh?.();}catch{}
    }
    return !!nav.querySelector('[data-view="public-spend"]');
  }
  function installShellHook(){
    const current=window.shell;if(typeof current!=='function'||current.__atlas0705Shell)return;
    const wrapped=function(...args){const out=current.apply(this,args);queueMicrotask(()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();window.AtlasRelease?.apply?.();});return out;};
    Object.defineProperty(wrapped,'__atlas0705Shell',{value:true});window.shell=wrapped;
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button,a');
    const view=viewFrom(target);
    if(!['overview',VIEW_ENTITIES,'questions',VIEW_SO,'public-spend'].includes(view))return;
    event.preventDefault();event.stopImmediatePropagation();void open(view,'capture-click');
  },true);
  window.addEventListener('pageshow',()=>{installShellHook();ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();});
  window.addEventListener('atlas:nav-refresh',()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();});
  window.addEventListener('atlas:public-spend-v2-ready',()=>ensureMenu());

  window.AtlasOperationalRecovery0705={open,openEntities,ensureMenu,refreshUniversoState,enforceRelease,health:()=>window.__ATLAS_OPERATIONAL_RECOVERY_0704__};
  window.AtlasOperationalRecovery0704=window.AtlasOperationalRecovery0705;
  installShellHook();enforceRelease();
  setTimeout(()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();},0);
  setTimeout(()=>{ensureMenu();window.AtlasGlobalSourceHealth?.schedule?.();enforceRelease();},400);
  publish('installed');
})();
