'use strict';
/* ATLAS AML 0.53.4 · gated Entity Explorer search.
 * A single explicit action (Buscar/Enter) resolves the internal Atlas stage first.
 * Only when no internal candidate exists does it escalate to external OSINT.
 * The UI never renders a terminal "sin resultados" before external screening finishes.
 */
(function atlasEntityOsintSearchGate0534(){
  const RELEASE='0.53.4';
  const MIN_LEN=3;
  let seq=0;
  let bypass=false;
  let activePromise=null;

  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const clean=v=>String(v||'').trim().replace(/\s+/g,' ');
  const resultsHost=()=>document.querySelector('.aex-results')||document.querySelector('#content');
  const runButton=()=>document.querySelector('#aex-run');
  const input=()=>document.querySelector('#aex-q');

  function setBusy(q,stage='atlas'){
    const btn=runButton();
    if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');btn.dataset.originalLabel=btn.dataset.originalLabel||btn.textContent||'Buscar';btn.textContent='Buscando…';}
    const host=resultsHost();
    if(host){
      const label=stage==='osint'?'Sin coincidencia interna. Consultando OSINT y listas internacionales…':'Buscando primero en el universo interno de Atlas…';
      host.innerHTML=`<section class="agw-card"><div class="agw-loading"><b>${label}</b><br><small>${escapeHtml(q)} · espera a que finalice la consulta</small></div></section>`;
    }
  }

  function clearBusy(){
    const btn=runButton();
    if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');btn.textContent=btn.dataset.originalLabel||'Buscar';}
  }

  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  async function hasInternalCandidate(q){
    const db=client();
    if(!db)throw new Error('Supabase no disponible');
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

  async function waitRunner(timeout=2500){
    const started=Date.now();
    while(Date.now()-started<timeout){
      if(typeof window.__ATLAS_RUN_EXTERNAL_OSINT_0531__==='function')return window.__ATLAS_RUN_EXTERNAL_OSINT_0531__;
      await new Promise(r=>setTimeout(r,50));
    }
    throw new Error('Motor OSINT externo no disponible');
  }

  function continueInternal(){
    const btn=runButton();
    if(!btn)return;
    bypass=true;
    try{btn.click();}finally{queueMicrotask(()=>{bypass=false;});}
  }

  async function execute(raw){
    const q=clean(raw);
    if(q.length<MIN_LEN)return;
    const token=++seq;
    if(activePromise)return activePromise;
    activePromise=(async()=>{
      try{
        setBusy(q,'atlas');
        const found=await hasInternalCandidate(q);
        if(token!==seq)return;
        if(found){
          clearBusy();
          continueInternal();
          window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,route:'internal',escalated:false,checkedAt:new Date().toISOString(),identityPromotion:false,scoreMutation:false};
          return;
        }
        setBusy(q,'osint');
        const runner=await waitRunner();
        if(token!==seq)return;
        await runner(q);
        window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,route:'external_osint',escalated:true,checkedAt:new Date().toISOString(),canonicalEntityCreated:false,identityPromotion:false,scoreMutation:false};
      }catch(error){
        const host=resultsHost();
        if(host)host.innerHTML=`<section class="agw-card"><div class="agw-error">No fue posible completar la búsqueda integrada: ${escapeHtml(error?.message||error)}</div></section>`;
        window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,lastQuery:q,route:'error',escalated:false,error:String(error?.message||error),checkedAt:new Date().toISOString(),identityPromotion:false,scoreMutation:false};
      }finally{
        clearBusy();
        activePromise=null;
      }
    })();
    return activePromise;
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('#aex-run');
    if(!target||bypass)return;
    const q=clean(input()?.value||'');
    if(q.length<MIN_LEN)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void execute(q);
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.target?.id!=='aex-q'||bypass)return;
    const q=clean(input()?.value||'');
    if(q.length<MIN_LEN)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void execute(q);
  },true);

  const obs=new MutationObserver(()=>{
    const manual=document.querySelector('#aex-osint-run');if(manual)manual.style.display='none';
    const hint=document.querySelector('[data-osint-hint]');if(hint)hint.style.display='none';
  });
  obs.observe(document.documentElement,{subtree:true,childList:true});

  window.__ATLAS_ENTITY_OSINT_AUTO_FALLBACK_0532__={active:true,release:RELEASE,automaticFallback:true,gatedSearch:true,terminalEmptyBeforeOsint:false,duplicateSearchSuppression:true,whileTyping:false,identityPromotion:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
