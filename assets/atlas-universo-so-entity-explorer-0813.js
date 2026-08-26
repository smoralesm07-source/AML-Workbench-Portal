'use strict';
/* ATLAS AML · Universo SO canonical loader 0.81.6
 * Mantiene el path histórico cargado por index.html, pero delega toda la
 * autoridad de Universo SO a la implementación 0.81.6. Sin observers globales.
 */
(function atlasUniversoSOCanonicalLoader0816(){
  if(window.AtlasUniversoSO0816)return;
  const css='./assets/atlas-universo-so-entity-explorer-0816.css?v=0816-1';
  const js='./assets/atlas-universo-so-entity-explorer-0816.js?v=0816-1';
  if(!document.querySelector('link[data-atlas-universo-0816]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href=css;link.dataset.atlasUniverso0816='1';document.head.appendChild(link);
  }
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const proxy={version:'0.81.6',authority:'ENTITY_EXPLORER_SPECIALIZATION_0816_LOADING',open:(mode='inscritos')=>ready.then(api=>api.open(mode)),state:()=>({loading:true,version:'0.81.6'})};
  window.AtlasUniversoSO0814=proxy;window.AtlasUniversoSO0813=proxy;window.AtlasUniversoSO0800=proxy;window.AtlasUniversoSO0720=proxy;
  const script=document.createElement('script');script.src=js;script.async=false;script.dataset.atlasUniverso0816='1';
  script.onload=()=>{const api=window.AtlasUniversoSO0816;if(api?.authority==='ENTITY_EXPLORER_SPECIALIZATION_0816')resolveReady(api);else rejectReady(new Error('Autoridad Universo SO 0.81.6 no instalada'));};
  script.onerror=()=>rejectReady(new Error('No fue posible cargar Universo SO 0.81.6'));
  document.head.appendChild(script);
})();
