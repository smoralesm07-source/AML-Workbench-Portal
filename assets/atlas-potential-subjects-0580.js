'use strict';

/* ATLAS AML · build 0580 · Potenciales sujetos obligados y su gestión
 *
 * Qué responde
 * ------------
 * La pregunta inversa a la del padrón: qué entidades conoce Atlas que se
 * comportan como sujetos obligados y no aparecen en el corte público del
 * registro UAF. Y, sobre esa lista, qué hace un fiscalizador con ellas.
 *
 * El guardarraíl que manda
 * ------------------------
 * El portal ya declara que "no observado en el corte público UAF ≠ no inscrito
 * ni no obligado". El padrón que tenemos es una publicación, no el registro vivo
 * de la UAF. Por eso nada de esta superficie afirma incumplimiento: afirma que
 * hay evidencia suficiente para mirar, y muestra de qué está hecha.
 *
 * Dos números, deliberadamente separados
 * --------------------------------------
 *   IVO  Verosimilitud de obligación    ¿debería estar inscrito?
 *   MAT  Materialidad de incorporación  si lo está, ¿cuánto pesa traerlo?
 * Mezclarlos en un solo puntaje los vuelve indistinguibles. El cuadrante que
 * los cruza es lo que ordena el trabajo de campo.
 *
 * Gestión
 * -------
 * Cada anotación es un anexo, nunca una edición: nadie sobrescribe la lectura
 * de otro y el estado vigente de una candidata es su última anotación. Así
 * Atlas recuerda qué potenciales ya fueron vistos y por quién. Un descarte
 * exige motivo, porque un juicio sin fundamento no es auditable.
 *
 * Seguridad: lectura y anexado bajo la sesión y RLS existentes. El usuario nunca
 * viaja en el payload: la base lo toma de auth.uid() y la política sólo acepta
 * anotaciones bajo la propia identidad. Sin MutationObserver, sin
 * almacenamiento en el navegador, gráficos en SVG sin estilos en línea.
 */
