'use strict';

/* ATLAS AML 0.52.4 · Buscador Entidad | Identidad Digital */
(function atlasEntitySearchAlias0524(){
  const VERSION='DIGITAL-IDENTITY-EXPLORER-0524.1';
  const FN='aml-digital-identity-live';
  let mode='entity';
  let lastAlias='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const root=()=>document.querySelector('.aex');
  const input=()=>document.querySelector('#aex-q');
  const suggest=()=>document.querySelector('#aex-suggest');
  const results=()=>document.querySelector('.aex-results');

  function selectorMarkup(){return `<div class="aex-search-modes" role="tablist" aria-label="Tipo de búsqueda"><button type="button" role="tab" aria-selected="true" class="active" data-aex-search-mode="entity">Entidad</button><button type="button" role="tab" aria-selected="false" data-aex-search-mode="alias">Identidad digital</button></div>`;}

  function setMode(next,{focus=true,preserve=false}={}){
    mode=next==='alias'?'alias':'entity';
    document.querySelectorAll('[data-aex-search-mode]').forEach(btn=>{const on=btn.dataset.aexSearchMode===mode;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',String(on));});
    const q=input(),badge=document.querySelector('.aex-mode'),s=suggest();
    if(q){q.placeholder=mode==='alias'?'Username, nickname o alias público':'Razón social, RUT o Entity ID';q.setAttribute('aria-label',mode==='alias'?'Explorar identidad digital por alias':'Buscar entidad por razón social, RUT o Entity ID');}
    if(badge){badge.textContent=mode==='alias'?'Multi-motor':'Entidad';badge.classList.toggle('alias',mode==='alias');badge.classList.remove('empty');}
    if(s){s.innerHTML='';s.classList.remove('open');}
    if(mode==='alias'&&!preserve)renderIdle();
    if(focus)q?.focus();
    window.__ATLAS_DIGITAL_IDENTITY_0524__={active:true,version:VERSION,mode,automaticSearch:false,scoreMutation:false,updatedAt:new Date().toISOString()};
  }

  function renderIdle(){const r=results();if(!r)return;r.innerHTML=`<section class="aex-alias-idle"><div class="aex-alias-icon">@</div><h3>Explorar una identidad digital</h3><p>Busca un username o nickname en múltiples fuentes OSINT. Atlas combina Sherlock y WhatsMyName en la búsqueda rápida y permite una profundización adicional con reglas de Maigret.</p><div><span>Sherlock</span><span>WhatsMyName</span><span>Maigret rules</span><span>No modifica IPA3</span></div></section>`;}

  const engineBadge=(name,status)=>`<span class="aex-engine ${status==='ready'?'ok':status==='degraded'?'bad':'off'}"><i></i>${esc(name)} · ${status==='ready'?'activo':status==='degraded'?'degradado':'no solicitado'}</span>`;
  function platformCard(row,username){const e=row.evidence||{},engines=e.engines||[],multi=engines.length>=2;return `<a class="aex-digital-card ${multi?'consensus':''}" href="${esc(row.source_url||'#')}" target="_blank" rel="noopener noreferrer"><div class="aex-digital-card-top"><div><b>${esc(e.platform||row.title||'Perfil')}</b><span>@${esc(e.username||username)}</span></div><em>${multi?`${engines.length} motores`:'1 motor'}</em></div><div class="aex-engine-tags">${engines.map(x=>`<span>${esc(x)}</span>`).join('')}</div><small>${multi?'coincidencia técnica multi-motor':'possible match'} · corroborar identidad</small></a>`;}

  function resultMarkup(data,username){
    const a=data?.analytics||{},rows=Array.isArray(data?.records)?data.records:[],health=data?.engine_health||{},deep=data?.depth==='deep';
    return `<section class="aex-alias-result aex-digital-explorer">
      <header><div><span>IDENTIDAD DIGITAL · ${deep?'PROFUNDIZACIÓN':'BÚSQUEDA RÁPIDA'}</span><h3>${esc(username)}</h3><p>Atlas consolida coincidencias del mismo alias entre motores. La coincidencia técnica de username, incluso multi-motor, no acredita que los perfiles pertenezcan a la misma persona.</p></div><div class="aex-digital-actions"><button type="button" data-aex-digital-depth="quick" ${!deep?'disabled':''}>Rápida</button><button type="button" class="primary" data-aex-digital-depth="deep" ${deep?'disabled':''}>Profundizar</button><button type="button" data-aex-alias-back>Volver</button></div></header>
      <div class="aex-engine-row">${Object.entries(health).map(([k,v])=>engineBadge(k,v)).join('')}</div>
      <div class="aex-alias-kpis"><span><b>${Number(a.tested||0)}</b><small>comprobaciones</small></span><span><b>${Number(a.profiles||0)}</b><small>perfiles observados</small></span><span><b>${Number(a.consensus_2plus||0)}</b><small>coincidencias 2+ motores</small></span><span><b>${Number(a.unknown||0)}</b><small>indeterminadas</small></span></div>
      <div class="aex-digital-method"><div><b>Lectura recomendada</b><span>Prioriza coincidencias observadas por 2 o más motores; luego revisa URL, contenido y contexto antes de vincular el alias a una entidad.</span></div><div><b>${deep?'Maigret: reglas de detección':'Cobertura rápida'}</b><span>${deep?'La Edge Function usa el catálogo de reglas de Maigret; todavía no ejecuta su runtime Python recursivo completo.':'Sherlock + WhatsMyName con consulta live no persistente.'}</span></div></div>
      ${rows.length?`<div class="aex-alias-grid">${rows.slice(0,60).map(r=>platformCard(r,username)).join('')}</div>`:'<div class="aex-alias-empty">No se observaron perfiles en el conjunto consultado.</div>'}
      <footer>Consulta live autenticada · NSFW excluido · sin persistencia · sin transferencia de riesgo · sin modificación de IPA3.</footer>
    </section>`;
  }

  async function runAlias(depth='quick'){
    const q=String(input()?.value||'').trim();if(q.length<2){results().innerHTML='<div class="aex-alias-empty">Ingresa un alias de al menos 2 caracteres.</div>';return;}lastAlias=q;
    const r=results();r.innerHTML=`<div class="aex-alias-loading">${depth==='deep'?'Profundizando':'Buscando'} identidad digital con ${depth==='deep'?'Sherlock + WhatsMyName + reglas Maigret':'Sherlock + WhatsMyName'}…</div>`;
    const db=client();if(!db){r.innerHTML='<div class="aex-alias-empty">Supabase no disponible.</div>';return;}
    try{const {data,error}=await db.functions.invoke(FN,{body:{username:q,depth}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Identidad Digital no disponible');r.innerHTML=resultMarkup(data,q);bindResult();window.__ATLAS_DIGITAL_IDENTITY_0524__={active:true,version:VERSION,mode:'alias',lastAlias:q,depth,analytics:data.analytics||{},engineHealth:data.engine_health||{},coverage:data.coverage||{},automaticSearch:false,identityAssertion:false,scoreMutation:false,checkedAt:data.checked_at||new Date().toISOString()};}catch(e){r.innerHTML=`<div class="aex-alias-empty">No fue posible completar la exploración digital: ${esc(e?.message||e)}</div>`;}
  }

  function bindResult(){const r=results();r?.querySelector('[data-aex-alias-back]')?.addEventListener('click',()=>setMode('entity'));r?.querySelectorAll('[data-aex-digital-depth]').forEach(btn=>btn.addEventListener('click',()=>void runAlias(btn.dataset.aexDigitalDepth||'quick')));}

  function addDigitalSuggestion(){if(mode!=='entity')return;const s=suggest(),q=String(input()?.value||'').trim();if(!s||q.length<2)return;const empty=s.querySelector('.aex-suggest-empty');if(!empty||s.querySelector('[data-aex-try-alias]'))return;const btn=document.createElement('button');btn.type='button';btn.className='aex-alias-suggest';btn.dataset.aexTryAlias='1';btn.innerHTML=`<span><b>¿Es una identidad digital?</b><small>Explorar “${esc(q)}” con múltiples motores OSINT</small></span><em>@</em>`;btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setMode('alias',{focus:false,preserve:true});const field=input();if(field)field.value=q;void runAlias('quick');});empty.insertAdjacentElement('afterend',btn);}

  function bind(){const x=root();if(!x||x.dataset.aexAliasBound==='0524')return;const command=x.querySelector('.aex-command-top'),field=input(),run=document.querySelector('#aex-run');if(!command||!field||!run)return;x.dataset.aexAliasBound='0524';command.querySelector('.aex-search-modes')?.remove();command.insertAdjacentHTML('afterbegin',selectorMarkup());command.querySelectorAll('[data-aex-search-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.aexSearchMode)));
    field.addEventListener('input',e=>{if(mode==='alias'){e.stopImmediatePropagation();const s=suggest();if(s){s.innerHTML='';s.classList.remove('open');}const badge=document.querySelector('.aex-mode');if(badge)badge.textContent='Multi-motor';}},true);
    field.addEventListener('keydown',e=>{if(mode==='alias'&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();void runAlias('quick');}},true);
    run.addEventListener('click',e=>{if(mode==='alias'){e.preventDefault();e.stopImmediatePropagation();void runAlias('quick');}},true);
    const s=suggest();if(s){const mo=new MutationObserver(()=>addDigitalSuggestion());mo.observe(s,{childList:true,subtree:true});}
    const context=window.__ATLAS_DIGITAL_CONTEXT__;setMode(context?.alias?'alias':'entity',{focus:false,preserve:!!context?.alias});if(context?.alias){field.value=context.alias;void runAlias('quick');window.__ATLAS_DIGITAL_CONTEXT__=null;}
  }

  const observer=new MutationObserver(()=>bind());observer.observe(document.documentElement,{childList:true,subtree:true});bind();
  window.__ATLAS_DIGITAL_IDENTITY_0524__={active:true,version:VERSION,mode:'entity',automaticSearch:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();