'use strict';

/* ATLAS AML 0.43.8 · Entity 360 current search authority
 * Search remains identity-first and opens the governed Entity 360 renderer.
 * Suggestions are progressive, RLS-scoped and never infer identity by fuzzy joins.
 */
(function atlasEntitySearchCurrent(){
  const RELEASE='0.43.8',BUILD='0438';
  const PREVIEW_LIMIT=8,FULL_LIMIT=50,DEBOUNCE_MS=260;
  let timer=null,seq=0,activeIndex=-1,lastSuggestions=[];

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmt(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'—';}
  function clean(v){return String(v??'').trim().replace(/[%_,()]/g,'').replace(/\s+/g,' ').slice(0,120);}
  function modeFor(q){if(/^ENT-/i.test(q))return {kind:'entity_id',label:'Entity ID'};if(/^[0-9kK.\-\s]+$/.test(q))return {kind:'rut',label:'RUT'};return {kind:'name',label:'razón social'};}
  function placeOf(r){return [r.commune,r.region].filter(Boolean).join(' · ')||'Territorio no materializado';}
  function openEntity(id){
    if(typeof window.openEntity==='function')return window.openEntity(id);
    if(typeof v0203OpenEntity==='function')return v0203OpenEntity(id);
  }

  function applyFilter(query,q){
    const mode=modeFor(q);
    if(mode.kind==='entity_id')return {query:query.ilike('entity_id',`${q.toUpperCase()}%`),mode};
    if(mode.kind==='rut'){
      const compact=q.replace(/[^0-9kK]/g,'').toUpperCase();
      const value=compact.length>=7?`${compact.slice(0,-1)}-${compact.slice(-1)}`:q.replace(/[.\s]/g,'').toUpperCase();
      return {query:query.ilike('rut',`%${value}%`),mode};
    }
    const terms=q.split(' ').map(x=>x.trim()).filter(Boolean).slice(0,8);
    return {query:query.ilike('name',`%${terms.join('%')}%`),mode};
  }

  async function queryEntities(q,limit){
    if(typeof sb==='undefined')throw new Error('Fuente de entidades no disponible.');
    const fields='entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,snapshot_id,updated_at';
    const filtered=applyFilter(sb.from('aml_entities').select(fields,{count:'exact'}),q);
    const {data,error,count}=await filtered.query.order('source_count',{ascending:false}).order('name',{ascending:true}).limit(limit);
    if(error)throw error;
    return {rows:data||[],count:Number(count)||0,mode:filtered.mode};
  }

  function chips(r){
    return `<div class="chips"><span>${esc(r.entity_type||'Entidad')}</span>${r.is_uaf_observed?'<span class="uaf">SO / observado UAF</span>':''}${r.is_sanctioned?'<span class="san">Con sanciones</span>':''}${r.region?`<span>${esc(r.region)}</span>`:''}</div>`;
  }
  function suggestion(r,index){
    return `<button type="button" class="atlas-entity-suggestion" role="option" aria-selected="false" data-atlas-entity-suggestion="${esc(r.entity_id)}" data-index="${index}"><div><h4>${esc(r.name||r.entity_id)}</h4><p>${esc(r.rut||'RUT no materializado')} · ${esc(placeOf(r))}</p>${chips(r)}</div><div class="coverage"><b>${fmt(r.source_count)}</b><span>fuentes</span></div></button>`;
  }
  function resultCard(r){
    return `<button type="button" class="atlas-entity-result" data-atlas-entity-result="${esc(r.entity_id)}"><div><h4>${esc(r.name||r.entity_id)}</h4><p>${esc(r.rut||'RUT no materializado')} · ${esc(placeOf(r))}</p>${chips(r)}</div><div class="coverage"><b>${fmt(r.source_count)}</b><span>fuentes</span></div></button>`;
  }

  function statusNodes(){return {hits:document.querySelector('#atlas-entity-hit-count'),mode:document.querySelector('#atlas-entity-mode'),state:document.querySelector('#atlas-entity-search-state')};}
  function updateStatus({count=null,mode='',state='Listo para buscar'}={}){
    const n=statusNodes();
    if(n.hits)n.hits.textContent=count===null?'—':fmt(count);
    if(n.mode)n.mode.textContent=mode||'Nombre · RUT · Entity ID';
    if(n.state)n.state.textContent=state;
  }
  function closeSuggestions(){
    const box=document.querySelector('#atlas-entity-suggestions');
    const input=document.querySelector('#entity-q');
    if(box){box.dataset.open='false';box.innerHTML='';}
    if(input)input.setAttribute('aria-expanded','false');
    activeIndex=-1;lastSuggestions=[];
  }
  function bindEntityButtons(root=document){
    root.querySelectorAll('[data-atlas-entity-suggestion],[data-atlas-entity-result]').forEach(btn=>{
      if(btn.dataset.atlasBound==='1')return;
      btn.dataset.atlasBound='1';
      btn.addEventListener('click',()=>openEntity(btn.dataset.atlasEntitySuggestion||btn.dataset.atlasEntityResult));
    });
  }
  function renderSuggestions(payload){
    const box=document.querySelector('#atlas-entity-suggestions');
    const input=document.querySelector('#entity-q');
    if(!box||!input)return;
    lastSuggestions=payload.rows||[];activeIndex=-1;
    if(!payload.count){
      box.innerHTML='<div class="atlas-entity-state"><div><b>Sin coincidencias</b>Prueba con una razón social más corta, RUT o Entity ID.</div></div>';
      box.dataset.open='true';input.setAttribute('aria-expanded','true');
      updateStatus({count:0,mode:payload.mode.label,state:'Sin coincidencias'});return;
    }
    box.innerHTML=`<div class="atlas-entity-suggest-head"><b>${fmt(payload.count)} hallazgo${payload.count===1?'':'s'}</b><span>Mostrando ${fmt(payload.rows.length)} sugerencias · Enter muestra hasta ${FULL_LIMIT}</span></div><div class="atlas-entity-suggest-list" role="listbox">${payload.rows.map(suggestion).join('')}</div>`;
    box.dataset.open='true';input.setAttribute('aria-expanded','true');
    updateStatus({count:payload.count,mode:payload.mode.label,state:'Coincidencias disponibles'});
    bindEntityButtons(box);
  }
  function renderFull(payload){
    const host=document.querySelector('#atlas-entity-results-body');
    const count=document.querySelector('#atlas-entity-results-count');
    if(!host)return;
    closeSuggestions();
    if(count)count.textContent=`${fmt(payload.count)} hallazgo${payload.count===1?'':'s'}`;
    updateStatus({count:payload.count,mode:payload.mode.label,state:'Búsqueda resuelta'});
    if(!payload.count){host.innerHTML='<div class="atlas-entity-state"><div><b>Sin coincidencias</b>Prueba con una razón social más corta, RUT sin puntos o Entity ID.</div></div>';return;}
    host.innerHTML=`<div class="atlas-entity-grid">${payload.rows.map(resultCard).join('')}</div>${payload.count>payload.rows.length?`<div class="atlas-entity-help"><span>Se muestran las ${fmt(payload.rows.length)} entidades con mayor cobertura observable.</span><span>Total bajo el filtro: ${fmt(payload.count)}</span></div>`:''}`;
    bindEntityButtons(host);
  }
  function renderError(error,where='results'){
    const msg=esc(error?.message||error?.details||error||'Error de consulta');
    if(where==='suggestions'){
      const box=document.querySelector('#atlas-entity-suggestions');if(box){box.innerHTML=`<div class="atlas-entity-state error"><div><b>No fue posible sugerir coincidencias</b>${msg}</div></div>`;box.dataset.open='true';}
    }else{
      const host=document.querySelector('#atlas-entity-results-body');if(host)host.innerHTML=`<div class="atlas-entity-state error"><div><b>No fue posible ejecutar la búsqueda</b>${msg}</div></div>`;
    }
    updateStatus({count:null,mode:'',state:'Búsqueda no disponible'});
  }

  async function liveSearch(q){
    const request=++seq;
    updateStatus({count:null,mode:modeFor(q).label,state:'Buscando coincidencias…'});
    try{const payload=await queryEntities(q,PREVIEW_LIMIT);if(request!==seq||state?.view!=='entities')return;renderSuggestions(payload);}catch(error){if(request!==seq)return;renderError(error,'suggestions');}
  }
  async function fullSearch(ev){
    ev?.preventDefault?.();clearTimeout(timer);++seq;
    const input=document.querySelector('#entity-q');if(!input)return;
    const q=clean(input.value);
    if(q.length<2){closeSuggestions();updateStatus({count:null,mode:'',state:'Ingresa al menos 2 caracteres'});input.focus();return;}
    const host=document.querySelector('#atlas-entity-results-body');if(host)host.innerHTML='<div class="atlas-entity-state"><div class="atlas-entity-loading">Resolviendo identidad y cobertura…</div></div>';
    updateStatus({count:null,mode:modeFor(q).label,state:'Resolviendo búsqueda…'});
    try{
      if(typeof sha256==='function'&&typeof audit==='function'){
        const hash=await sha256(q.toLocaleLowerCase('es-CL'));
        await audit('SEARCH',{objectType:'entity',queryHash:hash,queryLength:q.length,payload:{mode:'entity_search_current_0438'}}).catch(()=>{});
      }
      const request=++seq;const payload=await queryEntities(q,FULL_LIMIT);if(request!==seq||state?.view!=='entities')return;renderFull(payload);
    }catch(error){renderError(error);}
  }

  function setActive(index){
    const options=[...document.querySelectorAll('.atlas-entity-suggestion')];
    if(!options.length)return;
    activeIndex=Math.max(0,Math.min(index,options.length-1));
    options.forEach((el,i)=>{const active=i===activeIndex;el.dataset.active=String(active);el.setAttribute('aria-selected',String(active));});
    options[activeIndex]?.scrollIntoView({block:'nearest'});
  }
  function onInputKeydown(ev){
    const box=document.querySelector('#atlas-entity-suggestions');
    const open=box?.dataset.open==='true'&&lastSuggestions.length;
    if(ev.key==='ArrowDown'&&open){ev.preventDefault();setActive(activeIndex+1);}
    else if(ev.key==='ArrowUp'&&open){ev.preventDefault();setActive(activeIndex<0?lastSuggestions.length-1:activeIndex-1);}
    else if(ev.key==='Enter'&&open&&activeIndex>=0){ev.preventDefault();openEntity(lastSuggestions[activeIndex]?.entity_id);}
    else if(ev.key==='Escape'){ev.preventDefault();closeSuggestions();}
  }

  function markup(){
    return `<div class="atlas-entity-search"><section class="atlas-entity-command"><div class="atlas-entity-head"><div><span class="eyebrow">ENTITY 360 · IDENTIDAD CANÓNICA</span><h2>Encuentra una entidad y abre su perfil 360</h2><p>Busca por razón social, RUT o Entity ID. ATLAS sugiere coincidencias mientras escribes y conserva la identidad gobernada antes de cruzar SII, UAF, sanciones, gasto público, CGR y evidencia.</p></div><div class="atlas-entity-badges"><span class="active">RLS activo</span><span>Identity-first</span><span>Hasta ${FULL_LIMIT} resultados</span></div></div><form id="atlas-entity-form" class="atlas-entity-form"><div class="atlas-entity-field"><input id="entity-q" autocomplete="off" spellcheck="false" aria-label="Buscar entidad por razón social, RUT o Entity ID" aria-controls="atlas-entity-suggestions" aria-autocomplete="list" aria-expanded="false" placeholder="Ej.: Banco Falabella, 96509660-4 o ENT-RUT-…"><button type="button" class="atlas-entity-clear" id="atlas-entity-clear" aria-label="Limpiar búsqueda" hidden>×</button><div id="atlas-entity-suggestions" class="atlas-entity-suggestions" data-open="false"></div></div><button type="submit" class="atlas-entity-submit">Buscar</button></form><div class="atlas-entity-metrics"><div class="atlas-entity-metric hits"><span>Hallazgos</span><b id="atlas-entity-hit-count">—</b><small>coincidencias bajo el filtro actual</small></div><div class="atlas-entity-metric"><span>Consulta interpretada como</span><b id="atlas-entity-mode">Nombre · RUT · Entity ID</b><small>sin fuzzy matching de identidad</small></div><div class="atlas-entity-metric"><span>Estado</span><b id="atlas-entity-search-state">Listo para buscar</b><small>Supabase · RLS · Entity Hub</small></div></div><div class="atlas-entity-help"><span>Las sugerencias aparecen desde 2 caracteres y se actualizan con debounce.</span><span>La auditoría de búsqueda almacena hash y longitud, no el texto plano.</span></div></section><section class="atlas-entity-results"><div class="atlas-entity-results-head"><div><span>RESULTADOS</span><h3>Entidades coincidentes</h3><p>Selecciona una entidad para abrir su ficha Entity 360 completa.</p></div><div id="atlas-entity-results-count" class="atlas-entity-results-count">Sin búsqueda ejecutada</div></div><div id="atlas-entity-results-body"><div class="atlas-entity-state"><div><b>Comienza escribiendo una entidad</b>ATLAS mostrará coincidencias potenciales mientras ingresas texto.</div></div></div></section></div>`;
  }

  function bind(){
    const input=document.querySelector('#entity-q'),form=document.querySelector('#atlas-entity-form'),clear=document.querySelector('#atlas-entity-clear');
    if(!input||!form||!clear)return;
    input.addEventListener('input',()=>{
      const q=clean(input.value);clear.hidden=!q;clearTimeout(timer);++seq;activeIndex=-1;
      if(q.length<2){closeSuggestions();updateStatus({count:null,mode:'',state:q?'Escribe un carácter más':'Listo para buscar'});return;}
      updateStatus({count:null,mode:modeFor(q).label,state:'Preparando sugerencias…'});
      timer=setTimeout(()=>liveSearch(q),DEBOUNCE_MS);
    });
    input.addEventListener('keydown',onInputKeydown);
    form.addEventListener('submit',fullSearch);
    clear.addEventListener('click',()=>{input.value='';clear.hidden=true;clearTimeout(timer);++seq;closeSuggestions();updateStatus();document.querySelector('#atlas-entity-results-count').textContent='Sin búsqueda ejecutada';document.querySelector('#atlas-entity-results-body').innerHTML='<div class="atlas-entity-state"><div><b>Comienza escribiendo una entidad</b>ATLAS mostrará coincidencias potenciales mientras ingresas texto.</div></div>';input.focus();});
    document.addEventListener('click',ev=>{if(!ev.target.closest('.atlas-entity-field'))closeSuggestions();},{once:false});
  }

  async function loadEntitiesCurrent(){
    if(typeof state!=='undefined')state.view='entities';
    shell('Entidad 360','Búsqueda por nombre, RUT o ID de Entidad con cruces Fusion bajo demanda.');
    const content=document.querySelector('#content');if(!content)return;
    content.innerHTML=markup();bind();
    setTimeout(()=>document.querySelector('#entity-q')?.focus(),0);
  }

  /* Prevent the retired v0.41 dynamic asset loader from executing in the compiled runtime. */
  if(!document.querySelector('script[data-atlas-entity-search-v041]')){
    const marker=document.createElement('script');marker.type='application/json';marker.dataset.atlasEntitySearchV041='retired';marker.id='atlas-entity-search-v041-retired';document.head.appendChild(marker);
  }

  try{loadEntities=loadEntitiesCurrent;}catch{}
  try{searchEntities=fullSearch;}catch{}
  window.loadEntities=loadEntitiesCurrent;
  window.searchEntities=fullSearch;
  window.__ATLAS_ENTITY_SEARCH__={release:RELEASE,build:BUILD,authority:'ATLAS_ENTITY_SEARCH_CURRENT',suggestions:'DEBOUNCED_RLS_EXACT_COUNT',identityPolicy:'NAME_SEARCH_ONLY+RUT_ENTITY_ID_GOVERNED_OPEN',load:loadEntitiesCurrent,search:fullSearch};
})();
