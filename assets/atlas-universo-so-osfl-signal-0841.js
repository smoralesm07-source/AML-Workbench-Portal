'use strict';
/* ATLAS AML · Universo SO · señal OSFL 0.84.1
 * Identifica SO que pertenecen al universo OSFL canónico mediante cruce exacto
 * por entity_id contra aml_osfl_entity_runtime_snapshot, la misma vista de la
 * sección OSFL. La condición OSFL es contexto jurídico y no una señal adversa.
 */
(function atlasUniversoSOOsflSignal0841(){
  if(window.AtlasUniversoSOOsflSignal0841)return;

  const VERSION='0.84.1';
  const OSFL_VIEW='aml_osfl_entity_runtime_snapshot';
  const CACHE=new Map();
  let observer=null;
  let scheduled=false;
  let requestSeq=0;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const api=()=>window.AtlasUniversoSO0816||window.AtlasUniversoSO0814||null;

  function ensureStyle(){
    if(document.querySelector('style[data-atlas-uaf-osfl-signal="0841"]'))return;
    const style=document.createElement('style');
    style.dataset.atlasUafOsflSignal='0841';
    style.textContent=`
      .uso816 .atlas-uaf-osfl-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border:1px solid rgba(126,225,248,.24);border-radius:999px;background:rgba(76,191,222,.075);color:#8ee7ff;font-size:9px;font-weight:850;letter-spacing:.055em;line-height:1;text-transform:uppercase;white-space:nowrap;cursor:help;box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)}
      .uso816 .atlas-uaf-osfl-badge:before{content:'';width:5px;height:5px;border-radius:50%;background:#78dbf5;box-shadow:0 0 0 3px rgba(120,219,245,.08)}
      .uso816 .atlas-uaf-osfl-badge:hover,.uso816 .atlas-uaf-osfl-badge:focus{border-color:rgba(142,231,255,.42);background:rgba(86,205,235,.12);outline:none}
      .uso816 .aex-sheet .atlas-uaf-osfl-badge{margin-left:8px;vertical-align:middle}
      html[data-atlas-theme='light'] .uso816 .atlas-uaf-osfl-badge{border-color:#cce7ee;background:#f1fafc;color:#137a96;box-shadow:none}
      html[data-atlas-theme='light'] .uso816 .atlas-uaf-osfl-badge:before{background:#2397b3;box-shadow:0 0 0 3px rgba(35,151,179,.08)}
    `;
    document.head.appendChild(style);
  }

  function badge(){
    const el=document.createElement('span');
    el.className='atlas-uaf-osfl-badge';
    el.tabIndex=0;
    el.textContent='OSFL';
    el.title='OSFL · Clasificación canónica del módulo OSFL, mediante cruce exacto por identidad. Es contexto jurídico; no constituye una señal adversa ni incrementa un score por sí sola.';
    el.setAttribute('aria-label','OSFL. Clasificación canónica del módulo OSFL; contexto jurídico no adverso.');
    return el;
  }

  function visibleRows(){
    const root=document.querySelector('.uso816');
    if(!root)return[];
    return [...root.querySelectorAll('.uso81-row')].map(el=>{
      const open=el.querySelector('[data-u816-open]');
      const id=String(open?.dataset?.u816Open||'').trim();
      return {el,id};
    }).filter(x=>x.id);
  }

  function renderBadges(){
    const state=api()?.state?.()||{};
    const rows=visibleRows();
    for(const {el,id} of rows){
      const existing=el.querySelector('.uso81-row-meta > .atlas-uaf-osfl-badge');
      const shouldShow=state.mode==='inscritos'&&CACHE.get(id)===true;
      if(!shouldShow){existing?.remove();continue;}
      if(existing)continue;
      const meta=el.querySelector('.uso81-row-meta');
      if(!meta)continue;
      const mark=badge();
      const uaf=meta.querySelector('.uso81-uaf');
      if(uaf)uaf.insertAdjacentElement('afterend',mark);else meta.prepend(mark);
    }
    renderSheetBadge(state);
  }

  function renderSheetBadge(state){
    const sheet=document.querySelector('#u816-sheet.open');
    if(!sheet)return;
    const existing=sheet.querySelector('header .atlas-uaf-osfl-badge');
    const id=String(state.sheet?.entity_id||'').trim();
    const shouldShow=state.mode==='inscritos'&&id&&CACHE.get(id)===true;
    if(!shouldShow){existing?.remove();return;}
    if(existing)return;
    const title=sheet.querySelector('header h3');
    if(title)title.insertAdjacentElement('afterend',badge());
  }

  async function resolveMembership(ids){
    const c=db();
    if(!c||!ids.length)return;
    const token=++requestSeq;
    const found=new Set();
    for(let i=0;i<ids.length;i+=50){
      const part=ids.slice(i,i+50);
      const {data,error}=await c.from(OSFL_VIEW).select('entity_id').in('entity_id',part);
      if(error){console.warn('[ATLAS][Universo SO][OSFL] No fue posible resolver pertenencia OSFL:',error.message||error);return;}
      for(const row of data||[])if(row?.entity_id)found.add(String(row.entity_id));
    }
    if(token!==requestSeq)return;
    for(const id of ids)CACHE.set(id,found.has(id));
    renderBadges();
  }

  async function annotate(){
    scheduled=false;
    const state=api()?.state?.()||{};
    if(state.mode!=='inscritos'){renderBadges();return;}
    const ids=[...new Set(visibleRows().map(x=>x.id))];
    if(!ids.length)return;
    const missing=ids.filter(id=>!CACHE.has(id));
    renderBadges();
    if(missing.length)await resolveMembership(missing);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>void annotate());
  }

  function observeCurrentView(){
    observer?.disconnect();observer=null;
    const root=document.querySelector('#content')||document.querySelector('.uso816')?.parentElement;
    if(!root)return;
    observer=new MutationObserver(()=>{
      if(!document.querySelector('.uso816')){observer?.disconnect();observer=null;return;}
      schedule();
    });
    observer.observe(root,{childList:true,subtree:true});
    schedule();
  }

  function install(){
    ensureStyle();
    const current=api();
    if(!current||current.__atlasOsflSignal0841)return false;
    const baseOpen=current.open?.bind(current);
    if(typeof baseOpen==='function'){
      current.open=async function atlasOpenWithOsflSignal(...args){
        const result=await baseOpen(...args);
        observeCurrentView();
        schedule();
        return result;
      };
    }
    current.__atlasOsflSignal0841=true;
    if(document.querySelector('.uso816'))observeCurrentView();
    return true;
  }

  window.AtlasUniversoSOOsflSignal0841={version:VERSION,view:OSFL_VIEW,install,refresh:schedule,cache:CACHE};
  if(!install())window.addEventListener('atlas:universo-so-0816-ready',install,{once:true});
})();
