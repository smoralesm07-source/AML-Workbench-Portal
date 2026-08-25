'use strict';
/* ATLAS AML 0.55.4 · Propagación transversal RES.
 *
 * Enriquece superficies que ya exponen un RUT propio. No modifica sus datos,
 * filtros, scores ni señales: sólo añade contexto registral de la entidad
 * canónica cuando existe vínculo exacto por RUT.
 */
(function atlasResCrossSurface0554(){
  const CTX=window.__ATLAS_ENTITY_CONTEXT_0554__;
  if(!CTX?.active)return;
  const SEEN=new Map();let scheduled=false,pass=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=v=>v?String(v).slice(0,10):'—';
  const money=v=>{const n=Number(v);return Number.isFinite(n)?'$'+n.toLocaleString('es-CL',{maximumFractionDigits:0}):'—';};
  function extractRut(text){
    const candidates=String(text||'').toUpperCase().match(/\d{1,2}(?:\.\d{3}){2}-[0-9K]|\d{7,8}-[0-9K]/g)||[];
    return candidates.find(x=>CTX.validRut(x))||null;
  }
  async function byRut(rut){
    const key=CTX.normalizeRut(rut);if(!CTX.validRut(key))return null;
    if(SEEN.has(key))return SEEN.get(key);
    const p=CTX.loadByRut(key).catch(()=>null);SEEN.set(key,p);return p;
  }
  function chip(r,label='RES'){
    return `<span class="aec-res-chip" title="Registro de Empresas y Sociedades · vínculo por RUT exacto"><i></i>${esc(label)}${r?.res_constitution_date?` · ${esc(day(r.res_constitution_date))}`:''}</span>`;
  }
  function card(pkg,origin){
    const r=pkg?.registry;if(!r?.res_available)return '';
    return `<section class="aec-res-card" data-aec-origin="${esc(origin)}"><div class="aec-res-card-head"><div><span>CONTEXTO SOCIETARIO · RES</span><b>${esc(r.res_legal_name||r.name||'Entidad registrada')}</b></div><button type="button" data-aec-open="${esc(r.entity_id)}">Abrir Entidad 360 ↗</button></div><div class="aec-res-card-grid"><div><small>Constitución</small><strong>${esc(day(r.res_constitution_date))}</strong></div><div><small>Capital</small><strong>${esc(money(r.res_capital))}</strong></div><div><small>Domicilio social</small><strong>${esc(r.res_social_commune||'—')}</strong></div><div><small>Corte RES</small><strong>${esc(day(r.res_cutoff_date))}</strong></div></div><p>Contexto registral informativo. No altera la señal, score o conclusión del módulo actual.</p></section>`;
  }
  function bindOpen(root=document){
    root.querySelectorAll('[data-aec-open]').forEach(btn=>{if(btn.dataset.aecBound==='1')return;btn.dataset.aecBound='1';btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();CTX.openEntity(btn.dataset.aecOpen);});});
  }

  async function spendRows(token){
    const rows=[...document.querySelectorAll('#atlas-mp-audit-0550 .mpa-row[data-kind][data-key],#atlas-mp-audit-0550 .mpa-table [data-kind][data-key]')];
    await Promise.all(rows.map(async row=>{
      if(token!==pass||row.dataset.aecChecked==='1')return;
      const kind=row.dataset.kind;if(kind!=='provider'&&kind!=='service')return;
      const key=row.dataset.key;if(!CTX.validRut(key)){row.dataset.aecChecked='1';return;}
      const pkg=await byRut(key);if(token!==pass||!row.isConnected)return;
      row.dataset.aecChecked='1';const r=pkg?.registry;if(!r?.res_available)return;
      row.classList.add('aec-res-linked');
      const target=row.matches('tr')?row.querySelector('td:first-child'):row.querySelector('b')||row.firstElementChild;
      if(target&&!row.querySelector('.aec-res-chip'))target.insertAdjacentHTML('beforeend',chip(r));
    }));
  }
  async function spendFocus(){
    const host=document.getElementById('atlas-mp-audit-0550'),api=window.__ATLAS_PUBLIC_SPEND_AUDIT_0550__;if(!host||!api?.state)return;
    const focus=api.state.supplier||api.state.buyer||null;
    const existing=host.querySelector('[data-aec-spend-focus]');
    if(!focus||!CTX.validRut(focus)){existing?.remove();return;}
    const rutKey=CTX.normalizeRut(focus);if(existing?.dataset.aecSpendFocus===rutKey)return;
    const pkg=await byRut(focus),r=pkg?.registry;if(!r?.res_available){existing?.remove();return;}
    const controls=host.querySelector('.mpa-controls');if(!controls)return;
    existing?.remove();const wrap=document.createElement('div');wrap.dataset.aecSpendFocus=rutKey;wrap.innerHTML=card(pkg,'mercado-publico');controls.insertAdjacentElement('afterend',wrap);bindOpen(wrap);
  }

  async function sanctionRows(token){
    const rows=[...document.querySelectorAll('.sv12-approved #entityList .entityRow[data-id],.sv12-approved .entityRow[data-id]')];
    await Promise.all(rows.map(async row=>{
      if(token!==pass||row.dataset.aecChecked==='1')return;
      const rut=extractRut(row.querySelector('.esub')?.textContent||row.textContent);if(!rut){row.dataset.aecChecked='1';return;}
      const pkg=await byRut(rut);if(token!==pass||!row.isConnected)return;
      row.dataset.aecChecked='1';const r=pkg?.registry;if(!r?.res_available)return;
      row.classList.add('aec-res-linked');const name=row.querySelector('.ename');if(name&&!row.querySelector('.aec-res-chip'))name.insertAdjacentHTML('beforeend',chip(r));
    }));
  }
  async function sanctionDrawer(){
    const head=document.querySelector('.sv12-approved #drawerHead')||document.getElementById('drawerHead');
    const body=document.querySelector('.sv12-approved #drawerBody')||document.getElementById('drawerBody');
    if(!head||!body)return;
    const rut=extractRut(head.querySelector('.dhSub')?.textContent||head.textContent);const old=body.querySelector('[data-aec-sanction-drawer]');
    if(!rut){old?.remove();return;}
    const rutKey=CTX.normalizeRut(rut);if(old?.dataset.aecSanctionDrawer===rutKey)return;
    const pkg=await byRut(rut),r=pkg?.registry;if(!r?.res_available){old?.remove();return;}
    old?.remove();const wrap=document.createElement('div');wrap.dataset.aecSanctionDrawer=rutKey;wrap.innerHTML=card(pkg,'sanciones');body.prepend(wrap);bindOpen(wrap);
  }

  async function run(){scheduled=false;const token=++pass;await Promise.all([spendRows(token),sanctionRows(token),spendFocus(),sanctionDrawer()]);bindOpen();window.__ATLAS_RES_CROSS_SURFACE_STATE_0554__={active:true,pass:token,cacheKeys:SEEN.size,checkedAt:new Date().toISOString()};}
  function queue(){if(scheduled)return;scheduled=true;setTimeout(()=>void run(),120);}
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:false});
  document.addEventListener('click',()=>{setTimeout(queue,80);setTimeout(queue,300);},true);
  window.addEventListener('hashchange',queue);queue();
  window.__ATLAS_RES_CROSS_SURFACE_0554__={active:true,release:'0.55.4',surfaces:['mercado-publico','sanciones'],identityPolicy:'RUT_VALIDO_EXACTO_ONLY',scoreMutation:false,installedAt:new Date().toISOString()};
})();
