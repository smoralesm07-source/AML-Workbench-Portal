'use strict';

/* Legacy v0.37 compatibility layer.
 * Preserves Gasto Público routing/interoperability, but ATLAS current release is
 * the only visible/runtime version authority. This module must never write a
 * historical version or own navigation presentation.
 */

function ensureSpendNav(){
  try{
    if(!window.__AML_PUBLIC_SPEND__?.load)return;
    const nav=document.querySelector('.v019-nav');
    if(!nav)return;
    let b=nav.querySelector('[data-view="public-spend"]');
    if(!b){
      b=document.createElement('button');
      b.type='button';
      b.className='v019-nav-btn';
      b.dataset.view='public-spend';
      b.textContent='Gasto público';
      nav.appendChild(b);
      b.addEventListener('click',()=>window.navigate?.('public-spend'));
    }
    b.classList.toggle('active',!!document.querySelector('.v037-spend'));
    window.dispatchEvent(new CustomEvent('atlas:nav-refresh',{detail:{view:'public-spend',source:'v037-compat'}}));
  }catch(error){
    console.warn('[ATLAS] spend nav compatibility',error);
  }
}

function applyCurrentRelease(){
  if(window.AtlasRelease&&typeof window.AtlasRelease.apply==='function')window.AtlasRelease.apply();
  document.querySelectorAll('.v019-nav [data-view="uaf"],.nav [data-view="uaf"]').forEach(el=>el.remove());
  ensureSpendNav();
  window.__AML_VERSION_SOURCE__='atlas-release-guard-via-v037-compat';
}

if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){
    const result=baseShell(...args);
    applyCurrentRelease();
    return result;
  };
}
if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(view,...args){
    const target=view==='uaf'?'overview':view;
    const result=await baseNavigate(target,...args);
    applyCurrentRelease();
    return result;
  };
}

window.__AML_RUNTIME_VERSION_APPLIER__=()=>window.AtlasRelease?.apply?.();
applyCurrentRelease();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyCurrentRelease,{once:true});
