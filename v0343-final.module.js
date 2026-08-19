'use strict';

/* Legacy v0.34.3 post-module compatibility layer.
 * Keeps sanctions-v12 routing and Public Entity Context loading, but delegates
 * ALL visible/runtime release identity to ATLAS current release.
 */
const VERSION=String(window.__ATLAS_ACTIVE_VERSION__||document.documentElement.getAttribute('data-atlas-release')||document.documentElement.getAttribute('data-aml-version')||'current');
const BUILD=String(window.__ATLAS_RELEASE_BUILD__||document.documentElement.getAttribute('data-aml-build')||'');

function applyVersion(){
  if(window.AtlasRelease&&typeof window.AtlasRelease.apply==='function')window.AtlasRelease.apply();
  const current=String(window.__ATLAS_ACTIVE_VERSION__||document.documentElement.getAttribute('data-atlas-release')||document.documentElement.getAttribute('data-aml-version')||VERSION);
  const build=String(window.__ATLAS_RELEASE_BUILD__||document.documentElement.getAttribute('data-aml-build')||BUILD);
  window.__AML_ACTIVE_VERSION__=current;
  if(build)window.__AML_BUILD__=build;
  window.__AML_VERSION_SOURCE__='atlas-release-guard-via-v0343-compat';
  document.title=`ATLAS AML · v${current}`;

  document.querySelectorAll('.v019-brand').forEach((brand)=>{
    const strong=brand.querySelector('strong');
    if(strong&&strong.textContent!=='ATLAS AML')strong.textContent='ATLAS AML';
    const small=brand.querySelector('small');
    if(small){
      const label=`v${current}`;
      if(small.textContent!==label)small.textContent=label;
      small.setAttribute('data-runtime-label',label);
      small.setAttribute('aria-label',`Versión ${current}`);
      small.dataset.activeVersion=current;
    }
  });

  document.querySelectorAll('.topbar .eyebrow').forEach((el)=>{
    const wanted=`ATLAS AML · v${current}`;
    if(el.textContent!==wanted)el.textContent=wanted;
  });
}

/* Redirect historical version writers to the current ATLAS authority. */
for(const name of ['v0206ApplyVersion','v0206WatchVersion','v0211ApplyVersion','v0332ApplyVersion','v0342ApplyVersion']){
  try{if(typeof window[name]==='function')window[name]=applyVersion;}catch{}
}
try{
  if(window.V0206_VERSION_OBSERVER){window.V0206_VERSION_OBSERVER.disconnect();window.V0206_VERSION_OBSERVER=null;}
}catch{}

if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){
    const result=baseShell(...args);
    applyVersion();
    return result;
  };
}

/* Keep the accepted Sanciones v12 route. */
const sanctionsV12=(window.AML_SANCTIONS_V12&&typeof window.AML_SANCTIONS_V12.reload==='function')
  ? window.AML_SANCTIONS_V12.reload
  : (typeof window.loadSanctions==='function'?window.loadSanctions:null);

if(sanctionsV12){
  window.loadSanctions=async function(...args){return sanctionsV12(...args);};
  if(window.AML_SANCTIONS_V12){
    window.AML_SANCTIONS_V12.version='12';
    window.AML_SANCTIONS_V12.workbenchVersion=String(window.__ATLAS_ACTIVE_VERSION__||VERSION);
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

/* Post-runtime context layer remains additive. */
if(!document.querySelector('link[data-aml-public-entities]')){
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./v0344-public-entities.css?b=0343';
  css.dataset.amlPublicEntities='1';
  document.head.appendChild(css);
}
import('./v0344-public-entities.module.js?b=0343').catch((error)=>{
  console.warn('[ATLAS] Public Entity Context module could not be loaded:',error);
});
