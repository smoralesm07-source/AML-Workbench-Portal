'use strict';

/* AML Workbench v0.34.3 · final post-module runtime authority.
 * Runs as the last module so deferred v032 territory code cannot reclaim the app version.
 * Also pins the Sanciones route to the accepted v12 loader.
 * Public Entity Context v1 is loaded only after this runtime authority is established.
 */
const VERSION='0.34.3';
const BUILD='0343';

function applyVersion(){
  window.__AML_ACTIVE_VERSION__=VERSION;
  window.__AML_BUILD__=BUILD;
  window.__AML_VERSION_SOURCE__='v0343-final.module';
  document.title=`AML Analytical Workbench · v${VERSION}`;
  document.documentElement.setAttribute('data-aml-version',VERSION);
  document.documentElement.setAttribute('data-aml-build',BUILD);

  const operational=`Operational Radar · v${VERSION}`;
  document.querySelectorAll('.v019-brand small').forEach((el)=>{
    if(el.textContent!==operational)el.textContent=operational;
    el.setAttribute('data-runtime-label',operational);
    el.setAttribute('aria-label',operational);
    el.dataset.activeVersion=VERSION;
  });

  document.querySelectorAll('.topbar .eyebrow').forEach((el)=>{
    const wanted=`AML Analytical Workbench · v${VERSION}`;
    if(el.textContent!==wanted)el.textContent=wanted;
  });
}

/* Neutralize classic legacy version writers that schedule work after DOMContentLoaded. */
for(const name of ['v0206ApplyVersion','v0206WatchVersion','v0211ApplyVersion','v0332ApplyVersion']){
  try{if(typeof window[name]==='function')window[name]=applyVersion;}catch{}
}
try{
  if(window.V0206_VERSION_OBSERVER){window.V0206_VERSION_OBSERVER.disconnect();window.V0206_VERSION_OBSERVER=null;}
}catch{}

/* v032-irg-territory.js executes deferred as a module and wraps shell after classic scripts.
 * Wrap that final shell once more so the active version always wins synchronously.
 */
if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){
    const result=baseShell(...args);
    applyVersion();
    return result;
  };
}

/* Freeze Sanciones navigation on the v12 implementation captured after hardening. */
const sanctionsV12=(window.AML_SANCTIONS_V12&&typeof window.AML_SANCTIONS_V12.reload==='function')
  ? window.AML_SANCTIONS_V12.reload
  : (typeof window.loadSanctions==='function'?window.loadSanctions:null);

if(sanctionsV12){
  window.loadSanctions=async function(...args){return sanctionsV12(...args);};
  if(window.AML_SANCTIONS_V12){
    window.AML_SANCTIONS_V12.version='12';
    window.AML_SANCTIONS_V12.workbenchVersion=VERSION;
    window.AML_SANCTIONS_V12.reload=window.loadSanctions;
  }
}

if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(view,...args){
    if(view==='sanctions'&&typeof window.loadSanctions==='function')return window.loadSanctions();
    const result=await baseNavigate(view,...args);
    applyVersion();
    return result;
  };
}

window.__AML_RUNTIME_VERSION_APPLIER__=applyVersion;
applyVersion();

/* Re-assert after legacy DOMContentLoaded timers without polling forever. */
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    applyVersion();
    setTimeout(applyVersion,0);
    setTimeout(applyVersion,100);
  },{once:true});
}else{
  setTimeout(applyVersion,0);
  setTimeout(applyVersion,100);
}

/* Post-runtime context layer. It is intentionally additive: it must not replace
 * sanctions v12, auth, routing or the core data contracts. */
if(!document.querySelector('link[data-aml-public-entities]')){
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./v0344-public-entities.css?b=0343';
  css.dataset.amlPublicEntities='1';
  document.head.appendChild(css);
}
import('./v0344-public-entities.module.js?b=0343').catch((error)=>{
  console.warn('[AML] Public Entity Context module could not be loaded:',error);
});
