'use strict';

/* ATLAS AML · canonical Sanciones route authority
 * Fixes the historical v019 navigation closure that captured a frozen
 * v019LegacyLoadSanctions reference before the approved v12 runtime loaded.
 * This file is compiled after the approved v12 implementation and before the
 * current UI authority.
 */
(function atlasSanctionsV12RouteAuthority(){
  const ROUTE_VERSION='V12_APPROVED_DIRECT';
  const priorNavigate=(typeof navigate==='function')?navigate:(typeof window.navigate==='function'?window.navigate:null);

  function approvedLoader(){
    const fn=window.AML_SANCTIONS_V12_APPROVED?.reload;
    if(typeof fn!=='function')throw new Error('Sanciones v12 aprobada no está disponible en el runtime canónico.');
    return fn;
  }

  async function openApprovedSanctions(){
    try{if(typeof state==='object'&&state)state.view='sanctions';}catch{}
    return approvedLoader()();
  }

  async function sanctionsAwareNavigate(view,...args){
    if(view==='sanctions')return openApprovedSanctions();
    if(typeof priorNavigate==='function')return priorNavigate(view,...args);
  }

  /* Replace the programmatic route as well as the window property. */
  try{navigate=sanctionsAwareNavigate;}catch{}
  window.navigate=sanctionsAwareNavigate;

  /* Capture navigation clicks before any historical listener can invoke the
     frozen v019LegacyLoadSanctions closure. Works for nav elements created or
     rebuilt later by shell/current UI. */
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view="sanctions"]');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openApprovedSanctions().catch(error=>{
      console.error('ATLAS Sanciones v12 route',error);
      const host=document.querySelector('#content');
      if(host)host.innerHTML=`<div class="flash error"><b>No fue posible abrir Sanciones v12.</b><br>${String(error?.message||error)}</div>`;
    });
  },true);

  window.ATLAS_SANCTIONS_ROUTE={
    version:ROUTE_VERSION,
    target:'AML_SANCTIONS_V12_APPROVED.reload',
    legacyFrozenRouteBypassed:true,
    open:openApprovedSanctions,
    health:()=>({
      version:ROUTE_VERSION,
      approvedRuntime:!!window.AML_SANCTIONS_V12_APPROVED,
      approvedReload:typeof window.AML_SANCTIONS_V12_APPROVED?.reload==='function',
      currentView:(typeof state==='object'&&state)?state.view:null
    })
  };
})();
