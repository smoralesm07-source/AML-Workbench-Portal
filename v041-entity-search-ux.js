(function(){
  'use strict';

  const VERSION='0410';
  const PREVIEW_LIMIT=8;
  const FULL_LIMIT=50;
  let liveTimer=null;
  let liveSeq=0;
  let contentObserver=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmt(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'0';}
  function clean(v){return String(v??'').trim().replace(/[%_,()]/g,'').replace(/\s+/g,' ').slice(0,120);}

  function ensureStyles(){
    if(document.querySelector('link[data-atlas-entity-search-v041]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./v041-entity-search-ux.css?b=0410';
    link.dataset.atlasEntitySearchV041='1';
    document.head.appendChild(link);
  }

  function classify(q){
    if(/^ENT-/i.test(q))return {kind:'entity_id',label:'Entity ID'};
    if(/^[0-9kK.\-\s]+$/.test(q))return {kind:'rut',label:'RUT'};
    return {kind:'name',label:'razón social'};
  }

  function applyFilter(query,q){
    const mode=classify(q);
    if(mode.kind==='entity_id')return {query:query.ilike('entity_id',`${q.toUpperCase()}%`),mode};
    if(mode.kind==='rut'){
      const compact=q.replace(/[^0-9kK]/g,'').toUpperCase();
      const value=compact.length>=7?`${compact.slice(0,-1)}-${compact.slice(-1)}`:q.replace(/[.\s]/g,'').toUpperCase();
      return {query:query.ilike('rut',`%${value}%`),mode};
    }
    const terms=q.split(' ').map(x=>x.trim()).filter(Boolean).slice(0,8);
    const pattern=`%${terms.join('%')}%`;
    return {query:query.ilike('name',pattern),mode};
  }

  async function queryEntities(q,limit){
    if(typeof sb==='undefined')throw new Error('Fuente de entidades no disponible');
    const fields='entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,snapshot_id,updated_at';
    let builder=sb.from('aml_entities').select(fields,{count:'exact'});
    const filtered=applyFilter(builder,q);
    const {data,error,count}=await filtered.query.order('source_count',{ascending:false}).limit(limit);
    if(error)throw error;
    return {rows:data||[],count:Number(count)||0,mode:filtered.mode};
  }

  function card(r){
    const place=[r.commune,r.region].filter(Boolean).join(' · ')||'Territorio no materializado';
    return `<button type="button" class="v0391-entity-card v041-result-card" data-v041-entity="${esc(r.entity_id)}"><div><h4>${esc(r.name||r.entity_id)}</h4><p>${esc(r.rut||'RUT no materializado')} · ${esc(place)}</p><div class="meta"><span>${esc(r.entity_type||'Entidad')}</span>${r.is_uaf_observed?'<span class="uaf">UAF observado</span>':''}${r.is_sanctioned?'<span class="san">Con sanciones</span>':''}</div></div><div class="sources"><b>${fmt(r.source_count)}</b><span>fuentes</span></div></button>`;
  }

  function bindCards(root){
    root.querySelectorAll('[data-v041-entity]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.v041Entity;
        if(typeof window.openEntity==='function')window.openEntity(id);
      });
    });
  }

  function setStatus(text,state='idle'){
    const node=document.querySelector('#v041-search-status');
    if(!node)return;
    node.textContent=text;
    node.dataset.state=state;
  }

  function setExpanded(expanded){
    const input=document.querySelector('#entity-q');
    if(input)input.setAttribute('aria-expanded',String(Boolean(expanded)));
  }

  function renderResults(payload,{full=false}={}){
    const box=document.querySelector('#entity-results');
    if(!box)return;
    const {rows,count,mode}=payload;
    box.className='v041-results';
    box.setAttribute('aria-live','polite');
    if(!count){
      box.innerHTML='<div class="v041-empty"><b>Sin coincidencias</b><span>Prueba con una razón social más corta, RUT o Entity ID.</span></div>';
      setStatus(`0 coincidencias · interpretado como ${mode.label}`,'empty');
      setExpanded(false);
      return;
    }
    const shown=rows.length;
    const lead=full
      ? `${fmt(count)} coincidencia${count===1?'':'s'} · mostrando ${fmt(shown)}${count>shown?` de ${fmt(count)}`:''}`
      : `${fmt(count)} posible${count===1?'':'s'} coincidencia${count===1?'':'s'} · interpretado como ${mode.label}`;
    const footer=!full&&count>shown?`<div class="v041-more">Mostrando los ${shown} resultados con mayor cobertura. Presiona Enter para ver hasta ${FULL_LIMIT}.</div>`:'';
    box.innerHTML=`<div class="v041-result-summary"><span>${esc(lead)}</span><small>Selecciona una entidad para abrir Entity 360</small></div><div class="v041-result-grid">${rows.map(card).join('')}</div>${footer}`;
    bindCards(box);
    setStatus(lead,'found');
    setExpanded(true);
  }

  function resetResults(message='Escribe al menos 2 caracteres para buscar'){
    const box=document.querySelector('#entity-results');
    if(box){box.className='v041-results v041-results-idle';box.innerHTML=`<div class="v041-empty compact"><span>${esc(message)}</span></div>`;}
    setStatus('Listo para buscar','idle');
    setExpanded(false);
  }

  async function runLiveSearch(q){
    const seq=++liveSeq;
    setStatus('Buscando coincidencias…','loading');
    const box=document.querySelector('#entity-results');
    if(box){box.className='v041-results';box.innerHTML='<div class="v041-loading">Buscando coincidencias…</div>';}
    try{
      const payload=await queryEntities(q,PREVIEW_LIMIT);
      if(seq!==liveSeq)return;
      renderResults(payload,{full:false});
    }catch(e){
      if(seq!==liveSeq)return;
      if(box){box.className='v041-results';box.innerHTML=`<div class="v041-empty error"><b>No fue posible buscar</b><span>${esc(e?.message||e)}</span></div>`;}
      setStatus('Búsqueda no disponible','error');
      setExpanded(false);
    }
  }

  async function runFullSearch(ev){
    ev?.preventDefault?.();
    clearTimeout(liveTimer);
    const input=document.querySelector('#entity-q');
    if(!input)return;
    const q=clean(input.value);
    if(q.length<2){resetResults();input.focus();return;}
    const seq=++liveSeq;
    setStatus('Resolviendo búsqueda…','loading');
    const box=document.querySelector('#entity-results');
    if(box){box.className='v041-results';box.innerHTML='<div class="v041-loading">Resolviendo identidad y cobertura…</div>';}
    try{
      if(typeof sha256==='function'&&typeof audit==='function'){
        const hash=await sha256(q.toLocaleLowerCase('es-CL'));
        await audit('SEARCH',{objectType:'entity',queryHash:hash,queryLength:q.length,payload:{mode:'entity_search_v041'}}).catch(()=>{});
      }
      const payload=await queryEntities(q,FULL_LIMIT);
      if(seq!==liveSeq)return;
      renderResults(payload,{full:true});
    }catch(e){
      if(seq!==liveSeq)return;
      if(box){box.className='v041-results';box.innerHTML=`<div class="v041-empty error"><b>No fue posible ejecutar la búsqueda</b><span>${esc(e?.message||e)}</span></div>`;}
      setStatus('Búsqueda no disponible','error');
    }
  }

  function removeLegacyNote(){document.querySelector('#v0344-entities-note')?.remove();}

  function bindSearch(){
    const searchbox=document.querySelector('.v0391-searchbox');
    const oldForm=document.querySelector('#entity-search');
    const existingResults=document.querySelector('#entity-results');
    if(!searchbox||!oldForm||!existingResults)return;

    searchbox.classList.add('v041-searchbox');
    document.querySelector('.v0391-entry-hero')?.remove();
    removeLegacyNote();

    if(!searchbox.querySelector('.v041-search-head')){
      searchbox.insertAdjacentHTML('afterbegin','<div class="v041-search-head"><div><span>ENTIDADES · ENTITY 360</span><h2>Buscar entidad</h2><p>Escribe una razón social, RUT o Entity ID. ATLAS interpreta la consulta y muestra coincidencias potenciales mientras escribes.</p></div><div id="v041-search-status" data-state="idle">Listo para buscar</div></div>');
    }

    const resultSection=existingResults.closest('.v0391-section');
    if(existingResults.parentElement!==searchbox){
      searchbox.appendChild(existingResults);
      if(resultSection&&resultSection!==searchbox)resultSection.remove();
    }

    let form=oldForm;
    if(!form.dataset.v041Bound){
      const clone=form.cloneNode(true);
      form.replaceWith(clone);
      form=clone;
      form.dataset.v041Bound='1';
      const submit=form.querySelector('button[type="submit"]');
      if(submit){submit.textContent='Buscar';submit.classList.add('v041-search-submit');}
      const clear=document.createElement('button');
      clear.type='button';clear.className='v041-search-clear';clear.textContent='Limpiar';clear.hidden=true;
      form.appendChild(clear);

      const input=form.querySelector('#entity-q');
      if(input){
        input.placeholder='Razón social, RUT o Entity ID';
        input.setAttribute('aria-label','Buscar entidad por razón social, RUT o Entity ID');
        input.setAttribute('aria-controls','entity-results');
        input.setAttribute('aria-autocomplete','list');
        input.setAttribute('aria-expanded','false');
        input.autocomplete='off';
        input.spellcheck=false;
        input.addEventListener('input',()=>{
          const q=clean(input.value);
          clear.hidden=!q;
          clearTimeout(liveTimer);
          ++liveSeq;
          if(q.length<2){resetResults(q?'Escribe un carácter más para buscar':'Escribe al menos 2 caracteres para buscar');return;}
          setStatus(`Interpretando ${classify(q).label}…`,'loading');
          liveTimer=setTimeout(()=>runLiveSearch(q),280);
        });
        input.addEventListener('keydown',ev=>{
          if(ev.key==='Escape'&&input.value){ev.preventDefault();input.value='';clear.hidden=true;resetResults();input.focus();}
        });
      }
      clear.addEventListener('click',()=>{
        if(!input)return;
        input.value='';clear.hidden=true;++liveSeq;clearTimeout(liveTimer);resetResults();input.focus();
      });
      form.addEventListener('submit',runFullSearch);
    }

    const help=searchbox.querySelector('.v0391-search-help');
    if(help)help.innerHTML='<span>Consulta protegida por RLS · el texto plano no se almacena en la auditoría.</span><span>Búsqueda asistida · hasta 50 resultados</span>';

    const input=form.querySelector('#entity-q');
    if(input&&clean(input.value).length>=2){
      clearTimeout(liveTimer);
      liveTimer=setTimeout(()=>runLiveSearch(clean(input.value)),80);
    }else resetResults();
  }

  function enhance(){
    ensureStyles();
    removeLegacyNote();
    if(document.querySelector('.v0391-entities'))bindSearch();
  }

  function observeContent(){
    const content=document.querySelector('#content');
    if(!content||contentObserver)return;
    contentObserver=new MutationObserver(()=>{
      removeLegacyNote();
      if(document.querySelector('.v0391-entities')&&!document.querySelector('#entity-search[data-v041-bound="1"]'))queueMicrotask(enhance);
    });
    contentObserver.observe(content,{childList:true,subtree:true});
  }

  ensureStyles();
  const baseLoad=typeof window.loadEntities==='function'?window.loadEntities:null;
  if(baseLoad){
    const patched=async function(...args){
      const result=await baseLoad(...args);
      queueMicrotask(enhance);
      setTimeout(enhance,60);
      return result;
    };
    try{loadEntities=patched;}catch{}
    window.loadEntities=patched;
  }
  try{searchEntities=runFullSearch;}catch{}
  window.searchEntities=runFullSearch;
  window.__ATLAS_ENTITY_SEARCH__={version:VERSION,enhance,search:runFullSearch};

  observeContent();
  enhance();
  setTimeout(enhance,120);
})();
