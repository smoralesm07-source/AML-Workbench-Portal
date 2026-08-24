'use strict';

/* ATLAS AML 0.55.3 · RES en Explorador de Entidades
 * Decora filas y ficha rápida usando la capa común __ATLAS_ENTITY_RES__.
 * No sustituye la búsqueda canónica ni introduce joins difusos.
 */
(function atlasEntityResExplorer0553(){
  const API=window.__ATLAS_ENTITY_RES__;
  if(!API?.active||typeof API.load!=='function')return;
  const CACHE=new Map();let scheduled=false,seq=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=v=>v?String(v).slice(0,10):'—';
  const money=v=>{const n=Number(v);return Number.isFinite(n)?'$'+n.toLocaleString('es-CL',{maximumFractionDigits:0}):'—';};

  function entityIdForRow(row){return row.querySelector('[data-aex-open]')?.dataset?.aexOpen||row.querySelector('[data-aex-peek]')?.dataset?.aexPeek||null;}
  function addSourcePopup(print,available){
    const pop=print.querySelector('.aex-source-pop-inline');if(!pop||pop.querySelector('[data-aer-popup]'))return;
    const line=document.createElement('span');line.className='aex-source-pop-row';line.dataset.aerPopup='1';line.innerHTML=`<i class="res ${available?'on':''}"></i><span>Registro RES</span><b>${available?'con dato':'sin dato'}</b>`;pop.appendChild(line);
  }
  function decorateRow(row,data){
    const r=data?.registry;if(!r)return;
    const print=row.querySelector('.aex-print');
    if(print&&!print.querySelector(':scope > i.res')){const i=document.createElement('i');i.className=`res ${r.res_available?'on':''}`;i.title=`Registro RES: ${r.res_available?'aporta hechos':'sin vínculo exacto materializado'}`;print.appendChild(i);}
    if(print){addSourcePopup(print,!!r.res_available);const n=print.parentElement?.querySelector('.aex-print-n')||row.querySelector('.aex-print-n');if(n&&r.effective_source_count!=null)n.textContent=String(r.effective_source_count);}
    const idline=row.querySelector('.aex-id span');
    if(idline&&r.res_available&&!idline.querySelector('[data-aer-row-badge]')){const badge=document.createElement('em');badge.dataset.aerRowBadge='1';badge.className='aer-row-badge';badge.textContent=`RES · const. ${day(r.res_constitution_date)}`;idline.appendChild(document.createTextNode(' · '));idline.appendChild(badge);}
    row.classList.toggle('aer-res-linked',!!r.res_available);
  }
  async function decorateRows(){
    const rows=[...document.querySelectorAll('.aex-row')];if(!rows.length)return;
    const token=++seq;
    await Promise.all(rows.map(async row=>{const id=entityIdForRow(row);if(!id)return;let data=CACHE.get(id);if(!data){data=await API.load(id);if(data)CACHE.set(id,data);}if(token!==seq)return;decorateRow(row,data);}));
    if(token===seq)decorateStrip(rows);
  }
  function decorateStrip(rows){
    const strip=document.querySelector('[data-aex-insight-strip="0536"]');if(!strip)return;
    let pill=strip.querySelector('[data-aer-strip]');if(!pill){pill=document.createElement('span');pill.className='aex-insight-pill aer-strip-pill';pill.dataset.aerStrip='1';const source=strip.querySelectorAll('.aex-insight-unit')[1]?.querySelector('.aex-insight-pills,.aex-source-legend')||strip.querySelectorAll('.aex-insight-unit')[1];source?.appendChild(pill);}
    const linked=rows.filter(row=>row.classList.contains('aer-res-linked')).length;if(pill)pill.innerHTML=`<b>${linked}</b> con RES`;
  }
  function registryQuickMarkup(r){
    return `<section class="aex-block aer-quick"><h4>Registro de Empresas y Sociedades</h4><dl class="aex-dl">
      <dt>Constitución</dt><dd>${esc(day(r.res_constitution_date))}</dd>
      <dt>Fecha registro</dt><dd>${esc(day(r.res_registry_date))}</dd>
      <dt>Capital</dt><dd>${esc(money(r.res_capital))}</dd>
      <dt>Tipo / código</dt><dd>${esc(r.res_company_code||'—')}</dd>
      <dt>Domicilio social</dt><dd>${esc(r.res_social_commune||'—')}</dd>
      <dt>Domicilio tributario</dt><dd>${esc(r.res_tax_commune||'—')}</dd>
      <dt>Corte RES</dt><dd>${esc(day(r.res_cutoff_date))}</dd>
    </dl><p class="aex-note">Identidad enlazada exclusivamente por RUT exacto.</p></section>`;
  }
  async function decorateSheet(entityId){
    const data=await API.load(entityId),r=data?.registry;if(!r?.res_available)return;
    for(const delay of [80,220,500])setTimeout(()=>{const body=document.querySelector('#aex-sheet.open #aex-sheet-body');if(!body||body.querySelector('[data-aer-sheet]'))return;const node=document.createElement('div');node.dataset.aerSheet='1';node.innerHTML=registryQuickMarkup(r);body.prepend(node);},delay);
  }
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;void decorateRows();},100);}
  document.addEventListener('click',event=>{const peek=event.target.closest?.('[data-aex-peek]');if(peek?.dataset?.aexPeek)void decorateSheet(peek.dataset.aexPeek);schedule();},true);
  document.addEventListener('change',schedule,true);
  const root=document.querySelector('#content');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  schedule();
  window.__ATLAS_ENTITY_RES_EXPLORER_0553__={active:true,release:'0.55.3',build:'0553',source:'aml_entity_master_v0553',identityPolicy:'RUT_EXACTO_ONLY',installedAt:new Date().toISOString()};
})();
