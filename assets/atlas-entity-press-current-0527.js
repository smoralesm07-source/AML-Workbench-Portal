'use strict';

/* ATLAS AML · Radar Prensa visible en Ficha Rápida + Entity 360
 * 0527.4 endurece la resolución de identidad para evitar falsos positivos.
 * La prensa solo se monta cuando existe evidencia nominal fuerte y no ambigua.
 * No modifica identidad canónica, RLS, IPA3 ni persistencia.
 */
(function atlasEntityPressCurrent0527(){
  const VERSION='ENTITY_PRESS_CURRENT_0527.4';
  const FEED='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  let feed=null, loading=null, lastSheet='', last360='';

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('es-CL')
    .replace(/\b(s\.?a\.?|spa|ltda|eirl|limitada)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ').trim();
  const uniq=xs=>[...new Set((xs||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  const STOP=new Set(['de','del','la','las','el','los','y','e','en','para','por','con','sin','casa','empresa','individual','responsabilidad','resp','sociedad','servicios','comercial','comercio','inversiones','inversion','compania','cia']);
  const tokens=v=>norm(v).split(' ').filter(t=>t.length>2&&!STOP.has(t));

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
        window.__ATLAS_PRESS_FEED_CURRENT__={ok:true,entities:entities.length,mentions:mentions.length,articles:articles.length,generatedAt:d?.generated_at||null};
        return feed;
      }).catch(e=>{console.warn('[ATLAS] prensa current feed',e);window.__ATLAS_PRESS_FEED_CURRENT__={ok:false,error:String(e?.message||e)};return null;}).finally(()=>loading=null);
    return loading;
  }

  function similarity(entityName,target){
    const a=norm(entityName),b=norm(target);
    if(!a||!b)return {score:0,exact:false,overlap:0,ratio:0};
    if(a===b)return {score:100,exact:true,overlap:tokens(a).length,ratio:1};

    const ta=tokens(a),tb=tokens(b),sa=new Set(ta),sb=new Set(tb);
    if(!sa.size||!sb.size)return {score:0,exact:false,overlap:0,ratio:0};
    let inter=0;for(const t of sa)if(sb.has(t))inter++;
    const minSize=Math.min(sa.size,sb.size),maxSize=Math.max(sa.size,sb.size);
    const coverage=minSize?inter/minSize:0;
    const sizeRatio=maxSize?minSize/maxSize:0;
    const dice=(2*inter)/(sa.size+sb.size);
    const charRatio=Math.min(a.length,b.length)/Math.max(a.length,b.length);

    // La inclusión de una cadena ya no basta por sí sola: exige casi la misma identidad.
    if((a.includes(b)||b.includes(a)) && inter>=3 && coverage>=0.9 && sizeRatio>=0.8 && charRatio>=0.72){
      return {score:95,exact:false,overlap:inter,ratio:coverage};
    }
    const score=Math.round(100*dice);
    return {score,exact:false,overlap:inter,ratio:coverage};
  }

  function candidateScore(e,name){
    const labels=[e?.name,...(Array.isArray(e?.aliases)?e.aliases:[])].filter(Boolean);
    let best={score:0,exact:false,overlap:0,ratio:0,label:''};
    for(const label of labels){const s=similarity(label,name);if(s.score>best.score)best={...s,label:String(label)};}
    return best;
  }

  function findEntity(data,name){
    if(!data||!name)return null;
    const ranked=data.entities
      .map(e=>({e,...candidateScore(e,name)}))
      .filter(x=>x.exact || (x.score>=88 && x.overlap>=3 && x.ratio>=0.82))
      .sort((x,y)=>y.score-x.score||Number(y.e.article_count||0)-Number(x.e.article_count||0));
    if(!ranked.length)return null;
    const top=ranked[0],second=ranked[1];

    // Exacto siempre es admisible. Fuzzy exige puntaje muy alto y separación clara.
    const accepted=top.exact || (top.score>=93 && (!second || top.score-second.score>=7));
    window.__ATLAS_PRESS_LAST_MATCH__={target:name,accepted,top:{name:top.e?.name,score:top.score,exact:top.exact,overlap:top.overlap,ratio:top.ratio,label:top.label},second:second?{name:second.e?.name,score:second.score}:null};
    return accepted?top.e:null;
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
  const obs=new MutationObserver(()=>setTimeout(refresh,100));
  obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden']});
  document.addEventListener('click',()=>{setTimeout(refresh,120);setTimeout(refresh,700);},true);
  setInterval(refresh,1500);void load().then(refresh);
  window.__ATLAS_ENTITY_PRESS_CURRENT__={active:true,version:VERSION,targets:['#aex-sheet','.a45'],feed:FEED,scoreMutation:false,identityMutation:false,matchPolicy:'STRICT_UNAMBIGUOUS_0527_4'};
})();