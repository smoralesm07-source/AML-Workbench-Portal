'use strict';
/* ATLAS AML · Universo SO canonical loader 0.81.6
 * Mantiene el path histórico cargado por index.html, pero delega toda la
 * autoridad de Universo SO a la implementación 0.81.6. Sin observers globales.
 * Contexto SII se carga sólo como enriquecimiento de la Ficha 360.
 * La señal OSFL 0.84.1 se integra como enriquecimiento canónico por identidad.
 */
(function atlasUniversoSOCanonicalLoader0816(){
  if(window.AtlasUniversoSO0816)return;
  const css='./assets/atlas-universo-so-entity-explorer-0816.css?v=0816-1';
  const js='./assets/atlas-universo-so-entity-explorer-0816.js?v=0816-1';
  const dialogCss='./assets/atlas-branded-review-dialog-0832.css?v=0832-1';
  const dialogJs='./assets/atlas-branded-review-dialog-0832.js?v=0832-1';
  const siiCss='./assets/atlas-universo-so-sii-context-0833.css?v=0833-2';
  const siiJs='./assets/atlas-universo-so-sii-context-0833.js?v=0833-2';
  const osflSignalJs='./assets/atlas-universo-so-osfl-signal-0841.js?v=0841-1';
  if(!document.querySelector('link[data-atlas-universo-0816]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href=css;link.dataset.atlasUniverso0816='1';document.head.appendChild(link);
  }
  if(!document.querySelector('link[data-atlas-dialog-0832]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href=dialogCss;link.dataset.atlasDialog0832='1';document.head.appendChild(link);
  }
  if(!document.querySelector('link[data-atlas-sii-0833]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href=siiCss;link.dataset.atlasSii0833='1';document.head.appendChild(link);
  }
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const proxy={version:'0.81.6',authority:'ENTITY_EXPLORER_SPECIALIZATION_0816_LOADING',open:(mode='inscritos')=>ready.then(api=>api.open(mode)),state:()=>({loading:true,version:'0.81.6'})};
  window.AtlasUniversoSO0814=proxy;window.AtlasUniversoSO0813=proxy;window.AtlasUniversoSO0800=proxy;window.AtlasUniversoSO0720=proxy;
  const script=document.createElement('script');script.src=js;script.async=false;script.dataset.atlasUniverso0816='1';
  script.onload=()=>{
    const api=window.AtlasUniversoSO0816;
    if(api?.authority==='ENTITY_EXPLORER_SPECIALIZATION_0816'){
      if(!document.querySelector('script[data-atlas-dialog-0832]')){
        const patch=document.createElement('script');patch.src=dialogJs;patch.async=false;patch.dataset.atlasDialog0832='1';document.head.appendChild(patch);
      }
      if(!document.querySelector('script[data-atlas-sii-0833]')){
        const patch=document.createElement('script');patch.src=siiJs;patch.async=false;patch.dataset.atlasSii0833='1';document.head.appendChild(patch);
      }
      if(!document.querySelector('script[data-atlas-universo-osfl-signal-0841]')){
        const patch=document.createElement('script');patch.src=osflSignalJs;patch.async=false;patch.dataset.atlasUniversoOsflSignal0841='1';document.head.appendChild(patch);
      }
      resolveReady(api);
    }else rejectReady(new Error('Autoridad Universo SO 0.81.6 no instalada'));
  };
  script.onerror=()=>rejectReady(new Error('No fue posible cargar Universo SO 0.81.6'));
  document.head.appendChild(script);
})();