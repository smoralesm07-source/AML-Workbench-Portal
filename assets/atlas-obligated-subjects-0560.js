'use strict';

/* ATLAS AML 0.56.0 · build 0560 · Sujetos Obligados
 *
 * Qué problema resuelve
 * ---------------------
 * El padrón de sujetos obligados de la UAF vive en el esquema desde el primer
 * día, pero hasta 0.55 sólo se usaba como una bandera booleana que teñía otras
 * pantallas. Ninguna superficie respondía la pregunta con la que un fiscalizador
 * empieza su día: de estos 9.782 inscritos, ¿a cuál miro primero, qué sé de él,
 * y qué no sé.
 *
 * Qué hace en su lugar
 * --------------------
 * - Panorama del padrón: dónde se concentra la carga fiscalizadora, qué sectores
 *   combinan alta vulnerabilidad estructural con baja presión supervisora
 *   observada, y qué brechas registrales existen entre el padrón y el SII.
 * - Padrón fiscalizable: exploración con facetas sobre el universo obligado,
 *   ordenado por el Índice de Priorización Fiscalizadora (IPF-1.0).
 * - Expediente de fiscalización por sujeto (atlas-obligated-dossier-0560.js).
 *
 * Semántica deliberada
 * --------------------
 * - El IPF ordena esfuerzo de fiscalización. No es probabilidad de LA/FT ni
 *   imputación de incumplimiento.
 * - La banda es posición dentro del padrón vigente, no un nivel absoluto.
 * - La vulnerabilidad sectorial describe al sector, no a la entidad inscrita.
 * - Un evento sancionatorio atribuido por nombre normalizado es candidato y no
 *   promueve identidad.
 * - Ausencia de dato se declara como no observado y jamás como cero.
 *
 * Seguridad: sólo lectura bajo la sesión y RLS existentes. No toca Auth ni
 * refresh tokens. Sin MutationObserver. Sin almacenamiento en el navegador.
 * Todos los gráficos son SVG con atributos de presentación: no se inyectan
 * estilos en línea, de modo que la CSP del portal se cumple sin excepciones.
 */
