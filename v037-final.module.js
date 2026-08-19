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

/* Bidirectional interoperability: Entity 360 -> Gasto Público.
 * The bridge resolves only the already-governed entity row and forwards its exact RUT.
 * No name similarity is used and no missing match is interpreted as an adverse signal.
 */
if(typeof window.openEntity==='function'&&!window.openEntity.__v037SpendBridge){
  const baseOpenEntity=window.openEntity;
  const wrapped=async function(entityId,...args){
    const result=await baseOpenEntity(entityId,...args);
    try{
      if(!window.sb||!window.__AML_PUBLIC_SPEND__?.focusRut)return result;
      const {data,error}=await window.sb.from('aml_entities').select('entity_id,rut,name').eq('entity_id',entityId).maybeSingle();
      if(error||!data?.rut)return result;
      const host=document.querySelector('#content');
      if(!host||host.querySelector('[data-v037-entity-bridge]'))return result;
      const panel=document.createElement('section');
      panel.className='panel';
      panel.setAttribute('data-v037-entity-bridge','1');
      panel.style.marginTop='18px';
      panel.innerHTML=`<div class="panel-head"><h2>Gasto Público</h2><span>Radar Presupuesto Abierto</span></div><div class="panel-body"><div class="list-item"><strong>Explorar relaciones de gasto de esta entidad</strong><div class="meta">El cruce se realizará por RUT exacto. Si no existe como proveedor en el payload publicado, se informará como cobertura y no como señal.</div><div style="margin-top:10px"><button type="button" class="secondary" data-v037-open-spend>Abrir en Gasto Público</button></div></div></div>`;
      host.appendChild(panel);
      panel.querySelector('[data-v037-open-spend]').addEventListener('click',async()=>{
        const btn=panel.querySelector('[data-v037-open-spend]');btn.disabled=true;btn.textContent='Buscando en Gasto Público…';
        const ok=await window.__AML_PUBLIC_SPEND__.focusRut(data.rut).catch(()=>false);
        if(!ok){btn.disabled=false;btn.textContent='Sin coincidencia en Gasto Público';}
      });
    }catch{}
    return result;
  };
  wrapped.__v037SpendBridge=true;
  window.openEntity=wrapped;
}

window.__AML_RUNTIME_VERSION_APPLIER__=applyVersion;
applyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{applyVersion();setTimeout(applyVersion,0);setTimeout(applyVersion,150);setTimeout(applyVersion,350);},{once:true});
else{setTimeout(applyVersion,0);setTimeout(applyVersion,150);setTimeout(applyVersion,350);}
