'use strict';
/* ATLAS AML 0.55.3 · bootstrap de contexto RES.
 * Carga sólo recursos same-origin permitidos por la CSP existente.
 */
(function atlasEntityResBootstrap0553(){
  const VERSION='0553-1';
  const head=document.head||document.documentElement;
  function css(href,id){if(document.getElementById(id))return;const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;head.appendChild(l);}
  function script(src,id,onload){const old=document.getElementById(id);if(old){onload?.();return;}const s=document.createElement('script');s.id=id;s.src=src;s.onload=()=>onload?.();s.onerror=()=>{window.__ATLAS_ENTITY_RES_BOOTSTRAP__={active:false,error:'asset-load-failed',asset:src,checkedAt:new Date().toISOString()};};document.body.appendChild(s);}
  css(`./assets/atlas-entity-res-0553.css?v=${VERSION}`,'atlas-entity-res-0553-css');
  css(`./assets/atlas-entity-res-explorer-0553.css?v=${VERSION}`,'atlas-entity-res-explorer-0553-css');
  script(`./assets/atlas-entity-res-0553.js?v=${VERSION}`,'atlas-entity-res-0553-js',()=>{
    script(`./assets/atlas-entity-res-explorer-0553.js?v=${VERSION}`,'atlas-entity-res-explorer-0553-js',()=>{
      window.__ATLAS_ENTITY_RES_BOOTSTRAP__={active:true,release:'0.55.3',build:'0553',sameOriginAssets:true,installedAt:new Date().toISOString()};
    });
  });
})();
