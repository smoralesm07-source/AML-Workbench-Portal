'use strict';

/* ATLAS · Entidades press-search bridge · 2026-08-28 · perf1
 * Performance-safe compatibility bridge for the 0512 explorer.
 *
 * Invariants:
 * - canonical aml_entities search is never blocked by the press feed;
 * - no extra Supabase lookup is added to Buscar/Enter;
 * - press-only observations remain unreconciled and never receive inferred RUT;
 * - the press feed is fetched/indexed once per TTL and searched in-memory;
 * - expensive text normalization is done once when the feed is indexed, not on
 *   every keystroke.
 */
(function atlasEntityPressSearchBridge20260828(){
  const FLAG='__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_20260828__';
  const FEED_URL='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const BUILD='20260828-perf1';
  const PRESS_MIN_CHARS=3;
  const LIMIT=4;
  const TTL=5*60*1000;
  const RESULT_CACHE_LIMIT=48;
  const BUILD_CHUNK=240;
  if(window[FLAG])return;
  window[FLAG]=true;

  let feedCache={at:0,entities:[],articles:[]};
  let feedInflight=null;
  let timer=null;
  let seq=0;
  let latest={term:'',rows:[]};
  const resultCache=new Map();
  const metrics={
    build:BUILD,
    feedLoads:0,
    feedCacheHits:0,
    resultCacheHits:0,
    indexedEntities:0,
    indexedArticles:0,
    feedBuildMs:null,
    lastSearchMs:null,
    lastSearchTerm:'',
    lastSearchRows:0
  };

  const clean=v=>String(v??'').trim().replace(/[%_]/g,'').slice(0,120);
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entry=()=>window.__ATLAS_ENTITY_ENTRY__||null;
  const input=()=>document.querySelector('.aex #aex-q');
  const box=()=>document.querySelector('.aex #aex-suggest');
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};
  const now=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
  const nextTick=()=>new Promise(resolve=>setTimeout(resolve,0));

  function fetcher(){
    const native=window.__ATLAS_PRESS_NATIVE_FETCH__;
    if(typeof native==='function')return native;
    return window.fetch.bind(window);
  }

  function articleId(article,index){return String(article?.article_id||article?.id||`PRESS-ARTICLE-${index}`);}
  function articleDate(article){return String(article?.published_at||article?.observed_at||article?.date||article?.fecha||'').trim();}
  function articleText(article){
    return [
      article?.headline,article?.title,article?.titular,
      article?.summary,article?.bajada,article?.description,article?.excerpt,article?.lead,
      article?.source,article?.source_name,article?.media,article?.medio
    ].filter(Boolean).join(' ');
  }

  function normalizeEntity(raw,index){
    const name=String(raw?.name||raw?.nombre||'').trim();
    const aliases=(Array.isArray(raw?.aliases)?raw.aliases:[]).map(v=>String(v||'').trim()).filter(Boolean);
    return {
      raw,
      press_entity_id:String(raw?.press_entity_id||raw?.entity_id||`press:${index}`),
      name,
      aliases,
      article_count:Number(raw?.article_count||raw?.mentions_count||0),
      last_seen:String(raw?.last_seen||raw?.observed_at||''),
      labelsNorm:[name,...aliases].map(norm).filter(Boolean)
    };
  }

  function normalizeArticle(raw,index){
    const article={
      ...raw,
      article_id:articleId(raw,index),
      published_at:articleDate(raw),
      headline:raw?.headline||raw?.title||raw?.titular||'',
      summary:raw?.summary||raw?.bajada||raw?.description||raw?.excerpt||raw?.lead||'',
      source:raw?.source||raw?.source_name||raw?.media||raw?.medio||'',
      source_url:raw?.source_url||raw?.canonical_url||raw?.url||raw?.link||''
    };
    const text=articleText(article);
    return {article,text,textNorm:norm(text)};
  }

  async function buildIndex(raw){
    const started=now();
    const sourceEntities=Array.isArray(raw?.entities)?raw.entities:[];
    const sourceArticles=Array.isArray(raw?.articles)?raw.articles:[];
    const entities=[];
    const articles=[];

    for(let i=0;i<sourceEntities.length;i++){
      const item=normalizeEntity(sourceEntities[i],i);
      if(item.name)entities.push(item);
      if(i>0&&i%BUILD_CHUNK===0)await nextTick();
    }
    for(let i=0;i<sourceArticles.length;i++){
      articles.push(normalizeArticle(sourceArticles[i],i));
      if(i>0&&i%BUILD_CHUNK===0)await nextTick();
    }

    metrics.indexedEntities=entities.length;
    metrics.indexedArticles=articles.length;
    metrics.feedBuildMs=Math.round((now()-started)*10)/10;
    return {entities,articles};
  }

  async function loadIndex(){
    if((feedCache.entities.length||feedCache.articles.length)&&Date.now()-feedCache.at<TTL){
      metrics.feedCacheHits+=1;
      return feedCache;
    }
    if(feedInflight)return feedInflight;

    metrics.feedLoads+=1;
    feedInflight=fetcher()(FEED_URL,{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error(`Prensa HTTP ${response.status}`);
      return response.json();
    }).then(buildIndex).then(index=>{
      feedCache={at:Date.now(),...index};
      resultCache.clear();
      return feedCache;
    }).finally(()=>{feedInflight=null;});
    return feedInflight;
  }

  function warmIndex(){
    if((feedCache.entities.length||feedCache.articles.length)&&Date.now()-feedCache.at<TTL)return;
    if(feedInflight)return;
    const start=()=>void loadIndex().catch(()=>{});
    if(typeof requestIdleCallback==='function')requestIdleCallback(start,{timeout:700});
    else setTimeout(start,90);
  }

  function observedNameFromText(text,term){
    const raw=String(text||'');
    const target=(norm(term).split(' ').filter(Boolean).pop()||'');
    if(target.length<3)return '';
    const words=[];
    const re=/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’.-]*/g;
    let match;
    while((match=re.exec(raw)))words.push({word:match[0],index:match.index});
    let hit=-1;
    for(let i=0;i<words.length;i++){
      const n=norm(words[i].word);
      if(n===target||n.includes(target)||(n.length>=3&&target.includes(n))){hit=i;break;}
    }
    if(hit<0||!/^[A-ZÁÉÍÓÚÜÑ]/.test(words[hit].word))return '';
    let start=hit,end=hit;
    for(let i=hit-1,taken=0;i>=0&&taken<2;i--){
      const gap=raw.slice(words[i].index+words[i].word.length,words[i+1].index);
      if(/[,.!?;:()\[\]\n]/.test(gap)||!/^[A-ZÁÉÍÓÚÜÑ]/.test(words[i].word))break;
      start=i;taken++;
    }
    for(let i=hit+1,taken=0;i<words.length&&taken<2;i++){
      const gap=raw.slice(words[i-1].index+words[i-1].word.length,words[i].index);
      if(/[,.!?;:()\[\]\n]/.test(gap)||!/^[A-ZÁÉÍÓÚÜÑ]/.test(words[i].word))break;
      end=i;taken++;
    }
    const stop=new Set(['MIENTRAS','ADEMAS','ADEMÁS','SEGUN','SEGÚN','TRAS','LUEGO','POR','PARA','CON','SIN','DEL','DE','LA','EL']);
    const out=words.slice(start,end+1).map(x=>x.word);
    while(out.length>1&&stop.has(norm(out[0])))out.shift();
    while(out.length>1&&stop.has(norm(out[out.length-1])))out.pop();
    if(out.length<2||out.length>4)return '';
    return out.join(' ');
  }

  function resultCacheGet(key){
    if(!resultCache.has(key))return null;
    const rows=resultCache.get(key);
    resultCache.delete(key);
    resultCache.set(key,rows);
    metrics.resultCacheHits+=1;
    return rows.map(row=>({...row,article_ids:[...(row.article_ids||[])]}));
  }

  function resultCacheSet(key,rows){
    if(resultCache.has(key))resultCache.delete(key);
    resultCache.set(key,rows.map(row=>({...row,article_ids:[...(row.article_ids||[])]})));
    while(resultCache.size>RESULT_CACHE_LIMIT)resultCache.delete(resultCache.keys().next().value);
  }

  function entityRank(item,q){
    let best=99;
    for(const label of item.labelsNorm){
      if(label===q)best=Math.min(best,0);
      else if(label.startsWith(q))best=Math.min(best,1);
      else if(label.split(' ').some(token=>token.startsWith(q)))best=Math.min(best,2);
      else if(label.includes(q))best=Math.min(best,3);
    }
    return best;
  }

  function putFound(found,row){
    const key=norm(row.name);
    if(!key)return;
    const existing=found.get(key);
    if(!existing){found.set(key,row);return;}
    const ids=new Set([...(existing.article_ids||[]),...(row.article_ids||[])]);
    existing.article_ids=[...ids];
    existing.article_count=Math.max(Number(existing.article_count||0),ids.size,Number(row.article_count||0));
    if(row.last_seen&&(!existing.last_seen||row.last_seen>existing.last_seen))existing.last_seen=row.last_seen;
  }

  async function searchPress(term){
    const started=now();
    const q=clean(term);
    const nq=norm(q);
    if(nq.length<PRESS_MIN_CHARS||/^ENT-/i.test(q)||/^[0-9kK.\-\s]+$/.test(q))return [];

    const cached=resultCacheGet(nq);
    if(cached){
      metrics.lastSearchMs=Math.round((now()-started)*10)/10;
      metrics.lastSearchTerm=q;
      metrics.lastSearchRows=cached.length;
      return cached;
    }

    const index=await loadIndex();
    const found=new Map();

    for(const item of index.entities){
      const score=entityRank(item,nq);
      if(score>=99)continue;
      putFound(found,{
        __pressOnly:true,
        __synthetic:false,
        reconciled:false,
        press_entity_id:item.press_entity_id,
        name:item.name,
        aliases:item.aliases,
        article_count:item.article_count,
        last_seen:item.last_seen,
        article_ids:[],
        __pressRank:score
      });
    }

    for(const indexed of index.articles){
      if(!indexed.textNorm.includes(nq))continue;
      const name=observedNameFromText(indexed.text,q);
      if(!name)continue;
      const article=indexed.article;
      const id=article.article_id;
      putFound(found,{
        __pressOnly:true,
        __synthetic:true,
        reconciled:false,
        press_entity_id:`press-text:${norm(name).replace(/\s+/g,'_')}`,
        name,
        aliases:[],
        article_count:id?1:0,
        last_seen:article.published_at,
        article_ids:id?[id]:[],
        __pressRank:4
      });
    }

    const rows=[...found.values()]
      .sort((a,b)=>Number(a.__pressRank||9)-Number(b.__pressRank||9)||Number(b.article_count||0)-Number(a.article_count||0)||String(a.name||'').localeCompare(String(b.name||''),'es'))
      .slice(0,LIMIT)
      .map(({__pressRank,...row})=>row);

    resultCacheSet(nq,rows);
    metrics.lastSearchMs=Math.round((now()-started)*10)/10;
    metrics.lastSearchTerm=q;
    metrics.lastSearchRows=rows.length;
    return rows;
  }

  /* Kept for backwards-compatible diagnostics only. It is deliberately NOT
     called from Buscar/Enter, so canonical search never waits on a duplicate
     Supabase request. */
  async function hasCanonicalMatch(term){
    const q=clean(term);
    if(!q)return false;
    const db=client();
    if(!db)return null;
    try{
      const safe=q.replace(/[%_,()*"']/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
      let query=db.from('aml_entities').select('entity_id').limit(1);
      const compact=safe.replace(/[.\s-]/g,'');
      if(/^ENT-/i.test(safe))query=query.ilike('entity_id',`${safe.toUpperCase()}%`);
      else if(/^[0-9K]+$/i.test(compact))query=query.ilike('rut',`%${safe.replace(/[.\s]/g,'')}%`);
      else query=query.ilike('name',`%${safe}%`);
      const {data,error}=await query;
      if(error)return null;
      return Array.isArray(data)&&data.length>0;
    }catch(_error){return null;}
  }

  function pressMarkup(rows){
    return rows.map((row,index)=>`<button type="button" class="aex-suggest-item" data-aex-press-index="${index}">
      <span><b>${esc(row.name||'Observación de prensa')}</b><small>Prensa · ${Number(row.article_count||0).toLocaleString('es-CL')} publicación(es) · sin RUT inferido</small></span>
      <em>No conciliada</em>
    </button>`).join('');
  }

  function renderPressRows(term,rows){
    const host=box();
    const field=input();
    if(!host||!field||clean(field.value)!==clean(term))return;
    host.querySelector('[data-aex-press-bridge]')?.remove();
    if(!rows.length)return;
    const group=document.createElement('div');
    group.dataset.aexPressBridge='1';
    group.innerHTML=pressMarkup(rows);
    host.appendChild(group);
    host.classList.add('open');
    latest={term:clean(term),rows};
  }

  function preserveAfterCanonical(term,rows){
    if(!rows.length)return;
    setTimeout(()=>{
      const host=box();
      const field=input();
      if(!host||!field||clean(field.value)!==clean(term))return;
      if(!host.querySelector('[data-aex-press-bridge]'))renderPressRows(term,rows);
    },420);
  }

  async function refresh(term){
    const q=clean(term);
    const token=++seq;
    if(norm(q).length<PRESS_MIN_CHARS){
      latest={term:'',rows:[]};
      box()?.querySelector('[data-aex-press-bridge]')?.remove();
      return;
    }
    try{
      const rows=await searchPress(q);
      if(token!==seq)return;
      latest={term:q,rows};
      renderPressRows(q,rows);
      preserveAfterCanonical(q,rows);
    }catch(_error){
      if(token===seq){
        latest={term:q,rows:[]};
        box()?.querySelector('[data-aex-press-bridge]')?.remove();
      }
    }
  }

  function openPressRow(row,term){
    const e=entry();
    if(!row||typeof e?.openPressObservation!=='function')return false;
    void e.openPressObservation(row,term);
    return true;
  }

  function currentPressRow(){
    const q=clean(input()?.value||'');
    if(!q||q!==latest.term||!latest.rows.length)return null;
    return latest.rows[0];
  }

  function canonicalSuggestionState(){
    const host=box();
    if(host?.querySelector('[data-aex-suggest-id]'))return 'match';
    if(host?.querySelector('.aex-suggest-empty'))return 'empty';
    return 'unknown';
  }

  document.addEventListener('input',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex'))return;
    clearTimeout(timer);
    const q=target.value;
    if(norm(q).length<PRESS_MIN_CHARS){
      seq+=1;
      latest={term:'',rows:[]};
      box()?.querySelector('[data-aex-press-bridge]')?.remove();
      return;
    }
    timer=setTimeout(()=>void refresh(q),190);
  },true);

  document.addEventListener('focusin',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex'))return;
    warmIndex();
    if(norm(target.value).length>=PRESS_MIN_CHARS)void refresh(target.value);
  },true);

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-aex-press-index]');
    if(button){
      event.preventDefault();
      event.stopImmediatePropagation();
      const row=latest.rows[Number(button.dataset.aexPressIndex)];
      openPressRow(row,latest.term);
      return;
    }

    const run=event.target.closest?.('#aex-run');
    if(!run||!run.closest('.aex'))return;
    const row=currentPressRow();
    /* Only short-circuit after the canonical autocomplete has conclusively
       returned zero rows. If canonical state is pending/unknown, do nothing and
       let 0512 execute immediately. */
    if(row&&canonicalSuggestionState()==='empty'&&typeof entry()?.openPressObservation==='function'){
      event.preventDefault();
      event.stopImmediatePropagation();
      openPressRow(row,latest.term);
    }
  },true);

  document.addEventListener('keydown',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex')||event.key!=='Enter')return;
    const row=currentPressRow();
    if(row&&canonicalSuggestionState()==='empty'&&typeof entry()?.openPressObservation==='function'){
      event.preventDefault();
      event.stopImmediatePropagation();
      openPressRow(row,latest.term);
    }
  },true);

  document.addEventListener('atlas:entity-workspace-ready',()=>{
    const field=input();
    if(field){
      warmIndex();
      if(norm(field.value).length>=PRESS_MIN_CHARS)void refresh(field.value);
    }
  });

  window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE__={
    active:true,
    build:BUILD,
    source:'Monitor/atlas-press-state/atlas_prensa.json',
    policy:'NON_BLOCKING_CANONICAL+ONE_FETCH_INDEXED_PRESS+NO_DUPLICATE_CANONICAL_LOOKUP',
    automaticIdentityJoin:false,
    inferredRut:false,
    search:searchPress,
    hasCanonicalMatch,
    warm:warmIndex,
    metrics,
    installedAt:new Date().toISOString()
  };
})();
