'use strict';
/* ATLAS AML · Gasto Público navigation authority 0578
 * Ensures every programmatic navigation to public-spend enters the isolated fast
 * surface first. The legacy v037 loader remains opt-in through "Análisis histórico completo".
 */
(function(){
  const VIEW='public-spend';
  const VERSION='0578.0';
  const originalNavigate=typeof window.navigate==='function'?window.navigate:null;
  let dispatching=false;

  function api(){return window.AtlasPublicSpendRoute0573||window.AtlasPublicSpendMobile0573||null;}

  async function openFast(source='navigate'){
    if(dispatching)return false;
    dispatching=true;
    try{
      const route=api();
      if(typeof route?.open!=='function')throw new Error('Ruta progresiva de Gasto Público no disponible');
      const result=await route.open();
      window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__={status:result===false?'open-incomplete':'ready',version:VERSION,source,checkedAt:new Date().toISOString()};
      return result;
    }catch(error){
      window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__={status:'error',version:VERSION,source,error:String(error?.message||error),checkedAt:new Date().toISOString()};
      throw error;
    }finally{dispatching=false;}
  }

  if(originalNavigate){
    window.navigate=function(view,...args){
      if(view===VIEW)return openFast('window.navigate');
      return originalNavigate.call(this,view,...args);
    };
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openFast('capture-click').catch(()=>{});
  },true);

  window.AtlasPublicSpendRouteAuthority0578={open:openFast,originalNavigate,health:()=>window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__||null};
  window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__={status:'installed',version:VERSION,navigateWrapped:!!originalNavigate,checkedAt:new Date().toISOString()};
})();
