'use strict';

/* AML Workbench v0.21.1 · atomic runtime bootstrap
 * Prevents authenticated sessions from rendering an older layer while
 * versioned scripts are still loading. The shell is revealed only after
 * the final active layer has had one opportunity to render.
 */
const V0211='0.21.1';
window.__AML_ACTIVE_VERSION__=V0211;
window.__AML_BUILD__=V0211;

const v0211BaseShell=shell;

function v0211ApplyVersion(){
  const label=`Operational Radar · v${V0211}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){
    badge.textContent=label;
    badge.setAttribute('aria-label',label);
  }
  document.title=`AML Analytical Workbench · v${V0211}`;
}

function v0211DisconnectLegacyVersionWatcher(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch(error){
    console.warn('v0.21.1 legacy version observer cleanup',error);
  }
}

shell=function(title,subtitle){
  v0211BaseShell(title,subtitle);
  v0211ApplyVersion();
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
    console.error('v0.21.1 atomic render',error);
  }finally{
    v0211ApplyVersion();
    document.documentElement.setAttribute('data-aml-build',V0211);
    document.body.classList.add('aml-runtime-ready');
    window.__AML_RUNTIME_READY__=true;
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{void v0211FinalizeRuntime();},{once:true});
}else{
  void v0211FinalizeRuntime();
}