(function atlasObligatedSubjects0560(){
  const RELEASE='0.56.0';
  const BUILD='0560';
  const VIEW='sujetos-obligados';
  const AUTHORITY='UAF_OBLIGATED_SUBJECTS_0560';

  const SUBJECTS='aml_uaf_obligated_subject_snapshot';
  const SECTORS='aml_uaf_obligated_sector_snapshot';
  const OVERVIEW='aml_uaf_obligated_overview_snapshot';
  const LINKS='aml_uaf_sanction_subject_link_snapshot';

  const PAGE=30;
  const LIST_COLUMNS=[
    'rut','entity_id','registry_name','entity_name','subject_nature','uaf_sector_canonical',
    'region','commune','sii_status','sii_sales_band','sii_sales_band_rank','sii_workers',
    'activity_atypicality','sanction_event_count','sanction_event_count_5y','sanction_last_event_date',
    'source_count','sector_vulnerability','ipf_supervision_history','ipf_registry_coherence',
    'ipf_scale_complexity','ipf_observability_gap','ipf_score','ipf_band','ipf_percentile',
    'ipf_sector_percentile','ipf_credibility_pct','ipf_flags'
  ].join(',');

  const BANDS=[
    ['MUY_ALTA','Muy alta'],['ALTA','Alta'],['MEDIA','Media'],['BAJA','Baja'],['MINIMA','Mínima']
  ];
  const BAND_LABEL=Object.fromEntries(BANDS);

  const COMPONENTS=[
    ['VSE','sector_vulnerability','Vulnerabilidad sectorial',25],
    ['HSU','ipf_supervision_history','Historial de supervisión UAF',25],
    ['CRG','ipf_registry_coherence','Coherencia registral',20],
    ['EEC','ipf_scale_complexity','Escala y complejidad',18],
    ['OBS','ipf_observability_gap','Brecha de observabilidad',12]
  ];

  const SII_STATUS={
    ACTIVE_AS_PUBLISHED:'Actividad vigente en SII',
    TERMINATED_AS_PUBLISHED:'Término de giro publicado',
    SIN_PERFIL_SII:'Sin perfil tributario de empresa'
  };

  const FLAG_META={
    TERMINO_GIRO_VIGENTE_EN_PADRON:['Término de giro · inscripción vigente','crit'],
    HISTORIAL_SANCIONATORIO_UAF:['Historial sancionatorio UAF','crit'],
    REITERACION_5_ANIOS:['Reiteración en 5 años','crit'],
    GIRO_ATIPICO_EN_SECTOR:['Giro atípico en su sector','warn'],
    ESTRUCTURA_SOCIETARIA_COMPLEJA:['Estructura societaria compleja','warn'],
    SECTOR_ALTA_VULNERABILIDAD:['Sector de alta vulnerabilidad','warn'],
    SIN_PERFIL_SII_EN_PERSONA_JURIDICA:['Persona jurídica sin perfil SII','warn'],
    CAMBIO_DE_GIRO:['Cambio de giro declarado','info'],
    CAMBIO_DE_REGION:['Cambio de región declarado','info'],
    INSCRIPCION_RECIENTE:['Inicio de actividades reciente','info'],
    SIN_TERRITORIO_OBSERVADO:['Sin territorio observado',''],
    FUENTE_UNICA:['Fuente única',''],
    PERSONA_NATURAL_OBLIGADA:['Persona natural obligada','']
  };

  const SORTS=[
    ['ipf','Prioridad fiscalizadora (IPF)'],
    ['sector','Prioridad dentro de su sector'],
    ['events','Eventos sancionatorios UAF'],
    ['scale','Escala tributaria declarada'],
    ['name','Razón social (A–Z)']
  ];

  /* ---------------------------------------------------------------- estado */
  const state={
    mode:'panorama',
    overview:null,
    sectors:null,
    rows:[],
    total:null,
    loadedAll:false,
    loading:false,
    error:null,
    dossier:null,
    filters:{q:'',sector:'',region:'',status:'',nature:'',band:'',sanctioned:false,terminated:false,atypical:false,sort:'ipf'}
  };

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const content=()=>document.querySelector('#content');

  /* --------------------------------------------------------------- helpers */
  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
  function fmt(v,digits=0){
    const n=num(v);
    if(n===null)return '—';
    return n.toLocaleString('es-CL',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  }
  function pct(v,digits=1){const n=num(v);return n===null?'—':`${fmt(n,digits)}%`;}
  function day(v){
    if(!v)return '—';
    const d=new Date(v);
    return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('es-CL',{year:'numeric',month:'2-digit',day:'2-digit'});
  }
  function normRut(value){
    const raw=String(value||'').replace(/[.\s]/g,'').toUpperCase();
    if(!/^[0-9]+-?[0-9K]$/.test(raw))return '';
    return raw.includes('-')?raw:`${raw.slice(0,-1)}-${raw.slice(-1)}`;
  }
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function subjectName(row){return row?.registry_name||row?.entity_name||row?.rut||'Sujeto obligado';}

  /* ------------------------------------------------- objetos gráficos base */
  function ipfBar(score,band){
    const n=num(score);
    const w=n===null?0:clamp(n,0,100);
    return `<svg class="so-ipf-bar b-${esc(band||'MINIMA')}" viewBox="0 0 100 7" preserveAspectRatio="none" role="img" aria-label="IPF ${n===null?'no calculable':fmt(n,1)}">`
      +`<rect class="track" x="0" y="0" width="100" height="7" rx="3.5"></rect>`
      +(w>0?`<rect class="fill" x="0" y="0" width="${w.toFixed(2)}" height="7" rx="3.5"></rect>`:'')
      +`</svg>`;
  }

  /* Firma del índice: cinco segmentos proporcionales al aporte de cada
     componente al puntaje final. Un componente sin evidencia se dibuja como
     hueco, no como aporte nulo: la diferencia es la que importa. */
  function signature(row){
    const parts=COMPONENTS.map(([code,field,,weight])=>({code,weight,value:num(row?.[field])}));
    const available=parts.reduce((a,p)=>a+(p.value===null?0:p.weight),0);
    if(!available)return `<svg class="so-signature" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="Sin componentes con evidencia"><rect class="s-void" x="0" y="0" width="100" height="10" rx="2"></rect></svg>`;
    const total=parts.reduce((a,p)=>a+(p.value===null?0:p.value*p.weight),0);
    let x=0;
    const segs=parts.map(p=>{
      const share=p.value===null||total<=0?0:(p.value*p.weight)/total;
      const w=share*100;
      if(w<=0)return '';
      const rect=`<rect class="s-${p.code.toLowerCase()}" x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="10"><title>${esc(p.code)} · aporte ${fmt(share*100,0)}%</title></rect>`;
      x+=w;
      return rect;
    }).join('');
    const rest=x<100?`<rect class="s-void" x="${x.toFixed(2)}" y="0" width="${(100-x).toFixed(2)}" height="10"></rect>`:'';
    return `<svg class="so-signature" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="Composición del IPF">${segs}${rest}</svg>`;
  }

  function signatureLegend(){
    return `<div class="so-legend">`
      +COMPONENTS.map(([code,,label])=>`<span><i class="s-${code.toLowerCase()}"></i>${esc(label)}</span>`).join('')
      +`</div>`;
  }

  function bandLegend(){
    return `<div class="so-legend">`
      +BANDS.map(([code,label])=>`<span><i class="b-${code}"></i>${esc(label)}</span>`).join('')
      +`</div>`;
  }

  function flagset(flags,limit){
    const list=Array.isArray(flags)?flags:[];
    const shown=limit?list.slice(0,limit):list;
    if(!shown.length)return '';
    const extra=limit&&list.length>limit?`<span class="so-flag">+${list.length-limit}</span>`:'';
    return `<span class="so-flagset">`
      +shown.map(f=>{
        const meta=FLAG_META[f]||[String(f).replaceAll('_',' ').toLowerCase(),''];
        return `<span class="so-flag ${meta[1]}">${esc(meta[0])}</span>`;
      }).join('')
      +extra+`</span>`;
  }

  /* ------------------------------------------------------------- consultas */
  async function loadPanorama(force){
    if(state.overview&&state.sectors&&!force)return;
    const client=db();
    if(!client)throw new Error('La sesión de datos no está disponible.');
    const [ov,sec]=await Promise.all([
      client.from(OVERVIEW).select('payload,refreshed_at').eq('snapshot_key','CURRENT').maybeSingle(),
      client.from(SECTORS).select('*').order('subject_count',{ascending:false})
    ]);
    if(ov.error)throw ov.error;
    if(sec.error)throw sec.error;
    if(!ov.data)throw new Error('El panorama del padrón aún no está materializado en este corte.');
    state.overview=ov.data.payload||null;
    state.overviewAt=ov.data.refreshed_at||null;
    state.sectors=sec.data||[];
  }

  function buildQuery(client,{count}={}){
    const f=state.filters;
    let q=client.from(SUBJECTS).select(LIST_COLUMNS,count?{count:'estimated'}:undefined);
    const rut=normRut(f.q);
    const text=f.q.trim();
    if(rut)q=q.eq('rut',rut);
    else if(text.length>=2){
      const safe=text.replace(/[%,()]/g,' ').trim();
      if(safe)q=q.or(`registry_name.ilike.%${safe}%,entity_name.ilike.%${safe}%`);
    }
    if(f.sector)q=q.eq('uaf_sector_canonical',f.sector);
    if(f.region)q=f.region==='__none__'?q.is('region',null):q.eq('region',f.region);
    /* El conmutador de término de giro y el selector de condición tributaria
       escriben sobre el mismo campo. Si compitieran, la consulta pediría dos
       valores distintos a la vez y devolvería vacío sin explicar por qué; el
       conmutador manda y el selector se refleja en la línea de alcance. */
    const status=f.terminated?'TERMINATED_AS_PUBLISHED':f.status;
    if(status)q=q.eq('sii_status',status);
    if(f.nature)q=q.eq('subject_nature',f.nature);
    if(f.band)q=q.eq('ipf_band',f.band);
    if(f.sanctioned)q=q.gt('sanction_event_count',0);
    if(f.atypical)q=q.gte('activity_atypicality',0.90);
    const order={
      ipf:['ipf_score',false],
      sector:['ipf_sector_percentile',false],
      events:['sanction_event_count',false],
      scale:['sii_sales_band_rank',false],
      name:['registry_name',true]
    }[f.sort]||['ipf_score',false];
    q=q.order(order[0],{ascending:order[1],nullsFirst:false});
    return q;
  }

  async function loadPage(reset){
    const client=db();
    if(!client)throw new Error('La sesión de datos no está disponible.');
    if(reset){state.rows=[];state.total=null;state.loadedAll=false;}
    const from=state.rows.length;
    const q=buildQuery(client,{count:reset}).range(from,from+PAGE-1);
    const {data,error,count}=await q;
    if(error)throw error;
    const rows=data||[];
    state.rows=state.rows.concat(rows);
    if(reset&&typeof count==='number')state.total=count;
    if(rows.length<PAGE)state.loadedAll=true;
  }

  async function loadSubjectEvents(rut){
    const client=db();
    if(!client)return [];
    const {data,error}=await client.from(LINKS)
      .select('sanction_id,event_date,source_entity_name,resolution_ref,event_status,event_category,resolution_status,confidence')
      .eq('matched_rut',rut).order('event_date',{ascending:false});
    if(error)return [];
    return data||[];
  }

  /* -------------------------------------------------- panorama · gráficos */

  /* Cuadrante de vigilancia sectorial.
     X = vulnerabilidad estructural del sector. Y = eventos sancionatorios UAF
     publicados por cada 100 inscritos. Las líneas son las medianas del propio
     padrón, no umbrales normativos: separan sectores, no aprueban ni reprueban.
     El cuadrante superior izquierdo no existe como categoría de riesgo; el que
     interesa es el inferior derecho: mucha vulnerabilidad estructural y poca
     supervisión observada. */
  function sectorQuadrant(){
    const rows=(state.sectors||[]).filter(s=>num(s.vulnerability_index)!==null&&num(s.subject_count)>0);
    if(!rows.length)return '<div class="so-empty">Sin sectores materializados en el corte.</div>';
    const W=760,H=380,PAD={l:52,r:18,t:16,b:44};
    const pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b;
    const vx=rows.map(r=>num(r.vulnerability_index));
    const vy=rows.map(r=>num(r.sanction_rate_per_100)||0);
    const xMin=Math.max(0,Math.floor((Math.min(...vx)-6)/10)*10);
    const xMax=Math.min(100,Math.ceil((Math.max(...vx)+6)/10)*10);
    const yMax=Math.max(2,Math.max(...vy));
    const sortedX=[...vx].sort((a,b)=>a-b),sortedY=[...vy].sort((a,b)=>a-b);
    const medX=sortedX[Math.floor(sortedX.length/2)],medY=sortedY[Math.floor(sortedY.length/2)];
    const maxN=Math.max(...rows.map(r=>num(r.subject_count)||1));
    /* Raíz cuadrada en Y: sin ella, Factoring (16,9) aplasta a los 40 sectores
       que viven bajo 2 eventos por 100 y el gráfico deja de discriminar. */
    const sx=v=>PAD.l+((v-xMin)/(xMax-xMin))*pw;
    const sy=v=>PAD.t+ph-(Math.sqrt(Math.max(0,v))/Math.sqrt(yMax))*ph;
    const sr=n=>clamp(3.4+9*Math.sqrt(n/maxN),3.4,13);

    const xTicks=[];
    for(let v=xMin;v<=xMax;v+=10)xTicks.push(v);
    const yTicks=[0,1,2,5,10,15].filter(v=>v<=yMax);

    const dots=rows.map((r,i)=>{
      const x=sx(num(r.vulnerability_index)),y=sy(num(r.sanction_rate_per_100)||0),rad=sr(num(r.subject_count)||1);
      const band=(num(r.band_muy_alta)||0)+(num(r.band_alta)||0);
      const on=state.filters.sector===r.uaf_sector_canonical;
      const tip=`${r.uaf_sector_canonical} · ${fmt(r.subject_count)} inscritos · vulnerabilidad ${fmt(r.vulnerability_index,1)} · ${fmt(r.sanction_rate_per_100,2)} eventos por 100 · ${fmt(band)} en prioridad alta`;
      const fill=(num(r.sanction_rate_per_100)||0)<medY&&num(r.vulnerability_index)>medX?'var(--so-crg)':'var(--so-eec)';
      return `<circle class="dot${on?' on':''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${fill}" fill-opacity="0.78" data-so-sector="${esc(r.uaf_sector_canonical)}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title></circle>`;
    }).join('');

    return `<svg class="so-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vulnerabilidad estructural del sector frente a presión supervisora observada">
      <rect class="zone" x="${sx(medX).toFixed(1)}" y="${sy(medY).toFixed(1)}" width="${(PAD.l+pw-sx(medX)).toFixed(1)}" height="${(PAD.t+ph-sy(medY)).toFixed(1)}" rx="8"></rect>
      <line class="guide" x1="${sx(medX).toFixed(1)}" y1="${PAD.t}" x2="${sx(medX).toFixed(1)}" y2="${PAD.t+ph}"></line>
      <line class="guide" x1="${PAD.l}" y1="${sy(medY).toFixed(1)}" x2="${PAD.l+pw}" y2="${sy(medY).toFixed(1)}"></line>
      <line class="axis" x1="${PAD.l}" y1="${PAD.t+ph}" x2="${PAD.l+pw}" y2="${PAD.t+ph}"></line>
      <line class="axis" x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t+ph}"></line>
      ${xTicks.map(v=>`<text class="tick" x="${sx(v).toFixed(1)}" y="${PAD.t+ph+15}" text-anchor="middle">${v}</text>`).join('')}
      ${yTicks.map(v=>`<text class="tick" x="${PAD.l-8}" y="${(sy(v)+3).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
      <text class="axis-label" x="${(PAD.l+pw/2).toFixed(1)}" y="${H-8}" text-anchor="middle">Vulnerabilidad estructural del sector (0–100)</text>
      <text class="axis-label" x="14" y="${(PAD.t+ph/2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 14 ${(PAD.t+ph/2).toFixed(1)})">Eventos UAF publicados por 100 inscritos</text>
      <text class="quad-label" x="${(PAD.l+pw-8).toFixed(1)}" y="${(PAD.t+ph-8).toFixed(1)}" text-anchor="end">alta vulnerabilidad · baja supervisión observada</text>
      ${dots}
    </svg>`;
  }

  /* Carga fiscalizadora por sector: los doce sectores con más inscritos,
     apilados por banda del IPF. La barra dice a la vez tamaño del sector y
     cómo se reparte la prioridad dentro de él. */
  function sectorLoad(){
    const rows=(state.sectors||[]).slice(0,12);
    if(!rows.length)return '<div class="so-empty">Sin sectores materializados en el corte.</div>';
    const max=Math.max(...rows.map(r=>num(r.subject_count)||0),1);
    return `<div class="so-rows">`+rows.map(r=>{
      const total=num(r.subject_count)||0;
      const on=state.filters.sector===r.uaf_sector_canonical;
      let x=0;
      const segs=BANDS.map(([code])=>{
        const key={MUY_ALTA:'band_muy_alta',ALTA:'band_alta',MEDIA:'band_media',BAJA:'band_baja',MINIMA:'band_minima'}[code];
        const n=num(r[key])||0;
        if(!n||!total)return '';
        const w=(n/total)*(total/max)*100;
        const rect=`<rect class="b-${code}" x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="12" ><title>${esc(BAND_LABEL[code])}: ${fmt(n)}</title></rect>`;
        x+=w;
        return rect;
      }).join('');
      return `<button type="button" class="so-row${on?' on':''}" data-so-sector="${esc(r.uaf_sector_canonical)}" aria-pressed="${on}">
        <span class="label" title="${esc(r.uaf_sector_canonical)}">${esc(r.uaf_sector_canonical)}</span>
        <svg class="so-stack" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label="Distribución de prioridad">${segs}</svg>
        <span class="num">${fmt(total)}</span>
      </button>`;
    }).join('')+`</div>`+bandLegend();
  }

  function gapBars(){
    const gaps=state.overview?.gaps||[];
    if(!gaps.length)return '<div class="so-empty">Sin brechas materializadas.</div>';
    const max=Math.max(...gaps.map(g=>num(g.count)||0),1);
    return `<div class="so-rows">`+gaps.map(g=>{
      const n=num(g.count)||0;
      const w=(n/max)*100;
      return `<div class="so-row" role="group" aria-label="${esc(g.label)}">
        <span class="label" title="${esc(g.label)}">${esc(g.label)}</span>
        <svg class="so-stack" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label="${fmt(n)} sujetos">
          <rect class="b-MINIMA" x="0" y="0" width="100" height="12" fill="var(--so-track)"></rect>
          <rect class="b-ALTA" x="0" y="0" width="${w.toFixed(2)}" height="12"><title>${esc(g.reading||'')}</title></rect>
        </svg>
        <span class="num">${fmt(n)}</span>
      </div>`;
    }).join('')+`</div>`;
  }

  function regionBars(){
    const regions=(state.overview?.regions||[]).slice(0,14);
    if(!regions.length)return '<div class="so-empty">Sin territorios materializados.</div>';
    const max=Math.max(...regions.map(r=>num(r.subjects)||0),1);
    return `<div class="so-rows">`+regions.map(r=>{
      const n=num(r.subjects)||0,prio=num(r.priority)||0;
      const w=(n/max)*100,wp=(prio/max)*100;
      const key=r.region==='Sin territorio observado'?'__none__':r.region;
      const on=state.filters.region===key;
      return `<button type="button" class="so-row${on?' on':''}" data-so-region="${esc(key)}" aria-pressed="${on}">
        <span class="label" title="${esc(r.region)}">${esc(r.region)}</span>
        <svg class="so-stack" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label="${fmt(n)} inscritos, ${fmt(prio)} en prioridad alta">
          <rect class="b-BAJA" x="0" y="0" width="${w.toFixed(2)}" height="12"><title>${fmt(n)} inscritos</title></rect>
          <rect class="b-MUY_ALTA" x="0" y="0" width="${wp.toFixed(2)}" height="12"><title>${fmt(prio)} en prioridad alta o muy alta</title></rect>
        </svg>
        <span class="num">${fmt(n)}</span>
      </button>`;
    }).join('')+`</div>`
    +`<div class="so-legend"><span><i class="b-BAJA"></i>Inscritos en el territorio</span><span><i class="b-MUY_ALTA"></i>En prioridad alta o muy alta</span></div>`;
  }

  /* Serie sancionatoria: columnas por año con la porción efectivamente
     atribuida a un sujeto del padrón. La diferencia entre columna y porción
     llena es exactamente lo que el supervisor todavía no puede imputar. */
  function sanctionSeries(){
    const years=state.overview?.sanction_years||[];
    if(!years.length)return '<div class="so-empty">Sin eventos fechados en el corte.</div>';
    const W=520,H=190,PAD={l:32,r:12,t:14,b:28};
    const pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b;
    const max=Math.max(...years.map(y=>num(y.events)||0),1);
    const bw=Math.min(46,(pw/years.length)*0.62);
    const step=pw/years.length;
    const cols=years.map((y,i)=>{
      const cx=PAD.l+step*i+step/2;
      const total=num(y.events)||0,att=num(y.attributed)||0;
      const h=(total/max)*ph,ha=(att/max)*ph;
      return `<g class="col">
        <rect class="bar dim" x="${(cx-bw/2).toFixed(1)}" y="${(PAD.t+ph-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${y.year}: ${fmt(total)} eventos publicados</title></rect>
        <rect class="bar" x="${(cx-bw/2).toFixed(1)}" y="${(PAD.t+ph-ha).toFixed(1)}" width="${bw.toFixed(1)}" height="${ha.toFixed(1)}" rx="2" fill="var(--so-hsu)"><title>${y.year}: ${fmt(att)} atribuidos a un sujeto del padrón</title></rect>
        <text class="val" x="${cx.toFixed(1)}" y="${(PAD.t+ph-h-5).toFixed(1)}">${fmt(total)}</text>
        <text class="lab" x="${cx.toFixed(1)}" y="${(PAD.t+ph+16).toFixed(1)}">${esc(y.year)}</text>
      </g>`;
    }).join('');
    return `<svg class="so-series" viewBox="0 0 ${W} ${H}" role="img" aria-label="Eventos sancionatorios UAF por año y atribución al padrón">
      <line class="axis" x1="${PAD.l}" y1="${PAD.t+ph}" x2="${PAD.l+pw}" y2="${PAD.t+ph}"></line>
      ${cols}
    </svg>`
    +`<div class="so-legend"><span><i class="s-hsu"></i>Atribuido a un sujeto del padrón</span><span><i class="b-MINIMA"></i>Publicado sin atribución única</span></div>`;
  }

  /* ----------------------------------------------------------- superficies */
  function sourceBar(){
    const reg=state.overview?.registry||{};
    const sii=state.overview?.sii||{};
    return `<div class="so-sourcebar">
      <b>Padrón UAF de sujetos obligados</b>
      <span>Corte del registro: ${esc(day(reg.observed_at))}</span>
      <span>Recálculo del índice: ${esc(day(state.overviewAt))}</span>
      <span>Cobertura tributaria: ${esc(pct(sii.coverage_pct))}</span>
      <span class="so-seal">
        <em class="ok">IPF-1.0</em>
        <em>Sólo lectura · RLS</em>
        <em>v${esc(RELEASE)}</em>
      </span>
    </div>`;
  }

  function modeBar(){
    const modes=[['panorama','Panorama del padrón'],['padron','Padrón fiscalizable']];
    return `<div class="so-modes">`
      +modes.map(([k,l])=>`<button type="button" data-so-mode="${k}" class="${state.mode===k?'on':''}" aria-pressed="${state.mode===k}">${esc(l)}</button>`).join('')
      +`</div>`;
  }

  function kpis(){
    const reg=state.overview?.registry||{};
    const sii=state.overview?.sii||{};
    const sup=state.overview?.supervision||{};
    const bands=state.overview?.bands||{};
    const priority=(num(bands.MUY_ALTA)||0)+(num(bands.ALTA)||0);
    const gapTerm=num(sii.terminated)||0;
    return `<div class="so-kpis">
      <div class="so-kpi"><b>${fmt(reg.subjects)}</b><span>Sujetos obligados inscritos</span><small>${fmt(reg.sectors)} sectores de la Ley 19.913</small></div>
      <div class="so-kpi"><b>${fmt(reg.legal_persons)}</b><span>Personas jurídicas</span><small>${fmt(reg.natural_persons)} personas naturales obligadas</small></div>
      <div class="so-kpi watch"><b>${fmt(priority)}</b><span>En prioridad alta o muy alta</span><small>Posición dentro del padrón, no nivel absoluto</small></div>
      <div class="so-kpi alert"><b>${fmt(gapTerm)}</b><span>Con término de giro publicado</span><small>Inscripción vigente en el padrón UAF</small></div>
      <div class="so-kpi"><b>${fmt(sup.subjects_with_history)}</b><span>Con historial sancionatorio UAF</span><small>${fmt(sup.subjects_repeat_5y)} con reiteración en 5 años</small></div>
      <div class="so-kpi"><b>${fmt(sup.events_attributed)} / ${fmt(sup.events_total)}</b><span>Eventos UAF atribuidos al padrón</span><small>Atribución candidata por nombre normalizado</small></div>
    </div>`;
  }

  function watchlist(){
    const rows=state.overview?.watchlist||[];
    if(!rows.length)return '<div class="so-empty">Sin sujetos priorizados en el corte.</div>';
    return `<div class="so-list">`+rows.map(r=>`
      <button type="button" class="so-item" data-so-rut="${esc(r.rut)}">
        <span class="who">
          <strong>${esc(r.name)}</strong>
          <small>${esc(r.rut)} · ${esc(r.sector||'Sector no resuelto')} · ${esc(r.region||'Sin territorio observado')}</small>
          ${flagset(r.flags,3)}
        </span>
        <span class="metric"><b>${fmt(r.ipf,1)}</b><em>IPF · pctl ${fmt(r.percentile,1)}</em></span>
        <span class="sig">${ipfBar(r.ipf,r.band)}<em>${esc(BAND_LABEL[r.band]||r.band||'—')} · ${fmt(r.events)} eventos UAF</em></span>
        <span class="go">Abrir expediente →</span>
      </button>`).join('')+`</div>`;
  }

  function readingRules(){
    return `<section class="so-rules">
      <h2>Reglas de lectura de esta sección</h2>
      <p>El Índice de Priorización Fiscalizadora ordena a quién mirar primero con la evidencia disponible en el corte. Ordenar no es acusar: ninguna cifra de esta pantalla afirma incumplimiento, y ninguna sustituye la fiscalización.</p>
      <ul>
        <li><b>IPF ≠ probabilidad de LA/FT.</b> Prioriza esfuerzo de supervisión, no estima delito.</li>
        <li><b>La banda es posición.</b> Se ancla en percentiles del padrón vigente; si el padrón cambia, la banda se mueve aunque el sujeto no.</li>
        <li><b>La vulnerabilidad sectorial describe al sector.</b> No transmite conducta a la entidad inscrita en él.</li>
        <li><b>Sanción administrativa ≠ delito.</b> Y la atribución de un evento por nombre normalizado es candidata: no promueve identidad.</li>
        <li><b>Término de giro publicado ≠ baja del registro UAF.</b> Es una discrepancia entre dos registros públicos.</li>
        <li><b>Giro atípico ≠ incumplimiento.</b> Es rareza observada entre pares del mismo sector obligado.</li>
        <li><b>Ausencia de dato ≠ cero.</b> Un componente sin evidencia sale del promedio y baja la credibilidad declarada.</li>
        <li><b>Una persona natural obligada no tiene perfil tributario de empresa.</b> Esa ausencia no puntúa como brecha registral.</li>
      </ul>
    </section>`;
  }

  function panoramaHtml(){
    return `${sourceBar()}
    ${modeBar()}
    ${kpis()}
    <div class="so-grid g21">
      <section class="so-card">
        <header><div><h2>Cuadrante de vigilancia sectorial</h2><p>Cada punto es un sector obligado. Las líneas son las medianas del propio padrón, no umbrales normativos. La zona sombreada reúne los sectores con vulnerabilidad estructural sobre la mediana y presión supervisora publicada bajo la mediana.</p></div><span class="so-hint">tamaño = inscritos · clic = filtrar</span></header>
        ${sectorQuadrant()}
        <div class="so-legend"><span><i class="s-crg"></i>Alta vulnerabilidad, baja supervisión observada</span><span><i class="s-eec"></i>Resto del padrón</span></div>
      </section>
      <section class="so-card">
        <header><div><h2>Serie sancionatoria UAF</h2><p>Eventos publicados por año y porción efectivamente atribuida a un sujeto del padrón.</p></div></header>
        ${sanctionSeries()}
        <header><div><h2>Brechas de coherencia registral</h2><p>Diferencias observables entre el padrón UAF y el registro tributario.</p></div></header>
        ${gapBars()}
      </section>
    </div>
    <div class="so-grid g12">
      <section class="so-card">
        <header><div><h2>Distribución territorial</h2><p>Dónde está inscrito el padrón y cuánta de esa carga cae en prioridad alta.</p></div><span class="so-hint">clic = filtrar</span></header>
        ${regionBars()}
      </section>
      <section class="so-card">
        <header><div><h2>Carga fiscalizadora por sector</h2><p>Los doce sectores con más inscritos, con el reparto interno de prioridad. El ancho total es proporcional al tamaño del sector.</p></div><span class="so-hint">clic = filtrar</span></header>
        ${sectorLoad()}
      </section>
    </div>
    <section class="so-card">
      <header><div><h2>Doce sujetos obligados al tope del índice</h2><p>Orden por IPF absoluto sobre el corte vigente. Abrir el expediente muestra el cálculo completo con su evidencia.</p></div><span class="so-hint">clic = expediente</span></header>
      ${watchlist()}
      ${signatureLegend()}
    </section>
    ${readingRules()}`;
  }

  function toolbar(){
    const f=state.filters;
    const sectors=(state.sectors||[]).map(s=>s.uaf_sector_canonical).filter(Boolean);
    const regions=(state.overview?.regions||[]).map(r=>r.region);
    const opt=(value,label,current)=>`<option value="${esc(value)}"${current===value?' selected':''}>${esc(label)}</option>`;
    return `<section class="so-card">
      <div class="so-toolbar">
        <div class="so-field"><label for="so-q">Razón social, RUT o ID</label>
          <input id="so-q" type="search" autocomplete="off" placeholder="Buscar en el padrón…" value="${esc(f.q)}"></div>
        <div class="so-field"><label for="so-sector">Sector obligado</label>
          <select id="so-sector">${opt('','Todos los sectores',f.sector)}${sectors.map(s=>opt(s,s,f.sector)).join('')}</select></div>
        <div class="so-field"><label for="so-region">Territorio</label>
          <select id="so-region">${opt('','Todo el país',f.region)}${regions.map(r=>opt(r==='Sin territorio observado'?'__none__':r,r,f.region)).join('')}</select></div>
        <div class="so-field"><label for="so-status">Condición tributaria</label>
          <select id="so-status">${opt('','Cualquiera',f.status)}${Object.entries(SII_STATUS).map(([k,v])=>opt(k,v,f.status)).join('')}</select></div>
        <div class="so-field"><label for="so-nature">Naturaleza</label>
          <select id="so-nature">${opt('','Cualquiera',f.nature)}${opt('PERSONA_JURIDICA','Persona jurídica',f.nature)}${opt('PERSONA_NATURAL','Persona natural',f.nature)}</select></div>
        <div class="so-field"><label for="so-band">Banda IPF</label>
          <select id="so-band">${opt('','Todas las bandas',f.band)}${BANDS.map(([k,v])=>opt(k,v,f.band)).join('')}</select></div>
        <div class="so-field"><label for="so-sort">Ordenar por</label>
          <select id="so-sort">${SORTS.map(([k,v])=>opt(k,v,f.sort)).join('')}</select></div>
        <button type="button" class="so-clear" id="so-clear">Limpiar filtros</button>
      </div>
      <div class="so-toggles" id="so-toggles">
        <button type="button" data-so-toggle="sanctioned" class="${f.sanctioned?'on':''}" aria-pressed="${f.sanctioned}">Con historial sancionatorio</button>
        <button type="button" data-so-toggle="terminated" class="${f.terminated?'on':''}" aria-pressed="${f.terminated}">Con término de giro</button>
        <button type="button" data-so-toggle="atypical" class="${f.atypical?'on':''}" aria-pressed="${f.atypical}">Giro atípico en su sector</button>
      </div>
    </section>`;
  }

  function scopeLine(){
    const f=state.filters;
    const parts=[];
    if(f.q.trim())parts.push(`Consulta: ${f.q.trim()}`);
    parts.push(f.sector||'Todos los sectores');
    parts.push(f.region==='__none__'?'Sin territorio observado':(f.region||'Todo el país'));
    if(f.terminated)parts.push(SII_STATUS.TERMINATED_AS_PUBLISHED);
    else if(f.status)parts.push(SII_STATUS[f.status]||f.status);
    if(f.nature)parts.push(f.nature==='PERSONA_NATURAL'?'Personas naturales':'Personas jurídicas');
    if(f.band)parts.push(`Banda ${BAND_LABEL[f.band]||f.band}`);
    if(f.sanctioned)parts.push('Con historial sancionatorio');
    if(f.atypical)parts.push('Giro atípico');
    return `<div class="so-scope">${parts.map(p=>`<span>${esc(p)}</span>`).join('')}</div>`;
  }

  function resultHeader(){
    const loaded=state.rows.length;
    const total=state.total;
    const exact=state.loadedAll?`${fmt(loaded)} sujetos obligados`:`${fmt(loaded)} cargados`;
    const estimate=(!state.loadedAll&&typeof total==='number')?` · estimación del planificador: ${fmt(total)}`:'';
    return `<header><div><h2>Padrón fiscalizable</h2><p>Se afirma el recuento efectivamente cargado. El total del conjunto es una estimación del planificador mientras queden páginas por traer.</p></div><span class="so-hint">${esc(exact)}${esc(estimate)}</span></header>`;
  }

  function listHtml(){
    if(state.loading&&!state.rows.length)return '<div class="so-loading">Consultando el padrón bajo la sesión autorizada…</div>';
    if(!state.rows.length)return '<div class="so-empty">Ningún sujeto obligado del padrón cumple estos filtros en el corte vigente.</div>';
    return `<div class="so-list">`+state.rows.map(r=>{
      const atyp=num(r.activity_atypicality);
      const scale=r.sii_sales_band?`Tramo ${esc(r.sii_sales_band)}`:(r.subject_nature==='PERSONA_NATURAL'?'Persona natural':'Escala no observada');
      return `<button type="button" class="so-item" data-so-rut="${esc(r.rut)}">
        <span class="who">
          <strong>${esc(subjectName(r))}</strong>
          <small>${esc(r.rut)} · ${esc(r.uaf_sector_canonical||'Sector no resuelto')} · ${esc(r.region||'Sin territorio observado')} · ${esc(scale)}</small>
          ${flagset(r.ipf_flags,3)}
        </span>
        <span class="metric"><b>${fmt(r.ipf_score,1)}</b><em>pctl ${fmt(r.ipf_percentile,1)} · sector ${fmt(r.ipf_sector_percentile,0)}</em></span>
        <span class="sig">${ipfBar(r.ipf_score,r.ipf_band)}${signature(r)}<em>${esc(BAND_LABEL[r.ipf_band]||'—')} · credibilidad ${fmt(r.ipf_credibility_pct,0)}%${atyp!==null?` · atipicidad ${fmt(atyp*100,0)}%`:''}</em></span>
        <span class="go">Abrir expediente →</span>
      </button>`;
    }).join('')+`</div>`
    +(state.loadedAll?'':`<div class="so-more"><button type="button" id="so-more">${state.loading?'Cargando…':`Cargar ${PAGE} más`}</button></div>`)
    +signatureLegend();
  }

  function padronHtml(){
    return `${sourceBar()}
    ${modeBar()}
    ${toolbar()}
    ${scopeLine()}
    <section class="so-card">
      ${resultHeader()}
      <div id="so-list">${listHtml()}</div>
    </section>
    ${readingRules()}`;
  }

  /* -------------------------------------------------------------- montaje */
  function render(){
    const host=content();
    if(!host)return;
    if(state.error){
      host.innerHTML=`<section class="so-root"><div class="so-error"><b>No fue posible abrir Sujetos Obligados.</b><br>${esc(state.error)}<br><small>La sección no reemplaza ninguna otra lectura del Workbench. Si el padrón no está materializado en este corte, el resto del portal sigue operando con normalidad.</small></div></section>`;
      return;
    }
    if(state.mode==='expediente'){
      const dossier=window.__ATLAS_OBLIGATED__?.renderDossier;
      host.innerHTML=`<section class="so-root">${sourceBar()}<div id="so-dossier" class="so-dossier"><div class="so-loading">Abriendo expediente de fiscalización…</div></div></section>`;
      if(typeof dossier==='function')dossier(state.dossier);
      wire();
      return;
    }
    host.innerHTML=`<section class="so-root">${state.mode==='panorama'?panoramaHtml():padronHtml()}</section>`;
    wire();
  }

  function renderListOnly(){
    const box=document.querySelector('#so-list');
    if(!box){render();return;}
    box.innerHTML=listHtml();
    const card=box.closest('.so-card');
    const head=card?.querySelector('header');
    if(head)head.outerHTML=resultHeader();
    wireList();
  }

  let searchTimer=null;

  function wire(){
    document.querySelectorAll('[data-so-mode]').forEach(b=>{
      b.addEventListener('click',()=>setMode(b.dataset.soMode));
    });
    document.querySelectorAll('[data-so-sector]').forEach(el=>{
      const go=()=>applyFacet('sector',el.dataset.soSector);
      el.addEventListener('click',go);
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
    });
    document.querySelectorAll('[data-so-region]').forEach(el=>{
      el.addEventListener('click',()=>applyFacet('region',el.dataset.soRegion));
    });
    const bind=(id,key,cast)=>{
      const el=document.querySelector(id);
      if(!el)return;
      el.addEventListener('change',()=>{state.filters[key]=cast?cast(el.value):el.value;refreshList(true);});
    };
    bind('#so-sector','sector');bind('#so-region','region');bind('#so-status','status');
    bind('#so-nature','nature');bind('#so-band','band');bind('#so-sort','sort');
    const q=document.querySelector('#so-q');
    if(q){
      q.addEventListener('input',()=>{
        window.clearTimeout(searchTimer);
        searchTimer=window.setTimeout(()=>{state.filters.q=q.value;auditSearch(q.value);refreshList(true);},280);
      });
    }
    document.querySelectorAll('[data-so-toggle]').forEach(b=>{
      b.addEventListener('click',()=>{
        const key=b.dataset.soToggle;
        state.filters[key]=!state.filters[key];
        refreshList(true);
      });
    });
    document.querySelector('#so-clear')?.addEventListener('click',()=>{
      state.filters={q:'',sector:'',region:'',status:'',nature:'',band:'',sanctioned:false,terminated:false,atypical:false,sort:'ipf'};
      refreshList(true);
    });
    wireList();
  }

  function wireList(){
    document.querySelectorAll('[data-so-rut]').forEach(b=>{
      b.addEventListener('click',()=>openDossier(b.dataset.soRut));
    });
    document.querySelector('#so-more')?.addEventListener('click',async()=>{
      if(state.loading)return;
      state.loading=true;renderListOnly();
      try{await loadPage(false);}catch(error){state.error=error?.message||String(error);}
      state.loading=false;renderListOnly();
    });
  }

  function setMode(mode){
    if(mode===state.mode)return;
    state.mode=mode;
    if(mode==='padron'&&!state.rows.length){refreshList(true);return;}
    render();
  }

  function applyFacet(key,value){
    const current=state.filters[key];
    state.filters[key]=current===value?'':value;
    state.mode='padron';
    refreshList(true);
  }

  async function refreshList(reset){
    state.mode='padron';
    state.loading=true;
    render();
    try{
      await loadPage(reset);
      state.error=null;
    }catch(error){
      state.error=error?.message||String(error);
    }
    state.loading=false;
    render();
  }

  async function openDossier(rut){
    if(!rut)return;
    state.mode='expediente';
    state.dossier={rut,loading:true,subject:null,events:[],peers:null,error:null};
    render();
    try{
      const client=db();
      const [{data,error},events]=await Promise.all([
        client.from(SUBJECTS).select('*').eq('rut',rut).maybeSingle(),
        loadSubjectEvents(rut)
      ]);
      if(error)throw error;
      if(!data)throw new Error('El sujeto obligado no está presente en el corte vigente del padrón.');
      const sector=(state.sectors||[]).find(s=>s.uaf_sector_canonical===data.uaf_sector_canonical)||null;
      state.dossier={rut,loading:false,subject:data,events,sector,error:null};
      audit('VIEW_OBLIGATED_SUBJECT',{objectType:'uaf_obligated_subject',objectId:rut,
        payload:{ipf:data.ipf_score,band:data.ipf_band,sector:data.uaf_sector_canonical,index_version:data.ipf_version}});
    }catch(error){
      state.dossier={rut,loading:false,subject:null,events:[],sector:null,error:error?.message||String(error)};
    }
    render();
  }

  function backToPadron(){
    state.mode=state.rows.length?'padron':'panorama';
    state.dossier=null;
    render();
  }

  /* ------------------------------------------------------------ auditoría */
  function audit(action,detail){
    try{
      if(typeof window.audit==='function')Promise.resolve(window.audit(action,detail)).catch(()=>{});
    }catch(_e){/* la auditoría nunca puede romper la lectura */}
  }
  function auditSearch(value){
    const text=String(value||'').trim();
    if(text.length<2)return;
    /* Igual que el resto del portal: se audita longitud, nunca el texto. */
    audit('SEARCH_OBLIGATED_SUBJECT',{objectType:'uaf_obligated_subject',objectId:'PADRON',payload:{length:text.length}});
  }

  /* ------------------------------------------------------------ navegación */
  function ensureNav(){
    const nav=document.querySelector('.v019-nav');
    if(!nav)return;
    if(nav.querySelector(`[data-view="${VIEW}"]`))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='v019-nav-btn';
    button.dataset.view=VIEW;
    button.textContent='Sujetos Obligados';
    /* La autoridad de navegación elimina el botón heredado 'uaf', así que el
       anclaje es 'entities'. El reordenamiento por grupos lo hace después
       atlas-current-ui.js: aquí sólo importa que el botón exista. */
    const anchor=nav.querySelector('[data-view="entities"]');
    if(anchor)anchor.insertAdjacentElement('afterend',button);
    else nav.appendChild(button);
    button.addEventListener('click',()=>window.navigate?.(VIEW));
    window.dispatchEvent(new CustomEvent('atlas:nav-refresh'));
  }

  async function load(){
    if(typeof window.shell==='function'){
      window.shell('Sujetos Obligados',
        'Caracterización del padrón inscrito en la UAF y priorización fiscalizadora explicable, con su evidencia y sus límites declarados.');
    }
    ensureNav();
    const host=content();
    if(host)host.innerHTML='<section class="so-root"><div class="so-loading">Consultando el padrón de sujetos obligados bajo la sesión autorizada…</div></section>';
    try{
      await loadPanorama(false);
      state.error=null;
      state.mode=state.mode==='expediente'?'expediente':state.mode;
      render();
      audit('VIEW_OBLIGATED_SUBJECTS',{objectType:'section',objectId:AUTHORITY,
        payload:{release:RELEASE,build:BUILD,index_version:state.overview?.index_version||'IPF-1.0',
                 subjects:state.overview?.registry?.subjects||null}});
    }catch(error){
      state.error=error?.message||String(error);
      render();
    }
  }

  const baseShell=typeof window.shell==='function'?window.shell:null;
  if(baseShell&&!window.shell.__atlasObligatedWrapped){
    const wrapped=function(...args){const r=baseShell.apply(this,args);ensureNav();return r;};
    wrapped.__atlasObligatedWrapped=true;
    window.shell=wrapped;
  }
  const baseNavigate=typeof window.navigate==='function'?window.navigate:null;
  if(baseNavigate&&!window.navigate.__atlasObligatedWrapped){
    const wrapped=async function(view,...rest){
      if(view===VIEW)return load();
      const r=await baseNavigate.call(this,view,...rest);
      ensureNav();
      return r;
    };
    wrapped.__atlasObligatedWrapped=true;
    window.navigate=wrapped;
  }

  window.__ATLAS_OBLIGATED__=Object.assign(window.__ATLAS_OBLIGATED__||{},{
    active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,view:VIEW,
    state,esc,fmt,pct,day,num,clamp,ipfBar,signature,signatureLegend,flagset,
    BANDS,BAND_LABEL,COMPONENTS,SII_STATUS,FLAG_META,
    open:openDossier,back:backToPadron,render,installedAt:new Date().toISOString()
  });

  if(document.querySelector('.v019-nav'))ensureNav();
})();
