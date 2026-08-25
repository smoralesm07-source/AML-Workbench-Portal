'use strict';

/* ATLAS AML · Entity Master federado 0.65
 * En Entidades, enruta aml_entities al maestro lógico v0650:
 * base ATLAS + RES + padrón jurídico SII. Fuera de Entidades no modifica
 * denominadores ni universos analíticos de los radares.
 * Identidad: sólo RUT canónico/exacto; no fuzzy promotion.
 */
(function atlasEntityFederation0650(){
  const RELEASE='0.65.0',BUILD='0650',MASTER='aml_entity_master_v0650',BASE='aml_entities';
  let installed=false;
  const stateNow=()=>{try{return typeof state!=='undefined'?state:(window.state||null);}catch(_e){return window.state||null;}};
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const inEntityContext=()=>{const s=stateNow();return !!s&&(s.view==='entities'||!!s.selectedEntity);};
  function install(){
    if(installed)return true;const c=client();if(!c||typeof c.from!=='function')return false;
    if(c.__atlasEntityFederation0650){installed=true;return true;}
    const priorFrom=c.from.bind(c);
    c.from=function atlasFederatedFrom0650(table){if(table===BASE&&inEntityContext())return priorFrom(MASTER);return priorFrom(table);};
    Object.defineProperty(c,'__atlasEntityFederation0650',{value:{release:RELEASE,build:BUILD,base:BASE,master:MASTER,identityPolicy:'RUT_EXACTO_ONLY',sources:['ATLAS','RES','SII_REGISTRY'],installedAt:new Date().toISOString()},enumerable:false});
    installed=true;
    window.__ATLAS_ENTITY_FEDERATION__={active:true,release:RELEASE,build:BUILD,base:BASE,master:MASTER,identityPolicy:'RUT_EXACTO_ONLY',sources:['ATLAS','RES','SII_REGISTRY'],scoreMutation:false};
    return true;
  }
  if(!install()){let n=0;const t=setInterval(()=>{n++;if(install()||n>=80)clearInterval(t);},250);}
})();
