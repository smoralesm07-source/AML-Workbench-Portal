'use strict';

/* ATLAS AML 0.52.2 · Buscador unificado Entidad | Alias digital */
(function atlasEntitySearchAlias0522(){
  const VERSION='ENTITY-SEARCH-ALIAS-0522.1';
  const FN='aml-entity-sherlock-live';
  let mode='entity';
  let lastAlias='';
  let observer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const root=()=>document.querySelector('.aex');
  const input=()=>document.querySelector('#aex-q');
  const suggest=()=>document.querySelector('#aex-suggest');
  const results=()=>document.querySelector('.aex-results');

  function selectorMarkup(){return `<div class="aex-search-modes" role="tablist" aria-label="Tipo de búsqueda"><button type="button" role="tab" aria-selected="true" class="active" data-aex-search-mode="entity">Entidad</button><button type="button" role="tab" aria-selected="false" data-aex-search-mode="alias">Alias digital</button></div>`;}

  function setMode(next,{focus=true}={}){
    mode=next==='alias'?'alias':'entity';
    document.querySelectorAll('[data-aex-search-mode]').forEach(btn=>{const on=btn.dataset.aexSearchMode===mode;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',String(on));});
    const q=input(), badge=document.querySelector('.aex-mode'), s=suggest();
    if(q){q.placeholder=mode==='alias'?'Username o nickname público':'Razón social, RUT o Entity ID';q.setAttribute('aria-label',mode==='alias'?'Buscar alias digital con Sherlock':'Buscar entidad por razón social, RUT o Entity ID');}
    if(badge){badge.textContent=mode==='alias'?'Sherlock':'Entidad';badge.classList.toggle('alias',mode==='alias');badge.classList.remove('empty');}
    if(s){s.innerHTML='';s.classList.remove('open');}
    if(mode==='alias')renderAliasIdle();
    if(focus)q?.focus();
    window.__ATLAS_ENTITY_SEARCH_ALIAS_0522__={active:true,version:VERSION,mode,automaticSherlock:false,scoreMutation:false,updatedAt:new Date().toISOString()};
  }

  function renderAliasIdle(){const r=results();if(!r)return;r.innerHTML=`<div class="aex-alias-idle"><div class="aex-alias-icon">@</div><h3>Buscar identidad digital</h3><p>Ingresa un username o nickname. Sherlock verificará presencia pública en múltiples plataformas. Una coincidencia de alias no confirma identidad.</p><div><span>Consulta bajo demanda</span><span>No modifica IPA3</span><span>No persiste la búsqueda</span></div></div>`;}

  function resultMarkup(data,username){const a=data?.analytics||{},rows=Array.isArray(data?.records)?data.records:[];return `<section class="aex-alias-result"><header><div><span>SHERLOCK · ALIAS DIGITAL</span><h3>${esc(username)}</h3><p>Perfiles públicos observados para el mismo username. Todos requieren corroboración antes de asociarlos a una entidad.</p></div><button type="button" data-aex-alias-back>Volver a Entidades</button></header><div class="aex-alias-kpis"><span><b>${Number(a.tested||0)}</b><small>sitios probados</small></span><span><b>${Number(a.claimed||0)}</b><small>perfiles observados</small></span><span><b>${Number(a.unknown||0)}</b><small>indeterminados</small></span></div>${rows.length?`<div class="aex-alias-grid">${rows.slice(0,30).map(r=>`<a href="${esc(r.source_url||'#')}" target="_blank" rel="noopener noreferrer"><div><b>${esc(r.evidence?.platform||r.title||'Perfil')}</b><span>@${esc(r.evidence?.username||username)}</span></div><small>possible match · corroborar identidad</small></a>`).join('')}</div>`:'<div class="aex-alias-empty">No se observaron perfiles reclamados en el conjunto probado.</div>'}<footer>Fuente técnica: Sherlock · consulta live autenticada · resultado orientativo, no conclusión AML.</footer></section>`;}

  async function runAlias(){const q=String(input()?.value||'').trim();if(q.length<2){results().innerHTML='<div class="aex-alias-empty">Ingresa un alias de al menos 2 caracteres.</div>';return;}lastAlias=q;const r=results();r.innerHTML='<div class="aex-alias-loading">Buscando presencia pública del alias con Sherlock…</div>';const db=client();if(!db){r.innerHTML='<div class="aex-alias-empty">Supabase no disponible.</div>';return;}try{const {data,error}=await db.functions.invoke(FN,{body:{username:q}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Sherlock no disponible');r.innerHTML=resultMarkup(data,q);r.querySelector('[data-aex-alias-back]')?.addEventListener('click',()=>setMode('entity'));window.__ATLAS_ENTITY_SEARCH_ALIAS_0522__={active:true,version:VERSION,mode:'alias',lastAlias:q,analytics:data.analytics||{},registry:data.registry||null,automaticSherlock:false,identityAssertion:false,scoreMutation:false,checkedAt:data.checked_at||new Date().toISOString()};}catch(e){r.innerHTML=`<div class="aex-alias-empty">No fue posible completar la consulta Sherlock: ${esc(e?.message||e)}</div>`;}}

  function addSherlockSuggestion(){if(mode!=='entity')return;const s=suggest(),q=String(input()?.value||'').trim();if(!s||q.length<2)return;const empty=s.querySelector('.aex-suggest-empty');if(!empty||s.querySelector('[data-aex-try-alias]'))return;const btn=document.createElement('button');btn.type='button';btn.className='aex-alias-suggest';btn.dataset.aexTryAlias='1';btn.innerHTML=`<span><b>¿Es un alias digital?</b><small>Buscar “${esc(q)}” con Sherlock</small></span><em>@</em>`;btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setMode('alias',{focus:false});const field=input();if(field)field.value=q;void runAlias();});empty.insertAdjacentElement('afterend',btn);}

  function bind(){const x=root();if(!x||x.dataset.aexAliasBound==='1')return;const command=x.querySelector('.aex-command-top'),field=input(),run=document.querySelector('#aex-run');if(!command||!field||!run)return;x.dataset.aexAliasBound='1';if(!command.querySelector('.aex-search-modes'))command.insertAdjacentHTML('afterbegin',selectorMarkup());command.querySelectorAll('[data-aex-search-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.aexSearchMode)));
    field.addEventListener('input',e=>{if(mode==='alias'){e.stopImmediatePropagation();const s=suggest();if(s){s.innerHTML='';s.classList.remove('open');}const badge=document.querySelector('.aex-mode');if(badge)badge.textContent='Sherlock';}},true);
    field.addEventListener('keydown',e=>{if(mode==='alias'&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();void runAlias();}},true);
    run.addEventListener('click',e=>{if(mode==='alias'){e.preventDefault();e.stopImmediatePropagation();void runAlias();}},true);
    const s=suggest();if(s){const mo=new MutationObserver(()=>addSherlockSuggestion());mo.observe(s,{childList:true,subtree:true});}
    setMode('entity',{focus:false});
  }

  observer=new MutationObserver(()=>bind());observer.observe(document.documentElement,{childList:true,subtree:true});bind();
  window.__ATLAS_ENTITY_SEARCH_ALIAS_0522__={active:true,version:VERSION,mode:'entity',automaticSherlock:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();