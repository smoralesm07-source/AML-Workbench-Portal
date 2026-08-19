'use strict';

/* AML Workbench · Public Entity Context v1
 * Fuente viva: Radar_SII/config/public_entities_registry.csv
 * - Reconoce entidades públicas solo por entity_id/RUT materializado por Radar SII.
 * - No usa fuzzy matching en Workbench.
 * - La condición pública es contexto institucional, nunca señal adversa.
 * - Hallazgos SII puramente contextuales no ponderan la prioridad de una entidad pública.
 */

const REGISTRY_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_SII/main/config/public_entities_registry.csv';
const SUMMARY_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_SII/main/docs/data/public_entities_summary.json';
const CONTEXT_ONLY_PRODUCERS=new Set(['RADAR_UAF','RADAR_PRENSA']);
const TYPE_LABELS={
  MUNICIPALITY:'Municipalidad',
  PUBLIC_HEALTH:'Salud pública',
  OTHER_PUBLIC_ENTITY:'Otra entidad pública',
  PUBLIC_SERVICE_OR_AGENCY:'Servicio público / agencia',
  PRESIDENTIAL_DELEGATION:'Delegación presidencial',
  MINISTRY_OR_SUBSECRETARIAT:'Ministerio / subsecretaría',
  REGIONAL_GOVERNMENT:'Gobierno regional',
  STATE_HIGHER_EDUCATION:'Educación superior estatal',
  STATE_COMPANY_OR_PUBLIC_CORPORATION:'Empresa estatal / corporación pública',
  DEFENCE_OR_PUBLIC_SECURITY:'Defensa / seguridad pública',
  SUPERVISOR_OR_REGULATOR:'Supervisor / regulador'
};

const state={
  rows:[],
  summary:null,
  byEntity:new Map(),
  byRut:new Map(),
  findings:new Map(),
  loaded:false,
  error:null
};

function escHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function truthy(value){return ['1','true','si','sí','yes'].includes(String(value??'').trim().toLowerCase());}
function normalizeRut(value){
  let s=String(value??'').toUpperCase().trim().replace(/^ENT-RUT-/,'').replace(/[^0-9K]/g,'');
  if(s.length<2)return '';
  return `${s.slice(0,-1)}-${s.slice(-1)}`;
}
function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;continue;}
      if(ch==='"'){quoted=false;continue;}
      field+=ch;continue;
    }
    if(ch==='"'){quoted=true;continue;}
    if(ch===';'){row.push(field);field='';continue;}
    if(ch==='\n'){
      row.push(field.replace(/\r$/,''));field='';
      if(row.some(v=>String(v).trim()!==''))rows.push(row);
      row=[];continue;
    }
    field+=ch;
  }
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  if(!rows.length)return [];
  const header=rows.shift().map((v,i)=>String(v).replace(/^\uFEFF/,'').trim()||`col_${i}`);
  return rows.map(values=>Object.fromEntries(header.map((h,i)=>[h,values[i]??''])));
}
function mergeRecord(target,row){
  if(!target)return {...row};
  const boolCols=['is_public_entity','is_public_service_strict','chilecompra_reference_match','datos_gob_reference_match','gob_cl_reference_match','dipres_reference_match'];
  for(const key of boolCols)target[key]=truthy(target[key])||truthy(row[key])?'true':'false';
  for(const key of ['official_name','public_entity_type','source_system','source_code','sii_match_method','sii_match_confidence','source_url','gob_cl_service_url']){
    const vals=new Set(String(target[key]||'').split(' | ').filter(Boolean));
    String(row[key]||'').split(' | ').filter(Boolean).forEach(v=>vals.add(v));
    target[key]=[...vals].join(' | ');
  }
  return target;
}
function indexRows(rows){
  state.rows=rows;
  for(const row of rows){
    const entityId=String(row.entity_id||'').trim();
    const rut=normalizeRut(row.rut||entityId);
    if(entityId)state.byEntity.set(entityId,mergeRecord(state.byEntity.get(entityId),row));
    if(rut)state.byRut.set(rut,mergeRecord(state.byRut.get(rut),row));
  }
}
async function loadRegistry(force=false){
  if(state.loaded&&!force)return state;
  try{
    const [registryRes,summaryRes]=await Promise.all([
      fetch(REGISTRY_URL,{cache:'no-store'}),
      fetch(SUMMARY_URL,{cache:'no-store'})
    ]);
    if(!registryRes.ok)throw new Error(`Radar SII public registry HTTP ${registryRes.status}`);
    const text=await registryRes.text();
    state.byEntity.clear();state.byRut.clear();
    indexRows(parseCsv(text));
    state.summary=summaryRes.ok?await summaryRes.json():null;
    state.loaded=true;state.error=null;
  }catch(error){
    state.error=error;state.loaded=true;
    console.warn('[AML] Public Entity Context unavailable:',error);
  }
  return state;
}
const registryPromise=loadRegistry();

