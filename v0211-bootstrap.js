'use strict';

/* AML Workbench legacy atomic startup barrier.
 * This file preserves the startup sequencing introduced in v0.21.1, but it is
 * intentionally NOT an authority for the active application version. The final
 * runtime bootstrap loaded last owns version/build globals and the visible label.
 */
const V0211='0.21.1';
const v0211BaseShell=shell;

/* Final runtime replaces this function before DOMContentLoaded. Keeping a
 * neutral no-op avoids any transient or persistent legacy version write. */
function v0211ApplyVersion(){}

function v0211DisconnectLegacyVersionWatcher(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch(error){
    console.warn('legacy version observer cleanup',error);
  }
}

shell=function(title,subtitle){
  v0211BaseShell(title,subtitle);
  try{v0211ApplyVersion();}catch(error){console.warn('runtime version apply',error);}
};

async function v0211FinalizeRuntime(){
  if(window.__AML_RUNTIME_READY__)return;
  window.__AML_RUNTIME_READY__='loading';
  try{
    v0211DisconnectLegacyVersionWatcher();
    if(typeof state!=='undefined'&&state?.user&&state?.access&&typeof navigate==='function'){
      await navigate(state.view||'overview');
    }
  }catch(error){
    console.error('atomic render',error);
  }finally{
    try{v0211ApplyVersion();}catch(error){console.warn('runtime version final apply',error);}
    document.body.classList.add('aml-runtime-ready');
    window.__AML_RUNTIME_READY__=true;
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{void v0211FinalizeRuntime();},{once:true});
}else{
  void v0211FinalizeRuntime();
}
