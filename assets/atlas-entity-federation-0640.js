'use strict';

/* ATLAS AML · Entity Master federado 0.68
 * Entidades consulta aml_entity_master_v0650: base ATLAS + RES + padrón SII.
 * Los demás radares conservan aml_entities para no alterar sus denominadores.
 * Identidad exclusivamente por RUT canónico/exacto; no hay fuzzy promotion.
 * 0.68 añade contexto RES multifuente sólo dentro de Entidades.
 */
(function atlasEntityFederation0640(){
  const RELEASE='0.68.0';
  const BUILD='0680';
  const MASTER='aml_entity_master_v0650';
  const BASE='aml_entities';
  let installed=false;
  function currentState(){try{return typeof state!=='undefined'?state:(window.state||null);}catch(_e){return window.state||null;}}
  function client(){try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}}
  function inEntityContext(){const s=currentState();return !!s&&(s.view==='entities'||!!s.selectedEntity);}
  function loadContext0680(){
    if(document.querySelector('script[data-atlas-res68]'))return;
    const s=document.createElement('script');
    s.src='./assets/atlas-entity-res-context-0680.js?v=0680-1';
    s.dataset.atlasRes68='1';
    document.head.appendChild(s);
  }
  function install(){
    if(installed)return true;const c=client();if(!c||typeof c.from!=='function')return false;
    if(c.__atlasEntityFederation0640){installed=true;return true;}
    const baseFrom=c.from.bind(c);
    c.from=function atlasFederatedFrom(table){if(table===BASE&&inEntityContext())return baseFrom(MASTER);return baseFrom(table);};
    Object.defineProperty(c,'__atlasEntityFederation0640',{value:{release:RELEASE,build:BUILD,base:BASE,master:MASTER,identityPolicy:'RUT_EXACTO_ONLY',sources:['ATLAS','RES','SII_REGISTRY'],installedAt:new Date().toISOString()},enumerable:false,configurable:false,writable:false});
    installed=true;
    window.__ATLAS_ENTITY_FEDERATION__={active:true,release:RELEASE,build:BUILD,base:BASE,master:MASTER,identityPolicy:'RUT_EXACTO_ONLY',sources:['ATLAS','RES','SII_REGISTRY'],scoreMutation:false};
    return true;
  }
  loadContext0680();
  if(!install()){let attempts=0;const timer=setInterval(()=>{attempts+=1;if(install()||attempts>=80)clearInterval(timer);},250);}
})();
