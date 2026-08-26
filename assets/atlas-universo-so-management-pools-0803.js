'use strict';
/* ATLAS AML · Universo SO management pools 0.80.3 */
(function atlasUniversoSOPools0803(){
  if(window.AtlasUniversoSOPools0803)return;
  const api=()=>window.AtlasUniversoSO0800;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const fmt=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'0'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const views={candidates:'aml_v_uaf_candidate_selected_v0803',rejected:'aml_v_uaf_not_candidate_v0803'};
  let pool='pending',summary=null;
  async function loadSummary(){const c=db();if(!c)return;const r=await c.from('aml_v_uaf_potential_management_summary_v0803').select('*').maybeSingle();if(!r.error)summary=r.data||null;}
  function rowTitle(r){return r.entity_name||r.registry_name||r.name||'Entidad sin nombre materializado';}
  function hideSelectedFromPending(){
    const s=api()?.state;if(!s||s.mode!=='potenciales'||pool!=='pending')return;
    document.querySelectorAll('[data-uso80-row]').forEach(b=>{const i=Number(b.dataset.uso80Row),r=s.rows?.[i];if(r?.review_state==='CANDIDATO_SELECCIONADO')b.remove();});
    const h=document.querySelector('.uso80-roster>header span');if(h&&summary)h.textContent=`Pendientes: ${fmt(summary.potential_pending)}`;
    const ft=document.querySelector('.uso80-filtertitle span');if(ft&&summary)ft.textContent=`${fmt(summary.potential_pending)} potencial(es) pendiente(s) · candidatos separados`;
  }
  function bindPools(){
    const box=document.querySelector('.uso803-pools');if(!box||box.dataset.bound0803==='1')return;box.dataset.bound0803='1';
    box.querySelectorAll('button').forEach(old=>{const b=old.cloneNode(true);old.replaceWith(b);b.addEventListener('click',()=>{pool=b.dataset.uso803Pool||'pending';box.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));if(pool==='pending'){void api()?.open?.('potenciales');setTimeout(enhance,500);}else void renderPool(pool);});});
  }
  async function renderPool(kind){
    const c=db(),s=api()?.state;if(!c||!s)return;const table=views[kind];
    let q=c.from(table).select('*',{count:'estimated'}),f=s.filters||{};
    if(f.q&&String(f.q).trim().length>=2){const x=String(f.q).replace(/[%,()]/g,' ');q=q.or(`entity_name.ilike.%${x}%,rut.ilike.%${x}%`);}if(f.sector)q=q.eq('implied_sector',f.sector);if(f.region)q=q.eq('region',f.region);
    const r=await q.order('ivo_score',{ascending:false,nullsFirst:false}).limit(150);if(r.error)return;
    const rows=r.data||[],list=document.querySelector('.uso80-list'),head=document.querySelector('.uso80-roster>header span');if(!list)return;
    if(head)head.textContent=`Mostrando ${fmt(rows.length)} de ${fmt(r.count||rows.length)}`;
    list.innerHTML=rows.length?rows.map((x,i)=>`<button type="button" class="uso80-item" data-uso803-managed-row="${i}"><div><strong>${esc(rowTitle(x))}</strong><small>${esc(x.rut||'RUT no materializado')}</small></div><p>${esc(x.implied_sector||'Sector no materializado')}</p><div><span>${kind==='candidates'?'Candidato seleccionado':'No candidato'}</span><span>IVO ${fmt(x.ivo_score)}</span></div></button>`).join(''):'<div class="uso80-empty">No hay entidades en este subconjunto.</div>';
    list.querySelectorAll('[data-uso803-managed-row]').forEach(b=>b.addEventListener('click',async()=>{const row=rows[Number(b.dataset.uso803ManagedRow)];if(!row)return;s.filters.q=String(row.rut||'');await api().open('potenciales');pool=kind;setTimeout(()=>{const idx=api().state.rows.findIndex(x=>String(x.rut||'')===String(row.rut||''));const btn=document.querySelector(`[data-uso80-row="${idx}"]`);btn?.click();setTimeout(enhance,700);},450);}));
  }
  function enrichPotentialAlerts(){
    const s=api()?.state,d=s?.detail,r=d?.row;if(s?.mode!=='potenciales'||!r)return;const box=document.querySelector('.uso80-findings');if(!box)return;
    if(Number(r.uaf_sanction_events)>0&&!Array.from(box.querySelectorAll('article b')).some(x=>/sancion|supervisor/i.test(x.textContent))){const a=document.createElement('article');a.className='high';a.innerHTML=`<div><b>Antecedente supervisor publicado</b><span>Radar Sanciones UAF</span></div><p>${fmt(r.uaf_sanction_events)} evento(s) vinculado(s); último ${esc(r.uaf_sanction_last_date||'no observado')}. Abrir ficha para revisar detalle e identidad.</p>`;box.querySelector('.uso80-method')?.before(a);}
    if(r.sii_main_activity&&!Array.from(box.querySelectorAll('article b')).some(x=>/actividad tributaria/i.test(x.textContent))){const a=document.createElement('article');a.className='ctx';a.innerHTML=`<div><b>Actividad tributaria asociada al screening</b><span>SII</span></div><p>${esc(r.sii_main_activity)} · ${esc(r.sii_sales_band||'tramo de ventas no observado')} · ${fmt(r.sii_workers)} trabajador(es).</p>`;box.querySelector('.uso80-method')?.before(a);}
  }
  async function enhance(){await loadSummary();bindPools();hideSelectedFromPending();enrichPotentialAlerts();}
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-uso80-row],[data-uso80-mode],[data-uso803-save]'))[250,700,1300].forEach(ms=>setTimeout(enhance,ms));},true);
  [300,900,1700].forEach(ms=>setTimeout(enhance,ms));
  window.AtlasUniversoSOPools0803={active:true,version:'0.80.3',enhance};
})();