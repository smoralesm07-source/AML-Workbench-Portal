'use strict';
/* ATLAS AML · Universo SO · compatibility loader 0.70 -> 0.72
 * Sin renderer, route wrapper ni MutationObserver propios.
 * Carga una única autoridad visual para Universo SO.
 */
(function atlasUniversoSO0700Compat(){
  if(window.__ATLAS_UNIVERSO_SO_0720_LOADER__)return;
  window.__ATLAS_UNIVERSO_SO_0720_LOADER__={active:true,policy:'DELEGATE_ONLY_NO_ROUTE_MUTATION',loadedAt:new Date().toISOString()};
  const css=[['./assets/atlas-universo-so-workbench-0720.css?v=0720-1','uso72base'],['./assets/atlas-universo-so-workbench-0720-polish.css?v=0720-1','uso72polish']];
  css.forEach(([href,key])=>{if(document.querySelector(`link[data-${key}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.setAttribute(`data-${key}`,'1');document.head.appendChild(l);});
  if(window.AtlasUniversoSO0720)return;
  if(document.querySelector('script[data-uso72]'))return;
  const s=document.createElement('script');s.src='./assets/atlas-universo-so-workbench-0720.js?v=0720-1';s.async=false;s.setAttribute('data-uso72','1');document.head.appendChild(s);
})();
