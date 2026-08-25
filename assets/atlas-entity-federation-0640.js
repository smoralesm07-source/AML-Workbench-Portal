'use strict';

/* ATLAS AML · Entity Master federado 0640
 *
 * Hace que las autoridades de búsqueda/Entity 360 existentes consulten el
 * maestro lógico aml_entity_master_v0553 cuando el usuario está en Entidades.
 * El resto de la aplicación conserva aml_entities como tabla base para no
 * alterar universos, KPIs ni procesos de otros radares.
 *
 * Identidad: RES sólo forma entidad por RUT canónico; el nombre sirve para
 * búsqueda, nunca para promover identidad. La vista es de sólo lectura y
 * security_invoker; RLS permanece en las tablas fuente.
 */
(function atlasEntityFederation0640(){
  const RELEASE='0.64.0';
  const BUILD='0640';
  const MASTER='aml_entity_master_v0553';
  const BASE='aml_entities';
  let installed=false;

  function currentState(){
    try{return typeof state!=='undefined'?state:(window.state||null);}catch(_error){return window.state||null;}
  }
  function client(){
    try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}
  }
  function inEntityContext(){
    const s=currentState();
    if(!s)return false;
    return s.view==='entities' || !!s.selectedEntity;
  }
  function install(){
    if(installed)return true;
    const c=client();
    if(!c||typeof c.from!=='function')return false;
    if(c.__atlasEntityFederation0640){installed=true;return true;}
    const baseFrom=c.from.bind(c);
    c.from=function atlasFederatedFrom(table){
      if(table===BASE && inEntityContext())return baseFrom(MASTER);
      return baseFrom(table);
    };
    Object.defineProperty(c,'__atlasEntityFederation0640',{value:{release:RELEASE,build:BUILD,base:BASE,master:MASTER,identityPolicy:'RUT_EXACTO_ONLY',installedAt:new Date().toISOString()},enumerable:false,configurable:false,writable:false});
    installed=true;
    window.__ATLAS_ENTITY_FEDERATION__={active:true,release:RELEASE,build:BUILD,base:BASE,master:MASTER,identityPolicy:'RUT_EXACTO_ONLY',scoreMutation:false};
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      if(install()||attempts>=80)clearInterval(timer);
    },250);
  }
})();
