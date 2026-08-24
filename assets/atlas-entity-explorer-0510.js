'use strict';

/* ATLAS AML 0.51.0 · build 0510 · Explorador de entidades
 *
 * Problema que corrige
 * --------------------
 * Hasta 0.50.0 la sección Entidades abría en un espacio vacío con un único
 * campo de texto. Para llegar a una entidad había que saber de antemano su
 * nombre, su RUT o su Entity ID. No existía exploración: ni facetas, ni
 * ordenamiento, ni lectura del conjunto resultante, ni previsualización. El
 * analista que llega con una pregunta ("sociedades de la Región de Tarapacá
 * con sanciones y cobertura multi-fuente") no tenía por dónde entrar.
 *
 * Qué hace en su lugar
 * --------------------
 * - Consulta gobernada por nombre multi-token, RUT normalizado o Entity ID,
 *   insensible a tildes, resuelta bajo la sesión y RLS vigentes.
 * - Facetas materializadas: territorio, tipo de entidad, condición UAF,
 *   condición sancionatoria y cobertura mínima de fuentes.
 * - Lectura del conjunto: cobertura, distribución territorial y condición,
 *   siempre declaradas sobre los resultados efectivamente cargados.
 * - Ficha rápida lateral con identidad, roles, contexto tributario, marcas
 *   IPA3 y recurrencia sancionatoria antes de abrir el expediente completo.
 *
 * Semántica deliberada
 * --------------------
 * - Cobertura de fuentes describe alcance de observación, no riesgo.
 * - IPA3 v0.4-shadow ordena revisión; no es probabilidad de LA/FT. Un puntaje
 *   cero significa "ninguna marca se activó" y se muestra como "—".
 * - La identidad no se promueve por similitud de nombre en ningún camino.
 * - El recuento total es una estimación del planificador; el recuento exacto
 *   que se afirma es el de filas cargadas.
 *
 * Seguridad: sólo lectura bajo la sesión y RLS existentes. No toca Auth, Entra
 * ni refresh tokens. Sin MutationObserver. Sin almacenamiento en el navegador.
 */
