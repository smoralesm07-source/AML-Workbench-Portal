(function(){
'use strict';

const VIEW='pep-discovery';
const TABLE='aml_pep_discovery_snapshot';
const SCHEMA='ATLAS_PEP_DISCOVERY_LATEST_V1';
const cache={payload:null,loadedAt:0,error:null,promise:null,transport:null};
const ui={query:'',review:'ALL',linkage:'ALL',signal:'ALL'};
let hookedShell=null,hookedNavigate=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const fmt=(v,d=0)=>num(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{maximumFractionDigits:1})+'%':'—';
const clp=v=>{const n=num(v);if(!n)return'$0';if(Math.abs(n)>=1e9)return'$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil MM';if(Math.abs(n)>=1e6)return'$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' MM';return'$'+Math.round(n).toLocaleString('es-CL');};
const currentView=()=>window.state?.view||null;
const isActive=()=>currentView()===VIEW;
const dbClient=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};

function casesBlock(p){return obj(p.cases);}
function topCases(p){return arr(casesBlock(p).top);}
function coverage(p){return obj(p.coverage);}
function pep(p){return obj(p.pep);}
function bf(p){return obj(p.beneficial_ownership);}
function caseCount(p,key){return num(casesBlock(p)[key]);}
function pepCount(p){return num(pep(p).active_or_recent_confirmed);}
function bfCount(p,key){return num(bf(p)[key]);}
function generated(p){if(!p.generated_at)return'corte no informado';try{return new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(p.generated_at));}catch{return String(p.generated_at);}}
function statusLabel(p){const s=String(p.status||'');return s==='COMPLETE'?'Cobertura completa':s==='PARTIAL'?'Cobertura parcial':'Sin período de compras cargado';}
function statusClass(p){return String(p.status||'')==='COMPLETE'?'complete':'partial';}
function linkageLabel(v){return({BF_CALCULATED_DIRECT:'BF directo',BF_CALCULATED_INDIRECT:'BF indirecto',CONTROL_DECLARED:'Control declarado'})[v]||String(v||'Vínculo');}

function validate(p){
  if(!p||p.schema!==SCHEMA)throw new Error('Contrato PEP no reconocido');
  for(const key of ['generated_at','status','coverage','pep','beneficial_ownership','cases','lineage','guardrails'])if(!(key in p))throw new Error('Contrato PEP incompleto: '+key);
  const c=casesBlock(p);
  if(!Array.isArray(c.top))throw new Error('Contrato PEP inválido: cases.top');
  if(!['COMPLETE','PARTIAL','NO_PROCUREMENT_PERIOD_LOADED'].includes(String(p.status)))throw new Error('Estado de cobertura no reconocido');
  return p;
}

function navIcon(){return'<span class="atlas-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="2.4"/><circle cx="17" cy="7" r="2.4"/><circle cx="12" cy="17" r="2.4"/><path d="M9.2 7h5.6M8.4 9l2.4 5.7M15.6 9l-2.4 5.7"/></svg></span>';}
function ensureNav(){
  const nav=document.querySelector('.v019-nav');if(!nav)return false;
  let button=nav.querySelector('[data-atlas-pep-view="1"]');
  if(!button){
    button=document.createElement('button');button.type='button';button.className='v019-nav-btn atlas-nav-btn atlas-pep-nav-button';button.dataset.atlasPepView='1';button.setAttribute('aria-label','Personas y control');button.innerHTML=navIcon()+'<span class="atlas-nav-text">Personas y control</span><span class="atlas-nav-chevron" aria-hidden="true">›</span>';button.addEventListener('click',()=>window.navigate?.(VIEW));
  }
  const anchor=nav.querySelector('.v019-nav-btn[data-view="questions"]');
  if(anchor&&anchor.nextElementSibling!==button)anchor.insertAdjacentElement('afterend',button);else if(!button.isConnected)nav.appendChild(button);
  button.classList.toggle('active',isActive());button.setAttribute('aria-current',isActive()?'page':'false');return true;
}
function setNavActive(){document.querySelectorAll('.v019-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.atlasPepView==='1'?isActive():b.dataset.view===currentView()));ensureNav();}

async function loadFromDb(){
  const db=dbClient();if(!db)throw new Error('Sesión de datos ATLAS no disponible');
  const {data,error}=await db.from(TABLE).select('payload,source_generated_at,coverage_status,ingested_at').eq('snapshot_key','latest').maybeSingle();
  if(error)throw error;if(!data?.payload)throw new Error('El snapshot PEP todavía no ha sido materializado');cache.transport='SUPABASE_RLS';return validate(data.payload);
}
async function loadFromConfiguredEndpoint(){
  const url=window.ATLAS_PEP_DISCOVERY_SOURCE;if(!url)throw new Error('Sin endpoint alternativo configurado');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
  try{const r=await fetch(String(url),{cache:'no-store',credentials:'same-origin',signal:ctl.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);cache.transport='CONFIGURED_ENDPOINT';return validate(await r.json());}finally{clearTimeout(timer);}
}
async function load(force=false){
  if(cache.payload&&!force)return cache.payload;if(cache.promise&&!force)return cache.promise;
  cache.promise=(async()=>{try{let p;try{p=await loadFromDb();}catch(dbError){if(!window.ATLAS_PEP_DISCOVERY_SOURCE)throw dbError;p=await loadFromConfiguredEndpoint();}cache.payload=p;cache.loadedAt=Date.now();cache.error=null;return p;}catch(e){cache.error=e;throw e;}finally{cache.promise=null;}})();return cache.promise;
}

function flow(p){return`<div class="atlas-pep-flow" aria-label="Cadena analítica PEP, propiedad y compras">
  <div class="atlas-pep-flow-step"><small>1 · Resolver PEP</small><b>${fmt(pepCount(p))}</b><span>PEP vigentes o recientes confirmadas</span></div>
  <div class="atlas-pep-flow-step"><small>2 · Propiedad</small><b>${fmt(bfCount(p,'downstream_target_count'))}</b><span>sociedades downstream objetivo</span></div>
  <div class="atlas-pep-flow-step"><small>3 · Compras</small><b>${fmt(bfCount(p,'targets_requested'))}</b><span>RUT objetivo evaluados en BF/compras</span></div>
  <div class="atlas-pep-flow-step"><small>4 · Lectura</small><b>${fmt(caseCount(p,'total'))}</b><span>relaciones consolidadas</span></div>
</div>`;}

function kpis(p){const c=coverage(p);return`<div class="atlas-pep-kpis">
  <article class="atlas-pep-kpi"><span class="lab">PEP confirmadas</span><b>${fmt(pepCount(p))}</b><small>vigentes o dentro de ventana mínima</small></article>
  <article class="atlas-pep-kpi"><span class="lab">BF downstream</span><b>${fmt(bfCount(p,'downstream_target_count'))}</b><small>universo de sociedades objetivo</small></article>
  <article class="atlas-pep-kpi"><span class="lab">Proveedor + BF PEP</span><b>${fmt(bfCount(p,'targets_with_pep_bf'))}</b><small>contexto, no señal adversa</small></article>
  <article class="atlas-pep-kpi"><span class="lab">Casos contexto</span><b>${fmt(caseCount(p,'context'))}</b><small>relación sin señal de revisión</small></article>
  <article class="atlas-pep-kpi hot"><span class="lab">Para revisar</span><b>${fmt(caseCount(p,'review'))}</b><small>sólo PEP-03 / PEP-04</small></article>
  <article class="atlas-pep-kpi"><span class="lab">Órdenes cargadas</span><b>${fmt(c.orders_loaded)}</b><small>${fmt(c.orders_matched)} órdenes coincidentes</small></article>
</div>`;}

function mix(p){
  const rows=topCases(p),direct=rows.filter(x=>x.linkage_strength==='BF_CALCULATED_DIRECT').length,indirect=rows.filter(x=>x.linkage_strength==='BF_CALCULATED_INDIRECT').length,control=rows.filter(x=>x.linkage_strength==='CONTROL_DECLARED').length,total=Math.max(1,direct+indirect+control),d1=(direct/total*100).toFixed(2)+'%',d2=((direct+indirect)/total*100).toFixed(2)+'%';
  return`<div class="atlas-pep-donut-wrap"><div class="atlas-pep-donut" style="--d1:${d1};--d2:${d2}"><div class="atlas-pep-donut-center"><b>${fmt(rows.length)}</b><span>casos top</span></div></div><div class="atlas-pep-legend">
    <div class="atlas-pep-legend-row"><i style="--c:var(--pep-accent)"></i><span>BF directo visible</span><b>${fmt(direct)}</b></div>
    <div class="atlas-pep-legend-row"><i style="--c:#7e77cf"></i><span>BF indirecto visible</span><b>${fmt(indirect)}</b></div>
    <div class="atlas-pep-legend-row"><i style="--c:var(--pep-muted)"></i><span>Control declarado visible</span><b>${fmt(control)}</b></div>
  </div></div>`;
}

function coveragePanel(p){
  const c=coverage(p),requested=num(c.requested_periods),downloaded=num(c.downloaded_periods),failed=arr(c.failed_periods),ratio=requested?Math.min(100,downloaded/requested*100):0;
  return`<div class="atlas-pep-bars">
    <div class="atlas-pep-bar"><span class="atlas-pep-bar-label">Períodos cargados</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:${ratio.toFixed(1)}%"></div></div><span class="atlas-pep-bar-value">${fmt(downloaded)} / ${fmt(requested)}</span></div>
    <div class="atlas-pep-bar"><span class="atlas-pep-bar-label">RUT empresa confirmados</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:${Math.min(100,num(c.confirmed_company_ruts)?100:0)}%"></div></div><span class="atlas-pep-bar-value">${fmt(c.confirmed_company_ruts)}</span></div>
    <div class="atlas-pep-bar"><span class="atlas-pep-bar-label">RUT proveedor cargados</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:${Math.min(100,num(c.provider_ruts_loaded)?100:0)}%"></div></div><span class="atlas-pep-bar-value">${fmt(c.provider_ruts_loaded)}</span></div>
    ${failed.length?`<div class="atlas-pep-note"><strong>Incidencias de cobertura:</strong> ${failed.map(x=>`${esc(x.year)}-${String(x.month??'').padStart(2,'0')}${x.error?' · '+esc(x.error):''}`).join(' · ')}</div>`:'<div class="atlas-pep-note"><strong>Cobertura:</strong> el contrato no reporta períodos fallidos en este corte.</div>'}
  </div>`;
}

function topBars(p){const rows=topCases(p).slice(0,7);if(!rows.length)return'<div class="atlas-pep-note">Sin casos visibles en el corte actual.</div>';const max=Math.max(...rows.map(x=>num(x.amount_total_clp)),1);return`<div class="atlas-pep-bars">${rows.map(c=>`<div class="atlas-pep-bar"><span class="atlas-pep-bar-label" title="${esc(c.company_name||c.company_rut)}">${esc(c.company_name||c.company_rut||'Entidad')}</span><div class="atlas-pep-track"><div class="atlas-pep-fill" style="--w:${Math.max(2,num(c.amount_total_clp)/max*100).toFixed(1)}%"></div></div><span class="atlas-pep-bar-value">${esc(clp(c.amount_total_clp))}</span></div>`).join('')}</div>`;}

function filters(rows){const links=[...new Set(rows.map(x=>x.linkage_strength).filter(Boolean))],signals=[...new Set(rows.flatMap(x=>[...arr(x.relationship_signals),...arr(x.review_signals)]))].sort();return`<div class="atlas-pep-toolbar" aria-label="Filtros de descubrimiento">
  <label class="atlas-pep-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg><input id="atlas-pep-query" class="atlas-pep-field" type="search" value="${esc(ui.query)}" placeholder="Persona, empresa, RUT o institución" aria-label="Buscar relaciones"></label>
  <select id="atlas-pep-review" class="atlas-pep-field"><option value="ALL">Todos los niveles</option><option value="REVIEW" ${ui.review==='REVIEW'?'selected':''}>Para revisar</option><option value="CONTEXT" ${ui.review==='CONTEXT'?'selected':''}>Contexto</option></select>
  <select id="atlas-pep-linkage" class="atlas-pep-field"><option value="ALL">Todos los vínculos</option>${links.map(v=>`<option value="${esc(v)}" ${ui.linkage===v?'selected':''}>${esc(linkageLabel(v))}</option>`).join('')}</select>
  <select id="atlas-pep-signal" class="atlas-pep-field"><option value="ALL">Todas las señales</option>${signals.map(v=>`<option value="${esc(v)}" ${ui.signal===v?'selected':''}>${esc(v)}</option>`).join('')}</select>
</div>`;}
function filtered(p){const q=ui.query.trim().toLowerCase();return topCases(p).filter(c=>{if(ui.review!=='ALL'&&c.review_level!==ui.review)return false;if(ui.linkage!=='ALL'&&c.linkage_strength!==ui.linkage)return false;const signals=[...arr(c.relationship_signals),...arr(c.review_signals)];if(ui.signal!=='ALL'&&!signals.includes(ui.signal))return false;return!q||[c.person_name,c.company_name,c.company_rut,c.position,c.institution,...signals].some(v=>String(v||'').toLowerCase().includes(q));});}
function caseRows(p){const rows=filtered(p);if(!rows.length)return'<div class="atlas-pep-empty"><div class="ico">⌕</div><h3>Sin coincidencias para estos filtros</h3><p>La ausencia en esta lista top no equivale a ausencia de contratación pública ni de relaciones fuera del corte materializado.</p></div>';return`<div class="atlas-pep-results">${rows.map(c=>`<article class="atlas-pep-case" tabindex="0" role="button" data-case-key="${esc(c.case_key||'')}"><div class="atlas-pep-case-main"><div class="atlas-pep-case-top"><strong>${esc(c.company_name||c.company_rut||'Entidad')}</strong><span class="atlas-pep-pill ${c.review_level==='REVIEW'?'review':''}">${c.review_level==='REVIEW'?'Revisar':'Contexto'}</span></div><p>${esc(c.person_name||'Persona')} · ${esc(c.position||'cargo no informado')} · ${esc(c.company_rut||'')}</p><div class="atlas-pep-tags"><span class="atlas-pep-tag rel">${esc(linkageLabel(c.linkage_strength))}${c.beneficial_owner_pct!=null?' · '+esc(pct(c.beneficial_owner_pct)):''}</span>${arr(c.relationship_signals).map(s=>`<span class="atlas-pep-tag rel">${esc(s)}</span>`).join('')}${arr(c.review_signals).map(s=>`<span class="atlas-pep-tag rev">${esc(s)}</span>`).join('')}</div></div><div class="atlas-pep-metric"><span>Compras</span><b>${fmt(c.order_count)} OC · ${esc(clp(c.amount_total_clp))}</b></div><div class="atlas-pep-metric"><span>Concentración</span><b>HHI ${fmt(c.buyer_amount_hhi,2)} · top ${pct(num(c.top_buyer_amount_share)*100)}</b></div><div class="atlas-pep-chevron">›</div></article>`).join('')}</div>`;}

function pathHtml(paths){const nodes=arr(arr(paths)[0]?.node_path);if(!nodes.length)return'<div class="atlas-pep-method">El contrato no serializa un camino económico visible para este caso.</div>';return`<div class="atlas-pep-path">${nodes.map((n,i)=>`${i?'<span class="atlas-pep-arrow">→</span>':''}<span class="atlas-pep-node" title="${esc(n)}">${esc(n)}</span>`).join('')}</div>`;}
function openDrawer(c){const html=`<div class="atlas-pep atlas-pep-drawer"><div><div class="atlas-pep-kicker">Relación trazable</div><h2>${esc(c.company_name||c.company_rut||'Entidad')}</h2><div class="atlas-pep-drawer-sub">${esc(c.company_rut||'')} · ${esc(c.person_name||'Persona')} · ${esc(c.position||'cargo no informado')} · ${esc(c.institution||'institución no informada')}</div></div><div class="atlas-pep-tags"><span class="atlas-pep-tag rel">${esc(linkageLabel(c.linkage_strength))}</span>${arr(c.relationship_signals).map(s=>`<span class="atlas-pep-tag rel">${esc(s)}</span>`).join('')}${arr(c.review_signals).map(s=>`<span class="atlas-pep-tag rev">${esc(s)}</span>`).join('')}</div><div class="atlas-pep-drawer-kpis"><div class="atlas-pep-drawer-kpi"><span>Beneficio económico</span><b>${c.beneficial_owner_pct==null?'No calculado':esc(pct(c.beneficial_owner_pct))}</b></div><div class="atlas-pep-drawer-kpi"><span>Nivel de lectura</span><b>${c.review_level==='REVIEW'?'Revisar':'Contexto'}</b></div><div class="atlas-pep-drawer-kpi"><span>Órdenes</span><b>${fmt(c.order_count)} · ${esc(clp(c.amount_total_clp))}</b></div><div class="atlas-pep-drawer-kpi"><span>Compradores</span><b>${fmt(c.distinct_buyers)} · HHI ${fmt(c.buyer_amount_hhi,2)}</b></div></div><div><div class="atlas-pep-kicker">Camino de propiedad</div>${pathHtml(c.beneficial_owner_paths)}</div><div class="atlas-pep-method"><strong>Cómo leer este caso.</strong><br>${esc(c.guardrail||'La relación PEP/BF es contexto de debida diligencia y no una conclusión de irregularidad.')}<br><br><strong>Prioridad de compras:</strong> ${fmt(c.procurement_priority_score,1)} / 100 — triage, no score AML.</div></div>`;if(typeof window.v019OpenDrawer==='function')window.v019OpenDrawer(html);else{const body=document.querySelector('#v019-drawer-body'),drawer=document.querySelector('#v019-drawer');if(body&&drawer){body.innerHTML=html;drawer.classList.add('open');}}}
function bindCases(p){document.querySelectorAll('[data-case-key]').forEach(card=>{const go=()=>{const c=topCases(p).find(x=>String(x.case_key||'')===card.dataset.caseKey);if(c)openDrawer(c);};card.addEventListener('click',go);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});});}
function bind(p){const refresh=()=>{const host=document.querySelector('#atlas-pep-case-results');if(host)host.innerHTML=caseRows(p);bindCases(p);};document.querySelector('#atlas-pep-query')?.addEventListener('input',e=>{ui.query=e.target.value;clearTimeout(e.target._pepTimer);e.target._pepTimer=setTimeout(refresh,120);});for(const [id,key] of [['atlas-pep-review','review'],['atlas-pep-linkage','linkage'],['atlas-pep-signal','signal']])document.querySelector('#'+id)?.addEventListener('change',e=>{ui[key]=e.target.value;refresh();});bindCases(p);}

function render(p){
  const host=document.querySelector('#content');if(!host)return;const failed=arr(coverage(p).failed_periods).length;
  host.innerHTML=`<section class="atlas-pep" data-atlas-pep-root="1"><div class="atlas-pep-hero"><div class="atlas-pep-hero-row"><div><div class="atlas-pep-kicker">Análisis · Personas, propiedad y Estado</div><h2>Descubrimiento PEP y beneficiario final</h2><p>Relaciona resolución PEP, propiedad económica, control declarado y compras públicas bajo el contrato gobernado del Intelligence Fusion Layer. Prioriza revisión humana sin convertir la condición PEP en score AML.</p></div><div class="atlas-pep-status"><span class="atlas-pep-pill ${statusClass(p)}">${esc(statusLabel(p))}</span>${failed?`<span class="atlas-pep-pill review">${fmt(failed)} período${failed===1?'':'s'} con incidencia</span>`:''}<span class="atlas-pep-pill">${esc(generated(p))}</span></div></div>${flow(p)}</div>${kpis(p)}<div class="atlas-pep-grid"><article class="atlas-pep-panel"><div class="atlas-pep-panel-head"><div><h3>Estructura de los casos top visibles</h3><p>BF directo, BF indirecto y control declarado se mantienen semánticamente separados.</p></div></div>${mix(p)}</article><article class="atlas-pep-panel"><div class="atlas-pep-panel-head"><div><h3>Cobertura gobernada</h3><p>Se muestra únicamente lo informado por el contrato IFL; missing nunca se completa como cero.</p></div></div>${coveragePanel(p)}</article></div><article class="atlas-pep-panel"><div class="atlas-pep-panel-head"><div><h3>Materialidad de los casos top</h3><p>Monto de órdenes comprometidas; no representa pago efectivo.</p></div></div>${topBars(p)}</article>${filters(topCases(p))}<div id="atlas-pep-case-results">${caseRows(p)}</div><div class="atlas-pep-note"><strong>Regla de lectura.</strong> PEP-01, PEP-02 y PEP-05 describen relación/contexto. Sólo PEP-03/PEP-04 llevan un caso a <em>Revisar</em>. El ranking es triage analítico, no probabilidad de delito ni score LA/FT.</div></section>`;
  bind(p);setNavActive();
}
function renderLoading(){const host=document.querySelector('#content');if(host)host.innerHTML='<div class="atlas-pep atlas-pep-loading">Cargando contrato gobernado bajo RLS…</div>';}
function renderUnavailable(e){const host=document.querySelector('#content');if(!host)return;host.innerHTML=`<section class="atlas-pep"><div class="atlas-pep-empty"><div class="ico">◇</div><h3>El snapshot de descubrimiento aún no está disponible</h3><p>ATLAS sigue operativo. La vista se activará cuando el pipeline materialice un corte válido bajo ${SCHEMA}. No se muestran datos de ejemplo.</p><button id="atlas-pep-retry" type="button">Reintentar</button></div><div class="atlas-pep-note"><strong>Canal:</strong> Supabase/RLS · ${esc(e?.message||String(e||'sin snapshot'))}</div></section>`;document.querySelector('#atlas-pep-retry')?.addEventListener('click',()=>open(true));setNavActive();}

async function open(force=false){
  if(window.state)window.state.view=VIEW;
  try{if(typeof window.shell==='function')window.shell('Personas y control','PEP, beneficiario final y compras públicas con trazabilidad y guardrails explícitos.');}catch(_e){}
  setNavActive();renderLoading();
  try{const p=await load(force);render(p);try{window.audit?.('VIEW_PEP_DISCOVERY',{objectType:'analytical_view',objectId:VIEW,payload:{cases:caseCount(p,'total'),review:caseCount(p,'review'),coverage:String(p.status||''),transport:cache.transport}});}catch(_e){}}catch(e){renderUnavailable(e);}
}
function installHooks(){
  if(typeof window.shell==='function'&&window.shell!==hookedShell&&!window.shell.__atlasPepWrapped){const base=window.shell,wrapped=function(...args){const result=base.apply(this,args);queueMicrotask(ensureNav);return result;};wrapped.__atlasPepWrapped=true;window.shell=wrapped;hookedShell=wrapped;}
  if(typeof window.navigate==='function'&&window.navigate!==hookedNavigate&&!window.navigate.__atlasPepWrapped){const base=window.navigate,wrapped=async function(view,...rest){if(view===VIEW)return open(false);const result=await base.call(this,view,...rest);queueMicrotask(()=>{ensureNav();setNavActive();});return result;};wrapped.__atlasPepWrapped=true;window.navigate=wrapped;hookedNavigate=wrapped;}
  ensureNav();
}
function boot(){installHooks();window.addEventListener('atlas:nav-refresh',()=>queueMicrotask(ensureNav));window.addEventListener('atlas:themechange',()=>{if(isActive()&&cache.payload)render(cache.payload);});}

window.AtlasPepDiscovery={view:VIEW,table:TABLE,schema:SCHEMA,load,open,refresh:()=>open(true),ensureNav,health:()=>({status:cache.payload?'ready':cache.error?'degraded':'idle',transport:cache.transport,loadedAt:cache.loadedAt||null,error:cache.error?String(cache.error.message||cache.error):null,storagePolicy:'MEMORY_ONLY',accessPolicy:'SUPABASE_RLS_AUTHENTICATED_ENABLED_USERS',contractPolicy:'IFL_SCHEMA_EXACT_NO_INVENTED_FIELDS'})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
