'use strict';
/* ATLAS AML · Gasto Público GP2 navigation authority */
(function(){
  const VIEW='public-spend', VERSION='GP2-AUTH.3', HOST='.atlas-public-spend-v2-host';
  let active=false,dispatching=false,delegatedNavigate=null,recoveryTimer=null;
  const api=()=>window.AtlasPublicSpendV2||null;
  function publish(status,extra={}){window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__={status,version:VERSION,active,host:!!document.querySelector(HOST),navigateWrapped:!!window.navigate?.__atlasGp2Authority,checkedAt:new Date().toISOString(),...extra};}
  async function open(source='navigate'){
    if(dispatching)return false;dispatching=true;active=true;
    try{const route=api();if(typeof route?.open!=='function')throw new Error('Gasto Público GP2 no está disponible');const ok=await route.open();publish(ok===false?'open-incomplete':'ready',{source});scheduleRecovery('post-open');return ok;}
    catch(error){publish('error',{source,error:String(error?.message||error)});throw error;}
    finally{dispatching=false;}
  }
  function install(source='install'){
    const current=window.navigate;if(typeof current!=='function'){publish('navigate-missing',{source});return false;}
    if(current.__atlasGp2Authority){publish('authority-confirmed',{source});return true;}
    delegatedNavigate=current;
    const wrapper=function(view,...args){if(view===VIEW)return open('window.navigate');active=false;return delegatedNavigate.call(this,view,...args);};
    Object.defineProperty(wrapper,'__atlasGp2Authority',{value:true});window.navigate=wrapper;publish('authority-installed',{source});return true;
  }
  function scheduleRecovery(source='mutation'){
    clearTimeout(recoveryTimer);recoveryTimer=setTimeout(async()=>{if(!active||document.querySelector(HOST))return;const route=api();if(route?.state?.idx&&typeof route.render==='function'){publish('recovering-render',{source});route.render();return;}if(typeof route?.open==='function'){publish('recovering-open',{source});try{await route.open();}catch(error){publish('recover-error',{source,error:String(error?.message||error)});}}},120);
  }
  document.addEventListener('click',event=>{const nav=event.target?.closest?.('[data-view],[data-atlas-mobile-view]');const target=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');if(!target){if(nav)active=false;return;}event.preventDefault();event.stopImmediatePropagation();open('capture-click').catch(()=>{});},true);
  const observer=new MutationObserver(()=>{if(active)scheduleRecovery('dom-mutation');if(!window.navigate?.__atlasGp2Authority)install('mutation-reassert');});observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',()=>{install('pageshow');if(active)scheduleRecovery('pageshow');});
  window.addEventListener('atlas:nav-refresh',()=>install('nav-refresh'));
  window.addEventListener('atlas:public-spend-v2-ready',()=>{active=true;publish('v2-ready');});
  window.AtlasPublicSpendRouteAuthority0578={open,install,recover:()=>scheduleRecovery('api'),health:()=>window.__ATLAS_PUBLIC_SPEND_ROUTE_AUTHORITY_0578__||null};
  install('initial');for(const ms of [0,50,250,900,2200])setTimeout(()=>install(`deferred-${ms}`),ms);
})();
