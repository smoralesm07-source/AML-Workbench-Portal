'use strict';
/* ATLAS AML · Entidades × Universo SO canonical status 0.81.3
 * Read-only progressive enhancement for the individual entity dossier only.
 * The Entidades landing must not render aggregate Universo SO cards.
 * Exact RUT only; no name matching. No MutationObserver or navigate rewrite.
 */
(function atlasEntityUafStatus0813(){
  if(window.AtlasEntityUafStatus0812)return;
  const VERSION='0.81.3',STATUS='aml_v_entity_uaf_status_current_v0812';
  const entry=window.__ATLAS_ENTITY_ENTRY__;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const rutKey=v=>String(v||'').toUpperCase().replace(/[^0-9K]/g,'');
  const stateNow=()=>{try{return typeof state!=='undefined'?state:(window.state||null)}catch{return window.state||null}};

  function ensureCss(){
    if(document.querySelector('link[data-aeu812]'))return;
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='./assets/atlas-entity-uaf-status-0812.css?v=0813-entities-clean1';
    l.dataset.aeu812='1';
    document.head.appendChild(l);
  }
  async function entityRut(entityId){
    const c=db();if(!c||!entityId)return null;
    const r=await c.from('aml_entities').select('entity_id,rut,name').eq('entity_id',entityId).maybeSingle();
    return r.error?null:r.data;
  }
  async function statusForRut(rut){
    const c=db(),k=rutKey(rut);if(!c||!k)return null;
    const r=await c.from(STATUS).select('*').eq('rut_key',k).maybeSingle();
    return r.error?null:r.data;
  }
  function statusLabel(s){
    if(s?.universe_status==='SO_INSCRITO')return'SO inscrito · padrón UAF vigente';
    if(s?.universe_status==='POTENCIAL_SO_SCREENING')return'Potencial SO · screening';
    return'No observado en Universo SO actual';
  }
  function managementLabel(v){
    return({POTENCIAL_PENDIENTE:'Pendiente de gestión',CANDIDATO_SELECCIONADO:'Candidato seleccionado',NO_CANDIDATO:'No candidato'}[v]||'Sin gestión registrada');
  }
  function statusMarkup(s){
    const cls=s?.is_uaf_registered?'registered':s?.is_potential_screening?'potential':'neutral';
    return `<section class="aeu812-status ${cls}" data-aeu812-status><span>UNIVERSO SO · ESTADO CANÓNICO</span><b>${esc(statusLabel(s))}</b><p>${esc(s?.status_basis||'La ausencia de coincidencia exacta por RUT no acredita exclusión del perímetro regulatorio.')}</p><dl><div><dt>Sector UAF / implícito</dt><dd>${esc(s?.uaf_sector||'No observado')}</dd></div><div><dt>Situación SII</dt><dd>${esc(s?.sii_status||'No observado')}</dd></div><div><dt>Gestión potencial</dt><dd>${esc(s?.is_potential_screening?managementLabel(s.management_bucket):'No aplica')}</dd></div></dl></section>`;
  }
  function paintLanding(){
    document.querySelectorAll('[data-aeu812-universe],.aeu812-universe-strip').forEach(node=>node.remove());
    return Promise.resolve();
  }
  async function paintDetail(entityId){
    ensureCss();
    const id=entityId||stateNow()?.selectedEntity;if(!id)return;
    const e=await entityRut(id);if(!e?.rut)return;
    const s=await statusForRut(e.rut);
    const card=document.querySelector('#aed-uaf')||document.querySelector('[data-a45-panel="character"]');if(!card)return;
    card.querySelector('[data-aeu812-status]')?.remove();
    const holder=document.createElement('div');holder.innerHTML=statusMarkup(s);
    const node=holder.firstElementChild,header=card.querySelector(':scope > header');
    if(header)header.insertAdjacentElement('afterend',node);else card.prepend(node);
    window.__ATLAS_ENTITY_UAF_STATUS_0812__={active:true,version:VERSION,entityId:id,rutKey:rutKey(e.rut),status:s?.universe_status||'NOT_OBSERVED',landingPolicy:'NO_UNIVERSE_SUMMARY_CARDS_IN_ENTITIES',renderedAt:new Date().toISOString()};
  }
  function scheduleDetail(id){[120,420,900].forEach(ms=>setTimeout(()=>void paintDetail(id),ms));}
  if(entry?.load){
    const base=entry.load;
    entry.load=async function(...args){const out=await base.apply(this,args);await paintLanding();return out};
    try{loadEntities=entry.load}catch{}
    window.loadEntities=entry.load;
  }
  if(entry?.open){const base=entry.open;entry.open=async function(...args){const out=await base.apply(this,args);scheduleDetail(args[0]);return out};window.openEntity=entry.open;}
  if(entry?.explorer?.open){const base=entry.explorer.open;entry.explorer.open=async function(...args){const out=await base.apply(this,args);scheduleDetail(args[0]);return out};}
  document.addEventListener('click',e=>{const t=e.target?.closest?.('[data-a45-entity],[data-aex-suggest-id],[data-aex-entity],[data-entity]');if(!t)return;scheduleDetail(t.dataset.a45Entity||t.dataset.aexSuggestId||t.dataset.aexEntity||t.dataset.entity||null);},false);
  window.addEventListener('atlas:nav-refresh',()=>{if(stateNow()?.view==='entities')void paintLanding();});
  paintLanding();
  window.AtlasEntityUafStatus0812={active:true,version:VERSION,paintLanding,paintDetail,statusForRut,identityPolicy:'EXACT_NORMALIZED_RUT_ONLY',landingPolicy:'NO_UNIVERSE_SUMMARY_CARDS_IN_ENTITIES',semantics:'CURRENT_UAF_REGISTER_OR_POTENTIAL_SCREENING_NOT_LEGAL_CONCLUSION'};
})();
