'use strict';

/* ATLAS AML · Radar Prensa bridge reliability patch 0524
 * Corrige dos brechas detectadas en 0523:
 * 1) cuando una entidad de prensa coincide con una sugerencia/fila canónica de ATLAS,
 *    el clic nativo no dejaba contexto pendiente y el dossier no recibía la sección de prensa;
 * 2) la búsqueda del feed de prensa no consideraba RUT.
 *
 * Este parche es aditivo. No modifica IPA3, identidad canónica, RLS ni datos persistentes.
 */
(function atlasEntityPress0524(){
  const VERSION='ENTITY-PRESS-0524.1';
  const FEED='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const TTL=10*60*1000;
  let cache=null, loadedAt=0, loading=null, rutTimer=null;

  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const normRut=v=>String(v??'').toUpperCase().replace(/[^0-9K]/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entry=()=>window.__ATLAS_ENTITY_ENTRY__||null;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};

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
        cache={...data,entities,mentions,articles,articleById,mentionByEntity};
        loadedAt=Date.now();
        return cache;
      })
      .catch(error=>{console.warn('[ATLAS] Radar Prensa 0524 no disponible',error);return{entities:[],mentions:[],articles:[],articleById:new Map(),mentionByEntity:new Map()};})
      .finally(()=>{loading=null;});
    return loading;
  }

  function matchEntity(feed,{name='',rut=''}){
    const nr=normRut(rut);
    if(nr){
      const exact=feed.entities.find(e=>(e.ruts||[]).some(x=>normRut(x)===nr));
      if(exact)return exact;
    }
    const nn=norm(name);
    if(nn){
      const exact=feed.entities.filter(e=>norm(e.name)===nn||((e.aliases||[]).some(a=>norm(a)===nn)));
      if(exact.length)return exact.sort((a,b)=>Number(b.article_count||0)-Number(a.article_count||0))[0];
    }
    return null;
  }

  function identityFromNode(node){
    const name=node?.querySelector?.('.aex-id > b, b')?.textContent||'';
    const text=node?.textContent||'';
    const rutMatch=text.match(/\b\d{1,2}(?:\.\d{3}){2}-[0-9K]\b|\b\d{7,8}-[0-9K]\b/i);
    return{name:name.trim(),rut:rutMatch?.[0]||''};
  }

  async function primePending(node){
    const feed=await loadFeed();
    const ident=identityFromNode(node);
    const entity=matchEntity(feed,ident);
    if(!entity)return;
    window.__ATLAS_PRESS_PENDING__={entity,matchedBy:ident.rut?'rut':'name',primedAt:new Date().toISOString()};
  }

  // Capture antes del listener nativo: al abrir una sugerencia o fila canónica,
  // dejamos preparada la entidad de prensa para que 0523 la inyecte en el dossier.
  document.addEventListener('click',event=>{
    const node=event.target.closest?.('.aex-suggest-item,.aex-row,[data-aex-suggest-id]');
    if(!node)return;
    void primePending(node);
  },true);

  function looksLikeRut(q){
    const raw=String(q||'').trim();
    const compact=normRut(raw);
    return compact.length>=4 && /^[0-9K]+$/i.test(compact);
  }

  async function rutMatches(q,limit=6){
    if(!looksLikeRut(q))return[];
    const feed=await loadFeed();
    const nq=normRut(q);
    return feed.entities.filter(e=>(e.ruts||[]).some(r=>normRut(r).includes(nq)))
      .sort((a,b)=>Number(b.article_count||0)-Number(a.article_count||0)).slice(0,limit);
  }

  async function canonicalByRut(rut){
    const client=db();if(!client||!rut)return null;
    const {data,error}=await client.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count').eq('rut',rut).limit(2);
    if(error||!Array.isArray(data)||data.length!==1)return null;
    return data[0];
  }

  function articleRows(feed,entity){
    const rows=(feed.mentionByEntity.get(String(entity.press_entity_id))||[]).slice().sort((a,b)=>{
      const da=String(feed.articleById.get(String(a.article_id))?.date||'');
      const dbb=String(feed.articleById.get(String(b.article_id))?.date||'');
      return dbb.localeCompare(da);
    }).slice(0,40);
    return rows.map(m=>{const a=feed.articleById.get(String(m.article_id))||{};return `<article class="aep-article"><div class="aep-article-top"><span>${esc(String(a.date||'').slice(0,10)||'sin fecha')}</span><b>${esc(a.media||'Medio no materializado')}</b>${a.uaf?'<em>UAF</em>':''}</div><h4>${esc(a.title||'Publicación')}</h4><p>${esc(m.role||'mencionada en la publicación')}</p>${(m.phenomena||[]).length?`<div class="aep-tags">${m.phenomena.slice(0,5).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Abrir publicación →</a>`:''}</article>`;}).join('');
  }

  async function openRutEntity(entity){
    const rut=(entity.ruts||[])[0]||'';
    const canonical=await canonicalByRut(rut);
    if(canonical&&typeof entry()?.explorer?.open==='function'){
      window.__ATLAS_PRESS_PENDING__={entity,canonical,matchedBy:'rut',primedAt:new Date().toISOString()};
      await entry().explorer.open(canonical.entity_id);
      return;
    }
    const feed=await loadFeed();
    const host=document.querySelector('.aex-results');if(!host)return;
    host.innerHTML=`<section class="aep-profile"><header><div><span>RADAR PRENSA · RUT OBSERVADO</span><h3>${esc(entity.name)}</h3><p>${esc(rut||'RUT no materializado')}</p></div><button type="button" data-aep-back>Volver</button></header><div class="aep-kpis"><span><b>${Number(entity.article_count||0).toLocaleString('es-CL')}</b><small>publicaciones</small></span><span><b>${Number(entity.mention_count||0).toLocaleString('es-CL')}</b><small>menciones</small></span><span><b>${Number(entity.media?.length||0).toLocaleString('es-CL')}</b><small>medios</small></span></div><div class="aep-warning"><b>Fuente: Monitor de Prensa.</b> El RUT proviene del índice de prensa y no promueve identidad canónica sin conciliación gobernada.</div><section class="aep-news"><h4>Publicaciones subyacentes</h4>${articleRows(feed,entity)||'<p>Sin detalle de publicaciones.</p>'}</section></section>`;
    host.querySelector('[data-aep-back]')?.addEventListener('click',()=>entry()?.explorer?.run?.());
  }

  async function appendRutSuggestions(q){
    const box=document.querySelector('#aex-suggest');if(!box)return;
    box.querySelector('.aep-rut-section')?.remove();
    const matches=await rutMatches(q,6);if(!matches.length)return;
    const html=`<div class="aep-suggest-section aep-rut-section"><div class="aep-suggest-head">Coincidencias de RUT en Radar Prensa</div>${matches.map(e=>`<button type="button" class="aep-suggest" data-aep-rut-open="${esc(e.press_entity_id)}"><span><b>${esc(e.name)}</b><small>${esc((e.ruts||[])[0]||'RUT no materializado')} · ${Number(e.article_count||0).toLocaleString('es-CL')} publicación(es)</small></span><em>PRENSA</em></button>`).join('')}</div>`;
    box.insertAdjacentHTML('beforeend',html);box.classList.add('open');
    box.querySelectorAll('[data-aep-rut-open]').forEach(btn=>btn.addEventListener('click',async event=>{
      event.preventDefault();event.stopPropagation();
      const feed=await loadFeed();
      const entity=feed.entities.find(e=>String(e.press_entity_id)===String(btn.dataset.aepRutOpen));
      if(entity)await openRutEntity(entity);
    }));
  }

  function bindInput(){
    const input=document.querySelector('#aex-q');if(!input||input.dataset.aepRutBound==='1')return;
    input.dataset.aepRutBound='1';
    input.addEventListener('input',()=>{clearTimeout(rutTimer);const q=input.value;rutTimer=setTimeout(()=>void appendRutSuggestions(q),430);});
    input.addEventListener('focus',()=>{if(looksLikeRut(input.value))void appendRutSuggestions(input.value);});
  }

  const observer=new MutationObserver(()=>bindInput());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  void loadFeed();bindInput();

  window.__ATLAS_ENTITY_PRESS_0524__={active:true,version:VERSION,fixes:['CANONICAL_CLICK_PRIMES_PRESS_DOSSIER','PRESS_FEED_RUT_SEARCH'],scoreMutation:false,identityMutation:false,installedAt:new Date().toISOString()};
})();
