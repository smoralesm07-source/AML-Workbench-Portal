'use strict';

/* ATLAS · Entidades press-search bridge · 2026-08-28
 * Compatibility bridge for the 0512 explorer that can remain mounted when
 * the federated 0447 workspace is installed after initial render.
 *
 * Scope is deliberately narrow:
 * - does not replace ENTRY.load/open/explorer, routing, scoring or filters;
 * - leaves canonical aml_entities suggestions and activation untouched;
 * - appends press-only observations to the existing autocomplete;
 * - intercepts Buscar/Enter only long enough to resolve whether a press-only
 *   observation exists when there is no canonical match;
 * - press-only selections stay unreconciled and never receive an inferred RUT.
 */
(function atlasEntityPressSearchBridge20260828(){
  const FLAG='__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE_20260828__';
  const FEED_URL='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const BUILD='20260828-fodich6';
  const MIN_CHARS=2;
  const LIMIT=4;
  const TTL=5*60*1000;
  if(window[FLAG])return;
  window[FLAG]=true;

  let feedCache={at:0,articles:[]};
  let inflight=null;
  let timer=null;
  let seq=0;
  let latest={term:'',rows:[]};
  let bypassRunOnce=false;
  let resolvingRun=false;

  const clean=v=>String(v??'').trim().replace(/[%_]/g,'').slice(0,120);
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entry=()=>window.__ATLAS_ENTITY_ENTRY__||null;
  const input=()=>document.querySelector('.aex #aex-q');
  const box=()=>document.querySelector('.aex #aex-suggest');
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};

  function articleId(article,index){return String(article?.article_id||article?.id||`PRESS-ARTICLE-${index}`);}
  function articleDate(article){return String(article?.published_at||article?.observed_at||article?.date||article?.fecha||'').trim();}
  function articleText(article){
    return [
      article?.summary,article?.bajada,article?.description,article?.excerpt,article?.lead,
      article?.headline,article?.title,article?.source,article?.media
    ].filter(Boolean).join(' ');
  }

  async function loadArticles(){
    if(feedCache.articles.length&&Date.now()-feedCache.at<TTL)return feedCache.articles;
    if(inflight)return inflight;
    inflight=fetch(FEED_URL,{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error(`Prensa HTTP ${response.status}`);
      return response.json();
    }).then(raw=>{
      const articles=(Array.isArray(raw?.articles)?raw.articles:[]).map((article,index)=>({
        ...article,
        article_id:articleId(article,index),
        published_at:articleDate(article),
        headline:article?.headline||article?.title||'',
        summary:article?.summary||article?.bajada||article?.description||article?.excerpt||article?.lead||'',
        source:article?.source||article?.source_name||article?.media||'',
        source_url:article?.source_url||article?.canonical_url||article?.url||article?.link||''
      }));
      feedCache={at:Date.now(),articles};
      return articles;
    }).finally(()=>{inflight=null;});
    return inflight;
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

  async function searchPress(term){
    const q=clean(term);
    const nq=norm(q);
    if(nq.length<3||/^ENT-/i.test(q)||/^[0-9kK.\-\s]+$/.test(q))return [];
    const articles=await loadArticles();
    const found=new Map();
    for(let index=0;index<articles.length;index++){
      const article=articles[index];
      const text=articleText(article);
      if(!norm(text).includes(nq))continue;
      const name=observedNameFromText(text,q);
      if(!name)continue;
      const key=norm(name);
      if(!key)continue;
      const id=article.article_id||articleId(article,index);
      const existing=found.get(key);
      if(existing){
        if(id&&!existing.article_ids.includes(id))existing.article_ids.push(id);
        existing.article_count=existing.article_ids.length;
        const seen=articleDate(article);
        if(seen&&(!existing.last_seen||seen>existing.last_seen))existing.last_seen=seen;
        continue;
      }
      found.set(key,{
        __pressOnly:true,
        __synthetic:true,
        reconciled:false,
        press_entity_id:`press-text:${key.replace(/\s+/g,'_')}`,
        name,
        aliases:[],
        article_count:1,
        last_seen:articleDate(article),
        article_ids:id?[id]:[]
      });
    }
    return [...found.values()].sort((a,b)=>Number(b.article_count||0)-Number(a.article_count||0)||String(a.name||'').localeCompare(String(b.name||''),'es')).slice(0,LIMIT);
  }

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

  function preservePressRows(term,rows){
    const restore=()=>{
      const host=box();
      const field=input();
      if(!host||!field||clean(field.value)!==clean(term)||!rows.length)return;
      if(!host.querySelector('[data-aex-press-bridge]'))renderPressRows(term,rows);
    };
    setTimeout(restore,320);
    setTimeout(restore,900);
  }

  async function refresh(term){
    const q=clean(term);
    const token=++seq;
    if(q.length<MIN_CHARS){latest={term:'',rows:[]};box()?.querySelector('[data-aex-press-bridge]')?.remove();return;}
    try{
      const rows=await searchPress(q);
      if(token!==seq)return;
      latest={term:q,rows};
      renderPressRows(q,rows);
      preservePressRows(q,rows);
    }catch(_error){
      if(token===seq){latest={term:q,rows:[]};box()?.querySelector('[data-aex-press-bridge]')?.remove();}
    }
  }

  function openPressRow(row,term){
    const e=entry();
    if(!row||typeof e?.openPressObservation!=='function')return false;
    void e.openPressObservation(row,term);
    return true;
  }

  function canonicalSuggestionExists(){return Boolean(box()?.querySelector('[data-aex-suggest-id]'));}
  function currentPressRow(){
    const q=clean(input()?.value||'');
    if(!q||q!==latest.term||!latest.rows.length)return null;
    return latest.rows[0];
  }

  function replayCanonicalRun(run){
    if(!run)return;
    bypassRunOnce=true;
    run.click();
  }

  async function resolveRun(run){
    if(resolvingRun)return;
    const field=input();
    const q=clean(field?.value||'');
    if(!q)return replayCanonicalRun(run);
    if(/^ENT-/i.test(q)||/^[0-9kK.\-\s]+$/.test(q)||canonicalSuggestionExists())return replayCanonicalRun(run);
    resolvingRun=true;
    run?.setAttribute('aria-busy','true');
    try{
      const [canonical,rows]=await Promise.all([hasCanonicalMatch(q),searchPress(q)]);
      if(clean(input()?.value||'')!==q)return;
      latest={term:q,rows};
      renderPressRows(q,rows);
      preservePressRows(q,rows);
      if(canonical===true||!rows.length)return replayCanonicalRun(run);
      if(typeof entry()?.openPressObservation==='function')openPressRow(rows[0],q);
      else replayCanonicalRun(run);
    }catch(_error){
      replayCanonicalRun(run);
    }finally{
      resolvingRun=false;
      run?.removeAttribute('aria-busy');
    }
  }

  document.addEventListener('input',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex'))return;
    clearTimeout(timer);
    timer=setTimeout(()=>void refresh(target.value),260);
  },true);

  document.addEventListener('focusin',event=>{
    const target=event.target;
    if(target instanceof HTMLInputElement&&target.id==='aex-q'&&target.closest('.aex')&&clean(target.value).length>=MIN_CHARS)void refresh(target.value);
  },true);

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-aex-press-index]');
    if(button){
      event.preventDefault();event.stopImmediatePropagation();
      const row=latest.rows[Number(button.dataset.aexPressIndex)];
      openPressRow(row,latest.term);
      return;
    }
    const run=event.target.closest?.('#aex-run');
    if(!run||!run.closest('.aex'))return;
    if(bypassRunOnce){bypassRunOnce=false;return;}
    const row=currentPressRow();
    if(row&&!canonicalSuggestionExists()&&typeof entry()?.openPressObservation==='function'){
      event.preventDefault();event.stopImmediatePropagation();
      openPressRow(row,latest.term);
      return;
    }
    const q=clean(input()?.value||'');
    if(q&&!/^ENT-/i.test(q)&&!/^[0-9kK.\-\s]+$/.test(q)){
      event.preventDefault();event.stopImmediatePropagation();
      void resolveRun(run);
    }
  },true);

  document.addEventListener('keydown',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex')||event.key!=='Enter')return;
    const row=currentPressRow();
    if(row&&!canonicalSuggestionExists()&&typeof entry()?.openPressObservation==='function'){
      event.preventDefault();event.stopImmediatePropagation();
      openPressRow(row,latest.term);
      return;
    }
    const q=clean(target.value);
    if(q&&!/^ENT-/i.test(q)&&!/^[0-9kK.\-\s]+$/.test(q)){
      event.preventDefault();event.stopImmediatePropagation();
      void resolveRun(document.querySelector('.aex #aex-run'));
    }
  },true);

  document.addEventListener('atlas:entity-workspace-ready',()=>{
    const field=input();
    if(field&&clean(field.value).length>=MIN_CHARS)void refresh(field.value);
  });

  window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE__={
    active:true,
    build:BUILD,
    source:'Monitor/atlas-press-state/atlas_prensa.json',
    policy:'APPEND_PRESS_ONLY_TO_0512_AND_RESOLVE_PRESS_ONLY_ON_RUN_WITHOUT_REPLACING_CANONICAL_EXPLORER',
    automaticIdentityJoin:false,
    inferredRut:false,
    search:searchPress,
    hasCanonicalMatch,
    installedAt:new Date().toISOString()
  };
})();