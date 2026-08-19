'use strict';

/* ATLAS AML v0.40.2 · UAF ↔ SII reconciliation live authority
 * Fresh asset URL isolates reconciliation from legacy browser caches.
 * Counts are read only after an authenticated Supabase session exists.
 * A zero result is never treated as an authoritative business value.
 */
(function atlasReconciliationLive(){
  const VIEW='aml_v0210_uaf_sii_reconciliation';
  let lastGood=null;
  let hydrateToken=0;
  let queued=false;

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
    if(!ctx||typeof state==='undefined'||state.view!=='overview')return;
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
    const flow=document.querySelector('.v036-flow');
    const card=flow?.closest('.v036-card');
    if(card){
      card.dataset.reconciliationHealth='degraded';
      const copy=card.querySelector('.v036-card-head p');
      if(copy)copy.textContent='Conciliación temporalmente no disponible bajo la sesión actual; no se interpreta como cero.';
    }
    window.__AML_UAF_SII_RECONCILIATION__={status:'degraded',source:VIEW,error:String(error?.message||error),checkedAt:new Date().toISOString()};
    console.warn('[ATLAS v0.40.2] UAF↔SII reconciliation unavailable',error);
  }

  async function hydrate(){
    const ctx=window.__AML_V036_CONTEXT;
    if(!ctx||typeof state==='undefined'||state.view!=='overview')return;
    const token=++hydrateToken;
    try{
      const counts=await loadCounts();
      if(token!==hydrateToken)return;
      render(counts);
    }catch(error){
      if(token!==hydrateToken)return;
      if(lastGood){render(lastGood);return;}
      markUnavailable(error);
    }
  }

  function queueHydrate(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;void hydrate();});
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
    if(document.querySelector('.v036-flow'))queueHydrate();
  }).observe(root,{childList:true,subtree:true});

  try{
    sb.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){
        lastGood=null;
        try{if(typeof V0205_COUNTS!=='undefined')V0205_COUNTS=null;}catch{}
        return;
      }
      if(event==='SIGNED_IN'&&session)setTimeout(queueHydrate,0);
    });
  }catch(error){console.warn('[ATLAS v0.40.2] auth reconciliation listener unavailable',error);}

  for(const ms of [0,120,500,1200,2500])setTimeout(queueHydrate,ms);
  window.__ATLAS_RECONCILIATION_RUNTIME__={version:'0.40.2',view:VIEW,policy:'SESSION_AWARE_NO_ZERO_CACHE',hydrate:()=>hydrate(),getLastGood:()=>lastGood};
})();
