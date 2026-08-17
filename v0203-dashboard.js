'use strict';

/* AML Workbench v0.20.3
 * 1) Radar restores UAF monitoring as a first-class operational panel.
 * 2) Priority alerts are compact without reducing legibility.
 * 3) Entity 360 becomes indicator/chart first, with interactive tabs.
 * 4) Existing source-colour alert language from v0.20.2 is preserved.
 */

const V0203='0.20.3';
const v0203BaseShell=shell;

shell=function(title,subtitle){
  v0203BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0203}`;
};

function v0203Pct(a,b,d=1){
  const den=Number(b),num=Number(a);
  return Number.isFinite(num)&&Number.isFinite(den)&&den>0?`${(100*num/den).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';
}
function v0203Delta(a,b){
  const aa=Number(a),bb=Number(b);
  return Number.isFinite(aa)&&Number.isFinite(bb)&&bb!==0?100*(aa-bb)/bb:null;
}
function v0203UniqueEvidence(findings){
  const ids=new Set();
  for(const f of findings||[])for(const id of v019Array(f.payload?.evidence_ids))if(id)ids.add(String(id));
  if(ids.size)return ids.size;
  return (findings||[]).reduce((a,f)=>a+v019Num(f.evidence_count),0);
}
function v0203EntitySources(e,findings,sanctions,taxRows){
  const ids=[];
  const add=v=>{if(v&&!ids.includes(v))ids.push(v);};
  for(const f of findings||[])for(const p of v019Array(f.payload?.producer_ids))add(String(p));
  for(const p of v019Array(e?.profile?.fuentes))add(typeof p==='string'?p:(p?.producer_id||p?.id));
  if(e?.is_uaf_observed)add('RADAR_UAF');
  if((taxRows||[]).length)add('RADAR_SII');
  if((sanctions||[]).length)add('RADAR_SANCIONES');
  return ids;
}

function v0203CrossRow(id,count,total){
  const src=v0202Source(id),pct=v0203Pct(count,total);
  return `<div class="v0203-cross-row"><div>${v0202SourceBadges([id])}<span>${esc(src.label)}</span></div><progress class="${esc(src.cls)}" max="${Math.max(1,v019Num(total))}" value="${v019Num(count)}"></progress><b>${v019Fmt(count)}</b><small>${pct}</small></div>`;
}

function v0203UafMonitor(core,uaf){
  const totals=uaf.report?.totals||{},dash=uaf.dashboard?.kpis||{};
  const total=v019Num(dash.registered_total_latest)||core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0);
  const cross=new Map(core.uafCross.map(r=>[String(r.radar_id),v019Num(r.uaf_entities)]));
  const three=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0);
  const sanctioned=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0);
  const silence=uaf.sectors.filter(r=>r.silence_5y).sort((a,b)=>v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025));
  const low=uaf.sectors.filter(r=>v0193Flags(r,uaf).some(x=>x.k==='low')).length;
  const down=uaf.sectors.filter(r=>v0193Flags(r,uaf).some(x=>x.k==='down')).length;
  const ros=[2021,2022,2023,2024,2025].map(year=>({year,ros:v019Num(totals[`ros_${year}`])}));
  const rosDelta=v0203Delta(totals.ros_2025,totals.ros_2024);
  const rows=['RADAR_SII','RADAR_SANCIONES','RADAR_OSFL','RADAR_PRENSA'];
  return `<div class="v0203-uaf-monitor">
    <div class="v0203-card-title"><div><span>MONITOREO UAF</span><h2>Qué está pasando con los SO inscritos</h2><p>Registro, reportabilidad y presencia del universo UAF en otros contextos materializados.</p></div><button type="button" class="v0203-link" data-home-view="uaf">Abrir Inteligencia UAF →</button></div>
    <div class="v0203-uaf-kpis">
      <div><span>SO inscritos</span><b>${v019Fmt(total)}</b><small>${esc(dash.registered_total_as_of||'último corte')}</small></div>
      <div><span>También observados en SII</span><b>${v019Fmt(cross.get('RADAR_SII')||0)}</b><small>${v0203Pct(cross.get('RADAR_SII')||0,total)} del universo UAF</small></div>
      <div><span>Con 3+ fuentes</span><b>${v019Fmt(three)}</b><small>${v0203Pct(three,total)} · convergencia</small></div>
      <div><span>Con sanciones</span><b>${v019Fmt(sanctioned)}</b><small>${v0203Pct(sanctioned,total)} · contexto administrativo</small></div>
    </div>
    <div class="v0203-uaf-grid">
      <section><div class="v0203-subhead"><b>SO UAF en otros radares</b><span>conteo y proporción</span></div><div class="v0203-cross-list">${rows.map(id=>v0203CrossRow(id,cross.get(id)||0,total)).join('')}</div></section>
      <section><div class="v0203-subhead"><b>ROS recibidos</b><span>${rosDelta==null?'—':v0193Pct(rosDelta)} 2025 vs 2024</span></div>${v020LineChart(ros,'year','ros')}</section>
    </div>
    <div class="v0203-uaf-alerts">
      <div><span>Silencio ROS 5 años</span><b>${v019Fmt(silence.length)}</b><small>sectores · señal agregada</small></div>
      <div><span>Q1 intensidad ROS</span><b>${v019Fmt(low)}</b><small>sectores comparables</small></div>
      <div><span>Caída ROS ≥30%</span><b>${v019Fmt(down)}</b><small>2025 vs 2024</small></div>
      ${silence[0]?`<button type="button" data-v0203-uaf-sector="${esc(silence[0].sector_name)}"><span>Mayor silencio por universo</span><b>${esc(v019Truncate(silence[0].sector_name,34))}</b><small>${v019Fmt(silence[0].registered_so_2025)} SO · abrir sector</small></button>`:''}
    </div>
    <div class="v0203-guard">Los cruces muestran presencia observable del mismo SO en otros productores. No transmiten riesgo entre fuentes ni convierten contexto en señal AML.</div>
  </div>`;
}

