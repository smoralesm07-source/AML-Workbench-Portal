'use strict';
/* ATLAS AML · Universo SO Candidate Management 0.82.0
 * Vista de candidatos seleccionados + reversa de marca + ficha de contacto OSINT.
 * Los contactos OSINT son hallazgos no verificados hasta validación explícita.
 */
(function atlasCandidateManagement0820(){
  const VERSION='0.82.0';
  const VIEW='sujetos-obligados';
  const CANDIDATES='aml_v_uaf_candidate_selected_v0803';
  const REVIEWS='aml_uaf_potential_review';
  const CONTACTS='aml_uaf_candidate_contact_osint';
  const ADDRESSES='aml_res_address_history';
  const ENRICH='aml_entity_external_enrichment_snapshot';
  const S={rows:[],loading:false,error:null,q:'',active:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return String(v)}};
  const rutKey=v=>String(v||'').toUpperCase().replace(/[^0-9K]/g,'');
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const host=()=>{try{return typeof v019Content==='function'?v019Content():document.querySelector('#content')}catch{return document.querySelector('#content')}};
  const entry=()=>window.__ATLAS_ENTITY_ENTRY__;
  const currentView=()=>{try{return window.state?.view}catch{return null}};

  function ensureButton(){
    if(currentView()!==VIEW&&!document.querySelector('.uso81'))return;
    const tabs=document.querySelector('.uso81-tabs');
    if(!tabs||tabs.querySelector('[data-uso820-candidates]'))return;
    const b=document.createElement('button');
    b.type='button';b.dataset.uso820Candidates='1';b.className='uso820-management-tab';
    b.innerHTML='<b>Gestión candidatos</b><small>seleccionados · contacto y seguimiento</small>';
    tabs.appendChild(b);
  }
  function scheduleEnsure(){setTimeout(ensureButton,0);setTimeout(ensureButton,180);setTimeout(ensureButton,650);}
  function patchApi(){
    const api=window.AtlasUniversoSO0814||window.AtlasUniversoSO0813;
    if(!api||api.__candidate0820)return;
    const original=api.open;
    api.open=async function(){const r=await original.apply(this,arguments);scheduleEnsure();return r;};
    api.__candidate0820=true;
    window.AtlasUniversoSO0814=api;window.AtlasUniversoSO0813=api;
  }

  async function load(){
    const c=db();if(!c)return;
    S.loading=true;S.error=null;render();
    let q=c.from(CANDIDATES).select('*').order('reviewed_at',{ascending:false});
    const txt=String(S.q||'').replace(/[%,()]/g,' ').trim();
    if(txt.length>=2)q=q.or(`entity_name.ilike.%${txt}%,rut.ilike.%${txt}%,implied_sector.ilike.%${txt}%`);
    const {data,error}=await q.limit(500);
    S.loading=false;S.error=error?.message||null;S.rows=data||[];render();
  }

  function card(r){
    return `<article class="uso820-card" data-rut="${esc(r.rut)}">
      <div class="uso820-card-main"><span class="uso820-kicker">CANDIDATO SELECCIONADO</span><h3>${esc(r.entity_name||r.rut)}</h3><p>${esc(r.rut)} · ${esc(r.entity_type||'—')} · ${esc(r.implied_sector||'—')}</p><div class="uso820-tags"><span>${esc(r.region||'sin región')}</span>${r.commune?`<span>${esc(r.commune)}</span>`:''}<span>IVO ${esc(r.ivo_score??'—')}</span></div></div>
      <dl class="uso820-audit"><div><dt>Marcado por</dt><dd>${esc(r.reviewed_by_email||r.reviewed_by_user_id||'—')}</dd></div><div><dt>Justificación</dt><dd>${esc(r.review_rationale||'Sin justificación registrada')}</dd></div><div><dt>Fecha gestión</dt><dd>${esc(fmtDate(r.reviewed_at))}</dd></div></dl>
      <div class="uso820-actions"><button type="button" data-uso820-contact="${esc(r.rut)}">Contacto OSINT</button><button type="button" data-uso820-open="${esc(r.entity_id||'')}" ${r.entity_id?'':'disabled'}>Expediente 360</button><button type="button" class="danger" data-uso820-undo="${esc(r.rut)}">Deshacer marca</button></div>
    </article>`;
  }
  function markup(){
    const body=S.error?`<div class="uso820-state error">${esc(S.error)}</div>`:S.loading?'<div class="uso820-state">Cargando candidatos seleccionados…</div>':S.rows.length?S.rows.map(card).join(''):'<div class="uso820-state"><b>No hay candidatos seleccionados con este filtro.</b></div>';
    return `<div class="uso820"><header class="uso820-head"><div><span>UNIVERSO SO · GESTIÓN</span><h2>Gestión candidatos</h2><p>Entidades marcadas como candidatas para revisión y eventual gestión de contacto.</p></div><button type="button" id="uso820-back">Volver a Potenciales SO</button></header><section class="uso820-toolbar"><div><b>${S.rows.length}</b><span>candidatos visibles</span></div><label><span>Buscar</span><input id="uso820-q" value="${esc(S.q)}" placeholder="Razón social, RUT o sector"></label><button type="button" id="uso820-run">Buscar</button></section><section class="uso820-list">${body}</section><div class="uso820-scrim" id="uso820-scrim"></div><aside class="uso820-sheet" id="uso820-sheet" aria-hidden="true"></aside></div>`;
  }
  function render(){const h=host();if(!h)return;h.innerHTML=markup();bind();window.AtlasCurrentUI?.refresh?.();}
  async function open(){try{if(window.state)window.state.view=VIEW}catch{};if(typeof shell==='function')shell('Universo SO','Gestión de candidatos seleccionados y contacto OSINT.');await load();return true;}

  async function undo(rut){
    const row=S.rows.find(x=>String(x.rut)===String(rut)),c=db();if(!row||!c)return;
    const note=prompt('Motivo para deshacer la marca de candidato','Reevaluación de candidatura')||'';if(!note.trim())return;
    if(!confirm(`¿Deshacer la marca de candidato para ${row.entity_name||row.rut}?`))return;
    const u=await c.auth.getUser();const uid=u?.data?.user?.id;if(!uid){alert('No fue posible identificar al usuario autenticado.');return;}
    const payload={rut:row.rut,entity_id:row.entity_id||null,user_id:uid,review_state:'REVISADO',reason_code:null,rationale:`Marca de candidato deshecha: ${note.trim()}`,ivo_at_decision:Number(row.ivo_score)||null,materiality_at_decision:Number(row.materiality_score)||null,sector_at_decision:row.implied_sector||null,evidence_class_at_decision:row.evidence_class||null,index_version:'UNIVERSO_SO_CANDIDATE_MANAGEMENT_0820',release:VERSION};
    const {error}=await c.from(REVIEWS).insert(payload);if(error){alert(`No fue posible deshacer la marca: ${error.message}`);return;}await load();
  }

  function extractContacts(records){
    const emails=new Set(),phones=new Set();
    for(const r of records||[]){const text=[r.title,r.summary,JSON.stringify(r.evidence||{})].filter(Boolean).join(' ');(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).forEach(x=>emails.add(x.toLowerCase()));(text.match(/(?:\+?56\s?)?(?:2\s?\d{4}\s?\d{4}|9\s?\d{4}\s?\d{4})/g)||[]).forEach(x=>phones.add(x.replace(/\s+/g,' ').trim()));}
    return {emails:[...emails],phones:[...phones]};
  }
  async function loadContact(row){
    const c=db(),key=rutKey(row.rut);if(!c)return {stored:[],addresses:[],emails:[],phones:[]};
    const [storedQ,addressQ,enrichQ]=await Promise.all([
      c.from(CONTACTS).select('*').eq('rut',row.rut).order('created_at',{ascending:false}),
      c.from(ADDRESSES).select('address_text,commune,region,address_status,confidence,valid_from,valid_to,refreshed_at').eq('company_rut',row.rut).order('refreshed_at',{ascending:false}).limit(20),
      c.from(ENRICH).select('title,summary,evidence,source_code,source_url,match_confidence,observed_at').or(`rut.eq.${row.rut},entity_id.eq.${row.entity_id||'__none__'}`).limit(100)
    ]);
    let addresses=addressQ.data||[];
    if(!addresses.length&&key){const alt=await c.from(ADDRESSES).select('address_text,commune,region,address_status,confidence,valid_from,valid_to,refreshed_at').ilike('company_rut',`%${key.slice(0,-1)}%`).limit(20);addresses=alt.data||[];}
    const ext=extractContacts(enrichQ.data||[]);
    return {stored:storedQ.data||[],addresses,emails:ext.emails,phones:ext.phones,enrich:enrichQ.data||[]};
  }
  function contactLine(type,value,meta=''){return `<div class="uso820-contact-line"><span>${esc(type)}</span><b>${esc(value)}</b>${meta?`<small>${esc(meta)}</small>`:''}</div>`;}
  function webQuery(row,kind){const q=`"${row.entity_name||''}" "${row.rut||''}" ${kind}`.trim();return `https://www.google.com/search?q=${encodeURIComponent(q)}`;}
  async function contact(rut){
    const row=S.rows.find(x=>String(x.rut)===String(rut)),sheet=document.querySelector('#uso820-sheet');if(!row||!sheet)return;S.active=row;sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');document.querySelector('#uso820-scrim')?.classList.add('open');sheet.innerHTML='<div class="uso820-loading">Buscando antecedentes de contacto en fuentes abiertas ya materializadas…</div>';
    const d=await loadContact(row);
    const stored=d.stored.map(x=>contactLine(x.contact_type,x.contact_value,`${x.source_label||'fuente registrada'} · ${x.verification_status}`)).join('');
    const addresses=d.addresses.map(x=>contactLine('Dirección',x.address_text||[x.commune,x.region].filter(Boolean).join(', '),`${x.address_status||'estado no informado'} · confianza ${x.confidence??'—'}`)).join('');
    const emails=d.emails.map(x=>contactLine('Email posible',x,'extraído de evidencia OSINT; no verificado')).join('');
    const phones=d.phones.map(x=>contactLine('Teléfono posible',x,'extraído de evidencia OSINT; no verificado')).join('');
    sheet.innerHTML=`<header><div><span>FICHA DE CONTACTO OSINT</span><h3>${esc(row.entity_name||row.rut)}</h3><p>${esc(row.rut)} · ${esc(row.implied_sector||'—')}</p></div><button type="button" id="uso820-close">×</button></header><section class="uso820-warning">Los datos de esta ficha son hallazgos para gestión y deben verificarse antes de contactar. No se incorporan como dato oficial por mera coincidencia.</section><section class="uso820-contact-grid"><article><h4>Contactos registrados</h4>${stored||'<p>Sin contactos persistidos.</p>'}</article><article><h4>Direcciones observadas</h4>${addresses||'<p>Sin dirección abierta materializada para este RUT.</p>'}</article><article><h4>Correos posibles</h4>${emails||'<p>Sin correo extraíble en la evidencia disponible.</p>'}</article><article><h4>Teléfonos posibles</h4>${phones||'<p>Sin teléfono extraíble en la evidencia disponible.</p>'}</article></section><section class="uso820-web"><h4>Búsqueda web dirigida</h4><p>Abre consultas exactas para complementar la ficha; los resultados no se validan automáticamente.</p><a target="_blank" rel="noopener noreferrer" href="${esc(webQuery(row,'correo email contacto'))}">Buscar correo</a><a target="_blank" rel="noopener noreferrer" href="${esc(webQuery(row,'telefono contacto'))}">Buscar teléfono</a><a target="_blank" rel="noopener noreferrer" href="${esc(webQuery(row,'direccion domicilio contacto'))}">Buscar dirección</a><button type="button" id="uso820-add-contact">Registrar hallazgo</button></section>`;
    document.querySelector('#uso820-close')?.addEventListener('click',closeContact);document.querySelector('#uso820-add-contact')?.addEventListener('click',addContact);
  }
  function closeContact(){document.querySelector('#uso820-sheet')?.classList.remove('open');document.querySelector('#uso820-sheet')?.setAttribute('aria-hidden','true');document.querySelector('#uso820-scrim')?.classList.remove('open');S.active=null;}
  async function addContact(){
    const row=S.active,c=db();if(!row||!c)return;let type=(prompt('Tipo: DIRECCION, TELEFONO, EMAIL, WEB u OTRO','EMAIL')||'').trim().toUpperCase();if(!['DIRECCION','TELEFONO','EMAIL','WEB','OTRO'].includes(type))type='OTRO';const value=(prompt('Dato de contacto','')||'').trim();if(!value)return;const source=(prompt('Fuente o URL donde fue observado','')||'').trim();const u=await c.auth.getUser();const uid=u?.data?.user?.id;if(!uid)return alert('No fue posible identificar al usuario.');const {error}=await c.from(CONTACTS).insert({rut:row.rut,entity_id:row.entity_id||null,contact_type:type,contact_value:value,source_label:source?'Fuente abierta':'Registro analista',source_url:/^https?:\/\//i.test(source)?source:null,confidence_pct:null,verification_status:'NO_VERIFICADO',evidence_note:source&&!/^https?:\/\//i.test(source)?source:null,captured_by:uid});if(error)return alert(`No fue posible registrar el hallazgo: ${error.message}`);await contact(row.rut);
  }

  function bind(){
    document.querySelector('#uso820-back')?.addEventListener('click',()=>window.AtlasUniversoSO0814?.open?.('potenciales'));
    const q=document.querySelector('#uso820-q');q?.addEventListener('input',()=>S.q=q.value);q?.addEventListener('keydown',e=>{if(e.key==='Enter')load();});document.querySelector('#uso820-run')?.addEventListener('click',load);
    document.querySelectorAll('[data-uso820-contact]').forEach(b=>b.addEventListener('click',()=>contact(b.dataset.uso820Contact)));
    document.querySelectorAll('[data-uso820-undo]').forEach(b=>b.addEventListener('click',()=>undo(b.dataset.uso820Undo)));
    document.querySelectorAll('[data-uso820-open]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.uso820Open;if(id)entry()?.explorer?.open?.(id);}));
    document.querySelector('#uso820-scrim')?.addEventListener('click',closeContact);
  }

  document.addEventListener('click',e=>{const b=e.target.closest?.('[data-uso820-candidates]');if(b){e.preventDefault();e.stopPropagation();open();return;}if(e.target.closest?.('.uso81'))scheduleEnsure();},true);
  document.addEventListener('change',e=>{if(e.target.closest?.('.uso81'))scheduleEnsure();},true);
  window.addEventListener('load',()=>{patchApi();scheduleEnsure();});
  patchApi();scheduleEnsure();
  window.AtlasCandidateManagement0820={version:VERSION,open,ensureButton,authority:'CANDIDATE_MANAGEMENT_0820',contactSemantics:'OSINT_UNVERIFIED_UNTIL_VALIDATED'};
})();
