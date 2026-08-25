'use strict';
/* ATLAS AML · Universo SO · Workbench Analítico 0.70
 * Mejora de experiencia sobre la autoridad existente de Sujetos Obligados.
 * No modifica índices, fuentes ni estados operativos. Resume y conecta la
 * evidencia ya materializada, manteniendo acceso al panorama anterior.
 */
(function atlasUniversoSOWorkbench0700(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0700__={active:false,reason:'obligated-core-unavailable'};return;}

  const SUBJECTS='aml_uaf_obligated_subject_snapshot';
  const VIEW360='aml_v_uaf_supervision_360_current';
  const SCOPE='aml_uaf_potential_screening_scope_0650';
  const fmt=core.fmt, pct=core.pct, esc=core.esc, num=core.num;
  const state={selectedRut:null,selected:null,selected360:null,scope:null,loading:false};
  let queued=false,running=false;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const clean=s=>String(s??'').replaceAll('_',' ').toLowerCase();
  const money=v=>{const n=Number(v);return Number.isFinite(n)?'$'+Math.round(n).toLocaleString('es-CL'):'—';};
  const labelBand=b=>core.BAND_LABEL?.[b]||clean(b)||'—';
  const bandClass=b=>String(b||'').toLowerCase().replaceAll('_','-');

  const FLAG_RULES={
    TERMINO_GIRO_VIGENTE_EN_PADRON:{label:'Término de giro con inscripción vigente',family:'REG',level:'prio'},
    HISTORIAL_SANCIONATORIO_UAF:{label:'Historial sancionatorio UAF',family:'SUP',level:'prio'},
    REITERACION_5_ANIOS:{label:'Reiteración en 5 años',family:'SUP',level:'prio'},
    GIRO_ATIPICO_EN_SECTOR:{label:'Giro atípico entre pares sectoriales',family:'CAP',level:'attn'},
    ESTRUCTURA_SOCIETARIA_COMPLEJA:{label:'Estructura societaria compleja',family:'CAP',level:'attn'},
    SIN_PERFIL_SII_EN_PERSONA_JURIDICA:{label:'Persona jurídica sin perfil SII',family:'REG',level:'attn'},
    SIN_TERRITORIO_OBSERVADO:{label:'Territorio no observado',family:'OBS',level:'attn'},
    FUENTE_UNICA:{label:'Cobertura sustentada en una sola fuente',family:'OBS',level:'attn'},
    CAMBIO_DE_GIRO:{label:'Cambio de giro declarado',family:'REG',level:'ctx'},
    CAMBIO_DE_REGION:{label:'Cambio de región declarado',family:'REG',level:'ctx'},
    INSCRIPCION_RECIENTE:{label:'Inscripción reciente',family:'REG',level:'ctx'},
    SECTOR_ALTA_VULNERABILIDAD:{label:'Sector de alta vulnerabilidad',family:'CAP',level:'ctx'},
    PERSONA_NATURAL_OBLIGADA:{label:'Persona natural obligada',family:'REG',level:'ctx'}
  };

  function flagMeta(flag){return FLAG_RULES[flag]||{label:clean(flag),family:'OBS',level:'ctx'};}
  function flagsOf(row){return Array.isArray(row?.ipf_flags)?row.ipf_flags:(Array.isArray(row?.flags)?row.flags:[]);}
  function severeCount(row){return flagsOf(row).filter(f=>flagMeta(f).level==='prio').length;}
  function attentionCount(row){return flagsOf(row).filter(f=>flagMeta(f).level==='attn').length;}

  async function loadScope(){
    if(state.scope)return state.scope;
    const client=db();
    if(!client){state.scope={potential_count:79449,sii_cutoff:'2026-05'};return state.scope;}
    try{
      const {data,error}=await client.from(SCOPE).select('*').eq('snapshot_key','CURRENT').maybeSingle();
      if(error)throw error;
      state.scope=data||{potential_count:79449,sii_cutoff:'2026-05'};
    }catch(_e){state.scope={potential_count:79449,sii_cutoff:'2026-05'};}
    return state.scope;
  }

  async function loadSelected(rut){
    if(!rut)return;
    state.selectedRut=rut;state.loading=true;renderSelectionLoading();
    const client=db();
    if(!client){state.loading=false;return;}
    try{
      const [subject,wide]=await Promise.all([
        client.from(SUBJECTS).select('*').eq('rut',rut).maybeSingle(),
        client.from(VIEW360).select('*').eq('rut',rut).maybeSingle()
      ]);
      state.selected=subject.error?null:subject.data;
      state.selected360=wide.error?null:wide.data;
    }catch(_e){state.selected=null;state.selected360=null;}
    state.loading=false;renderSelection();highlightSelected();
  }

  function kpiHtml(){
    const ov=core.state?.overview||{},reg=ov.registry||{},sii=ov.sii||{},sup=ov.supervision||{},bands=ov.bands||{};
    const priority=(num(bands.MUY_ALTA)||0)+(num(bands.ALTA)||0);
    const coverage=num(sii.coverage_pct);
    const potential=Number(state.scope?.potential_count||79449);
    return `<div class="uso70-command">
      <article class="uso70-kpi"><span>SO inscritos · padrón vigente</span><b>${fmt(reg.subjects)}</b><small>${fmt(reg.sectors)} sectores materializados en el corte.</small></article>
      <article class="uso70-kpi potential"><span>Potenciales SO · screening</span><b>${fmt(potential)}</b><small>ACTECO relacionado + SII vigente + fuera del padrón UAF.</small></article>
      <article class="uso70-kpi priority"><span>IPF alto / muy alto</span><b>${fmt(priority)}</b><small>Ordenamiento del esfuerzo fiscalizador; no probabilidad de LA/FT.</small></article>
      <article class="uso70-kpi critical"><span>Término de giro publicado</span><b>${fmt(sii.terminated)}</b><small>Discrepancia registral observable con inscripción UAF vigente.</small></article>
      <article class="uso70-kpi coverage"><span>Cobertura tributaria</span><b>${coverage===null?'—':pct(coverage)}</b><small>Ausencia de fuente se trata como brecha, nunca como cero.</small></article>
    </div>`;
  }

  function watchRows(){
    return (core.state?.overview?.watchlist||[]).slice(0,12);
  }

  function worklistHtml(){
    const rows=watchRows();
    if(!rows.length)return '<div class="uso70-empty">Sin sujetos priorizados materializados en este corte.</div>';
    return `<table class="uso70-table"><thead><tr><th>RUT</th><th>Entidad</th><th>Sector UAF</th><th class="num">IPF</th><th>Señales</th></tr></thead><tbody>`+
      rows.map(r=>{
        const pr=severeCount(r),at=attentionCount(r),on=state.selectedRut===r.rut;
        return `<tr data-uso70-rut="${esc(r.rut)}" class="${on?'on':''}"><td class="rut">${esc(r.rut)}</td><td class="name" title="${esc(r.name)}">${esc(r.name)}</td><td title="${esc(r.sector||'Sector no resuelto')}">${esc(r.sector||'—')}</td><td class="num">${fmt(r.ipf,1)}</td><td><span class="uso70-mini-flags" title="${pr} prioritarias · ${at} de atención">${Array(Math.min(pr,4)).fill('<i class="uso70-dot prio"></i>').join('')}${Array(Math.min(at,3)).fill('<i class="uso70-dot attn"></i>').join('')}</span></td></tr>`;
      }).join('')+`</tbody></table>`;
  }

  function componentValue(row,field){const v=num(row?.[field]);return v===null?null:Math.max(0,Math.min(100,v));}
  function componentHtml(code,field,label,cls){
    const v=componentValue(state.selected,field);
    return `<div class="uso70-comp ${cls}"><code>${code}</code><div class="label"><span title="${esc(label)}">${esc(label)}</span><progress max="100" value="${v===null?0:v}"></progress></div><span class="value">${v===null?'—':fmt(v,0)} /100</span></div>`;
  }

  function scoreHtml(){
    const r=state.selected;
    if(!r)return '<div class="uso70-empty">Selecciona una entidad de la lista para descomponer su IPF y revisar su expediente sintetizado.</div>';
    const band=labelBand(r.ipf_band),cls=bandClass(r.ipf_band);
    return `<div class="uso70-scorecard"><div class="uso70-score-main"><span>IPF-1.0</span><b>${fmt(r.ipf_score,1)}</b><strong class="${cls}">${esc(band)}</strong><small>Percentil padrón ${fmt(r.ipf_percentile,1)} · sector ${fmt(r.ipf_sector_percentile,1)} · credibilidad ${fmt(r.ipf_credibility_pct,0)}%</small></div><div class="uso70-components">
      ${componentHtml('VSE','sector_vulnerability','Vulnerabilidad sectorial','vse')}
      ${componentHtml('HSU','ipf_supervision_history','Historial de supervisión UAF','hsu')}
      ${componentHtml('CRG','ipf_registry_coherence','Coherencia registral','crg')}
      ${componentHtml('EEC','ipf_scale_complexity','Escala y complejidad','eec')}
      ${componentHtml('OBS','ipf_observability_gap','Brecha de observabilidad','obs')}
    </div></div>`;
  }

  function concentrationHtml(){
    const rows=(core.state?.sectors||[]).filter(x=>num(x.subject_count)>0).slice().sort((a,b)=>(num(b.subject_count)||0)-(num(a.subject_count)||0)).slice(0,6);
    const total=rows.reduce((a,r)=>a+(num(r.subject_count)||0),0)||1;
    const max=Math.max(...rows.map(r=>num(r.subject_count)||0),1);
    return `<div class="uso70-bars">${rows.map(r=>{const n=num(r.subject_count)||0;return `<div class="uso70-bar"><span class="lab" title="${esc(r.uaf_sector_canonical)}">${esc(r.uaf_sector_canonical)}</span><span class="track"><i class="fill" data-width="${Math.round(100*n/max)}"></i></span><span class="val">${fmt(n)}</span></div>`;}).join('')}</div><div class="uso70-potential-rule"><b>Lectura:</b> el ancho representa tamaño del sector dentro de los sectores más numerosos; no constituye una señal de riesgo por sí mismo.</div>`;
  }

  function regionsHtml(){
    const rows=(core.state?.overview?.regions||[]).filter(r=>r.region!=='Sin territorio observado').slice(0,16);
    if(!rows.length)return '<div class="uso70-empty">Sin distribución territorial materializada.</div>';
    return `<div class="uso70-region-grid">${rows.map(r=>{const s=num(r.subjects)||0,p=num(r.priority)||0,share=s?p*100/s:0;return `<div class="uso70-region"><span>${esc(r.region)}</span><b>${fmt(s)}</b><small>${fmt(share,0)}% alta/muy alta</small></div>`;}).join('')}</div>`;
  }

  function taxonomyHtml(){
    const fams=[
      ['reg','Cumplimiento / Registro',[['prio','Prioritaria',['Término de giro con inscripción vigente']],['attn','Atención',['PJ sin perfil SII']],['ctx','Contexto',['Cambio de giro/región','Inscripción reciente']]]],
      ['sup','Supervisión UAF',[['prio','Prioritaria',['Historial sancionatorio','Reiteración 5 años']],['attn','Atención',['Hallazgos que requieren revisión']],['ctx','Contexto',['Historia supervisora sin efecto acusatorio']]]],
      ['cap','Capacidad – Estructura',[['prio','Prioritaria',['Convergencia de señales materiales']],['attn','Atención',['Giro atípico','Estructura societaria compleja']],['ctx','Contexto',['Vulnerabilidad sectorial']]]],
      ['obs','Observabilidad',[['prio','Prioritaria',['Brecha crítica de fuentes verificables']],['attn','Atención',['Fuente única','Territorio no observado']],['ctx','Contexto',['Cobertura disponible / parcial']]]]
    ];
    return `<div class="uso70-taxonomy">${fams.map(([cls,name,levels])=>`<div class="uso70-family ${cls}"><strong>${esc(name)}</strong>${levels.map(([lc,ll,items])=>`<div class="uso70-level ${lc}"><b>${ll}</b><ul>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`).join('')}</div>`;
  }

  function potentialHtml(){
    const s=state.scope||{},count=Number(s.potential_count||79449),cut=s.sii_cutoff||'último corte';
    return `<div class="uso70-potential-head"><div class="uso70-stage total"><span>Screening vigente</span><b>${fmt(count)}</b><small>Universo amplio de potenciales SO.</small></div><div class="uso70-stage"><span>Entrada</span><b>ACTECO</b><small>Actividad relacionada con categorías Ley 19.913.</small></div><div class="uso70-stage"><span>Condición</span><b>SII vigente</b><small>Corte ${esc(cut)}.</small></div><div class="uso70-stage"><span>Exclusión</span><b>Fuera UAF</b><small>RUT no observado en padrón materializado.</small></div></div>
      <div class="uso70-concepts"><div class="uso70-concept"><strong>IVO · plausibilidad operacional</strong><span>Sirve para ordenar revisión cuando exista evidencia individual suficiente. No define obligación jurídica.</span></div><div class="uso70-concept"><strong>Materialidad · relevancia potencial</strong><span>Dimensiona escala o impacto posible una vez que la candidata supera el tamiz de plausibilidad.</span></div></div>
      <div class="uso70-potential-rule"><b>Regla de verdad:</b> Atlas no reutiliza la antigua cola restrictiva de candidatos. Mientras la nómina individual completa no esté materializada, se muestra el universo de screening y sus criterios, sin inventar estados ni tasas de conversión.</div>`;
  }

  function fact(label,value,cls=''){return `<div class="uso70-fact"><span>${esc(label)}</span><b class="${cls}">${esc(value??'—')}</b></div>`;}
  function statusLabel(v){return core.SII_STATUS?.[v]||clean(v)||'—';}
  function dossierFlags(){
    const flags=flagsOf(state.selected);if(!flags.length)return '<span class="uso70-flag ctx">Sin marcas adicionales materializadas</span>';
    return flags.map(f=>{const m=flagMeta(f);return `<span class="uso70-flag ${m.level}" title="Familia ${esc(m.family)}">${esc(m.label)}</span>`;}).join('');
  }

  function dossierHtml(){
    const r=state.selected,w=state.selected360;
    if(!r)return '<div class="uso70-empty">Selecciona un sujeto obligado para caracterizar su situación registral, tributaria, supervisora y de observabilidad.</div>';
    const name=r.registry_name||r.entity_name||r.rut;
    const sii=statusLabel(r.sii_status),siiCls=r.sii_status==='TERMINATED_AS_PUBLISHED'?'alert':(r.sii_status==='ACTIVE_AS_PUBLISHED'?'ok':'warn');
    return `<div class="uso70-dossier"><div class="uso70-dossier-head"><div><h3 title="${esc(name)}">${esc(name)}</h3><p>${esc(r.rut)} · ${esc(r.uaf_sector_canonical||'Sector no resuelto')}</p></div><button class="uso70-btn primary" data-uso70-open-expediente>Expediente</button></div>
      <section class="uso70-factgroup"><h4>Situación registral y tributaria</h4><div class="uso70-facts">${fact('Naturaleza',r.subject_nature==='PERSONA_NATURAL'?'Persona natural':'Persona jurídica')}${fact('SII',sii,siiCls)}${fact('Región',r.region||'No observada')}${fact('Comuna',r.commune||'No observada')}${fact('Tramo ventas',r.sii_sales_band||'No observado')}${fact('Trabajadores',fmt(r.sii_workers))}</div></section>
      <section class="uso70-factgroup"><h4>Supervisión UAF</h4><div class="uso70-facts">${fact('IPF',fmt(r.ipf_score,1)+' · '+labelBand(r.ipf_band),r.ipf_band==='MUY_ALTA'?'alert':(r.ipf_band==='ALTA'?'warn':''))}${fact('Eventos atribuidos',fmt(r.sanction_event_count))}${fact('Eventos 5 años',fmt(r.sanction_event_count_5y))}${fact('Último evento',core.day(r.sanction_last_event_date))}${fact('Atipicidad actividad',num(r.activity_atypicality)===null?'—':fmt(num(r.activity_atypicality)*100,0)+'%')}${fact('Fuentes',fmt(r.source_count))}</div></section>
      <section class="uso70-factgroup"><h4>Contexto 360° enlazado</h4><div class="uso70-facts">${fact('Evidencias Estado',w?fmt(w.public_spend_evidence_count):'—')}${fact('Compras públicas',w?fmt(w.public_spend_purchase_count):'—')}${fact('Lobby',w?fmt(w.public_spend_lobby_count):'—')}${fact('CGR',w?fmt(w.public_spend_cgr_count):'—')}${fact('Mayor monto observado',w?money(w.public_spend_max_amount_clp):'—')}${fact('Relaciones societarias',w?fmt(w.res_relationship_count):'—')}</div></section>
      <section class="uso70-factgroup"><h4>Señales Atlas consolidadas</h4><div class="uso70-flags">${dossierFlags()}</div></section></div>`;
  }

  function methodologyHtml(){
    return `<div class="uso70-method">
      <article class="uso70-note"><strong>IPF ordena, no acusa</strong><p>Prioriza esfuerzo de fiscalización con evidencia disponible; no estima probabilidad de LA/FT ni responsabilidad.</p></article>
      <article class="uso70-note"><strong>Vulnerabilidad sectorial ≠ entidad</strong><p>VSE describe el entorno promedio del sector. No transmite conducta a un sujeto específico.</p></article>
      <article class="uso70-note"><strong>Marcas Atlas = evidencia agrupada</strong><p>Se reducen a cuatro familias y tres niveles. Una marca contextual aislada nunca prioriza por sí sola.</p></article>
      <article class="uso70-note"><strong>Ausencia de dato ≠ cero</strong><p>Una fuente no observada aumenta incertidumbre o reduce credibilidad; no se interpreta como ausencia del fenómeno.</p></article>
      <article class="uso70-note"><strong>Potencial SO = tamizaje</strong><p>ACTECO + vigencia SII + fuera del padrón UAF identifica candidatos para revisión, no una conclusión jurídica.</p></article>
    </div>`;
  }

  function renderWorkbench(){
    const root=document.querySelector('.so-root');if(!root||core.state?.mode!=='panorama'||root.querySelector('.uso70-workbench'))return;
    const modes=root.querySelector('.so-modes');if(!modes)return;
    const work=document.createElement('section');work.className='uso70-workbench';
    work.innerHTML=`${kpiHtml()}<div class="uso70-layout">
      <div class="uso70-col left"><section class="uso70-panel"><header><div><h2>SO inscritos · revisar primero</h2><p>Top materializado del padrón, ordenado por IPF. Seleccionar no abre expediente: actualiza el análisis central y el dossier lateral.</p></div><span class="uso70-meta">máx. 12</span></header><div class="uso70-actions"><button class="uso70-btn primary" data-uso70-mode-padron>Abrir padrón fiscalizable</button><button class="uso70-btn" data-uso70-help-taxonomy>Ver taxonomía</button></div><div class="uso70-body">${worklistHtml()}</div></section>
        <section class="uso70-panel" id="uso70-taxonomy-panel"><header><div><h2>Taxonomía de señales Atlas</h2><p>Menos marcas visibles, mayor trazabilidad: cuatro familias comunes y tres niveles de lectura.</p></div></header><div class="uso70-body">${taxonomyHtml()}</div></section></div>
      <div class="uso70-col middle"><section class="uso70-panel"><header><div><h2>Descomposición IPF · entidad seleccionada</h2><p>Cinco componentes originales del índice, sin crear un score paralelo.</p></div><span class="uso70-meta">IPF-1.0</span></header><div class="uso70-body" id="uso70-score">${scoreHtml()}</div></section>
        <div class="uso70-split"><section class="uso70-panel"><header><div><h3>Concentración del padrón por sector</h3><p>Tamaño relativo de los sectores más numerosos.</p></div></header><div class="uso70-body">${concentrationHtml()}</div></section><section class="uso70-panel"><header><div><h3>Distribución regional</h3><p>Inscritos y proporción en banda alta/muy alta.</p></div></header><div class="uso70-body">${regionsHtml()}</div></section></div>
        <section class="uso70-panel"><header><div><h2>Revisión operacional · Potenciales SO</h2><p>Se mantiene separado del padrón inscrito y se declara el límite de materialización actual.</p></div><span class="uso70-meta">screening</span></header><div class="uso70-body">${potentialHtml()}</div></section></div>
      <div class="uso70-col right"><section class="uso70-panel"><header><div><h2>Dossier · entidad seleccionada</h2><p>Lectura compacta registral, tributaria, supervisora y multifuente.</p></div></header><div id="uso70-dossier">${dossierHtml()}</div></section>
        <section class="uso70-panel"><header><div><h2>Metodología en contexto</h2><p>Reglas visibles exactamente donde se interpretan las señales.</p></div></header><div class="uso70-body"><div class="uso70-potential-rule"><b>Importante:</b> una sanción administrativa, una rareza sectorial, una brecha de fuente o un vínculo contextual no equivalen a LA/FT. Atlas prioriza revisión y conserva la evidencia de origen.</div></div></section></div>
    </div>${methodologyHtml()}</section>`;
    modes.insertAdjacentElement('afterend',work);

    const legacy=document.createElement('details');legacy.className='uso70-legacy';legacy.innerHTML='<summary>Análisis complementario del panorama anterior</summary><div class="uso70-legacy-content"></div>';
    const legacyBody=legacy.querySelector('.uso70-legacy-content');
    [...root.children].filter(n=>n!==work&&n!==modes&&!n.classList.contains('so-sourcebar')&&!n.classList.contains('uso70-legacy')).forEach(n=>legacyBody.appendChild(n));
    root.appendChild(legacy);
    applyBarWidths();wireWorkbench();
    if(!state.selectedRut){const first=watchRows()[0];if(first)void loadSelected(first.rut);}else renderSelection();
  }

  function applyBarWidths(){document.querySelectorAll('.uso70-bar .fill[data-width]').forEach(el=>{el.style.width=Math.max(0,Math.min(100,Number(el.dataset.width)||0))+'%';});}
  /* CSP de Atlas no permite style-src inline en producción. Si el navegador
     bloquea style.width, el layout conserva track y valores numéricos; la cifra
     sigue siendo la autoridad. */

  function renderSelectionLoading(){const a=document.querySelector('#uso70-score'),b=document.querySelector('#uso70-dossier');if(a)a.innerHTML='<div class="uso70-empty">Cargando componentes del índice…</div>';if(b)b.innerHTML='<div class="uso70-empty">Integrando expediente multifuente…</div>';highlightSelected();}
  function renderSelection(){const a=document.querySelector('#uso70-score'),b=document.querySelector('#uso70-dossier');if(a)a.innerHTML=scoreHtml();if(b)b.innerHTML=dossierHtml();wireDossier();}
  function highlightSelected(){document.querySelectorAll('[data-uso70-rut]').forEach(tr=>tr.classList.toggle('on',tr.dataset.uso70Rut===state.selectedRut));}
  function wireDossier(){document.querySelector('[data-uso70-open-expediente]')?.addEventListener('click',()=>{if(state.selectedRut)core.open?.(state.selectedRut);});}

  function wireWorkbench(){
    document.querySelectorAll('[data-uso70-rut]').forEach(tr=>tr.addEventListener('click',()=>void loadSelected(tr.dataset.uso70Rut)));
    document.querySelector('[data-uso70-mode-padron]')?.addEventListener('click',()=>document.querySelector('[data-so-mode="padron"]')?.click());
    document.querySelector('[data-uso70-help-taxonomy]')?.addEventListener('click',()=>document.querySelector('#uso70-taxonomy-panel')?.scrollIntoView({behavior:'smooth',block:'center'}));
    wireDossier();
  }

  async function patch(){
    if(running)return;running=true;
    try{
      if(core.state?.mode==='panorama'){
        await loadScope();renderWorkbench();
      }
    }finally{running=false;}
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;void patch();});}

  const obs=new MutationObserver(schedule);
  const start=()=>{const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});schedule();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.__ATLAS_UNIVERSO_SO_0700__={active:true,version:'0.70.0',taxonomy:'ATLAS_4F_3L',state,patch,loadSelected};
})();
