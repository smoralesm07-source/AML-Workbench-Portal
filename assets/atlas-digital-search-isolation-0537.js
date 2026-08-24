'use strict';
/* ATLAS AML 0.54.8 · Digital Identity isolation only.
 * Entity search is deliberately NOT intercepted here. The Entity OSINT gate owns
 * the full Entity route: Atlas internal first, external enrichment only if empty.
 * This prevents recursive hand-offs between UN precheck and the internal search.
 */
(function atlasDigitalSearchIsolation0548(){
  const VERSION='DIGITAL-SEARCH-ISOLATION-0548.1';
  const mode=()=>String(window.__ATLAS_DIGITAL_IDENTITY_0524__?.mode||'entity');
  const aliasActive=()=>mode()==='alias';
  const currentQuery=()=>String(document.querySelector('#aex-q')?.value||'').trim().replace(/\s+/g,' ');

  function runDigital(){
    const q=currentQuery();
    if(q.length<2)return;
    const fn=window.__ATLAS_RUN_DIGITAL_IDENTITY__;
    if(typeof fn==='function')void fn(q,'quick');
  }

  document.addEventListener('click',event=>{
    if(!aliasActive())return;
    const target=event.target?.closest?.('#aex-run');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runDigital();
  },true);

  document.addEventListener('keydown',event=>{
    if(!aliasActive()||event.key!=='Enter'||event.target?.id!=='aex-q')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runDigital();
  },true);

  window.__ATLAS_DIGITAL_SEARCH_ISOLATION_0537__={
    active:true,
    version:VERSION,
    digitalOnly:true,
    entityInterception:false,
    entitySearchAuthority:'atlas-entity-osint-auto-fallback-0532',
    identityPromotion:false,
    scoreMutation:false,
    installedAt:new Date().toISOString()
  };
})();

/* Load the maximum-potential digital identity orchestrator after all static entity modules. */
setTimeout(()=>{
  if(!document.querySelector('link[data-admx-0545]')){
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='./assets/atlas-digital-identity-max-0545.css?v=0545-1';
    l.dataset.admx0545='1';
    document.head.appendChild(l);
  }
  if(!document.querySelector('script[data-admx-0545]')){
    const s=document.createElement('script');
    s.src='./assets/atlas-digital-identity-max-0545.js?v=0545-1';
    s.dataset.admx0545='1';
    document.body.appendChild(s);
  }
},0);
