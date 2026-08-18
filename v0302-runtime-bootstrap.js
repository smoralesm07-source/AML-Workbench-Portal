'use strict';

/* v0.30.2 · final and only visible runtime/version authority. */
const V0302_RUNTIME='0.30.2';
const V0302_RUNTIME_BUILD='0302';
function v0302ApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V0302_RUNTIME;window.__AML_BUILD__=V0302_RUNTIME_BUILD;
  const label=`Operational Radar · v${V0302_RUNTIME}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V0302_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V0302_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V0302_RUNTIME);document.documentElement.setAttribute('data-aml-build',V0302_RUNTIME_BUILD);
}
const v0302RuntimeBaseShell=shell;shell=function(title,subtitle){v0302RuntimeBaseShell(title,subtitle);v0302ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0302ApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v0302ApplyVersion;
v0302ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0302ApplyVersion,{once:true});
