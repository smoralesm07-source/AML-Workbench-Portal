'use strict';

/* AML Workbench v0.27.1 · single final runtime/version authority.
 * Loaded LAST. Legacy bootstraps may coordinate startup, but they must not own
 * the active version label or build globals.
 */
const V0271='0.27.1';
const V0271_BUILD='0271';

function v0271ApplyVersion(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch(error){
    console.warn('v0.27.1 legacy version observer cleanup',error);
  }

  window.__AML_ACTIVE_VERSION__=V0271;
  window.__AML_BUILD__=V0271_BUILD;
  const label=`Operational Radar · v${V0271}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){
    badge.textContent=label;
    badge.setAttribute('aria-label',label);
    badge.dataset.activeVersion=V0271;
  }
  document.title=`AML Analytical Workbench · v${V0271}`;
  document.documentElement.setAttribute('data-aml-version',V0271);
  document.documentElement.setAttribute('data-aml-build',V0271_BUILD);
}

const v0271BaseShell=shell;
shell=function(title,subtitle){
  v0271BaseShell(title,subtitle);
  v0271ApplyVersion();
};

/* Legacy startup barrier calls this name at DOMContentLoaded. Redirect it to
 * the final authority rather than allowing v0.21.1 to write its own label. */
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0271ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0271ApplyVersion;

function v0271Finalize(){
  v0271ApplyVersion();
  document.body.classList.add('aml-runtime-ready');
  if(window.__AML_RUNTIME_READY__!=='loading')window.__AML_RUNTIME_READY__=true;
}

/* The file itself is parser-blocking and loaded last, so applying immediately
 * is safe for version ownership. DOMContentLoaded repeats the assertion after
 * legacy startup handlers have run. */
v0271ApplyVersion();
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',v0271Finalize,{once:true});
}else{
  v0271Finalize();
}
