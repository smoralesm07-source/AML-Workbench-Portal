'use strict';

/* ATLAS AML · v032 geographic model compatibility shim
 * RETIRED_MODEL: the former 45/20/20/15 geographic model is no longer an
 * active IGR authority. The current territorial indicator is IGR v2A and is
 * owned by window.AtlasIGRV2A / window.AML_IRG_TERRITORY.
 *
 * This filename remains in the compiled runtime only to preserve historical
 * load order and downstream references. It must never calculate, render or
 * export a parallel geographic score.
 */
const V032='0.32.0-retired';
const V032_METHOD='IGR-2A-1.0.0';

function v032BindCurrentAuthority(){
  const api=window.AtlasIGRV2A;
  if(!api)return false;

  if(typeof api.open==='function'){
    window.v019LoadTerritory=api.open;
    window.loadTerritory=api.open;
  }

  const current=window.AML_IRG_TERRITORY;
  if(!current||current.version!==V032_METHOD){
    window.AML_IRG_TERRITORY={
      version:api.version||V032_METHOD,
      methodVersion:api.version||V032_METHOD,
      weights:{cead_la:1},
      state:api.state,
      load:api.load,
      open:api.open,
      byCommune:api.byCommune,
      byRegion:api.byRegion,
      scoreFor:api.scoreFor,
      exportRows:api.exportRows,
      method:{formula:'1.00*CEAD_LA'}
    };
  }

  window.ATLAS_V032_IRG_COMPAT={
    retired:true,
    contributesToIgr:false,
    formerModel:'IRG-LAFT-0.32.0',
    currentModel:V032_METHOD,
    delegatesTo:'AtlasIGRV2A',
    oldFormulaRemoved:true,
    oldRendererRemoved:true,
    oldExporterRemoved:true
  };
  return true;
}

if(!v032BindCurrentAuthority()){
  window.addEventListener('atlas:igr-v2a-ready',v032BindCurrentAuthority,{once:true});
  document.addEventListener('DOMContentLoaded',()=>v032BindCurrentAuthority(),{once:true});
  setTimeout(v032BindCurrentAuthority,0);
  setTimeout(v032BindCurrentAuthority,750);
}

export {V032,V032_METHOD,v032BindCurrentAuthority};
