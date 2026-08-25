'use strict';
(function atlasUniversoSO0630(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0630__={active:false,reason:'obligated-core-unavailable'};return;}
  const OBL='aml_v_uaf_reporting_obligation_0620';
  const V360='aml_v_uaf_supervision_360_current';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=core.esc,fmt=core.fmt,day=core.day;

  const yes=v=>v===true?'Sí':v===false?'No':'—';
  const money=v=>{const n=Number(v);return Number.isFinite(n)?`$${Math.round(n).toLocaleString('es-CL')}`:'—';};
  const fact=(k,v)=>`<div class="uso60-fact"><span>${esc(k)}</span><b>${esc(v==null||v===''?'—':String(v))}</b></div>`;

  function removeNonPublicReportingUi(){
    document.querySelectorAll('.uso62-reporting-integrity,.uso62-reporting').forEach(n=>n.remove());
  }

  function reportingLens(o){
    return `<section class="uso60-lens uso63-reporting">
      <h3>Reportabilidad UAF · obligación normativa</h3>
      <p>Atlas muestra únicamente la obligación aplicable al sector. La conducta efectiva ROS/ROE por RUT no es observable en fuentes abiertas y no se infiere.</p>
      <div class="uso60-facts">
        ${fact('ROS requerido',yes(o?.ros_required))}
        ${fact('ROE requerido',yes(o?.roe_required))}
        ${fact('Frecuencia ROE',o?.roe_frequency||'—')}
        ${fact('Umbral ROE USD',o?.roe_threshold_usd==null?'—':fmt(o.roe_threshold_usd))}
        ${fact('Plazo',o?.roe_deadline||'—')}
        ${fact('Regla sectorial',o?.reporting_rule_mapped?'Mapeada':'Pendiente')}
      </div>
      <details class="uso60-method"><summary>Cómo leer esta lente</summary><p>La obligación normativa no permite concluir si una entidad reportó, dejó de reportar o reportó en exceso. Ese comportamiento no es público a nivel de RUT.</p></details>
    </section>`;
  }

  function observableLens(r){
    if(!r)return '';
    const state=r.sii_status||'No observado';
    const publicEvidence=Number(r.public_spend_evidence_count||0);
    const rel=Number(r.res_relationship_count||0);
    const sanctions=Number(r.sanction_event_count||0);
    return `<section class="uso60-lens uso63-observable">
      <h3>Señales supervisoras observables</h3>
      <p>Prioriza hechos verificables por entidad en fuentes abiertas. Son contexto supervisor y no constituyen por sí solos una conclusión LA/FT.</p>
      <div class="uso60-dual">
        <div><h4>Situación tributaria y territorial</h4><div class="uso60-facts">
          ${fact('Estado SII',state)}${fact('Actividad principal',r.sii_main_activity||'—')}${fact('Tramo ventas',r.sii_sales_band||'—')}${fact('Trabajadores',fmt(r.sii_workers||0))}${fact('Región',r.region||'—')}${fact('Comuna',r.commune||'—')}
        </div></div>
        <div><h4>Exposición y contexto público</h4><div class="uso60-facts">
          ${fact('Sanciones UAF observadas',fmt(sanctions))}${fact('Última sanción',r.sanction_last_event_date?day(r.sanction_last_event_date):'—')}${fact('Evidencias Estado',fmt(publicEvidence))}${fact('Compras públicas',fmt(r.public_spend_purchase_count||0))}${fact('Lobby',fmt(r.public_spend_lobby_count||0))}${fact('CGR',fmt(r.public_spend_cgr_count||0))}
        </div></div>
      </div>
      <div class="uso60-dual" style="margin-top:12px">
        <div><h4>Estructura societaria</h4><div class="uso60-facts">
          ${fact('Relaciones registrales',fmt(rel))}${fact('Socios',fmt(r.res_partner_count||0))}${fact('Administradores',fmt(r.res_admin_count||0))}${fact('Eventos societarios',fmt(r.res_timeline_event_count||0))}${fact('Capital observado',money(r.res_capital))}${fact('Último evento',r.res_last_event_date?day(r.res_last_event_date):'—')}
        </div></div>
        <div><h4>Cobertura de fuentes</h4><div class="uso60-facts">
          ${fact('Fuentes consolidadas',fmt(r.source_count||0))}${fact('OSFL observado',r.osfl_observed?'Sí':'No')}${fact('Fuentes OSFL',fmt(r.osfl_source_count||0))}${fact('Prioridad supervisora',r.supervision_priority_band||'—')}${fact('IPF',r.supervision_priority_score==null?'—':fmt(r.supervision_priority_score))}${fact('Credibilidad',r.supervision_priority_credibility_pct==null?'—':`${fmt(r.supervision_priority_credibility_pct)}%`)}
        </div></div>
      </div>
      <details class="uso60-method"><summary>Criterio supervisor</summary><p>Estas señales sirven para ordenar revisión y abrir preguntas: vigencia tributaria, escala, cambios territoriales, sanciones publicadas, contratación estatal, vínculos societarios y cobertura de fuentes. Ninguna debe convertirse automáticamente en imputación de incumplimiento o riesgo LA/FT.</p></details>
    </section>`;
  }

  async function patchPanorama(){
    removeNonPublicReportingUi();
    const root=document.querySelector('.so-root');
    if(!root||core.state?.mode!=='panorama'||root.querySelector('.uso63-scope'))return;
    const anchor=root.querySelector('.uso61-truth')||root.querySelector('.so-modes');
    if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',`<section class="uso60-card uso63-scope"><h2>Alcance público de supervisión</h2><p>La capa individual de Atlas se concentra en señales observables por RUT. ROS y ROE permanecen sólo como obligación normativa sectorial; su conducta efectiva no se publica a nivel individual.</p><div class="uso60-sourcegrid"><div class="uso60-source ok"><i></i><b>Normativa ROS/ROE</b><small>Reglas sectoriales aplicables</small></div><div class="uso60-source ok"><i></i><b>SII + territorio</b><small>Vigencia, actividad, escala y localización</small></div><div class="uso60-source ok"><i></i><b>Sanciones + Estado</b><small>UAF, Mercado Público, Lobby y CGR</small></div><div class="uso60-source ok"><i></i><b>Sociedades + OSINT</b><small>RES, OSFL, prensa y relaciones</small></div></div></section>`);
  }

  async function patchDossier(){
    removeNonPublicReportingUi();
    const host=document.querySelector('#so-dossier');
    const rut=core.state?.dossier?.rut;
    if(!host||!rut)return;
    const client=db();if(!client)return;
    const target=host.querySelector('.uso60-dossier360')||host;
    if(!host.querySelector('.uso63-reporting')){
      const {data:o,error}=await client.from(OBL).select('*').eq('rut',rut).maybeSingle();
      if(!error&&document.contains(host))target.insertAdjacentHTML('beforeend',reportingLens(o||null));
    }
    if(!host.querySelector('.uso63-observable')){
      const {data:r,error}=await client.from(V360).select('*').eq('rut',rut).maybeSingle();
      if(!error&&r&&document.contains(host))target.insertAdjacentHTML('beforeend',observableLens(r));
    }
  }

  async function patch(){try{await patchPanorama();await patchDossier();}catch(_e){}}
  const obs=new MutationObserver(()=>patch());
  const start=()=>{const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});patch();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0630__={active:true,version:'0.63.0',publicScopeOnly:true,individualReportingBehavior:false};
})();

/* Loader tardío y autocontenido: evita tocar las autoridades históricas de
   Entidades y mantiene la federación limitada a esa sección. */
(function loadAtlasEntityFederation0640(){
  if(document.querySelector('script[data-atlas-entity-federation="0640"]'))return;
  const script=document.createElement('script');
  script.src='./assets/atlas-entity-federation-0640.js?v=0640-1';
  script.async=false;
  script.dataset.atlasEntityFederation='0640';
  document.head.appendChild(script);
})();
