'use strict';
/* ATLAS AML · retired legacy main-frame data audit runtime.
   Source-health authority now lives exclusively in the global topbar surface. */
(function retireAtlasDataAuditLegacy(){
  const SELECTOR='#app .v024-audit,main .v024-audit,.v024-audit.a57-data-audit';
  const noAudit=()=>'';
  // The canonical source-health widget shares historical audit classes.
  // Never remove it while retiring obsolete cards inside the content area.
  function isCanonicalHealth(el){
    if(el.matches('[data-ash0536],[data-atlas-audit-seed],[data-topbar-mode="1"],[data-global-audit="0714"]'))return true;
    return !!el.closest('[data-atlas-global-audit-fallback="1"],[data-atlas-global-audit-host],.v019-top,.topbar,.v18-appbar');
  }

  function retire(){
    document.querySelectorAll(SELECTOR).forEach(el=>{
      if(isCanonicalHealth(el))return;
      el.remove();
    });
    try{window.v024AuditHtml=noAudit;}catch(_e){}
    try{if(typeof v024AuditHtml!=='undefined')v024AuditHtml=noAudit;}catch(_e){}
    window.AtlasDataAudit={
      retired:true,
      version:'retired-0901',
      render:noAudit,
      refresh:async()=>null,
      getState:()=>null,
      authority:'GLOBAL_SOURCE_HEALTH_TOPBAR_ONLY'
    };
    window.__ATLAS_MAIN_DATA_AUDIT_RETIRED__={
      status:'retired',
      authority:'GLOBAL_SOURCE_HEALTH_TOPBAR_ONLY',
      checkedAt:new Date().toISOString()
    };
  }

  retire();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retire,{once:true});
  for(const ms of [0,50,150,400,900,1800,3500])setTimeout(retire,ms);
  window.addEventListener('pageshow',retire);
  window.addEventListener('atlas:navigate',retire);
  window.addEventListener('atlas:routechange',retire);
  window.addEventListener('atlas:nav-refresh',retire);
})();
