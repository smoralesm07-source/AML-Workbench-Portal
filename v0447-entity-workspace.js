'use strict';

/* ATLAS AML 0.44.7 · Entity 360 integrated workspace authority
 * - Removes the separate/legacy white entity-search landing from the active route.
 * - Keeps the six-lens Entity 360 dossier as the only visual workspace.
 * - Adds a persistent, RLS-governed autocomplete switcher outside #content so
 *   background detail hydration cannot erase it.
 * - Selecting one canonical entity reuses the governed Entity 360 loader; all
 *   charts, metrics, ribbons and evidence panels are therefore scoped to the
 *   newly selected entity package.
 * - Search is federated: canonical aml_entities plus observations captured in
 *   press. Press-only results are explicitly marked as NOT RECONCILED and never
 *   receive an inferred RUT, Entity ID or automatic identity join.
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
  const PRESS_TTL=5*60*1000;
  const PRESS_FEED_URL='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const LIMIT=8;
  const FETCH_LIMIT=20;
  const PRESS_LIMIT=8;
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
  let pressCache={at:0,data:null};
  let pressInflight=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));}
  function clean(v){return String(v??'').trim().replace(/[%_]/g,'').slice(0,120);}
  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();}
  function content(){return typeof v019Content==='function'?v019Content():document.querySelector('#content');}
  function place(r){return [r?.commune,r?.region].filter(Boolean).join(' · ')||'territorio no materializado';}
  function fmt(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'—';}
  function articleUrl(a){return String(a?.source_url||a?.canonical_url||a?.url||'').trim();}
  function articleDate(a){return String(a?.published_at||a?.observed_at||'').trim();}
  function fmtDate(v){if(!v)return 'Sin fecha';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function safeUrl(v){try{const u=new URL(String(v||''),location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch(_error){return '';}}

  function searchShell(){
    return `<div class="a47-search-copy">
      <span>ENTIDAD 360 · IDENTIDAD + OBSERVACIONES</span>
      <strong>Buscar o cambiar entidad</strong>
      <small>Escribe nombre, RUT o Entity ID. ATLAS busca identidades canónicas y observaciones de prensa; las coincidencias sin conciliación se muestran expresamente como “No conciliada”.</small>
    </div>
    <div class="a47-search-control">
      <div class="a47-combobox" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-owns="a47-suggestions">
        <span class="a47-search-icon" aria-hidden="true">⌕</span>
        <input id="a47-entity-q" type="search" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="a47-suggestions" placeholder="Ej.: Fodich, Falabella, 75317600-4 o ENT-RUT-…" />
        <button type="button" id="a47-clear" aria-label="Limpiar búsqueda" title="Limpiar">×</button>
        <div id="a47-suggestions" class="a47-suggestions" role="listbox" hidden></div>
      </div>
      <div id="a47-search-status" class="a47-search-status">Escribe al menos 2 caracteres para recibir sugerencias.</div>
    </div>
    <div id="a47-selected" class="a47-selected"></div>`;
  }

  function selectedMarkup(meta){
    if(meta?.__pressOnly)return `<span>Observación de prensa</span><b>${esc(meta.name||'Observación sin nombre')}</b><small>NO CONCILIADA · sin RUT / Entity ID atribuido</small>`;
    if(!meta?.entity_id)return `<span>Sin entidad seleccionada</span><small>Selecciona una identidad canónica o una observación de prensa.</small>`;
    return `<span>Entidad activa</span><b>${esc(meta.name||meta.entity_id)}</b><small>${esc(meta.rut||'RUT no materializado')} · ${esc(meta.entity_id)}</small>`;
  }

  function setBusy(flag,label='Cargando expediente…'){
    const host=document.querySelector('#a47-entity-search-host');if(!host)return;
    host.classList.toggle('busy',!!flag);
    const input=host.querySelector('#a47-entity-q');if(input)input.disabled=!!flag;
    const status=host.querySelector('#a47-search-status');if(status&&flag)status.textContent=label;
  }

  function updateSelected(meta){
    if(meta?.entity_id||meta?.__pressOnly)selectedMeta={...meta};
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
    if(meta?.entity_id||meta?.__pressOnly)selectedMeta={...meta};
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
            <span class="a45-eyebrow">EXPEDIENTE ANALÍTICO 360 · IDENTIDAD Y DISCOVERY</span>
            <h1>Selecciona una entidad</h1>
            <p>El buscador superior carga identidades canónicas y también hace visibles observaciones de prensa aún no conciliadas, evitando falsos negativos de búsqueda.</p>
            <div class="a45-roles"><span class="neutral">RLS activo</span><span class="neutral">sin conciliación automática por nombre</span></div>
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
      <main><section class="a45-panel active"><div class="a45-panel-head"><span class="a45-eyebrow">ENTITY 360</span><h2>Una selección gobierna toda la ficha</h2><p>Una entidad conciliada abre su expediente 360. Una observación exclusivamente de prensa abre su evidencia de discovery y permanece separada hasta una conciliación formal.</p></div><article class="a45-card a47-empty-card"><h3>Comienza desde el buscador superior</h3><p>Las sugerencias aparecen a medida que escribes. ATLAS distingue la identidad canónica de una mera observación en fuente abierta.</p><div class="a47-principles"><span><b>Identidad</b> RUT/Entity ID gobiernan cruces.</span><span><b>Prensa</b> una mención no conciliada sigue siendo visible.</span><span><b>Vacíos</b> ausencia de dato no es cero.</span><span><b>Red</b> una relación no transfiere riesgo.</span></div></article></section></main>
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

  function pressLabels(row){return [row?.name].concat(Array.isArray(row?.aliases)?row.aliases:[]).map(v=>String(v||'').trim()).filter(Boolean);}

  function pressRank(row,term){
    const q=norm(term);if(!q)return 99;let best=99;
    for(const label of pressLabels(row)){
      const n=norm(label);
      if(n===q)best=Math.min(best,0);
      else if(n.startsWith(q))best=Math.min(best,1);
      else if(n.split(' ').some(x=>x.startsWith(q)))best=Math.min(best,2);
      else if(n.includes(q))best=Math.min(best,3);
      else {const parts=q.split(' ').filter(Boolean);if(parts.length&&parts.every(p=>n.includes(p)))best=Math.min(best,4);}
    }
    return best;
  }

  async function loadPressFeed(){
    if(pressCache.data&&Date.now()-pressCache.at<PRESS_TTL)return pressCache.data;
    if(pressInflight)return pressInflight;
    pressInflight=fetch(PRESS_FEED_URL,{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error(`Prensa HTTP ${response.status}`);
      return response.json();
    }).then(raw=>{
      const entities=Array.isArray(raw?.entities)?raw.entities:[];
      const mentions=Array.isArray(raw?.mentions)?raw.mentions:[];
      const articles=Array.isArray(raw?.articles)?raw.articles:[];
      const byArticle=new Map(articles.map(a=>[String(a?.article_id||''),a]));
      const byEntity=new Map();
      for(const mention of mentions){const key=String(mention?.press_entity_id||'');if(!key)continue;const list=byEntity.get(key)||[];list.push(mention);byEntity.set(key,list);}
      const data={entities,mentions,articles,byArticle,byEntity,meta:raw?.meta||{}};
      pressCache={at:Date.now(),data};return data;
    }).finally(()=>{pressInflight=null;});
    return pressInflight;
  }

  function observedNameFromText(text,term){
    const raw=String(text||'');
    const target=(norm(term).split(' ').filter(Boolean).pop()||'');
    if(target.length<3)return '';
    const words=[];const re=/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]*/g;let match;
    while((match=re.exec(raw)))words.push({word:match[0],index:match.index});
    let hit=-1;
    for(let i=0;i<words.length;i++){const n=norm(words[i].word);if(n===target||n.includes(target)||(n.length>=3&&target.includes(n))){hit=i;break;}}
    if(hit<0||!/^[A-ZÁÉÍÓÚÜÑ]/.test(words[hit].word))return '';
    let start=hit,end=hit;
    for(let i=hit-1,taken=0;i>=0&&taken<2;i--){const gap=raw.slice(words[i].index+words[i].word.length,words[i+1].index);if(/[,.!?;:()\[\]\n]/.test(gap)||!/^[A-ZÁÉÍÓÚÜÑ]/.test(words[i].word))break;start=i;taken++;}
    for(let i=hit+1,taken=0;i<words.length&&taken<2;i++){const gap=raw.slice(words[i-1].index+words[i-1].word.length,words[i].index);if(/[,.!?;:()\[\]\n]/.test(gap)||!/^[A-ZÁÉÍÓÚÜÑ]/.test(words[i].word))break;end=i;taken++;}
    const stop=new Set(['MIENTRAS','ADEMAS','ADEMÁS','SEGUN','SEGÚN','TRAS','LUEGO','POR','PARA','CON','SIN','DEL','DE','LA','EL']);
    const out=words.slice(start,end+1).map(x=>x.word);
    while(out.length>1&&stop.has(norm(out[0])))out.shift();
    while(out.length>1&&stop.has(norm(out[out.length-1])))out.pop();
    if(out.length<2||out.length>4)return '';
    return out.join(' ');
  }

  async function fetchCanonicalSuggestions(term){
    if(typeof sb==='undefined')throw new Error('Supabase no disponible');
    let q=sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned');
    if(/^ENT-/i.test(term))q=q.ilike('entity_id',`${term.toUpperCase()}%`);
    else if(/^[0-9kK.\-\s]+$/.test(term))q=q.ilike('rut',`%${term.replace(/[.\s]/g,'')}%`);
    else q=q.ilike('name',`%${term}%`);
    const {data,error}=await q.order('source_count',{ascending:false}).limit(FETCH_LIMIT);
    if(error)throw error;
    return (data||[]).slice().sort((a,b)=>rank(a,term)-rank(b,term)||(Number(b.source_count)||0)-(Number(a.source_count)||0)||String(a.name||'').localeCompare(String(b.name||''),'es'));
  }

  async function fetchPressSuggestions(term){
    if(/^ENT-/i.test(term)||/^[0-9kK.\-\s]+$/.test(term))return [];
    const feed=await loadPressFeed();
    const found=new Map();
    for(let i=0;i<feed.entities.length;i++){
      const raw=feed.entities[i]||{};
      const row={__pressOnly:true,reconciled:false,press_entity_id:String(raw.press_entity_id||`press:${i}`),name:String(raw.name||'').trim(),aliases:Array.isArray(raw.aliases)?raw.aliases.map(v=>String(v||'').trim()).filter(Boolean):[],article_count:Number(raw.article_count||0),last_seen:String(raw.last_seen||'')};
      if(!row.name||pressRank(row,term)>=99)continue;
      found.set(norm(row.name),row);
    }
    const q=norm(term);
    if(q.length>=3){
      for(const article of feed.articles){
        const text=[article?.headline,article?.summary].filter(Boolean).join(' ');
        if(!norm(text).includes(q))continue;
        const name=observedNameFromText(text,term);if(!name)continue;
        const key=norm(name);if(!key)continue;
        const articleId=String(article?.article_id||'');
        const existing=found.get(key);
        if(existing){
          if(existing.__synthetic){if(articleId&&!existing.article_ids.includes(articleId))existing.article_ids.push(articleId);existing.article_count=Math.max(existing.article_count,existing.article_ids.length);const seen=articleDate(article);if(seen&&(!existing.last_seen||seen>existing.last_seen))existing.last_seen=seen;}
          continue;
        }
        found.set(key,{__pressOnly:true,__synthetic:true,reconciled:false,press_entity_id:`press-text:${key.replace(/\s+/g,'_')}`,name,aliases:[],article_count:1,last_seen:articleDate(article),article_ids:articleId?[articleId]:[]});
      }
    }
    return [...found.values()].sort((a,b)=>pressRank(a,term)-pressRank(b,term)||(Number(b.article_count)||0)-(Number(a.article_count)||0)||String(a.name||'').localeCompare(String(b.name||''),'es')).slice(0,PRESS_LIMIT);
  }

  async function fetchSuggestions(term){
    const key=norm(term);const cached=CACHE.get(key);
    if(cached&&Date.now()-cached.at<CACHE_TTL)return cached.rows;
    const [canonicalResult,pressResult]=await Promise.allSettled([fetchCanonicalSuggestions(term),fetchPressSuggestions(term)]);
    const canonical=canonicalResult.status==='fulfilled'?canonicalResult.value:[];
    const press=pressResult.status==='fulfilled'?pressResult.value:[];
    if(canonicalResult.status==='rejected'&&pressResult.status==='rejected')throw canonicalResult.reason||pressResult.reason||new Error('Fuentes de búsqueda no disponibles');
    const scored=canonical.map(row=>({row,score:rank(row,term),press:0,coverage:Number(row.source_count)||0})).concat(press.map(row=>({row,score:pressRank(row,term),press:1,coverage:Number(row.article_count)||0}))).sort((a,b)=>a.score-b.score||a.press-b.press||b.coverage-a.coverage||String(a.row.name||'').localeCompare(String(b.row.name||''),'es'));
    let rows=scored.slice(0,LIMIT).map(x=>x.row);
    if(press.length&&!rows.some(r=>r.__pressOnly)){rows=rows.length>=LIMIT?rows.slice(0,LIMIT-1).concat(press[0]):rows.concat(press[0]);}
    CACHE.set(key,{at:Date.now(),rows});
    return rows;
  }

  function suggestionMarkup(row,index){
    if(row.__pressOnly){
      const count=Math.max(Number(row.article_count)||0,Array.isArray(row.article_ids)?row.article_ids.length:0);
      const meta=[count?`${fmt(count)} ${count===1?'publicación':'publicaciones'}`:'Observada en prensa',row.last_seen?`última ${fmtDate(row.last_seen)}`:null].filter(Boolean).join(' · ');
      return `<button type="button" class="a47-suggestion ${index===activeIndex?'active':''}" role="option" aria-selected="${index===activeIndex?'true':'false'}" data-a47-index="${index}">
        <div><b>${esc(row.name||'Observación de prensa')}</b><span>${esc(meta)}</span><small>Sin RUT / Entity ID conciliado</small><em><i>Prensa</i><i>No conciliada</i></em></div>
        <aside><strong>${fmt(count)}</strong><small>publicaciones</small></aside>
      </button>`;
    }
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
    box.innerHTML=rows.length?rows.map(suggestionMarkup).join(''):`<div class="a47-no-suggestion">Sin coincidencias en entidades conciliadas ni observaciones de prensa para “${esc(term)}”.</div>`;
    box.hidden=false;combo?.setAttribute('aria-expanded','true');
    if(status){const canonical=rows.filter(r=>!r.__pressOnly).length,press=rows.filter(r=>r.__pressOnly).length;status.textContent=rows.length?`${rows.length} sugerencia(s): ${canonical} conciliada(s) · ${press} observación(es) de prensa no conciliada(s).`:'No se encontraron coincidencias.';}
  }

  function repaintActive(){
    document.querySelectorAll('.a47-suggestion').forEach((node,i)=>{const active=i===activeIndex;node.classList.toggle('active',active);node.setAttribute('aria-selected',active?'true':'false');if(active)node.scrollIntoView({block:'nearest'});});
  }

  async function suggest(term){
    const cleanTerm=clean(term),status=document.querySelector('#a47-search-status');
    if(cleanTerm.length<2){closeSuggestions();if(status)status.textContent='Escribe al menos 2 caracteres para recibir sugerencias.';return;}
    const seq=++requestSeq;if(status)status.textContent='Buscando entidades y observaciones de prensa…';
    try{const rows=await fetchSuggestions(cleanTerm);if(seq!==requestSeq)return;renderSuggestions(rows,cleanTerm);}catch(error){if(seq!==requestSeq)return;closeSuggestions();if(status)status.textContent='No fue posible obtener sugerencias: '+String(error?.message||error);}
  }

  async function auditSelection(term,row){
    try{
      if(typeof sha256!=='function'||typeof audit!=='function')return;
      const hash=await sha256(clean(term).toLocaleLowerCase('es-CL'));
      await audit('SEARCH',{objectType:row.__pressOnly?'press_observation':'entity',objectId:row.__pressOnly?String(row.press_entity_id||row.name||''):row.entity_id,queryHash:hash,queryLength:clean(term).length,payload:{mode:'entity360_autocomplete_0447',selected:true,reconciled:!row.__pressOnly,source:row.__pressOnly?'press':'aml_entities'}});
    }catch(_error){}
  }

  function relatedPressArticles(feed,row){
    const ids=[];
    if(Array.isArray(row?.article_ids))ids.push(...row.article_ids.map(String));
    if(!ids.length&&row?.press_entity_id){for(const mention of (feed.byEntity.get(String(row.press_entity_id))||[])){const id=String(mention?.article_id||'');if(id)ids.push(id);}}
    const seen=new Set();
    return ids.map(id=>feed.byArticle.get(String(id))).filter(article=>{if(!article)return false;const key=String(article.article_id||articleUrl(article));if(!key||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>articleDate(b).localeCompare(articleDate(a)));
  }

  function renderPressObservation(row,feed){
    const articles=relatedPressArticles(feed,row);
    const aliases=Array.isArray(row.aliases)?row.aliases.filter(Boolean):[];
    const total=Math.max(Number(row.article_count)||0,articles.length);
    const articleCards=articles.slice(0,10).map(article=>{
      const title=article.headline||article.title||'Publicación de prensa';
      const source=article.source_name||article.source||'Prensa';
      const summary=article.summary||'';
      const url=safeUrl(articleUrl(article));
      return `<article class="a45-card"><div class="a45-card-head"><span class="a45-eyebrow">${esc(source)}</span><h3>${esc(title)}</h3><small>${esc(fmtDate(articleDate(article)))}</small></div>${summary?`<p>${esc(summary)}</p>`:''}${url?`<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir fuente original ↗</a></p>`:''}</article>`;
    }).join('');
    return `<div class="a45 a47-press-observation">
      <section class="a45-cover">
        <div class="a45-command"><div><span class="a45-live">Discovery de prensa</span></div></div>
        <div class="a45-cover-grid">
          <div class="a45-identity">
            <span class="a45-eyebrow">OBSERVACIÓN EN FUENTE ABIERTA · NO CONCILIADA</span>
            <h1>${esc(row.name||'Observación de prensa')}</h1>
            <p>ATLAS encontró esta identidad nominal en prensa, pero aún no existe una conciliación gobernada con una entidad canónica. La observación se muestra para evitar un falso negativo de búsqueda.</p>
            <div class="a45-roles"><span class="neutral">Prensa</span><span class="neutral">No conciliada</span><span class="neutral">sin RUT inferido</span></div>
          </div>
          <div class="a45-readings">
            <div><span>Publicaciones</span><strong>${esc(fmt(total))}</strong><em>evidencia observada</em></div>
            <div><span>Última observación</span><strong>${esc(fmtDate(row.last_seen||articleDate(articles[0])))}</strong><em>según feed de prensa</em></div>
            <div><span>Estado identidad</span><strong class="tier">NO CONCILIADA</strong><em>no habilita cruces canónicos</em></div>
          </div>
        </div>
      </section>
      <main>
        <section class="a45-panel active">
          <div class="a45-panel-head"><span class="a45-eyebrow">DISCOVERY</span><h2>Evidencia de prensa</h2><p>Seleccionar este resultado no crea una entidad, no atribuye un RUT y no vincula automáticamente la observación con terceros de nombre similar.</p></div>
          <article class="a45-card"><h3>Estado metodológico</h3><p><b>Resultado informativo:</b> existe evidencia nominal en prensa, pero la identidad permanece pendiente de conciliación. ${aliases.length?`Aliases observados: ${esc(aliases.join(', '))}.`:''}</p></article>
          ${articleCards||`<article class="a45-card"><h3>Publicaciones vinculadas</h3><p>La observación fue localizada en el índice de prensa, pero el feed actual no entregó artículos vinculados mediante identificador. Se mantiene visible como no conciliada.</p></article>`}
        </section>
      </main>
    </div>`;
  }

  async function openPressObservation(row,term=''){
    if(!row?.__pressOnly||opening)return;
    opening=true;selectedMeta={...row};
    try{
      if(typeof state!=='undefined'){state.view='entities';state.selectedEntity=null;}
      closeSuggestions();updateSelected(row);setBusy(true,`Cargando observación de prensa: ${row.name||''}…`);
      if(term)void auditSelection(term,row);
      const feed=await loadPressFeed();
      const c=content();if(!c)throw new Error('Workspace de entidades no disponible');
      c.innerHTML=renderPressObservation(row,feed);
      mountSearch(row);
      const status=document.querySelector('#a47-search-status');if(status)status.textContent='Observación de prensa cargada · NO CONCILIADA. Escribe para buscar otra identidad.';
      window.__ATLAS_ENTITY360_CURRENT__={release:RELEASE,build:BUILD,authority:AUTHORITY,mode:'press-observation-unreconciled',selectedEntity:null,pressEntityId:row.press_entity_id||null,reconciled:false,renderedAt:new Date().toISOString()};
    }catch(error){
      const status=document.querySelector('#a47-search-status');if(status)status.textContent='No fue posible abrir la observación de prensa: '+String(error?.message||error);
      throw error;
    }finally{opening=false;setBusy(false);}
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
    if(input)input.value=row.name||row.rut||row.entity_id||'';
    if(row.__pressOnly){void openPressObservation(row,term);return;}
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
    if(typeof shell==='function')shell('Entidad 360','Perfil interactivo: identidad canónica, observaciones de prensa, trayectoria observable, alertas y contexto regulatorio.');
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
  ENTRY.openPressObservation=openPressObservation;
  ENTRY.searchPolicy='FEDERATED_AML_ENTITIES_PLUS_PRESS_UNRECONCILED_NO_AUTOMATIC_IDENTITY_JOIN';
  ENTRY.workspacePolicy='SINGLE_DARK_DOSSIER_NO_SEPARATE_SEARCH_LANDING';

  try{loadEntities=loadWorkspace;}catch(_error){}
  try{searchEntities=searchCompat;}catch(_error){}
  try{openEntity=openWorkspace;}catch(_error){}
  window.loadEntities=loadWorkspace;
  window.searchEntities=searchCompat;
  window.openEntity=openWorkspace;
  window.__ATLAS_ENTITY_WORKSPACE__={active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,autocomplete:true,minChars:2,debounceMs:220,suggestionLimit:LIMIT,searchesPlaintextStored:false,selectionScopesAllEntityGraphics:true,pressDiscovery:true,unreconciledPressVisible:true,automaticPressReconciliation:false,installedAt:new Date().toISOString()};
})();