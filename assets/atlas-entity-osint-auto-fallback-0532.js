'use strict';
/* ATLAS AML 0.53.2 · automatic OSINT fallback for Entity Explorer.
 * Executes only after an explicit search action (button/Enter), never while typing.
 * If Atlas has no internal candidate, escalates the same query to external OSINT.
 */
(function atlasEntityOsintAutoFallback0532(){
  const RELEASE='0.53.2';
  const MIN_LEN=3;
  let seq=0;
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const clean=v=>String(v||'').trim().replace(/\s+/g,' ');
  async function hasInternalCandidate(q){
    const db=client();if(!db)return null;
    const safe=clean(q).replace(/[%_,()*"']/g,' ').trim().slice(0,100);
    if(!safe)return false;
    const compact=safe.replace(/[.\s-]/g,'');
    let query=db.from('aml_entities').select('entity_id').limit(1);
    if(/^[0-9K]+$/i.test(compact))query=query.ilike('rut',`%${safe.replace(/[.\s-]/g,'')}%`);
    else query=query.ilike('name',`%${safe}%`);
    const {data,error}=await query;
    if(error)throw error;
    return Array.isArray(data)&&data.length>0;
  }
  async function autoEscalate(raw){
    const q=clean(raw);if(q.length<MIN_LEN)return;
    const token=++seq;
    try{
      const found=await hasInternalCandidate(q);
      if(token!==seq||found!==false)return;
      const runner=window.__ATLAS_RUN_EXTERNAL_OSINT_0531__;
      if(typeof runner==='function')await runner(q);
      window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,escalated:true,checkedAt:new Date().toISOString(),canonicalEntityCreated:false,identityPromotion:false,scoreMutation:false};
    }catch(error){
      window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,escalated:false,error:String(error?.message||error),checkedAt:new Date().toISOString(),canonicalEntityCreated:false,identityPromotion:false,scoreMutation:false};
    }
  }
  function inputValue(){return clean(document.querySelector('#aex-q')?.value||'');}
  document.addEventListener('click',event=>{const target=event.target?.closest?.('#aex-run');if(!target)return;const q=inputValue();if(q)queueMicrotask(()=>void autoEscalate(q));},true);
  document.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.target?.id!=='aex-q')return;const q=inputValue();if(q)queueMicrotask(()=>void autoEscalate(q));},true);
  const obs=new MutationObserver(()=>{const manual=document.querySelector('#aex-osint-run');if(manual)manual.style.display='none';const hint=document.querySelector('[data-osint-hint]');if(hint)hint.style.display='none';});
  obs.observe(document.documentElement,{subtree:true,childList:true});
  window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,automaticFallback:true,whileTyping:false,identityPromotion:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
