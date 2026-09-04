'use strict';
/* ATLAS AML · Gasto Público GP10 · monitor de compras públicas (Mercado Público)
 *
 * Autoridad de datos: vistas materializadas aml_mv_gp10_* / aml_v_gp10_coverage.
 * Cada hallazgo declara su métrica, su umbral y su fundamento; los índices
 * priorizan revisión y no acreditan irregularidad, delito ni LA/FT.
 *
 * Restricción CSP del portal (style-src 'self'): este módulo no emite atributos
 * style inline. Las barras proporcionales usan atributos SVG.
 */
(function atlasGastoPublico1000(){
  const VERSION='GP10.0';
  const VIEW='public-spend';

  const SRC={
    coverage:'aml_v_gp10_coverage',
    findings:'aml_mv_gp10_finding',
    suppliers:'aml_mv_gp10_supplier_risk',
    buyers:'aml_mv_gp10_buyer_risk',
    pairs:'aml_mv_gp10_pair'
  };

  const CODE_LABEL={
    EMPRESA_RECIENTE_MONTO_ALTO:'Empresa reciente · monto alto',
    CAPITAL_DESPROPORCIONADO:'Capital desproporcionado',
    CAPTURA_COMPRADOR:'Proveedor concentra un servicio',
    POSIBLE_FRACCIONAMIENTO:'Posible fraccionamiento',
    CONCENTRACION_PROVEEDOR:'Servicio concentrado',
    DEPENDENCIA_COMPRADOR_UNICO:'Proveedor cautivo',
    SANCION_OBSERVADA:'Sanción observada',
    UAF_OBSERVADO:'Sujeto obligado UAF',
    LOBBY_OBSERVADO:'Lobby observado'
  };
  const SIGNAL_LABEL=Object.assign({},CODE_LABEL,{
    CONCENTRACION_RELEVANTE:'Concentración relevante',
    COMPRADOR_UNICO:'Comprador único',
    EMPRESA_NUEVA:'Empresa nueva',
    MONTO_ATIPICO:'Monto atípico',
    CONTEXTO_CGR:'Contexto CGR',
    SENAL_PRESUPUESTARIA:'Señal presupuestaria',
    BAJA_DIVERSIDAD_PROVEEDORES:'Baja diversidad',
    MERCADO_CONCENTRADO:'Mercado concentrado',
    PROVEEDORES_RECIENTES:'Proveedores recientes',
    SIN_REGISTRO_RES:'Sin registro RES'
  });
  const SEVERITIES=['ALTA','MEDIA','BAJA'];

  const S={
    tab:'findings', findings:null, suppliers:null, buyers:null, coverage:null,
    sev:new Set(), codes:new Set(), query:'', selected:null, detail:null,
    loading:false, error:null, busyDetail:false
  };
  let searchTimer=null, opening=false;

  /* ---------- utilidades ---------- */
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const NF=new Intl.NumberFormat('es-CL');
  const money=v=>{const n=num(v),a=Math.abs(n);
    if(a>=1e12)return '$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';
    if(a>=1e9) return '$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M';
    if(a>=1e6) return '$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M';
    return '$'+NF.format(Math.round(n));};
  const moneyFull=v=>'$'+NF.format(Math.round(num(v)));
  const DIACRITICS=new RegExp('[\\u0300-\\u036f]','g');
  const norm=v=>String(v||'').normalize('NFD').replace(DIACRITICS,'').toUpperCase();
  const pct=v=>Number.isFinite(Number(v))?(100*Number(v)).toLocaleString('es-CL',{maximumFractionDigits:1})+'%':'—';
  const codeLabel=c=>CODE_LABEL[c]||String(c||'').replaceAll('_',' ');
  const signalLabel=c=>SIGNAL_LABEL[c]||String(c||'').replaceAll('_',' ');
  const dateCL=d=>{const s=String(d||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10).split('-').reverse().join('-'):'—';};

  /** Barra proporcional en SVG: la CSP impide anchos vía style inline. */
  function bar(ratio,tone){
    const w=Math.max(0,Math.min(100,Math.round(num(ratio)*100)));
    const cls=tone?` ${tone}`:'';
    return `<svg class="gp10-bar" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">`
      +`<rect class="gp10-bar-bg" x="0" y="0" width="100" height="6" rx="3"></rect>`
      +`<rect class="gp10-bar-fill${cls}" x="0" y="0" width="${w}" height="6" rx="3"></rect></svg>`;
  }
  const scoreTone=s=>num(s)>=75?'crit':num(s)>=60?'warn':'';

  function host(){
    try{return typeof v019Content==='function'?v019Content():document.querySelector('#content');}
    catch{return document.querySelector('#content');}
  }
  function publish(status,extra){
    window.__ATLAS_GASTO_PUBLICO_1000__=Object.assign({
      status,version:VERSION,view:VIEW,authority:'GASTO_PUBLICO_GP10',
      sources:Object.values(SRC),tab:S.tab,checkedAt:new Date().toISOString()
    },extra||{});
  }

  /* ---------- carga ---------- */
  async function loadCore(force){
    const c=db();
    if(!c)throw new Error('Sesión de datos ATLAS no disponible.');
    if(S.findings&&!force)return;
    const [cov,fnd]=await Promise.all([
      c.from(SRC.coverage).select('*').maybeSingle(),
      c.from(SRC.findings).select('*')
        .order('severity_rank',{ascending:false})
        .order('amount_clp',{ascending:false})
        .limit(600)
    ]);
    if(fnd.error)throw fnd.error;
    S.coverage=cov.error?null:cov.data;
    S.findings=fnd.data||[];
  }
  async function loadRanking(kind){
    const c=db();
    if(!c)throw new Error('Sesión de datos ATLAS no disponible.');
    if(kind==='suppliers'&&S.suppliers)return;
    if(kind==='buyers'&&S.buyers)return;
    const table=kind==='suppliers'?SRC.suppliers:SRC.buyers;
    const {data,error}=await c.from(table).select('*')
      .order('attention_score',{ascending:false})
      .order('total_clp',{ascending:false})
      .limit(300);
    if(error)throw error;
    if(kind==='suppliers')S.suppliers=data||[];else S.buyers=data||[];
  }

  /* ---------- filtrado ---------- */
  function visibleFindings(){
    const rows=S.findings||[];
    const q=norm(S.query.trim());
    return rows.filter(r=>{
      if(S.sev.size&&!S.sev.has(r.severity))return false;
      if(S.codes.size&&!S.codes.has(r.finding_code))return false;
      if(!q)return true;
      return norm(`${r.subject_name} ${r.counterpart_name} ${r.region} ${r.finding_code} ${r.rationale}`).includes(q);
    });
  }
  function countBy(rows,key){
    const m=new Map();
    for(const r of rows){const k=r[key];m.set(k,(m.get(k)||0)+1);}
    return m;
  }

  /* ---------- render: cabecera ---------- */
  function heroHtml(){
    const c=S.coverage||{};
    const win=c.window_start?`${dateCL(c.window_start)} → ${dateCL(c.window_end)}`:'ventana publicada';
    const res=num(c.res_coverage_pct), idn=num(c.identity_coverage_pct);
    return `<div class="gp10-hero">
      <div>
        <span class="gp10-eyebrow">Atlas · Contraloría analítica de compras públicas</span>
        <h2>Monitor de gasto público</h2>
        <p>Hallazgos explicables sobre órdenes de compra de Mercado Público, cruzados con Registro de Empresas y Sociedades, identidad gobernada del Workbench e InfoLobby. Cada señal declara su métrica y su umbral.</p>
      </div>
      <div class="gp10-health">
        <div class="gp10-health-row">
          <span class="gp10-pill"><b>${esc(win)}</b></span>
          <span class="gp10-pill plain"><b>${NF.format(num(c.order_count))}</b>&nbsp;órdenes</span>
        </div>
        <div class="gp10-health-row">
          <span class="gp10-pill ${res>=25?'':'warn'}">RES <b>${res?res+'%':'—'}</b></span>
          <span class="gp10-pill ${idn>=25?'':'warn'}">Identidad <b>${idn?idn+'%':'—'}</b></span>
        </div>
      </div>
    </div>`;
  }
  function tabsHtml(){
    const c=S.coverage||{};
    const tabs=[
      ['findings','Hallazgos',num(c.finding_count)],
      ['suppliers','Proveedores',num(c.supplier_count)],
      ['buyers','Servicios públicos',num(c.buyer_count)],
      ['method','Método y cobertura',null]
    ];
    return `<nav class="gp10-tabs" aria-label="Vistas de gasto público">
      ${tabs.map(([k,l,n])=>`<button type="button" class="gp10-tab ${S.tab===k?'active':''}" data-gp10-tab="${k}">${esc(l)}${n?`<span class="gp10-tab-n">${NF.format(n)}</span>`:''}</button>`).join('')}
      <span class="gp10-actions">
        <button type="button" class="gp10-ghost" data-gp10-act="export">Exportar CSV</button>
        <button type="button" class="gp10-ghost" data-gp10-act="reload">Actualizar</button>
      </span>
    </nav>`;
  }
  function kpisHtml(rows){
    const c=S.coverage||{};
    const alta=rows.filter(r=>r.severity==='ALTA').length;
    const amount=rows.reduce((a,r)=>a+num(r.amount_clp),0);
    const subjects=new Set(rows.map(r=>r.subject_key)).size;
    const recent=rows.filter(r=>r.finding_code==='EMPRESA_RECIENTE_MONTO_ALTO').length;
    const conc=rows.filter(r=>r.finding_code==='CAPTURA_COMPRADOR'||r.finding_code==='CONCENTRACION_PROVEEDOR').length;
    const cards=[
      ['Hallazgos visibles',NF.format(rows.length),`de ${NF.format(num(c.finding_count))} en el universo`,''],
      ['Severidad alta',NF.format(alta),'requieren revisión prioritaria','alta'],
      ['Monto involucrado',money(amount),'suma de los hallazgos visibles',''],
      ['Empresas recientes',NF.format(recent),'constituidas ≤2 años antes','media'],
      ['Concentración',NF.format(conc),'captura o dependencia de servicio','']
    ];
    return `<div class="gp10-kpis">${cards.map(x=>
      `<article class="gp10-kpi ${x[3]}"><span>${esc(x[0])}</span><b>${esc(x[1])}</b><small>${esc(x[2])}</small></article>`
    ).join('')}<span hidden>${subjects}</span></div>`;
  }
  function filtersHtml(){
    const all=S.findings||[];
    const bySev=countBy(all,'severity'), byCode=countBy(all,'finding_code');
    const codes=[...byCode.entries()].sort((a,b)=>b[1]-a[1]);
    return `<div class="gp10-filters">
      <div class="gp10-filter-row">
        <span class="gp10-filter-label">Severidad</span>
        ${SEVERITIES.filter(s=>bySev.has(s)).map(s=>
          `<button type="button" class="gp10-chip sev-${s} ${S.sev.has(s)?'on':''}" data-gp10-sev="${s}">${esc(s)}<i>${bySev.get(s)}</i></button>`).join('')}
        <input class="gp10-search" id="gp10-search" type="search" value="${esc(S.query)}"
               placeholder="Buscar proveedor, servicio, región o fundamento…" autocomplete="off">
      </div>
      <div class="gp10-filter-row">
        <span class="gp10-filter-label">Hallazgo</span>
        ${codes.map(([c,n])=>
          `<button type="button" class="gp10-chip ${S.codes.has(c)?'on':''}" data-gp10-code="${esc(c)}">${esc(codeLabel(c))}<i>${n}</i></button>`).join('')}
        ${(S.sev.size||S.codes.size||S.query)?'<button type="button" class="gp10-chip" data-gp10-act="clear">Limpiar filtros</button>':''}
      </div>
    </div>`;
  }

  /* ---------- render: hallazgos ---------- */
  function findingCard(r,i){
    const sel=S.selected&&S.selected.finding_id===r.finding_id;
    return `<button type="button" class="gp10-card sev-${esc(r.severity)} ${sel?'on':''}" data-gp10-finding="${i}">
      <span class="gp10-card-sev"></span>
      <span class="gp10-card-body">
        <span class="gp10-card-top">
          <span class="gp10-tag sev-${esc(r.severity)}">${esc(r.severity)}</span>
          <span class="gp10-tag">${esc(codeLabel(r.finding_code))}</span>
          <span class="gp10-tag scope">${esc(r.scope)}</span>
        </span>
        <b>${esc(r.subject_name||'Sin nombre')}</b>
        <p>${esc(r.rationale||'')}</p>
        <span class="gp10-card-meta">
          <span>${esc(r.metric_label||'')}: <b>${esc(r.metric_value||'—')}</b></span>
          ${r.counterpart_name?`<span>Contraparte: <b>${esc(r.counterpart_name)}</b></span>`:''}
          ${r.region?`<span>${esc(r.region)}</span>`:''}
        </span>
      </span>
      <span class="gp10-card-num"><strong>${esc(money(r.amount_clp))}</strong><em>monto observado</em></span>
    </button>`;
  }
  function findingsHtml(rows){
    const list=rows.slice(0,300);
    return `<div class="gp10-main">
      <section class="gp10-panel">
        <div class="gp10-panel-head">
          <div><span>Feed de hallazgos</span><h3>Priorizado por severidad y materialidad</h3></div>
          <small>${NF.format(rows.length)} visibles${rows.length>300?' · 300 mostrados':''}</small>
        </div>
        <div class="gp10-scroll">${list.map(findingCard).join('')||'<div class="gp10-empty">Sin hallazgos para los filtros actuales.</div>'}</div>
      </section>
      <aside class="gp10-panel gp10-side">${detailHtml()}</aside>
    </div>`;
  }

  /* ---------- render: rankings ---------- */
  function rankRow(r,i,kind){
    const score=num(r.attention_score);
    const name=kind==='suppliers'?r.supplier_name:r.buyer_name;
    const sub=kind==='suppliers'
      ? `${NF.format(num(r.buyer_count))} comprador(es) · ${NF.format(num(r.order_count))} órdenes${r.age_years!=null?` · ${r.age_years} años`:''}`
      : `${esc(r.region||'Sin región')} · ${NF.format(num(r.supplier_count))} proveedores · HHI ${r.hhi??'—'}`;
    const key=kind==='suppliers'?r.supplier_key:r.buyer_key;
    const sel=S.selected&&S.selected.__key===key;
    return `<button type="button" class="gp10-row ${sel?'on':''}" data-gp10-rank="${i}">
      <span class="gp10-rank">${i+1}</span>
      <span><b>${esc(name||'Sin nombre')}</b><small>${sub}</small>${bar(score/100,scoreTone(score))}</span>
      <span class="gp10-row-amt">${esc(money(r.total_clp))}</span>
      <span class="gp10-score ${score>=75?'s-very':score>=60?'s-high':''}">${score}<em>atención</em></span>
    </button>`;
  }
  function rankingHtml(kind){
    const rows=(kind==='suppliers'?S.suppliers:S.buyers)||[];
    const q=norm(S.query.trim());
    const filtered=q?rows.filter(r=>norm(`${r.supplier_name||''} ${r.buyer_name||''} ${r.region||''} ${(r.signal_codes||[]).join(' ')}`).includes(q)):rows;
    const title=kind==='suppliers'?'Proveedores por índice de atención':'Servicios públicos por índice de atención';
    return `<div class="gp10-filters"><div class="gp10-filter-row">
        <span class="gp10-filter-label">Buscar</span>
        <input class="gp10-search" id="gp10-search" type="search" value="${esc(S.query)}"
               placeholder="${kind==='suppliers'?'Proveedor, RUT o señal…':'Servicio público, región o señal…'}" autocomplete="off">
      </div></div>
      <div class="gp10-main">
      <section class="gp10-panel">
        <div class="gp10-panel-head">
          <div><span>${kind==='suppliers'?'Proveedores':'Compradores'}</span><h3>${title}</h3></div>
          <small>${NF.format(filtered.length)} visibles</small>
        </div>
        <div class="gp10-scroll">${filtered.slice(0,200).map((r,i)=>rankRow(r,i,kind)).join('')||'<div class="gp10-empty">Sin resultados.</div>'}</div>
      </section>
      <aside class="gp10-panel gp10-side">${detailHtml()}</aside>
    </div>`;
  }

  /* ---------- render: ficha ---------- */
  function detailHtml(){
    const d=S.detail;
    if(S.busyDetail)return '<div class="gp10-loading"><div class="gp10-spinner"></div>Abriendo ficha…</div>';
    if(!d)return `<div class="gp10-side-empty"><div>
        <b>Selecciona un hallazgo</b>
        <p>La ficha muestra la métrica que gatilló la señal, el perfil societario y las relaciones con el Estado que sostienen la observación.</p>
      </div></div>`;

    const p=d.profile||{}, rels=d.relations||[], isSup=d.kind==='supplier';
    const score=num(p.attention_score);
    const facts=isSup?[
      ['Monto en compras públicas',money(p.total_clp)],
      ['Órdenes',NF.format(num(p.order_count))],
      ['Compradores',NF.format(num(p.buyer_count))],
      ['Dependencia del principal',pct(p.dependence_share)],
      ['Constitución',dateCL(p.constitution_date)],
      ['Antigüedad al 1er contrato',p.age_years!=null?`${p.age_years} años`:'Sin registro RES'],
      ['Capital social',p.capital?moneyFull(p.capital):'—'],
      ['Monto / capital',p.capital_ratio!=null?`${p.capital_ratio}x`:'—']
    ]:[
      ['Gasto observado',money(p.total_clp)],
      ['Órdenes',NF.format(num(p.order_count))],
      ['Proveedores',NF.format(num(p.supplier_count))],
      ['Principal proveedor',pct(p.top_supplier_share)],
      ['HHI',p.hhi??'—'],
      ['Región',p.region||'—'],
      ['Proveedores recientes',NF.format(num(p.recent_suppliers))],
      ['Pares con fraccionamiento',NF.format(num(p.frag_pairs))]
    ];
    const signals=p.signal_codes||[];
    const f=d.finding;

    return `<div class="gp10-dossier">
      <h3>${esc(d.title||'Ficha')}</h3>
      <p class="gp10-sub">${isSup?'Proveedor del Estado':'Servicio público comprador'}${p.entity_id?' · identidad resuelta':''}</p>

      <div class="gp10-meter-wrap">
        <div class="gp10-meter-head"><span>Índice de atención</span><b>${score}/100</b></div>
        ${bar(score/100,scoreTone(score))}
      </div>

      ${f?`<div class="gp10-block"><h4>Hallazgo seleccionado</h4>
        <p class="gp10-why">${esc(f.rationale||'')}</p>
        <p class="gp10-why"><b>${esc(f.metric_label||'')}:</b> ${esc(f.metric_value||'—')}</p>
      </div>`:''}

      <div class="gp10-block"><h4>Antecedentes</h4>
        <div class="gp10-facts">${facts.map(x=>
          `<div class="gp10-fact"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}</div>
      </div>

      ${signals.length?`<div class="gp10-block"><h4>Señales activas</h4>
        <div class="gp10-signals">${signals.map(s=>`<span class="gp10-tag">${esc(signalLabel(s))}</span>`).join('')}</div>
      </div>`:''}

      ${rels.length?`<div class="gp10-block"><h4>${isSup?'Principales compradores':'Principales proveedores'}</h4>
        ${rels.map(r=>`<div class="gp10-rel"><span>${esc(isSup?r.buyer_name:r.supplier_name)}</span><b>${esc(money(r.total_clp))}</b></div>`).join('')}
      </div>`:''}

      ${p.entity_id?`<button type="button" class="gp10-link" data-gp10-entity="${esc(p.entity_id)}">Abrir Entidad 360</button>`:''}

      <p class="gp10-note">Los índices y señales priorizan revisión analítica. No acreditan por sí solos irregularidad administrativa, incumplimiento contractual, delito ni lavado de activos.</p>
    </div>`;
  }

  /* ---------- render: método ---------- */
  function methodHtml(){
    const c=S.coverage||{};
    const card=(t,body,cls)=>`<section class="gp10-panel ${cls||''}"><h3>${t}</h3>${body}</section>`;
    return `<div class="gp10-method">
      ${card('Modelo analítico',`<p>El monitor agrega órdenes de compra a nivel comprador–proveedor y evalúa reglas independientes. Cada regla declara umbral y fundamento; el índice de atención es la suma acotada de sus pesos.</p><code class="gp10-code">atención = min(100, Σ peso(señal activa))</code>`)}
      ${card('Empresa reciente · monto alto',`<p>Antigüedad de la sociedad al primer contrato observado, según fecha de constitución del Registro de Empresas y Sociedades.</p><code class="gp10-code">antigüedad ≤ 2 años y monto ≥ $50.000.000</code><p>Peso 20. Severidad alta si la antigüedad es ≤ 1 año.</p>`)}
      ${card('Capital desproporcionado',`<p>Relación entre el monto contratado y el capital social informado. Un múltiplo alto obliga a contrastar capacidad financiera y garantías.</p><code class="gp10-code">monto / capital ≥ 50</code><p>Peso 18. Severidad alta sobre 100x.</p>`)}
      ${card('Proveedor concentra un servicio',`<p>Participación de un proveedor en el gasto observado de un servicio público con volumen material.</p><code class="gp10-code">monto par / gasto del servicio ≥ 60%<br>gasto del servicio ≥ $100.000.000</code><p>Peso 22. Severidad alta sobre 75%.</p>`)}
      ${card('Posible fraccionamiento',`<p>Serie de órdenes entre un mismo par, todas bajo el umbral de referencia de 100 UTM, con monto agregado material.</p><code class="gp10-code">≥ 8 órdenes · máximo &lt; $6.176.900 · suma ≥ $30.000.000</code><p>Peso 18. UTM de enero 2023 = $61.769.</p>`)}
      ${card('Concentración del servicio',`<p>Participación del principal proveedor y HHI sobre los proveedores del servicio.</p><code class="gp10-code">HHI = Σ (monto proveedor / gasto total)²</code><p>Pesos 22 (participación ≥ 60%) y 12 (HHI ≥ 0,25).</p>`)}
      ${card('Proveedor cautivo',`<p>Concentración de las ventas públicas del proveedor en un único comprador. Describe una relación económica; por sí sola no es adversa.</p><code class="gp10-code">comprador principal ≥ 80% de las ventas públicas</code><p>Peso 12, severidad media.</p>`)}
      ${card('Identidad y contexto',`<p>Sanciones y condición de sujeto obligado UAF provienen de la identidad gobernada del Workbench por RUT exacto. Las audiencias de InfoLobby son actividad lícita y regulada, informada como contexto.</p><code class="gp10-code">sanción 15 · UAF 10 · lobby 8 · CGR 10</code>`)}
      ${card('Cobertura declarada',`<p>Ventana observada: <b>${esc(dateCL(c.window_start))} → ${esc(dateCL(c.window_end))}</b>, con ${NF.format(num(c.order_count))} órdenes por ${esc(money(c.total_clp))}.</p><p>Perfil societario RES disponible para el <b>${num(c.res_coverage_pct)}%</b> de los proveedores; identidad gobernada del Workbench para el <b>${num(c.identity_coverage_pct)}%</b>. La ausencia de cobertura no es señal adversa: es ausencia de dato.</p>`)}
      ${card('Limitaciones explícitas',`<p>La ventana cargada corresponde a un único mes, por lo que <b>no se calculan tendencias ni estacionalidad</b>; el fraccionamiento se evalúa dentro del mes observado.</p><p>No se emite señal de sobreprecio: los códigos de producto agrupan contratos a suma alzada junto con bienes unitarios, de modo que comparar precios unitarios produciría falsos positivos. Se prefiere omitir la regla antes que sostener un hallazgo indefendible.</p><p>El mecanismo de compra llega con valores contaminados en la fuente y se normaliza sólo cuando corresponde a un código válido.</p>`,'gp10-method-limit')}
    </div>`;
  }

  /* ---------- render raíz ---------- */
  function render(focusSearch){
    const h=host();
    if(!h)return false;
    if(S.error){
      h.innerHTML=`<section class="gp10"><div class="gp10-error"><b>No fue posible cargar el monitor de gasto público</b><p>${esc(S.error)}</p><button type="button" class="gp10-ghost" data-gp10-act="reload">Reintentar</button></div></section>`;
      bind(h);publish('error',{error:S.error});return false;
    }
    const rows=visibleFindings();
    let body;
    if(S.tab==='findings')      body=filtersHtml()+kpisHtml(rows)+findingsHtml(rows);
    else if(S.tab==='suppliers')body=rankingHtml('suppliers');
    else if(S.tab==='buyers')   body=rankingHtml('buyers');
    else                        body=methodHtml();

    h.innerHTML=`<section class="gp10">${heroHtml()}${tabsHtml()}${body}
      <p class="gp10-foot">Fuente: Mercado Público · Registro de Empresas y Sociedades · InfoLobby · identidad gobernada AML Workbench. Señales de priorización analítica; la ausencia de señal no equivale a ausencia de riesgo.</p>
    </section>`;
    bind(h);
    if(focusSearch){
      const q=h.querySelector('#gp10-search');
      if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}
    }
    publish('ready',{findings:(S.findings||[]).length,visible:rows.length});
    return true;
  }
  function loadingView(msg){
    const h=host();
    if(h)h.innerHTML=`<section class="gp10"><div class="gp10-loading"><div class="gp10-spinner"></div>${esc(msg||'Cargando hallazgos…')}</div></section>`;
    publish('loading');
  }

  /* ---------- ficha: apertura ---------- */
  async function openDetail(kind,key,finding){
    const c=db();
    if(!c)return;
    S.busyDetail=true;render();
    try{
      const table=kind==='supplier'?SRC.suppliers:SRC.buyers;
      const col=kind==='supplier'?'supplier_key':'buyer_key';
      const [prof,rel]=await Promise.all([
        c.from(table).select('*').eq(col,key).maybeSingle(),
        c.from(SRC.pairs).select('buyer_name,supplier_name,total_clp,order_count')
          .eq(col,key).order('total_clp',{ascending:false}).limit(8)
      ]);
      if(prof.error)throw prof.error;
      const p=prof.data||{};
      S.detail={
        kind,__key:key,finding:finding||null,
        title:kind==='supplier'?(p.supplier_name||finding?.subject_name||key):(p.buyer_name||finding?.subject_name||key),
        profile:p,relations:rel.error?[]:(rel.data||[])
      };
      S.selected=finding?Object.assign({},finding,{__key:key}):{__key:key,finding_id:null};
      if(typeof audit==='function'){
        audit('OPEN_PUBLIC_SPEND_SUBJECT',{
          objectType:kind==='supplier'?'provider':'buyer',objectId:String(key),
          payload:{finding:finding?.finding_code||null,score:num(p.attention_score)}
        }).catch(()=>{});
      }
    }catch(e){
      S.detail={kind,__key:key,finding:finding||null,title:finding?.subject_name||key,profile:{},relations:[]};
    }finally{
      S.busyDetail=false;render();
    }
  }

  /* ---------- exportación ---------- */
  function exportCsv(){
    const rows=S.tab==='findings'?visibleFindings():[];
    const src=rows.length?rows:(S.findings||[]);
    if(!src.length)return;
    const cols=['severity','finding_code','scope','subject_name','counterpart_name','region','amount_clp','metric_label','metric_value','rationale'];
    const cell=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const csv=[cols.join(';')].concat(src.map(r=>cols.map(k=>cell(r[k])).join(';'))).join('\r\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`gasto-publico-hallazgos-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  /* ---------- eventos ---------- */
  function bind(root){
    root.addEventListener('click',async e=>{
      const tab=e.target.closest('[data-gp10-tab]');
      if(tab){
        const next=tab.dataset.gp10Tab;
        if(next===S.tab)return;
        S.tab=next;S.query='';S.detail=null;S.selected=null;
        if(next==='suppliers'||next==='buyers'){
          loadingView('Cargando ranking…');
          try{await loadRanking(next);}catch(err){S.error=String(err?.message||err);}
        }
        render();return;
      }
      const sev=e.target.closest('[data-gp10-sev]');
      if(sev){const v=sev.dataset.gp10Sev;S.sev.has(v)?S.sev.delete(v):S.sev.add(v);render();return;}

      const code=e.target.closest('[data-gp10-code]');
      if(code){const v=code.dataset.gp10Code;S.codes.has(v)?S.codes.delete(v):S.codes.add(v);render();return;}

      const card=e.target.closest('[data-gp10-finding]');
      if(card){
        const r=visibleFindings()[Number(card.dataset.gp10Finding)];
        if(r)await openDetail(r.scope==='SERVICIO'?'buyer':'supplier',r.subject_key,r);
        return;
      }
      const rank=e.target.closest('[data-gp10-rank]');
      if(rank){
        const kind=S.tab==='suppliers'?'supplier':'buyer';
        const rows=(S.tab==='suppliers'?S.suppliers:S.buyers)||[];
        const q=norm(S.query.trim());
        const filtered=q?rows.filter(x=>norm(`${x.supplier_name||''} ${x.buyer_name||''} ${x.region||''} ${(x.signal_codes||[]).join(' ')}`).includes(q)):rows;
        const r=filtered[Number(rank.dataset.gp10Rank)];
        if(r)await openDetail(kind,kind==='supplier'?r.supplier_key:r.buyer_key,null);
        return;
      }
      const ent=e.target.closest('[data-gp10-entity]');
      if(ent){
        const id=ent.dataset.gp10Entity;
        if(typeof window.openEntity==='function')window.openEntity(id);
        else if(typeof openEntity==='function')openEntity(id);
        return;
      }
      const act=e.target.closest('[data-gp10-act]');
      if(!act)return;
      const a=act.dataset.gp10Act;
      if(a==='clear'){S.sev.clear();S.codes.clear();S.query='';render();}
      else if(a==='export')exportCsv();
      else if(a==='reload'){S.error=null;load(true);}
    });

    const q=root.querySelector('#gp10-search');
    if(q)q.addEventListener('input',ev=>{
      S.query=ev.target.value;
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>render(true),140);
    });
  }

  /* ---------- ciclo de vida ---------- */
  function shellHeader(){
    try{
      if(typeof window.shell==='function')
        window.shell('Gasto público','Monitor de compras públicas: hallazgos explicables sobre proveedores, servicios y relaciones observadas.');
    }catch{}
  }
  async function load(force){
    if(S.loading)return false;
    S.loading=true;S.error=null;
    loadingView('Construyendo hallazgos de compras públicas…');
    try{
      if(force){S.findings=null;S.suppliers=null;S.buyers=null;S.detail=null;S.selected=null;}
      await loadCore(force);
      if(S.tab==='suppliers'||S.tab==='buyers')await loadRanking(S.tab);
      render();
      if(typeof audit==='function'){
        audit('VIEW_PUBLIC_SPEND',{
          objectType:'radar',objectId:'GASTO_PUBLICO_GP10',
          payload:{version:VERSION,findings:(S.findings||[]).length}
        }).catch(()=>{});
      }
      return true;
    }catch(e){
      S.error=String(e?.message||e);render();return false;
    }finally{S.loading=false;}
  }
  async function open(){
    if(opening)return false;
    opening=true;
    try{
      window.AtlasMobileNav?.close?.();
      shellHeader();
      if(S.findings){render();return true;}
      return await load(false);
    }finally{opening=false;}
  }

  /* Captura de ruta.
   * atlas-public-spend-v2.js (GP2) escucha el clic en fase de captura sobre
   * document y llama stopImmediatePropagation(), abriendo su propia función
   * interna sin pasar por window.AtlasPublicSpendV2. Como se registra antes que
   * route-authority-0578, se queda con el clic y ningún módulo posterior corre.
   * La fase de captura recorre window antes que document, así que escuchar en
   * window es lo único que permite a este módulo tomar la ruta sin modificar
   * GP2 ni el resto de la cadena. */
  window.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open().catch(err=>{S.error=String(err?.message||err);render();});
  },true);

  const api={
    version:VERSION,authority:'GASTO_PUBLICO_GP10',
    open,load,render,state:()=>({tab:S.tab,findings:(S.findings||[]).length,error:S.error}),
    health:()=>window.__ATLAS_GASTO_PUBLICO_1000__||null
  };
  window.AtlasGastoPublico1000=api;
  window.AtlasPublicSpendIntelligence0720=api;
  window.AtlasPublicSpendV2=api;
  window.dispatchEvent(new CustomEvent('atlas:public-spend-v2-ready',{detail:{version:VERSION}}));
  publish('installed');
})();
