'use strict';

(function installAtlasEntity360Parity(global) {
  if (global.__ATLAS_V2_ENTITY360_PARITY_SURFACE__) return;
  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const NF = new Intl.NumberFormat('es-CL');
  let renderSerial = 0;
  let searchSerial = 0;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if (v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, String(v));
    });
    (Array.isArray(children)?children:[children]).forEach(c => { if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c))); });
    return el;
  }
  function clear(el){ while(el?.firstChild) el.removeChild(el.firstChild); }
  function injectStyle(){
    if(document.getElementById('atlas-v2-e360-parity-style')) return;
    const link=document.createElement('link'); link.id='atlas-v2-e360-parity-style'; link.rel='stylesheet'; link.href=new URL('entity360-parity-surface.css?v=1',scriptBase).href; document.head.append(link);
  }
  function txt(v){ return String(v ?? '').trim(); }
  function num(v){ const n=Number(v); return Number.isFinite(n)?n:null; }
  function fmt(v,d=0){ const n=num(v); return n==null?'—':n.toLocaleString('es-CL',{maximumFractionDigits:d}); }
  function pct(v){ const n=num(v); return n==null?'—':`${Math.round((n<=1?n:n/100)*100)}%`; }
  function dateLabel(event){ return event?.event_date || (event?.event_year ? String(event.event_year) : 'Fecha no informada'); }
  function safeUrl(value){ try{ const u=new URL(String(value||'')); return ['http:','https:'].includes(u.protocol)?u.href:''; }catch{return '';} }
  function sourceLabel(s){ return ({SII:'SII',RES:'RES',SANCIONES:'Sanciones',RADAR_PRENSA:'Radar Prensa',PRESS:'Radar Prensa',UAF_NAME:'UAF',CANONICAL:'Entidad'})[String(s||'').toUpperCase()]||txt(s)||'Fuente'; }
  function matchLabel(t){ return ({rut_exact:'RUT exacto',name_exact:'Nombre exacto',name_prefix:'Prefijo de nombre',name_fuzzy:'Nombre similar',alias_exact:'Denominación UAF exacta',alias_prefix:'Denominación UAF relacionada'})[t]||'Coincidencia'; }
  function rule(text){ return node('div',{class:'e360p-rule'},[node('strong',{text:'Regla de lectura. '}),text]); }
  function badge(textValue,tone=''){ return node('span',{class:`e360p-badge ${tone}`.trim(),text:textValue}); }
  function sectionHead(kicker,title,body=''){ return node('header',{class:'e360p-section-head'},[node('div',{},[node('span',{class:'e360p-kicker',text:kicker}),node('h2',{text:title}),body?node('p',{text:body}):null])]); }

  function resultRow(api,item){
    const press=String(item.matchSource||'').toUpperCase()==='PRESS' || (item.sources||[]).includes('RADAR_PRENSA');
    const unresolved=press&&!item.rut;
    return node('button',{type:'button',class:`e360p-result ${unresolved?'press-only':''}`,onclick:()=>api.navigate('entidad',{entity_id:item.entityId,...(item.rut?{rut:item.rut}:{}),q:item.name||item.matchedLabel||''})},[
      node('div',{class:'e360p-result-main'},[
        node('div',{class:'e360p-result-tags'},[badge(press?'Radar Prensa':'Entidad',press?'press':''), item.registryClass?badge(item.registryClass,'uaf'):null, unresolved?badge('Sin RUT resuelto','warn'):null]),
        node('strong',{text:item.name||item.matchedLabel||'Entidad sin etiqueta'}),
        node('span',{text:[item.rut,item.entityType,item.commune,item.region].filter(Boolean).join(' · ')||'Identidad observada en fuente; sin RUT canónico.'}),
        item.matchedLabel&&item.matchedLabel!==item.name?node('small',{text:`Coincidió como: ${item.matchedLabel}`}):null,
      ]),
      node('div',{class:'e360p-result-meta'},[
        node('b',{text:matchLabel(item.matchType)}),
        node('span',{text:`${Math.round(Number(item.matchScore||0)*100)}% similitud`}),
        node('small',{text:`${fmt(item.sourceCount||item.sources?.length)} fuente(s) · ${fmt(item.eventCount)} evento(s)`}),
      ]),
    ]);
  }

  function facetBar(items,listHost){
    const filters={source:'TODAS',type:'TODOS'};
    const sources=[...new Set(items.map(x=>String(x.matchSource||'CANONICAL').toUpperCase()))];
    const types=[...new Set(items.map(x=>x.entityType).filter(Boolean))].slice(0,6);
    const wrap=node('div',{class:'e360p-facets'});
    function paint(){
      clear(listHost); const visible=items.filter(x=>(filters.source==='TODAS'||String(x.matchSource||'CANONICAL').toUpperCase()===filters.source)&&(filters.type==='TODOS'||x.entityType===filters.type));
      visible.forEach(x=>listHost.append(resultRow(global.AtlasV2Shell,x)));
      if(!visible.length) listHost.append(node('div',{class:'atlas-v2-empty'},[node('strong',{text:'Sin coincidencias para este filtro'}),node('span',{text:'El filtro sólo actúa sobre las coincidencias cargadas; no redefine identidad.'})]));
    }
    const sourceGroup=node('div',{class:'e360p-facet-group'},[node('span',{text:'Fuente'})]);
    ['TODAS',...sources].forEach(s=>{const b=node('button',{type:'button',class:s==='TODAS'?'active':'',text:s==='TODAS'?'Todas':sourceLabel(s),onclick:()=>{filters.source=s;sourceGroup.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));paint();}});sourceGroup.append(b);});
    const typeGroup=node('div',{class:'e360p-facet-group'},[node('span',{text:'Tipo'})]);
    ['TODOS',...types].forEach(s=>{const b=node('button',{type:'button',class:s==='TODOS'?'active':'',text:s==='TODOS'?'Todos':s,onclick:()=>{filters.type=s;typeGroup.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));paint();}});typeGroup.append(b);});
    wrap.append(sourceGroup,typeGroup); paint(); return wrap;
  }

  async function searchEntities(api,q,host,serial){
    clear(host); host.append(node('div',{class:'e360p-loading',text:'Buscando en identidad canónica, denominaciones UAF y Radar Prensa…'}));
    try{
      const out=await global.AtlasV2EntitySearch.search(q,{limit:40,route:'entidad:parity-search'});
      if(serial!==searchSerial||!host.isConnected)return;
      clear(host); const items=out.items||[];
      if(!items.length){host.append(node('div',{class:'atlas-v2-empty'},[node('strong',{text:'Sin coincidencias'}),node('span',{text:'Prueba otra denominación, RUT o alias. Ausencia en el índice no confirma inexistencia.'})]));return;}
      const list=node('div',{class:'e360p-results'});
      host.append(node('div',{class:'e360p-search-summary'},[node('strong',{text:`${fmt(items.length)} coincidencia(s)`}),node('span',{text:'Coincidencia ≠ identidad confirmada. Orden por calidad de resolución, no por riesgo.'})]),facetBar(items,list),list);
    }catch(error){if(serial!==searchSerial)return;clear(host);host.append(node('div',{class:'e360p-error'},[node('strong',{text:'No fue posible completar la búsqueda'}),node('span',{text:String(error?.message||error)})]));}
  }

  function entitySearch(api,initial=''){
    const results=node('div',{class:'e360p-search-results'}); const input=node('input',{type:'search',value:initial,placeholder:'Razón social, nombre, RUT, denominación UAF o entidad en prensa…',autocomplete:'off'}); let timer=null;
    const run=()=>{const q=input.value.trim();if(q.length<2){clear(results);return;}const serial=++searchSerial;void searchEntities(api,q,results,serial);};
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,220);}); input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();}});
    if(initial.trim().length>=2)setTimeout(run,0);
    return node('div',{class:'e360p-search-mode'},[
      node('div',{class:'e360p-command'},[input,node('button',{type:'button',class:'atlas-v2-button primary',text:'Buscar',onclick:run})]),results,
    ]);
  }

  function digitalDiscovery(){
    const host=node('div',{class:'e360p-digital-host'}); const input=node('input',{type:'search',placeholder:'Username, nickname o alias público…',autocomplete:'off'});
    async function run(depth){
      const alias=input.value.trim(); if(alias.length<2){clear(host);host.append(node('div',{class:'atlas-v2-empty'},[node('strong',{text:'Ingresa un alias'}),node('span',{text:'Atlas no transforma automáticamente nombres de personas o empresas en usernames.'})]));return;}
      clear(host);host.append(node('div',{class:'e360p-loading',text:depth==='deep'?'Profundizando identidad digital…':'Consultando identidad digital…'}));
      try{const out=await global.AtlasV2Entity360Parity.digital(alias,depth);renderDigital(host,alias,out);}catch(e){clear(host);host.append(node('div',{class:'e360p-error'},[node('strong',{text:'Exploración digital no disponible'}),node('span',{text:String(e?.message||e)})]));}
    }
    return node('div',{class:'e360p-digital-search'},[
      node('div',{class:'e360p-command'},[input,node('button',{type:'button',class:'atlas-v2-button',text:'Búsqueda rápida',onclick:()=>void run('quick')}),node('button',{type:'button',class:'atlas-v2-button primary',text:'Profundizar',onclick:()=>void run('deep')})]),
      node('p',{class:'e360p-help',text:'Sherlock + WhatsMyName; profundización incorpora Maigret y aliases derivados cuando corresponde. Consulta live, no persistente.'}),host,
    ]);
  }

  function renderDigital(host,alias,out){
    clear(host); const data=out?.base?.data||out?.base||{}; const records=Array.isArray(data?.records)?data.records:[]; const analytics=data?.analytics||{}; const health=data?.engine_health||{};
    host.append(node('div',{class:'e360p-kpi-row'},[
      metric('Comprobaciones',fmt(analytics.tested)),metric('Perfiles observados',fmt(analytics.profiles)),metric('Coincidencias 2+ motores',fmt(analytics.consensus_2plus)),metric('Aliases derivados',fmt(analytics.derived_aliases)),
    ]));
    const engines=node('div',{class:'e360p-engine-row'});Object.entries(health).forEach(([k,v])=>engines.append(badge(`${k} · ${v}`,v==='ready'?'ok':v==='degraded'?'warn':'')));host.append(engines);
    const deepData=out?.deep?.data||out?.deep||null; const derived=[...(data?.derived?.aliases||[]),...(deepData?.derived?.aliases||[])].filter(Boolean); if(derived.length)host.append(node('div',{class:'e360p-derived'},[node('strong',{text:'Aliases derivados'}),node('span',{text:[...new Set(derived)].slice(0,16).join(' · ')})]));
    const grid=node('div',{class:'e360p-profile-grid'});records.slice(0,40).forEach(r=>{const url=safeUrl(r.source_url);const engines=r?.evidence?.engines||[];grid.append(node(url?'a':'article',{class:'e360p-profile',...(url?{href:url,target:'_blank',rel:'noopener noreferrer'}:{})},[node('strong',{text:r?.evidence?.platform||r.title||'Perfil'}),node('span',{text:`@${r?.evidence?.username||alias}`}),node('small',{text:`${engines.join(' + ')||'Motor único'} · ${pct(r.match_confidence)} · posible coincidencia`})]));});
    host.append(grid,rule('Una coincidencia técnica de username no acredita identidad. Requiere corroboración independiente y no modifica IPA3.'));
  }

  function metric(label,value,detail=''){return node('div',{class:'e360p-metric'},[node('span',{text:label}),node('strong',{text:value||'—'}),detail?node('small',{text:detail}):null]);}
  function hero(ref,intel){
    const base=intel?.base||{}; const identity=base?.identity||{}; const profile=identity?.profile||{}; const name=identity?.name||identity?.legal_name||identity?.razon_social||profile?.nombre||ref.name||'Entidad'; const resolvedRut=intel?.resolved_rut||identity?.rut||ref.rut||''; const sources=profile?.fuentes||[];
    return node('section',{class:'e360p-hero'},[
      node('div',{class:'e360p-hero-copy'},[node('span',{class:'e360p-kicker',text:'ENTIDAD 360 · EXPEDIENTE ANALÍTICO'}),node('h1',{text:name}),node('p',{text:[resolvedRut||'Sin RUT resuelto',identity?.entity_type||profile?.tipo_entidad_es,identity?.region||profile?.ubicacion?.region].filter(Boolean).join(' · ')}),node('div',{class:'e360p-tags'},sources.map(s=>badge(String(s).replace(/^RADAR_/,''))))]),
      node('div',{class:'e360p-hero-metrics'},[metric('Fuentes',fmt(sources.length||Object.values(base?.source_status||{}).filter(x=>x==='AVAILABLE').length)),metric('Eventos',fmt(profile?.event_count)),metric('Confianza identidad',profile?.identity_confidence!=null?pct(profile.identity_confidence):'—')]),
    ]);
  }

  function trajectory(intel,onYear){
    const history=Array.isArray(intel?.base?.history)?intel.base.history.slice().sort((a,b)=>Number(a.commercial_year)-Number(b.commercial_year)):[]; const wrap=node('section',{class:'e360p-card e360p-trajectory'},[sectionHead('SII','Trayectoria económica','Series anuales; el año representa el período comercial, no una fecha exacta.')]);
    if(!history.length){wrap.append(node('div',{class:'atlas-v2-empty',text:'Sin trayectoria SII materializada.'}));return wrap;}
    const sales=history.map(x=>({label:String(x.commercial_year),value:Number(x.sales_band_rank||0),display:x.sales_band_code||'—',raw:x})); const workers=history.map(x=>({label:String(x.commercial_year),value:Number(x.workers_numeric||0),display:fmt(x.workers_numeric),raw:x}));
    wrap.append(node('div',{class:'e360p-chart-grid'},[
      node('div',{},[node('h3',{text:'Tramo de ventas'}),global.AtlasV2Viz.lineChart(sales,{limit:16,onSelect:r=>onYear?.(r.raw),caption:'Haz clic en un año para inspeccionar el registro.'})]),
      node('div',{},[node('h3',{text:'Trabajadores'}),global.AtlasV2Viz.lineChart(workers,{limit:16,onSelect:r=>onYear?.(r.raw),caption:'Dotación declarada/observada en el corte SII.'})]),
    ]));return wrap;
  }

  function latestPeer(intel){const p=Array.isArray(intel?.peers)?intel.peers[0]:null;if(!p)return node('div',{class:'atlas-v2-empty',text:'Sin posición de pares materializada.'});return node('div',{class:'e360p-peer-grid'},[metric('Grupo comparable',p.peer_level||'—',p.size_bucket||''),metric('N del grupo',fmt(p.peer_n)),metric('Ventas vs pares',p.sales_peer_percentile!=null?`p${Math.round(Number(p.sales_peer_percentile)*100)}`:'—','Posición relativa, no desempeño'),metric('Trabajadores vs pares',p.workers_peer_percentile!=null?`p${Math.round(Number(p.workers_peer_percentile)*100)}`:'—','Posición relativa, no riesgo')]);}
  function marks(intel){const rows=(intel?.marks||[]).slice(0,10);const wrap=node('section',{class:'e360p-card'},[sectionHead('IPA3','Marcas explicables','Prioridad analítica; no probabilidad de LA/FT.')]);if(!rows.length){wrap.append(node('div',{class:'atlas-v2-empty',text:'Ninguna marca activa en el corte.'}));return wrap;}wrap.append(global.AtlasV2Viz.horizontalBars(rows.map(r=>({label:r.mark_label||r.mark_code,detail:r.mark_group,value:Number(r.contribution||0),display:fmt(r.contribution,1),raw:r})),{limit:10}));return wrap;}

  function timelineView(intel){
    const all=Array.isArray(intel?.timeline)?intel.timeline:[]; const wrap=node('section',{class:'e360p-card e360p-timeline-card'},[sectionHead('CRONOLOGÍA','Línea de tiempo multifuente','SII, RES, sanciones y prensa permanecen diferenciados por fuente.')]); const controls=node('div',{class:'e360p-timeline-filters'}),list=node('div',{class:'e360p-timeline'});let active='TODAS';
    function paint(){clear(list);const rows=all.filter(e=>active==='TODAS'||String(e.source).toUpperCase()===active);rows.slice(0,120).forEach(e=>{const url=safeUrl(e.source_url);list.append(node('article',{class:`e360p-event source-${String(e.source||'').toLowerCase()}`},[node('div',{class:'e360p-event-dot'}),node('div',{class:'e360p-event-body'},[node('div',{class:'e360p-event-head'},[badge(sourceLabel(e.source)),node('time',{text:dateLabel(e)})]),node('strong',{text:e.title||e.event_type||'Evento'}),e.summary?node('p',{text:e.summary}):null,url?node('a',{class:'e360p-doc-link',href:url,target:'_blank',rel:'noopener noreferrer',text:'Abrir evidencia / documento ↗'}):null]) ]));});if(!rows.length)list.append(node('div',{class:'atlas-v2-empty',text:'Sin eventos para esta fuente.'}));}
    const sources=['TODAS',...new Set(all.map(e=>String(e.source||'').toUpperCase()).filter(Boolean))];sources.forEach(s=>{const b=node('button',{type:'button',class:s==='TODAS'?'active':'',text:s==='TODAS'?'Todas':sourceLabel(s),onclick:()=>{active=s;controls.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));paint();}});controls.append(b);});paint();wrap.append(controls,list,rule('Los eventos SII con sólo año se muestran como período anual; Atlas no inventa una fecha exacta.'));return wrap;
  }

  function documentsView(intel){
    const res=intel?.documents||[], sanc=intel?.sanction_evidence||[];const wrap=node('section',{class:'e360p-card'},[sectionHead('EVIDENCIA','Documentos y fuentes','Interacción directa con evidencia pública cuando la fuente entrega una URL.')]);const grid=node('div',{class:'e360p-doc-grid'});
    res.forEach(d=>{const url=safeUrl(d.source_url);grid.append(node('article',{class:'e360p-document'},[node('div',{class:'e360p-doc-top'},[badge('RES'),node('time',{text:d.actuation_date||d.registry_date||'Fecha no informada'})]),node('strong',{text:d.document_title||d.document_type||'Documento RES'}),node('span',{text:[d.actuation_type,d.cve?`CVE ${d.cve}`:'',d.review_status].filter(Boolean).join(' · ')}),url?node('a',{href:url,target:'_blank',rel:'noopener noreferrer',class:'atlas-v2-button',text:'Abrir documento ↗'}):node('small',{text:'URL pública no materializada'})]));});
    sanc.forEach(d=>{const url=safeUrl(d.source_url);grid.append(node('article',{class:'e360p-document'},[node('div',{class:'e360p-doc-top'},[badge('Sanciones'),node('time',{text:txt(d.published_at).slice(0,10)||'Fecha no informada'})]),node('strong',{text:d.source_id||'Evidencia sancionatoria'}),d.excerpt?node('p',{text:d.excerpt}):null,url?node('a',{href:url,target:'_blank',rel:'noopener noreferrer',class:'atlas-v2-button',text:'Abrir fuente ↗'}):null]));});
    if(!res.length&&!sanc.length)grid.append(node('div',{class:'atlas-v2-empty',text:'No hay documentos materializados para esta entidad en los cortes disponibles.'}));wrap.append(grid);return wrap;
  }

  function relationsView(api,intel,ref){const links=intel?.identity_links||[];const wrap=node('section',{class:'e360p-card'},[sectionHead('IDENTIDAD','Vínculos candidatos','Estado, método y confianza se conservan; una relación en revisión no promueve identidad.')]);const list=node('div',{class:'e360p-link-list'});links.forEach(l=>list.append(node('article',{class:'e360p-link'},[badge(l.estado_relacion||'Vínculo'),node('strong',{text:l.tipo_relacion||'Relación'}),node('span',{text:`${l.metodo_relacion||'Método no informado'} · confianza ${pct(l.confianza)}`}),l.requiere_revision?badge('Requiere revisión','warn'):null]));if(!links.length)list.append(node('div',{class:'atlas-v2-empty',text:'Sin vínculos candidatos materializados.'}));wrap.append(list,node('button',{type:'button',class:'atlas-v2-button',text:'Abrir red completa',onclick:()=>api.navigate('relaciones',{entity_id:ref.entity_id,...(ref.rut?{rut:ref.rut}:{})})}));return wrap;}

  function watchlistsView(entity){
    const host=node('div',{class:'e360p-watch-host'});async function run(){clear(host);host.append(node('div',{class:'e360p-loading',text:'Consultando listas globales oficiales y agregadas…'}));try{const out=await global.AtlasV2Entity360Parity.watchlists(entity);renderWatch(host,out?.data||out);}catch(e){clear(host);host.append(node('div',{class:'e360p-error'},[node('strong',{text:'Screening global no disponible'}),node('span',{text:String(e?.message||e)})]));}}
    return node('section',{class:'e360p-card'},[sectionHead('SCREENING LIVE','Listas y fuentes globales','OpenSanctions, ICIJ, ONU, OFAC, UE, UK, Banco Mundial y BID. Se ejecuta sólo a petición del analista.'),node('button',{type:'button',class:'atlas-v2-button primary',text:'Ejecutar screening live',onclick:()=>void run()}),host,rule('Todo hit es candidato y requiere revisión. El screening no promueve identidad ni modifica scores de Atlas.')]);
  }
  function renderWatch(host,data){clear(host);const sources=data?.sources||{};const sourceGrid=node('div',{class:'e360p-watch-grid'});Object.entries(sources).forEach(([code,src])=>{const records=Array.isArray(src?.records)?src.records:[];const box=node('section',{class:'e360p-watch-source'},[node('div',{class:'e360p-watch-title'},[node('strong',{text:code.replaceAll('_',' ')}),badge(src?.status||'unknown',src?.status==='fresh'?'ok':src?.status==='degraded'?'warn':'')]),node('small',{text:`${fmt(records.length)} candidato(s)`})]);records.slice(0,8).forEach(r=>{const url=safeUrl(r.source_url);box.append(node('article',{class:'e360p-watch-hit'},[node('strong',{text:r.related_entity_name||r.title||'Candidato'}),node('span',{text:`${pct(r.match_confidence)} · ${r.match_method||'coincidencia nominal'}`}),r.summary?node('p',{text:r.summary}):null,url?node('a',{href:url,target:'_blank',rel:'noopener noreferrer',text:'Abrir fuente ↗'}):null]));});sourceGrid.append(box);});host.append(sourceGrid);}

  function tabbed(api,intel,ref){
    const entity={name:intel?.base?.identity?.name||intel?.base?.identity?.legal_name||ref.name||'',rut:intel?.resolved_rut||ref.rut||'',entityType:intel?.base?.identity?.entity_type||intel?.base?.identity?.profile?.tipo_entidad_es||''};
    const tabs=[['panorama','Panorama'],['cronologia','Cronología'],['documentos','Documentos'],['digital','Identidad digital'],['listas','Listas globales'],['relaciones','Relaciones']];const controls=node('div',{class:'e360p-tabs',role:'tablist'}),body=node('div',{class:'e360p-tabbody'});
    function show(id){controls.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));clear(body);if(id==='panorama'){let selected=node('div',{class:'e360p-year-detail'});const onYear=row=>{clear(selected);selected.append(node('strong',{text:`${row.commercial_year}`}),node('span',{text:[row.sales_band_code,row.workers_numeric!=null?`${fmt(row.workers_numeric)} trabajadores`:'',row.region,row.main_activity].filter(Boolean).join(' · ')}));};body.append(node('div',{class:'e360p-two'},[trajectory(intel,onYear),marks(intel)]),selected,node('section',{class:'e360p-card'},[sectionHead('PARES','Posición comparable'),latestPeer(intel)]));}else if(id==='cronologia')body.append(timelineView(intel));else if(id==='documentos')body.append(documentsView(intel));else if(id==='digital')body.append(node('section',{class:'e360p-card'},[sectionHead('OSINT','Identidad digital','Busca un handle explícito; Atlas no infiere usernames desde el nombre de la entidad.'),digitalDiscovery()]));else if(id==='listas')body.append(watchlistsView(entity));else if(id==='relaciones')body.append(relationsView(api,intel,ref));}
    tabs.forEach(([id,label])=>controls.append(node('button',{type:'button','data-tab':id,text:label,onclick:()=>show(id)})));show('panorama');return node('div',{class:'e360p-workspace'},[controls,body]);
  }

  async function renderEntity(container,route,api,serial){
    const rut=route.params.get('rut')||'';const entityId=route.params.get('entity_id')||(global.AtlasV2Entity360?.validRutShape(rut)?global.AtlasV2Entity360.entityIdFromRut(rut):'');const ref={entity_id:entityId,rut:global.AtlasV2Entity360?.canonicalRut?.(rut)||'',name:route.params.get('q')||''};
    const host=node('div',{class:'e360p-live'},[node('div',{class:'e360p-loading',text:'Construyendo expediente 360 con cronología y evidencia…'})]);container.append(host);
    try{const intel=await global.AtlasV2Entity360Parity.read(ref,{route:'entidad:parity-read'});if(serial!==renderSerial||!host.isConnected)return;clear(host);const base=intel?.base||{};const identity=base?.identity||{};const resolved={entity_id:entityId,rut:intel?.resolved_rut||ref.rut,name:identity?.name||identity?.legal_name||ref.name};host.append(hero(resolved,intel),node('div',{class:'e360p-source-strip'},[badge('SII'),badge('UAF'),badge('RES'),badge('Sanciones'),badge('Gasto público'),badge('Radar Prensa'),badge('Identidad digital'),badge('Listas globales')]),tabbed(api,intel,resolved),rule('Sanciones, prensa, listas globales, identidad digital, territorio y relaciones son contextos separados. Ninguno acredita por sí solo LA/FT ni transfiere riesgo entre entidades.'));}
    catch(e){if(serial!==renderSerial)return;clear(host);host.append(node('div',{class:'e360p-error'},[node('strong',{text:'No fue posible construir el expediente ampliado'}),node('span',{text:String(e?.message||e)}),node('button',{type:'button',class:'atlas-v2-button',text:'Volver a búsqueda',onclick:()=>api.navigate('entidad',{})})]));}
  }

  function render(container,route,api){injectStyle();const serial=++renderSerial;const entityId=route.params.get('entity_id')||'';const rut=route.params.get('rut')||'';const q=route.params.get('q')||'';if(!entityId&&!rut){container.append(node('header',{class:'e360p-pagehead'},[node('span',{class:'e360p-kicker',text:'ENTIDAD 360 · EXPLORADOR DE INTELIGENCIA'}),node('h1',{text:'Buscar y comprender una entidad'}),node('p',{text:'Recupera la amplitud del explorador anterior: identidad canónica, UAF, prensa, cronología, documentos, identidad digital y screening global, manteniendo la semántica de cada fuente.'})]),node('div',{class:'e360p-search-tabs'},[node('section',{class:'e360p-card'},[sectionHead('ENTIDAD','Búsqueda transversal','RUT, razón social, denominaciones UAF y entidades de prensa con facetas sobre resultados.'),entitySearch(api,q)]),node('section',{class:'e360p-card'},[sectionHead('IDENTIDAD DIGITAL','Buscar por alias','Sherlock, WhatsMyName y Maigret bajo consulta live no persistente.'),digitalDiscovery()])]),rule('Identidad ≠ similitud. Una entidad de prensa o un username coincidente permanece como candidato/contexto hasta corroboración.'));return;}container.append(node('div',{class:'e360p-top-actions'},[node('button',{type:'button',class:'atlas-v2-button',text:'← Nueva búsqueda',onclick:()=>api.navigate('entidad',{})}),node('button',{type:'button',class:'atlas-v2-button',text:'Relaciones',onclick:()=>api.navigate('relaciones',{entity_id:entityId,...(rut?{rut}:{})})}),node('button',{type:'button',class:'atlas-v2-button',text:'Gasto público',onclick:()=>api.navigate('gasto-publico',{...(rut?{rut}:{})})})]));void renderEntity(container,route,api,serial);}

  function register(){if(!global.AtlasV2Shell?.registerSurface)return false;global.AtlasV2Shell.registerSurface('entidad',render);global.__ATLAS_V2_ENTITY360_PARITY_SURFACE__=Object.freeze({installed:true,route:'entidad',contract:'ENTITY360_LEGACY_PARITY_V1'});return true;}
  if(!register())global.addEventListener('atlas:v2-shell-ready',register,{once:true});
})(window);
