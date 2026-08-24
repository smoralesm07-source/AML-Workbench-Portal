'use strict';

/* ATLAS AML · Entity 360 press evidence current authority 0527
 * Production-safe source fragment included in canonical compiled runtime.
 * Reads the public RADAR_PRENSA bridge only; no writes, no score mutation.
 */
(function atlasEntityPressCurrent0527(){
  const VERSION='ENTITY_PRESS_CURRENT_0527.1';
  const FEED='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const TTL=10*60*1000;
  let cache=null,loadedAt=0,loading=null,lastKey='';

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const normRut=v=>String(v??'').toUpperCase().replace(/[^0-9K]/g,'');
  const uniq=xs=>[...new Set((xs||[]).map(x=>String(x||'').trim()).filter(Boolean))];

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
        window.__ATLAS_PRESS_FEED_CURRENT__={active:true,version:VERSION,generatedAt:data?.generated_at||null,stats:data?.stats||{},loadedAt:new Date().toISOString()};
        return cache;
      })
      .catch(error=>{console.warn('[ATLAS] Radar Prensa current feed no disponible',error);return{entities:[],mentions:[],articles:[],articleById:new Map(),mentionByEntity:new Map(),error:String(error?.message||error)};})
      .finally(()=>{loading=null;});
    return loading;
  }

  function currentIdentity(){
    const selected=document.querySelector('#a47-selected');
    const name=selected?.querySelector('b')?.textContent?.trim()||document.querySelector('.a45-identity h1')?.textContent?.trim()||'';
    const small=selected?.querySelector('small')?.textContent||'';
    const rut=(small.match(/\b\d{7,8}-[0-9K]\b/i)||small.match(/\b\d{1,2}(?:\.\d{3}){2}-[0-9K]\b/i)||[])[0]||'';
    const entityId=(small.match(/ENT-[A-Z0-9-]+/i)||[])[0]||'';
    return{name,rut,entityId};
  }

  function findPressEntity(feed,ident){
    const nr=normRut(ident.rut);
    if(nr){
      const exact=feed.entities.filter(e=>(e.ruts||[]).some(r=>normRut(r)===nr));
      if(exact.length)return exact.sort((a,b)=>Number(b.article_count||0)-Number(a.article_count||0))[0];
    }
    const nn=norm(ident.name);
    if(nn){
      const exact=feed.entities.filter(e=>norm(e.name)===nn||(e.aliases||[]).some(a=>norm(a)===nn));
      if(exact.length)return exact.sort((a,b)=>Number(b.article_count||0)-Number(a.article_count||0))[0];
      const tokens=nn.split(' ').filter(t=>t.length>3);
      if(tokens.length){
        const candidates=feed.entities.filter(e=>tokens.every(t=>norm(e.name).includes(t)));
        if(candidates.length===1)return candidates[0];
      }
    }
    return null;
  }

  function evidence(feed,entity){
    const mentions=(feed.mentionByEntity.get(String(entity.press_entity_id))||[]).slice().sort((a,b)=>{
      const da=String(feed.articleById.get(String(a.article_id))?.date||'');
      const db=String(feed.articleById.get(String(b.article_id))?.date||'');
      return db.localeCompare(da);
    });
    return mentions.map(m=>{
      const a=feed.articleById.get(String(m.article_id))||{};
      const phenomena=uniq([...(a.phenomena||[]),...(m.phenomena||[])]);
      return {a,m,phenomena};
    }).filter(x=>x.a&&x.a.url);
  }

  function panelMarkup(entity,items){
    const allPhen=uniq(items.flatMap(x=>x.phenomena)).slice(0,10);
    const cards=items.slice(0,12).map(({a,m,phenomena})=>`<article class="a52p-card">
      <div class="a52p-top"><span>${esc(String(a.date||'').slice(0,10)||'sin fecha')}</span><b>${esc(a.media||'Medio no materializado')}</b>${a.uaf?'<em>UAF</em>':''}</div>
      <h4>${esc(a.title||'Publicación')}</h4>
      <p>${esc(m.role||'mencionada en la publicación')}</p>
      ${phenomena.length?`<div class="a52p-associated"><strong>Asociado a</strong><div>${phenomena.slice(0,6).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}
      <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Ver fuente original ↗</a>
    </article>`).join('');
    return `<section class="a52p" data-a52p-id="${esc(entity.press_entity_id)}">
      <header><div><span>RADAR PRENSA</span><h3>Prensa y contexto abierto</h3><p>${Number(entity.article_count||items.length).toLocaleString('es-CL')} publicación(es) · ${Number(entity.media?.length||0).toLocaleString('es-CL')} medio(s) · última mención ${esc(entity.last_seen||'—')}</p></div><div class="a52p-source">Fuente abierta verificable</div></header>
      ${allPhen.length?`<div class="a52p-summary"><strong>Asociado a</strong><div>${allPhen.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}
      <div class="a52p-warning">La presencia en prensa aporta contexto OSINT. No acredita identidad, delito ni modifica por sí sola IPA3.</div>
      <div class="a52p-list">${cards||'<p>Sin publicaciones trazables.</p>'}</div>
    </section>`;
  }

  function mountPanel(entity,items){
    document.querySelectorAll('.a52p').forEach(n=>n.remove());
    if(!items.length)return;
    const dossier=document.querySelector('.a45');
    if(dossier){
      const identity=dossier.querySelector('.a45-cover');
      if(identity)identity.insertAdjacentHTML('afterend',panelMarkup(entity,items));
      else dossier.insertAdjacentHTML('afterbegin',panelMarkup(entity,items));
    }
    const legacy=document.querySelector('.aep-profile');
    if(legacy&&!legacy.querySelector('.a52p'))legacy.insertAdjacentHTML('beforeend',panelMarkup(entity,items));
  }

  async function refresh(){
    const ident=currentIdentity();
    const key=[ident.entityId,normRut(ident.rut),norm(ident.name)].join('|');
    if(!ident.name&&!ident.rut)return;
    if(key===lastKey&&document.querySelector('.a52p'))return;
    const feed=await loadFeed();
    const entity=findPressEntity(feed,ident);
    if(!entity){document.querySelectorAll('.a52p').forEach(n=>n.remove());lastKey=key;return;}
    const items=evidence(feed,entity);
    mountPanel(entity,items);
    lastKey=key;
  }

  const observer=new MutationObserver(()=>setTimeout(()=>void refresh(),120));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(()=>void refresh(),350),true);
  document.addEventListener('input',()=>setTimeout(()=>void refresh(),700),true);
  setInterval(()=>void refresh(),3000);
  void loadFeed().then(()=>refresh());

  window.__ATLAS_ENTITY_PRESS_CURRENT__={active:true,version:VERSION,feed:FEED,productionCompiled:true,scoreMutation:false,identityMutation:false,installedAt:new Date().toISOString()};
})();
