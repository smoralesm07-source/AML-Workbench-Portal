'use strict';
/* ATLAS AML 0.55.5 · RES en Conciliación UAF ↔ SII.
 *
 * La conciliación ya trabaja sobre Entity ID canónico. Este decorador usa ese
 * identificador directamente, sin resolver nuevamente por nombre ni RUT.
 * RES aporta contexto registral y cobertura; no altera estado UAF/SII,
 * screening de potenciales SO ni ninguna señal analítica.
 */
(function atlasResReconciliation0555(){
  const RES=window.__ATLAS_ENTITY_RES__;
  if(!RES?.active||typeof RES.load!=='function')return;
  const CACHE=new Map();let scheduled=false,pass=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=v=>v?String(v).slice(0,10):'—';
  const money=v=>{const n=Number(v);return Number.isFinite(n)?'$'+n.toLocaleString('es-CL',{maximumFractionDigits:0}):'—';};
  async function load(entityId){
    if(!entityId)return null;
    if(CACHE.has(entityId))return CACHE.get(entityId);
    const p=RES.load(entityId).catch(()=>null);CACHE.set(entityId,p);return p;
  }
  function chip(r){return `<span class="aer-recon-chip" title="RES · identidad ATLAS canónica"><i></i>RES${r?.res_constitution_date?` · ${esc(day(r.res_constitution_date))}`:''}</span>`;}
  function factline(r){return `<small class="aer-recon-fact">Constitución ${esc(day(r.res_constitution_date))}${r.res_capital!=null?` · capital ${esc(money(r.res_capital))}`:''}${r.res_social_commune?` · ${esc(r.res_social_commune)}`:''}</small>`;}
  async function decorateRows(token){
    const rows=[...document.querySelectorAll('.v0434-recon [data-v0434-entity]')];
    await Promise.all(rows.map(async row=>{
      if(token!==pass||row.dataset.aerReconChecked==='1')return;
      const entityId=String(row.dataset.v0434Entity||'').trim();if(!entityId)return;
      const pkg=await load(entityId);if(token!==pass||!row.isConnected)return;
      row.dataset.aerReconChecked='1';const r=pkg?.registry;if(!r?.res_available)return;
      row.classList.add('aer-recon-linked');
      const identity=row.querySelector('.identity')||row.querySelector(':scope > div:first-child')||row.firstElementChild;
      const title=identity?.querySelector('b');if(title&&!row.querySelector('.aer-recon-chip'))title.insertAdjacentHTML('afterend',chip(r));
      if(identity&&!row.querySelector('.aer-recon-fact'))identity.insertAdjacentHTML('beforeend',factline(r));
    }));
  }
  function coverage(){
    const host=document.querySelector('.v0434-recon');if(!host)return;
    const rows=[...host.querySelectorAll('[data-v0434-entity]')];if(!rows.length)return;
    const linked=rows.filter(r=>r.classList.contains('aer-recon-linked')).length;
    let box=host.querySelector('[data-aer-recon-coverage]');
    if(!box){
      const target=host.querySelector('.v0434-explorer-card .v0434-head')||host.querySelector('.v0434-candidate-results-card .v0434-head');if(!target)return;
      box=document.createElement('div');box.dataset.aerReconCoverage='1';box.className='aer-recon-coverage';target.appendChild(box);
    }
    box.innerHTML=`<span><i></i><b>${linked}</b> con RES</span><small>de ${rows.length} entidades visibles · Entity ID canónico</small>`;
  }
  async function run(){scheduled=false;const token=++pass;await decorateRows(token);if(token===pass)coverage();window.__ATLAS_RES_RECONCILIATION_STATE_0555__={active:true,visible:[...document.querySelectorAll('.v0434-recon [data-v0434-entity]')].length,linked:[...document.querySelectorAll('.v0434-recon .aer-recon-linked')].length,checkedAt:new Date().toISOString()};}
  function queue(){if(scheduled)return;scheduled=true;setTimeout(()=>void run(),120);}
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(queue,100),true);
  queue();
  window.__ATLAS_RES_RECONCILIATION_0555__={active:true,release:'0.55.5',surface:'conciliacion-uaf-sii',identityPolicy:'ENTITY_ID_CANONICO_ONLY',nameMatching:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
