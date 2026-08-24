'use strict';
/* ATLAS AML 0.55.3 · RES como fuente nacional en Entity Intelligence. */
(function atlasEntityResIntelligence0553(){
  const API=window.__ATLAS_ENTITY_RES__;if(!API?.active||typeof API.load!=='function')return;
  let scheduled=false,lastId='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=v=>v?String(v).slice(0,10):'—';
  const money=v=>{const n=Number(v);return Number.isFinite(n)?'$'+n.toLocaleString('es-CL',{maximumFractionDigits:0}):'—';};
  const selected=()=>{try{return (typeof state!=='undefined'?state:(window.state||null))?.selectedEntity||'';}catch(_e){return'';}};
  function markup(r,data){return `<article class="aei-source-card aer-intelligence-card" data-aer-intelligence="RES"><div class="aei-source-head"><div><b>Registro de Empresas y Sociedades</b><small>fuente oficial nacional · Datos.gob.cl</small></div><span class="aei-status ok">Resuelta</span></div><div class="aei-analytics"><span><b>${esc(day(r.res_constitution_date))}</b><small>constitución</small></span><span><b>${esc(money(r.res_capital))}</b><small>capital registral</small></span><span><b>${data.timeline.length}</b><small>actuaciones</small></span><span><b>${data.relations.length}</b><small>relaciones documentadas</small></span></div><p>Identidad resuelta por RUT exacto. RES aporta hechos registrales; no modifica IPA3 ni acredita por sí solo beneficiario final.</p><footer><span>Corte: ${esc(day(r.res_cutoff_date))}</span><span>Estado: ${esc(r.res_snapshot_status||'—')}</span></footer></article>`;}
  async function mount(){
    scheduled=false;const host=document.querySelector('#aei-entity-intelligence');if(!host)return;
    const id=selected();if(!id)return;
    if(host.querySelector('[data-aer-intelligence="RES"]')&&lastId===id)return;
    host.querySelector('[data-aer-intelligence="RES"]')?.remove();
    const data=await API.load(id),r=data?.registry;if(selected()!==id||!r?.res_available)return;
    const national=[...host.querySelectorAll('.aei-group')].find(g=>/Conectores nacionales/i.test(g.textContent||''));
    const grid=national?.querySelector('.aei-source-grid')||host.querySelector('.aei-source-grid');if(!grid)return;
    grid.insertAdjacentHTML('beforeend',markup(r,data));lastId=id;
  }
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>void mount(),120);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',schedule,true);schedule();
  window.__ATLAS_ENTITY_RES_INTELLIGENCE_0553__={active:true,release:'0.55.3',source:'RES',scoreMutation:false,installedAt:new Date().toISOString()};
})();
