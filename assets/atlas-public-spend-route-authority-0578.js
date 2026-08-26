'use strict';
/* ATLAS AML · Gasto Público navigation authority · event-driven */
(function(){
  const VIEW='public-spend', VERSION='GP-AUTH.0720';
  let active=false,dispatching=false,delegatedNavigate=null;
  const api=()=>window.AtlasPublicSpendIntelligence0720||window.AtlasPublicSpendV2||null;
  function publish(status,extra={}){window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__={status,version:VERSION,active,authority:api()?.authority||null,navigateWrapped:!!window.navigate?.__atlasGpAuthority0720,freezeGuard:'NO_GLOBAL_DOM_OBSERVER',checkedAt:new Date().toISOString(),...extra};}
  async function open(source='navigate'){
    if(dispatching)return false;dispatching=true;active=true;
    try{const route=api();if(typeof route?.open!=='function')throw new Error('Gasto Público Intelligence no está disponible');const ok=await route.open();publish(ok===false?'open-incomplete':'ready',{source});return ok;}
    catch(error){publish('error',{source,error:String(error?.message||error)});throw error;}
    finally{dispatching=false;}
  }
  function install(source='install'){
    const current=window.navigate;if(typeof current!=='function'){publish('navigate-missing',{source});return false;}
    if(current.__atlasGpAuthority0720){publish('authority-confirmed',{source});return true;}
    delegatedNavigate=current;
    const wrapper=function(view,...args){if(view===VIEW)return open('window.navigate');active=false;return delegatedNavigate.call(this,view,...args);};
    Object.defineProperty(wrapper,'__atlasGpAuthority0720',{value:true});window.navigate=wrapper;publish('authority-installed',{source});return true;
  }
  document.addEventListener('click',event=>{
    const nav=event.target?.closest?.('[data-view],[data-atlas-mobile-view]');
    const target=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!target){if(nav)active=false;return;}
    event.preventDefault();event.stopImmediatePropagation();void open('capture-click').catch(()=>{});
  },true);
  ['pageshow','atlas:nav-refresh','atlas:public-spend-v2-ready'].forEach(evt=>window.addEventListener(evt,()=>{install(evt);publish(evt);}));
  window.AtlasPublicSpendRouteAuthority0578={open,install,health:()=>window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__||null};
  install('initial');[0,80,300,1000].forEach(ms=>setTimeout(()=>install(`deferred-${ms}`),ms));
})();
