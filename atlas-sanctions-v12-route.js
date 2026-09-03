'use strict';

/* ATLAS AML · Sanciones route authority 0.96.1
 * Autoridad funcional: ATLAS_SANCTIONS_CURRENT = Radiografía sancionatoria 0.96.1.
 * Spectrum 0.94 y v12 quedan únicamente como fallback técnico histórico.
 */
(function atlasSanctionsCurrentRouteAuthority(){
  const ROUTE_VERSION='SANCTIONS_RADIOGRAPHY_ROUTE_0961';
  const priorNavigate=(typeof navigate==='function')?navigate:(typeof window.navigate==='function'?window.navigate:null);

  function currentLoader(){
    const current=window.ATLAS_SANCTIONS_CURRENT?.load;
    if(typeof current==='function'&&window.ATLAS_SANCTIONS_CURRENT?.version==='0.96.1')return current;
    if(typeof current==='function')return current;
    const spectrum=window.ATLAS_SANCTIONS_SPECTRUM?.load||window.ATLAS_SANCTIONS_SPECTRUM?.reload;
    if(typeof spectrum==='function')return spectrum;
    const fallback=window.AML_SANCTIONS_V12_APPROVED?.reload;
    if(typeof fallback==='function')return fallback;
    throw new Error('Sanciones current no está disponible en el runtime canónico.');
  }
  async function openCurrentSanctions(){
    try{if(typeof state==='object'&&state)state.view='sanctions';}catch{}
    return currentLoader()();
  }
  async function sanctionsAwareNavigate(view,...args){
    if(view==='sanctions')return openCurrentSanctions();
    if(typeof priorNavigate==='function')return priorNavigate(view,...args);
  }
  function pinCurrentGlobals(){
    try{window.loadSanctions=openCurrentSanctions;}catch{}
    try{loadSanctions=openCurrentSanctions;}catch{}
  }

  try{navigate=sanctionsAwareNavigate;}catch{}
  window.navigate=sanctionsAwareNavigate;
  pinCurrentGlobals();
  queueMicrotask(pinCurrentGlobals);
  window.setTimeout(pinCurrentGlobals,0);
  window.setTimeout(pinCurrentGlobals,250);
  window.addEventListener('load',pinCurrentGlobals,{once:true});

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view="sanctions"]');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pinCurrentGlobals();
    openCurrentSanctions().catch(error=>{
      console.error('ATLAS Sanciones radiography route',error);
      const host=document.querySelector('#content');
      if(host)host.innerHTML=`<div class="flash error"><b>No fue posible abrir Sanciones.</b><br>${String(error?.message||error)}</div>`;
    });
  },true);

  window.ATLAS_SANCTIONS_ROUTE={
    version:ROUTE_VERSION,
    target:'ATLAS_SANCTIONS_CURRENT.load@0.96.1',
    fallback:'Spectrum 0.94 → AML_SANCTIONS_V12_APPROVED.reload',
    legacyFrozenRouteBypassed:true,
    radiography0961Pinned:true,
    globalLoaderPinned:true,
    open:openCurrentSanctions,
    health:()=>({
      version:ROUTE_VERSION,
      currentVersion:window.ATLAS_SANCTIONS_CURRENT?.version||null,
      currentAuthority:window.ATLAS_SANCTIONS_CURRENT?.authority||null,
      currentLoad:typeof window.ATLAS_SANCTIONS_CURRENT?.load==='function',
      globalLoadPinned:window.loadSanctions===openCurrentSanctions,
      fallbackV12:typeof window.AML_SANCTIONS_V12_APPROVED?.reload==='function',
      currentView:(typeof state==='object'&&state)?state.view:null
    })
  };
})();