(function atlasPotentialSubjects0580(){
  const BUILD='0580';
  const CORE=window.__ATLAS_OBLIGATED__;
  if(!CORE||typeof CORE.esc!=='function'){
    window.__ATLAS_POTENTIAL__={active:false,reason:'core-0560-unavailable'};
    return;
  }
  const {esc,fmt,pct,day,num,clamp}=CORE;

  const VIEW_TABLE='aml_v_uaf_potential_current';
  const REVIEW_TABLE='aml_uaf_potential_review';
  const PAGE=40;

  const EVIDENCE={
    SANCION_UAF_SIN_INSCRIPCION:['Sancionada por la UAF sin figurar en el padrón','crit'],
    GIRO_PRINCIPAL_CARACTERISTICO:['Giro principal característico del sector','warn'],
    GIRO_SECUNDARIO_CARACTERISTICO:['Giro secundario característico','info']
  };
  const STATES={
    PENDIENTE:['Pendiente',''],
    REVISADO:['Revisado','info'],
    SELECCIONADO_PARA_INSCRIPCION:['Seleccionado para inscripción','ok'],
    DESCARTADO:['Descartado','']
  };
  const REASONS=[
    ['YA_INSCRITO_EN_REGISTRO_VIGENTE','Ya inscrito en el registro vigente'],
    ['NO_ES_SUJETO_OBLIGADO','No es sujeto obligado'],
    ['SIN_OPERACION_VIGENTE','Sin operación vigente'],
    ['FUERA_DE_COMPETENCIA','Fuera de competencia'],
    ['EVIDENCIA_INSUFICIENTE','Evidencia insuficiente'],
    ['OTRO','Otro motivo']
  ];
  const BANDS=[['MUY_ALTA','Muy alta'],['ALTA','Alta'],['MEDIA','Media'],['BAJA','Baja']];
  const BAND_LABEL=Object.fromEntries(BANDS);
  const SORTS=[
    ['ivo','Verosimilitud de obligación'],
    ['materialidad','Materialidad de incorporación'],
    ['name','Razón social (A–Z)']
  ];

  const state={
    rows:[], total:null, loadedAll:false, loading:false, error:null,
    notice:null, selection:new Set(), busy:new Set(), discarding:null,
    filters:{q:'',sector:'',evidence:'',band:'',review:'',region:'',actionable:true,sort:'ivo'}
  };

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const host=()=>document.querySelector('#so-potential');
  const overview=()=>CORE.state?.overview?.potential||null;

  /* ------------------------------------------------------------- consultas */
  function buildQuery(client,count){
    const f=state.filters;
    let q=client.from(VIEW_TABLE).select('*',count?{count:'estimated'}:undefined);
    const text=f.q.trim();
    if(text.length>=2){
      const safe=text.replace(/[%,()]/g,' ').trim();
      if(safe)q=q.or(`entity_name.ilike.%${safe}%,rut.ilike.%${safe}%`);
    }
    if(f.actionable)q=q.eq('is_actionable',true);
    if(f.sector)q=q.eq('implied_sector',f.sector);
    if(f.evidence)q=q.eq('evidence_class',f.evidence);
    if(f.band)q=q.eq('ivo_band',f.band);
    if(f.review)q=q.eq('review_state',f.review);
    if(f.region)q=f.region==='__none__'?q.is('region',null):q.eq('region',f.region);
    const order={ivo:'ivo_score',materialidad:'materiality_score',name:'entity_name'}[f.sort]||'ivo_score';
    q=q.order(order,{ascending:f.sort==='name',nullsFirst:false});
    if(f.sort==='ivo')q=q.order('materiality_score',{ascending:false,nullsFirst:false});
    return q;
  }

  async function loadPage(reset){
    const client=db();
    if(!client)throw new Error('La sesión de datos no está disponible.');
    if(reset){state.rows=[];state.total=null;state.loadedAll=false;state.selection.clear();}
    const from=state.rows.length;
    const {data,error,count}=await buildQuery(client,reset).range(from,from+PAGE-1);
    if(error)throw error;
    const rows=data||[];
    state.rows=state.rows.concat(rows);
    if(reset&&typeof count==='number')state.total=count;
    if(rows.length<PAGE)state.loadedAll=true;
  }

  /* Anexa la lectura del fiscalizador. El user_id no viaja: lo pone la base
     desde auth.uid() y la política sólo acepta la propia identidad. */
  async function appendReview(rows, reviewState, reasonCode, rationale){
    const client=db();
    if(!client)throw new Error('La sesión de datos no está disponible.');
    const payload=rows.map(r=>({
      rut:r.rut,
      entity_id:r.entity_id||null,
      review_state:reviewState,
      reason_code:reasonCode||null,
      rationale:rationale||null,
      ivo_at_decision:r.ivo_score??null,
      materiality_at_decision:r.materiality_score??null,
      sector_at_decision:r.implied_sector||null,
      evidence_class_at_decision:r.evidence_class||null,
      index_version:r.index_version||'IVO-1.0',
      release:document.documentElement.getAttribute('data-atlas-release')||null
    }));
    const {error}=await client.from(REVIEW_TABLE).insert(payload);
    if(error)throw error;
  }

  /* ------------------------------------------------- objetos gráficos ---- */
  function meter(value, cls){
    const n=num(value);
    const w=n===null?0:clamp(n,0,100);
    return `<svg class="pot-meter ${cls}" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label="${n===null?'sin dato':fmt(n,1)}">`
      +`<rect class="track" x="0" y="0" width="100" height="6" rx="3"></rect>`
      +(w>0?`<rect class="fill" x="0" y="0" width="${w.toFixed(2)}" height="6" rx="3"></rect>`:'')
      +`</svg>`;
  }

  function chip(text, tone){
    return `<span class="so-flag ${tone||''}">${esc(text)}</span>`;
  }

  function stateBadge(row){
    const meta=STATES[row.review_state]||[row.review_state,''];
    const who=row.reviewed_by_email?` · ${row.reviewed_by_email}`:'';
    const when=row.reviewed_at?` · ${day(row.reviewed_at)}`:'';
    return `<span class="pot-state s-${esc(row.review_state)}" title="${esc(meta[0]+who+when)}">${esc(meta[0])}</span>`;
  }

  /* Cuadrante de trabajo de campo. X = verosimilitud, Y = materialidad. El
     ángulo superior derecho reúne lo plausible y lo que además pesa. */
  function quadrant(){
    const rows=state.rows.filter(r=>num(r.ivo_score)!==null&&num(r.materiality_score)!==null);
    if(rows.length<3)return '<div class="so-empty">Se necesitan al menos tres candidatas cargadas para dibujar el cuadrante.</div>';
    const W=720,H=300,PAD={l:44,r:16,t:14,b:38};
    const pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b;
    const sx=v=>PAD.l+(clamp(v,0,100)/100)*pw;
    const sy=v=>PAD.t+ph-(clamp(v,0,100)/100)*ph;
    const medX=55, medY=40;
    const dots=rows.map(r=>{
      const on=state.selection.has(r.rut);
      const pending=r.review_state==='PENDIENTE';
      const tip=`${r.entity_name} · IVO ${fmt(r.ivo_score,1)} · materialidad ${fmt(r.materiality_score,1)} · ${(STATES[r.review_state]||[''])[0]}`;
      return `<circle class="dot${on?' on':''}${pending?'':' seen'}" cx="${sx(num(r.ivo_score)).toFixed(1)}" cy="${sy(num(r.materiality_score)).toFixed(1)}" r="${r.uaf_sanction_events>0?7:4.6}" data-pot-dot="${esc(r.rut)}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title></circle>`;
    }).join('');
    return `<svg class="so-plot pot-quadrant" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verosimilitud de obligación frente a materialidad de incorporación">
      <rect class="zone" x="${sx(medX).toFixed(1)}" y="${PAD.t}" width="${(PAD.l+pw-sx(medX)).toFixed(1)}" height="${(sy(medY)-PAD.t).toFixed(1)}" rx="8"></rect>
      <line class="guide" x1="${sx(medX).toFixed(1)}" y1="${PAD.t}" x2="${sx(medX).toFixed(1)}" y2="${PAD.t+ph}"></line>
      <line class="guide" x1="${PAD.l}" y1="${sy(medY).toFixed(1)}" x2="${PAD.l+pw}" y2="${sy(medY).toFixed(1)}"></line>
      <line class="axis" x1="${PAD.l}" y1="${PAD.t+ph}" x2="${PAD.l+pw}" y2="${PAD.t+ph}"></line>
      <line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t+ph}"></line>
      ${[0,25,50,75,100].map(v=>`<text class="tick" x="${sx(v).toFixed(1)}" y="${PAD.t+ph+15}" text-anchor="middle">${v}</text>`).join('')}
      ${[0,50,100].map(v=>`<text class="tick" x="${PAD.l-7}" y="${(sy(v)+3).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
      <text class="axis-label" x="${(PAD.l+pw/2).toFixed(1)}" y="${H-6}" text-anchor="middle">Verosimilitud de obligación (IVO)</text>
      <text class="axis-label" x="12" y="${(PAD.t+ph/2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 12 ${(PAD.t+ph/2).toFixed(1)})">Materialidad</text>
      <text class="quad-label" x="${(PAD.l+pw-8).toFixed(1)}" y="${PAD.t+13}" text-anchor="end">plausible y de peso</text>
      ${dots}
    </svg>
    <div class="so-legend">
      <span><i class="pot-dot-sample"></i>Candidata pendiente de revisión</span>
      <span><i class="pot-dot-sample seen"></i>Ya vista por un fiscalizador</span>
      <span>Punto grande = sancionada por la UAF sin figurar en el padrón</span>
    </div>`;
  }

  /* --------------------------------------------------------- superficies - */
  function progressStrip(){
    const o=overview();
    if(!o)return '';
    const t=o.triage||{}, u=o.universe||{}, e=o.evidence||{};
    const total=num(u.actionable)||0;
    const seen=(num(t.revisado)||0)+(num(t.seleccionado)||0)+(num(t.descartado)||0);
    const donePct=total?Math.round(seen*100/total):0;
    return `<div class="so-kpis">
      <div class="so-kpi"><b>${fmt(u.candidates)}</b><span>Potenciales detectados</span><small>${fmt(u.actionable)} incorporables hoy</small></div>
      <div class="so-kpi alert"><b>${fmt(e.SANCION_UAF_SIN_INSCRIPCION||0)}</b><span>Sancionadas sin figurar en el padrón</span><small>La evidencia más concluyente</small></div>
      <div class="so-kpi watch"><b>${fmt(t.seleccionado)}</b><span>Seleccionadas para inscripción</span><small>Decisión de fiscalizador, no institucional</small></div>
      <div class="so-kpi"><b>${fmt(seen)} / ${fmt(total)}</b><span>Ya vistas por un fiscalizador</span><small>${fmt(t.pendiente)} pendientes · ${fmt(t.revisores)} revisores</small></div>
      <div class="so-kpi"><b>${donePct}%</b><span>Avance de revisión</span>
        ${meter(donePct,'m-progress')}</div>
    </div>`;
  }

  function toolbar(){
    const f=state.filters;
    const o=overview();
    const sectors=(o?.sectors||[]).map(s=>s.sector).filter(Boolean);
    const regions=(o?.regions||[]).map(r=>r.region).filter(Boolean);
    const opt=(v,l,cur)=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(l)}</option>`;
    return `<section class="so-card">
      <div class="so-toolbar">
        <div class="so-field"><label for="pot-q">Razón social o RUT</label>
          <input id="pot-q" type="search" autocomplete="off" placeholder="Buscar entre las candidatas…" value="${esc(f.q)}"></div>
        <div class="so-field"><label for="pot-sector">Sector implicado</label>
          <select id="pot-sector">${opt('','Todos los sectores',f.sector)}${sectors.map(x=>opt(x,x,f.sector)).join('')}</select></div>
        <div class="so-field"><label for="pot-evidence">Clase de evidencia</label>
          <select id="pot-evidence">${opt('','Cualquiera',f.evidence)}${Object.entries(EVIDENCE).map(([k,v])=>opt(k,v[0],f.evidence)).join('')}</select></div>
        <div class="so-field"><label for="pot-band">Banda IVO</label>
          <select id="pot-band">${opt('','Todas',f.band)}${BANDS.map(([k,v])=>opt(k,v,f.band)).join('')}</select></div>
        <div class="so-field"><label for="pot-review">Estado de revisión</label>
          <select id="pot-review">${opt('','Cualquiera',f.review)}${Object.entries(STATES).map(([k,v])=>opt(k,v[0],f.review)).join('')}</select></div>
        <div class="so-field"><label for="pot-region">Territorio</label>
          <select id="pot-region">${opt('','Todo el país',f.region)}${regions.map(x=>opt(x==='Sin territorio observado'?'__none__':x,x,f.region)).join('')}</select></div>
        <div class="so-field"><label for="pot-sort">Ordenar por</label>
          <select id="pot-sort">${SORTS.map(([k,v])=>opt(k,v,f.sort)).join('')}</select></div>
        <button type="button" class="so-clear" id="pot-clear">Limpiar filtros</button>
      </div>
      <div class="so-toggles">
        <button type="button" id="pot-actionable" class="${f.actionable?'on':''}" aria-pressed="${f.actionable}">Sólo incorporables hoy</button>
      </div>
    </section>`;
  }

  function bulkBar(){
    const n=state.selection.size;
    if(!n)return '';
    const busy=state.busy.size>0;
    return `<div class="pot-bulk" role="region" aria-label="Acciones sobre la selección">
      <b>${fmt(n)} ${n===1?'candidata seleccionada':'candidatas seleccionadas'}</b>
      <button type="button" data-pot-bulk="SELECCIONADO_PARA_INSCRIPCION" ${busy?'disabled':''}>Seleccionar para inscripción</button>
      <button type="button" data-pot-bulk="REVISADO" ${busy?'disabled':''}>Marcar revisadas</button>
      <button type="button" data-pot-bulk="DESCARTADO" ${busy?'disabled':''}>Descartar…</button>
      <button type="button" class="ghost" id="pot-clear-selection">Quitar selección</button>
    </div>`;
  }

  function discardForm(scope){
    return `<div class="pot-discard" role="group" aria-label="Motivo del descarte">
      <label for="pot-reason">Motivo</label>
      <select id="pot-reason">${REASONS.map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select>
      <label for="pot-rationale">Fundamento</label>
      <input id="pot-rationale" type="text" maxlength="400" placeholder="Por qué esta candidata no corresponde…">
      <button type="button" id="pot-discard-confirm">Descartar ${scope}</button>
      <button type="button" class="ghost" id="pot-discard-cancel">Cancelar</button>
      <small>Un descarte sin fundamento no es auditable, así que el fundamento es obligatorio.</small>
    </div>`;
  }

  function row(r){
    const selected=state.selection.has(r.rut);
    const busy=state.busy.has(r.rut);
    const ev=EVIDENCE[r.evidence_class]||[r.evidence_class,''];
    const conc=num(r.activity_concentration);
    const detail=[
      r.rut,
      r.implied_sector||'Sector no resuelto',
      r.region||'Sin territorio observado',
      r.sii_sales_band?`Tramo ${r.sii_sales_band}`:'Escala no observada'
    ].join(' · ');
    return `<div class="pot-row${selected?' selected':''}${busy?' busy':''}" data-pot-row="${esc(r.rut)}">
      <label class="pot-pick"><input type="checkbox" data-pot-check="${esc(r.rut)}" ${selected?'checked':''} aria-label="Seleccionar ${esc(r.entity_name||r.rut)}"></label>
      <span class="pot-who">
        <strong>${esc(r.entity_name||r.rut)}</strong>
        <small>${esc(detail)}</small>
        <span class="so-flagset">
          ${chip(ev[0],ev[1])}
          ${conc!==null?chip(`${fmt(conc*100,0)}% de ese giro está inscrito`,''):''}
          ${r.uaf_sanction_events>0?chip(`${fmt(r.uaf_sanction_events)} evento UAF`,'crit'):''}
          ${r.is_actionable?'':chip('No incorporable hoy','')}
        </span>
      </span>
      <span class="pot-scores">
        <span class="pot-score"><em>IVO</em><b>${fmt(r.ivo_score,1)}</b>${meter(r.ivo_score,'m-ivo')}</span>
        <span class="pot-score"><em>Materialidad</em><b>${fmt(r.materiality_score,1)}</b>${meter(r.materiality_score,'m-mat')}</span>
      </span>
      <span class="pot-status">
        ${stateBadge(r)}
        ${r.review_state==='DESCARTADO'&&r.review_rationale?`<small title="${esc(r.review_rationale)}">${esc(r.review_rationale)}</small>`:''}
        ${r.reviewer_count>1?`<small>${fmt(r.reviewer_count)} revisores</small>`:''}
      </span>
      <span class="pot-actions">
        <button type="button" data-pot-act="SELECCIONADO_PARA_INSCRIPCION" data-pot-rut="${esc(r.rut)}" ${busy?'disabled':''} title="Ir a buscarla para inscribir">Inscribir</button>
        <button type="button" data-pot-act="REVISADO" data-pot-rut="${esc(r.rut)}" ${busy?'disabled':''} title="Dejar constancia de que ya fue vista">Revisada</button>
        <button type="button" data-pot-act="DESCARTADO" data-pot-rut="${esc(r.rut)}" ${busy?'disabled':''} title="No corresponde">Descartar</button>
      </span>
      ${state.discarding===r.rut?discardForm('esta candidata'):''}
    </div>`;
  }

  function listHtml(){
    if(state.loading&&!state.rows.length)return '<div class="so-loading">Consultando potenciales sujetos obligados…</div>';
    if(!state.rows.length)return '<div class="so-empty">Ninguna candidata cumple estos filtros en el corte vigente.</div>';
    const allVisible=state.rows.every(r=>state.selection.has(r.rut));
    return `<div class="pot-listhead">
        <label class="pot-pick"><input type="checkbox" id="pot-check-all" ${allVisible?'checked':''} aria-label="Seleccionar todas las visibles"></label>
        <span>${fmt(state.rows.length)} cargadas${state.loadedAll?'':` · estimación del conjunto: ${fmt(state.total)}`}</span>
      </div>
      <div class="pot-list">${state.rows.map(row).join('')}</div>`
      +(state.loadedAll?'':`<div class="so-more"><button type="button" id="pot-more">${state.loading?'Cargando…':`Cargar ${PAGE} más`}</button></div>`);
  }

  function readingRules(){
    return `<section class="so-rules">
      <h2>Qué afirma y qué no afirma esta lista</h2>
      <p>Estas entidades no están acusadas de nada. Atlas observa que se comportan como sujetos obligados y que no aparecen en el corte público del padrón UAF; decidir si corresponde incorporarlas es exactamente el trabajo que esta pantalla ordena, no uno que ya haya hecho.</p>
      <ul>
        <li><b>Ausencia del corte público ≠ no inscrito.</b> El padrón que Atlas lee es una publicación, no el registro vivo de la UAF.</li>
        <li><b>El giro característico describe al giro, no a la entidad.</b> La concentración dice qué proporción de quienes declaran ese giro sí están inscritos.</li>
        <li><b>Verosimilitud no es materialidad.</b> Se declaran por separado justamente para que no se confundan.</li>
        <li><b>Plausible no es incorporable.</b> Una entidad con término de giro publicado puede ser plausiblemente un sujeto obligado y aun así no ser candidata a inscripción.</li>
        <li><b>Un descarte queda registrado con su motivo</b>, y ninguna anotación borra la de otro fiscalizador: el historial es de sólo anexado.</li>
        <li><b>Seleccionar para inscripción no es una decisión institucional</b>, no es un requerimiento y no es un ROS. Es la lectura trazable de quien fiscaliza.</li>
      </ul>
    </section>`;
  }

  function html(){
    return `${state.notice?`<div class="pot-notice ${esc(state.notice.tone||'')}">${esc(state.notice.text)}</div>`:''}
      ${state.error?`<div class="so-error"><b>No fue posible completar la operación.</b><br>${esc(state.error)}</div>`:''}
      ${progressStrip()}
      <section class="so-card">
        <header><div><h2>Dónde poner el esfuerzo de incorporación</h2><p>Cada punto es una candidata. A la derecha, las más plausibles; arriba, las que más pesarían si se incorporan. Las líneas no son umbrales normativos: separan el cuadrante de trabajo del resto.</p></div><span class="so-hint">clic = seleccionar</span></header>
        ${quadrant()}
      </section>
      ${toolbar()}
      ${bulkBar()}
      ${state.discarding==='__bulk__'?discardForm(`${fmt(state.selection.size)} candidatas`):''}
      <section class="so-card">
        <header><div><h2>Gestión de potenciales</h2><p>Cada acción queda anexada con su autor y su momento. El estado vigente de una candidata es su última anotación, y Atlas recuerda lo ya visto entre sesiones y entre fiscalizadores.</p></div></header>
        <div id="pot-list">${listHtml()}</div>
      </section>
      ${readingRules()}`;
  }

  /* --------------------------------------------------------------- montaje */
  async function render(){
    const box=host();
    if(!box)return;
    if(!state.rows.length&&!state.loadedAll&&!state.loading){
      state.loading=true;
      box.innerHTML=html();
      try{await loadPage(true);state.error=null;}
      catch(error){state.error=error?.message||String(error);}
      state.loading=false;
    }
    box.innerHTML=html();
    wire();
  }

  function repaint(){
    const box=host();
    if(!box)return;
    box.innerHTML=html();
    wire();
  }

  function wire(){
    const bind=(id,key)=>{
      const el=document.querySelector(id);
      if(!el)return;
      el.addEventListener('change',()=>{state.filters[key]=el.value;reload();});
    };
    bind('#pot-sector','sector');bind('#pot-evidence','evidence');bind('#pot-band','band');
    bind('#pot-review','review');bind('#pot-region','region');bind('#pot-sort','sort');

    let timer=null;
    const q=document.querySelector('#pot-q');
    if(q)q.addEventListener('input',()=>{
      window.clearTimeout(timer);
      timer=window.setTimeout(()=>{state.filters.q=q.value;reload();},280);
    });

    document.querySelector('#pot-actionable')?.addEventListener('click',()=>{
      state.filters.actionable=!state.filters.actionable;reload();
    });
    document.querySelector('#pot-clear')?.addEventListener('click',()=>{
      state.filters={q:'',sector:'',evidence:'',band:'',review:'',region:'',actionable:true,sort:'ivo'};
      reload();
    });
    document.querySelector('#pot-more')?.addEventListener('click',async()=>{
      if(state.loading)return;
      state.loading=true;repaint();
      try{await loadPage(false);}catch(error){state.error=error?.message||String(error);}
      state.loading=false;repaint();
    });

    document.querySelectorAll('[data-pot-check]').forEach(el=>{
      el.addEventListener('change',()=>{
        const rut=el.dataset.potCheck;
        if(el.checked)state.selection.add(rut);else state.selection.delete(rut);
        repaint();
      });
    });
    document.querySelector('#pot-check-all')?.addEventListener('change',e=>{
      if(e.target.checked)state.rows.forEach(r=>state.selection.add(r.rut));
      else state.rows.forEach(r=>state.selection.delete(r.rut));
      repaint();
    });
    document.querySelector('#pot-clear-selection')?.addEventListener('click',()=>{
      state.selection.clear();repaint();
    });
    document.querySelectorAll('[data-pot-dot]').forEach(el=>{
      const toggle=()=>{
        const rut=el.dataset.potDot;
        if(state.selection.has(rut))state.selection.delete(rut);else state.selection.add(rut);
        repaint();
      };
      el.addEventListener('click',toggle);
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
    });

    document.querySelectorAll('[data-pot-act]').forEach(el=>{
      el.addEventListener('click',()=>{
        const rut=el.dataset.potRut, act=el.dataset.potAct;
        if(act==='DESCARTADO'){state.discarding=rut;repaint();return;}
        commit([rut],act);
      });
    });
    document.querySelectorAll('[data-pot-bulk]').forEach(el=>{
      el.addEventListener('click',()=>{
        const act=el.dataset.potBulk;
        if(!state.selection.size)return;
        if(act==='DESCARTADO'){state.discarding='__bulk__';repaint();return;}
        commit([...state.selection],act);
      });
    });
    document.querySelector('#pot-discard-cancel')?.addEventListener('click',()=>{
      state.discarding=null;repaint();
    });
    document.querySelector('#pot-discard-confirm')?.addEventListener('click',()=>{
      const reason=document.querySelector('#pot-reason')?.value;
      const rationale=(document.querySelector('#pot-rationale')?.value||'').trim();
      if(rationale.length<3){
        state.notice={text:'El fundamento del descarte es obligatorio: sin él la anotación no queda auditable.',tone:'warn'};
        repaint();return;
      }
      const targets=state.discarding==='__bulk__'?[...state.selection]:[state.discarding];
      state.discarding=null;
      commit(targets,'DESCARTADO',reason,rationale);
    });
  }

  async function reload(){
    state.loading=true;repaint();
    try{await loadPage(true);state.error=null;}
    catch(error){state.error=error?.message||String(error);}
    state.loading=false;repaint();
  }

  async function commit(ruts, reviewState, reasonCode, rationale){
    const targets=state.rows.filter(r=>ruts.includes(r.rut));
    if(!targets.length)return;
    targets.forEach(r=>state.busy.add(r.rut));
    state.notice=null;state.error=null;
    repaint();
    try{
      await appendReview(targets, reviewState, reasonCode, rationale);
      /* La lectura vuelve a la base en vez de asumirse: el estado vigente lo
         decide la última anotación, y puede haberla puesto otro fiscalizador. */
      const client=db();
      const {data,error}=await client.from(VIEW_TABLE).select('*').in('rut',targets.map(r=>r.rut));
      if(!error&&data){
        const byRut=new Map(data.map(d=>[d.rut,d]));
        state.rows=state.rows.map(r=>byRut.get(r.rut)||r);
      }
      state.selection.clear();
      const label=(STATES[reviewState]||[reviewState])[0].toLowerCase();
      state.notice={text:`${targets.length} ${targets.length===1?'candidata quedó':'candidatas quedaron'} en «${label}». La anotación es de sólo anexado y queda con tu identidad y su momento.`,tone:'ok'};
      audit('REVIEW_POTENTIAL_SUBJECT',{objectType:'uaf_potential_subject',objectId:targets.map(r=>r.rut).join(','),
        payload:{state:reviewState,reason:reasonCode||null,count:targets.length}});
    }catch(error){
      state.error=error?.message||String(error);
    }finally{
      targets.forEach(r=>state.busy.delete(r.rut));
      repaint();
    }
  }

  function audit(action,detail){
    try{if(typeof window.audit==='function')Promise.resolve(window.audit(action,detail)).catch(()=>{});}
    catch(_e){/* la auditoría nunca puede romper la gestión */}
  }

  window.__ATLAS_OBLIGATED__=Object.assign(window.__ATLAS_OBLIGATED__||{},{potential:{render,reload,state}});
  window.__ATLAS_POTENTIAL__={active:true,build:BUILD,installedAt:new Date().toISOString()};
})();
