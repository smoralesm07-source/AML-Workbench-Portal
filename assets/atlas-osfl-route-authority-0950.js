'use strict';

/* ATLAS OSFL 0.95 route/install authority.
 * Fixes late navigation: atlas-osfl-economic-0950.js originally stopped probing
 * after ~20s and waited for an event not emitted by the national monitor.
 * This bridge makes the OSFL 0.95 layer mount whenever the OSFL view is created.
 */
(function atlasOsflRouteAuthority0950(){
  if(window.__ATLAS_OSFL_ROUTE_AUTHORITY_0950__) return;
  window.__ATLAS_OSFL_ROUTE_AUTHORITY_0950__=true;

  const EVENT='atlas:osfl-national-ready';
  const MARK='OSFL_ROUTE_AUTHORITY_0950';
  let lastRoot=null;

  function signal(reason){
    const root=document.querySelector('[data-osfln-root]');
    if(!root) return false;
    const economic=document.querySelector('[data-osfl95-root]');
    if(!economic || root!==lastRoot){
      lastRoot=root;
      document.dispatchEvent(new CustomEvent(EVENT,{detail:{source:MARK,reason:reason||'root-ready'}}));
    }
    return true;
  }

  function schedule(reason){
    [0,50,180,450,900,1600].forEach(ms=>setTimeout(()=>signal(reason),ms));
  }

  function pinLoader(){
    if(typeof window.v030LoadOsfl!=='function') return false;
    if(window.v030LoadOsfl.__osflRoute0950) return true;
    const base=window.v030LoadOsfl;
    const wrapped=async function(){
      const out=await base.apply(this,arguments);
      schedule('v030LoadOsfl');
      return out;
    };
    wrapped.__osflRoute0950=true;
    wrapped.__base=base;
    window.v030LoadOsfl=wrapped;
    return true;
  }

  document.addEventListener('click',ev=>{
    const trigger=ev.target?.closest?.('[data-view="osfl"], [data-nav="osfl"], [href="#osfl"]');
    if(trigger) schedule('navigation');
  },true);

  const observer=new MutationObserver(()=>{
    pinLoader();
    signal('mutation');
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  let tries=0;
  const pinTimer=setInterval(()=>{
    tries++;
    pinLoader();
    signal('timer');
    if(tries>120 && typeof window.v030LoadOsfl==='function') clearInterval(pinTimer);
  },250);

  window.addEventListener('load',()=>schedule('window-load'),{once:true});
  document.addEventListener(EVENT,()=>setTimeout(()=>signal('event-echo'),0));

  window.__ATLAS_OSFL_ROUTE_CURRENT__={version:'0.95.0',build:'0950',marker:MARK,signal:()=>signal('manual'),schedule};
  schedule('boot');
})();