function lookup(input){
  if(!input)return null;
  const entityId=typeof input==='string'?input:String(input.entity_id||'');
  if(entityId&&state.byEntity.has(entityId))return state.byEntity.get(entityId);
  const rut=normalizeRut(typeof input==='string'?input:(input.rut||entityId));
  return rut?state.byRut.get(rut)||null:null;
}
function enrichEntity(entity){
  const rec=lookup(entity);
  if(!rec||!entity)return entity;
  entity.is_public_entity=true;
  entity.is_public_service_strict=truthy(rec.is_public_service_strict);
  entity.public_entity_type=rec.public_entity_type||'';
  entity.public_entity_name=rec.official_name||'';
  entity.public_entity_source_system=rec.source_system||'';
  entity.public_entity_source_code=rec.source_code||'';
  entity.public_entity_match_method=rec.sii_match_method||'';
  entity.public_entity_match_confidence=rec.sii_match_confidence||'';
  entity.public_entity_gob_cl=truthy(rec.gob_cl_reference_match);
  entity.analysis_population='PUBLIC_ENTITY_CONTEXT';
  entity.business_ranking_eligible=false;
  return entity;
}
function producersOf(finding){
  const raw=finding?.payload?.producer_ids;
  return Array.isArray(raw)?raw.map(String):[];
}
function isPureSiiLocalContext(finding){
  if(!finding)return false;
  const producers=producersOf(finding);
  if(!producers.includes('RADAR_SII'))return false;
  const substantive=producers.filter(p=>p!=='RADAR_SII'&&!CONTEXT_ONLY_PRODUCERS.has(p));
  if(substantive.length)return false;
  return String(finding.finding_type||'')==='CONTEXTUAL_ANOMALY';
}
function markFinding(finding){
  const rec=lookup(finding?.entity_id);
  if(!rec)return finding;
  finding.is_public_entity=true;
  finding.is_public_service_strict=truthy(rec.is_public_service_strict);
  finding.public_entity_type=rec.public_entity_type||'';
  finding.public_entity_name=rec.official_name||'';
  finding.public_context_only=isPureSiiLocalContext(finding);
  if(finding.finding_key)state.findings.set(String(finding.finding_key),finding);
  return finding;
}
function publicPriority(findings){
  const eligible=(findings||[]).filter(f=>!isPureSiiLocalContext(f));
  const groups=new Map();
  for(const f of eligible){
    const key=String(f?.finding_type||f?.title||'OTHER');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(f);
  }
  if(!groups.size)return {score:null,eligible,excluded:(findings||[]).length,groups:0};
  const maxima=[...groups.values()].map(rows=>Math.max(...rows.map(f=>Number(f?.score_investigate)||0)));
  const base=Math.max(...maxima,0);
  const scoringSources=new Set();
  for(const f of eligible)for(const p of producersOf(f))if(!CONTEXT_ONLY_PRODUCERS.has(p))scoringSources.add(p);
  const familyBonus=Math.min(9,Math.max(0,groups.size-1)*3);
  const sourceBonus=Math.min(6,Math.max(0,scoringSources.size-1)*2);
  return {score:Math.min(100,base+familyBonus+sourceBonus),eligible,excluded:(findings||[]).length-eligible.length,groups:groups.size};
}
function typeLabel(rec){
  const types=String(rec?.public_entity_type||'').split(' | ').filter(Boolean);
  return types.map(v=>TYPE_LABELS[v]||v.replaceAll('_',' ').toLowerCase()).join(' · ')||'Entidad pública';
}
function sourceLabel(rec){
  const labels=[];
  if(truthy(rec?.gob_cl_reference_match))labels.push('Gob.cl');
  if(truthy(rec?.chilecompra_reference_match))labels.push('ChileCompra');
  if(truthy(rec?.datos_gob_reference_match))labels.push('Datos.gob');
  if(truthy(rec?.dipres_reference_match))labels.push('DIPRES');
  return labels.join(' · ')||String(rec?.source_system||'Radar SII');
}
function strictLabel(rec){
  if(!truthy(rec?.is_public_service_strict))return 'Entidad pública';
  return truthy(rec?.gob_cl_reference_match)?'Servicio público · Gob.cl':'Servicio público · referencia oficial';
}
function decorateEntity(pkg){
  const entity=pkg?.e;if(!entity)return;
  const rec=lookup(entity);if(!rec)return;
  enrichEntity(entity);
  const command=document.querySelector('.v0203-entity-command > div');
  if(command&&!command.querySelector('.v0344-public-status')){
    command.insertAdjacentHTML('afterbegin',`<span class="v0203-status v0344-public-status">${escHtml(strictLabel(rec))}</span>`);
  }
  const hero=document.querySelector('.v0203-entity-hero > div:first-child');
  if(hero&&!hero.querySelector('.v0344-public-context')){
    const name=rec.official_name||entity.name||'Entidad pública';
    hero.insertAdjacentHTML('beforeend',`<div class="v0344-public-context"><div><span>CONTEXTO INSTITUCIONAL</span><b>${escHtml(name)}</b><small>${escHtml(typeLabel(rec))}</small></div><div><span>${escHtml(strictLabel(rec))}</span><small>${escHtml(sourceLabel(rec))}</small><em>Vinculación: ${escHtml(rec.sii_match_method||'RUT exacto')} · ${escHtml(rec.sii_match_confidence||'trazable')}</em></div></div>`);
  }
  const findings=(pkg.findings||[]).map(markFinding);
  const priority=publicPriority(findings);
  const score=document.querySelector('.v0203-hero-score');
  if(score){
    score.innerHTML=`<b>${priority.score==null?'—':priority.score.toLocaleString('es-CL',{maximumFractionDigits:1})}</b><span>Score consolidado</span><small>entidad pública · ${priority.excluded} señal${priority.excluded===1?'':'es'} SII contextual${priority.excluded===1?'':'es'} sin ponderar</small>`;
  }
  const explain=document.querySelector('.v0209-score-explain');
  if(explain&&!explain.querySelector('.v0344-policy-note')){
    explain.insertAdjacentHTML('beforeend',`<small class="v0344-policy-note"><b>Regla sector público:</b> la calidad de entidad pública no es adversa. Las anomalías locales producidas únicamente por Radar SII se conservan como contexto, pero no incrementan esta prioridad. Evidencia CGR, presupuesto, sanciones u otros productores mantiene su semántica propia.</small>`);
  }
  const taxPanel=[...document.querySelectorAll('.v0203-tab-panel article')].find(x=>/tribut|sii/i.test(x.textContent||''));
  if(taxPanel&&!taxPanel.querySelector('.v0344-context-chip')){
    taxPanel.insertAdjacentHTML('afterbegin','<div class="v0344-context-chip">SII · contexto institucional para entidad pública</div>');
  }
}
function decorateFindingNodes(){
  document.querySelectorAll('[data-finding]').forEach(node=>{
    const f=state.findings.get(String(node.dataset.finding||''));
    if(!f?.is_public_entity||node.querySelector('.v0344-finding-badge'))return;
    const label=f.is_public_service_strict?'Servicio público':'Entidad pública';
    node.insertAdjacentHTML('afterbegin',`<span class="v0344-finding-badge">${escHtml(label)}</span>`);
    if(f.public_context_only){
      node.classList.add('v0344-context-only');
      node.setAttribute('title','Señal SII conservada como contexto institucional; no pondera prioridad empresarial.');
    }
  });
}
function decorateOverview(){
  const content=document.querySelector('#content');
  if(!content||document.querySelector('#v0344-public-overview'))return;
  const summary=state.summary||{};
  const total=Number(summary.public_entities_total)||state.rows.length;
  const matched=Number(summary.sii_rut_exact_matches)||state.byEntity.size;
  const strict=Number(summary.strict_public_services||summary.public_services_gob_cl)||state.rows.filter(r=>truthy(r.is_public_service_strict)).length;
  const strip=document.createElement('section');
  strip.id='v0344-public-overview';strip.className='v0344-public-overview';
  strip.innerHTML=`<div><span>CONTEXTO INSTITUCIONAL ACTIVO</span><b>${total.toLocaleString('es-CL')} entidades públicas</b><small>${matched.toLocaleString('es-CL')} enlazadas a RUT/entity_id SII · ${strict.toLocaleString('es-CL')} servicios públicos estrictos</small></div><div><span>Regla analítica</span><b>Sector público ≠ señal adversa</b><small>Radar SII clasifica; CGR, presupuesto, sanciones y otros productores conservan evidencia independiente.</small></div>`;
  const first=content.firstElementChild;
  if(first)first.insertAdjacentElement('afterend',strip);else content.appendChild(strip);
}
function decorateEntitiesView(){
  const content=document.querySelector('#content');
  if(!content||document.querySelector('#v0344-entities-note'))return;
  const note=document.createElement('div');note.id='v0344-entities-note';note.className='v0344-entities-note';
  note.innerHTML='<b>Reconocimiento de sector público activo.</b> Entity 360 identifica automáticamente RUT/entity_id enlazados por Radar SII. No se realiza etiquetado automático por similitud difusa de nombre.';
  content.prepend(note);
}
async function decorate(view){
  await registryPromise;
  decorateFindingNodes();
  if(view==='overview')decorateOverview();
  if(view==='entities')decorateEntitiesView();
}

