'use strict';

/* ATLAS OSFL Economic + Public Funds 0.95.0
 * Three national lenses: activities, public funds and economic/operational scale.
 * Methodological guardrails:
 * - Registro 19.862 membership != confirmed receipt of a public transfer.
 * - SII sales are ranges derived from tax declarations, not exact accounting revenue.
 * - workers + sales describe operational/economic scale, not accounting working capital and not AML risk.
 */
(function atlasOsflEconomic0950(){
  if(window.__ATLAS_OSFL_ECONOMIC_0950__) return;
  window.__ATLAS_OSFL_ECONOMIC_0950__=true;

  const BUILD='0950';
  const V={
    CONC:'aml_v_osfl_economic_concentration_current_v0950',
    ACT:'aml_v_osfl_activity_distribution_current_v0950',
    DIST:'aml_v_osfl_economic_distribution_current_v0950',
    FUNDS:'aml_v_osfl_public_funds_current_v0950',
    FUNDS_SUM:'aml_v_osfl_public_funds_summary_current_v0950',
    PROFILE:'aml_v_osfl_economic_profile_current_v0950'
  };
  const nf=new Intl.NumberFormat('es-CL');
  const clp=new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
  const state={lens:'activity',conc:null,activity:[],dist:[],funds:null,queue:[],recipients:[],loaded:false};
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const fmt=v=>{const x=Number(v);return Number.isFinite(x)?nf.format(Math.round(x)):'—';};
  const pct=(v,d=1)=>{const x=Number(v);return Number.isFinite(x)?`${x.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';};
  const money=v=>{const x=Number(v);return Number.isFinite(x)?clp.format(x):'—';};
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const client=()=>window.sb || (typeof sb!=='undefined'?sb:null);

  function shell(){
    return `<article class="osfl95-card" data-osfl95-root data-osfl95-build="${BUILD}">
      <header class="osfl95-head">
        <div class="osfl95-head-copy">
          <span>CARACTERIZACIÓN ECONÓMICA Y FONDOS PÚBLICOS · OSFL</span>
          <h3>Qué hacen, qué escala tienen y qué exposición pública podemos confirmar</h3>
          <p>Lectura nacional sobre las 36.843 OSFL observables de Atlas. Cada lente conserva su propio denominador y separa evidencia confirmada de contexto registral.</p>
        </div>
        <div class="osfl95-source-pill" data-osfl95-source><b>Transferencias públicas</b><span>Consultando estado de la evidencia fila a fila…</span></div>
      </header>
      <div class="osfl95-kpis" data-osfl95-kpis>${skeleton(5)}</div>
      <nav class="osfl95-tabs" role="tablist" aria-label="Lentes económicas OSFL">
        <button type="button" class="active" data-osfl95-tab="activity">Actividades y giros</button>
        <button type="button" data-osfl95-tab="funds">Fondos públicos</button>
        <button type="button" data-osfl95-tab="economic">Capacidad económica</button>
      </nav>
      <div class="osfl95-body">
        <section class="osfl95-lens active" data-osfl95-lens="activity"><div class="osfl95-loading">Construyendo estructura de actividades…</div></section>
        <section class="osfl95-lens" data-osfl95-lens="funds"><div class="osfl95-loading">Leyendo evidencia de fondos públicos…</div></section>
        <section class="osfl95-lens" data-osfl95-lens="economic"><div class="osfl95-loading">Midiendo escala económica y dotación…</div></section>
      </div>
      <footer class="osfl95-method">
        <div><b>Ventas SII</b><span>Son tramos estimados desde declaraciones tributarias. No representan ingreso contable exacto ni permiten sumar ventas entre entidades.</span></div>
        <div><b>Trabajadores</b><span>Dotación observada por SII. Se usa como dimensión de capacidad operativa, no como prueba de actividad real ni de incumplimiento.</span></div>
        <div><b>Fondos públicos</b><span>Registro 19.862 es contexto registral. “Transferencia confirmada” exige una fila de transferencia individualizada en la nueva tabla de evidencia.</span></div>
      </footer>
    </article>`;
  }

  function skeleton(k){return Array.from({length:k},()=>'<div class="osfl95-kpi"><span>Cargando</span><b>—</b><small>actualizando corte</small></div>').join('');}

  function install(){
    const host=document.querySelector('[data-osfln-root]');
    if(!host) return false;
    if(document.querySelector('[data-osfl95-root]')) return true;
    const anchor=host.querySelector('[data-osflg-root]') || host.querySelector('[data-osfln-funnel]') || host.firstElementChild;
    if(anchor) anchor.insertAdjacentHTML('afterend',shell());
    else host.insertAdjacentHTML('beforeend',shell());
    bind();
    void hydrate();
    return true;
  }

  function bind(){
    document.querySelectorAll('[data-osfl95-tab]').forEach(btn=>{
      if(btn.dataset.bound) return;
      btn.dataset.bound='1';
      btn.addEventListener('click',()=>setLens(btn.dataset.osfl95Tab));
    });
  }

  function setLens(lens){
    state.lens=lens;
    document.querySelectorAll('[data-osfl95-tab]').forEach(b=>b.classList.toggle('active',b.dataset.osfl95Tab===lens));
    document.querySelectorAll('[data-osfl95-lens]').forEach(p=>p.classList.toggle('active',p.dataset.osfl95Lens===lens));
  }

  async function one(view,fields='*'){
    const c=client(); if(!c) throw new Error('Cliente Supabase no disponible');
    const {data,error}=await c.from(view).select(fields).limit(1);
    if(error) throw error;
    return data?.[0]||null;
  }

  async function all(view,fields='*'){
    const c=client(); if(!c) throw new Error('Cliente Supabase no disponible');
    const {data,error}=await c.from(view).select(fields);
    if(error) throw error;
    return data||[];
  }

  async function reviewQueue(){
    const c=client(); if(!c) return [];
    const fields='entity_id,rut,name,region,activity_group,main_activity,sales_band_rank,sales_band_label,workers_numeric,operational_scale_band,registro19862_observed,confirmed_transfer_count,confirmed_transfer_amount_clp';
    const {data,error}=await c.from(V.PROFILE).select(fields).eq('low_staff_high_sales_context',true).order('sales_band_rank',{ascending:false,nullsFirst:false}).order('workers_numeric',{ascending:true,nullsFirst:false}).limit(8);
    if(error) throw error;
    return data||[];
  }

  async function transferRecipients(){
    const c=client(); if(!c) return [];
    const fields='entity_id,rut,name,region,activity_group,sii_size_class,workers_numeric,confirmed_transfer_count,public_funder_count,confirmed_transfer_amount_clp,last_transfer_date';
    const {data,error}=await c.from(V.FUNDS).select(fields).eq('transfer_received_confirmed',true).order('confirmed_transfer_amount_clp',{ascending:false,nullsFirst:false}).limit(8);
    if(error) throw error;
    return data||[];
  }

  async function hydrate(){
    const root=document.querySelector('[data-osfl95-root]');
    if(!root) return;
    try{
      const [conc,activity,dist,funds,queue,recipients]=await Promise.all([
        one(V.CONC),all(V.ACT),all(V.DIST),one(V.FUNDS_SUM),reviewQueue(),transferRecipients()
      ]);
      state.conc=conc;state.activity=activity;state.dist=dist;state.funds=funds;state.queue=queue;state.recipients=recipients;state.loaded=true;
      render();emitSignals();
    }catch(err){
      root.querySelectorAll('[data-osfl95-lens]').forEach(x=>x.innerHTML=`<div class="osfl95-error">No fue posible cargar la capa económica OSFL · ${esc(err?.message||String(err))}</div>`);
      root.dataset.status='error';
    }
  }

  function kpi(label,value,detail,kind=''){
    return `<div class="osfl95-kpi ${kind}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small></div>`;
  }

  function render(){
    renderTop();renderActivity();renderFunds();renderEconomic();bindRows();
    const root=document.querySelector('[data-osfl95-root]');if(root)root.dataset.status='ready';
  }

  function renderTop(){
    const c=state.conc||{},f=state.funds||{};
    const el=document.querySelector('[data-osfl95-kpis]');
    if(el)el.innerHTML=[
      kpi('OSFL observables',fmt(c.atlas_observed_osfl),'universo fila a fila Atlas'),
      kpi('Con dato SII',fmt(c.sii_economic_observed),`${pct(c.sii_economic_coverage_pct)} del universo`,'economic'),
      kpi('Registro 19.862',fmt(c.registro19862_observed),'contexto registral · no recepción','registry'),
      kpi('Transferencias confirmadas',fmt(f.confirmed_transfer_recipients),`${fmt(f.confirmed_transfer_events)} eventos fila a fila`,'transfer'),
      kpi('P90 trabajadores',fmt(c.workers_p90),`P99 ${Number(c.workers_p99||0).toLocaleString('es-CL',{maximumFractionDigits:1})}`,'workers')
    ].join('');
    const src=document.querySelector('[data-osfl95-source]');
    if(src){
      const ready=String(f.transfer_source_status||'').includes('COMPLETE');
      src.classList.toggle('ready',ready);
      src.innerHTML=`<b>${ready?'Transferencias cargadas':'Ingesta fila a fila pendiente'}</b><span>${ready?`${fmt(f.confirmed_transfer_recipients)} OSFL receptoras confirmadas`:'Registro 19.862 disponible como contexto; Atlas no infiere recepción sin transferencia individualizada.'}</span>`;
    }
  }

  function topRows(dimension,limit,exclude){
    return state.activity.filter(r=>r.activity_dimension===dimension && (!exclude||!exclude.has(r.activity_label))).sort((a,b)=>n(b.entity_count)-n(a.entity_count)).slice(0,limit);
  }

  function barRows(rows,mode){
    const max=Math.max(1,...rows.map(r=>n(r.entity_count)));
    return `<div class="osfl95-bars">${rows.map(r=>{
      const aux=mode==='osfl'?`${fmt(r.with_sii_economic_data)} con SII · ${fmt(r.registro19862_count)} en 19.862`:`${pct(r.share_dimension_pct)} del subconjunto SII · ${fmt(r.registro19862_count)} en 19.862`;
      return `<div class="osfl95-bar"><div class="osfl95-bar-main"><div><b title="${esc(r.activity_label)}">${esc(r.activity_label)}</b><small>${pct(r.share_dimension_pct)}</small></div><span class="osfl95-track"><i style="width:${Math.max(2,100*n(r.entity_count)/max)}%"></i></span></div><div class="osfl95-bar-meta"><b>${fmt(r.entity_count)}</b><small>${esc(aux)}</small></div></div>`;
    }).join('')}</div>`;
  }

  function renderActivity(){
    const el=document.querySelector('[data-osfl95-lens="activity"]');if(!el)return;
    const groups=topRows('OSFL_ACTIVITY_GROUP',9);
    const sii=topRows('SII_MAIN_ACTIVITY',10,new Set(['SIN ACTIVIDAD SII']));
    const noSii=state.activity.find(r=>r.activity_dimension==='SII_MAIN_ACTIVITY'&&r.activity_label==='SIN ACTIVIDAD SII');
    el.innerHTML=`<div class="osfl95-grid">
      <article class="osfl95-panel"><div class="osfl95-panel-title"><div><span>UNIVERSO TOTAL OBSERVABLE</span><h4>Principales tipos de actividad OSFL</h4></div><small>denominador: 36.843</small></div>${barRows(groups,'osfl')}</article>
      <article class="osfl95-panel"><div class="osfl95-panel-title"><div><span>SUBCONJUNTO ECONÓMICO SII</span><h4>Principales actividades económicas</h4></div><small>denominador: ${fmt(state.conc?.sii_economic_observed)}</small></div>${barRows(sii,'sii')}</article>
      <article class="osfl95-panel wide"><div class="osfl95-empty"><b>${fmt(noSii?.entity_count)} OSFL no tienen actividad económica SII materializada en este corte</b><span>Se mantienen dentro del universo OSFL y de los análisis registrales, pero quedan fuera de los porcentajes construidos sobre ventas y trabajadores. Ausencia de dato económico no equivale a inactividad.</span></div></article>
    </div>`;
  }

  function renderFunds(){
    const el=document.querySelector('[data-osfl95-lens="funds"]');if(!el)return;
    const f=state.funds||{},c=state.conc||{};
    const ready=n(f.confirmed_transfer_events)>0;
    const recipients=state.recipients;
    el.innerHTML=`<div class="osfl95-fund-status">
      <div class="osfl95-status-box ${ready?'ready':''}"><b>${ready?'Evidencia de transferencias disponible':'Fuente preparada · filas pendientes'}</b><span>${ready?'La cifra de receptoras usa transferencias individualizadas.':'Las 5.013 OSFL observadas en Registro 19.862 se muestran como registro/contexto, no como receptoras de fondos.'}</span><small>Contrato: Registro 19.862 ≠ transferencia recibida. La recepción requiere fecha, organismo emisor, receptor y registro individual.</small></div>
      <div class="osfl95-fund-metrics">
        <div class="osfl95-mini"><span>Registro 19.862</span><b>${fmt(c.registro19862_observed)}</b><small>${pct(100*n(c.registro19862_observed)/Math.max(1,n(c.atlas_observed_osfl)))} del universo observable</small></div>
        <div class="osfl95-mini"><span>Receptoras confirmadas</span><b>${fmt(f.confirmed_transfer_recipients)}</b><small>solo evidencia fila a fila</small></div>
        <div class="osfl95-mini"><span>Monto confirmado</span><b>${money(f.confirmed_transfer_amount_clp)}</b><small>${fmt(f.confirmed_transfer_events)} transferencias</small></div>
      </div>
    </div>
    <div class="osfl95-grid" style="margin-top:9px"><article class="osfl95-panel wide"><div class="osfl95-panel-title"><div><span>RECEPTORES</span><h4>OSFL con transferencias públicas confirmadas</h4></div><small>orden por monto observado</small></div>${recipients.length?recipientRows(recipients):'<div class="osfl95-empty"><b>No hay transferencias fila a fila cargadas aún</b><span>El módulo queda operativo y cambiará automáticamente cuando el pipeline 19.862 materialice transferencias. Hasta entonces no se presentará el registro de colaboradores como si fuera recepción de fondos.</span></div>'}</article></div>`;
  }

  function recipientRows(rows){
    return `<div class="osfl95-queue">${rows.map((r,i)=>`<button type="button" class="osfl95-row" data-osfl95-entity="${esc(r.entity_id)}"><em>${String(i+1).padStart(2,'0')}</em><span class="osfl95-row-main"><b>${esc(r.name||'Entidad')}</b><small>${esc(r.rut||'')} · ${esc(r.activity_group||'actividad no informada')}</small></span><span class="osfl95-row-stat"><b>${money(r.confirmed_transfer_amount_clp)}</b><small>${fmt(r.confirmed_transfer_count)} transferencias</small></span><span class="osfl95-row-stat"><b>${fmt(r.public_funder_count)}</b><small>aportantes</small></span></button>`).join('')}</div>`;
  }

  function distributionRows(dimension){return state.dist.filter(r=>r.distribution_dimension===dimension).sort((a,b)=>n(a.bucket_order)-n(b.bucket_order));}
  function distBars(rows){
    const max=Math.max(1,...rows.map(r=>n(r.entity_count)));
    return `<div class="osfl95-bars">${rows.map(r=>`<div class="osfl95-bar"><div class="osfl95-bar-main"><div><b>${esc(r.bucket_label)}</b><small>${pct(r.share_dimension_pct)}</small></div><span class="osfl95-track"><i style="width:${Math.max(2,100*n(r.entity_count)/max)}%"></i></span></div><div class="osfl95-bar-meta"><b>${fmt(r.entity_count)}</b><small>${fmt(r.registro19862_count)} en 19.862</small></div></div>`).join('')}</div>`;
  }

  function renderEconomic(){
    const el=document.querySelector('[data-osfl95-lens="economic"]');if(!el)return;
    const c=state.conc||{};
    const sales=distributionRows('SALES_BAND'),workers=distributionRows('WORKER_BAND');
    el.innerHTML=`<div class="osfl95-scale-grid">
      <div class="osfl95-scale"><span>Cobertura económica SII</span><b>${pct(c.sii_economic_coverage_pct)}</b><small>${fmt(c.sii_economic_observed)} de ${fmt(c.atlas_observed_osfl)} OSFL</small></div>
      <div class="osfl95-scale"><span>Grandes · tramos 10–13</span><b>${fmt(c.large_entities)}</b><small>${pct(c.large_share_economic_pct)} del subconjunto económico</small></div>
      <div class="osfl95-scale"><span>Top 1% por dotación</span><b>${pct(c.workers_top1pct_headcount_share_pct)}</b><small>de los trabajadores observados</small></div>
      <div class="osfl95-scale"><span>Ventas altas · ≤2 trabajadores</span><b>${fmt(c.low_staff_high_sales_context_count)}</b><small>contexto para revisión, no anomalía concluyente</small></div>
    </div>
    <div class="osfl95-grid">
      <article class="osfl95-panel"><div class="osfl95-panel-title"><div><span>VENTAS SII</span><h4>Distribución por 13 tramos</h4></div><small>P50 tramo ${fmt(c.sales_band_p50)} · P90 ${fmt(c.sales_band_p90)}</small></div>${distBars(sales)}</article>
      <article class="osfl95-panel"><div class="osfl95-panel-title"><div><span>DOTACIÓN</span><h4>Trabajadores informados</h4></div><small>P90 ${fmt(c.workers_p90)} · P99 ${Number(c.workers_p99||0).toLocaleString('es-CL',{maximumFractionDigits:1})}</small></div>${distBars(workers)}</article>
      <article class="osfl95-panel wide"><div class="osfl95-panel-title"><div><span>LECTURA DIRIGIDA</span><h4>Escala de ventas alta con dotación muy baja</h4></div><small>tramo ≥8 y ≤2 trabajadores</small></div>${state.queue.length?queueRows(state.queue):'<div class="osfl95-empty"><b>Sin casos en el corte actual</b><span>No se observan entidades que cumplan simultáneamente ambos criterios.</span></div>'}</article>
    </div>`;
  }

  function queueRows(rows){
    return `<div class="osfl95-queue">${rows.map((r,i)=>`<button type="button" class="osfl95-row" data-osfl95-entity="${esc(r.entity_id)}"><em>${String(i+1).padStart(2,'0')}</em><span class="osfl95-row-main"><b>${esc(r.name||'Entidad')}</b><small>${esc(r.rut||'')} · ${esc(r.activity_group||'actividad no informada')}</small></span><span class="osfl95-row-stat"><b>Tramo ${fmt(r.sales_band_rank)}</b><small>${esc(r.sales_band_label||'')}</small></span><span class="osfl95-row-stat"><b>${fmt(r.workers_numeric)}</b><small>trabajadores</small></span></button>`).join('')}</div>`;
  }

  function bindRows(){
    document.querySelectorAll('[data-osfl95-entity]').forEach(btn=>{
      if(btn.dataset.bound)return;btn.dataset.bound='1';
      btn.addEventListener('click',()=>{if(typeof v030OpenEntity==='function')void v030OpenEntity(btn.dataset.osfl95Entity);});
    });
  }

  function emitSignals(){
    const snapshot={
      version:'0.95.0',
      build:BUILD,
      observedOsfl:n(state.conc?.atlas_observed_osfl),
      economicObserved:n(state.conc?.sii_economic_observed),
      economicCoveragePct:n(state.conc?.sii_economic_coverage_pct),
      registro19862Observed:n(state.conc?.registro19862_observed),
      confirmedTransferRecipients:n(state.funds?.confirmed_transfer_recipients),
      confirmedTransferEvents:n(state.funds?.confirmed_transfer_events),
      confirmedTransferAmountClp:n(state.funds?.confirmed_transfer_amount_clp),
      lowStaffHighSalesContextCount:n(state.conc?.low_staff_high_sales_context_count),
      workersTop1PctHeadcountSharePct:n(state.conc?.workers_top1pct_headcount_share_pct),
      transferSourceStatus:state.funds?.transfer_source_status||null,
      semantics:'Economic scale and public-funds context only; not AML risk. Registro 19.862 membership does not prove receipt.'
    };
    window.__ATLAS_OSFL_ECONOMIC_SIGNALS__={
      ...snapshot,
      async getEntityContext(entityId){
        const c=client();if(!c||!entityId)return null;
        const {data,error}=await c.from(V.PROFILE).select('*').eq('entity_id',entityId).limit(1);
        if(error)throw error;return data?.[0]||null;
      }
    };
    document.dispatchEvent(new CustomEvent('atlas:osfl-economic:ready',{detail:snapshot}));
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>80)clearInterval(timer);
  },250);
  document.addEventListener('atlas:osfl-national-ready',install,{once:false});
  window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
