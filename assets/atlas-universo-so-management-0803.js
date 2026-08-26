'use strict';
/* ATLAS AML · Universo SO Management + evidence detail 0.80.3
 * Progressive enhancement over Intelligence 0.80.0/0.80.2.
 * No MutationObserver. No window.navigate rewrite. Decisions are append-only in aml_uaf_potential_review.
 */
(function atlasUniversoSOManagement0803(){
  if(window.AtlasUniversoSOManagement0803)return;
  const VERSION='0.80.3';
  const T={
    sanctions:'aml_sanctions',
    review:'aml_uaf_potential_review',
    potentialPending:'aml_v_uaf_potential_pending_v0803',
    candidates:'aml_v_uaf_candidate_selected_v0803',
    rejected:'aml_v_uaf_not_candidate_v0803',
    summary:'aml_v_uaf_potential_management_summary_v0803'
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'No observado'};
  const moneyUf=v=>{const n=Number(v);return Number.isFinite(n)?`${n.toLocaleString('es-CL',{maximumFractionDigits:2})} UF`:'Monto no observado'};
  const api=()=>window.AtlasUniversoSO0800;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const state=()=>api()?.state||{};
  let selectedPool='pending';

  function removeReportability(){
    document.querySelectorAll('.uso80-section').forEach(s=>{
      const h=s.querySelector(':scope>header h2');
      if(h&&h.textContent.trim()==='Reportabilidad UAF')s.remove();
    });
  }

  function compactFindings(){
    document.querySelectorAll('.uso80-findings article').forEach((a,i)=>{
      a.dataset.uso803Finding=String(i);
      a.setAttribute('tabindex','0');
      a.setAttribute('role','button');
      const p=a.querySelector('p');
      if(p){p.dataset.full=p.textContent.trim();const t=p.textContent.trim();p.textContent=t.length>170?`${t.slice(0,167)}…`:t;}
    });
  }

  async function getSanctions(row){
    const c=db();if(!c||!row)return[];
    const refs=Array.isArray(row.uaf_sanction_refs)?row.uaf_sanction_refs.filter(Boolean):[];
    let q=c.from(T.sanctions).select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,laft_direct,amount_uf,subject,payload').order('event_date',{ascending:false}).limit(12);
    if(refs.length)q=q.in('sanction_id',refs);
    else if(row.entity_id)q=q.eq('entity_id',row.entity_id);
    else return[];
    const r=await q;return r.error?[]:(r.data||[]);
  }

  function sanctionLink(s){
    const p=s?.payload||{},a=p.attributes||{};
    const direct=a.source_url||a.url||p.source_url||p.url||null;
    if(direct)return direct;
    const reg=String(s?.regulator||a.supervisor||'').toUpperCase(),res=a.resolution;
    if(reg==='CMF')return 'https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-25539.html';
    if(reg==='UAF')return 'https://www.uaf.cl/';
    return null;
  }

  function pressItems(){return state()?.detail?.press?.items||[];}
  function levelMeaning(level){return level==='Prioritaria'?'Condición factual que justifica revisión prioritaria.':level==='Atención'?'Señal que requiere contraste con fuentes y contexto.':'Antecedente contextual para caracterización; no implica irregularidad.';}

  function closeDrawer(){document.querySelector('.uso803-drawer-backdrop')?.remove();}
  function shell(title,source,level,content){
    closeDrawer();
    const w=document.createElement('div');w.className='uso803-drawer-backdrop';
    w.innerHTML=`<aside class="uso803-drawer" role="dialog" aria-modal="true"><header><div><span>FICHA DE EVIDENCIA · INTER-RADAR</span><h2>${esc(title)}</h2><p>${esc(source)} · ${esc(level)}</p></div><button type="button" data-uso803-close>×</button></header><div class="uso803-drawer-body">${content}</div></aside>`;
    document.body.appendChild(w);w.querySelector('[data-uso803-close]')?.addEventListener('click',closeDrawer);w.addEventListener('click',e=>{if(e.target===w)closeDrawer();});
  }

  async function openFinding(article){
    const title=article.querySelector('b')?.textContent?.trim()||'Hallazgo inter-radar';
    const source=article.querySelector('span')?.textContent?.trim()||'Fuente no materializada';
    const level=article.classList.contains('high')?'Prioritaria':article.classList.contains('med')?'Atención':'Contexto';
    const body=article.querySelector('p')?.dataset.full||article.querySelector('p')?.textContent?.trim()||'';
    const row=state()?.detail?.row||state()?.rows?.[state()?.selected]||{};
    if(/sancion|supervisor/i.test(title)){
      const items=await getSanctions(row);
      const cards=items.length?items.map(s=>{const a=s.payload?.attributes||{},url=sanctionLink(s);return `<article class="uso803-evidence-card"><div class="uso803-evmeta"><b>${esc(s.regulator||a.supervisor||'Supervisor')}</b><span>${esc(s.event_date||'Fecha no observada')}</span></div><h3>${esc(s.subject||a.summary||'Sanción publicada')}</h3><dl><div><dt>Resolución</dt><dd>${esc(a.resolution||'No observada')}</dd></div><div><dt>Monto</dt><dd>${esc(moneyUf(s.amount_uf||a.amount))}</dd></div><div><dt>Materia</dt><dd>${esc(a.category||'No clasificada')}</dd></div><div><dt>Identidad</dt><dd>${esc(s.identity_status||a.identity_status||'No observada')}</dd></div></dl><p>${esc(a.summary||s.subject||'Sin resumen materializado.')}</p>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir fuente / supervisor ↗</a>`:''}</article>`}).join(''):'<div class="uso803-empty">No se materializó el detalle individual de las sanciones vinculadas en esta consulta.</div>';
      shell(title,source,level,`<section class="uso803-explain"><span>Lectura Atlas</span><p>${esc(body)}</p></section><section><h3>Antecedentes sancionatorios vinculados</h3>${cards}</section><section class="uso803-rule"><b>Regla de interpretación</b><p>${esc(levelMeaning(level))} La atribución por nombre debe mantener su estado de identidad y verificarse antes de usarla como hecho atribuible.</p></section>`);return;
    }
    if(/prensa/i.test(title)){
      const items=pressItems();
      const cards=items.length?items.slice(0,20).map(({m,a})=>`<article class="uso803-evidence-card"><div class="uso803-evmeta"><b>${esc(a.media||'Medio')}</b><span>${esc(a.date||'Fecha no observada')}</span></div><h3>${esc(a.title||'Publicación')}</h3><p>${esc(m?.role||a.summary||'La entidad aparece mencionada en la publicación.')}</p>${Array.isArray(a.phenomena)&&a.phenomena.length?`<div class="uso803-tags">${a.phenomena.slice(0,6).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Abrir publicación ↗</a>`:''}</article>`).join(''):'<div class="uso803-empty">No se materializaron menciones individuales bajo el matching nominal estricto actual.</div>';
      shell(title,source,level,`<section class="uso803-explain"><span>Lectura Atlas</span><p>${esc(body)}</p></section><section><h3>Publicaciones asociadas</h3>${cards}</section><section class="uso803-rule"><b>Regla de interpretación</b><p>La presencia en prensa es contexto OSINT. No acredita identidad, delito ni conducta y no debe convertirse por sí sola en señal de incumplimiento.</p></section>`);return;
    }
    shell(title,source,level,`<section class="uso803-explain"><span>Qué observó Atlas</span><p>${esc(body)}</p></section><section class="uso803-rule"><b>Cómo debe leerse</b><p>${esc(levelMeaning(level))} Prioridad de revisión o fiscalización no equivale a sospecha de LA/FT, culpabilidad ni incumplimiento acreditado.</p></section>`);
  }

  async function loadSummary(){
    const c=db();if(!c)return null;const r=await c.from(T.summary).select('*').maybeSingle();return r.error?null:r.data;
  }
  async function authUser(){const c=db();if(!c?.auth)return null;const r=await c.auth.getUser();return r?.data?.user||null;}
  function decisionLabel(v){return ({PENDIENTE:'Pendiente',CANDIDATO_SELECCIONADO:'Candidato seleccionado',NO_CANDIDATO:'No candidato'}[v]||v||'Pendiente');}

  async function saveDecision(decision,rationale,reason){
    const c=db(),s=state(),row=s.detail?.row||s.rows?.[s.selected];if(!c||!row)return;
    const u=await authUser();if(!u?.id)throw new Error('No fue posible identificar al usuario autenticado.');
    const payload={rut:String(row.rut||''),entity_id:row.entity_id||null,user_id:u.id,review_state:decision,reason_code:reason||null,rationale:rationale||null,ivo_at_decision:Number.isFinite(Number(row.ivo_score))?Number(row.ivo_score):null,materiality_at_decision:Number.isFinite(Number(row.materiality_score))?Number(row.materiality_score):null,sector_at_decision:row.implied_sector||null,evidence_class_at_decision:row.evidence_class||null,index_version:row.index_version||null,release:'0.80.3',workflow_note:'Universo SO analyst management'};
    const r=await c.from(T.review).insert(payload);if(r.error)throw r.error;
    await api()?.refresh?.();
    scheduleEnhance();
  }

  function managementPanel(){
    if(state()?.mode!=='potenciales'||state()?.selected==null||!state()?.detail)return;
    const dossier=document.querySelector('.uso80-dossier');if(!dossier||dossier.querySelector('.uso803-management'))return;
    const row=state().detail.row||{},cur=row.review_state||'PENDIENTE';
    const el=document.createElement('section');el.className='uso803-management uso80-section';
    el.innerHTML=`<header><div><h2>Gestión analista</h2><p>Decisión persistente y auditable. Cada modificación agrega un nuevo evento al historial; la ficha siempre muestra la decisión más reciente.</p></div></header><div class="uso803-management-grid"><div><span>Estado actual</span><b>${esc(decisionLabel(cur))}</b><small>${fmt(row.review_count||0)} decisión(es) históricas</small></div><label>Decisión<select data-uso803-decision><option value="">Seleccionar…</option><option value="CANDIDATO_SELECCIONADO">Marcar como candidato</option><option value="NO_CANDIDATO">Marcar como no candidato</option><option value="REVISADO">Volver a revisión</option></select></label><label>Motivo<select data-uso803-reason><option value="">Sin código</option><option value="NO_ES_SUJETO_OBLIGADO">No es sujeto obligado</option><option value="SIN_OPERACION_VIGENTE">Sin operación vigente</option><option value="EVIDENCIA_INSUFICIENTE">Evidencia insuficiente</option><option value="YA_INSCRITO_EN_REGISTRO_VIGENTE">Ya inscrito</option><option value="OTRO">Otro</option></select></label><label class="uso803-rationale">Fundamento<textarea data-uso803-rationale placeholder="Registra el fundamento de la decisión para conservar trazabilidad futura."></textarea></label><button type="button" data-uso803-save>Guardar decisión</button></div><div class="uso803-management-note">Al marcar <b>Candidato seleccionado</b>, la entidad deja el contador de Potenciales pendientes y pasa al subconjunto de candidatos seleccionados. La historia no se sobrescribe: se conserva cada decisión.</div>`;
    const identity=dossier.querySelector('.uso80-identity');identity?.insertAdjacentElement('afterend',el);
    el.querySelector('[data-uso803-save]')?.addEventListener('click',async()=>{const btn=el.querySelector('[data-uso803-save]'),d=el.querySelector('[data-uso803-decision]').value,r=el.querySelector('[data-uso803-reason]').value,t=el.querySelector('[data-uso803-rationale]').value.trim();if(!d)return;if(d==='NO_CANDIDATO'&&(!r||t.length<3)){alert('Para marcar No candidato debes indicar motivo y fundamento.');return;}btn.disabled=true;btn.textContent='Guardando…';try{await saveDecision(d,t,r);btn.textContent='Guardado';}catch(e){btn.disabled=false;btn.textContent='Guardar decisión';alert(`No fue posible guardar: ${e?.message||e}`);}});
  }

  async function poolBar(){
    if(state()?.mode!=='potenciales')return;
    const filters=document.querySelector('.uso80-filters');if(!filters||filters.querySelector('.uso803-pools'))return;
    const x=await loadSummary();if(!x)return;
    const div=document.createElement('div');div.className='uso803-pools';div.innerHTML=`<button type="button" data-uso803-pool="pending" class="${selectedPool==='pending'?'active':''}"><b>${fmt(x.potential_pending)}</b><span>Potenciales pendientes</span></button><button type="button" data-uso803-pool="candidates" class="${selectedPool==='candidates'?'active':''}"><b>${fmt(x.selected_candidates)}</b><span>Candidatos seleccionados</span></button><button type="button" data-uso803-pool="rejected" class="${selectedPool==='rejected'?'active':''}"><b>${fmt(x.not_candidates)}</b><span>No candidatos</span></button>`;filters.appendChild(div);
    div.querySelectorAll('[data-uso803-pool]').forEach(b=>b.addEventListener('click',()=>switchPool(b.dataset.uso803Pool)));
  }

  async function switchPool(pool){
    selectedPool=pool;const a=api(),s=state(),c=db();if(!a||!c)return;
    const table=pool==='candidates'?T.candidates:pool==='rejected'?T.rejected:T.potentialPending;
    s.selected=null;s.detail=null;s.loading=true;
    try{
      let q=c.from(table).select('*',{count:'estimated'}),f=s.filters||{};
      if(f.q&&String(f.q).trim().length>=2)q=q.or(`entity_name.ilike.%${String(f.q).replace(/[%,()]/g,' ')}%,rut.ilike.%${String(f.q).replace(/[%,()]/g,' ')}%`);
      if(f.sector)q=q.eq('implied_sector',f.sector);if(f.region)q=q.eq('region',f.region);
      const r=await q.order('ivo_score',{ascending:false,nullsFirst:false}).limit(150);if(r.error)throw r.error;s.rows=r.data||[];s.total=r.count||s.rows.length;
    }catch(e){s.error=String(e?.message||e)}finally{s.loading=false;renderUsingCore();}
  }

  function renderUsingCore(){
    const a=api();if(!a)return;
    // Core render is private; forcing refresh would reload default table. Reuse a lightweight rerender by selecting current mode.
    const active=document.querySelector('[data-uso80-mode="potenciales"]');
    if(active){const h=document.querySelector('#content');if(h){const s=state();const oldRows=s.rows,oldTotal=s.total,oldSelected=s.selected; // preserve custom pool
      // Trigger current DOM list replacement manually through a temporary state swap is not possible without private render.
      // Fall back to open and then enhance; pool buttons remain authoritative for counts while list stays current until next explicit pool support in core.
      s.rows=oldRows;s.total=oldTotal;s.selected=oldSelected;}}
    scheduleEnhance();
  }

  function enhance(){removeReportability();compactFindings();managementPanel();void poolBar();}
  function scheduleEnhance(){[0,120,350,800,1500].forEach(ms=>setTimeout(enhance,ms));}

  document.addEventListener('click',e=>{
    const f=e.target.closest?.('.uso80-findings article[data-uso803-finding]');if(f){e.preventDefault();e.stopImmediatePropagation();void openFinding(f);return;}
    if(e.target.closest?.('[data-uso80-row],[data-uso80-mode],[data-uso80-clear]'))scheduleEnhance();
  },true);
  document.addEventListener('keydown',e=>{const f=e.target.closest?.('.uso80-findings article[data-uso803-finding]');if(f&&(e.key==='Enter'||e.key===' ')){e.preventDefault();void openFinding(f);}if(e.key==='Escape')closeDrawer();});
  const a=api();if(a){const oldOpen=a.open.bind(a);a.open=async(...args)=>{const r=await oldOpen(...args);scheduleEnhance();return r;};const oldRefresh=a.refresh?.bind(a);if(oldRefresh)a.refresh=async(...args)=>{const r=await oldRefresh(...args);scheduleEnhance();return r;};}
  scheduleEnhance();
  window.AtlasUniversoSOManagement0803={active:true,version:VERSION,enhance,saveDecision,semantics:'PERSISTENT_APPEND_ONLY_ANALYST_DECISIONS+RICH_EVIDENCE_DRILLDOWN'};
})();