(function atlasEntityExplorer0510(){
  const RELEASE='0.51.0';
  const BUILD='0510';
  const AUTHORITY='ENTITY_EXPLORER_0510';
  const ENTRY=window.__ATLAS_ENTITY_ENTRY__;
  if(!ENTRY||typeof ENTRY.load!=='function'){
    window.__ATLAS_ENTITY_EXPLORER__={active:false,reason:'entity-entry-unavailable',installedAt:new Date().toISOString()};
    return;
  }

  const BASE_LOAD=ENTRY.load;
  const BASE_OPEN=typeof ENTRY.open==='function'?ENTRY.open:null;
  const TABLE='aml_entities';
  const REGION_VIEW='aml_v019_gap_region';
  const TAX_TABLE='aml_entity_tax_profile';
  const SCORE_SNAPSHOT='aml_ipa3_entity_score_snapshot_v0_4';
  const MARK_SNAPSHOT='aml_ipa3_mark_scores_snapshot_v0_4';
  const SANCTION_SUMMARY_VIEW='aml_v_ipa3_sanction_entity_summary';
  const PAGE=25;
  const LIST_COLUMNS='entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,updated_at';
  const TYPES=['Persona jurídica','OSFL','Organismo público','Tipo no resuelto'];
  const SORTS=[
    ['coverage','Cobertura de fuentes'],
    ['name','Razón social (A–Z)'],
    ['updated','Actualización del corte']
  ];
  const COVERAGE_STEPS=[['0','Sin mínimo'],['2','2 o más fuentes'],['3','3 o más fuentes'],['4','4 o más fuentes']];

  const ui={q:'',region:'',type:'',uaf:false,sanctioned:false,minSources:'0',sort:'coverage'};
  const scores=new Map();
  let rows=[];
  let planned=null;
  let loading=false;
  let exhausted=false;
  let seq=0;
  let sheetSeq=0;
  let active=false;
  let sheetEntity=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=(v,d=0)=>{const n=num(v);return n==null?'—':n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});};
  const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const term=v=>String(v??'').replace(/[%_,()*"']/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};
  const view=()=>{try{return typeof state!=='undefined'?state:(window.state||null);}catch(_error){return window.state||null;}};
  const host=()=>{try{return typeof v019Content==='function'?v019Content():document.querySelector('#content');}catch(_error){return document.querySelector('#content');}};
  /* El constructor de consultas de PostgREST es un thenable sin .catch(); una
     rechazada dentro de Promise.all tumbaría la ficha completa. */
  const soft=q=>Promise.resolve(q).then(v=>v,error=>({data:null,error}));
  const place=r=>[r?.commune,r?.region].filter(Boolean).join(' · ')||'territorio no materializado';

  /* Un RUT chileno se escribe de muchas formas y ninguna de ellas es la que
     está materializada. Se normaliza a la forma canónica 99999999-9 antes de
     consultar, de modo que la búsqueda no dependa de cómo lo escribió quien
     pregunta. */
  function normalizeRut(value){
    const raw=String(value??'').replace(/[.\s]/g,'').toUpperCase();
    if(!/^[0-9]+-?[0-9K]$/.test(raw))return null;
    if(raw.includes('-'))return raw;
    return `${raw.slice(0,-1)}-${raw.slice(-1)}`;
  }
  function queryMode(value){
    const raw=String(value??'').trim();
    if(!raw)return{mode:'empty'};
    if(/^ENT-/i.test(raw))return{mode:'entity_id',value:raw.toUpperCase()};
    if(/^[0-9][0-9.\s-]*[0-9K]$/i.test(raw)){
      const rut=normalizeRut(raw);
      return rut?{mode:'rut',value:rut}:{mode:'rut_partial',value:raw.replace(/[.\s-]/g,'')};
    }
    return{mode:'name',value:norm(raw).split(' ').filter(t=>t.length>1).slice(0,5)};
  }
  const MODE_LABEL={entity_id:'Entity ID',rut:'RUT canónico',rut_partial:'RUT parcial',name:'Razón social',empty:'Sin término'};

  function applyFilters(query){
    if(ui.region)query=query.eq('region',ui.region);
    if(ui.type)query=query.eq('entity_type',ui.type);
    if(ui.uaf)query=query.eq('is_uaf_observed',true);
    if(ui.sanctioned)query=query.eq('is_sanctioned',true);
    const min=num(ui.minSources);
    if(min)query=query.gte('source_count',min);
    const parsed=queryMode(ui.q);
    if(parsed.mode==='entity_id')query=query.ilike('entity_id',`${term(parsed.value)}%`);
    else if(parsed.mode==='rut')query=query.eq('rut',parsed.value);
    else if(parsed.mode==='rut_partial')query=query.ilike('rut',`${term(parsed.value)}%`);
    else if(parsed.mode==='name')for(const token of parsed.value)query=query.ilike('name',`%${term(token)}%`);
    return query;
  }
  function applySort(query){
    if(ui.sort==='name')return query.order('name',{ascending:true,nullsFirst:false});
    if(ui.sort==='updated')return query.order('updated_at',{ascending:false,nullsFirst:false});
    return query.order('source_count',{ascending:false,nullsFirst:false});
  }

  async function fetchPage(offset){
    const client=db();
    if(!client)throw new Error('Sesión de datos ATLAS no disponible');
    const options=offset===0?{count:'planned'}:undefined;
    let query=client.from(TABLE).select(LIST_COLUMNS,options);
    query=applySort(applyFilters(query)).range(offset,offset+PAGE-1);
    const {data,error,count}=await query;
    if(error)throw error;
    return{rows:data||[],count:count??null};
  }

  async function auditQuery(){
    try{
      if(typeof sha256!=='function'||typeof audit!=='function')return;
      const raw=term(ui.q);
      if(!raw)return;
      const hash=await sha256(raw.toLocaleLowerCase('es-CL'));
      await audit('SEARCH',{objectType:'entity',queryHash:hash,queryLength:raw.length,payload:{mode:'entity_explorer_0510',facets:{region:!!ui.region,type:!!ui.type,uaf:ui.uaf,sanctioned:ui.sanctioned,minSources:ui.minSources,sort:ui.sort}}});
    }catch(_error){}
  }

  /* El puntaje se lee del snapshot con clave primaria por entidad, no de la
     vista analítica: consultar la vista por entidad recomputa ventanas sobre
     todo el universo y tarda segundos. El snapshot declara su propio corte. */
  async function hydrateScores(ids){
    const pending=[...new Set(ids.filter(id=>id&&!scores.has(id)))];
    if(!pending.length)return;
    const client=db();
    if(!client)return;
    const {data,error}=await soft(client.from(SCORE_SNAPSHOT)
      .select('entity_id,ipa3_score,priority_band_shadow,score_confidence_pct,coverage_index_pct,dominant_mark_id,score_version,refreshed_at')
      .in('entity_id',pending));
    if(error)return;
    const found=new Map((data||[]).map(row=>[row.entity_id,row]));
    /* Ausente del corte no es cero: se registra como null y la celda declara
       que no hay marca materializada. */
    pending.forEach(id=>scores.set(id,found.get(id)||null));
    paintScores();
  }
  function bandClass(band){
    const key=String(band||'').toUpperCase();
    if(key==='MUY_ALTA')return'very-high';
    if(key==='ALTA')return'high';
    if(key==='MEDIA')return'medium';
    if(key==='BAJA')return'low';
    return'';
  }
  function bandLabel(band){
    return({MUY_ALTA:'Muy alta',ALTA:'Alta',MEDIA:'Media',BAJA:'Baja'})[String(band||'').toUpperCase()]||'Sin marca';
  }
  /* La regla de la casa: un IPA3 en cero significa que ninguna marca se activó.
     Eso es ausencia de marca, no prioridad baja, y se declara como "—". */
  function scoreCell(id){
    const score=scores.get(id);
    if(score===undefined)return`<b>·</b><small>consultando</small>`;
    const value=num(score?.ipa3_score);
    if(!score||value==null||value<=0)return`<b>—</b><small>sin marca</small>`;
    return`<b>${fmt(value,1)}</b><small class="${bandClass(score.priority_band_shadow)}">${esc(bandLabel(score.priority_band_shadow))}</small>`;
  }
  function paintScores(){
    document.querySelectorAll('[data-aex-band]').forEach(node=>{node.innerHTML=scoreCell(node.dataset.aexBand);});
  }

  /* ----------------------------- Render ----------------------------- */

  function universeBlock(){
    const withData=rows.length;
    const multi=rows.filter(r=>(num(r.source_count)||0)>=3).length;
    const uaf=rows.filter(r=>r.is_uaf_observed===true).length;
    const san=rows.filter(r=>r.is_sanctioned===true).length;
    return`<div class="aex-universe">
      <div><span>Resultados cargados</span><b>${fmt(withData)}</b><small>${planned==null?'sin estimación de total':'≈ '+fmt(planned)+' estimados por el planificador'}</small></div>
      <div><span>Cobertura 3+ fuentes</span><b>${fmt(multi)}</b><small>alcance de observación, no riesgo</small></div>
      <div><span>UAF observado</span><b>${fmt(uaf)}</b><small>registro materializado</small></div>
      <div><span>Con sanciones</span><b>${fmt(san)}</b><small>eventos administrativos</small></div>
    </div>`;
  }

  function facetsBlock(regions){
    const parsed=queryMode(ui.q);
    return`<section class="aex-query">
      <div class="aex-field">
        <div class="aex-input">
          <i aria-hidden="true">⌕</i>
          <input id="aex-q" type="search" autocomplete="off" spellcheck="false" value="${esc(ui.q)}"
            placeholder="Razón social, RUT (76.183.006-6) o Entity ID (ENT-RUT-…)"
            aria-label="Buscar entidad por razón social, RUT o Entity ID" />
          <button type="button" id="aex-clear" aria-label="Limpiar término">×</button>
        </div>
        <button type="button" class="aex-btn primary" id="aex-run">Buscar</button>
      </div>
      <div class="aex-mode">
        <b>${esc(MODE_LABEL[parsed.mode]||'Consulta')}</b>
        <span>${parsed.mode==='name'?'Todos los términos deben aparecer en la razón social. Insensible a tildes y mayúsculas.':parsed.mode==='rut'?'Coincidencia exacta sobre RUT canónico.':parsed.mode==='rut_partial'?'Prefijo de RUT; completa el dígito verificador para coincidencia exacta.':parsed.mode==='entity_id'?'Prefijo de identificador canónico ATLAS.':'Sin término: se listan entidades según las facetas activas.'}</span>
      </div>
      <div class="aex-facets">
        <div class="aex-facet"><label for="aex-region">Territorio</label>
          <select id="aex-region"><option value="">Todas las regiones</option>${regions.map(r=>`<option value="${esc(r.region)}" ${ui.region===r.region?'selected':''}>${esc(r.region)}${r.entity_universe!=null?` · ${fmt(r.entity_universe)}`:''}</option>`).join('')}</select>
        </div>
        <div class="aex-facet"><label for="aex-type">Tipo de entidad</label>
          <select id="aex-type"><option value="">Todos los tipos</option>${TYPES.map(t=>`<option value="${esc(t)}" ${ui.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
        </div>
        <div class="aex-facet"><label for="aex-min">Cobertura mínima</label>
          <select id="aex-min">${COVERAGE_STEPS.map(([v,l])=>`<option value="${v}" ${ui.minSources===v?'selected':''}>${esc(l)}</option>`).join('')}</select>
        </div>
        <div class="aex-facet"><label for="aex-sort">Ordenar por</label>
          <select id="aex-sort">${SORTS.map(([v,l])=>`<option value="${v}" ${ui.sort===v?'selected':''}>${esc(l)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="aex-toggles">
        <button type="button" class="aex-toggle uaf ${ui.uaf?'on':''}" id="aex-uaf" aria-pressed="${ui.uaf}"><i></i>UAF observado</button>
        <button type="button" class="aex-toggle san ${ui.sanctioned?'on':''}" id="aex-san" aria-pressed="${ui.sanctioned}"><i></i>Con sanciones</button>
        <button type="button" class="aex-reset" id="aex-reset">Restablecer criterios</button>
      </div>
    </section>`;
  }

  function barList(entries,total,note){
    if(!entries.length)return`<p class="aex-note">${esc(note||'Sin distribución observable.')}</p>`;
    const max=Math.max(1,...entries.map(e=>e[1]));
    return`<div class="aex-bars">${entries.map(([label,value])=>`<div class="aex-bar">
      <span title="${esc(label)}">${esc(label)}</span>
      <em class="rail"><i style="width:${Math.max(2,Math.round(value/max*100))}%"></i></em>
      <b>${fmt(value)}${total?` · ${Math.round(value/total*100)}%`:''}</b>
    </div>`).join('')}</div>`;
  }

  function profileBlock(){
    const total=rows.length;
    const buckets=[['1 fuente',0],['2 fuentes',0],['3 fuentes',0],['4 o más',0],['Sin dato',0]];
    for(const row of rows){
      const value=num(row.source_count);
      if(value==null){buckets[4][1]++;continue;}
      if(value>=4)buckets[3][1]++;
      else if(value===3)buckets[2][1]++;
      else if(value===2)buckets[1][1]++;
      else buckets[0][1]++;
    }
    const byRegion=new Map();
    for(const row of rows){
      const key=row.region||'Territorio no materializado';
      byRegion.set(key,(byRegion.get(key)||0)+1);
    }
    const regionRows=[...byRegion.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
    const both=rows.filter(r=>r.is_uaf_observed===true&&r.is_sanctioned===true).length;
    const onlyUaf=rows.filter(r=>r.is_uaf_observed===true&&r.is_sanctioned!==true).length;
    const onlySan=rows.filter(r=>r.is_sanctioned===true&&r.is_uaf_observed!==true).length;
    const neither=Math.max(0,total-both-onlyUaf-onlySan);
    const pct=v=>total?Math.round(v/total*1000)/10:0;
    return`<div class="aex-profile">
      <article class="aex-card">
        <h3>Cobertura observable</h3>
        ${barList(buckets.filter(b=>b[1]>0),total)}
        <p class="aex-note">Cuántas fuentes aportan hechos a cada entidad del resultado. Más fuentes es más contexto disponible, nunca más riesgo.</p>
      </article>
      <article class="aex-card">
        <h3>Distribución territorial</h3>
        ${barList(regionRows,total,'El resultado no tiene territorio materializado.')}
        <p class="aex-note">Sobre ${fmt(total)} fila(s) cargada(s). No describe el universo completo bajo los criterios activos.</p>
      </article>
      <article class="aex-card">
        <h3>Condición registral</h3>
        <div class="aex-stack-bar" role="img" aria-label="Composición de condición registral del resultado">
          ${both?`<i class="both" style="width:${pct(both)}%"></i>`:''}
          ${onlyUaf?`<i class="uaf" style="width:${pct(onlyUaf)}%"></i>`:''}
          ${onlySan?`<i class="san" style="width:${pct(onlySan)}%"></i>`:''}
        </div>
        <div class="aex-cond">
          <div class="aex-cond-row"><i class="uaf"></i><span>Sólo UAF observado</span><b>${fmt(onlyUaf)}</b></div>
          <div class="aex-cond-row"><i class="san"></i><span>Sólo con sanciones</span><b>${fmt(onlySan)}</b></div>
          <div class="aex-cond-row"><i class="both"></i><span>Ambas condiciones</span><b>${fmt(both)}</b></div>
          <div class="aex-cond-row"><i class="none"></i><span>Sin ninguna de las dos</span><b>${fmt(neither)}</b></div>
        </div>
        <p class="aex-note">Sin condición materializada no equivale a estar fuera del perímetro UAF ni a ausencia de eventos.</p>
      </article>
    </div>`;
  }

  function rowMarkup(row){
    const tags=[
      row.entity_type?`<span class="aex-tag type">${esc(row.entity_type)}</span>`:'',
      row.is_uaf_observed?'<span class="aex-tag uaf">UAF observado</span>':'',
      row.is_sanctioned?'<span class="aex-tag san">Con sanciones</span>':''
    ].filter(Boolean).join('');
    return`<div class="aex-row">
      <div class="aex-id">
        <b title="${esc(row.name||row.entity_id)}">${esc(row.name||row.entity_id)}</b>
        <span>${esc(row.rut||'RUT no materializado')}</span>
        <code>${esc(row.entity_id)}</code>
        ${tags?`<div class="aex-tags">${tags}</div>`:''}
      </div>
      <div class="aex-place">${esc(row.region||'Región no materializada')}<small>${esc(row.commune||'Comuna no materializada')}</small></div>
      <div class="aex-metrics">
        <div class="aex-metric"><b>${fmt(row.source_count)}</b><small>fuentes</small></div>
        <div class="aex-metric aex-band" data-aex-band="${esc(row.entity_id)}">${scoreCell(row.entity_id)}</div>
      </div>
      <div class="aex-actions">
        <button type="button" class="aex-act" data-aex-peek="${esc(row.entity_id)}">Ficha rápida</button>
        <button type="button" class="aex-act primary" data-aex-open="${esc(row.entity_id)}">Expediente</button>
      </div>
    </div>`;
  }

  function resultsBlock(error){
    let body;
    if(error)body=`<div class="aex-state error"><b>No fue posible resolver la consulta.</b>${esc(error)}</div>`;
    else if(loading&&!rows.length)body='<div class="aex-state">Resolviendo identidades bajo RLS…</div>';
    else if(!rows.length)body='<div class="aex-state"><b>Sin coincidencias bajo los criterios activos.</b>Prueba con menos términos, un RUT completo o retira una faceta. Ausencia de coincidencia no equivale a ausencia de la entidad.</div>';
    else body=rows.map(rowMarkup).join('');
    const more=rows.length&&!exhausted&&!error?`<div class="aex-more"><button type="button" class="aex-btn" id="aex-more" ${loading?'disabled':''}>${loading?'Cargando…':`Cargar ${PAGE} resultados más`}</button></div>`:'';
    return`<section class="aex-results">
      <div class="aex-results-head">
        <b>${rows.length?`${fmt(rows.length)} entidad(es) cargada(s)`:'Resultados'}</b>
        <span>${planned==null?'RLS activo · identidad primero':`RLS activo · ≈ ${fmt(planned)} coincidencias estimadas para los criterios activos`}</span>
      </div>
      ${body}
      ${more}
    </section>`;
  }

  function guardsBlock(){
    return`<div class="aex-guards">
      <div><b>Identidad ≠ similitud</b><span>RUT y Entity ID gobiernan los cruces sensibles; el nombre nunca promueve identidad por sí solo.</span></div>
      <div><b>Cobertura ≠ riesgo</b><span>Que una entidad aparezca en más fuentes describe observación disponible, no gravedad.</span></div>
      <div><b>Prioridad ≠ probabilidad</b><span>IPA3 v0.4-shadow ordena la cola de revisión; no estima probabilidad de LA/FT.</span></div>
      <div><b>Ausencia ≠ cero</b><span>Un dato no materializado se declara como vacío y nunca se completa con cero.</span></div>
    </div>`;
  }

  function shellMarkup(regions,error){
    return`<div class="aex">
      <header class="aex-head">
        <div>
          <span class="aex-eyebrow">ENTIDADES · EXPLORACIÓN GOBERNADA</span>
          <h2>Encuentra primero. Caracteriza después.</h2>
          <p>Consulta el universo de entidades materializadas por identidad, territorio, tipo, condición registral y cobertura de fuentes. Cada resultado abre una ficha rápida y, desde ella, el Expediente Analítico 360 completo.</p>
        </div>
        ${universeBlock()}
      </header>
      ${facetsBlock(regions)}
      ${profileBlock()}
      ${resultsBlock(error)}
      ${guardsBlock()}
      <div class="aex-scrim" id="aex-scrim"></div>
      <aside class="aex-sheet" id="aex-sheet" aria-hidden="true" aria-label="Ficha rápida de entidad">
        <header><div><span class="aex-eyebrow">FICHA RÁPIDA</span><h3 id="aex-sheet-title">—</h3><p id="aex-sheet-sub"></p></div><button type="button" id="aex-sheet-close" aria-label="Cerrar ficha">×</button></header>
        <div class="aex-sheet-body" id="aex-sheet-body"></div>
        <div class="aex-sheet-foot"><button type="button" class="aex-btn primary" id="aex-sheet-open">Abrir Expediente 360</button><button type="button" class="aex-btn" id="aex-sheet-dismiss">Cerrar</button></div>
      </aside>
    </div>`;
  }

  /* --------------------------- Ficha rápida --------------------------- */

  function closeSheet(){
    document.querySelector('#aex-sheet')?.classList.remove('open');
    document.querySelector('#aex-sheet')?.setAttribute('aria-hidden','true');
    document.querySelector('#aex-scrim')?.classList.remove('open');
    sheetEntity=null;
  }
  function sheetSection(title,inner){
    return`<section class="aex-block"><h4>${esc(title)}</h4>${inner}</section>`;
  }
  function chips(values){
    const list=values.filter(Boolean);
    return list.length?`<div class="aex-chips">${list.map(v=>`<span class="aex-chip">${esc(v)}</span>`).join('')}</div>`:'<p class="aex-empty">No materializado en el corte actual.</p>';
  }
  function marksBlock(marks){
    if(!marks.length)return'<p class="aex-empty">Ninguna marca IPA3 activa. Ausencia de marca no equivale a prioridad baja.</p>';
    const max=Math.max(...marks.map(m=>Number(m.contribution)||0),1);
    return`<div class="aex-bars">${marks.map(m=>`<div class="aex-bar">
      <span title="${esc(m.mark_name||m.mark_id)}">${esc(m.mark_id)} · ${esc(m.mark_name||'Marca')}</span>
      <em class="rail"><i style="width:${Math.max(2,Math.round((Number(m.contribution)||0)/max*100))}%"></i></em>
      <b>${fmt(m.contribution,1)}</b>
    </div>`).join('')}</div>`;
  }
  async function openSheet(entityId){
    const row=rows.find(r=>r.entity_id===entityId);
    if(!row)return;
    sheetEntity=entityId;
    const sheet=document.querySelector('#aex-sheet'),scrim=document.querySelector('#aex-scrim'),body=document.querySelector('#aex-sheet-body');
    if(!sheet||!body)return;
    document.querySelector('#aex-sheet-title').textContent=row.name||row.entity_id;
    document.querySelector('#aex-sheet-sub').textContent=`${row.rut||'RUT no materializado'} · ${row.entity_id}`;
    body.innerHTML='<p class="aex-empty">Consultando perfil gobernado…</p>';
    sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');scrim?.classList.add('open');
    const client=db();
    if(!client){body.innerHTML='<p class="aex-empty">Sesión de datos no disponible.</p>';return;}
    const token=++sheetSeq;
    const [profileRes,taxRes,markRes,sanctionRes,scoreRes]=await Promise.all([
      soft(client.from(TABLE).select('profile,snapshot_id,updated_at').eq('entity_id',entityId).maybeSingle()),
      soft(client.from(TAX_TABLE).select('commercial_year,current_status,taxpayer_type,economic_sector,main_activity,sales_band,workers_numeric,activity_start_date,address_count,activity_count,signal_types').eq('entity_id',entityId).maybeSingle()),
      soft(client.from(MARK_SNAPSHOT).select('mark_id,mark_name,primary_dimension,score_group,contribution,confidence,readiness').eq('entity_id',entityId).eq('included_in_score',true).order('contribution',{ascending:false}).limit(6)),
      soft(client.from(SANCTION_SUMMARY_VIEW).select('sanction_event_count,sanction_count_36m,regulators,laft_direct_count,latest_sanction_date,min_identity_confidence').eq('entity_id',entityId).maybeSingle()),
      soft(client.from(SCORE_SNAPSHOT).select('*').eq('entity_id',entityId).maybeSingle())
    ]);
    if(token!==sheetSeq||sheetEntity!==entityId)return;
    const profile=profileRes?.data?.profile||{};
    const tax=taxRes?.data||null;
    const marks=Array.isArray(markRes?.data)?markRes.data:[];
    const sanction=sanctionRes?.data||null;
    const score=scoreRes?.data||null;
    scores.set(entityId,score);
    const value=num(score?.ipa3_score);
    const sections=[];
    sections.push(sheetSection('Identidad y procedencia',`<dl class="aex-dl">
      <dt>Entity ID</dt><dd>${esc(row.entity_id)}</dd>
      <dt>RUT</dt><dd>${esc(row.rut||'no materializado')}</dd>
      <dt>Método de identidad</dt><dd>${esc(profile.identity_method_es||profile.identity_method||'no declarado')}</dd>
      <dt>Confianza de identidad</dt><dd>${profile.identity_confidence==null?'—':fmt(profile.identity_confidence,2)}</dd>
      <dt>Territorio</dt><dd>${esc(place(row))}</dd>
      <dt>Corte</dt><dd>${esc(String(profileRes?.data?.updated_at||row.updated_at||'—').slice(0,10))}</dd>
    </dl>`));
    sections.push(sheetSection('Roles y fuentes observadas',`${chips(arr(profile.roles_es).concat(arr(profile.fuentes)))}`));
    sections.push(sheetSection('Prioridad analítica IPA3 v0.4-shadow',
      `<dl class="aex-dl"><dt>Puntaje</dt><dd>${value==null||value<=0?'— · ninguna marca activa':fmt(value,1)}</dd>
      <dt>Banda</dt><dd>${value==null||value<=0?'—':esc(bandLabel(score?.priority_band_shadow))}</dd>
      <dt>Confianza</dt><dd>${score?.score_confidence_pct==null?'—':fmt(score.score_confidence_pct,0)+'%'}</dd>
      <dt>Cobertura del cálculo</dt><dd>${score?.coverage_index_pct==null?'—':fmt(score.coverage_index_pct,0)+'%'}</dd></dl>
      ${marksBlock(marks)}
      <p class="aex-note">Prioridad analítica; no es probabilidad de LA/FT ni gravedad acreditada.</p>`));
    sections.push(sheetSection('Situación tributaria observada',tax?`<dl class="aex-dl">
      <dt>Año comercial</dt><dd>${esc(tax.commercial_year||'—')}</dd>
      <dt>Estado</dt><dd>${esc(tax.current_status||'—')}</dd>
      <dt>Tipo de contribuyente</dt><dd>${esc(tax.taxpayer_type||'—')}</dd>
      <dt>Sector económico</dt><dd>${esc(tax.economic_sector||'—')}</dd>
      <dt>Actividad principal</dt><dd>${esc(tax.main_activity||'—')}</dd>
      <dt>Tramo de ventas</dt><dd>${esc(tax.sales_band||'—')}</dd>
      <dt>Trabajadores</dt><dd>${fmt(tax.workers_numeric)}</dd>
      <dt>Inicio de actividades</dt><dd>${esc(tax.activity_start_date||'—')}</dd>
    </dl><p class="aex-note">El tramo de ventas es un rango publicado, no el monto exacto de ventas.</p>`:'<p class="aex-empty">Sin perfil tributario materializado para esta entidad.</p>'));
    sections.push(sheetSection('Eventos sancionatorios',sanction?`<dl class="aex-dl">
      <dt>Eventos resueltos</dt><dd>${fmt(sanction.sanction_event_count)}</dd>
      <dt>Últimos 36 meses</dt><dd>${fmt(sanction.sanction_count_36m)}</dd>
      <dt>Reguladores</dt><dd>${esc(arr(sanction.regulators).join(' · ')||'—')}</dd>
      <dt>Vínculo LA/FT directo</dt><dd>${fmt(sanction.laft_direct_count)}</dd>
      <dt>Último evento</dt><dd>${esc(sanction.latest_sanction_date||'—')}</dd>
      <dt>Confianza mínima de identidad</dt><dd>${sanction.min_identity_confidence==null?'—':fmt(sanction.min_identity_confidence,2)}</dd>
    </dl><div class="aex-caution"><b>Alcance.</b> Una sanción administrativa no acredita por sí sola lavado de activos, financiamiento del terrorismo ni delito.</div>`:'<p class="aex-empty">Sin eventos sancionatorios resueltos contra esta identidad.</p>'));
    if(arr(profile?.contexto?.sii_flags_es).length)sections.push(sheetSection('Señales estructurales SII',chips(arr(profile.contexto.sii_flags_es))));
    body.innerHTML=sections.join('');
  }

  /* ------------------------------ Ciclo ------------------------------ */

  let regionsCache=null;
  async function regions(){
    if(regionsCache)return regionsCache;
    const client=db();
    if(!client)return[];
    try{
      const {data,error}=await client.from(REGION_VIEW).select('region,entity_universe').order('entity_universe',{ascending:false});
      if(error)throw error;
      regionsCache=(data||[]).filter(r=>r.region);
    }catch(_error){regionsCache=[];}
    return regionsCache;
  }

  async function render(error){
    const content=host();
    if(!content||!active)return;
    content.innerHTML=shellMarkup(await regions(),error);
    bind();
    void hydrateScores(rows.map(r=>r.entity_id));
    window.__ATLAS_ENTITY360_CURRENT__={...(window.__ATLAS_ENTITY360_CURRENT__||{}),release:RELEASE,build:BUILD,authority:AUTHORITY,mode:'explorer',loadedRows:rows.length,renderedAt:new Date().toISOString()};
  }

  async function run(reset=true){
    if(loading)return;
    loading=true;
    if(reset){rows=[];planned=null;exhausted=false;}
    await render(null);
    const token=++seq;
    try{
      const result=await fetchPage(reset?0:rows.length);
      if(token!==seq)return;
      rows=reset?result.rows:rows.concat(result.rows);
      if(reset)planned=result.count;
      exhausted=result.rows.length<PAGE;
      loading=false;
      await render(null);
      if(reset)void auditQuery();
    }catch(error){
      if(token!==seq)return;
      loading=false;
      await render(String(error?.message||error));
    }
  }

  function bind(){
    const input=document.querySelector('#aex-q');
    if(input){
      input.addEventListener('input',()=>{ui.q=input.value;});
      input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();ui.q=input.value;void run(true);}});
    }
    document.querySelector('#aex-run')?.addEventListener('click',()=>{ui.q=document.querySelector('#aex-q')?.value||'';void run(true);});
    document.querySelector('#aex-clear')?.addEventListener('click',()=>{ui.q='';void run(true);});
    document.querySelector('#aex-region')?.addEventListener('change',event=>{ui.region=event.target.value;void run(true);});
    document.querySelector('#aex-type')?.addEventListener('change',event=>{ui.type=event.target.value;void run(true);});
    document.querySelector('#aex-min')?.addEventListener('change',event=>{ui.minSources=event.target.value;void run(true);});
    document.querySelector('#aex-sort')?.addEventListener('change',event=>{ui.sort=event.target.value;void run(true);});
    document.querySelector('#aex-uaf')?.addEventListener('click',()=>{ui.uaf=!ui.uaf;void run(true);});
    document.querySelector('#aex-san')?.addEventListener('click',()=>{ui.sanctioned=!ui.sanctioned;void run(true);});
    document.querySelector('#aex-reset')?.addEventListener('click',()=>{
      ui.q='';ui.region='';ui.type='';ui.uaf=false;ui.sanctioned=false;ui.minSources='0';ui.sort='coverage';
      void run(true);
    });
    document.querySelector('#aex-more')?.addEventListener('click',()=>{void run(false);});
    document.querySelectorAll('[data-aex-peek]').forEach(button=>button.addEventListener('click',()=>void openSheet(button.dataset.aexPeek)));
    document.querySelectorAll('[data-aex-open]').forEach(button=>button.addEventListener('click',()=>void open(button.dataset.aexOpen)));
    document.querySelector('#aex-sheet-close')?.addEventListener('click',closeSheet);
    document.querySelector('#aex-sheet-dismiss')?.addEventListener('click',closeSheet);
    document.querySelector('#aex-scrim')?.addEventListener('click',closeSheet);
    document.querySelector('#aex-sheet-open')?.addEventListener('click',()=>{const id=sheetEntity;closeSheet();if(id)void open(id);});
  }

  async function open(entityId){
    if(!entityId)return;
    active=false;
    closeSheet();
    if(BASE_OPEN)return BASE_OPEN(entityId);
    if(typeof window.openEntity==='function')return window.openEntity(entityId);
  }

  async function load(...args){
    const current=view();
    if(current){current.view='entities';current.selectedEntity=null;}
    if(typeof shell==='function')shell('Entidades','Exploración gobernada de identidades: búsqueda, facetas, lectura del conjunto y Expediente Analítico 360.');
    /* El conmutador persistente 0447 pertenece al expediente abierto. En el
       explorador sería un segundo buscador compitiendo con el propio. Se retira
       aquí y 0447 vuelve a montarlo al renderizar una entidad. */
    document.querySelector('#a47-entity-search-host')?.remove();
    active=true;
    void args;
    await run(true);
    setTimeout(()=>document.querySelector('#aex-q')?.focus(),0);
    return Promise.resolve();
  }

  ENTRY.load=load;
  ENTRY.explorer={open,run:()=>run(true),state:()=>({...ui})};
  ENTRY.explorerPolicy='MULTI_TOKEN_ACCENT_INSENSITIVE+CANONICAL_RUT+GOVERNED_FACETS+NO_FUZZY_IDENTITY_JOIN';
  ENTRY.legacyEmptyWorkspace=BASE_LOAD;
  try{loadEntities=load;}catch(_error){}
  window.loadEntities=load;

  window.__ATLAS_ENTITY_EXPLORER__={
    active:true,
    release:RELEASE,
    build:BUILD,
    authority:AUTHORITY,
    table:TABLE,
    scoreSource:SCORE_SNAPSHOT,
    markSource:MARK_SNAPSHOT,
    pageSize:PAGE,
    facets:['region','entity_type','is_uaf_observed','is_sanctioned','source_count'],
    countPolicy:'PLANNED_ESTIMATE_LABELLED_EXACT_LOADED_ONLY',
    cachePolicy:'MEMORY_ONLY',
    authMutation:false,
    installedAt:new Date().toISOString()
  };
})();
