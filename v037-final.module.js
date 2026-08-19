'use strict';

/* AML Workbench v0.37.0 · final runtime authority */
const VERSION='0.37.0';
const BUILD='0370';
function ensureSpendNav(){
  try{window.__AML_PUBLIC_SPEND__?.load&&document.querySelector('.v019-nav')&&(()=>{
    const nav=document.querySelector('.v019-nav');
    let b=nav.querySelector('[data-view="public-spend"]');
    if(!b){b=document.createElement('button');b.type='button';b.className='v019-nav-btn';b.dataset.view='public-spend';b.textContent='Gasto Público';const t=nav.querySelector('[data-view="territory"]');if(t)t.insertAdjacentElement('afterend',b);else nav.appendChild(b);b.addEventListener('click',()=>window.navigate?.('public-spend'));}
    b.classList.toggle('active',!!document.querySelector('.v037-spend'));
  })();}catch{}
}
function applyVersion(){
  window.__AML_ACTIVE_VERSION__=VERSION;
  window.__AML_BUILD__=BUILD;
  window.__AML_VERSION_SOURCE__='v037-final.module';
  document.title=`AML Analytical Workbench · v${VERSION}`;
  document.documentElement.setAttribute('data-aml-version',VERSION);
  document.documentElement.setAttribute('data-aml-build',BUILD);
  document.querySelectorAll('.v019-brand small').forEach(el=>{el.textContent=`Operational Radar · v${VERSION}`;el.dataset.activeVersion=VERSION;});
  document.querySelectorAll('.topbar .eyebrow').forEach(el=>{el.textContent=`AML Analytical Workbench · v${VERSION}`;});
  document.querySelectorAll('.v019-nav [data-view="uaf"],.nav [data-view="uaf"]').forEach(el=>el.remove());
  ensureSpendNav();
}
if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){const result=baseShell(...args);applyVersion();return result;};
}
if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(view,...args){const target=view==='uaf'?'overview':view;const result=await baseNavigate(target,...args);applyVersion();return result;};
}
window.__AML_RUNTIME_VERSION_APPLIER__=applyVersion;
applyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applyVersion();setTimeout(applyVersion,0);setTimeout(applyVersion,150);setTimeout(applyVersion,350);},{once:true});
else{setTimeout(applyVersion,0);setTimeout(applyVersion,150);setTimeout(applyVersion,350);}
