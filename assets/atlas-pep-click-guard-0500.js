(function(){
  'use strict';

  const SELECTOR='[data-atlas-pep-view="1"]';

  function openPep(event){
    const target=event.target?.closest?.(SELECTOR);
    if(!target)return;
    const api=window.AtlasPepDiscovery;
    if(!api||typeof api.open!=='function')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(api.open(false)).catch(error=>{
      console.error('ATLAS Personas y control no pudo abrirse',error);
    });
  }

  document.addEventListener('click',openPep,true);
  window.__ATLAS_PEP_CLICK_GUARD__={
    active:true,
    selector:SELECTOR,
    navigationDependency:false,
    cacheRevision:'0500-3',
    installedAt:new Date().toISOString()
  };
})();
