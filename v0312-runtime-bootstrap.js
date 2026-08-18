'use strict';

/* v0.31.2 · final and only visible runtime/version authority. */
const V0312_RUNTIME='0.31.2';
const V0312_RUNTIME_BUILD='0312';
function v0312RuntimeApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0312_RUNTIME;window.__AML_BUILD__=V0312_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0312_RUNTIME}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V0312_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V0312_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0312_RUNTIME);document.documentElement.setAttribute('data-aml-build',V0312_RUNTIME_BUILD);
}
const v0312RuntimeBaseShell=shell;shell=function(title,subtitle){v0312RuntimeBaseShell(title,subtitle);v0312RuntimeApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0312RuntimeApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0312RuntimeApplyVersion;
v0312RuntimeApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0312RuntimeApplyVersion,{once:true});
