'use strict';

/* AML Workbench v0.20.2 · standardized alert language
 * Origin owns the color. Semantic type is text. Message is short.
 * Based on the visual standard from cockpit (1).html.
 */

const V0202='0.20.2';
const V0202_FINDINGS=new Map();
let V0202_BUDGET=null;
const v0202BaseShell=shell;

const V0202_SOURCE={
  RADAR_SII:{label:'SII',cls:'sii'},
  RADAR_UAF:{label:'UAF',cls:'uaf'},
  RADAR_CGR:{label:'CGR',cls:'cgr'},
  RADAR_DELICTUAL:{label:'Delictual',cls:'del'},
  PRESUPUESTO_ABIERTO:{label:'Presupuesto',cls:'pre'},
  RADAR_PRESUPUESTO:{label:'Presupuesto',cls:'pre'},
  RADAR_SANCIONES:{label:'Sanciones',cls:'san'},
  RADAR_OSFL:{label:'OSFL',cls:'osfl'},
  RADAR_PRENSA:{label:'Prensa',cls:'press'},
  CONTEXT_HUB:{label:'Contexto',cls:'ctx'}
};

shell=function(title,subtitle){
  v0202BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0202}`;
};

function v0202Source(id){
  const key=String(id||'').toUpperCase();
  return V0202_SOURCE[key]||{label:String(id||'Fuente').replace('RADAR_',''),cls:'other'};
}
function v0202Sources(f){
  return v0201Unique(v019Array(f?.payload?.producer_ids).map(String));
}
function v0202SourceBadges(ids){
  const src=v0201Unique((ids||[]).map(String));
  return `<div class="v0202-source-badges">${src.map(id=>{const s=v0202Source(id);return `<span class="v0202-source-badge ${esc(s.cls)}">${esc(s.label)}</span>`;}).join('')}</div>`;
}
function v0202OriginStrip(ids){
  const src=v0201Unique((ids||[]).map(String));
  const use=src.length?src:['UNKNOWN'];
  return `<div class="v0202-origin-strip">${use.map(id=>`<i class="${esc(v0202Source(id).cls)}"></i>`).join('')}</div>`;
}
function v0202Type(f){
  const t=String(f?.finding_type||'');
  const map={
    CONTEXTUAL_ANOMALY:'Anomalía contextual',
    SUPERVISORY_GAP:'Alerta fiscalización',
    REGULATORY_GAP:'Alerta fiscalización',
    GOVERNED_AML_SIGNAL:'Señal AML',
    PRUDENTIAL_SANCTION:'Antecedente sancionatorio',
    ENTITY_CONVERGENCE:'Convergencia multifuente'
  };
  return map[t]||v019FindingType(t);
}
function v0202Short(f){
  const p=f?.payload||{},facts=p.decision_facts||{},names=typeof v0201ParseAnomalyText==='function'?v0201ParseAnomalyText(p.explanation):[];
  if(f?.finding_type==='CONTEXTUAL_ANOMALY'&&names.length)return `${names.slice(0,3).join(' · ')}${names.length>3?' · …':''}`;
  if(f?.finding_type==='SUPERVISORY_GAP'||f?.finding_type==='REGULATORY_GAP')return `${v019Fmt(facts.supervisory_gap_candidates||0)} pares RUT–actividad requieren validación`;
  if(f?.finding_type==='GOVERNED_AML_SIGNAL')return `${v019Fmt(facts.direct_aml_signals||1)} señal AML gobernada · ${v019Fmt(f.evidence_count||facts.evidence_count||0)} evidencia(s)`;
  if(f?.finding_type==='PRUDENTIAL_SANCTION')return `${v019Fmt(facts.sanctions||1)} sanción(es) vinculada(s) · revisar materia y recurrencia`;
  if(f?.finding_type==='ENTITY_CONVERGENCE')return `${v019Fmt(facts.independent_sources||f.source_count||0)} fuentes convergen · ${v019Fmt(facts.contextual_anomalies||0)} anomalías · ${v019Fmt(facts.observed_relationships||0)} relaciones`;
  if(typeof v0201FindingCardSummary==='function')return v0201FindingCardSummary(f);
  return v019Truncate(p.explanation||f?.title||'Hallazgo para revisión',130);
}
function v0202FindingAlert(f,rank=null,compact=false){
  const key=f.finding_key||f.finding_id||`${f.entity_id||'finding'}-${Math.random()}`;
  V0202_FINDINGS.set(key,f);
  const sources=v0202Sources(f),score=Number(f.score_investigate),facts=f.payload?.decision_facts||{};
  const entity=f.payload?.entity_label||f.title||f.entity_id||'Hallazgo';
  return `<article class="v0202-alert ${compact?'compact':''}" data-v0202-finding="${esc(key)}">
    ${v0202OriginStrip(sources)}
    <div class="v0202-alert-body">
      <div class="v0202-alert-top">
        <div class="v0202-alert-meta">${v0202SourceBadges(sources)}<span class="v0202-type-badge">${esc(v0202Type(f))}</span></div>
        ${rank!=null?`<span class="v0202-rank">${esc(String(rank))}</span>`:''}
      </div>
      <div class="v0202-alert-main">
        <div><h3>${esc(v019Truncate(entity,82))}</h3><p>${esc(v0202Short(f))}</p></div>
        <div class="v0202-alert-score"><b>${Number.isFinite(score)?v019Fmt(score,1):'—'}</b><span>IPA</span></div>
      </div>
      <div class="v0202-alert-foot"><span>${esc(v019RegionShort(f.region||'Sin región'))}${f.commune?` · ${esc(f.commune)}`:''}</span><span>${v019Fmt(f.evidence_count||facts.evidence_count||0)} evidencias</span></div>
    </div>
  </article>`;
}
function v0202FindingList(rows,n=7){
  const data=(rows||[]).slice(0,n);
  if(!data.length)return '<div class="v019-empty">No hay alertas individualizables en este corte.</div>';
  return `<div class="v0202-alert-list">${data.map((f,i)=>v0202FindingAlert(f,i+1,true)).join('')}</div>`;
}

/* Radar landing: same alert language */
v0194Priority=function(core){
  const rows=v0194NonUafFindings(core).filter(f=>f.entity_id).slice(0,7);
  return v0202FindingList(rows,7);
};

/* Hallazgos and Entity 360 reuse the exact same standard */
v17FindingCards=function(rows,modeKey=typeof V17_FINDING_MODE!=='undefined'?V17_FINDING_MODE:'investigate',compact=false){
  if(!rows.length)return empty('Sin hallazgos','No hay hallazgos vinculados en este corte.');
  return `<div class="v0202-alert-deck">${rows.map(f=>v0202FindingAlert(f,null,compact)).join('')}</div>`;
};

function v0202SignalSources(signal,f){
  const k=v0201Norm(`${signal?.label||''} ${signal?.detail||''}`),all=v0202Sources(f);
  if(k.includes('SANCION'))return ['RADAR_SANCIONES'];
  if(k.includes('PARES RUT')||k.includes('SCREENING'))return ['RADAR_SII','RADAR_UAF'];
  if(k.includes('SENAL AML'))return all.includes('RADAR_UAF')?['RADAR_UAF']:(all.includes('RADAR_SANCIONES')?['RADAR_SANCIONES']:all.slice(0,1));
  if(/VENT|DOMICIL|DOTACION|ACTIVIDAD|TRAMO|REACTIV/.test(k))return ['RADAR_SII'];
  if(k.includes('CONVERGENCIA')||k.includes('RELACIONES'))return all;
  return all.slice(0,2);
}
function v0202SignalType(signal){
  const k=v0201Norm(signal?.label||'');
  if(k.includes('SANCION'))return 'Antecedente sancionatorio';
  if(k.includes('SENAL AML'))return 'Señal AML';
  if(k.includes('PARES RUT')||k.includes('SCREENING'))return 'Alerta fiscalización';
  if(k.includes('CONVERGENCIA'))return 'Convergencia multifuente';
  if(k.includes('RELACIONES'))return 'Relación observada';
  return 'Anomalía contextual';
}
function v0202DrawerSignal(signal,f){
  const src=v0202SignalSources(signal,f);
  return `<article class="v0202-drawer-alert">${v0202OriginStrip(src)}<div class="v0202-drawer-alert-body"><div class="v0202-alert-meta">${v0202SourceBadges(src)}<span class="v0202-type-badge">${esc(v0202SignalType(signal))}</span></div><b>${esc(signal.label)}</b>${signal.detail?`<p>${esc(signal.detail)}</p>`:''}</div></article>`;
}

/* Drawer: show origin + short alert standard before metrics/methodology */
v0201FindingDrawerHtml=function(f,ctx){
  const p=f.payload||{},facts=p.decision_facts||{},signals=v0201SignalRows(f,ctx),score=Number(f.score_investigate),band=v0201Band(score),sector=v019Array(p.sector_names)[0];
  const next=v019Array(p.suggested_next_steps).filter(Boolean).slice(0,3),sources=v0202Sources(f);
  return `<div class="v0201-finding v0202-drawer">
    <div class="v0202-drawer-head">${v0202SourceBadges(sources)}<span class="v0202-type-badge">${esc(v0202Type(f))}</span></div>
    <div class="v0201-title-row"><div><h2>${esc(p.entity_label||f.title||'Hallazgo')}</h2><p>${esc(f.region||'')}${f.commune?` · ${esc(f.commune)}`:''}${f.entity_id?` · RUT ${esc(v0201FmtRut(f))}`:''}</p></div><div class="v0201-score ${esc(band.cls)}"><b>${v019Fmt(score,1)}</b><span>IPA · ${esc(band.label)}</span></div></div>
    <section class="v0202-summary"><span>HALLAZGO EN UNA LÍNEA</span><h3>${esc(v0202Short(f))}</h3></section>
    <div class="v0202-drawer-alert-list">${signals.map(s=>v0202DrawerSignal(s,f)).join('')}</div>
    ${v0201MetricsHtml(v0201MetricRows(f))}
    <section class="v0201-block"><div class="v0201-block-head"><h3>Evidencia disponible</h3><span>resumen del corte</span></div><div class="v0201-fact-grid"><div><span>Fuentes</span><b>${v019Fmt(facts.independent_sources??f.source_count)}</b></div><div><span>Evidencias</span><b>${v019Fmt(f.evidence_count??facts.evidence_count)}</b></div><div><span>Anomalías</span><b>${v019Fmt(facts.contextual_anomalies||0)}</b></div><div><span>Sanciones</span><b>${v019Fmt(facts.sanctions||0)}</b></div></div>${sector?`<div class="v0201-context-line"><span>Sector</span><b>${esc(sector)}</b></div>`:''}</section>
    ${v0201SanctionHtml(ctx.sanctions)}
    ${next.length?`<section class="v0201-block"><div class="v0201-block-head"><h3>Siguiente revisión útil</h3></div><div class="v0201-next">${next.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`:''}
    <div class="v0201-guardrail">${esc(v019Array(p.contradicting_factors)[0]||'El IPA ordena revisión; no acredita delito, LA/FT ni incumplimiento.')}</div>
    <div class="v019-actions">${f.entity_id?'<button type="button" class="v019-action" id="v0201-open-entity">Abrir Entidad 360</button>':''}<button type="button" class="v019-action" id="v0201-go-findings">Ver hallazgos</button></div>
    <div class="v0201-method">${v0201MethodButton(f)}</div>
  </div>`;
};

/* UAF home environment: alerts use UAF color and concise message */
v0194UafEnvironment=function(uaf,core){
  const totals=uaf.report?.totals||{},dash=uaf.dashboard?.kpis||{};
  const silence=uaf.sectors.filter(r=>r.silence_5y).sort((a,b)=>v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025));
  const low=v0194SignalCount(uaf,'low'),down=v0194SignalCount(uaf,'down');
  const cross3=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0),sanctioned=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0);
  return `<div class="v0194-uaf-env"><div class="v0194-uaf-head"><div><span>Ambiente UAF</span><h3>Registro, reportabilidad y silencios</h3></div><button type="button" class="v0194-text-action" data-home-view="uaf">Abrir inteligencia UAF →</button></div><div class="v0194-uaf-grid"><div><span>SO último corte</span><b>${v019Fmt(dash.registered_total_latest)}</b><small>${esc(dash.registered_total_as_of||'vigente')}</small></div><div><span>Base comparable 2025</span><b>${v019Fmt(totals.registered_so_2025)}</b><small>denominador reportabilidad</small></div><div class="signal"><span>Silencio ROS 5 años</span><b>${v019Fmt(silence.length)}</b><small>sectores</small></div><div><span>Q1 intensidad ROS</span><b>${v019Fmt(low)}</b><small>sectores comparables</small></div></div><div class="v0202-mini-alerts">${silence.slice(0,3).map(r=>`<button type="button" class="v0202-mini-alert" data-v0202-uaf-sector="${esc(r.sector_name)}">${v0202OriginStrip(['RADAR_UAF'])}<div><div class="v0202-alert-meta">${v0202SourceBadges(['RADAR_UAF'])}<span class="v0202-type-badge">Alerta reportabilidad</span></div><b>${esc(v019Truncate(r.sector_name,56))}</b><small>${v019Fmt(r.registered_so_2025)} SO · 0 ROS agregados 2021–2025</small></div></button>`).join('')}</div><div class="v0194-uaf-foot"><span><b>${v019Fmt(down)}</b> sectores con caída ROS ≥30%</span><span><b>${v019Fmt(cross3)}</b> SO con convergencia 3+ fuentes</span><span><b>${v019Fmt(sanctioned)}</b> SO con sanciones</span></div><div class="v019-note warn"><b>Lectura correcta:</b> silencio sectorial o baja intensidad no equivalen a incumplimiento.</div></div>`;
};

/* Budget preview follows the same alert standard */
v020Budget=function(a){
  const b=a.budget;V0202_BUDGET=b;
  if(!b||b.error)return '<div class="v019-empty">Preview de Presupuesto Abierto no disponible.</div>';
  return `<div class="v0202-budget-standard"><div class="v0202-budget-kpis"><span><b>${v019Fmt(b.metrics?.priority_p1)}</b>P1</span><span><b>${v019Fmt(b.metrics?.signals)}</b>señales</span><span><b>${v019Fmt(b.metrics?.cgr_candidate_links)}</b>cruces CGR</span></div><div class="v0202-mini-alerts">${v019Array(b.top_signals).slice(0,4).map((s,i)=>`<button type="button" class="v0202-mini-alert" data-v0202-budget="${i}">${v0202OriginStrip(['PRESUPUESTO_ABIERTO'])}<div><div class="v0202-alert-meta">${v0202SourceBadges(['PRESUPUESTO_ABIERTO'])}<span class="v0202-type-badge">Alerta gasto público</span></div><b>${esc(v019Truncate(s.provider_or_recipient_name||s.organization_name||'Señal',60))}</b><small>${esc(v019Truncate(s.why_flagged||s.signal_type||'Patrón de gasto para revisión',110))}</small></div><strong>${v019Fmt(s.investigation_priority_score)}</strong></button>`).join('')}</div><div class="v0202-preview-note">Preview no canónico: las señales aún no son hallazgos Fusion.</div></div>`;
};

if(!window.__V0202_ALERT_EVENTS){
  window.__V0202_ALERT_EVENTS=true;
  document.addEventListener('click',async e=>{
    const fbtn=e.target.closest('[data-v0202-finding]');
    if(fbtn){const f=V0202_FINDINGS.get(fbtn.dataset.v0202Finding);if(f){e.preventDefault();v019OpenFinding(f);}return;}
    const ubtn=e.target.closest('[data-v0202-uaf-sector]');
    if(ubtn){e.preventDefault();const uaf=await v0193LoadUafData();await v019LoadUaf();setTimeout(()=>v0193OpenSector(ubtn.dataset.v0202UafSector,uaf),0);return;}
    const bbtn=e.target.closest('[data-v0202-budget]');
    if(bbtn&&V0202_BUDGET){e.preventDefault();v020OpenBudgetSignal(v020Num(bbtn.dataset.v0202Budget),V0202_BUDGET);}
  });
}
