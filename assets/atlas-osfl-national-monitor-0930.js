'use strict';

/* ATLAS OSFL National Monitor 0.93.0
 * National legal universe -> Atlas observability -> Law 19.913 bridge.
 * Semantics: legal status, FATF R.8 context and Law 19.913 proximity are not adverse findings by themselves.
 */
(function atlasOsflNationalMonitor0930(){
  if(window.__ATLAS_OSFL_NATIONAL_MONITOR_0930__) return;
  window.__ATLAS_OSFL_NATIONAL_MONITOR_0930__=true;

  const BUILD='0930';
  const SUMMARY_VIEW='aml_v_osfl_national_monitor_current';
  const BRIDGE_VIEW='aml_v_osfl_law19913_bridge_current';
  const nf=new Intl.NumberFormat('es-CL');
  let activeBridge='POTENTIAL_SUBJECT';

  function n(v){const x=Number(v);return Number.isFinite(x)?x:0;}
  function fmt(v){const x=Number(v);return Number.isFinite(x)?nf.format(x):'—';}
  function pct(v,d=1){const x=Number(v);return Number.isFinite(x)?`${x.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';}
  function e(v){return String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
  function dateCL(v){if(!v)return '—';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('es-CL');}

  function stage(label,value,detail,kind){
    return `<div class="osfln-stage ${kind||''}"><span>${e(label)}</span><b>${fmt(value)}</b><small>${e(detail)}</small></div>`;
  }

  function shell(){
    return `<section class="atlas-osfl-national" data-osfln-root data-osfln-build="${BUILD}">
      <header class="osfln-head">
        <div class="osfln-head-copy">
          <div class="osfln-kicker">MONITOR NACIONAL OSFL · CHILE</div>
          <h2>Del universo jurídico al perímetro 19.913</h2>
          <p>Primero medimos cuántas OSFL existen y cuánto observa Atlas. Después distinguimos enriquecimiento, señales analíticas y relación registral o potencial con actividades sujetas a la Ley 19.913.</p>
        </div>
        <div class="osfln-source-state" data-osfln-state><b>Fuente nacional</b><span>Consultando estado del padrón…</span><small>Registro Civil · RNPJSFL</small></div>
      </header>

      <div class="osfln-funnel" data-osfln-funnel>
        ${stage('Universo jurídico','—','vigentes en Chile','legal')}
        ${stage('Observables Atlas','—','identidad tributaria / fuentes Atlas','observed')}
        ${stage('Enriquecidas','—','≥2 fuentes disponibles','enriched')}
        ${stage('Puente 19.913','—','SO directo + potencial SO','bridge')}
        ${stage('SO UAF directos','—','coincidencia registral exacta','direct')}
      </div>

      <div class="osfln-grid">
        <article class="osfln-card osfln-coverage" data-osfln-coverage>
          <div class="osfln-card-head"><span>COBERTURA NACIONAL</span><h3>¿Cuánto del universo legal vemos?</h3></div>
          <div class="osfln-loading">Calculando cobertura…</div>
        </article>

        <article class="osfln-card osfln-bridge-card" data-osfln-bridge>
          <div class="osfln-card-head"><span>PUENTE LEY 19.913</span><h3>De contexto a aplicabilidad</h3></div>
          <div class="osfln-loading">Clasificando relación…</div>
        </article>

        <article class="osfln-card osfln-queue-card">
          <div class="osfln-card-head"><span>EXPLORACIÓN DIRIGIDA</span><h3>Subconjuntos para revisar</h3></div>
          <div class="osfln-filterbar" role="tablist" aria-label="Subconjunto OSFL">
            <button type="button" data-osfln-filter="POTENTIAL_SUBJECT" class="active">Potencial SO</button>
            <button type="button" data-osfln-filter="DIRECT_OBLIGATED">SO directo</button>
            <button type="button" data-osfln-filter="AML_ANALYTIC_SIGNAL">Señal AML</button>
            <button type="button" data-osfln-filter="FATF_R8_CONTEXT">R.8</button>
          </div>
          <div class="osfln-queue" data-osfln-queue><div class="osfln-loading">Preparando entidades…</div></div>
        </article>
      </div>

      <footer class="osfln-method">
        <div><b>Regla de interpretación</b><span>“Puente 19.913” describe relación con universos regulatorios o analíticos. No equivale a riesgo, sospecha, incumplimiento ni actividad ilícita.</span></div>
        <div><b>Vacío de información ≠ bajo riesgo</b><span>La cobertura se muestra separada de la prioridad para que una OSFL poco observable no sea clasificada artificialmente como de bajo interés.</span></div>
      </footer>
    </section>`;
  }

  function relabelLegacyHero(){
    const hero=document.querySelector('.atlas-osfl-hero');
    if(!hero)return;
    const first=hero.querySelector('.atlas-osfl-hero-metrics > div:first-child');
    if(first){
      const label=first.querySelector('span');
      const small=first.querySelector('small');
      if(label)label.textContent='OSFL observables Atlas';
      if(small)small.textContent='subconjunto con huella Atlas';
    }
    const kicker=hero.querySelector('.v030-kicker');
    if(kicker)kicker.textContent='OSFL · INTELIGENCIA SOBRE UNIVERSO OBSERVABLE';
  }

  function install(){
    const hero=document.querySelector('.v030-hero');
    if(!hero)return false;
    relabelLegacyHero();
    if(!document.querySelector('[data-osfln-root]')) hero.insertAdjacentHTML('afterend',shell());
    bindFilters();
    return true;
  }

  async function summary(){
    const {data,error}=await sb.from(SUMMARY_VIEW).select('*').limit(1);
    if(error)throw error;
    if(!data?.length)throw new Error('El monitor nacional no devolvió un corte vigente.');
    return data[0];
  }

  function renderSummary(s){
    const legal=n(s.legal_universe_count);
    const observed=n(s.atlas_observed);
    const enriched=n(s.enriched_2plus);
    const bridge=n(s.law19913_bridge_total);
    const direct=n(s.direct_obligated);
    const funnel=document.querySelector('[data-osfln-funnel]');
    if(funnel)funnel.innerHTML=[
      stage('Universo jurídico',legal,`vigentes · corte ${dateCL(s.legal_snapshot_date)}`,'legal'),
      stage('Observables Atlas',observed,`${pct(s.atlas_legal_coverage_pct)} del universo legal`,'observed'),
      stage('Enriquecidas',enriched,`${pct(s.enriched_pct_observed)} de las observables`,'enriched'),
      stage('Puente 19.913',bridge,`${pct(s.law19913_bridge_pct_observed)} de las observables`,'bridge'),
      stage('SO UAF directos',direct,'identidad exacta en registro UAF','direct')
    ].join('');

    const state=document.querySelector('[data-osfln-state]');
    if(state){
      const complete=String(s.ingestion_status)==='COMPLETE';
      state.classList.toggle('complete',complete);
      state.innerHTML=`<b>${complete?'Padrón nacional cargado':'Referencia oficial'}</b><span>${complete?`${fmt(s.loaded_active)} registros vigentes en maestro Atlas`:'Padrón fila a fila pendiente de ingestión'}</span><small>Registro Civil · corte ${e(dateCL(s.legal_snapshot_date))}</small>`;
    }

    const cov=document.querySelector('[data-osfln-coverage]');
    if(cov)cov.innerHTML=`
      <div class="osfln-card-head"><span>COBERTURA NACIONAL</span><h3>¿Cuánto del universo legal vemos?</h3></div>
      <div class="osfln-big"><b>${pct(s.atlas_legal_coverage_pct,2)}</b><span>${fmt(observed)} de ${fmt(legal)} OSFL</span></div>
      <progress max="${Math.max(1,legal)}" value="${Math.min(observed,legal)}"></progress>
      <div class="osfln-coverage-meta">
        <div><b>${fmt(n(s.evidence_coverage_70plus))}</b><span>con cobertura de evidencia ≥70%</span></div>
        <div><b>${fmt(Math.max(0,legal-observed))}</b><span>brecha jurídica aún no observable</span></div>
      </div>
      <p>${String(s.ingestion_status)==='COMPLETE'?'Cobertura calculada contra el padrón nacional cargado.':'La cifra nacional proviene de referencia oficial; Atlas distingue explícitamente este total de los registros fila a fila aún no incorporados.'}</p>`;

    const max=Math.max(1,n(s.general_osfl),n(s.fatf_r8_context),n(s.potential_subject),n(s.aml_analytic_signal),direct);
    const bridgeEl=document.querySelector('[data-osfln-bridge]');
    if(bridgeEl)bridgeEl.innerHTML=`
      <div class="osfln-card-head"><span>PUENTE LEY 19.913</span><h3>De contexto a aplicabilidad</h3></div>
      ${bridgeRow('SO UAF registrado',direct,max,'Coincidencia exacta; condición registral, no riesgo.','direct')}
      ${bridgeRow('Potencial sujeto 19.913',n(s.potential_subject),max,'Actividad/evidencia compatible; requiere revisión.','potential')}
      ${bridgeRow('Señal analítica AML',n(s.aml_analytic_signal),max,'Señal Atlas sin condición regulatoria inferida.','signal')}
      ${bridgeRow('Contexto FATF R.8',n(s.fatf_r8_context),max,'Cribado funcional; no puntúa por sí solo.','r8')}
      ${bridgeRow('OSFL general',n(s.general_osfl),max,'Sin relación directa observada en fuentes actuales.','general')}`;
  }

  function bridgeRow(label,value,max,note,kind){
    return `<div class="osfln-bridge-row ${kind}"><div><b>${e(label)}</b><span>${e(note)}</span></div><strong>${fmt(value)}</strong><progress max="${max}" value="${value}"></progress></div>`;
  }

  async function loadQueue(kind){
    activeBridge=kind;
    const fields='entity_id,rut,name,region,commune,activity_group,bridge_class,bridge_label,bridge_semantics,direct_uaf_sector,potential_uaf_sector,potential_evidence_class,potential_detection_tier,potential_is_actionable,potential_ivo_score,potential_materiality_score,ipa3_score,priority_band_shadow,coverage_index_pct';
    let q=sb.from(BRIDGE_VIEW).select(fields).eq('bridge_class',kind);
    if(kind==='POTENTIAL_SUBJECT') q=q.order('potential_is_actionable',{ascending:false,nullsFirst:false}).order('potential_ivo_score',{ascending:false,nullsFirst:false}).order('potential_materiality_score',{ascending:false,nullsFirst:false});
    else if(kind==='AML_ANALYTIC_SIGNAL') q=q.order('ipa3_score',{ascending:false,nullsFirst:false});
    else q=q.order('coverage_index_pct',{ascending:false,nullsFirst:false});
    const {data,error}=await q.limit(7);
    if(error)throw error;
    return data||[];
  }

  function queueMeta(r){
    if(r.bridge_class==='DIRECT_OBLIGATED')return [r.direct_uaf_sector||'Sector UAF no informado','SO registrado'];
    if(r.bridge_class==='POTENTIAL_SUBJECT')return [r.potential_uaf_sector||'Sector potencial no informado',r.potential_is_actionable?'Accionable en Universo SO':'Requiere corroboración'];
    if(r.bridge_class==='AML_ANALYTIC_SIGNAL')return [`IPA ${n(r.ipa3_score).toLocaleString('es-CL',{maximumFractionDigits:1})}`,r.priority_band_shadow||'señal activa'];
    if(r.bridge_class==='FATF_R8_CONTEXT')return ['FATF R.8','contexto funcional'];
    return ['OSFL general','contexto'];
  }

  function renderQueue(rows){
    const root=document.querySelector('[data-osfln-queue]');if(!root)return;
    if(!rows.length){root.innerHTML='<div class="osfln-empty">No hay entidades en este subconjunto para el corte actual.</div>';return;}
    root.innerHTML=rows.map((r,i)=>{
      const meta=queueMeta(r);
      return `<button type="button" class="osfln-row" data-osfln-entity="${e(r.entity_id)}">
        <em>${String(i+1).padStart(2,'0')}</em>
        <span class="osfln-row-main"><b>${e(r.name||'Entidad')}</b><small>${e(r.rut||'RUT no informado')} · ${e(r.region||'región no informada')}</small><i>${e(meta[0])}</i></span>
        <span class="osfln-row-tag"><b>${e(meta[1])}</b><small>cobertura ${pct(r.coverage_index_pct,0)}</small></span>
      </button>`;
    }).join('');
    root.querySelectorAll('[data-osfln-entity]').forEach(btn=>btn.addEventListener('click',()=>{
      if(typeof v030OpenEntity==='function') void v030OpenEntity(btn.dataset.osflnEntity);
    }));
  }

  async function hydrateQueue(kind){
    const root=document.querySelector('[data-osfln-queue]');
    if(root)root.innerHTML='<div class="osfln-loading">Consultando subconjunto…</div>';
    try{renderQueue(await loadQueue(kind));}
    catch(err){if(root)root.innerHTML=`<div class="osfln-error"><b>No fue posible cargar este subconjunto</b><span>${e(err?.message||String(err))}</span></div>`;}
  }

  function bindFilters(){
    document.querySelectorAll('[data-osfln-filter]').forEach(btn=>{
      if(btn.dataset.osflnBound)return;
      btn.dataset.osflnBound='1';
      btn.addEventListener('click',()=>{
        document.querySelectorAll('[data-osfln-filter]').forEach(x=>x.classList.toggle('active',x===btn));
        void hydrateQueue(btn.dataset.osflnFilter);
      });
    });
  }

  async function hydrate(){
    if(!document.querySelector('[data-osfln-root]'))return;
    try{renderSummary(await summary());}
    catch(err){
      const cov=document.querySelector('[data-osfln-coverage]');
      if(cov)cov.innerHTML=`<div class="osfln-card-head"><span>COBERTURA NACIONAL</span><h3>Monitor no disponible</h3></div><div class="osfln-error"><span>${e(err?.message||String(err))}</span></div>`;
    }
    await hydrateQueue(activeBridge);
  }

  function bootCurrent(){if(install())void hydrate();}

  if(typeof v030LoadOsfl==='function'&&!v030LoadOsfl.__osflNational0930){
    const base=v030LoadOsfl;
    const wrapped=async function(){
      const out=await base.apply(this,arguments);
      install();
      await hydrate();
      return out;
    };
    wrapped.__osflNational0930=true;
    v030LoadOsfl=wrapped;
  }

  setTimeout(bootCurrent,0);
  setTimeout(bootCurrent,800);
})();
