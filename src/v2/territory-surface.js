'use strict';

(function installAtlasV2TerritorySurface(global) {
  if (global.__ATLAS_V2_TERRITORY_SURFACE__) return;

  const scriptBase = new URL('./', document.currentScript?.src || document.baseURI);
  const GEOJSON_URL = 'https://raw.githubusercontent.com/fcortes/Chile-GeoJSON/refs/heads/master/comunas.geojson';
  const MODES = Object.freeze([['overview','Visor territorial'],['signals','Señales'],['entities','Entidades'],['method','Método']]);
  const LAYERS = Object.freeze([
    ['igr','Índice de Riesgo Geográfico (IGR)'],
    ['threat','Amenaza territorial'],
    ['vulnerability','Vulnerabilidad territorial'],
    ['mapping_quality','Calidad de cobertura']
  ]);
  let renderSerial = 0;
  let geoCache = null;
  let communeCache = null;

  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'html') el.innerHTML = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : [children]).forEach(child => {
      if (child == null) return;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return el;
  }
  function clear(el) { while (el?.firstChild) el.removeChild(el.firstChild); }
  function fmt(value, digits = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  }
  function norm(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function formatDate(value) {
    if (!value) return 'corte vigente';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL', { year:'numeric', month:'short', day:'2-digit' });
  }
  function injectStyle() {
    if (document.getElementById('atlas-v2-territory-style')) return;
    document.head.append(node('link', { id:'atlas-v2-territory-style', rel:'stylesheet', href:new URL('territory-surface.css?v=2', scriptBase).href }));
  }
  function stateFrom(route) {
    const requested = String(route.params.get('mode') || 'overview').toLowerCase();
    return {
      mode: MODES.some(([id]) => id === requested) ? requested : 'overview',
      region: route.params.get('region') || '',
      commune: route.params.get('commune') || '',
      communeCode: route.params.get('commune_code') || '',
      q: route.params.get('q') || '',
      priority: route.params.get('priority') || '',
      layer: LAYERS.some(([id]) => id === route.params.get('layer')) ? route.params.get('layer') : 'igr'
    };
  }
  function nav(api, state, patch) { api.navigate('territorio', { ...state, ...patch }); }
  function scoreBand(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 'Sin cálculo';
    if (n >= 80) return 'Muy alto';
    if (n >= 60) return 'Alto';
    if (n >= 40) return 'Medio';
    if (n >= 20) return 'Bajo';
    return 'Muy bajo';
  }
  function scoreColor(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '#203248';
    if (n >= 80) return '#ff5964';
    if (n >= 60) return '#f28a45';
    if (n >= 40) return '#d7ae55';
    if (n >= 20) return '#4ca7bd';
    return '#346985';
  }
  function valueFor(item, layer) {
    const n = Number(item?.[layer]);
    return Number.isFinite(n) ? n : null;
  }
  function pageHead() {
    return node('header', { class:'atlas-v2-territory-head' }, [
      node('div', { class:'atlas-v2-territory-title' }, [
        node('span', { class:'atlas-v2-territory-titlebar', 'aria-hidden':'true' }),
        node('div', {}, [
          node('div', { class:'atlas-v2-eyebrow', text:'ATLAS · INTELIGENCIA TERRITORIAL' }),
          node('h1', { text:'Territorio · Inteligencia Territorial' }),
          node('p', { text:'Lectura comunal del IGR, comparación territorial, señales observadas y contexto de entidades sin transferir riesgo desde el territorio.' })
        ])
      ]),
      node('div', { class:'atlas-v2-territory-live' }, [node('i'), node('span', { text:'Read model v2 · sesión gobernada' })])
    ]);
  }
  function toolbar(api, state) {
    return node('div', { class:'atlas-v2-territory-tabs', role:'navigation', 'aria-label':'Modos territoriales' }, MODES.map(([id,label]) => node('button', {
      type:'button', text:label, 'aria-current': state.mode === id ? 'true' : 'false', onclick:()=>nav(api,state,{mode:id})
    })));
  }
  function guard(text) {
    return node('div', { class:'atlas-v2-territory-guard' }, [node('strong', { text:'Regla de lectura · ' }), node('span', { text })]);
  }
  function loading(text='Consultando read model territorial gobernado…') { return node('div', { class:'atlas-v2-territory-loading', text }); }
  function errorBox(error) {
    return node('div', { class:'atlas-v2-notice' }, [
      node('strong', { text:'No fue posible leer Territorio. ' }),
      node('span', { text:String(error?.message || error || 'Error') }),
      error?.traceId ? node('small', { text:` · trace ${error.traceId}` }) : null
    ]);
  }

  async function allCommunes(serial) {
    if (communeCache) return communeCache;
    const [a,b] = await Promise.all([
      global.AtlasV2Territory.communes({ limit:200, offset:0, route:'territorio:map:0' }),
      global.AtlasV2Territory.communes({ limit:200, offset:200, route:'territorio:map:200' })
    ]);
    if (serial !== renderSerial) return [];
    const map = new Map();
    [...(a.items||[]), ...(b.items||[])].forEach(x => map.set(String(x.commune_code || norm(x.commune)), x));
    communeCache = [...map.values()];
    return communeCache;
  }
  async function geojson() {
    if (geoCache) return geoCache;
    const res = await fetch(GEOJSON_URL, { cache:'force-cache', credentials:'omit' });
    if (!res.ok) throw new Error(`Geometría comunal no disponible (${res.status})`);
    geoCache = await res.json();
    return geoCache;
  }
  function geoName(p={}) {
    for (const k of ['COMUNA','Comuna','comuna','NOM_COMUNA','NOM_COM','NAME_3','name','Nombre']) if (p[k]) return String(p[k]);
    return '';
  }
  function pathForGeometry(geometry, width=430, height=520) {
    if (!geometry) return '';
    const project = coord => {
      const lon = Number(coord[0]), lat = Number(coord[1]);
      const x = 30 + ((lon + 76.5) / 11.5) * (width - 60);
      const y = 20 + ((-17.2 - lat) / 39.2) * (height - 40);
      return [x,y];
    };
    const ringPath = ring => ring.map((c,i) => { const [x,y]=project(c); return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ') + ' Z';
    if (geometry.type === 'Polygon') return geometry.coordinates.map(ringPath).join(' ');
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap(poly => poly.map(ringPath)).join(' ');
    return '';
  }
  function ranking(rows, selected, layer='igr') {
    const sorted = rows.filter(x=>Number.isFinite(valueFor(x,layer))).sort((a,b)=>valueFor(b,layer)-valueFor(a,layer));
    const idx = sorted.findIndex(x=>String(x.commune_code)===String(selected?.commune_code));
    return { rank:idx>=0?idx+1:null, total:sorted.length, percentile:idx>=0&&sorted.length>1?Math.round(100*(1-idx/(sorted.length-1))):null };
  }
  function bar(label, value, accent, meta='') {
    return node('div', { class:'atlas-v2-territory-metricbar' }, [
      node('div', { class:'atlas-v2-territory-metricbar-head' }, [node('span', { text:label }), node('strong', { text:fmt(value,1) })]),
      node('div', { class:'atlas-v2-territory-bar' }, node('i', { style:`width:${Math.max(0,Math.min(100,Number(value)||0))}%;background:${accent}` })),
      meta ? node('small', { text:meta }) : null
    ]);
  }
  function miniBars(items, selected, api, state) {
    const candidates = items.filter(x=>x.region===selected.region && Number.isFinite(Number(x.igr))).sort((a,b)=>Number(b.igr)-Number(a.igr));
    const keep = [selected, ...candidates.filter(x=>x.commune_code!==selected.commune_code).slice(0,5)];
    return node('div', { class:'atlas-v2-territory-peerlist' }, keep.map(x=>node('button', {
      type:'button', class:`atlas-v2-territory-peer ${x.commune_code===selected.commune_code?'selected':''}`,
      onclick:()=>nav(api,state,{mode:'overview',region:x.region||'',commune:x.commune||'',communeCode:x.commune_code||''})
    }, [
      node('span',{text:x.commune||'—'}),
      node('div',{class:'atlas-v2-territory-peerbar'},node('i',{style:`width:${Math.max(3,Math.min(100,Number(x.igr)||0))}%;background:${scoreColor(x.igr)}`})),
      node('strong',{text:fmt(x.igr,1)})
    ])));
  }
  function trendSvg(history) {
    const data = (Array.isArray(history)?history:[]).map(x=>({year:Number(x.year||x.period), value:Number(x.igr??x.score??x.value)})).filter(x=>Number.isFinite(x.year)&&Number.isFinite(x.value)).sort((a,b)=>a.year-b.year);
    if (data.length < 2) return node('div',{class:'atlas-v2-territory-empty',text:'La serie histórica no está publicada en el contrato territorial v2 para esta comuna.'});
    const W=360,H=155,L=26,R=12,T=16,B=24;
    const x=i=>L+i*((W-L-R)/Math.max(1,data.length-1));
    const y=v=>T+(100-Math.max(0,Math.min(100,v)))/100*(H-T-B);
    const pts=data.map((d,i)=>`${x(i)},${y(d.value)}`).join(' ');
    const svg=node('svg',{class:'atlas-v2-territory-trend',viewBox:`0 0 ${W} ${H}`,'aria-label':'Evolución histórica IGR'});
    [0,25,50,75,100].forEach(v=>svg.append(node('line',{x1:L,y1:y(v),x2:W-R,y2:y(v),class:'grid'})));
    svg.append(node('polyline',{points:pts,class:'line'}));
    data.forEach((d,i)=>svg.append(node('circle',{cx:x(i),cy:y(d.value),r:4,class:'dot'}),node('text',{x:x(i),y:H-7,'text-anchor':'middle',class:'label',text:d.year})));
    return svg;
  }

  function filterPanel(rows, state, onChange) {
    const region = node('select',{class:'atlas-v2-territory-select','aria-label':'Región'});
    region.append(node('option',{value:'',text:'Todas las regiones'}));
    [...new Set(rows.map(x=>x.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(r=>region.append(node('option',{value:r,text:r})));
    region.value=state.region;
    const search=node('input',{class:'atlas-v2-territory-input',type:'search',placeholder:'Buscar comuna…',value:state.q,'aria-label':'Buscar comuna'});
    const layer=node('select',{class:'atlas-v2-territory-select','aria-label':'Capa de visualización'},LAYERS.map(([id,label])=>node('option',{value:id,text:label})));
    layer.value=state.layer;
    const cutoff=node('select',{class:'atlas-v2-territory-select','aria-label':'Corte'},node('option',{value:'current',text:'Corte vigente'}));
    const fire=()=>onChange({region:region.value,q:search.value.trim(),layer:layer.value});
    region.addEventListener('change',fire);layer.addEventListener('change',fire);search.addEventListener('input',()=>{clearTimeout(search.__t);search.__t=setTimeout(fire,220);});
    return node('div',{class:'atlas-v2-territory-filters'},[
      node('label',{},[node('span',{text:'Corte'}),cutoff]),
      node('label',{},[node('span',{text:'Región'}),region]),
      node('label',{class:'search'},[node('span',{text:'Buscar comuna'}),search]),
      node('label',{},[node('span',{text:'Capa de visualización'}),layer])
    ]);
  }

  async function renderOverview(host, api, state, serial) {
    host.append(loading('Cargando visor comunal y corte territorial…'));
    try {
      const [overview, rows, geo] = await Promise.all([global.AtlasV2Territory.overview({route:'territorio:overview'}), allCommunes(serial), geojson()]);
      if (serial !== renderSerial || !host.isConnected) return;
      clear(host);
      if (!rows.length) { host.append(node('div',{class:'atlas-v2-territory-empty',text:'El corte territorial vigente no contiene comunas observadas.'})); return; }

      let local = rows.filter(x=>(!state.region||x.region===state.region)&&(!state.q||norm(x.commune).includes(norm(state.q))||String(x.commune_code||'').includes(state.q)));
      let selected = rows.find(x=>state.communeCode&&String(x.commune_code)===String(state.communeCode)) || rows.find(x=>state.commune&&norm(x.commune)===norm(state.commune));
      if (!selected || (state.region && selected.region!==state.region)) selected = [...local].filter(x=>Number.isFinite(Number(x.igr))).sort((a,b)=>Number(b.igr)-Number(a.igr))[0] || local[0] || rows[0];
      const selectedRank = ranking(rows,selected,'igr');
      const generated = overview.generatedAt || overview.meta?.snapshot || null;

      const workspace=node('div',{class:'atlas-v2-territory-workbench'});
      const repaint = patch => nav(api,state,{mode:'overview',...patch,commune:'',communeCode:''});
      workspace.append(filterPanel(rows,state,repaint));

      const stage=node('section',{class:'atlas-v2-territory-stage'});
      const mapCard=node('article',{class:'atlas-v2-territory-card atlas-v2-territory-mapcard'});
      mapCard.append(node('div',{class:'atlas-v2-territory-cardhead'},[
        node('div',{},[node('div',{class:'atlas-v2-eyebrow',text:'LECTURA TERRITORIAL'}),node('h2',{text:LAYERS.find(x=>x[0]===state.layer)?.[1]||'IGR'}),node('p',{text:`${local.length} comunas visibles · ${state.region||'Todo Chile'}`})]),
        node('div',{class:'atlas-v2-territory-legend'},[
          ['#346985','Muy bajo'],['#4ca7bd','Bajo'],['#d7ae55','Medio'],['#f28a45','Alto'],['#ff5964','Muy alto']
        ].map(([c,l])=>node('span',{},[node('i',{style:`background:${c}`}),node('small',{text:l})])))
      ]));
      const svg=node('svg',{class:'atlas-v2-territory-map',viewBox:'0 0 430 520',role:'img','aria-label':'Mapa comunal de Chile'});
      const byName=new Map(rows.map(x=>[norm(x.commune),x]));
      (geo.features||[]).forEach(feature=>{
        const item=byName.get(norm(geoName(feature.properties))); if(!item) return;
        const visible=(!state.region||item.region===state.region)&&(!state.q||norm(item.commune).includes(norm(state.q))||String(item.commune_code||'').includes(state.q));
        const path=node('path',{d:pathForGeometry(feature.geometry),fill:scoreColor(valueFor(item,state.layer)),class:`atlas-v2-territory-mapshape ${String(item.commune_code)===String(selected.commune_code)?'selected':''}`,opacity:visible?'1':'.12','data-code':item.commune_code||''});
        path.append(node('title',{text:`${item.commune} · ${LAYERS.find(x=>x[0]===state.layer)?.[1]||state.layer}: ${fmt(valueFor(item,state.layer),1)}`}));
        path.addEventListener('click',()=>nav(api,state,{mode:'overview',region:item.region||'',commune:item.commune||'',communeCode:item.commune_code||'',q:''}));
        svg.append(path);
      });
      mapCard.append(node('div',{class:'atlas-v2-territory-mapwrap'},[svg,node('div',{class:'atlas-v2-territory-mapstamp',text:`Fuente: read model territorial v2 · ${formatDate(generated)}`})]));

      const summary=node('article',{class:'atlas-v2-territory-card atlas-v2-territory-summarycard'});
      summary.append(node('div',{class:'atlas-v2-territory-summaryhead'},[
        node('div',{},[node('div',{class:'atlas-v2-eyebrow',text:'FICHA TERRITORIAL'}),node('h2',{text:selected.commune||'Comuna'}),node('p',{text:selected.region||'—'})]),
        node('span',{class:'atlas-v2-territory-status',text:'IGR · CONTEXTO'})
      ]));
      summary.append(node('div',{class:'atlas-v2-territory-kpis'},[
        node('div',{class:'primary'},[node('strong',{text:fmt(selected.igr,1)}),node('span',{text:'IGR'}),node('small',{text:scoreBand(selected.igr)})]),
        node('div',{},[node('strong',{text:selectedRank.rank?`${selectedRank.rank}/${selectedRank.total}`:'—'}),node('span',{text:'Ranking nacional'}),node('small',{text:selectedRank.percentile!=null?`Percentil P${selectedRank.percentile}`:'sin posición'})]),
        node('div',{},[node('strong',{text:selected.mapping_quality==null?'—':`${fmt(selected.mapping_quality,0)}%`}),node('span',{text:'Calidad de cobertura'}),node('small',{text:'mapeo territorial'})]),
        node('div',{},[node('strong',{text:fmt(selected.uaf_observed)}),node('span',{text:'SO observados'}),node('small',{text:'cobertura UAF'})])
      ]));
      summary.append(node('div',{class:'atlas-v2-territory-sectiontitle'},[node('h3',{text:'Dimensiones territoriales'}),node('small',{text:'mismo corte del IGR'})]));
      summary.append(node('div',{class:'atlas-v2-territory-bars'},[
        bar('Amenaza territorial',selected.threat,'#f28a45','presión observada'),
        bar('Vulnerabilidad territorial',selected.vulnerability,'#55bfd2','condiciones habilitantes'),
        bar('Calidad del mapeo',selected.mapping_quality,'#8f9fb3','cobertura de evidencia')
      ]));
      summary.append(guard('El IGR caracteriza el territorio. No se hereda a personas, empresas o sectores ubicados en la comuna.'));
      stage.append(mapCard,summary);workspace.append(stage);

      const lower=node('section',{class:'atlas-v2-territory-lower'});
      const trend=node('article',{class:'atlas-v2-territory-card atlas-v2-territory-panel'},[node('h3',{text:'Evolución del territorio'}),node('p',{class:'sub',text:'Serie histórica publicada por el contrato v2 cuando existe'}),loading('Consultando detalle de la comuna…')]);
      const peers=node('article',{class:'atlas-v2-territory-card atlas-v2-territory-panel'},[node('h3',{text:'Comparación regional'}),node('p',{class:'sub',text:'IGR de la comuna frente a pares de su región'}),miniBars(rows,selected,api,state)]);
      const context=node('article',{class:'atlas-v2-territory-card atlas-v2-territory-panel'},[node('h3',{text:'Contexto territorial'}),node('p',{class:'sub',text:'Observabilidad descriptiva · no modifica el IGR'}),loading('Consultando entidades de contexto…')]);
      const signals=node('article',{class:'atlas-v2-territory-card atlas-v2-territory-panel'},[node('div',{class:'atlas-v2-territory-sectiontitle'},[node('h3',{text:'Señales territoriales'}),node('small',{text:'priorización analítica'})]),node('p',{class:'sub',text:'Señales publicadas para la región del territorio seleccionado'}),loading('Consultando señales…')]);
      lower.append(trend,peers,context,signals);workspace.append(lower);
      workspace.append(node('footer',{class:'atlas-v2-territory-footnote'},[
        node('span',{},[node('strong',{text:'Nota metodológica: '}),node('span',{text:'prioridad territorial ≠ probabilidad de LA/FT; contexto ≠ atribución; ausencia de información ≠ cero.'})]),
        node('span',{text:`Snapshot ${formatDate(generated)}`})
      ]));
      host.append(workspace);

      Promise.allSettled([
        global.AtlasV2Territory.detail({region:selected.region||'',commune:selected.commune||'',communeCode:selected.commune_code||'',route:'territorio:detail'}),
        global.AtlasV2Territory.entities({region:selected.region||'',commune:selected.commune||'',limit:50,route:'territorio:context'}),
        global.AtlasV2Territory.signals({region:selected.region||'',limit:20,route:'territorio:signals:panel'})
      ]).then(results=>{
        if(serial!==renderSerial||!workspace.isConnected)return;
        const [d,e,s]=results;
        clear(trend);trend.append(node('h3',{text:'Evolución del territorio'}),node('p',{class:'sub',text:'Serie histórica publicada por el contrato v2 cuando existe'}));
        if(d.status==='fulfilled'){
          const item=d.value.item||{};const history=item.history||item.series||item.evolution||d.value.data?.history||[];
          trend.append(trendSvg(history));
          if(item.interpretation||item.summary)trend.append(node('p',{class:'atlas-v2-territory-interpretation',text:item.interpretation||item.summary}));
        }else trend.append(node('div',{class:'atlas-v2-territory-empty',text:'El detalle histórico no está disponible para esta comuna en el corte vigente.'}));

        clear(context);context.append(node('h3',{text:'Contexto territorial'}),node('p',{class:'sub',text:'Observabilidad descriptiva · no modifica el IGR'}));
        if(e.status==='fulfilled'){
          const entities=e.value.items||[];const withSignals=entities.filter(x=>Number(x.alert_count)>0).length;const withFindings=entities.filter(x=>Number(x.finding_count)>0).length;const withRut=entities.filter(x=>x.rut).length;
          context.append(node('div',{class:'atlas-v2-territory-contextgrid'},[
            node('div',{},[node('strong',{text:fmt(entities.length)}),node('span',{text:'Entidades observadas'})]),
            node('div',{},[node('strong',{text:fmt(withRut)}),node('span',{text:'Con RUT'})]),
            node('div',{},[node('strong',{text:fmt(withSignals)}),node('span',{text:'Con señales'})]),
            node('div',{},[node('strong',{text:fmt(withFindings)}),node('span',{text:'Con hallazgos'})])
          ]));
          const top=entities.slice().sort((a,b)=>(Number(b.alert_count)+Number(b.finding_count))-(Number(a.alert_count)+Number(a.finding_count))).slice(0,4);
          if(top.length)context.append(node('div',{class:'atlas-v2-territory-entitylist'},top.map(x=>node('button',{type:'button',onclick:()=>x.rut&&api.navigate('entidad',{rut:x.rut})},[node('span',{text:x.name||'Entidad sin nombre'}),node('small',{text:`${x.rut||'sin RUT'} · ${fmt(x.source_count)} fuentes · ${fmt(x.alert_count)} señales`})]))));
          else context.append(node('div',{class:'atlas-v2-territory-empty',text:'No hay entidades observadas en esta comuna para el corte vigente.'}));
        }else context.append(node('div',{class:'atlas-v2-territory-empty',text:'Contexto de entidades no disponible.'}));

        clear(signals);signals.append(node('div',{class:'atlas-v2-territory-sectiontitle'},[node('h3',{text:'Señales territoriales'}),node('small',{text:'priorización analítica'})]),node('p',{class:'sub',text:'Señales publicadas para la región del territorio seleccionado'}));
        if(s.status==='fulfilled'&&(s.value.items||[]).length){
          (s.value.items||[]).slice(0,4).forEach(x=>signals.append(node('article',{class:'atlas-v2-territory-signalrow'},[node('div',{},[node('strong',{text:x.title||x.pattern_type||'Señal territorial'}),node('small',{text:x.summary||x.scope_label||'Sin síntesis publicada'})]),node('span',{text:x.priority||'—'})])));
        }else signals.append(node('div',{class:'atlas-v2-territory-empty',text:'No hay señales territoriales publicadas para la región seleccionada.'}));
      });
    } catch(error) {
      if(serial===renderSerial&&host.isConnected){clear(host);host.append(errorBox(error));}
    }
  }

  function searchControls(api,state,{entityMode=false}={}){
    const region=node('input',{type:'search',value:state.region,placeholder:'Región exacta','aria-label':'Región'});
    const query=node('input',{type:'search',value:state.q,placeholder:entityMode?'Nombre o RUT':'Buscar','aria-label':'Buscar'});
    const submit=()=>nav(api,state,{region:region.value.trim(),q:query.value.trim()});
    [region,query].forEach(x=>x.addEventListener('keydown',e=>{if(e.key==='Enter')submit();}));
    return node('div',{class:'atlas-v2-territory-search'},[region,query,node('button',{class:'atlas-v2-button primary',type:'button',text:'Aplicar',onclick:submit})]);
  }
  async function renderSignals(host,api,state,serial){
    const priority=node('select',{'aria-label':'Prioridad'},[node('option',{value:'',text:'Todas las prioridades'}),node('option',{value:'MUY ALTA',text:'Muy alta'}),node('option',{value:'ALTA',text:'Alta'}),node('option',{value:'MEDIA',text:'Media'})]);priority.value=state.priority;
    const region=node('input',{type:'search',value:state.region,placeholder:'Filtrar región','aria-label':'Región'});const apply=()=>nav(api,state,{region:region.value.trim(),priority:priority.value});
    host.append(node('div',{class:'atlas-v2-territory-search'},[region,priority,node('button',{class:'atlas-v2-button primary',type:'button',text:'Aplicar',onclick:apply})]));
    const live=node('div',{},[loading()]);host.append(live);
    try{const out=await global.AtlasV2Territory.signals({region:state.region,priority:state.priority,limit:100,route:'territorio:signals'});if(serial!==renderSerial||!live.isConnected)return;clear(live);if(!out.items.length){live.append(node('div',{class:'atlas-v2-territory-empty',text:'No hay señales territoriales observadas para este filtro.'}));return;}out.items.forEach(item=>live.append(node('article',{class:'atlas-v2-territory-signal'},[node('header',{},[node('strong',{text:item.title||item.pattern_type||'Señal territorial'}),node('span',{class:'atlas-v2-territory-badge',text:item.priority||'SIN PRIORIDAD'})]),node('p',{text:item.summary||'Sin síntesis publicada.'}),node('div',{class:'atlas-v2-territory-meta',text:`${item.scope_label||item.scope_id||'Ámbito territorial'} · fuerza ${fmt(item.strength,2)} · patrón ${item.pattern_type||'—'}`})])));live.append(guard('Una señal abre una pregunta analítica. No es un hallazgo acreditado ni equivale a probabilidad LA/FT.'));}catch(error){if(serial===renderSerial&&live.isConnected){clear(live);live.append(errorBox(error));}}
  }
  async function renderEntities(host,api,state,serial){
    host.append(searchControls(api,state,{entityMode:true}));if(!state.region){host.append(node('div',{class:'atlas-v2-territory-empty'},[node('strong',{text:'Selecciona una región. '}),node('span',{text:'La exploración de entidades exige contexto territorial explícito para evitar barridos masivos.'})]));return;}
    const live=node('div',{},[loading()]);host.append(live);
    try{const out=await global.AtlasV2Territory.entities({region:state.region,commune:state.commune,search:state.q,limit:100,route:'territorio:entities'});if(serial!==renderSerial||!live.isConnected)return;clear(live);const table=node('table',{class:'atlas-v2-territory-table'});table.append(node('thead',{},node('tr',{},['Entidad','RUT','Comuna','Fuentes','Señales','Hallazgos','Acción'].map(x=>node('th',{text:x})))));const body=node('tbody');out.items.forEach(item=>body.append(node('tr',{},[node('td',{text:item.name||'Sin nombre'}),node('td',{text:item.rut||'—'}),node('td',{text:item.commune||'—'}),node('td',{text:fmt(item.source_count)}),node('td',{text:fmt(item.alert_count)}),node('td',{text:fmt(item.finding_count)}),node('td',{},item.rut?node('button',{class:'atlas-v2-button',type:'button',text:'Entidad 360',onclick:()=>api.navigate('entidad',{rut:item.rut})}):'Sin RUT')])));table.append(body);live.append(table,guard('El orden usa observabilidad para priorizar exploración. No constituye score de riesgo ni hereda el IGR de la comuna.'));}catch(error){if(serial===renderSerial&&live.isConnected){clear(live);live.append(errorBox(error));}}
  }
  function renderMethod(host){
    host.append(node('div',{class:'atlas-v2-territory-method'},[
      node('article',{},[node('h3',{text:'IGR · contexto territorial'}),node('p',{text:'Resume presión territorial observada y permite comparar comunas. No atribuye riesgo individual a entidades presentes en el territorio.'})]),
      node('article',{},[node('h3',{text:'Amenaza y vulnerabilidad'}),node('p',{text:'Se muestran como dimensiones separadas del mismo read model. Su interpretación depende de cobertura y del snapshot publicado.'})]),
      node('article',{},[node('h3',{text:'Sin herencia automática'}),node('p',{text:'Una entidad no recibe el IGR de su comuna por domicilio, actividad o relación. La evidencia de entidad se analiza en su propio nivel.'})]),
      node('article',{},[node('h3',{text:'Faltante ≠ cero'}),node('p',{text:'Ausencia de cobertura o dato no se interpreta como exposición nula. Atlas mantiene visible la calidad del mapeo y la fecha de snapshot.'})])
    ]));
  }
  function render(container,route,api){
    injectStyle();const serial=++renderSerial;const state=stateFrom(route);container.append(pageHead(),toolbar(api,state));const host=node('section',{class:'atlas-v2-section atlas-v2-territory-host'});container.append(host);
    if(!global.AtlasV2Territory?.installed){host.append(node('div',{class:'atlas-v2-notice',text:'Adapter de Territorio no disponible.'}));return;}
    if(state.mode==='overview')void renderOverview(host,api,state,serial);else if(state.mode==='signals')void renderSignals(host,api,state,serial);else if(state.mode==='entities')void renderEntities(host,api,state,serial);else renderMethod(host);
  }
  function register(){if(!global.AtlasV2Shell?.registerSurface)return false;global.AtlasV2Shell.registerSurface('territorio',render);global.__ATLAS_V2_TERRITORY_SURFACE__=Object.freeze({installed:true,route:'territorio',mode:'intelligence-territorial-v2',semantics:'CONTEXT_NOT_ENTITY_RISK'});return true;}
  if(!register())global.addEventListener('atlas:v2-shell-ready',register,{once:true});
})(window);