function v0203FindingMix(rows){
  const data=(rows||[]).slice(0,5),max=Math.max(...data.map(r=>v019Num(r.finding_count)),1);
  return `<div class="v0203-mix">${data.map(r=>`<div><span>${esc(v019FindingType(r.finding_type))}</span><progress max="${max}" value="${v019Num(r.finding_count)}"></progress><b>${v019Fmt(r.finding_count)}</b><small>IPA prom. ${v019Fmt(r.avg_ipa,1)}</small></div>`).join('')}</div>`;
}

v019LoadOverview=async function(){
  state.view='overview';
  shell('Radar integrado','Entrada ejecutiva: alertas concretas, monitoreo UAF y contexto para decidir dónde profundizar.');
  try{
    const [core,uaf,meta,a]=await Promise.all([v019LoadCore(),v0193LoadUafData(),v0194HomeMeta(),v020LoadAnalytics()]);
    const priority=v0194NonUafFindings(core).filter(f=>f.entity_id).slice(0,5);
    const uafTotal=v019Num(uaf.dashboard?.kpis?.registered_total_latest)||core.uafRegions.reduce((x,r)=>x+v019Num(r.uaf_observed),0);
    const cross3=core.uafRegions.reduce((x,r)=>x+v019Num(r.uaf_three_plus_sources),0);
    const sanc=core.uafRegions.reduce((x,r)=>x+v019Num(r.uaf_sanctioned),0);
    v019Content().innerHTML=`
      <section class="v0203-topline">
        <div><span>Hallazgos materializados</span><b>${v019Fmt(meta.findings)}</b></div>
        <div class="uaf"><span>SO inscritos UAF</span><b>${v019Fmt(uafTotal)}</b></div>
        <div class="uaf"><span>SO con 3+ fuentes</span><b>${v019Fmt(cross3)}</b></div>
        <div class="san"><span>SO con sanciones</span><b>${v019Fmt(sanc)}</b></div>
        <div><span>Entidades Fusion</span><b>${v019Fmt(meta.entities)}</b></div>
      </section>
      <section class="v0203-main-grid">
        <article class="v019-card v0203-priority-card"><div class="v019-card-head"><div><h2>Qué revisar primero</h2><p>Cinco alertas concretas. El color identifica el origen; el IPA sólo ordena.</p></div><span class="hint">clic → detalle</span></div>${v0202FindingList(priority,5)}</article>
        <article class="v019-card v0203-uaf-card">${v0203UafMonitor(core,uaf)}</article>
      </section>
      <section class="v0203-chart-grid">
        <article class="v019-card"><div class="v019-card-head"><div><h2>Composición de hallazgos</h2><p>Qué clases de hallazgo dominan el corte y su IPA promedio.</p></div></div>${v0203FindingMix(a.mix)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Sanciones en el tiempo</h2><p>Eventos administrativos materializados y subconjunto LA/FT directo.</p></div><span class="hint">2026 parcial</span></div>${v020SanctionChart(a.sanYears)}</article>
        <article class="v019-card v0203-budget-card"><div class="v019-card-head"><div><h2>Gasto público</h2><p>Señales tempranas de Presupuesto Abierto mientras se completa Fusion.</p></div><span class="hint">preview</span></div>${v020Budget(a)}</article>
      </section>
      <section class="v019-card v0203-entry"><div class="v019-card-head"><div><h2>Entrar al análisis</h2><p>La portada orienta; cada módulo conserva el detalle y la trazabilidad.</p></div></div>${v020Entry(meta,uaf,a)}</section>
      <section class="v0203-context-grid">
        <article class="v019-card"><div class="v019-card-head"><div><h2>Fenómenos</h2><p>Patrones comparativos no regulatorios.</p></div></div>${v020PatternFamilies(a.families)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Economía y prensa</h2><p>Contexto explicativo que no incrementa scores AML.</p></div></div>${v0194Context(core)}</article>
      </section>`;
    v020Bind(core,uaf,a);
    document.querySelectorAll('[data-v0203-uaf-sector]').forEach(btn=>btn.addEventListener('click',async()=>{await v019LoadUaf();setTimeout(()=>v0193OpenSector(btn.dataset.v0203UafSector,uaf),0);}));
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};
loadOverview=v019LoadOverview;

function v0203FindingMetrics(findings){
  const keys=[['Inusualidad','unusualness'],['Convergencia','convergence'],['Evidencia','evidence_strength'],['Cambio temporal','temporal_change'],['Red','network']];
  return keys.map(([label,key])=>{
    const vals=(findings||[]).map(f=>Number(f.payload?.metrics?.[key])).filter(Number.isFinite);
    return [label,vals.length?Math.max(...vals):0];
  }).filter(([,v])=>v>0);
}
function v0203MetricBars(findings){
  const rows=v0203FindingMetrics(findings);
  if(!rows.length)return '<div class="v019-empty">Sin dimensiones analíticas materializadas.</div>';
  return `<div class="v0203-metric-bars">${rows.map(([label,v])=>`<div><span>${esc(label)}</span><progress max="100" value="${Math.max(0,Math.min(100,v))}"></progress><b>${v019Fmt(v,0)}</b></div>`).join('')}</div><div class="v0203-micro-note">Escalas comparativas 0–100; no representan probabilidad de LA/FT.</div>`;
}
function v0203SourceChart(e,findings,sanctions,taxRows){
  const sources=v0203EntitySources(e,findings,sanctions,taxRows);
  const counts=sources.map(id=>{
    let n=(findings||[]).filter(f=>v019Array(f.payload?.producer_ids).includes(id)).length;
    if(id==='RADAR_SANCIONES')n=Math.max(n,(sanctions||[]).length);
    if(id==='RADAR_SII'&&(taxRows||[]).length)n=Math.max(n,1);
    if(id==='RADAR_UAF'&&e.is_uaf_observed)n=Math.max(n,1);
    return {id,n};
  });
  const max=Math.max(...counts.map(x=>x.n),1);
  return `<div class="v0203-source-chart">${counts.map(x=>{const s=v0202Source(x.id);return `<div><div>${v0202SourceBadges([x.id])}</div><progress class="${esc(s.cls)}" max="${max}" value="${x.n}"></progress><b>${v019Fmt(x.n)}</b></div>`;}).join('')}</div><div class="v0203-micro-note">Longitud = cantidad de hallazgos/eventos asociados a la fuente en esta ficha; una fuente presente no implica señal adversa.</div>`;
}
function v0203TaxChart(rows){
  if(!rows?.length)return '<div class="v019-empty">Sin perfil tributario materializado.</div>';
  const data=[...rows].sort((a,b)=>v019Num(a.commercial_year)-v019Num(b.commercial_year));
  const maxWorkers=Math.max(...data.map(r=>v019Num(r.workers_numeric)),1);
  return `<div class="v0203-tax-chart">${data.map(r=>`<div class="v0203-tax-year"><b>${esc(String(r.commercial_year||'—'))}</b><div><span>Tramo ventas</span><progress class="sales" max="13" value="${Math.max(0,Math.min(13,v019Num(r.sales_band_rank||r.sales_band_code)))}"></progress><strong>${esc(String(r.sales_band_code||'—'))}</strong></div><div><span>Trabajadores</span><progress class="workers" max="${maxWorkers}" value="${v019Num(r.workers_numeric)}"></progress><strong>${v019Fmt(r.workers_numeric)}</strong></div></div>`).join('')}</div>`;
}
function v0203TaxSnapshot(tax){
  if(!tax)return '';
  const regions=v0201Unique(v0201SplitPipe(tax.address_regions)).length;
  return `<div class="v0203-mini-kpis"><div><span>Actividades</span><b>${v019Fmt(tax.activity_count)}</b></div><div><span>Domicilios históricos</span><b>${v019Fmt(tax.address_count)}</b></div><div><span>Regiones históricas</span><b>${v019Fmt(regions)}</b></div><div><span>Señales SII</span><b>${v019Fmt(tax.signal_count)}</b></div></div>`;
}
function v0203UafSectorMatch(uaf,sector){
  const target=v0201Norm(sector);
  if(!target)return null;
  return uaf.sectors.find(r=>v0201Norm(r.sector_name)===target)||uaf.sectors.find(r=>v0201Norm(r.sector_name).includes(target)||target.includes(v0201Norm(r.sector_name)))||null;
}
function v0203UafEntityPanel(e,sector,uaf){
  if(!e.is_uaf_observed)return '<div class="v019-empty">La entidad no está marcada como SO inscrito en el corte UAF materializado.</div>';
  const row=v0203UafSectorMatch(uaf,sector);
  if(!row)return `<div class="v0203-uaf-entity"><div class="v0203-uaf-entity-head">${v0202SourceBadges(['RADAR_UAF'])}<b>SO inscrito en la UAF</b></div><p>No fue posible vincular el sector materializado con la serie agregada 2021–2025.</p></div>`;
  const ros=[2021,2022,2023,2024,2025].map(year=>({year,ros:v019Num(row[`ros_${year}`])}));
  const flags=v0193Flags(row,uaf);
  return `<div class="v0203-uaf-entity"><div class="v0203-uaf-entity-head">${v0202SourceBadges(['RADAR_UAF'])}<div><b>${esc(row.sector_name)}</b><span>Contexto agregado del sector, no conducta individual</span></div></div><div class="v0203-mini-kpis"><div><span>SO sector 2025</span><b>${v019Fmt(row.registered_so_2025)}</b></div><div><span>ROS 2025</span><b>${v019Fmt(row.ros_2025)}</b></div><div><span>ROS / 100 SO</span><b>${v019Fmt(row.ros_per_100_so_2025,1)}</b></div><div><span>ROS 5 años</span><b>${v019Fmt(row.ros_total_2021_2025)}</b></div></div>${v020LineChart(ros,'year','ros')}<div class="v0203-flag-row">${flags.map(x=>`<span class="${esc(x.k)}">${esc(x.label)}</span>`).join('')||'<span class="neutral">Sin señal comparativa destacada</span>'}</div><button type="button" class="v0203-link" data-v0203-open-sector="${esc(row.sector_name)}">Abrir detalle sector UAF →</button></div>`;
}
function v0203SanctionTimeline(rows){
  if(!rows?.length)return '<div class="v019-empty">Sin eventos sancionatorios vinculados.</div>';
  return `<div class="v0203-timeline">${rows.slice(0,10).map(s=>{const a=s.payload?.attributes||{};return `<article><time>${fmtDate(s.event_date)}</time><span class="dot"></span><div><b>${esc(s.regulator||a.supervisor||'Supervisor')}</b><p>${esc(v019Truncate(a.category||s.subject||'Evento administrativo',145))}</p>${s.laft_direct?'<small class="direct">Clasificación LA/FT directa materializada</small>':'<small>Contexto administrativo</small>'}</div></article>`;}).join('')}</div>`;
}
function v0203ContextFacts(e,tax,reporting){
  const rel=v019Array(e.profile?.relaciones);
  return `<div class="v0203-context-facts"><div><span>RUT</span><b>${esc(e.rut||'—')}</b></div><div><span>Región</span><b>${esc(e.region||tax?.region||'—')}</b></div><div><span>Comuna</span><b>${esc(e.commune||tax?.commune||'—')}</b></div><div><span>Inicio actividad</span><b>${esc(tax?.activity_start_date||'—')}</b></div><div><span>Actividad principal</span><b>${esc(v019Truncate(tax?.main_activity||'—',72))}</b></div><div><span>Relaciones observadas</span><b>${v019Fmt(rel.length)}</b></div>${reporting?`<div><span>ROE</span><b>${esc(reporting.roe_frequency||'Regla materializada')}</b></div><div><span>Base regulatoria</span><b>${esc(v019Truncate(reporting.legal_basis||'—',65))}</b></div>`:''}</div>`;
}
function v0203FindSector(findings){
  for(const f of findings||[]){const s=v019Array(f.payload?.sector_names).find(Boolean);if(s)return s;}
  return null;
}
function v0203FindReporting(rules,sector){
  const n=v0201Norm(sector);
  return (rules||[]).find(r=>v0201Norm(r.sector_name)===n)||(rules||[]).find(r=>n&&v0201Norm(r.sector_name).includes(n))||null;
}

async function v0203OpenEntity(entityId){
  state.selectedEntity=entityId;
  shell('Entity 360','Perfil interactivo: indicadores, trayectoria observable, alertas y contexto regulatorio.');
  try{
    const [entityRes,findingsRes,sanctionsRes,patternsRes,taxRes,rulesRes,uaf]=await Promise.all([
      sb.from('aml_entities').select('*').eq('entity_id',entityId).maybeSingle(),
      sb.from('aml_findings').select('finding_key,finding_id,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,snapshot_id,updated_at,payload').eq('entity_id',entityId).order('score_investigate',{ascending:false,nullsFirst:false}).limit(100),
      sb.from('aml_sanctions').select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,laft_direct,amount_uf,subject,snapshot_id,updated_at,payload').eq('entity_id',entityId).order('event_date',{ascending:false,nullsFirst:false}).limit(100),
      sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,snapshot_id,updated_at,payload').eq('scope_id',entityId).order('strength',{ascending:false,nullsFirst:false}).limit(100),
      sb.from('aml_entity_tax_profile').select('entity_id,commercial_year,sales_band,sales_band_code,sales_band_rank,workers_numeric,region,commune,economic_sector,economic_subsector,main_activity,taxpayer_type,taxpayer_subtype,current_status,activity_start_date,activity_count,activity_codes,activity_names,address_count,current_address_count,address_regions,communes,ownership_edge_count,legal_entity_partner_count,societies_as_partner_count,signal_count,signal_types').eq('entity_id',entityId).order('commercial_year',{ascending:true,nullsFirst:false}),
      sb.from('aml_reporting_rules').select('sector_name,sector_group,ros_required,ros_trigger,roe_required,roe_frequency,roe_threshold_usd,roe_deadline,legal_basis'),
      v0193LoadUafData()
    ]);
    for(const q of [entityRes,findingsRes,sanctionsRes,patternsRes,taxRes,rulesRes])if(q.error)throw q.error;
    const e=entityRes.data;if(!e)throw new Error('Entidad no disponible bajo la política actual.');
    const findings=findingsRes.data||[],sanctions=sanctionsRes.data||[],patterns=patternsRes.data||[],taxRows=taxRes.data||[],tax=taxRows.at(-1)||null;
    const sector=v0203FindSector(findings),reporting=v0203FindReporting(rulesRes.data||[],sector);
    await audit('OPEN_ENTITY',{objectType:'entity',objectId:entityId,payload:{findings:findings.length,sanctions:sanctions.length,view:'v0203'}});
    V17_ENTITY_CACHE=v17NormalizeEntityPackage(e,findings,sanctions,patterns,tax,sector,reporting,[]);
    v0203RenderEntity({e,findings,sanctions,patterns,taxRows,tax,sector,reporting,uaf});
  }catch(e){showContentError(e);}
}
openEntity=v0203OpenEntity;

function v0203RenderEntity(pkg){
  const {e,findings,sanctions,patterns,taxRows,tax,sector,reporting,uaf}=pkg;
  const scores=findings.map(f=>Number(f.score_investigate)).filter(Number.isFinite),maxIPA=scores.length?Math.max(...scores):null;
  const evidence=v0203UniqueEvidence(findings),sources=v0203EntitySources(e,findings,sanctions,taxRows);
  const anomalies=Math.max(0,...findings.filter(f=>f.finding_type==='CONTEXTUAL_ANOMALY').map(f=>v019Num(f.payload?.decision_facts?.contextual_anomalies)||1),v019Num(tax?.signal_count));
  const amlSignals=findings.filter(f=>f.finding_type==='GOVERNED_AML_SIGNAL'||f.finding_type==='DIRECT_AML_SIGNAL').length;
  const priority=maxIPA==null?'—':v019Fmt(maxIPA,1);
  const topFindings=findings.slice(0,4);
  v019Content().innerHTML=`<div class="v0203-entity">
    <div class="v0203-entity-command"><button type="button" class="v0203-back" id="v0203-back">← Entidades</button><div>${e.is_uaf_observed?'<span class="v0203-status uaf">SO inscrito en la UAF</span>':''}${sanctions.length?'<span class="v0203-status san">Con sanciones</span>':''}<button type="button" class="v0203-export" id="v0203-export">Exportar JSON</button></div></div>
    <section class="v0203-entity-hero"><div><span>${esc(e.entity_type||e.profile?.tipo_entidad_es||'Entidad')}</span><h1>${esc(e.name)}</h1><p>${esc(e.rut||e.entity_id)} · ${esc(e.commune||e.region||'Sin territorio')}</p>${v0202SourceBadges(sources)}</div><div class="v0203-hero-score"><b>${priority}</b><span>IPA máximo</span><small>prioridad de revisión</small></div></section>
    <section class="v0203-entity-kpis"><div><span>Hallazgos</span><b>${v019Fmt(findings.length)}</b></div><div><span>Evidencias</span><b>${v019Fmt(evidence)}</b></div><div><span>Fuentes</span><b>${v019Fmt(sources.length||e.source_count)}</b></div><div><span>Anomalías</span><b>${v019Fmt(anomalies)}</b></div><div><span>Sanciones</span><b>${v019Fmt(sanctions.length)}</b></div><div><span>Señales AML</span><b>${v019Fmt(amlSignals)}</b></div></section>
    <nav class="v0203-tabs" aria-label="Secciones Entity 360"><button type="button" class="active" data-v0203-tab="summary">Resumen</button><button type="button" data-v0203-tab="alerts">Alertas <span>${v019Fmt(findings.length)}</span></button><button type="button" data-v0203-tab="sanctions">Sanciones <span>${v019Fmt(sanctions.length)}</span></button><button type="button" data-v0203-tab="context">Datos y contexto</button></nav>
    <section class="v0203-tab-panel active" data-v0203-panel="summary">
      <div class="v0203-entity-grid">
        <article class="v019-card"><div class="v019-card-head"><div><h2>Perfil analítico</h2><p>Dimensiones máximas observadas en los hallazgos de esta entidad.</p></div></div>${v0203MetricBars(findings)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Cobertura por fuente</h2><p>Qué productores aportan hechos o contexto a la ficha.</p></div></div>${v0203SourceChart(e,findings,sanctions,taxRows)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Perfil SII</h2><p>Ventas y trabajadores por año comercial disponible.</p></div></div>${v0203TaxChart(taxRows)}${v0203TaxSnapshot(tax)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Contexto UAF del sector</h2><p>Reportabilidad agregada del sector; no se atribuye a la entidad.</p></div></div>${v0203UafEntityPanel(e,sector,uaf)}</article>
      </div>
      <article class="v019-card v0203-top-alerts"><div class="v019-card-head"><div><h2>Alertas principales</h2><p>Los hechos más relevantes antes de abrir el detalle completo.</p></div><button type="button" class="v0203-link" data-v0203-goto="alerts">Ver todas →</button></div>${v0202FindingList(topFindings,4)}</article>
    </section>
    <section class="v0203-tab-panel" data-v0203-panel="alerts"><div class="v0203-alert-toolbar"><div><b>Alertas de la entidad</b><span>Filtra por productor sin perder la ficha.</span></div><div><button type="button" class="active" data-v0203-source="ALL">Todas</button>${sources.map(id=>`<button type="button" data-v0203-source="${esc(id)}">${esc(v0202Source(id).label)}</button>`).join('')}</div></div><div id="v0203-alert-results">${v0202FindingList(findings,100)}</div></section>
    <section class="v0203-tab-panel" data-v0203-panel="sanctions"><div class="v0203-entity-grid single"><article class="v019-card"><div class="v019-card-head"><div><h2>Línea de tiempo sancionatoria</h2><p>Materia, recurrencia y temporalidad de los eventos vinculados por identidad.</p></div></div>${v0203SanctionTimeline(sanctions)}</article></div></section>
    <section class="v0203-tab-panel" data-v0203-panel="context"><div class="v0203-entity-grid"><article class="v019-card"><div class="v019-card-head"><div><h2>Datos estructurales</h2><p>Información básica para interpretar las alertas.</p></div></div>${v0203ContextFacts(e,tax,reporting)}</article><article class="v019-card"><div class="v019-card-head"><div><h2>Patrones directos</h2><p>Fenómenos materializados directamente sobre este Entity ID.</p></div></div>${patterns.length?v17PatternCards(patterns):'<div class="v019-empty">Sin patrones directos.</div>'}</article></div></section>
    <div class="v0203-entity-foot">La ficha organiza hechos públicos y materializados. Contexto sectorial, territorial o relacional no se hereda como riesgo individual.</div>
  </div>`;
  v0203BindEntity(pkg);
}

function v0203BindEntity(pkg){
  const {e,findings,uaf}=pkg;
  document.querySelector('#v0203-back')?.addEventListener('click',loadEntities);
  document.querySelector('#v0203-export')?.addEventListener('click',async()=>{if(!V17_ENTITY_CACHE)return;await audit('EXPORT',{objectType:'entity_package',objectId:e.entity_id,payload:{format:'json',schema:'AML_ANALYST_TRANSFER_V1'}});v17Download(`aml_entity_${String(e.rut||e.entity_id).replace(/[^0-9A-Za-zKk-]/g,'_')}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(V17_ENTITY_CACHE,null,2),'application/json;charset=utf-8');});
  const activate=name=>{document.querySelectorAll('[data-v0203-tab]').forEach(b=>b.classList.toggle('active',b.dataset.v0203Tab===name));document.querySelectorAll('[data-v0203-panel]').forEach(p=>p.classList.toggle('active',p.dataset.v0203Panel===name));};
  document.querySelectorAll('[data-v0203-tab]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.v0203Tab)));
  document.querySelectorAll('[data-v0203-goto]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.v0203Goto)));
  document.querySelectorAll('[data-v0203-source]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.v0203Source;document.querySelectorAll('[data-v0203-source]').forEach(x=>x.classList.toggle('active',x===b));const rows=id==='ALL'?findings:findings.filter(f=>v019Array(f.payload?.producer_ids).includes(id));const box=document.querySelector('#v0203-alert-results');if(box)box.innerHTML=v0202FindingList(rows,100);}));
  document.querySelectorAll('[data-v0203-open-sector]').forEach(b=>b.addEventListener('click',async()=>{await v019LoadUaf();setTimeout(()=>v0193OpenSector(b.dataset.v0203OpenSector,uaf),0);}));
}

/* Ensure every finding drawer opens the new Entity 360, not the legacy captured function. */
v019OpenFinding=async function(f){
  if(!f)return;
  V0201_FINDING_MAP.set(f.finding_key||f.finding_id||String(Math.random()),f);
  v019OpenDrawer('<div class="v0201-loading"><b>Preparando lectura del hallazgo…</b><span>Buscando inusualidades y evidencia relacionada.</span></div>');
  let ctx;try{ctx=await v0201FindingContext(f);}catch{ctx={related:[f],tax:null,sanctions:[]};}
  const body=document.querySelector('#v019-drawer-body');if(!body)return;
  body.innerHTML=v0201FindingDrawerHtml(f,ctx);
  document.querySelector('#v0201-open-entity')?.addEventListener('click',()=>{v019CloseDrawer();openEntity(f.entity_id);});
  document.querySelector('#v0201-go-findings')?.addEventListener('click',()=>{v019CloseDrawer();if(typeof loadFindings==='function'){state.view='findings';loadFindings();}});
};
