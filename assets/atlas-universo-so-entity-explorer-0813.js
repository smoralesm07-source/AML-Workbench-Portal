'use strict';
/* ATLAS AML · Universo SO 0.81.4 bootstrap
 * Mantiene estable el slot publicado 0.81.3 y carga la nueva autoridad 0.81.4.
 * Sin MutationObserver y sin reescritura de window.navigate.
 */
(function atlasUniversoSO0814Bootstrap(){
  if(window.AtlasUniversoSO0814)return;
  if(!document.querySelector('link[data-uso814]')){
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='./assets/atlas-universo-so-entity-explorer-0814.css?v=0814-1';
    l.dataset.uso814='1';
    document.head.appendChild(l);
  }
  if(!document.querySelector('script[data-uso814]')){
    const s=document.createElement('script');
    s.src='./assets/atlas-universo-so-entity-explorer-0814.js?v=0814-1';
    s.dataset.uso814='1';
    document.body.appendChild(s);
  }
})();
