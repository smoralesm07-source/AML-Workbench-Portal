'use strict';
(function atlasUniversoSO0600(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0600__={active:false,reason:'obligated-core-unavailable'};return;}
  const VIEW='aml_v_uaf_supervision_360_current';
  const REVIEW='aml_uaf_potential_review';
  const TIMELINE='aml_entity_res_timeline_v0556';
  const fmt=core.fmt, day=core.day, esc=core.esc;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const content=()=>document.querySelector('#content');
  const STATES={
    PENDIENTE:'Pendiente',REVISADO:'Revisado',ELEGIBLE:'Elegible',PRIORIZADO:'Priorizado',
    SELECCIONADO_PARA_INSCRIPCION:'Seleccionado',INVITACION_PREPARADA:'Invitación preparada',INVITADO:'Invitado',
    EN_SEGUIMIENTO:'En seguimiento',INSCRITO:'Inscrito',CERRADO:'Cerrado',DESCARTADO:'Descartado',
    NO_APLICA:'No aplica',YA_INSCRITO:'Ya inscrito',SIN_ACTIVIDAD_VIGENTE:'Sin actividad vigente'
  };
  const state={management:null,loading:false,error:null};
  const value=v=>v===null||v===undefined||v===''?'—':String(v);
  const money=v=>{const n=Number(v);return Number.isFinite(n)?`$${Math.round(n).toLocaleString('es-CL')}`:'—';};
  const fact=(k,v)=>`<div class="uso60-fact"><span>${esc(k)}</span><b>${esc(value(v))}</b></div>`;

  function addModeButton(){
    const bar=document.querySelector('.so-modes');
    if(!bar||bar.querySelector('[data-atlas-coverage]'))return;
    const b=document.createElement('button');
    b.type='button';b.dataset.atlasCoverage='1';b.textContent='Gestión de cobertura';
    bar.appendChild(b);
  }

  function addIntegrityBanner(){
    if(core.state?.mode!=='panorama')return;
    const root=document.querySelector('.so-root');
    if(!root||root.querySelector('.uso60-integrity'))return;
    const observed=Number(core.state?.overview?.registry?.subjects||0);
    if(!observed)return;
    const n=document.createElement('section');
    n.className='uso60-card uso60-integrity'+(observed!==10294?' uso60-alert':'');
    n.innerHTML=`<h2>Contrato de verdad del universo</h2><p>${observed===10294?'El snapshot coincide con el padrón canónico esperado.':'El snapshot materializado contiene '+fmt(observed)+' sujetos. La referencia operacional esperada es 10.294; Atlas debe tratar esta diferencia como brecha de cobertura, no como reducción del universo.'}</p>`+
      `<div class="uso60-sourcegrid"><div class="uso60-source ${observed===10294?'ok':'gap'}"><i></i><b>Padrón UAF</b><small>${fmt(observed)} observados</small></div><div class="uso60-source gap"><i></i><b>Reportabilidad por entidad</b><small>Fuente aún no materializada a nivel entidad</small></div><div class="uso60-source gap"><i></i><b>Prensa por entidad</b><small>Disponible en módulo Entidades; falta snapshot común</small></div></div>`;
    const modes=root.querySelector('.so-modes');
    modes?.insertAdjacentElement('afterend',n);
  }

  async function load360(rut){
    const client=db();if(!client)return null;
    const {data,error}=await client.from(VIEW).select('*').eq('rut',rut).maybeSingle();
    if(error)throw error;
    return data;
  }
  async function loadTimeline(rut){
    const client=db();if(!client)return [];
    const {data,error}=await client.from(TIMELINE).select('actuation_type,actuation_category,actuation_date,registry_date,evidence_status,document_review_status').eq('rut',rut).order('actuation_date',{ascending:false}).limit(12);
    if(error)return [];
    return data||[];
  }

  function sourceGrid(r){
    const c=r?.source_coverage||{};
    const defs=[['UAF','uaf'],['SII','sii'],['Territorio','territory'],['Sanciones','sanctions'],['Mercado Público / Lobby / CGR','public_spend'],['OSFL','osfl'],['RES / sociedades','res'],['Reportabilidad entidad','reportability_entity_level'],['Prensa entidad','press_entity_level']];
    return `<div class="uso60-sourcegrid">${defs.map(([label,key])=>{
      const ok=c[key]===true;const cls=ok?'ok':'gap';
      const msg=ok?'Dato enlazado en el corte':'Sin snapshot común a nivel entidad; no equivale a ausencia de información';
      return `<div class="uso60-source ${cls}" title="${esc(msg)}"><i></i><b>${esc(label)}</b><small>${esc(msg)}</small></div>`;
    }).join('')}</div>`;
  }

  function timelineHtml(rows){
    if(!rows.length)return '<div class="so-empty">Sin eventos societarios materializados para esta entidad.</div>';
    return `<div class="uso60-timeline">${rows.map(x=>`<div class="uso60-event"><time>${esc(day(x.actuation_date||x.registry_date))}</time><b>${esc(x.actuation_type||x.actuation_category||'Actuación')}</b><small>${esc(x.evidence_status||x.document_review_status||'evidencia registrada')}</small></div>`).join('')}</div>`;
  }

  async function enhanceDossier(){
    const host=document.querySelector('#so-dossier');
    if(!host||host.querySelector('.uso60-dossier360'))return;
    const rut=core.state?.dossier?.rut;if(!rut)return;
    const block=document.createElement('section');block.className='uso60-dossier360';
    block.innerHTML='<div class="so-loading">Integrando lentes de supervisión Atlas 360°…</div>';host.appendChild(block);
    try{
      const [r,timeline]=await Promise.all([load360(rut),loadTimeline(rut)]);
      if(!r){block.innerHTML='<div class="uso60-card">La capa 360° aún no tiene una fila para este RUT.</div>';return;}
      block.innerHTML=`
        <section class="uso60-lens"><h3>Fuentes de datos · expediente 360°</h3><p>Cada estado describe cobertura observable. “Sin snapshot común” no significa que la información no exista en Atlas.</p>${sourceGrid(r)}</section>
        <div class="uso60-dual">
          <section class="uso60-lens"><h3>Actividad con el Estado</h3><p>Contexto agregado de Mercado Público, Lobby y CGR enlazado por RUT.</p><div class="uso60-facts">${fact('Evidencias',fmt(r.public_spend_evidence_count))}${fact('Compras',fmt(r.public_spend_purchase_count))}${fact('Lobby',fmt(r.public_spend_lobby_count))}${fact('CGR',fmt(r.public_spend_cgr_count))}${fact('Mayor monto observado',money(r.public_spend_max_amount_clp))}${fact('Confianza de enlace',r.public_spend_match_confidence===null?'—':fmt(Number(r.public_spend_match_confidence)*100,0)+'%')}</div></section>
          <section class="uso60-lens"><h3>Sociedad y relaciones</h3><p>RES y grafo societario. Son relaciones registrales observadas, no inferencias de conducta.</p><div class="uso60-facts">${fact('Constitución',day(r.res_constitution_date))}${fact('Capital',money(r.res_capital))}${fact('Relaciones',fmt(r.res_relationship_count))}${fact('Socios',fmt(r.res_partner_count))}${fact('Administradores',fmt(r.res_admin_count))}${fact('Eventos societarios',fmt(r.res_timeline_event_count))}</div></section>
        </div>
        ${r.osfl_observed?`<section class="uso60-lens"><h3>Lente OSFL</h3><p>Se activa sólo cuando el monitor OSFL observa esta entidad.</p><div class="uso60-facts">${fact('Fuentes OSFL',fmt(r.osfl_source_count))}${fact('Cobertura',r.osfl_coverage_index_pct===null?'—':fmt(r.osfl_coverage_index_pct,0)+'%')}${fact('Candidata R.8',r.osfl_fatf_r8_candidate?'Sí':'No')}${fact('Ley 21.440',r.osfl_law21440_active?'Activa':'No observada')}</div></section>`:''}
        <section class="uso60-lens"><h3>Línea de tiempo societaria</h3><p>Eventos RES ordenados por fecha. El objetivo es leer cambios, no inferir incumplimiento.</p>${timelineHtml(timeline)}</section>
        <details class="uso60-card uso60-method"><summary>Ayuda metodológica · cómo leer el expediente 360°</summary><p>Los bloques agregan contexto supervisor a la ficha UAF/SII. Mercado Público, prensa, OSFL y relaciones no aumentan por sí solos la probabilidad de LA/FT. Cada señal conserva su fuente y debe interpretarse dentro de su dominio. La ausencia de una fuente se muestra como brecha de cobertura y nunca como valor cero.</p></details>`;
    }catch(e){block.innerHTML=`<div class="uso60-card uso60-alert"><b>No fue posible cargar la capa 360°.</b><p>${esc(e?.message||String(e))}</p></div>`;}
  }

  async function loadManagement(){
    const client=db();if(!client)throw new Error('Sesión de datos no disponible');
    const {data,error}=await client.from(VIEW).select('rut,entity_name,uaf_sector,ivo_score,materiality_score,workflow_state,potential_evidence_class,sii_status,region').eq('universe_status','POTENCIAL').order('ivo_score',{ascending:false,nullsFirst:false});
    if(error)throw error;
    return data||[];
  }

  function flow(rows){
    const count=k=>rows.filter(r=>(r.workflow_state||'PENDIENTE')===k).length;
    const pending=rows.filter(r=>!r.workflow_state||r.workflow_state==='PENDIENTE').length;
    const steps=[['Pendientes',pending],['Revisados',count('REVISADO')],['Elegibles',count('ELEGIBLE')],['Seleccionados',count('SELECCIONADO_PARA_INSCRIPCION')],['Invitados',count('INVITADO')],['Seguimiento',count('EN_SEGUIMIENTO')],['Inscritos',count('INSCRITO')]];
    return `<div class="uso60-flow">${steps.map(([l,n])=>`<div class="uso60-flowstep"><b>${fmt(n)}</b><small>${esc(l)}</small></div>`).join('')}</div>`;
  }

  function managementRows(rows){
    if(!rows.length)return '<div class="so-empty">No hay potenciales en el corte.</div>';
    return `<div class="uso60-worklist">${rows.map(r=>`<div class="uso60-row" data-uso60-rut="${esc(r.rut)}"><div><strong>${esc(r.entity_name||r.rut)}</strong><small>${esc(r.rut)} · ${esc(r.uaf_sector||'sector no resuelto')} · ${esc(r.region||'sin territorio')}</small></div><div><b>${fmt(r.ivo_score,1)}</b><small>IVO</small></div><div><b>${fmt(r.materiality_score,1)}</b><small>MAT</small></div><div><span class="uso60-badge">${esc(STATES[r.workflow_state||'PENDIENTE']||r.workflow_state||'Pendiente')}</span><small>${esc(r.potential_evidence_class||'evidencia no declarada')}</small></div><div class="uso60-actions"><button data-uso60-action="ELEGIBLE">Elegible</button><button data-uso60-action="SELECCIONADO_PARA_INSCRIPCION">Seleccionar</button><button data-uso60-action="INVITADO">Invitado</button><button data-uso60-action="EN_SEGUIMIENTO">Seguimiento</button><button data-uso60-action="INSCRITO">Inscrito</button></div></div>`).join('')}</div>`;
  }

  function renderManagement(rows){
    const host=content();if(!host)return;
    const managed=rows.filter(r=>r.workflow_state&&r.workflow_state!=='PENDIENTE').length;
    const invited=rows.filter(r=>r.workflow_state==='INVITADO'||r.workflow_state==='EN_SEGUIMIENTO'||r.workflow_state==='INSCRITO').length;
    const converted=rows.filter(r=>r.workflow_state==='INSCRITO').length;
    host.innerHTML=`<section class="so-root uso60-management"><div class="so-modes"><button type="button" class="uso60-topbtn" data-uso60-back>← Potenciales SO</button><button class="on" type="button">Gestión de cobertura</button></div>
      <div class="uso60-command"><div class="k"><b>${fmt(rows.length)}</b><span>Potenciales del corte</span><small>universo histórico visible</small></div><div class="k"><b>${fmt(managed)}</b><span>Gestionados</span><small>con anotación vigente</small></div><div class="k"><b>${fmt(invited)}</b><span>Invitados / seguimiento</span><small>fuera de la cola pendiente</small></div><div class="k"><b>${fmt(converted)}</b><span>Inscritos</span><small>conversión registrada</small></div><div class="k"><b>${rows.length?fmt(managed*100/rows.length,1):'0'}%</b><span>Avance</span><small>revisión del universo potencial</small></div><div class="k"><b>${invited?fmt(converted*100/invited,1):'0'}%</b><span>Conversión</span><small>inscritos / invitados o seguimiento</small></div></div>
      <section class="uso60-card"><h2>Embudo de cobertura</h2><p>El universo no se elimina: cambia de estado. Los invitados e inscritos dejan de contaminar la cola pendiente, pero conservan toda su trazabilidad.</p>${flow(rows)}</section>
      <section class="uso60-card"><h2>Cola operacional</h2><p>IVO responde plausibilidad; MAT, materialidad. Son conceptos separados. Cada cambio se anexa con autor y fecha en la base.</p>${managementRows(rows)}</section>
      <details class="uso60-card uso60-method"><summary>Ayuda metodológica · gestión de potenciales</summary><p>Seleccionar, invitar o marcar seguimiento representa una gestión trazable del fiscalizador y no una decisión institucional ni una imputación de incumplimiento. La lista se construye desde conciliación y evidencia observable; la ausencia del corte UAF no prueba que una entidad no esté inscrita en el registro vivo.</p></details></section>`;
  }

  async function appendState(rut,next){
    const client=db();if(!client)throw new Error('Sesión de datos no disponible');
    const row=(state.management||[]).find(x=>x.rut===rut);if(!row)return;
    const payload={rut:row.rut,entity_id:null,review_state:next,reason_code:null,rationale:`Gestión Universo SO 0.60 · ${STATES[next]||next}`,ivo_at_decision:row.ivo_score??null,materiality_at_decision:row.materiality_score??null,sector_at_decision:row.uaf_sector||null,evidence_class_at_decision:row.potential_evidence_class||null,index_version:'IVO-1.0',release:'0.60.0',workflow_note:'Actualización desde Gestión de cobertura Universo SO'};
    const {error}=await client.from(REVIEW).insert(payload);if(error)throw error;
  }

  async function openManagement(){
    const host=content();if(!host)return;
    host.innerHTML='<section class="so-root"><div class="so-loading">Construyendo cola operacional de cobertura…</div></section>';
    try{state.management=await loadManagement();renderManagement(state.management);}catch(e){host.innerHTML=`<section class="so-root"><div class="so-error">${esc(e?.message||String(e))}</div></section>`;}
  }

  function enhance(){addModeButton();addIntegrityBanner();enhanceDossier();}
  const originalRender=core.render;
  core.render=function(){const out=originalRender.apply(core,arguments);window.setTimeout(enhance,0);return out;};

  document.addEventListener('click',async e=>{
    const coverage=e.target.closest?.('[data-atlas-coverage]');
    if(coverage){e.preventDefault();e.stopImmediatePropagation();openManagement();return;}
    const back=e.target.closest?.('[data-uso60-back]');
    if(back){core.state.mode='potenciales';core.render();return;}
    const action=e.target.closest?.('[data-uso60-action]');
    if(action){
      const row=action.closest('[data-uso60-rut]');if(!row)return;
      action.disabled=true;
      try{await appendState(row.dataset.uso60Rut,action.dataset.uso60Action);state.management=await loadManagement();renderManagement(state.management);}catch(err){action.disabled=false;window.alert('No fue posible registrar la gestión: '+(err?.message||String(err)));}
      return;
    }
    if(e.target.closest?.('[data-so-mode],[data-so-rut],#so-more,#so-clear,[data-so-toggle]'))window.setTimeout(enhance,30);
  },true);

  window.__ATLAS_UNIVERSO_SO_0600__={active:true,version:'0.60.0',openManagement,load360,enhance};
  window.setTimeout(enhance,0);
})();