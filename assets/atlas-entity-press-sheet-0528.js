'use strict';

/* ATLAS AML · Radar Prensa visible en Ficha Rápida + Entity 360 · 0528
 * Inserta evidencia directamente en los dos contenedores productivos reales:
 *   - #aex-sheet / #aex-sheet-body (Ficha rápida)
 *   - .a45 (Entity 360)
 * No modifica identidad canónica, RLS, IPA3 ni persistencia.
 */
(function atlasEntityPressSheet0528(){
  const VERSION='ENTITY_PRESS_SHEET_0528.1';
  const FEED='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  let feed=null, loading=null, lastSheet='', last360='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').replace(/\b(s\.?a\.?|spa|ltda|eirl)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const uniq=xs=>[...new Set((xs||[]).map(x=>String(x||'').trim()).filter(Boolean))];

  async function load(){
    if(feed)return feed;if(loading)return loading;
    loading=fetch(`${FEED}?_atlas=${Date.now()}`,{cache:'no-store',credentials:'omit'})
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(d=>{
        const entities=Array.isArray(d?.entities)?d.entities:[];
        const mentions=Array.isArray(d?.mentions)?d.mentions:[];
        const articles=Array.isArray(d?.articles)?d.articles:[];
        const articleById=new Map(articles.map(a=>[String(a.id),a]));
        const mentionByEntity=new Map();
        for(const m of mentions){const id=String(m.press_entity_id||'');if(!id)continue;if(!mentionByEntity.has(id))mentionByEntity.set(id,[]);mentionByEntity.get(id).push(m);}
        feed={entities,mentions,articles,articleById,mentionByEntity,generated_at:d?.generated_at||null};
        return feed;
      }).catch(e=>{console.warn('[ATLAS] prensa 0528 feed',e);return null;}).finally(()=>loading=null);
    return loading;
  }

  function scoreName(entityName,target){
    const a=norm(entityName), b=norm(target);if(!a||!b)return 0;if(a===b)return 100;if(a.includes(b)||b.includes(a))return 90;
    const ta=new Set(a.split(' ').filter(x=>x.length>2)), tb=new Set(b.split(' ').filter(x=>x.length>2));
    if(!ta.size||!tb.size)return 0;let inter=0;for(const t of ta)if(tb.has(t))inter++;
    return Math.round(100*(2*inter/(ta.size+tb.size)));
  }
  function findEntity(data,name){
    if(!data||!name)return null;
    const ranked=data.entities.map(e=>({e,s:Math.max(scoreName(e.name,name),...(e.aliases||[]).map(a=>scoreName(a,name)))})).filter(x=>x.s>=72)
      .sort((x,y)=>y.s-x.s||Number(y.e.article_count||0)-Number(x.e.article_count||0));
    return ranked[0]?.e||null;
  }
  function itemsFor(data,e){
    return (data.mentionByEntity.get(String(e.press_entity_id))||[]).map(m=>{
      const a=data.articleById.get(String(m.article_id))||{};
      return {a,m,phenomena:uniq([...(a.phenomena||[]),...(m.phenomena||[])])};
    }).sort((x,y)=>String(y.a.date||'').localeCompare(String(x.a.date||'')));
  }
  function block(e,items,compact=false){
    const phenomena=uniq(items.flatMap(x=>x.phenomena)).slice(0,8);
    const usable=items.slice(0,compact?5:10);
    return `<section class="a528-press ${compact?'compact':''}">
      <div class="a528-head"><span>RADAR PRENSA</span><b>Prensa y contexto abierto</b><small>${Number(e.article_count||items.length).toLocaleString('es-CL')} publicación(es) · última mención ${esc(e.last_seen||'—')}</small></div>
      ${phenomena.length?`<div class="a528-associated"><strong>Asociado a</strong><div>${phenomena.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}
      <div class="a528-news">${usable.map(({a,m,phenomena:p})=>`<article><div><span>${esc(String(a.date||'').slice(0,10)||'sin fecha')}</span><em>${esc(a.media||'Medio no materializado')}</em></div><b>${esc(a.title||'Publicación')}</b><small>${esc(m.role||'mencionada en la publicación')}</small>${p.length?`<p><strong>Asociado a</strong> ${p.slice(0,4).map(x=>`<span>${esc(x)}</span>`).join(' ')}</p>`:''}${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Ver fuente original ↗</a>`:'<i>Fuente URL no materializada</i>'}</article>`).join('')}</div>
      <p class="a528-note">La presencia en prensa es contexto OSINT; no acredita identidad, delito ni modifica por sí sola IPA3.</p>
    </section>`;
  }

  async function enrichSheet(){
    const sheet=document.querySelector('#aex-sheet');
    if(!sheet||sheet.getAttribute('aria-hidden')==='true')return;
    const title=document.querySelector('#aex-sheet-title')?.textContent?.trim()||'';
    if(!title)return;
    const key=norm(title);if(key===lastSheet&&sheet.querySelector('.a528-press'))return;
    sheet.querySelectorAll('.a528-press').forEach(n=>n.remove());
    const data=await load();const e=findEntity(data,title);if(!e){lastSheet=key;return;}
    const items=itemsFor(data,e);if(!items.length){lastSheet=key;return;}
    const body=document.querySelector('#aex-sheet-body');if(body)body.insertAdjacentHTML('beforeend',block(e,items,true));
    lastSheet=key;
  }

  async function enrich360(){
    const dossier=document.querySelector('.a45');if(!dossier)return;
    const title=dossier.querySelector('.a45-identity h1')?.textContent?.trim()||document.querySelector('#a47-selected b')?.textContent?.trim()||'';
    if(!title||/^selecciona una entidad$/i.test(title))return;
    const key=norm(title);if(key===last360&&dossier.querySelector('.a528-press'))return;
    dossier.querySelectorAll('.a528-press').forEach(n=>n.remove());
    const data=await load();const e=findEntity(data,title);if(!e){last360=key;return;}
    const items=itemsFor(data,e);if(!items.length){last360=key;return;}
    const cover=dossier.querySelector('.a45-cover');
    (cover||dossier).insertAdjacentHTML(cover?'afterend':'afterbegin',block(e,items,false));
    last360=key;
  }

  function refresh(){void enrichSheet();void enrich360();}
  const obs=new MutationObserver(()=>setTimeout(refresh,100));obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden']});
  document.addEventListener('click',()=>{setTimeout(refresh,120);setTimeout(refresh,700);},true);
  setInterval(refresh,1500);void load().then(refresh);
  window.__ATLAS_ENTITY_PRESS_SHEET_0528__={active:true,version:VERSION,targets:['#aex-sheet','.a45'],feed:FEED};
})();