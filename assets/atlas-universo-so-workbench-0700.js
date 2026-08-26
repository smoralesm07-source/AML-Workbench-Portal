'use strict';
/* ATLAS AML · Universo SO · compatibility loader 0.70 -> 0.71
 * 0.70 no conserva renderer, route wrapper ni MutationObserver propios.
 * Su única función es cargar la autoridad fiscalizadora 0.71 desde el asset
 * histórico que index.html ya referencia, evitando dos autoridades simultáneas.
 */
(function atlasUniversoSO0700Compat(){
  if(window.__ATLAS_UNIVERSO_SO_0710_LOADER__)return;
  window.__ATLAS_UNIVERSO_SO_0710_LOADER__={active:true,policy:'DELEGATE_ONLY_NO_ROUTE_AUTHORITY',loadedAt:new Date().toISOString()};
  if(!document.querySelector('link[data-atlas-universo-0710]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='./assets/atlas-universo-so-workbench-0710.css?v=0710-1';l.dataset.atlasUniverso0710='1';document.head.appendChild(l);
  }
  if(window.AtlasUniversoSO0710)return;
  if(document.querySelector('script[data-atlas-universo-0710]'))return;
  const s=document.createElement('script');s.src='./assets/atlas-universo-so-workbench-0710.js?v=0710-1';s.async=false;s.dataset.atlasUniverso0710='1';document.head.appendChild(s);
})();
