'use strict';

/* v0.30.1 · final and only visible runtime/version authority. */
const V0301_RUNTIME='0.30.1';
const V0301_RUNTIME_BUILD='0301';
function v0301ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0301_RUNTIME;window.__AML_BUILD__=V0301_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0301_RUNTIME}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V0301_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V0301_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0301_RUNTIME);document.documentElement.setAttribute('data-aml-build',V0301_RUNTIME_BUILD);
}
const v0301RuntimeBaseShell=shell;shell=function(title,subtitle){v0301RuntimeBaseShell(title,subtitle);v0301ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0301ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0301ApplyVersion;
v0301ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0301ApplyVersion,{once:true});
