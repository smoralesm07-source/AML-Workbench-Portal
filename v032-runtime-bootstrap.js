'use strict';

/* v0.32.0 · final and only visible runtime/version authority. */
const V032_RUNTIME='0.32.0';
const V032_RUNTIME_BUILD='0320';
function v032ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V032_RUNTIME;window.__AML_BUILD__=V032_RUNTIME_BUILD;
  const label=`Operational Radar · v${V032_RUNTIME}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V032_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V032_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V032_RUNTIME);document.documentElement.setAttribute('data-aml-build',V032_RUNTIME_BUILD);
}
const v032RuntimeBaseShell=shell;shell=function(title,subtitle){v032RuntimeBaseShell(title,subtitle);v032ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v032ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v032ApplyVersion;
v032ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v032ApplyVersion,{once:true});
