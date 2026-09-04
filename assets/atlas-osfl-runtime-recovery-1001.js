'use strict';

/* ATLAS OSFL Runtime Recovery 1.00.1
 * Repairs late Supabase/runtime initialization for the OSFL Radiografía Nacional.
 * It only rebuilds the OSFL workspace when data client is ready and the current
 * radiography is missing, stalled or failed. No database writes are performed.
 */
(function atlasOsflRuntimeRecovery1001(){
  if(window.__ATLAS_OSFL_RUNTIME_RECOVERY_1001__) return;
  window.__ATLAS_OSFL_RUNTIME_RECOVERY_1001__=true;

  const BUILD='1001';
  const RUNTIME='./assets/atlas-osfl-national-monitor-0930.js?v=1001-runtime';
  const state={repairing:false,lastRepair:0,observer:null,checks:0};
  const clientReady=()=>!!(window.sb&&typeof window.sb.from==='function');
  const root=()=>document.querySelector('[data-osflr-root]');
  const anchor=()=>document.querySelector('.v030-hero,.atlas-osfl-hero');
  const activeNav=()=>document.querySelector('.v019-nav-btn[data-view="osfl"].active,.atlas-nav-btn[data-view="osfl"].active');
  const routeState=()=>{try{return window.state?.view||'';}catch{return '';}};
  const inOsflContext=()=>routeState()==='osfl'||!!activeNav()||!!root()||!!anchor();

  function isHydrated(){
    const r=root();
    if(!r) return false;
    const kpis=r.querySelectorAll('[data-osflr-kpis] .osflr-kpi:not(.loading)');
    const hasDataVisual=!!(
      r.querySelector('[data-osflr-growth] svg')||
      r.querySelector('[data-osflr-region-top] .osflr-bar-row')||
      r.querySelector('[data-osflr-activity-top] .osflr-bar-row')
    );
    const status=(r.querySelector('[data-osflr-status]')?.textContent||'').toLowerCase();
    const failed=/no fue posible|cliente de datos no disponible|error/.test(status);
    return kpis.length>=4&&hasDataVisual&&!failed;
  }

  function markSyncing(message='Sincronizando datos OSFL…'){
    const r=root();
    const status=r?.querySelector('[data-osflr-status]');
    if(!status) return;
    status.classList.remove('ok');
    status.innerHTML=`<span class="osflr-pulse"></span><div><b>${message}</b><small>recuperación automática · build ${BUILD}</small></div>`;
  }

  function loadFreshRuntime(){
    return new Promise((resolve,reject)=>{
      document.querySelectorAll('script[data-osfl-runtime-repair]').forEach(s=>s.remove());
      const s=document.createElement('script');
      s.src=RUNTIME;
      s.async=false;
      s.dataset.osflRuntimeRepair=BUILD;
      s.onload=()=>resolve();
      s.onerror=()=>reject(new Error('No fue posible recargar el runtime OSFL.'));
      document.body.appendChild(s);
    });
  }

  async function repair(reason='runtime-check'){
    if(state.repairing||!inOsflContext()||isHydrated()) return;
    const now=Date.now();
    if(now-state.lastRepair<1200) return;
    if(!clientReady()){
      markSyncing('Esperando conexión de datos…');
      return;
    }

    state.repairing=true;
    state.lastRepair=now;
    try{
      markSyncing('Reconectando radiografía OSFL…');
      const current=root();
      if(current) current.remove();
      delete window.__ATLAS_OSFL_RADIOGRAPHY_1000__;
      await loadFreshRuntime();
      window.dispatchEvent(new CustomEvent('atlas:osfl-runtime-recovered',{detail:{reason,build:BUILD}}));
    }catch(err){
      console.warn('[ATLAS OSFL recovery]',err);
      const r=root();
      const status=r?.querySelector('[data-osflr-status]');
      if(status) status.innerHTML=`<span class="osflr-pulse error"></span><div><b>No fue posible recuperar OSFL</b><small>${String(err?.message||err)}</small></div>`;
    }finally{
      state.repairing=false;
    }
  }

  function check(reason){
    if(!inOsflContext()) return;
    state.checks+=1;
    if(isHydrated()) return;
    void repair(reason);
  }

  function observe(){
    if(state.observer||!document.documentElement) return;
    let timer=0;
    state.observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>check('dom-change'),180);
    });
    state.observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  function schedule(){
    [0,250,700,1400,2600,4500,7500].forEach(ms=>setTimeout(()=>check(`scheduled-${ms}`),ms));
  }

  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('pageshow',()=>setTimeout(()=>check('pageshow'),120));
  window.addEventListener('focus',()=>setTimeout(()=>check('focus'),120));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>check('visible'),120);});
  document.addEventListener('click',ev=>{
    const target=ev.target?.closest?.('[data-view="osfl"],[data-atlas-mobile-view="osfl"],[data-route="osfl"],[data-nav="osfl"],[href*="osfl"]');
    if(target) setTimeout(()=>check('osfl-navigation'),220);
  },true);

  observe();
  schedule();
  window.__ATLAS_OSFL_RUNTIME_RECOVER=()=>repair('manual');
})();