/* Ensure the core finding stream is enriched before priority components consume it. */
if(typeof window.v019LoadCore==='function'){
  const baseLoadCore=window.v019LoadCore;
  window.v019LoadCore=async function(...args){
    const [core]=await Promise.all([baseLoadCore(...args),registryPromise]);
    for(const f of core?.findings||[])markFinding(f);
    return core;
  };
}

/* Existing priority helpers keep public-sector evidence, but remove pure SII context from ranking. */
if(typeof window.v0194NonUafFindings==='function'){
  const baseNonUaf=window.v0194NonUafFindings;
  window.v0194NonUafFindings=function(core){
    const rows=baseNonUaf(core)||[];
    return rows.filter(f=>{
      markFinding(f);
      return !(f.is_public_entity&&isPureSiiLocalContext(f));
    });
  };
}

if(typeof window.v0203RenderEntity==='function'){
  const baseRenderEntity=window.v0203RenderEntity;
  window.v0203RenderEntity=function(pkg){
    if(state.loaded)enrichEntity(pkg?.e);
    const result=baseRenderEntity(pkg);
    registryPromise.then(()=>decorateEntity(pkg)).catch(()=>{});
    return result;
  };
}

/* Final navigation wrapper: decorate without changing any existing route implementation. */
if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(view,...args){
    const result=await baseNavigate(view,...args);
    await decorate(view);
    return result;
  };
}

/* Initial authenticated render may happen without a navigation event after this module loads. */
const observer=new MutationObserver(()=>{
  if(!state.loaded)return;
  decorateFindingNodes();
  const view=window.state?.view;
  if(view==='overview')decorateOverview();
  if(view==='entities')decorateEntitiesView();
});
observer.observe(document.documentElement,{childList:true,subtree:true});
registryPromise.then(()=>decorate(window.state?.view)).catch(()=>{});

window.AML_PUBLIC_ENTITY={
  version:'1.0',
  registryUrl:REGISTRY_URL,
  summaryUrl:SUMMARY_URL,
  load:loadRegistry,
  lookup,
  enrichEntity,
  isPureSiiLocalContext,
  state,
  policy:{
    identity:'RUT_OR_ENTITY_ID_FROM_RADAR_SII_ONLY',
    fuzzyNameMatch:false,
    publicStatusAdverse:false,
    publicSiiLocalSignals:'CONTEXT_ONLY',
    otherProducerEvidence:'PRESERVE_SOURCE_SEMANTICS'
  }
};
