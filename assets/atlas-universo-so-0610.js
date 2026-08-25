'use strict';
(function atlasUniversoSO0610(){
  const INTEGRITY='aml_v_uaf_universe_integrity_0610';
  const REPORTING='aml_v_uaf_reporting_obligation_0610';
  const PRESS_FEED='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const core=window.__ATLAS_OBLIGATED__;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=core?.esc||((v)=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m])));
  const fmt=core?.fmt||((v)=>Number(v||0).toLocaleString('es-CL'));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL').replace(/\b(s\.?a\.?|spa|ltda|eirl|limitada)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  let integrity=null, loadingIntegrity=false, dossierRut=null, pressCache=null, pressLoading=null;

  async function getIntegrity(){
    if(integrity||loadingIntegrity)return integrity;
    const client=db(); if(!client)return null;
    loadingIntegrity=true;
    try{
      const {data,error}=await client.from(INTEGRITY).select('*').maybeSingle();
      if(error)throw error;
      integrity=data||null;
      return integrity;
    }finally{loadingIntegrity=false;}
  }

  function truthHtml(x){
    if(!x)return '';
    return `<section class="uso60-card uso61-truth">
      <h2>Verdad registral del universo UAF</h2>
      <p>Atlas separa sujetos obligados inscritos de otros organismos observados en fuentes UAF. No se suman poblaciones de naturaleza distinta.</p>
      <div class="uso60-sourcegrid">
        <div class="uso60-source ok"><i></i><b>${fmt(x.registered_subjects)}</b><small>Sujetos obligados inscritos en el padrón materializado</small></div>
        <div class="uso60-source ok"><i></i><b>${fmt(x.uaf_public_bodies)}</b><small>Organismos públicos observados por fuente UAF, fuera del padrón de SO</small></div>
        <div class="uso60-source ok"><i></i><b>${fmt(x.uaf_observed_entities)}</b><small>Total de entidades observadas por la fuente UAF en Atlas</small></div>
        <div class="uso60-source ok"><i></i><b>${fmt(x.raw_sector_labels)}</b><small>Grafías sectoriales presentes en el padrón</small></div>
        <div class="uso60-source ok"><i></i><b>${fmt(x.populated_canonical_sectors)}</b><small>Sectores canónicos actualmente poblados</small></div>
        <div class="uso60-source ok"><i></i><b>${fmt(x.canonical_sector_catalog)}</b><small>Catálogo canónico de actividades/sectores Atlas</small></div>
      </div>
      <details class="uso60-method"><summary>Ayuda metodológica</summary><p><b>${fmt(x.uaf_observed_entities)} no equivale a sujetos obligados inscritos.</b> En el corte actual se reconcilia como ${fmt(x.registered_subjects)} sujetos obligados + ${fmt(x.uaf_public_bodies)} organismos públicos. Del mismo modo, ${fmt(x.populated_canonical_sectors)} sectores poblados no reduce el catálogo canónico de ${fmt(x.canonical_sector_catalog)}.</p></details>
    </section>`;
  }

  async function patchPanorama(){
    const root=document.querySelector('.so-root');
    if(!root||core?.state?.mode!=='panorama')return;
    root.querySelector('.uso60-integrity')?.remove();
    if(root.querySelector('.uso61-truth'))return;
    const x=await getIntegrity();
    if(!x||!document.contains(root))return;
    const modes=root.querySelector('.so-modes');
    if(modes)modes.insertAdjacentHTML('afterend',truthHtml(x));
  }

  function reportingHtml(r){
    const yes=v=>v===true?'Sí':v===false?'No':'—';
    if(!r)return `<section class="uso60-lens uso61-reporting"><h3>Reportabilidad UAF</h3><p>No existe regla sectorial materializada para este sector en el corte actual. Esto no equivale a que el sujeto no tenga obligaciones de reporte.</p></section>`;
    const mapped=r.reporting_rule_mapped===true;
    return `<section class="uso60-lens uso61-reporting">
      <h3>Obligaciones de reportabilidad UAF</h3>
      <p>Esta lente describe la regla sectorial aplicable. <b>No muestra aún la conducta efectiva de reportes de esta entidad.</b></p>
      <div class="uso60-facts">
        <div class="uso60-fact"><span>ROS requerido</span><b>${esc(yes(r.ros_required))}</b></div>
        <div class="uso60-fact"><span>Disparador ROS</span><b>${esc(r.ros_trigger||'—')}</b></div>
        <div class="uso60-fact"><span>ROE requerido</span><b>${esc(yes(r.roe_required))}</b></div>
        <div class="uso60-fact"><span>Frecuencia ROE</span><b>${esc(r.roe_frequency||'—')}</b></div>
        <div class="uso60-fact"><span>Umbral ROE USD</span><b>${r.roe_threshold_usd==null?'—':esc(fmt(r.roe_threshold_usd))}</b></div>
        <div class="uso60-fact"><span>Plazo</span><b>${esc(r.roe_deadline||'—')}</b></div>
        <div class="uso60-fact"><span>Base legal</span><b>${esc(r.legal_basis||'—')}</b></div>
        <div class="uso60-fact"><span>Estado de regla</span><b>${mapped?'Mapeada':'Sin correspondencia sectorial exacta'}</b></div>
      </div>
      <details class="uso60-method"><summary>Cómo leer esta lente</summary><p>Obligación normativa y reportabilidad observada son conceptos distintos. Hasta que Atlas materialice ROS/ROE por RUT, esta ficha no infiere cumplimiento, incumplimiento ni ausencia de reportes.</p></details>
    </section>`;
  }

  async function loadPress(){
    if(pressCache)return pressCache;
    if(pressLoading)return pressLoading;
    pressLoading=fetch(`${PRESS_FEED}?_atlas=${Date.now()}`,{cache:'no-store',credentials:'omit'})
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(d=>{pressCache=d||{};return pressCache;})
      .catch(()=>null)
      .finally(()=>{pressLoading=null;});
    return pressLoading;
  }

  function exactPressEntity(feed,name){
    const target=norm(name); if(!target)return null;
    const entities=Array.isArray(feed?.entities)?feed.entities:[];
    const hits=entities.filter(e=>[e?.name,...(Array.isArray(e?.aliases)?e.aliases:[])].some(v=>norm(v)===target));
    return hits.length===1?hits[0]:null;
  }

  function pressHtml(feed,entity){
    if(!entity)return '';
    const mentions=(Array.isArray(feed?.mentions)?feed.mentions:[]).filter(m=>String(m.press_entity_id||'')===String(entity.press_entity_id||''));
    const articles=new Map((Array.isArray(feed?.articles)?feed.articles:[]).map(a=>[String(a.id),a]));
    const rows=mentions.map(m=>({m,a:articles.get(String(m.article_id))||{}})).sort((x,y)=>String(y.a.date||'').localeCompare(String(x.a.date||''))).slice(0,6);
    if(!rows.length)return '';
    return `<section class="uso60-lens uso61-press">
      <h3>Prensa y contexto abierto</h3>
      <p>${fmt(entity.article_count||rows.length)} publicación(es) asociadas mediante coincidencia nominal exacta y no ambigua con el feed del Monitor.</p>
      <div class="uso60-timeline">${rows.map(({m,a})=>`<div class="uso60-event"><time>${esc(String(a.date||'').slice(0,10)||'sin fecha')}</time><b>${esc(a.title||'Publicación')}</b><small>${esc(a.media||'Medio no materializado')} · ${esc(m.role||'mención')}</small>${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Ver fuente original ↗</a>`:''}</div>`).join('')}</div>
      <details class="uso60-method"><summary>Cómo leer esta lente</summary><p>La presencia en prensa es contexto OSINT. No acredita delito, incumplimiento ni identidad por sí sola y no modifica IPF, IVO o decisiones de supervisión.</p></details>
    </section>`;
  }

  async function patchDossier(){
    const host=document.querySelector('#so-dossier');
    const rut=core?.state?.dossier?.rut;
    if(!host||!rut)return;
    const target=host.querySelector('.uso60-dossier360')||host;
    if(!host.querySelector('.uso61-reporting')){
      const client=db();
      if(client){
        const {data,error}=await client.from(REPORTING).select('*').eq('rut',rut).maybeSingle();
        if(!error&&document.contains(host))target.insertAdjacentHTML('beforeend',reportingHtml(data||null));
      }
    }
    if(!host.querySelector('.uso61-press')){
      const name=core?.state?.dossier?.subject?.registry_name||core?.state?.dossier?.subject?.entity_name||'';
      if(name){
        const feed=await loadPress();
        const entity=exactPressEntity(feed,name);
        const html=pressHtml(feed,entity);
        if(html&&document.contains(host))target.insertAdjacentHTML('beforeend',html);
      }
    }
    dossierRut=rut;
  }

  async function patch(){
    try{await patchPanorama();await patchDossier();}catch(_e){}
  }

  const obs=new MutationObserver(()=>patch());
  const start=()=>{const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});patch();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0610__={version:'0.61.0',getIntegrity,patch,pressPolicy:'EXACT_NORMALIZED_UNAMBIGUOUS'};
})();
