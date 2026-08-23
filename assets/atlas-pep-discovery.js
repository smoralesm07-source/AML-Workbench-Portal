(function(){
  'use strict';

  const VIEW='pep-discovery';
  const DEFAULT_SOURCE='./data/pep_discovery_latest.json';
  const cache={payload:null,loadedAt:0,error:null,promise:null};
  const ui={query:'',review:'ALL',linkage:'ALL',signal:'ALL'};
  let observer=null,hookedShell=null,hookedNavigate=null;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const fmt=(value,d=0)=>num(value).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});
  const clp=value=>{const n=num(value);if(!n)return '$0';if(Math.abs(n)>=1e9)return '$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil MM';if(Math.abs(n)>=1e6)return '$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' MM';return '$'+Math.round(n).toLocaleString('es-CL');};
  const pct=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('es-CL',{maximumFractionDigits:1})+'%':'—';
  const arr=value=>Array.isArray(value)?value:[];
  const obj=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const source=()=>String(window.ATLAS_PEP_DISCOVERY_SOURCE||DEFAULT_SOURCE);
  const isActive=()=>window.state?.view===VIEW;

  function icon(){return '<span class="atlas-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="7" cy="7" r="2.4"/><circle cx="17" cy="7" r="2.4"/><circle cx="12" cy="17" r="2.4"/><path d="M9.2 7h5.6M8.4 9l2.4 5.7M15.6 9l-2.4 5.7"/></svg></span>';}
  function ensureNav(){
    const nav=document.querySelector('.v019-nav');if(!nav)return false;
    let button=nav.querySelector('[data-atlas-pep-view="1"]');
    if(!button){
      button=document.createElement('button');button.type='button';button.className='v019-nav-btn atlas-nav-btn atlas-pep-nav-button';button.dataset.atlasPepView='1';button.setAttribute('aria-label','Personas y control');
      button.innerHTML=icon()+'<span class="atlas-nav-text">Personas y control</span><span class="atlas-nav-chevron" aria-hidden="true">›</span>';
      button.addEventListener('click',()=>window.navigate?.(VIEW));
    }
    const anchor=nav.querySelector('.v019-nav-btn[data-view="questions"]');
    if(anchor&&anchor.nextSibling!==button)anchor.insertAdjacentElement('afterend',button);else if(!button.isConnected)nav.appendChild(button);
    button.classList.toggle('active',isActive());button.setAttribute('aria-current',isActive()?'page':'false');
    return true;
  }

  function setNavActive(){
    document.querySelectorAll('.v019-nav-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.atlasPepView==='1'?isActive():btn.dataset.view===window.state?.view));
    ensureNav();
  }

  async function fetchJson(url){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
    try{const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('HTTP '+response.status);return await response.json();}
    finally{clearTimeout(timeout);}
  }
  function validate(payload){
    if(!payload||payload.schema!=='ATLAS_PEP_DISCOVERY_LATEST_V1')throw new Error('Contrato PEP no reconocido');
    if(!Array.isArray(payload.top_cases)||!payload.coverage||!payload.lineage)throw new Error('Contrato PEP incompleto');
    return payload;
  }
  async function load(force=false){
    if(cache.payload&&!force)return cache.payload;
    if(cache.promise&&!force)return cache.promise;
    cache.promise=(async()=>{try{const payload=validate(await fetchJson(source()));cache.payload=payload;cache.loadedAt=Date.now();cache.error=null;return payload;}catch(error){cache.error=error;throw error;}finally{cache.promise=null;}})();
    return cache.promise;
  }

  function statusClass(payload){return String(payload.status||'').toUpperCase()==='COMPLETE'?'complete':'partial';}
  function statusText(payload){return String(payload.status||'').toUpperCase()==='COMPLETE'?'Cobertura completa':'Cobertura parcial';}
  function pepCount(payload){return num(obj(payload.pep).confirmed_for_discovery);}
  function failedPeriods(payload){return arr(payload.failed_periods);}
  function coverage(payload){return obj(payload.coverage);}
  function casesCount(payload,key){return num(obj(payload.cases)[key]);}
  function bo(payload,key){return num(obj(payload.beneficial_ownership)[key]);}
  function generated(payload){const v=payload.generated_at;if(!v)return 'corte no informado';try{return new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return String(v);}}

  function flow(payload){
    return `<div class="atlas-pep-flow" aria-label="Cadena analítica PEP, propiedad y compras">
      <div class="atlas-pep-flow-step"><small>1 · Resolver PEP</small><b>${fmt(pepCount(payload))}</b><span>personas confirmadas para discovery</span></div>
      <div class="atlas-pep-flow-step"><small>2 · Propiedad</small><b>${fmt(bo(payload,'downstream_targets'))}</b><span>sociedades BF ≥ umbral aguas abajo</span></div>
      <div class="atlas-pep-flow-step"><small>3 · Compras</small><b>${fmt(bo(payload,'supplier_targets'))}</b><span>proveedores objetivo contrastados</span></div>
      <div class="atlas-pep-flow-step"><small>4 · Lectura</small><b>${fmt(casesCount(payload,'cases'))}</b><span>relaciones consolidadas para análisis</span></div>
    </div>`;
  }

  function kpis(payload){const c=coverage(payload);return `<div class="atlas-pep-kpis">
    <article class="atlas-pep-kpi"><span class="lab">PEP resueltas</span><b>${fmt(pepCount(payload))}</b><small>categorías gobernadas Circular 62</small></article>
    <article class="atlas-pep-kpi"><span class="lab">BF downstream</span><b>${fmt(bo(payload,'downstream_targets'))}</b><small>participación económica calculada ≥10%</small></article>
    <article class="atlas-pep-kpi"><span class="lab">Proveedor + BF PEP</span><b>${fmt(bo(payload,'suppliers_with_pep_bf'))}</b><small>contexto, no señal adversa</small></article>
    <article class="atlas-pep-kpi"><span class="lab">Casos contexto</span><b>${fmt(casesCount(payload,'context'))}</b><small>relación explicable sin señal de revisión</small></article>
    <article class="atlas-pep-kpi hot"><span class="lab">Para revisar</span><b>${fmt(casesCount(payload,'review'))}</b><small>sólo PEP-03 / PEP-04</small></article>
    <article class="atlas-pep-kpi"><span class="lab">Órdenes cargadas</span><b>${fmt(c.orders_loaded)}</b><small>${fmt(c.orders_matched)} órdenes en universo coincidente</small></article>
  </div>`;}

  function mix(payload){
    const direct=casesCount(payload,'bf_direct'),indirect=casesCount(payload,'bf_indirect'),control=casesCount(payload,'control_only');const total=Math.max(1,direct+indirect+control);const d1=(direct/total*100).toFixed(2)+'%',d2=((direct+indirect)/total*100).toFixed(2)+'%';
    return `<div class="atlas-pep-donut-wrap"><div class="atlas-pep-donut" style="--d1:${d1};--d2:${d2}"><div class="atlas-pep-donut-center"><b>${fmt(direct+indirect+control)}</b><span>vínculos</span></div></div><div class="atlas-pep-legend">
      <div class="atlas-pep-legend-row"><i style="--c:var(--pep-accent)"></i><span>BF directo calculado</span><b>${fmt(direct)}</b></div>
      <div class="atlas-pep-legend-row"><i style="--c:#7e77cf"></i><span>BF indirecto calculado</span><b>${fmt(indirect)}</b></div>
      <div class="atlas-pep-legend-row"><i style="--c:var(--pep-muted)"></i><span>Control declarado</span><b>${fmt(control)}</b></div>
    </div></div>`;
  }

  function periods(payload){
    const downloaded=new Set(arr(payload.downloaded_periods).map(String));const failed=new Set(failedPeriods(payload).map(x=>`${x.year}-${String(x.month).padStart(2,'0')}`));
    const requested=arr(payload.requested_periods);if(!requested.length)return '<div class="atlas-pep-note">El contrato no informa períodos solicitados.</div>';
    return `<div class="atlas-pep-periods">${requested.map(v=>{const s=String(v),normalized=/^\d{4}-\d$/.test(s)?s.replace(/-(\d)$/,'-0$1'):s;const cls=downloaded.has(s)||downloaded.has(normalized)?'ok':failed.has(s)||failed.has(normalized)?'fail':'';return `<span class="atlas-pep-period ${cls}" title="${cls==='ok'?'Período cargado':cls==='fail'?'Período con error':'Estado no confirmado'}">${esc(normalized)}</span>`;}).join('')}</div>`;
  }

  function topBars(payload){const rows=arr(payload.top_cases).slice(0,7);if(!rows.length)return '<div class="atlas-pep-note">Sin casos en el corte actual.</div>';const max=Math.max(...rows.map(x=>num(x.amount_total_clp)),1);return `<div class="atlas-pep-bars">${rows.map(c=>`<div class="atlas-pep-bar"><span class="atlas-pep-bar-label" title="${esc(c.company_name||c.company_rut)}">${esc(c.company_name||c.company_rut||'Entidad')}</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:${Math.max(2,num(c.amount_total_clp)/max*100).toFixed(1)}%"></div></div><span class="atlas-pep-bar-value">${esc(clp(c.amount_total_clp))}</span></div>`).join('')}</div>`;}

  function filters(rows){
    const linkages=[...new Set(rows.map(x=>x.linkage_strength).filter(Boolean))];const signals=[...new Set(rows.flatMap(x=>[...arr(x.relationship_signals),...arr(x.review_signals)]))].sort();
    return `<div class="atlas-pep-toolbar" aria-label="Filtros de descubrimiento">
      <label class="atlas-pep-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg><input id="atlas-pep-query" class="atlas-pep-field" type="search" value="${esc(ui.query)}" placeholder="Persona, empresa, RUT o institución" aria-label="Buscar en casos"></label>
      <select id="atlas-pep-review" class="atlas-pep-field" aria-label="Nivel de lectura"><option value="ALL">Todos los niveles</option><option value="REVIEW" ${ui.review==='REVIEW'?'selected':''}>Para revisar</option><option value="CONTEXT" ${ui.review==='CONTEXT'?'selected':''}>Contexto</option></select>
      <select id="atlas-pep-linkage" class="atlas-pep-field" aria-label="Tipo de vínculo"><option value="ALL">Todos los vínculos</option>${linkages.map(v=>`<option value="${esc(v)}" ${ui.linkage===v?'selected':''}>${esc(linkageLabel(v))}</option>`).join('')}</select>
      <select id="atlas-pep-signal" class="atlas-pep-field" aria-label="Señal"><option value="ALL">Todas las señales</option>${signals.map(v=>`<option value="${esc(v)}" ${ui.signal===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
    </div>`;
  }

  function linkageLabel(v){return ({BF_CALCULATED_DIRECT:'BF directo',BF_CALCULATED_INDIRECT:'BF indirecto',CONTROL_DECLARED:'Control declarado'})[v]||String(v||'Vínculo');}
  function filtered(payload){const q=ui.query.trim().toLowerCase();return arr(payload.top_cases).filter(c=>{if(ui.review!=='ALL'&&c.review_level!==ui.review)return false;if(ui.linkage!=='ALL'&&c.linkage_strength!==ui.linkage)return false;const sig=[...arr(c.relationship_signals),...arr(c.review_signals)];if(ui.signal!=='ALL'&&!sig.includes(ui.signal))return false;if(!q)return true;return [c.person_name,c.company_name,c.company_rut,c.position,c.institution,...sig].some(v=>String(v||'').toLowerCase().includes(q));});}

  function caseRows(payload){const rows=filtered(payload);if(!rows.length)return '<div class="atlas-pep-empty"><div class="ico">⌕</div><h3>Sin coincidencias para estos filtros</h3><p>Ajusta búsqueda o filtros. La ausencia en esta vista no equivale a ausencia de contratación pública fuera de los períodos cargados.</p></div>';
    return `<div class="atlas-pep-results">${rows.map((c,i)=>{const rel=arr(c.relationship_signals),rev=arr(c.review_signals);return `<article class="atlas-pep-case" tabindex="0" role="button" data-pep-case="${i}" data-case-key="${esc(c.case_key||'')}"><div class="atlas-pep-case-main"><div class="atlas-pep-case-top"><strong>${esc(c.company_name||c.company_rut||'Entidad')}</strong><span class="atlas-pep-pill ${c.review_level==='REVIEW'?'review':''}">${esc(c.review_level==='REVIEW'?'Revisar':'Contexto')}</span></div><p>${esc(c.person_name||'Persona')} · ${esc(c.position||'cargo no informado')} · ${esc(c.company_rut||'')}</p><div class="atlas-pep-tags"><span class="atlas-pep-tag rel">${esc(linkageLabel(c.linkage_strength))}${c.beneficial_owner_pct!=null?' · '+esc(pct(c.beneficial_owner_pct)):''}</span>${rel.map(s=>`<span class="atlas-pep-tag rel">${esc(s)}</span>`).join('')}${rev.map(s=>`<span class="atlas-pep-tag rev">${esc(s)}</span>`).join('')}</div></div><div class="atlas-pep-metric"><span>Compras</span><b>${fmt(c.order_count)} OC · ${esc(clp(c.amount_total_clp))}</b></div><div class="atlas-pep-metric"><span>Concentración</span><b>HHI ${fmt(c.buyer_amount_hhi,2)} · top ${pct(num(c.top_buyer_amount_share)*100)}</b></div><div class="atlas-pep-chevron">›</div></article>`;}).join('')}</div>`;
  }

  function render(payload){
    const host=document.querySelector('#content');if(!host)return;
    const failed=failedPeriods(payload).length;
    host.innerHTML=`<section class="atlas-pep" data-atlas-pep-root="1">
      <div class="atlas-pep-hero"><div class="atlas-pep-hero-row"><div><div class="atlas-pep-kicker">Análisis · Personas, propiedad y Estado</div><h2>Descubrimiento PEP y beneficiario final</h2><p>Relaciona cargos PEP resueltos, propiedad económica, control declarado y compras públicas. Prioriza revisión humana sin convertir la condición PEP en score AML.</p></div><div class="atlas-pep-status"><span class="atlas-pep-pill ${statusClass(payload)}">${esc(statusText(payload))}</span>${failed?`<span class="atlas-pep-pill review">${fmt(failed)} período${failed===1?'':'s'} con incidencia</span>`:''}<span class="atlas-pep-pill">${esc(generated(payload))}</span></div></div>${flow(payload)}</div>
      ${kpis(payload)}
      <div class="atlas-pep-grid"><article class="atlas-pep-panel"><div class="atlas-pep-panel-head"><div><h3>Estructura de los vínculos visibles</h3><p>BF económico directo/indirecto y control declarado se muestran separados.</p></div></div>${mix(payload)}</article><article class="atlas-pep-panel"><div class="atlas-pep-panel-head"><div><h3>Cobertura temporal ChileCompra</h3><p>Un período no cargado nunca se interpreta como cero contratación.</p></div></div>${periods(payload)}</article></div>
      <article class="atlas-pep-panel"><div class="atlas-pep-panel-head"><div><h3>Materialidad de los casos visibles</h3><p>Monto de órdenes de compra comprometidas; no representa pago efectivo.</p></div></div>${topBars(payload)}</article>
      ${filters(arr(payload.top_cases))}
      <div id="atlas-pep-case-results">${caseRows(payload)}</div>
      <div class="atlas-pep-note"><strong>Regla de lectura.</strong> PEP-01, PEP-02 y PEP-05 describen relación o contexto y no elevan por sí mismas el nivel de revisión. Sólo PEP-03/PEP-04 llevan un caso a <em>Revisar</em>. El orden mostrado es triage analítico, no probabilidad de delito ni riesgo LA/FT.</div>
    </section>`;
    bind(payload);setNavActive();
  }

  function renderLoading(){const host=document.querySelector('#content');if(host)host.innerHTML='<div class="atlas-pep atlas-pep-loading">Cargando relaciones y cobertura gobernada…</div>';}
  function renderUnavailable(error){const host=document.querySelector('#content');if(!host)return;host.innerHTML=`<section class="atlas-pep"><div class="atlas-pep-empty"><div class="ico">◇</div><h3>El feed de descubrimiento aún no está disponible</h3><p>ATLAS sigue operativo. Esta vista se activa cuando el contrato <code>pep_discovery_latest.json</code> sea sincronizado. No se muestran datos de ejemplo para evitar confundir una demostración con evidencia real.</p><button type="button" id="atlas-pep-retry">Reintentar</button></div><div class="atlas-pep-note"><strong>Fuente esperada:</strong> ${esc(source())}${error?` · ${esc(error.name||'Error')}: ${esc(error.message||String(error))}`:''}</div></section>`;document.querySelector('#atlas-pep-retry')?.addEventListener('click',()=>open(true));setNavActive();}

  function bind(payload){
    const results=()=>{const host=document.querySelector('#atlas-pep-case-results');if(host)host.innerHTML=caseRows(payload);bindCases(payload);};
    document.querySelector('#atlas-pep-query')?.addEventListener('input',event=>{ui.query=event.target.value;clearTimeout(event.target._pepTimer);event.target._pepTimer=setTimeout(results,120);});
    document.querySelector('#atlas-pep-review')?.addEventListener('change',event=>{ui.review=event.target.value;results();});
    document.querySelector('#atlas-pep-linkage')?.addEventListener('change',event=>{ui.linkage=event.target.value;results();});
    document.querySelector('#atlas-pep-signal')?.addEventListener('change',event=>{ui.signal=event.target.value;results();});
    bindCases(payload);
  }
  function bindCases(payload){document.querySelectorAll('[data-pep-case]').forEach(card=>{const activate=()=>{const key=card.dataset.caseKey;const item=arr(payload.top_cases).find(x=>String(x.case_key||'')===key);if(item)openDrawer(item);};card.addEventListener('click',activate);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});});}

  function pathHtml(paths){const path=arr(paths)[0];const nodes=arr(path?.node_path);if(!nodes.length)return '<div class="atlas-pep-method">No hay camino económico serializado en este corte. La clasificación BF sólo se muestra cuando el motor conserva la evidencia de propiedad necesaria.</div>';return `<div class="atlas-pep-path">${nodes.map((n,i)=>`${i?'<span class="atlas-pep-arrow">→</span>':''}<span class="atlas-pep-node" title="${esc(n)}">${esc(n)}</span>`).join('')}</div>`;}
  function openDrawer(c){
    const rel=arr(c.relationship_signals),rev=arr(c.review_signals);const html=`<div class="atlas-pep atlas-pep-drawer"><div><div class="atlas-pep-kicker">Relación trazable</div><h2>${esc(c.company_name||c.company_rut||'Entidad')}</h2><div class="atlas-pep-drawer-sub">${esc(c.company_rut||'')} · ${esc(c.person_name||'Persona')} · ${esc(c.position||'cargo no informado')} · ${esc(c.institution||'institución no informada')}</div></div><div class="atlas-pep-tags"><span class="atlas-pep-tag rel">${esc(linkageLabel(c.linkage_strength))}</span>${rel.map(s=>`<span class="atlas-pep-tag rel">${esc(s)}</span>`).join('')}${rev.map(s=>`<span class="atlas-pep-tag rev">${esc(s)}</span>`).join('')}</div><div class="atlas-pep-drawer-kpis"><div class="atlas-pep-drawer-kpi"><span>Beneficio económico</span><b>${c.beneficial_owner_pct==null?'No calculado':esc(pct(c.beneficial_owner_pct))}</b></div><div class="atlas-pep-drawer-kpi"><span>Nivel de lectura</span><b>${esc(c.review_level==='REVIEW'?'Revisar':'Contexto')}</b></div><div class="atlas-pep-drawer-kpi"><span>Órdenes</span><b>${fmt(c.order_count)} · ${esc(clp(c.amount_total_clp))}</b></div><div class="atlas-pep-drawer-kpi"><span>Compradores</span><b>${fmt(c.distinct_buyers)} · HHI ${fmt(c.buyer_amount_hhi,2)}</b></div></div><div><div class="atlas-pep-kicker">Camino de propiedad</div>${pathHtml(c.beneficial_owner_paths)}</div><div class="atlas-pep-method"><strong>Cómo leer este caso.</strong><br>${esc(c.guardrail||'La relación PEP/BF es contexto de debida diligencia y no una conclusión de irregularidad.')}<br><br><strong>Prioridad de compras:</strong> ${fmt(c.procurement_priority_score,1)} / 100 — índice de triage, no score AML.</div></div>`;
    if(typeof window.v019OpenDrawer==='function')window.v019OpenDrawer(html);else{const body=document.querySelector('#v019-drawer-body'),drawer=document.querySelector('#v019-drawer');if(body&&drawer){body.innerHTML=html;drawer.classList.add('open');}}
  }

  async function open(force=false){
    if(window.state)window.state.view=VIEW;setNavActive();renderLoading();
    try{render(await load(force));}catch(error){renderUnavailable(error);}
  }

  function installHooks(){
    if(typeof window.shell==='function'&&window.shell!==hookedShell&&!window.shell.__atlasPepWrapped){const base=window.shell;const wrapped=function(...args){const result=base.apply(this,args);queueMicrotask(ensureNav);return result;};wrapped.__atlasPepWrapped=true;wrapped.__atlasPepBase=base;window.shell=wrapped;hookedShell=wrapped;}
    if(typeof window.navigate==='function'&&window.navigate!==hookedNavigate&&!window.navigate.__atlasPepWrapped){const base=window.navigate;const wrapped=async function(view,...rest){if(view===VIEW)return open(false);const result=await base.call(this,view,...rest);queueMicrotask(()=>{ensureNav();setNavActive();});return result;};wrapped.__atlasPepWrapped=true;wrapped.__atlasPepBase=base;window.navigate=wrapped;hookedNavigate=wrapped;}
    ensureNav();
  }
  function watch(){if(observer)return;observer=new MutationObserver(()=>{installHooks();if(isActive()&&!document.querySelector('[data-atlas-pep-root]')&&!document.querySelector('.atlas-pep-loading'))open(false);});observer.observe(document.body,{childList:true,subtree:true});}
  function boot(){installHooks();watch();window.addEventListener('atlas:nav-refresh',()=>queueMicrotask(ensureNav));window.addEventListener('atlas:themechange',()=>{if(isActive()&&cache.payload)render(cache.payload);});}

  window.AtlasPepDiscovery={view:VIEW,source,load,open,refresh:()=>open(true),health:()=>({status:cache.payload?'ready':cache.error?'degraded':'idle',source:source(),loadedAt:cache.loadedAt||null,error:cache.error?String(cache.error.message||cache.error):null,storagePolicy:'MEMORY_ONLY'})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
