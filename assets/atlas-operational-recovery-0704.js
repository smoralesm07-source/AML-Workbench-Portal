'use strict';
/* ATLAS AML · Operational recovery 0.70.4
 * Single delegated navigation guard for the routes reported as non-responsive.
 * It does not rewrite window.navigate and therefore cannot create wrapper chains.
 */
(function atlasOperationalRecovery0704(){
  if(window.AtlasOperationalRecovery0704)return;
  const VERSION='0.70.4';
  const VIEW_SO='sujetos-obligados';
  let opening=false;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const fn=name=>{try{return typeof window[name]==='function'?window[name]:null;}catch(_e){return null;}};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function publish(status,extra={}){
    window.__ATLAS_OPERATIONAL_RECOVERY_0704__={
      active:true,version:VERSION,status,
      radar:!!fn('v019LoadOverview'),questions:!!fn('v019LoadQuestions'),
      universo:!!window.__ATLAS_OBLIGATED__,publicSpend:!!window.AtlasPublicSpendV2,
      checkedAt:new Date().toISOString(),...extra
    };
  }

  function viewFrom(target){
    if(!target)return '';
    const explicit=target.dataset?.view||target.dataset?.atlasMobileView||'';
    if(explicit)return explicit;
    const text=norm(target.textContent);
    if(text==='radar integrado')return 'overview';
    if(text==='preguntas')return 'questions';
    if(text==='universo so')return VIEW_SO;
    if(text==='gasto publico')return 'public-spend';
    return '';
  }

  function setState(view){
    try{if(window.state)window.state.view=view;}catch(_e){}
  }

  async function refreshUniversoState(){
    const client=db(),core=window.__ATLAS_OBLIGATED__;
    if(!client||!core?.state)return false;
    const [uni,sec]=await Promise.all([
      client.from('aml_v_uaf_universe_current_v0671').select('*').maybeSingle(),
      client.from('aml_v_uaf_potential_sector_current_v0671').select('*').order('potential_ruts',{ascending:false}).order('sector',{ascending:true})
    ]);
    if(uni.error)throw uni.error;if(sec.error)throw sec.error;if(!uni.data)throw new Error('Universo SO vigente no materializado');
    const row=uni.data,sectors=sec.data||[];
    core.state.overview=core.state.overview||{};
    core.state.overview.registry=core.state.overview.registry||{};
    core.state.overview.registry.subjects=Number(row.obligated_ruts||0);
    core.state.overview.potential=core.state.overview.potential||{};
    core.state.overview.potential.universe={
      ...(core.state.overview.potential.universe||{}),
      candidates:Number(row.potential_ruts||0),
      actionable:Number(row.potential_ruts||0),
      res_overlap:Number(row.potential_res_overlap_ruts||0),
      sectors:sectors.length,
      definition:'ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',
      sii_cutoff:row.sii_cutoff||null
    };
    core.state.overview.potential.sectors=sectors.map(r=>({
      sector:r.sector,candidates:Number(r.potential_ruts||0),actionable:Number(r.potential_ruts||0),res_overlap:Number(r.res_overlap_ruts||0)
    }));
    window.__ATLAS_UNIVERSO_CURRENT_0704__={
      obligatedRuts:Number(row.obligated_ruts||0),potentialRuts:Number(row.potential_ruts||0),
      resOverlap:Number(row.potential_res_overlap_ruts||0),siiCutoff:row.sii_cutoff||null,
      sectorCount:sectors.length,refreshedAt:row.refreshed_at||null
    };
    return true;
  }

  async function openUniverso(){
    setState(VIEW_SO);
    const recovery=window.AtlasRouteRecovery0703;
    if(recovery?.open)await recovery.open(VIEW_SO,'0704');
    else {
      const core=window.__ATLAS_OBLIGATED__;
      if(!core)throw new Error('Núcleo Universo SO no disponible');
      fn('shell')?.('Universo SO','Padrón de sujetos obligados UAF y universo de potenciales SO, con evidencia y límites metodológicos explícitos.');
      core.state.mode='panorama';core.state.dossier=null;core.render?.();
    }
    await refreshUniversoState();
    const core=window.__ATLAS_OBLIGATED__;
    if(core?.state){core.state.mode='panorama';core.state.error=null;core.render?.();}
    try{window.__ATLAS_UNIVERSO_SO_0640__?.patch?.();}catch(_e){}
    return true;
  }

  async function open(view,source='delegated-click'){
    if(opening)return false;opening=true;publish('opening',{view,source});
    try{
      setState(view);
      let result;
      if(view==='overview'){
        const loader=fn('v019LoadOverview')||fn('loadOverview');if(!loader)throw new Error('Loader Radar Integrado no disponible');result=await loader();
      }else if(view==='questions'){
        const loader=fn('v019LoadQuestions');if(!loader)throw new Error('Loader Preguntas no disponible');result=await loader();
      }else if(view===VIEW_SO){
        result=await openUniverso();
      }else if(view==='public-spend'){
        const api=window.AtlasPublicSpendV2;if(typeof api?.open!=='function')throw new Error('Gasto Público GP2 no disponible');result=await api.open();
      }else return false;
      queueMicrotask(()=>{try{window.AtlasCurrentUI?.refresh?.();ensureMenu();window.AtlasGlobalSourceHealth?.refresh?.();}catch(_e){}});
      publish('ready',{view,source});return result===undefined?true:result;
    }catch(error){publish('error',{view,source,error:String(error?.message||error)});console.error('[ATLAS 0.70.4]',view,error);return false;}
    finally{opening=false;}
  }

  function ensureMenu(){
    const nav=document.querySelector('.v019-nav');if(!nav)return false;
    let gp=nav.querySelector('[data-view="public-spend"]');
    if(!gp&&typeof window.AtlasPublicSpendV2?.open==='function'){
      gp=document.createElement('button');gp.type='button';gp.className='v019-nav-btn atlas-nav-btn';gp.dataset.view='public-spend';gp.textContent='Gasto público';nav.appendChild(gp);
      try{window.AtlasCurrentUI?.refresh?.();}catch(_e){}
    }
    return !!nav.querySelector('[data-view="public-spend"]');
  }

  function installShellHook(){
    const current=window.shell;if(typeof current!=='function'||current.__atlas0704Shell)return;
    const wrapped=function(...args){const out=current.apply(this,args);queueMicrotask(ensureMenu);return out;};
    Object.defineProperty(wrapped,'__atlas0704Shell',{value:true});window.shell=wrapped;
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button,a');
    const view=viewFrom(target);
    if(!['overview','questions',VIEW_SO,'public-spend'].includes(view))return;
    event.preventDefault();event.stopImmediatePropagation();void open(view,'capture-click');
  },true);

  window.addEventListener('pageshow',()=>{installShellHook();ensureMenu();});
  window.addEventListener('atlas:nav-refresh',()=>ensureMenu());
  window.addEventListener('atlas:public-spend-v2-ready',()=>ensureMenu());
  window.AtlasOperationalRecovery0704={open,ensureMenu,refreshUniversoState,health:()=>window.__ATLAS_OPERATIONAL_RECOVERY_0704__};
  installShellHook();setTimeout(ensureMenu,0);setTimeout(ensureMenu,250);setTimeout(ensureMenu,1200);publish('installed');
})();