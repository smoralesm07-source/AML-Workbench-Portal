'use strict';

/* ATLAS · Entidades · press-search race fix · 2026-08-28
 * Fixes the cold-start/race observed with press-only names (e.g. Fodich):
 * - 0512 canonical autocomplete rewrites #aex-suggest asynchronously;
 * - the press bridge can finish before/after that rewrite;
 * - on a cold press index, Enter may run before press rows are ready.
 *
 * This layer keeps canonical search non-blocking and identity governance intact.
 * It only stabilizes presentation/interaction of unreconciled press suggestions.
 */
(function atlasEntityPressSearchRacefix20260828(){
  const FLAG='__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX_20260828__';
  const BUILD='20260828-racefix1';
  const MIN=3;
  const MAX_WAIT=30000;
  if(window[FLAG])return;
  window[FLAG]=true;

  let latest={term:'',rows:[]};
  let pending=null;
  let pendingTerm='';
  let timer=null;
  let bypassRun=false;
  let hostObserver=null;
  let observedHost=null;

  const clean=v=>String(v??'').trim().replace(/[%_]/g,'').slice(0,120);
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const input=()=>document.querySelector('.aex #aex-q');
  const box=()=>document.querySelector('.aex #aex-suggest');
  const bridge=()=>window.__ATLAS_ENTITY_PRESS_SEARCH_BRIDGE__||null;
  const entry=()=>window.__ATLAS_ENTITY_ENTRY__||null;

  function canonicalState(){
    const host=box();
    if(host?.querySelector('[data-aex-suggest-id]'))return 'match';
    if(host?.querySelector('.aex-suggest-empty'))return 'empty';
    return 'unknown';
  }

  function pressMarkup(rows){
    return rows.map((row,index)=>`<button type="button" class="aex-suggest-item" data-aex-press-racefix-index="${index}">
      <span><b>${esc(row.name||'Observación de prensa')}</b><small>Prensa · ${Number(row.article_count||0).toLocaleString('es-CL')} publicación(es) · sin RUT inferido</small></span>
      <em>No conciliada</em>
    </button>`).join('');
  }

  function render(term,rows){
    const host=box();
    const field=input();
    if(!host||!field||clean(field.value)!==clean(term))return;

    /* 20260828-perf1 may have inserted its own group. Replace it with one
       stable group governed by this race-fix to avoid duplicate suggestions. */
    host.querySelectorAll('[data-aex-press-bridge]').forEach(node=>node.remove());
    host.querySelector('[data-aex-press-racefix]')?.remove();
    if(!rows.length)return;

    const group=document.createElement('div');
    group.dataset.aexPressRacefix='1';
    group.innerHTML=pressMarkup(rows);
    host.appendChild(group);
    host.classList.add('open');
  }

  function preserve(){
    const field=input();
    if(!field)return;
    const term=clean(field.value);
    if(!term||term!==latest.term||!latest.rows.length)return;
    const host=box();
    if(!host)return;
    host.querySelectorAll('[data-aex-press-bridge]').forEach(node=>node.remove());
    if(!host.querySelector('[data-aex-press-racefix]'))render(term,latest.rows);
  }

  function observeSuggestionHost(){
    const host=box();
    if(!host||host===observedHost)return;
    hostObserver?.disconnect();
    observedHost=host;
    hostObserver=new MutationObserver(()=>queueMicrotask(preserve));
    hostObserver.observe(host,{childList:true,subtree:false});
    preserve();
  }

  async function search(term){
    const q=clean(term);
    if(norm(q).length<MIN){
      latest={term:'',rows:[]};
      box()?.querySelector('[data-aex-press-racefix]')?.remove();
      return [];
    }
    const api=bridge();
    if(!api||typeof api.search!=='function')return [];
    if(pending&&pendingTerm===q)return pending;

    pendingTerm=q;
    pending=Promise.resolve(api.search(q)).then(rows=>{
      const current=clean(input()?.value||'');
      const normalized=Array.isArray(rows)?rows:[];
      if(current===q){
        latest={term:q,rows:normalized};
        render(q,normalized);
      }
      return normalized;
    }).catch(()=>{
      if(clean(input()?.value||'')===q)latest={term:q,rows:[]};
      return [];
    }).finally(()=>{
      if(pendingTerm===q){pending=null;pendingTerm='';}
    });
    return pending;
  }

  function warmForEntities(){
    observeSuggestionHost();
    const api=bridge();
    try{api?.warm?.();}catch(_error){}
    const field=input();
    if(field&&norm(field.value).length>=MIN)void search(field.value);
  }

  function openRow(row,term){
    const e=entry();
    if(!row||typeof e?.openPressObservation!=='function')return false;
    void e.openPressObservation(row,term);
    return true;
  }

  async function resolvePressOnlyAction(term,source){
    const q=clean(term);
    if(norm(q).length<MIN)return false;
    const rows=(latest.term===q&&latest.rows.length)?latest.rows:await search(q);
    if(rows.length&&canonicalState()!=='match')return openRow(rows[0],q);

    /* No press-only hit: restore the normal 0512 Buscar path once. */
    if(source==='run'){
      const run=document.querySelector('.aex #aex-run');
      if(run){
        bypassRun=true;
        run.click();
        queueMicrotask(()=>{bypassRun=false;});
      }
    }else{
      const run=document.querySelector('.aex #aex-run');
      if(run){
        bypassRun=true;
        run.click();
        queueMicrotask(()=>{bypassRun=false;});
      }
    }
    return false;
  }

  document.addEventListener('input',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex'))return;
    observeSuggestionHost();
    clearTimeout(timer);
    const q=target.value;
    if(norm(q).length<MIN){
      latest={term:'',rows:[]};
      box()?.querySelector('[data-aex-press-racefix]')?.remove();
      return;
    }
    timer=setTimeout(()=>void search(q),170);
  },true);

  document.addEventListener('focusin',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex'))return;
    warmForEntities();
    if(norm(target.value).length>=MIN)void search(target.value);
  },true);

  document.addEventListener('click',event=>{
    const pressButton=event.target.closest?.('[data-aex-press-racefix-index]');
    if(pressButton){
      event.preventDefault();
      event.stopImmediatePropagation();
      const row=latest.rows[Number(pressButton.dataset.aexPressRacefixIndex)];
      openRow(row,latest.term);
      return;
    }

    const run=event.target.closest?.('#aex-run');
    if(!run||!run.closest('.aex'))return;
    if(bypassRun){bypassRun=false;return;}
    const q=clean(input()?.value||'');
    if(norm(q).length<MIN)return;
    const state=canonicalState();
    if(state==='match')return;

    const ready=latest.term===q&&latest.rows.length>0;
    const coldOrEmpty=state==='empty'||(state==='unknown'&&(pending&&pendingTerm===q));
    if(ready||coldOrEmpty){
      event.preventDefault();
      event.stopImmediatePropagation();
      void resolvePressOnlyAction(q,'run');
    }
  },true);

  document.addEventListener('keydown',event=>{
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.id!=='aex-q'||!target.closest('.aex')||event.key!=='Enter')return;
    const q=clean(target.value);
    if(norm(q).length<MIN)return;
    const state=canonicalState();
    if(state==='match')return;

    const ready=latest.term===q&&latest.rows.length>0;
    const coldOrEmpty=state==='empty'||(state==='unknown'&&(pending&&pendingTerm===q));
    if(ready||coldOrEmpty){
      event.preventDefault();
      event.stopImmediatePropagation();
      void resolvePressOnlyAction(q,'enter');
    }
  },true);

  document.addEventListener('atlas:entity-workspace-ready',warmForEntities);

  const rootObserver=new MutationObserver(()=>{
    if(document.querySelector('.aex #aex-q'))warmForEntities();
  });
  rootObserver.observe(document.documentElement,{childList:true,subtree:true});

  /* The bridge is injected asynchronously by the entity workspace bootstrap.
     Retry briefly so this patch also survives very early Entidades navigation. */
  const started=Date.now();
  const wait=setInterval(()=>{
    if(bridge()){
      clearInterval(wait);
      warmForEntities();
    }else if(Date.now()-started>MAX_WAIT){
      clearInterval(wait);
    }
  },100);

  window.__ATLAS_ENTITY_PRESS_SEARCH_RACEFIX__={
    active:true,
    build:BUILD,
    policy:'PRESERVE_PRESS_ROWS_ACROSS_CANONICAL_DOM_REWRITES+ENTER_WAITS_ONLY_WHEN_CANONICAL_EMPTY_OR_PRESS_PENDING',
    automaticIdentityJoin:false,
    inferredRut:false,
    installedAt:new Date().toISOString()
  };
})();
