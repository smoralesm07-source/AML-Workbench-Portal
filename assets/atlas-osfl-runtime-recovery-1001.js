'use strict';

/* ATLAS OSFL Runtime Recovery 1.00.2
 * Final production authority loaded after historical OSFL standalones.
 * Enforces the canonical 0.95 Radiografía, rehydrates it with the active
 * Supabase client and reapplies CSP-safe SVG graphics. No database writes.
 */
(function atlasOsflRuntimeRecovery1002(){
  if(window.__ATLAS_OSFL_RUNTIME_RECOVERY_1001__) return;
  window.__ATLAS_OSFL_RUNTIME_RECOVERY_1001__=true;
  window.__ATLAS_OSFL_RUNTIME_RECOVERY_1002__=true;
  /* Prevent any later dynamic reload of the retired 1.00/0.93 radiography. */
  window.__ATLAS_OSFL_RADIOGRAPHY_1000__=true;

  const BUILD='1002';
  const ROOT='[data-osflr-root]';
  const CANONICAL='[data-osfl95-root]';
  const HOST='.v030-osfl';
  const CSS='./assets/atlas-osfl-production-fix-1002.css?v=1002-1';
  const state={repairing:false,lastRepair:0,observer:null,checks:0,lastReason:'boot',lastError:null};

  function client(){
    try{
      const c=window.sb || globalThis.sb || null;
      return c&&typeof c.from==='function'?c:null;
    }catch(_){return null;}
  }
  const host=()=>document.querySelector(HOST);
  const canonicalRoot=()=>document.querySelector(`${HOST} ${CANONICAL}`)||document.querySelector(CANONICAL);
  const routeState=()=>{try{return window.state?.view||'';}catch(_){return '';}};
  const activeNav=()=>document.querySelector('.v019-nav-btn[data-view="osfl"].active,.atlas-nav-btn[data-view="osfl"].active,[data-view="osfl"][aria-current="page"]');
  const inOsflContext=()=>routeState()==='osfl'||!!activeNav()||!!host()||!!canonicalRoot();

  function ensureCss(){
    if(document.querySelector('link[data-atlas-osfl-production-fix="1002"]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=CSS;
    link.dataset.atlasOsflProductionFix='1002';
    document.head.appendChild(link);
  }

  function canonicalApi(){
    const api=window.__ATLAS_OSFL_RADIOGRAPHY_CURRENT__;
    return api&&typeof api.mount==='function'&&typeof api.hydrate==='function'?api:null;
  }

  function purgeLegacy(){
    const h=host();
    if(!h) return 0;
    let removed=0;
    h.querySelectorAll(ROOT).forEach(r=>{
      if(r.matches(CANONICAL)) return;
      r.remove();
      removed++;
    });
    h.querySelectorAll('[data-osflg-root],[data-osflm-root],[data-osfln-root],.atlas-osfl-national,.osflg-card').forEach(el=>{
      if(el.closest(CANONICAL)) return;
      el.remove();
      removed++;
    });
    return removed;
  }

  function hasRealData(r=canonicalRoot()){
    if(!r) return false;
    if(r.dataset.status!=='ready') return false;
    const values=[...r.querySelectorAll('[data-osflr-kpis] b')].map(x=>(x.textContent||'').trim()).filter(Boolean);
    const populated=values.filter(v=>v!=='—'&&!/^0(?:[,.]0+)?$/.test(v)).length;
    const visual=!!(
      r.querySelector('[data-osflr-growth] svg')||
      r.querySelector('[data-osflr-region-top] .osflr-bar,[data-osflr-region-top] .osflr-bar-row')||
      r.querySelector('[data-osflr-activity-top] .osflr-bar,[data-osflr-activity-top] .osflr-bar-row')
    );
    const status=(r.querySelector('[data-osflr-status]')?.textContent||'').toLowerCase();
    return populated>=3&&visual&&!/error|no fue posible|cliente de datos no disponible/.test(status);
  }

  function mark(message,detail='autoridad canónica OSFL 0.95'){
    const r=canonicalRoot()||document.querySelector(ROOT);
    const status=r?.querySelector('[data-osflr-status]');
    if(!status) return;
    status.innerHTML=`<i></i><span><b>${message}</b><small>${detail} · recovery ${BUILD}</small></span>`;
  }

  function repairGraphics(reason){
    try{window.__ATLAS_OSFL_GRAPHICS_FINAL_CURRENT__?.repair?.(`recovery-${reason}`);}catch(err){state.lastError=String(err?.message||err);}
    try{window.__ATLAS_OSFL_GRAPHICS_CURRENT__?.repair?.();}catch(err){state.lastError=String(err?.message||err);}
    const r=canonicalRoot();
    if(r){
      r.dataset.osflProductionAuthority='1002';
      r.dataset.osflProductionReason=reason;
      r.dataset.osflProductionAt=new Date().toISOString();
    }
  }

  async function enforce(reason='runtime-check',force=false){
    if(!inOsflContext()) return false;
    ensureCss();
    const now=Date.now();
    if(state.repairing) return false;
    if(!force&&now-state.lastRepair<450) return hasRealData();
    state.repairing=true;
    state.lastRepair=now;
    state.lastReason=reason;
    try{
      const h=host();
      if(!h){return false;}
      purgeLegacy();
      const api=canonicalApi();
      if(!api){
        pinLoader();
        return false;
      }
      let r=canonicalRoot();
      if(!r){
        api.mount();
        r=canonicalRoot();
      }
      if(!r) return false;
      if(!client()){
        mark('Esperando conexión de datos…','Supabase aún no disponible');
        return false;
      }
      if(force||!hasRealData(r)){
        mark('Sincronizando radiografía OSFL…');
        await api.hydrate();
      }
      repairGraphics(reason);
      const ready=hasRealData(r);
      if(ready){
        r.dataset.status='ready';
        r.dataset.osflCanonical='0950';
        document.dispatchEvent(new CustomEvent('atlas:osfl-production-ready',{detail:{build:BUILD,reason}}));
      }
      return ready;
    }catch(err){
      state.lastError=String(err?.message||err);
      console.warn('[ATLAS OSFL 1002]',err);
      mark('No fue posible sincronizar OSFL',state.lastError);
      return false;
    }finally{
      state.repairing=false;
    }
  }

  function pinLoader(){
    const current=window.v030LoadOsfl;
    if(typeof current!=='function') return false;
    if(current.__osflProduction1002) return true;
    const base=current;
    const wrapped=async function(){
      const out=await base.apply(this,arguments);
      await enforce('v030LoadOsfl',true);
      return out;
    };
    wrapped.__osflProduction1002=true;
    wrapped.__base=base;
    window.v030LoadOsfl=wrapped;
    return true;
  }

  function check(reason,force=false){
    if(!inOsflContext()) return;
    state.checks+=1;
    pinLoader();
    const r=canonicalRoot();
    if(r&&hasRealData(r)){
      repairGraphics(reason);
      return;
    }
    void enforce(reason,force);
  }

  function observe(){
    if(state.observer||!document.documentElement) return;
    let timer=0;
    state.observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>check('dom-change'),100);
    });
    state.observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  ensureCss();
  pinLoader();
  observe();
  [0,100,300,700,1400,2600,4500,7500,12000].forEach(ms=>setTimeout(()=>check(`scheduled-${ms}`,ms>=700),ms));
  window.addEventListener('load',()=>check('load',true),{once:true});
  window.addEventListener('pageshow',()=>setTimeout(()=>check('pageshow',true),80));
  window.addEventListener('focus',()=>setTimeout(()=>check('focus'),80));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>check('visible'),80);});
  document.addEventListener('click',ev=>{
    if(ev.target?.closest?.('[data-view="osfl"],[data-atlas-mobile-view="osfl"],[data-route="osfl"],[data-nav="osfl"],[href*="osfl"],[data-osflr-tab],[data-osflr-territory-controls] button')){
      setTimeout(()=>check('osfl-interaction',true),60);
    }
  },true);

  window.__ATLAS_OSFL_RUNTIME_RECOVER=()=>enforce('manual',true);
  window.__ATLAS_OSFL_RUNTIME_RECOVERY_CURRENT__={
    version:'1.00.2',build:BUILD,canonical:'0.95.0',cspSafe:true,
    enforce:()=>enforce('api',true),repairGraphics:()=>repairGraphics('api'),
    status:()=>({ready:hasRealData(),checks:state.checks,lastReason:state.lastReason,lastError:state.lastError})
  };
})();
