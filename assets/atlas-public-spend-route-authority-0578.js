'use strict';
/* ATLAS AML · Gasto Público navigation authority · GP13 loader */
(function(){
  const VIEW='public-spend', VERSION='GP-AUTH.1300';
  const SCRIPT='./assets/atlas-gasto-publico-1300.js?v=1300-1';
  const STYLE='./assets/atlas-gasto-publico-1300.css?v=1300-1';
  let active=false,dispatching=false,delegatedNavigate=null,loadPromise=null;

  function publish(status,extra={}){
    window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__={status,version:VERSION,active,
      authority:window.AtlasGastoPublico1300?.authority||window.AtlasPublicSpendIntelligence0720?.authority||null,
      navigateWrapped:!!window.navigate?.__atlasGpAuthority1300,freezeGuard:'NO_GLOBAL_DOM_OBSERVER',
      checkedAt:new Date().toISOString(),...extra};
  }

  function ensureStyle(){
    if(document.querySelector('link[data-atlas-gp13-style]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE;link.dataset.atlasGp13Style='1';document.head.appendChild(link);
  }
  function ensureGp13(){
    ensureStyle();
    if(window.AtlasGastoPublico1300)return Promise.resolve(window.AtlasGastoPublico1300);
    if(loadPromise)return loadPromise;
    loadPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-atlas-gp13-script]');
      if(existing){existing.addEventListener('load',()=>resolve(window.AtlasGastoPublico1300),{once:true});existing.addEventListener('error',()=>reject(new Error('No fue posible cargar GP13')),{once:true});return;}
      const script=document.createElement('script');script.src=SCRIPT;script.dataset.atlasGp13Script='1';script.async=true;
      script.onload=()=>window.AtlasGastoPublico1300?resolve(window.AtlasGastoPublico1300):reject(new Error('GP13 cargó sin publicar su API'));
      script.onerror=()=>reject(new Error('No fue posible cargar GP13'));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  async function open(source='navigate'){
    if(dispatching)return false;dispatching=true;active=true;
    try{
      const route=await ensureGp13();
      if(typeof route?.open!=='function')throw new Error('Gasto Público GP13 no está disponible');
      const ok=await route.open();publish(ok===false?'open-incomplete':'ready',{source,authority:'GASTO_PUBLICO_GP13'});return ok;
    }catch(error){publish('error',{source,error:String(error?.message||error)});throw error;}
    finally{dispatching=false;}
  }

  function install(source='install'){
    const current=window.navigate;if(typeof current!=='function'){publish('navigate-missing',{source});return false;}
    if(current.__atlasGpAuthority1300){publish('authority-confirmed',{source});return true;}
    delegatedNavigate=current;
    const wrapper=function(view,...args){if(view===VIEW)return open('window.navigate');active=false;return delegatedNavigate.call(this,view,...args);};
    Object.defineProperty(wrapper,'__atlasGpAuthority1300',{value:true});window.navigate=wrapper;publish('authority-installed',{source});return true;
  }

  /* Window-capture is intentional: GP12 also owns a window capture listener but is loaded later.
     GP13 therefore wins only for public-spend and leaves every other ATLAS route untouched. */
  window.addEventListener('click',event=>{
    const nav=event.target?.closest?.('[data-view],[data-atlas-mobile-view]');
    const target=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!target){if(nav)active=false;return;}
    event.preventDefault();event.stopImmediatePropagation();void open('window-capture-click').catch(()=>{});
  },true);

  ['pageshow','atlas:nav-refresh','atlas:public-spend-v2-ready','atlas:public-spend-gp13-ready'].forEach(evt=>window.addEventListener(evt,()=>{install(evt);publish(evt);}));
  window.AtlasPublicSpendRouteAuthority0578={open,install,ensureGp13,health:()=>window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__||null};
  ensureGp13().catch(error=>publish('gp13-preload-error',{error:String(error?.message||error)}));
  install('initial');[0,80,300,1000].forEach(ms=>setTimeout(()=>install(`deferred-${ms}`),ms));
})();
