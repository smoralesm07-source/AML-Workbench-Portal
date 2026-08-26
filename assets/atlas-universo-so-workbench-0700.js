'use strict';
/* ATLAS AML · Universo SO · compatibility loader -> Intelligence 0.80
 * Una sola autoridad visual. No muta rutas ni instala observers.
 */
(function atlasUniversoSO0700Compat(){
  if(window.__ATLAS_UNIVERSO_SO_0800_LOADER__)return;
  window.__ATLAS_UNIVERSO_SO_0800_LOADER__={active:true,policy:'DELEGATE_ONLY_NO_ROUTE_MUTATION',loadedAt:new Date().toISOString()};
  if(!document.querySelector('link[data-uso80]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='./assets/atlas-universo-so-intelligence-0800.css?v=0800-1';l.setAttribute('data-uso80','1');document.head.appendChild(l);
  }
  if(window.AtlasUniversoSO0800||document.querySelector('script[data-uso80]'))return;
  const s=document.createElement('script');s.src='./assets/atlas-universo-so-intelligence-0800.js?v=0800-1';s.async=false;s.setAttribute('data-uso80','1');document.head.appendChild(s);
})();
