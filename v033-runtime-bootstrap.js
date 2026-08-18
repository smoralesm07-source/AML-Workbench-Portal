'use strict';

/* v0.33.0 · final visible runtime authority after the IRG territorial module. */
const V033_RUNTIME='0.33.0';
const V033_RUNTIME_BUILD='0330';
function v033RuntimeApplyVersion(){
  try{if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){V0206_VERSION_OBSERVER.disconnect();V0206_VERSION_OBSERVER=null;}}catch{}
  window.__AML_ACTIVE_VERSION__=V033_RUNTIME;window.__AML_BUILD__=V033_RUNTIME_BUILD;
  const label=`Operational Radar · v${V033_RUNTIME}`;const badge=document.querySelector('.v019-brand small');
  if(badge){badge.setAttribute('data-runtime-label',label);badge.setAttribute('aria-label',label);badge.dataset.activeVersion=V033_RUNTIME;badge.textContent=label;}
  document.title=`AML Analytical Workbench · v${V033_RUNTIME}`;
  document.documentElement.setAttribute('data-aml-version',V033_RUNTIME);document.documentElement.setAttribute('data-aml-build',V033_RUNTIME_BUILD);
}
const v033RuntimeBaseShell=shell;shell=function(title,subtitle){v033RuntimeBaseShell(title,subtitle);v033RuntimeApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v033RuntimeApplyVersion;
window.__AML_RUNTIME_VERSION_APPLIER__=v033RuntimeApplyVersion;
v033RuntimeApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v033RuntimeApplyVersion,{once:true});
