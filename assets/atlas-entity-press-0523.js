'use strict';

/* ATLAS AML 0.52.3 · Bridge de entidades desde Radar Prensa
 *
 * Diseño deliberadamente aislado:
 * - Lee un índice histórico público generado por Monitor UAF.
 * - No escribe en Supabase ni altera identidad, IPA3, RLS o Auth.
 * - Una entidad sin RUT aparece como PRESS_ONLY.
 * - RUT exacto puede resolver a entidad canónica; nombre solo nunca promueve identidad.
 * - Nombre exacto puede mostrarse como candidato/contexto, pero no transfiere atributos.
 */
(function atlasEntityPress0523(){
  const VERSION='ENTITY-PRESS-0523.1';
  const FEED='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const TTL=10*60*1000;
  let cache=null,loadedAt=0,loading=null,timer=null;
  let pressViewEntity=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const fmt=v=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'—';};
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const entry=()=>window.__ATLAS_ENTITY_ENTRY__||null;
  const root=()=>document.querySelector('.aex');

  async function loadFeed(force=false){
    if(!force&&cache&&Date.now()-loadedAt<TTL)return cache;
    if(loading)return loading;
    loading=fetch(`${FEED}?t=${Math.floor(Date.now()/600000)}`,{cache:'no-store',credentials:'omit'})
      .then(r=>{if(!r.ok)throw new Error(`Radar Prensa HTTP ${r.status}`);return r.json();})
      .then(data=>{
        const entities=Array.isArray(data?.entities)?data.entities:[];
        const mentions=Array.isArray(data?.mentions)?data.mentions:[];
        const articles=Array.isArray(data?.articles)?data.articles:[];
        const articleById=new Map(articles.map(a=>[String(a.id),a]));
        const mentionByEntity=new Map();
        for(const m of mentions){const id=String(m.press_entity_id||'');if(!id)continue;if(!mentionByEntity.has(id))mentionByEntity.set(id,[]);mentionByEntity.get(id).push(m);}
        const entityById=new Map(entities.map(e=>[String(e.press_entity_id),e]));
        cache={...data,entities,mentions,articles,articleById,mentionByEntity,entityById};
        loadedAt=Date.now();
        window.__ATLAS_PRESS_FEED__={active:true,version:VERSION,generatedAt:data?.generated_at||null,stats:data?.stats||{},loadedAt:new Date().toISOString()};
        return cache;
      })
      .catch(error=>{console.warn('[ATLAS] Radar Prensa feed no disponible',error);cache={entities:[],mentions:[],articles:[],articleById:new Map(),mentionByEntity:new Map(),entityById:new Map(),error:String(error?.message||error)};loadedAt=Date.now();return cache;})
      .finally(()=>{loading=null;});
    return loading;
  }

  function matchScore(entity,q){
    const nq=norm(q);if(nq.length<2)return 0;
    const name=String(entity.normalized_name||norm(entity.name));
    if(name===nq)return 100;
    const aliases=(entity.aliases||[]).map(norm);
    if(aliases.includes(nq))return 96;
    const tokens=nq.split(' ').filter(Boolean);
    if(tokens.length&&tokens.every(t=>name.includes(t)))return Math.max(72,92-tokens.length);
    if(name.includes(nq))return 82;
    return 0;
  }

  async function pressMatches(q,limit=7){
    const feed=await loadFeed();
    return feed.entities.map(e=>({e,score:matchScore(e,q)})).filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||Number(b.e.article_count||0)-Number(a.e.article_count||0))
      .slice(0,limit).map(x=>x.e);
  }

  async function canonicalCandidates(entity){
    const client=db();if(!client)return{canonical:null,candidates:[]};
    const ruts=(entity.ruts||[]).filter(Boolean);
    if(ruts.length){
      for(const rut of ruts){
        const {data,error}=await client.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count').eq('rut',rut).limit(2);
        if(!error&&data?.length===1)return{canonical:data[0],candidates:data};
      }
    }
    const tokens=norm(entity.name).split(' ').filter(t=>t.length>2).slice(0,3);
    if(!tokens.length)return{canonical:null,candidates:[]};
    let q=client.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count').limit(12);
    for(const t of tokens)q=q.ilike('name',`%${t}%`);
    const {data,error}=await q;if(error)return{canonical:null,candidates:[]};
    const exact=(data||[]).filter(r=>norm(r.name)===norm(entity.name));
    // Nombre exacto sin RUT sigue siendo candidato; nunca identidad automática.
    return{canonical:null,candidates:exact.length?exact:(data||[]).slice(0,4)};
  }

  function pressBadge(entity){return `<span class="aep-badge" title="${fmt(entity.article_count)} publicaciones detectadas por Radar Prensa">Prensa · ${fmt(entity.article_count)}</span>`;}

  async function decorateCanonicalRows(){
    const feed=await loadFeed();if(!root()||!feed.entities.length)return;
    const exact=new Map();for(const e of feed.entities){const key=norm(e.name);if(!exact.has(key)||Number(e.article_count||0)>Number(exact.get(key).article_count||0))exact.set(key,e);}
    document.querySelectorAll('.aex-row').forEach(row=>{
      if(row.dataset.aepDecorated==='1')return;
      const name=row.querySelector('.aex-id > b')?.textContent||'';
      const e=exact.get(norm(name));if(!e)return;
      row.dataset.aepDecorated='1';row.dataset.aepPressId=e.press_entity_id;
      const id=row.querySelector('.aex-id');if(id&&!id.querySelector('.aep-badge'))id.insertAdjacentHTML('beforeend',pressBadge(e));
    });
  }

  function pressSuggestion(entity){
    const rut=(entity.ruts||[])[0]||'RUT no materializado';
    return `<button type="button" class="aep-suggest" data-aep-open="${esc(entity.press_entity_id)}">
      <span><b>${esc(entity.name)}</b><small>${esc(rut)} · fuente: Monitor de Prensa · ${fmt(entity.article_count)} publicación(es)</small></span>
      <em>PRENSA</em>
    </button>`;
  }

  async function addPressSuggestions(q){
    const box=document.querySelector('#aex-suggest');if(!box||String(q||'').trim().length<2)return;
    const matches=await pressMatches(q,6);if(!matches.length)return;
    box.querySelector('.aep-suggest-section')?.remove();
    const existingNames=new Set([...box.querySelectorAll('.aex-suggest-item b')].map(x=>norm(x.textContent)));
    const unresolved=matches.filter(e=>!existingNames.has(norm(e.name)));
    for(const e of matches.filter(e=>existingNames.has(norm(e.name)))){
      [...box.querySelectorAll('.aex-suggest-item')].forEach(btn=>{if(norm(btn.querySelector('b')?.textContent)===norm(e.name)&&!btn.querySelector('.aep-mini'))btn.querySelector('span')?.insertAdjacentHTML('beforeend',`<small class="aep-mini">Radar Prensa · ${fmt(e.article_count)} publicación(es)</small>`);});
    }
    if(!unresolved.length)return;
    box.insertAdjacentHTML('beforeend',`<div class="aep-suggest-section"><div class="aep-suggest-head">Entidades observadas en prensa · identidad no conciliada</div>${unresolved.map(pressSuggestion).join('')}</div>`);
    box.classList.add('open');
    box.querySelectorAll('[data-aep-open]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void openPressEntity(btn.dataset.aepOpen);}));
  }

  function articleRows(feed,entity){
    const mentions=(feed.mentionByEntity.get(entity.press_entity_id)||[]).slice().sort((a,b)=>{
      const da=String(feed.articleById.get(a.article_id)?.date||'');const dbb=String(feed.articleById.get(b.article_id)?.date||'');return dbb.localeCompare(da);
    }).slice(0,40);
    return mentions.map(m=>{const a=feed.articleById.get(String(m.article_id))||{};return `<article class="aep-article">
      <div class="aep-article-top"><span>${esc(String(a.date||'').slice(0,10)||'sin fecha')}</span><b>${esc(a.media||'Medio no materializado')}</b>${a.uaf?'<em>UAF</em>':''}</div>
      <h4>${esc(a.title||'Publicación')}</h4>
      <p>${esc(m.role||'mencionada en la publicación')}</p>
      ${(m.phenomena||[]).length?`<div class="aep-tags">${m.phenomena.slice(0,5).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
      ${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Abrir publicación →</a>`:''}
    </article>`;}).join('');
  }

  async function openPressEntity(id){
    const feed=await loadFeed();const entity=feed.entityById.get(String(id));if(!entity)return;
    const resolved=await canonicalCandidates(entity);pressViewEntity=entity;
    if(resolved.canonical){
      const open=entry()?.explorer?.open;if(typeof open==='function'){window.__ATLAS_PRESS_PENDING__={entity,canonical:resolved.canonical};await open(resolved.canonical.entity_id);setTimeout(()=>void injectDossierPress(resolved.canonical),650);return;}
    }
    renderPressOnly(entity,resolved.candidates,feed);
  }

  function renderPressOnly(entity,candidates,feed){
    const host=document.querySelector('.aex-results');if(!host)return;
    const rut=(entity.ruts||[])[0]||'RUT no materializado';
    host.innerHTML=`<section class="aep-profile">
      <header><div><span>RADAR PRENSA · IDENTIDAD NO CONCILIADA</span><h3>${esc(entity.name)}</h3><p>${esc(rut)} · ${esc(entity.nature==='PERSONA_NATURAL'?'Persona natural':'Persona jurídica')}</p></div><button type="button" data-aep-back>Volver</button></header>
      <div class="aep-kpis"><span><b>${fmt(entity.article_count)}</b><small>publicaciones</small></span><span><b>${fmt(entity.media?.length||0)}</b><small>medios</small></span><span><b>${fmt(entity.mention_count)}</b><small>menciones</small></span><span><b>${Math.round(Number(entity.confidence||0)*100)}%</b><small>confianza NER</small></span></div>
      <div class="aep-warning"><b>Fuente: Monitor de Prensa.</b> Esta identidad existe como <code>PRESS_ONLY</code>. La similitud de nombre no la convierte en una identidad canónica de ATLAS ni transfiere atributos.</div>
      ${candidates?.length?`<section class="aep-candidates"><h4>Posibles coincidencias en ATLAS · revisar identidad</h4>${candidates.map(c=>`<button type="button" data-aep-candidate="${esc(c.entity_id)}"><b>${esc(c.name||c.entity_id)}</b><span>${esc(c.rut||'sin RUT')} · ${esc([c.commune,c.region].filter(Boolean).join(' · ')||'sin territorio')}</span><em>Abrir candidato →</em></button>`).join('')}</section>`:''}
      <section class="aep-news"><h4>Publicaciones subyacentes</h4>${articleRows(feed,entity)||'<p>Sin detalle de publicaciones.</p>'}</section>
    </section>`;
    host.querySelector('[data-aep-back]')?.addEventListener('click',()=>entry()?.explorer?.run?.());
    host.querySelectorAll('[data-aep-candidate]').forEach(btn=>btn.addEventListener('click',()=>entry()?.explorer?.open?.(btn.dataset.aepCandidate)));
  }

  async function injectDossierPress(canonicalRow=null){
    const feed=await loadFeed();
    let entity=window.__ATLAS_PRESS_PENDING__?.entity||pressViewEntity;
    if(!entity&&canonicalRow){
      const rut=canonicalRow.rut;entity=feed.entities.find(e=>(rut&&(e.ruts||[]).includes(rut))||norm(e.name)===norm(canonicalRow.name));
    }
    if(!entity)return;
    const candidates=[...document.querySelectorAll('.aed-body,.v0203-entity-body,#v0203-entity-results,.v0203-tabs')];
    const anchor=candidates.find(Boolean);if(!anchor||document.querySelector('.aep-dossier'))return;
    anchor.insertAdjacentHTML('beforeend',`<section class="aep-dossier"><div class="aep-dossier-head"><span>RADAR PRENSA</span><h3>Prensa y contexto abierto</h3><p>${fmt(entity.article_count)} publicaciones · ${fmt(entity.media?.length||0)} medios · última mención ${esc(entity.last_seen||'—')}</p></div><div class="aep-warning">La prensa aporta evidencia contextual. No incrementa por sí sola IPA3 ni acredita delito o identidad.</div><div class="aep-news">${articleRows(feed,entity)}</div></section>`);
    window.__ATLAS_PRESS_PENDING__=null;
  }

  function bind(){
    const r=root();if(!r||r.dataset.aepBound==='1')return;r.dataset.aepBound='1';
    const input=document.querySelector('#aex-q');if(input){input.addEventListener('input',()=>{clearTimeout(timer);const q=input.value;timer=setTimeout(()=>void addPressSuggestions(q),360);});input.addEventListener('focus',()=>{if(input.value.trim().length>=2)void addPressSuggestions(input.value);});}
    void decorateCanonicalRows();
  }

  const observer=new MutationObserver(()=>{bind();void decorateCanonicalRows();if(window.__ATLAS_PRESS_PENDING__)setTimeout(()=>void injectDossierPress(),120);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  void loadFeed();bind();
  window.__ATLAS_ENTITY_PRESS_0523__={active:true,version:VERSION,feed:FEED,identityPolicy:'RUT_EXACT_CANONICAL+NAME_ONLY_CANDIDATE+PRESS_ONLY_ALLOWED',scoreMutation:false,authMutation:false,installedAt:new Date().toISOString()};
})();
