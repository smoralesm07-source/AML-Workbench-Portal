'use strict';
/* ATLAS AML 0.53.7 · isolates Digital Identity search from Entity OSINT gate. */
(function atlasDigitalSearchIsolation0537(){
  const VERSION='DIGITAL-SEARCH-ISOLATION-0537.1';
  const mode=()=>String(window.__ATLAS_DIGITAL_IDENTITY_0524__?.mode||'entity');
  const aliasActive=()=>mode()==='alias';
  const currentQuery=()=>String(document.querySelector('#aex-q')?.value||'').trim();
  function run(){const q=currentQuery();if(q.length<2)return;const fn=window.__ATLAS_RUN_DIGITAL_IDENTITY__;if(typeof fn==='function')void fn(q,'quick');}
  document.addEventListener('click',event=>{
    if(!aliasActive())return;
    const target=event.target?.closest?.('#aex-run');if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();run();
  },true);
  document.addEventListener('keydown',event=>{
    if(!aliasActive()||event.key!=='Enter'||event.target?.id!=='aex-q')return;
    event.preventDefault();event.stopImmediatePropagation();run();
  },true);
  window.__ATLAS_DIGITAL_SEARCH_ISOLATION_0537__={active:true,version:VERSION,entityOsintIsolation:true,installedAt:new Date().toISOString()};
})();
