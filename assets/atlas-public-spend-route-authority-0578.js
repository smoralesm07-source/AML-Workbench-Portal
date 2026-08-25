'use strict';
/* ATLAS AML · Gasto Público navigation authority 0579
 * Re-asserts authority after the complete script chain has loaded, so later Atlas
 * modules cannot restore the legacy public-spend navigation path. Also protects the
 * isolated fast host from incidental SPA DOM replacement while this view is active.
 */
(function(){
  const VIEW='public-spend';
  const VERSION='0579.0';
  const FAST_HOST='.atlas-public-spend-fast-host';
  const LEGACY_HOST='.v037-spend';
  let dispatching=false;
  let activeFast=false;
  let delegatedNavigate=null;
  let recoveryTimer=null;

  function api(){return window.AtlasPublicSpendRoute0573||window.AtlasPublicSpendMobile0573||null;}
  function publish(status,extra={}){
    window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__={
      status,version:VERSION,activeFast,
      fastHost:!!document.querySelector(FAST_HOST),
      legacyHost:!!document.querySelector(LEGACY_HOST),
      navigateWrapped:!!window.navigate?.__atlasPublicSpendAuthority0579,
      checkedAt:new Date().toISOString(),...extra
    };
  }

  async function openFast(source='navigate'){
    if(dispatching)return false;
    dispatching=true;
    activeFast=true;
    try{
      const route=api();
      if(typeof route?.open!=='function')throw new Error('Ruta progresiva de Gasto Público no disponible');
      const result=await route.open();
      publish(result===false?'open-incomplete':'ready',{source});
      scheduleRecovery('post-open');
      return result;
    }catch(error){
      publish('error',{source,error:String(error?.message||error)});
      throw error;
    }finally{dispatching=false;}
  }

  function installAuthority(source='install'){
    const current=window.navigate;
    if(typeof current!=='function'){
      publish('navigate-missing',{source});
      return false;
    }
    if(current.__atlasPublicSpendAuthority0579){
      publish('authority-confirmed',{source});
      return true;
    }
    delegatedNavigate=current;
    const wrapper=function(view,...args){
      if(view===VIEW)return openFast('window.navigate');
      activeFast=false;
      return delegatedNavigate.call(this,view,...args);
    };
    Object.defineProperty(wrapper,'__atlasPublicSpendAuthority0579',{value:true});
    window.navigate=wrapper;
    publish('authority-installed',{source});
    return true;
  }

  function scheduleRecovery(source='mutation'){
    clearTimeout(recoveryTimer);
    recoveryTimer=setTimeout(async()=>{
      if(!activeFast)return;
      if(document.querySelector(LEGACY_HOST)){publish('historical-active',{source});return;}
      if(document.querySelector(FAST_HOST)){publish('fast-host-stable',{source});return;}
      const route=api();
      if(typeof route?.recover!=='function'){publish('recover-api-missing',{source});return;}
      try{
        publish('recovering-fast-host',{source});
        await route.recover();
        publish(document.querySelector(FAST_HOST)?'fast-host-recovered':'recover-incomplete',{source});
      }catch(error){publish('recover-error',{source,error:String(error?.message||error)});}
    },90);
  }

  document.addEventListener('click',event=>{
    const anyView=event.target?.closest?.('[data-view],[data-atlas-mobile-view]');
    const target=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!target){if(anyView)activeFast=false;return;}
    event.preventDefault();
    event.stopImmediatePropagation();
    openFast('capture-click').catch(()=>{});
  },true);

  const observer=new MutationObserver(()=>{
    if(activeFast)scheduleRecovery('dom-mutation');
    if(!window.navigate?.__atlasPublicSpendAuthority0579)installAuthority('mutation-reassert');
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('pageshow',()=>{installAuthority('pageshow');if(activeFast)scheduleRecovery('pageshow');});
  window.addEventListener('atlas:nav-refresh',()=>installAuthority('nav-refresh'));
  window.addEventListener('atlas:public-spend-fast-ready',()=>{activeFast=true;publish('fast-ready-event');});

  window.AtlasPublicSpendRouteAuthority0578={
    open:openFast,
    install:installAuthority,
    recover:()=>scheduleRecovery('api'),
    health:()=>window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__||null
  };

  installAuthority('initial');
  /* Parser-time load is not enough: these reassertions execute after later scripts. */
  for(const ms of [0,50,250,900,2200])setTimeout(()=>installAuthority(`deferred-${ms}`),ms);
})();
