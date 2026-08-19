'use strict';

/* ATLAS AML · UAF ↔ SII reconciliation live authority
 * Session-aware, no-zero-cache and view-scoped. The observer is debounced and
 * never starts a second reconciliation request while one is already running.
 */
(function atlasReconciliationLive(){
  const VIEW='aml_v0210_uaf_sii_reconciliation';
  let lastGood=null;
  let hydrateToken=0;
  let hydrateTimer=null;
  let inFlight=null;

  function isOverview(){return typeof state!=='undefined'&&state.view==='overview';}

  async function count(status){
    let q=sb.from(VIEW).select('entity_id',{count:'exact',head:true});
    if(status)q=q.eq('reconciliation_status',status);
    const {count,error}=await q;
    if(error)throw error;
    return count||0;
  }

  async function loadCounts(){
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    if(!data?.session)throw new Error('Sesión Supabase no disponible para conciliación UAF↔SII.');
    const [total,active,terminated,noSii]=await Promise.all([
      count(),count('SII_ACTIVE'),count('SII_TERMINATED'),count('NO_SII_PROFILE')
    ]);
    if(!total)throw new Error('La conciliación UAF↔SII devolvió cero filas bajo la sesión actual.');
    const result={total,active,terminated,noSii,matched:active+terminated,review:terminated+noSii};
    lastGood=result;
    try{if(typeof V0205_COUNTS!=='undefined')V0205_COUNTS=result;}catch{}
    return result;
  }

  function bind(scope){
    scope?.querySelectorAll('[data-v036-recon]').forEach(button=>{
      if(button.dataset.atlasReconLiveBound)return;
      button.addEventListener('click',()=>{
        if(typeof v0205LoadReconciliation==='function')void v0205LoadReconciliation(button.dataset.v036Recon);
      });
      button.dataset.atlasReconLiveBound='1';
    });
  }

  function render(counts){
    const ctx=window.__AML_V036_CONTEXT;
    if(!ctx||!isOverview())return;
    ctx.counts=counts;
    try{if(typeof V036_STATE!=='undefined')V036_STATE.ctx=ctx;}catch{}
    const flow=document.querySelector('.v036-flow');
    const card=flow?.closest('.v036-card');
    if(!card||typeof v036Reconciliation!=='function')return;
    const keys=card.querySelector('.v036-flowkeys');
    const guard=card.querySelector('.v036-guard');
    if(!guard)return;
    flow.remove();
    keys?.remove();
    guard.insertAdjacentHTML('beforebegin',v036Reconciliation(counts));
    const copy=card.querySelector('.v036-card-head p');
    if(copy)copy.textContent=`${typeof v036F==='function'?v036F(counts.total):counts.total} SO materializados · ${typeof v036F==='function'?v036F(counts.matched):counts.matched} con cruce SII · unidad: RUT/entity_id.`;
    card.dataset.reconciliationHealth='live';
    card.dataset.reconciliationSource=VIEW;
    card.dataset.reconciliationTotal=String(counts.total);
    card.dataset.reconciliationMatched=String(counts.matched);
    bind(card);
    window.__AML_UAF_SII_RECONCILIATION__={status:'success',source:VIEW,...counts,checkedAt:new Date().toISOString()};
  }

  function markUnavailable(error){
    if(!isOverview())return;
    const flow=document.querySelector('.v036-flow');
    const card=flow?.closest('.v036-card');
    if(card){
      card.dataset.reconciliationHealth='degraded';
      const copy=card.querySelector('.v036-card-head p');
      if(copy)copy.textContent='Conciliación temporalmente no disponible bajo la sesión actual; no se interpreta como cero.';
    }
    window.__AML_UAF_SII_RECONCILIATION__={status:'degraded',source:VIEW,error:String(error?.message||error),checkedAt:new Date().toISOString()};
    console.warn('[ATLAS] UAF↔SII reconciliation unavailable',error);
  }

  async function hydrate(){
    if(!isOverview()||!document.querySelector('.v036-flow'))return null;
    if(inFlight)return inFlight;
    const ctx=window.__AML_V036_CONTEXT;
    if(!ctx)return null;
    const token=++hydrateToken;
    inFlight=(async()=>{
      try{
        const counts=await loadCounts();
        if(token!==hydrateToken||!isOverview())return counts;
        render(counts);
        return counts;
      }catch(error){
        if(token!==hydrateToken||!isOverview())return null;
        if(lastGood){render(lastGood);return lastGood;}
        markUnavailable(error);
        return null;
      }finally{inFlight=null;}
    })();
    return inFlight;
  }

  function queueHydrate(delay=180){
    clearTimeout(hydrateTimer);
    if(!isOverview()||!document.querySelector('.v036-flow'))return;
    hydrateTimer=setTimeout(()=>{hydrateTimer=null;void hydrate();},delay);
  }

  if(typeof v0205LoadCounts==='function'){
    const base=v0205LoadCounts;
    v0205LoadCounts=async function(force=false){
      if(!force&&lastGood?.total>0)return lastGood;
      try{return await loadCounts();}
      catch(error){
        if(lastGood?.total>0)return lastGood;
        const fallback=await base(true);
        if(fallback?.total>0){lastGood=fallback;return fallback;}
        throw error;
      }
    };
  }

  const root=document.querySelector('#app')||document.documentElement;
  new MutationObserver(()=>{
    if(isOverview()&&document.querySelector('.v036-flow'))queueHydrate(220);
    else clearTimeout(hydrateTimer);
  }).observe(root,{childList:true,subtree:true});

  try{
    sb.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){
        clearTimeout(hydrateTimer);lastGood=null;hydrateToken++;
        try{if(typeof V0205_COUNTS!=='undefined')V0205_COUNTS=null;}catch{}
        return;
      }
      if(event==='SIGNED_IN'&&session)queueHydrate(250);
    });
  }catch(error){console.warn('[ATLAS] auth reconciliation listener unavailable',error);}

  for(const ms of [250,1600])setTimeout(()=>queueHydrate(120),ms);
  window.__ATLAS_RECONCILIATION_RUNTIME__={version:'current',view:VIEW,policy:'SESSION_AWARE_NO_ZERO_CACHE+VIEW_SCOPED_DEBOUNCE+SINGLE_IN_FLIGHT',hydrate:()=>hydrate(),getLastGood:()=>lastGood};
})();
