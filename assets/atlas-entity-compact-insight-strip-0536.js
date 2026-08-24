'use strict';
/* ATLAS AML 0.53.6 · compact, dynamic summary for Entity Explorer.
 * Replaces the large priority / coverage-condition / territory block with one
 * small strip. Legacy analytics remain available on demand as methodology detail.
 */
(function atlasEntityCompactInsightStrip0536(){
  const TITLES=['PRIORIDAD EN EL RESULTADO','COBERTURA × CONDICIÓN REGISTRAL','TERRITORIO'];
  const SOURCE_META=[['sii','SII'],['uaf','UAF'],['osfl','OSFL'],['press','Prensa'],['san','Sanciones']];
  let scheduled=false;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const int=v=>{const n=Number(String(v??'').replace(/[^0-9-]/g,''));return Number.isFinite(n)?n:null;};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function titleNode(title){
    const target=norm(title);
    return [...document.querySelectorAll('#content h2,#content h3,#content h4,#content h5,#content strong,#content [class*="title"]')]
      .find(n=>norm(n.textContent)===target)||null;
  }
  function ownCard(node){
    if(!node)return null;
    let cur=node;
    for(let i=0;i<6&&cur?.parentElement;i++){
      const here=norm(cur.textContent);
      const hits=TITLES.filter(t=>here.includes(norm(t))).length;
      const parent=cur.parentElement, parentHits=TITLES.filter(t=>norm(parent.textContent).includes(norm(t))).length;
      if(hits===1&&parentHits>1)return cur;
      cur=parent;
    }
    return node.closest('article,section')||node.parentElement;
  }
  function commonAncestor(nodes){
    if(!nodes.length||nodes.some(x=>!x))return null;
    let cur=nodes[0];
    while(cur&&cur!==document.body){if(nodes.every(n=>cur.contains(n)))return cur;cur=cur.parentElement;}
    return null;
  }
  function labeled(text,label){
    const t=String(text||'').replace(/\s+/g,' ');
    const a=new RegExp('(\\d+)\\s*'+label,'i').exec(t);if(a)return int(a[1]);
    const b=new RegExp(label+'\\s*(\\d+)','i').exec(t);return b?int(b[1]):null;
  }
  function loadedCount(){
    const text=document.querySelector('.aex')?.textContent||'';
    const labeledCount=labeled(text,'CARGADAS?');
    return labeledCount??(document.querySelectorAll('.aex-print:not(.sample)').length||0);
  }
  function sourceStats(){
    const prints=[...document.querySelectorAll('.aex-print:not(.sample)')];
    const out={};SOURCE_META.forEach(([k])=>out[k]=0);
    for(const p of prints)for(const [k] of SOURCE_META)if(p.querySelector(`i.${k}.on`))out[k]++;
    return {out,total:SOURCE_META.reduce((s,[k])=>s+out[k],0),entities:prints.length};
  }
  function territoryStats(card,loaded){
    const txt=card?.textContent||'';
    const none=labeled(txt,'Sin territorio')??0;
    const informed=Math.max(0,(loaded||0)-none);
    const pct=loaded?Math.round(informed*100/loaded):0;
    return{none,informed,pct};
  }
  function priorityStats(card){
    const txt=card?.textContent||'';
    const values=['Muy alta','Alta','Media','Baja'].map(l=>labeled(txt,l)??0);
    return {marked:values.reduce((a,b)=>a+b,0),veryHigh:values[0],high:values[1],medium:values[2],low:values[3],unmarked:labeled(txt,'Sin marca')??0};
  }
  function sourceMarkup(stats){
    const total=stats.total||1;
    const bars=SOURCE_META.map(([k])=>stats.out[k]?`<i class="${k}" style="flex:${stats.out[k]/total}"></i>`:'').join('');
    const legend=SOURCE_META.map(([k,label])=>`<span class="${k}"><i></i>${esc(label)} <b>${stats.out[k]}</b></span>`).join('');
    return `<div class="aex-source-mini">${bars}</div><div class="aex-source-legend">${legend}</div>`;
  }
  function snapshot(cards){
    const prints=[...document.querySelectorAll('.aex-print:not(.sample)')].map(p=>SOURCE_META.map(([k])=>p.querySelector(`i.${k}.on`)?'1':'0').join('')).join('|');
    return [cards.map(c=>norm(c.textContent)).join('|'),prints,loadedCount()].join('::');
  }
  function build(cards,legacy){
    const loaded=loadedCount(),p=priorityStats(cards[0]),s=sourceStats(),t=territoryStats(cards[2],loaded);
    const totalPriority=p.marked+p.unmarked;
    const priorityPct=totalPriority?Math.round(p.marked*100/totalPriority):0;
    const strip=document.createElement('section');strip.className='aex-insight-strip';strip.dataset.aexInsightStrip='0536';
    strip.innerHTML=`
      <div class="aex-insight-unit"><span class="aex-insight-kicker">Lectura del resultado</span><div class="aex-insight-main"><strong>${p.marked}</strong><span>con prioridad analítica</span></div><div class="aex-insight-pills"><span class="aex-insight-pill"><b>${loaded}</b> cargadas</span><span class="aex-insight-pill"><b>${priorityPct}%</b> con marca</span>${p.veryHigh?`<span class="aex-insight-pill"><b>${p.veryHigh}</b> muy alta</span>`:''}</div></div>
      <div class="aex-insight-unit"><span class="aex-insight-kicker">Procedencia observable</span><div class="aex-insight-main"><strong>${s.entities}</strong><span>entidades con huella visible</span></div>${sourceMarkup(s)}<div class="aex-insight-sub">Frecuencia de presencia por fuente en las filas visibles; más fuentes es más contexto, no más riesgo.</div></div>
      <div class="aex-insight-unit"><span class="aex-insight-kicker">Territorialidad útil</span><div class="aex-insight-main"><strong>${t.pct}%</strong><span>con territorio informado</span></div><div class="aex-territory-gauge"><i style="width:${t.pct}%"></i></div><div class="aex-insight-pills"><span class="aex-insight-pill"><b>${t.informed}</b> informadas</span><span class="aex-insight-pill"><b>${t.none}</b> sin territorio</span></div></div>
      <button type="button" class="aex-insight-detail" aria-expanded="false">Ver detalle metodológico</button>`;
    strip.querySelector('.aex-insight-detail').addEventListener('click',e=>{
      const expanded=e.currentTarget.getAttribute('aria-expanded')==='true';
      e.currentTarget.setAttribute('aria-expanded',String(!expanded));e.currentTarget.textContent=expanded?'Ver detalle metodológico':'Ocultar detalle metodológico';
      legacy.classList.toggle('aex-legacy-analytics-hidden',expanded);legacy.classList.toggle('aex-legacy-analytics-expanded',!expanded);
    });
    return strip;
  }
  function mount(){
    scheduled=false;
    const existing=document.querySelector('[data-aex-insight-strip="0536"]');
    const heads=TITLES.map(titleNode);if(heads.some(x=>!x)){existing?.remove();return;}
    const cards=heads.map(ownCard);if(cards.some(x=>!x))return;
    const legacy=commonAncestor(cards);if(!legacy||legacy===document.querySelector('#content')||legacy===document.querySelector('.aex'))return;
    const fingerprint=snapshot(cards);
    if(existing&&existing.dataset.fingerprint===fingerprint)return;
    const wasExpanded=existing?.querySelector('.aex-insight-detail')?.getAttribute('aria-expanded')==='true';
    existing?.remove();
    legacy.classList.add('aex-legacy-analytics-hidden');legacy.classList.remove('aex-legacy-analytics-expanded');
    const strip=build(cards,legacy);strip.dataset.fingerprint=fingerprint;legacy.insertAdjacentElement('beforebegin',strip);
    if(wasExpanded)strip.querySelector('.aex-insight-detail')?.click();
    window.__ATLAS_ENTITY_COMPACT_INSIGHT_0536__={active:true,release:'0.53.6',replacesLegacyAnalytics:true,dynamic:true,legacyDetailAvailable:true,updatedAt:new Date().toISOString()};
  }
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(mount,80);}
  const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',schedule,true);document.addEventListener('change',schedule,true);
  schedule();
})();
