'use strict';

/* ATLAS AML · Entidades entry integration patch 0391
 * Production Entity 360 landing. Identity-first, governed, fail-soft and light on DB.
 */
const V0391_ENTITY_ENTRY='0391';
const V0391_BASE_OPEN_ENTITY=typeof window.openEntity==='function'?window.openEntity:null;

function v0391Esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function v0391Fmt(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL'):'—';}
function v0391Clean(v){return String(v??'').trim().replace(/[%_]/g,'').slice(0,120);}
function v0391Content(){return document.querySelector('#content');}
function v0391Open(entityId){
  if(typeof v0203OpenEntity==='function')return v0203OpenEntity(entityId);
  if(V0391_BASE_OPEN_ENTITY)return V0391_BASE_OPEN_ENTITY(entityId);
}
function v0391Card(r){
  const place=[r.commune,r.region].filter(Boolean).join(' · ')||'Territorio no materializado';
  return `<button type="button" class="v0391-entity-card" data-v0391-entity="${v0391Esc(r.entity_id)}"><div><h4>${v0391Esc(r.name||r.entity_id)}</h4><p>${v0391Esc(r.rut||'RUT no materializado')} · ${v0391Esc(place)}</p><div class="meta"><span>${v0391Esc(r.entity_type||'Entidad')}</span>${r.is_uaf_observed?'<span class="uaf">UAF observado</span>':''}${r.is_sanctioned?'<span class="san">Con sanciones</span>':''}</div></div><div class="sources"><b>${v0391Fmt(r.source_count)}</b><span>fuentes</span></div></button>`;
}
function v0391BindCards(root=document){root.querySelectorAll('[data-v0391-entity]').forEach(btn=>btn.addEventListener('click',()=>v0391Open(btn.dataset.v0391Entity)));}

async function v0391PlannedCount(applyFilter){
  let q=sb.from('aml_entities').select('entity_id',{count:'planned',head:true});
  if(applyFilter)q=applyFilter(q);
  const {count,error}=await q;
  if(error)throw error;
  return Number.isFinite(Number(count))?Number(count):null;
}

async function v0391LoadLandingStats(){
  const host=document.querySelector('#v0391-summary');
  const top=document.querySelector('#v0391-featured');
  if(!host||typeof sb==='undefined')return;
  try{
    /* Landing metrics are orientation only, so planned counts are intentional.
       Exact counts belong in dedicated analytical views, not in route bootstrap. */
    const topRes=await sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned').order('source_count',{ascending:false}).limit(12);
    if(topRes.error)throw topRes.error;
    const counts=[];
    for(const filter of [null,q=>q.eq('is_uaf_observed',true),q=>q.eq('is_sanctioned',true),q=>q.gte('source_count',3)]){
      try{counts.push(await v0391PlannedCount(filter));}catch(_error){counts.push(null);}
    }
    const [entities,uaf,san,multi]=counts;
    host.innerHTML=`<div><span>Entidades Fusion</span><b>${v0391Fmt(entities)}</b><small>estimación de cobertura visible bajo RLS</small></div><div><span>UAF observado</span><b>${v0391Fmt(uaf)}</b><small>estimación sobre presencia materializada en Radar UAF</small></div><div><span>Con sanciones</span><b>${v0391Fmt(san)}</b><small>estimación de identidades con eventos administrativos</small></div><div><span>3+ fuentes</span><b>${v0391Fmt(multi)}</b><small>cobertura estimada; no equivale a riesgo</small></div>`;
    const rows=topRes.data||[];
    top.innerHTML=rows.length?`<div class="v0391-entity-grid">${rows.map(v0391Card).join('')}</div>`:'<div class="v0391-results-state"><b>Sin entidades destacadas</b>No se recibieron filas bajo la política actual.</div>';
    v0391BindCards(top);
  }catch(e){
    host.innerHTML='<div><span>Cobertura</span><b>—</b><small>Indicadores temporariamente no disponibles.</small></div>';
    if(top)top.innerHTML=`<div class="v0391-results-state"><b>No fue posible cargar accesos rápidos</b>${v0391Esc(e?.message||'Error de consulta')}</div>`;
  }
}

async function v0391SearchEntities(ev){
  ev?.preventDefault?.();
  const input=document.querySelector('#entity-q'),box=document.querySelector('#entity-results');
  if(!input||!box)return;
  const q=v0391Clean(input.value);
  if(q.length<2){box.innerHTML='<div class="v0391-results-state"><b>Consulta demasiado corta</b>Ingresa al menos 2 caracteres.</div>';return;}
  box.innerHTML='<div class="v0391-loading">Buscando y resolviendo identidad…</div>';
  try{
    if(typeof sha256==='function'&&typeof audit==='function'){
      const hash=await sha256(q.toLocaleLowerCase('es-CL'));
      await audit('SEARCH',{objectType:'entity',queryHash:hash,queryLength:q.length,payload:{mode:'entity_360_v0391'}}).catch(()=>{});
    }
    let query=sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,snapshot_id,updated_at');
    if(/^ENT-/i.test(q))query=query.eq('entity_id',q.toUpperCase());
    else if(/^[0-9kK.\-\s]+$/.test(q))query=query.ilike('rut',`%${q.replace(/[.\s]/g,'')}%`);
    else query=query.ilike('name',`%${q}%`);
    const {data,error}=await query.order('source_count',{ascending:false}).limit(50);
    if(error)throw error;
    const rows=data||[];
    box.innerHTML=rows.length?`<div class="v0391-result-count">${v0391Fmt(rows.length)} coincidencia(s) · abre una entidad para cargar su expediente analítico completo</div><div class="v0391-entity-grid">${rows.map(v0391Card).join('')}</div>`:'<div class="v0391-results-state"><b>Sin coincidencias</b>Prueba con una razón social más corta, RUT sin puntos o Entity ID.</div>';
    v0391BindCards(box);
  }catch(e){box.innerHTML=`<div class="v0391-results-state"><b>No fue posible ejecutar la búsqueda</b>${v0391Esc(e?.message||e)}</div>`;}
}

async function v0391LoadEntities(){
  state.view='entities';
  shell('Entidades','Exploración de identidad, situación tributaria, UAF, gasto público, sanciones/CGR, red y evidencia en una ficha única.');
  const c=v0391Content();if(!c)return;
  c.innerHTML=`<div class="v0391-entities"><section class="v0391-entry-hero"><div><span class="eyebrow">ENTITY 360 · ACCESO ANALÍTICO</span><h2>Caracteriza una entidad antes de interpretar sus señales</h2><p>La entrada prioriza identidad canónica y cobertura. Al abrir un resultado, ATLAS integra SII, UAF cuando corresponda, gasto del Estado, sanciones, CGR, relaciones y evidencia sin convertir contexto en riesgo.</p></div><div class="v0391-entry-lenses"><span><b>Identidad</b>RUT y Entity ID primero</span><span><b>Tributación</b>vigencia, escala y actividad</span><span><b>UAF</b>condición y conciliación</span><span><b>Estado</b>flujos y compradores públicos</span><span><b>Integridad</b>sanciones y CGR</span><span><b>Evidencia</b>red, tiempo y corroboración</span></div></section><section class="v0391-searchbox"><form id="entity-search"><input id="entity-q" autocomplete="off" placeholder="Busca por razón social, RUT o Entity ID…"><button type="submit">Explorar entidad</button></form><div class="v0391-search-help"><span>La consulta usa Supabase bajo RLS y se audita sin almacenar el texto plano.</span><span>máx. 50 resultados</span></div></section><div class="v0391-summary" id="v0391-summary"><div><span>Entidades Fusion</span><b>…</b><small>cargando cobertura</small></div><div><span>UAF observado</span><b>…</b><small>cargando cobertura</small></div><div><span>Con sanciones</span><b>…</b><small>cargando cobertura</small></div><div><span>3+ fuentes</span><b>…</b><small>cargando cobertura</small></div></div><section class="v0391-section"><div class="v0391-section-head"><div><span>EXPLORACIÓN RÁPIDA</span><h3>Entidades con mayor cobertura observable</h3><p>Sirven como accesos de análisis. El número de fuentes no es un score de riesgo.</p></div><em>clic → Entity 360</em></div><div id="v0391-featured"><div class="v0391-loading">Cargando entidades…</div></div></section><section class="v0391-section"><div class="v0391-section-head"><div><span>RESULTADOS</span><h3>Búsqueda de entidad</h3><p>Los resultados conservan condición UAF, sanciones y cobertura antes de abrir la ficha completa.</p></div></div><div id="entity-results" class="v0391-results-state"><b>Busca una entidad</b>Al seleccionar un resultado se abrirá la nueva ficha Entity 360 integrada.</div></section><section class="v0391-section"><div class="v0391-method"><div><b>Identidad ≠ similitud</b><p>Los cruces sensibles usan Entity ID/RUT gobernado; no se fuerza una unión por nombre.</p></div><div><b>Ausencia ≠ cero</b><p>Una fuente sin match se declara como cobertura faltante, no como hecho negativo.</p></div><div><b>Prioridad ≠ probabilidad</b><p>IPA, convergencia y marcas ordenan revisión; no acreditan LA/FT ni delito.</p></div></div></section></div>`;
  document.querySelector('#entity-search')?.addEventListener('submit',v0391SearchEntities);
  v0391LoadLandingStats();
}

/* Force the new Entity 360 renderer back onto the active global function after
 * all historical classic layers have loaded. */
if(typeof v0203RenderEntity==='function'&&typeof v038Render==='function'){
  v0203RenderEntity=function(pkg){
    V038.spend=null;V038.recon=null;V038.hydrating=true;
    v038Render(pkg,false);
    v038Hydrate(pkg).catch(()=>{V038.hydrating=false;if(V038.entityId===pkg?.e?.entity_id)v038Render(pkg,true);});
  };
  window.v0203RenderEntity=v0203RenderEntity;
}

loadEntities=v0391LoadEntities;
searchEntities=v0391SearchEntities;
window.loadEntities=v0391LoadEntities;
window.searchEntities=v0391SearchEntities;
window.openEntity=async function(entityId){return v0391Open(entityId);};
window.__ATLAS_ENTITY_ENTRY__={version:V0391_ENTITY_ENTRY,load:v0391LoadEntities,search:v0391SearchEntities,open:v0391Open,authority:'ENTITY360_EXPERT_CURRENT',countPolicy:'PLANNED_LANDING_EXACT_ON_DEMAND_ONLY'};
