'use strict';

/* AML Workbench v0.27.2 · final runtime/version authority.
 * The visible version is stored in data-runtime-label and rendered by CSS,
 * so legacy textContent writers cannot change the visible label.
 */
const V0272='0.27.2';
const V0272_BUILD='0272';

function v0272ApplyVersion(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch(error){
    console.warn('v0.27.2 legacy version observer cleanup',error);
  }

  window.__AML_ACTIVE_VERSION__=V0272;
  window.__AML_BUILD__=V0272_BUILD;
  const label=`Operational Radar · v${V0272}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){
    badge.setAttribute('data-runtime-label',label);
    badge.setAttribute('aria-label',label);
    badge.dataset.activeVersion=V0272;
    /* Keep text coherent for accessibility/debugging; CSS owns what is visible. */
    if(badge.textContent!==label)badge.textContent=label;
  }
  document.title=`AML Analytical Workbench · v${V0272}`;
  document.documentElement.setAttribute('data-aml-version',V0272);
  document.documentElement.setAttribute('data-aml-build',V0272_BUILD);
}

const v0272BaseShell=shell;
shell=function(title,subtitle){
  v0272BaseShell(title,subtitle);
  v0272ApplyVersion();
};

if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0272ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0272ApplyVersion;

function v0272Finalize(){
  v0272ApplyVersion();
  document.body.classList.add('aml-runtime-ready');
  if(window.__AML_RUNTIME_READY__!=='loading')window.__AML_RUNTIME_READY__=true;
}

v0272ApplyVersion();
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',v0272Finalize,{once:true});
}else{
  v0272Finalize();
}
