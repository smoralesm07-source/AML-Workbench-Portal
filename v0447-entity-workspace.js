'use strict';

/* ATLAS AML 0.44.7 · Entity 360 integrated workspace authority
 * - Removes the separate/legacy white entity-search landing from the active route.
 * - Keeps the six-lens Entity 360 dossier as the only visual workspace.
 * - Adds a persistent, RLS-governed autocomplete switcher outside #content so
 *   background detail hydration cannot erase it.
 * - Selecting one canonical entity reuses the governed Entity 360 loader; all
 *   charts, metrics, ribbons and evidence panels are therefore scoped to the
 *   newly selected entity package.
 * - Suggestions use exact governed Entity ID/RUT/name fields only. No fuzzy
 *   identity join and no risk inference are introduced.
 */
(function atlasEntityWorkspace0447(){
  const RELEASE='0.44.7';
  const BUILD='0447';
  const AUTHORITY='ENTITY360_INLINE_AUTOCOMPLETE_0447';
  const ENTRY=window.__ATLAS_ENTITY_ENTRY__;
  if(!ENTRY||typeof ENTRY.open!=='function')return;

  const BASE_OPEN=ENTRY.open;
  const BASE_RENDER=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  const CACHE=new Map();
  const CACHE_TTL=2*60*1000;
  const LIMIT=8;
  const FETCH_LIMIT=20;
  const LENSES=[
    ['01','Identidad'],['02','Caracterización'],['03','Cronología'],
    ['04','Red de exposición'],['05','Señales y convergencia'],['06','Evidencia y decisión']
  ];
  const SOURCES=[
    ['sii','Radar SII'],['uaf','Radar UAF'],['spend','Presupuesto'],['san','Sanciones'],
    ['cgr','Radar CGR'],['osfl','Radar OSFL'],['del','Radar Delictual'],['press','Prensa']
  ];

  let timer=null;
  let requestSeq=0;
  let activeIndex=-1;
  let visibleRows=[];
  let opening=false;
  let selectedMeta=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
  function clean(v){return String(v??'').trim().replace(/[%_]/g,'').slice(0,120);}
  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();}
  function content(){return typeof v019Content==='function'?v019Content():document.querySelector('#content');}
  function place(r){return [r?.commune,r?.region].filter(Boolean).join(' · ')||'territorio no materializado';}
  function fmt(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'—';}

  function searchShell(){
    return `<div class="a47-search-copy">
      <span>ENTIDAD 360 · IDENTIDAD CANÓNICA</span>
      <strong>Buscar o cambiar entidad</strong>
      <small>Escribe nombre, RUT o Entity ID. Las sugerencias se resuelven bajo RLS y no crean vínculos por similitud difusa.</small>
    </div>
    <div class="a47-search-control">
      <div class="a47-combobox" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-owns="a47-suggestions">
        <span class="a47-search-icon" aria-hidden="true">⌕</span>
        <input id="a47-entity-q" type="search" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="a47-suggestions" placeholder="Ej.: Falabella, 75317600-4 o ENT-RUT-…" />
        <button type="button" id="a47-clear" aria-label="Limpiar búsqueda" title="Limpiar">×</button>
        <div id="a47-suggestions" class="a47-suggestions" role="listbox" hidden></div>
      </div>
      <div id="a47-search-status" class="a47-search-status">Escribe al menos 2 caracteres para recibir sugerencias.</div>
    </div>
    <div id="a47-selected" class="a47-selected"></div>`;
  }

  function selectedMarkup(meta){
    if(!meta?.entity_id)return `<span>Sin entidad seleccionada</span><small>Selecciona una sugerencia para cargar todos los elementos analíticos.</small>`;
    return `<span>Entidad activa</span><b>${esc(meta.name||meta.entity_id)}</b><small>${esc(meta.rut||'RUT no materializado')} · ${esc(meta.entity_id)}</small>`;
  }

  function setBusy(flag,label='Cargando expediente…'){
    const host=document.querySelector('#a47-entity-search-host');if(!host)return;
    host.classList.toggle('busy',!!flag);
    const input=host.querySelector('#a47-entity-q');if(input)input.disabled=!!flag;
    const status=host.querySelector('#a47-search-status');if(status&&flag)status.textContent=label;
  }

  function updateSelected(meta){
    if(meta?.entity_id)selectedMeta={...meta};
    const node=document.querySelector('#a47-selected');if(node)node.innerHTML=selectedMarkup(selectedMeta);
  }

  function mountSearch(meta=null){
    const c=content();if(!c)return null;
    let host=document.querySelector('#a47-entity-search-host');
    if(!host||host.parentElement!==c.parentElement){
      host?.remove();
      host=document.createElement('section');
      host.id='a47-entity-search-host';host.className='a47-search-shell';
      host.innerHTML=searchShell();
      c.insertAdjacentElement('beforebegin',host);
      bindSearch(host);
    }
    if(meta?.entity_id)selectedMeta={...meta};
    updateSelected(selectedMeta);
    return host;
  }

  function emptySourceRibbon(){
    return `<div class="a45-source-ribbon a47-source-placeholder">${SOURCES.map(([cls,label])=>`<div class="a45-source ${cls} muted"><i></i><b>${esc(label)}</b><span>PENDIENTE</span><small>selecciona una entidad</small></div>`).join('')}</div>`;
  }

  function emptyWorkspace(){
    const c=content();if(!c)return;
    c.innerHTML=`<div class="a45 a47-entity-empty">
      <section class="a45-cover a47-empty-cover">
        <div class="a45-command"><div class="a47-empty-command"><span class="a45-live">Expediente gobernado</span></div></div>
        <div class="a45-cover-grid">
          <div class="a45-identity">
            <span class="a45-eyebrow">EXPEDIENTE ANALÍTICO 360 · IDENTIDAD CANÓNICA</span>
            <h1>Selecciona una entidad</h1>
            <p>El buscador superior carga una identidad canónica y reconstruye el expediente completo en el mismo espacio.</p>
            <div class="a45-roles"><span class="neutral">RLS activo</span><span class="neutral">sin inferencia por nombre</span></div>
          </div>
          <div class="a45-readings a47-empty-readings">
            <div><span>Fuentes con dato</span><strong>—<small>/ 8</small></strong><em>pendiente de selección</em></div>
            <div><span>Prioridad de revisión</span><strong class="tier">—</strong><em>se calcula con evidencia materializada</em></div>
            <div><span>Evidencia trazable</span><strong>—</strong><em>pendiente de selección</em></div>
          </div>
        </div>
        ${emptySourceRibbon()}
      </section>
      <nav class="a45-lenses a47-disabled-lenses" aria-label="Lentes del expediente pendientes">${LENSES.map(([n,t],i)=>`<button type="button" disabled class="${i===0?'active':''}"><span>${n}</span>${esc(t)}</button>`).join('')}</nav>
      <main><section class="a45-panel active"><div class="a45-panel-head"><span class="a45-eyebrow">ENTITY 360</span><h2>Una selección gobierna toda la ficha</h2><p>Al elegir una entidad, ATLAS vuelve a cargar identidad, caracterización, cronología, red de exposición, señales/convergencia y evidencia/decisión para ese mismo Entity ID.</p></div><article class="a45-card a47-empty-card"><h3>Comienza desde el buscador superior</h3><p>Las sugerencias aparecen a medida que escribes. Puedes cambiar de entidad sin regresar a una pantalla de búsqueda separada.</p><div class="a47-principles"><span><b>Identidad</b> RUT/Entity ID gobiernan cruces.</span><span><b>Vacíos</b> ausencia de dato no es cero.</span><span><b>Red</b> una relación no transfiere riesgo.</span><span><b>UAF</b> screening no sustituye condición jurídica.</span></div></article></section></main>
    </div>`;
    window.__ATLAS_ENTITY360_CURRENT__={release:RELEASE,build:BUILD,authority:AUTHORITY,mode:'workspace-empty',selectedEntity:null,renderedAt:new Date().toISOString()};
  }

  function rank(row,term){
    const q=norm(term),name=norm(row.name),rut=norm(row.rut),id=norm(row.entity_id);
    if(!q)return 99;
    if(name===q||rut===q||id===q)return 0;
    if(name.startsWith(q)||rut.startsWith(q)||id.startsWith(q))return 1;
    if(name.split(' ').some(x=>x.startsWith(q)))return 2;
    if(name.includes(q)||rut.includes(q)||id.includes(q))return 3;
    return 9;
  }

  async function fetchSuggestions(term){
    const key=norm(term);const cached=CACHE.get(key);
    if(cached&&Date.now()-cached.at<CACHE_TTL)return cached.rows;
    if(typeof sb==='undefined')throw new Error('Supabase no disponible');
    let q=sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned');
    if(/^ENT-/i.test(term))q=q.ilike('entity_id',`${term.toUpperCase()}%`);
    else if(/^[0-9kK.\-\s]+$/.test(term))q=q.ilike('rut',`%${term.replace(/[.\s]/g,'')}%`);
    else q=q.ilike('name',`%${term}%`);
    const {data,error}=await q.order('source_count',{ascending:false}).limit(FETCH_LIMIT);
    if(error)throw error;
    const rows=(data||[]).slice().sort((a,b)=>rank(a,term)-rank(b,term)||(Number(b.source_count)||0)-(Number(a.source_count)||0)||String(a.name||'').localeCompare(String(b.name||''),'es')).slice(0,LIMIT);
    CACHE.set(key,{at:Date.now(),rows});
    return rows;
  }

  function suggestionMarkup(row,index){
    const tags=[row.is_uaf_observed?'UAF observado':null,row.is_sanctioned?'Con sanciones':null].filter(Boolean);
    return `<button type="button" class="a47-suggestion ${index===activeIndex?'active':''}" role="option" aria-selected="${index===activeIndex?'true':'false'}" data-a47-index="${index}">
      <div><b>${esc(row.name||row.entity_id)}</b><span>${esc(row.rut||'RUT no materializado')} · ${esc(place(row))}</span><small>${esc(row.entity_id)}</small><em>${tags.map(t=>`<i>${esc(t)}</i>`).join('')}</em></div>
      <aside><strong>${fmt(row.source_count)}</strong><small>fuentes</small></aside>
    </button>`;
  }

  function closeSuggestions(){
    activeIndex=-1;visibleRows=[];
    const box=document.querySelector('#a47-suggestions'),combo=document.querySelector('.a47-combobox');
    if(box){box.hidden=true;box.innerHTML='';}
    combo?.setAttribute('aria-expanded','false');
  }

  function renderSuggestions(rows,term){
    const box=document.querySelector('#a47-suggestions'),combo=document.querySelector('.a47-combobox'),status=document.querySelector('#a47-search-status');if(!box)return;
    visibleRows=rows;activeIndex=rows.length?0:-1;
    box.innerHTML=rows.length?rows.map(suggestionMarkup).join(''):`<div class="a47-no-suggestion">Sin coincidencias para “${esc(term)}”.</div>`;
    box.hidden=false;combo?.setAttribute('aria-expanded','true');
    if(status)status.textContent=rows.length?`${rows.length} sugerencia(s) ordenadas por cercanía de texto y cobertura.`:'No se encontraron coincidencias.';
  }

  function repaintActive(){
    document.querySelectorAll('.a47-suggestion').forEach((node,i)=>{const active=i===activeIndex;node.classList.toggle('active',active);node.setAttribute('aria-selected',active?'true':'false');if(active)node.scrollIntoView({block:'nearest'});});
  }

  async function suggest(term){
    const cleanTerm=clean(term),status=document.querySelector('#a47-search-status');
    if(cleanTerm.length<2){closeSuggestions();if(status)status.textContent='Escribe al menos 2 caracteres para recibir sugerencias.';return;}
    const seq=++requestSeq;if(status)status.textContent='Buscando coincidencias bajo RLS…';
    try{const rows=await fetchSuggestions(cleanTerm);if(seq!==requestSeq)return;renderSuggestions(rows,cleanTerm);}catch(error){if(seq!==requestSeq)return;closeSuggestions();if(status)status.textContent='No fue posible obtener sugerencias: '+String(error?.message||error);}
  }

  async function auditSelection(term,row){
    try{
      if(typeof sha256!=='function'||typeof audit!=='function')return;
      const hash=await sha256(clean(term).toLocaleLowerCase('es-CL'));
      await audit('SEARCH',{objectType:'entity',objectId:row.entity_id,queryHash:hash,queryLength:clean(term).length,payload:{mode:'entity360_autocomplete_0447',selected:true}});
    }catch(_error){}
  }

  async function openWorkspace(entityId,meta=null,term=''){
    if(!entityId||opening)return;
    opening=true;
    const row=meta?.entity_id?meta:{entity_id:entityId,name:meta?.name||'',rut:meta?.rut||''};
    selectedMeta=row;
    try{
      if(typeof state!=='undefined'){state.view='entities';state.selectedEntity=entityId;}
      closeSuggestions();updateSelected(row);setBusy(true,`Cargando ${row.name||entityId}…`);
      if(term)void auditSelection(term,row);
      const result=await BASE_OPEN(entityId);
      mountSearch(row);
      const status=document.querySelector('#a47-search-status');if(status)status.textContent='Entidad cargada. Escribe para cambiar de expediente.';
      return result;
    }catch(error){
      const status=document.querySelector('#a47-search-status');if(status)status.textContent='No fue posible abrir la entidad: '+String(error?.message||error);
      throw error;
    }finally{opening=false;setBusy(false);}
  }

  function choose(index){
    const row=visibleRows[index];if(!row)return;
    const input=document.querySelector('#a47-entity-q'),term=clean(input?.value||'');
    if(input)input.value=row.name||row.rut||row.entity_id;
    void openWorkspace(row.entity_id,row,term);
  }

  function bindSearch(host){
    if(host.dataset.bound==='1')return;host.dataset.bound='1';
    const input=host.querySelector('#a47-entity-q'),clear=host.querySelector('#a47-clear');if(!input)return;
    input.addEventListener('input',()=>{
      if(timer)clearTimeout(timer);
      const term=input.value;timer=setTimeout(()=>void suggest(term),220);
    });
    input.addEventListener('focus',()=>{if(clean(input.value).length>=2)void suggest(input.value);});
    input.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'&&visibleRows.length){e.preventDefault();activeIndex=(activeIndex+1)%visibleRows.length;repaintActive();return;}
      if(e.key==='ArrowUp'&&visibleRows.length){e.preventDefault();activeIndex=(activeIndex-1+visibleRows.length)%visibleRows.length;repaintActive();return;}
      if(e.key==='Enter'){
        if(visibleRows.length){e.preventDefault();choose(activeIndex<0?0:activeIndex);}
        else if(clean(input.value).length>=2){e.preventDefault();void suggest(input.value);}
        return;
      }
      if(e.key==='Escape'){closeSuggestions();input.select();}
    });
    input.addEventListener('blur',()=>setTimeout(closeSuggestions,140));
    clear?.addEventListener('click',()=>{input.value='';requestSeq++;closeSuggestions();input.focus();const status=host.querySelector('#a47-search-status');if(status)status.textContent='Escribe al menos 2 caracteres para recibir sugerencias.';});
    host.addEventListener('mousedown',e=>{if(e.target.closest('.a47-suggestion'))e.preventDefault();});
    host.addEventListener('click',e=>{const b=e.target.closest('.a47-suggestion');if(!b)return;e.preventDefault();choose(Number(b.dataset.a47Index));});
  }

  async function searchCompat(ev){
    ev?.preventDefault?.();
    const input=document.querySelector('#a47-entity-q');if(input)return suggest(input.value);
    return loadWorkspace();
  }

  function loadWorkspace(){
    if(typeof state!=='undefined'){state.view='entities';state.selectedEntity=null;}
    if(typeof shell==='function')shell('Entidad 360','Perfil interactivo: indicadores, trayectoria observable, alertas y contexto regulatorio.');
    selectedMeta=null;
    emptyWorkspace();mountSearch(null);
    const input=document.querySelector('#a47-entity-q');setTimeout(()=>input?.focus(),0);
    return Promise.resolve();
  }

  if(BASE_RENDER){
    const renderWithSearch=function(pkg,preserve=false){
      const result=BASE_RENDER(pkg,preserve);
      if(pkg?.e?.entity_id){selectedMeta={entity_id:pkg.e.entity_id,name:pkg.e.name||pkg.e.entity_id,rut:pkg.e.rut||'',region:pkg.e.region||'',commune:pkg.e.commune||''};}
      mountSearch(selectedMeta);
      const status=document.querySelector('#a47-search-status');if(status)status.textContent='Entidad cargada. Escribe para cambiar de expediente.';
      window.__ATLAS_ENTITY360_CURRENT__={...(window.__ATLAS_ENTITY360_CURRENT__||{}),release:RELEASE,build:BUILD,authority:AUTHORITY,inlineSearch:true,selectedEntity:pkg?.e?.entity_id||null,renderedAt:new Date().toISOString()};
      return result;
    };
    try{v0203RenderEntity=renderWithSearch;}catch(_error){}
    window.v0203RenderEntity=renderWithSearch;
  }

  ENTRY.version='0447';
  ENTRY.release=RELEASE;
  ENTRY.authority=AUTHORITY;
  ENTRY.load=loadWorkspace;
  ENTRY.search=searchCompat;
  ENTRY.open=openWorkspace;
  ENTRY.searchPolicy='DEBOUNCED_AUTOCOMPLETE_RLS_NAME_RUT_ENTITY_ID_NO_FUZZY_JOIN';
  ENTRY.workspacePolicy='SINGLE_DARK_DOSSIER_NO_SEPARATE_SEARCH_LANDING';

  try{loadEntities=loadWorkspace;}catch(_error){}
  try{searchEntities=searchCompat;}catch(_error){}
  try{openEntity=openWorkspace;}catch(_error){}
  window.loadEntities=loadWorkspace;
  window.searchEntities=searchCompat;
  window.openEntity=openWorkspace;
  window.__ATLAS_ENTITY_WORKSPACE__={active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,autocomplete:true,minChars:2,debounceMs:220,suggestionLimit:LIMIT,searchesPlaintextStored:false,selectionScopesAllEntityGraphics:true,installedAt:new Date().toISOString()};
})();
