'use strict';

/* ATLAS AML · Sanciones route authority 0.94
 * La ruta conserva fallback v12 sólo como contingencia, pero la autoridad
 * funcional es ATLAS_SANCTIONS_CURRENT (Spectrum Cockpit 0.94).
 */
(function atlasSanctionsCurrentRouteAuthority(){
  const ROUTE_VERSION='SANCTIONS_SPECTRUM_ROUTE_0940';
  const priorNavigate=(typeof navigate==='function')?navigate:(typeof window.navigate==='function'?window.navigate:null);

  function currentLoader(){
    const current=window.ATLAS_SANCTIONS_CURRENT?.load;
    if(typeof current==='function')return current;
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

  try{navigate=sanctionsAwareNavigate;}catch{}
  window.navigate=sanctionsAwareNavigate;

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view="sanctions"]');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openCurrentSanctions().catch(error=>{
      console.error('ATLAS Sanciones current route',error);
      const host=document.querySelector('#content');
      if(host)host.innerHTML=`<div class="flash error"><b>No fue posible abrir Sanciones.</b><br>${String(error?.message||error)}</div>`;
    });
  },true);

  window.ATLAS_SANCTIONS_ROUTE={
    version:ROUTE_VERSION,
    target:'ATLAS_SANCTIONS_CURRENT.load',
    fallback:'AML_SANCTIONS_V12_APPROVED.reload',
    legacyFrozenRouteBypassed:true,
    currentSpectrumPinned:true,
    open:openCurrentSanctions,
    health:()=>({
      version:ROUTE_VERSION,
      currentRuntime:!!window.ATLAS_SANCTIONS_CURRENT,
      currentLoad:typeof window.ATLAS_SANCTIONS_CURRENT?.load==='function',
      fallbackV12:typeof window.AML_SANCTIONS_V12_APPROVED?.reload==='function',
      currentView:(typeof state==='object'&&state)?state.view:null
    })
  };
})();
