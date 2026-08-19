'use strict';

/* AML Workbench v0.35.0 · Radar Integrado Command Center
 * UAF-first landing page. Removes the standalone Inteligencia UAF route from
 * primary navigation and absorbs its analytical readings into Radar Integrado.
 * No individual ROS/ROE history is inferred when it is not materialized.
 */
const V035='0.35.0';
const V035_BUILD='0350';
const V035_HELP={
  uaf_total:{title:'SO observados UAF',body:'Universo de sujetos obligados observado en el corte UAF materializado en Workbench. Es un stock de registro, no un indicador de riesgo.'},
  sii_coverage:{title:'Cobertura de conciliación UAF–SII',body:'Porcentaje de SO observados UAF que cuentan con perfil SII materializado. Incluye coincidencias activas y entidades con término de giro publicado. Una ausencia de perfil exige validar matching/cobertura antes de concluir.'},
  gap_screening:{title:'Screening de potenciales SO no inscritos',body:'Suma de pares RUT–actividad candidatos generados por los screenings de brecha supervisiva. No representa personas jurídicas únicas ni acredita falta de inscripción UAF. Sirve para priorizar validación y deduplicación.'},
  sii_active:{title:'Coincidencia activa UAF–SII',body:'SO observado UAF cuyo perfil tributario más reciente materializado no figura terminado en la publicación SII.'},
  sii_terminated:{title:'Término de giro publicado',body:'SO que permanece en el universo UAF observado y cuyo perfil SII materializado indica término de giro. Es una señal de conciliación/actualización administrativa, no una conclusión de incumplimiento.'},
  sii_missing:{title:'Sin perfil SII materializado',body:'SO observado UAF sin fila disponible en el perfil tributario materializado. No significa que el RUT no exista en SII; requiere validación de identidad, cobertura y matching.'},
  gap_sector:{title:'Volumen de screening por sector',body:'Distribuye los pares RUT–actividad candidatos por sector económico UAF. El volumen ayuda a orientar revisión; no equivale a número de entidades únicas.'},
  ros_total:{title:'ROS recibidos 2025',body:'Total agregado de Reportes de Operaciones Sospechosas materializados para 2025 en Radar UAF. Un ROS es un flujo de reportabilidad; no se interpreta como cantidad de delitos ni de sujetos distintos.'},
  silence:{title:'Silencio ROS persistente',body:'Sector con sujetos obligados inscritos y cero ROS agregados en cada año 2021–2025. Es una marca de revisión sectorial. No permite concluir silencio individual de un SO ni incumplimiento.'},
  intensity:{title:'Intensidad ROS',body:'ROS 2025 por cada 100 SO inscritos del mismo sector y corte. La mediana se calcula entre sectores comparables. Permite comparar flujo relativo sin confundir tamaño de industria con reportabilidad.'},
  concentration:{title:'Concentración Top 5',body:'Participación de los cinco sectores con mayor número de ROS 2025 sobre el total sectorial materializado. Una alta concentración describe distribución de reportes; no implica por sí sola mayor o menor riesgo LA/FT.'},
  silence_matrix:{title:'Matriz de silencio e intensidad',body:'Ordena sectores priorizando silencio persistente, intensidad relativa baja y caídas relevantes. El tamaño sectorial se muestra junto a intensidad y variación para evitar comparar solo volúmenes absolutos.'},
  concentration_lens:{title:'Lente de concentración',body:'Muestra la participación de los principales sectores en los ROS 2025. Cada fila puede abrir la ficha sectorial UAF para revisar serie, reglas ROS/ROE y marcas analíticas.'},
  subject_focus:{title:'SO en foco',body:'Fichas individuales construidas desde conciliación UAF–SII y señales Fusion. Workbench no posee en este corte eventos ROS/ROE individualizados por sujeto obligado; por eso la ficha solo hereda contexto sectorial de reportabilidad y lo declara explícitamente.'},
  sanctions:{title:'Pulso de sanciones',body:'Eventos sancionatorios del último año disponible en la serie materializada. El detalle mantiene regulador, entidad, fecha y flag LA/FT cuando está respaldado documentalmente.'},
  territory:{title:'Atención territorial',body:'Índice territorial de atención ya calculado por Workbench para ordenar exploración geográfica. Es prioridad comparativa y no probabilidad de delito. La ficha abre la sección Territorio para explicar sus componentes.'},
  budget:{title:'Gasto público · P1',body:'Cantidad de señales de prioridad P1 del preview de Presupuesto Abierto. Mientras el adaptador canónico no esté completo, estas señales conservan la semántica del radar y no se cuentan como hallazgos Fusion.'},
  osfl:{title:'OSFL con IPA3 activo',body:'Organizaciones del universo OSFL con IPA3 mayor que cero en la capa shadow vigente. La condición OSFL y el cribado FATF R.8 son contexto; el score ordena revisión y no representa probabilidad de LA/FT.'},
  cgr:{title:'Hallazgos CGR materializados',body:'Hallazgos Fusion atribuidos al productor RADAR_CGR. El conteo indica evidencia disponible en Workbench; la relevancia de cada hallazgo debe revisarse en su ficha y evidencia fuente.'},
  press:{title:'Momentum de prensa',body:'Mayor razón reciente versus baseline entre fenómenos de prensa gobernados. Prensa es contexto: describe cambio de cobertura periodística y no incrementa por sí sola los scores AML.'},
  priority:{title:'Qué revisar primero',body:'Cola de hallazgos individualizables ordenada por prioridad investigativa ya materializada. La prioridad combina evidencia gobernada y no equivale a probabilidad de delito.'}
};

const v035BaseShell=shell;
const v035BaseNavigate=navigate;
const v035BaseRecon=typeof v0205LoadReconciliation==='function'?v0205LoadReconciliation:null;

function v035Fmt(v,d=0){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function v035Pct(n,d,dec=1){const a=Number(n),b=Number(d);return Number.isFinite(a)&&Number.isFinite(b)&&b>0?`${(100*a/b).toLocaleString('es-CL',{minimumFractionDigits:dec,maximumFractionDigits:dec})}%`:'—';}
function v035Norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function v035Help(key){const h=V035_HELP[key];return h?`<button type="button" class="v035-help" data-v035-help="${esc(key)}" aria-label="Ayuda: ${esc(h.title)}">?</button>`:'';}
function v035HelpLabel(label,key){return `<span class="v035-label-with-help"><span>${esc(label)}</span>${v035Help(key)}</span>`;}
function v035Unavailable(){return typeof v024Unavailable==='function'?v024Unavailable():[];}
function v035Safe(result,fallback){return result?.status==='fulfilled'?result.value:fallback;}
function v035ProducerMap(analytics){return new Map(v019Array(analytics?.producers).map(p=>[String(p.producer_id),p]));}

function v035PruneUafNav(){
  document.querySelectorAll('.v019-nav [data-view="uaf"],.nav [data-view="uaf"]').forEach(el=>el.remove());
}

shell=function(...args){
  const result=v035BaseShell(...args);
  v035PruneUafNav();
  return result;
};

navigate=async function(view,...args){
  if(view==='uaf')return v019LoadOverview();
  return v035BaseNavigate(view,...args);
};

if(v035BaseRecon){
  v0205LoadReconciliation=async function(...args){
    const result=await v035BaseRecon(...args);
    document.querySelectorAll('[data-v0205-back="uaf"]').forEach(el=>el.remove());
    v035PruneUafNav();
    return result;
  };
}

async function v035LoadFocusEntities(){
  const {data,error}=await sb.from('aml_v0210_uaf_sii_reconciliation')
    .select('entity_id,rut,resolved_name,uaf_category_hint,uaf_sector_label,reconciliation_status,reconciliation_label,operational_priority,termination_date,main_activity,finding_count,sanction_count,max_finding_sources,fusion_region,fusion_commune')
    .in('reconciliation_status',['SII_TERMINATED','NO_SII_PROFILE'])
    .order('operational_priority',{ascending:true})
    .order('sanction_count',{ascending:false})
    .order('finding_count',{ascending:false})
    .order('resolved_name',{ascending:true,nullsFirst:false})
    .limit(8);
  if(error)throw error;
  return data||[];
}

function v035SectorReport(label,uaf){
  if(!label)return null;
  const labels=String(label).split('·').map(v=>v.trim()).filter(Boolean);
  return v019Array(uaf?.sectors).find(row=>labels.some(x=>typeof v0193SectorMatch==='function'?v0193SectorMatch(x,row.sector_name):v035Norm(x)===v035Norm(row.sector_name)))||null;
}

function v035SectorFlags(row,uaf){
  if(!row)return [];
  if(typeof v0193Flags==='function')return v0193Flags(row,uaf);
  const out=[];
  if(row.silence_5y)out.push({k:'silence',label:'Silencio ROS 5 años'});
  const d=Number(row.delta_ros_2025_vs_2024_pct);
  if(Number.isFinite(d)&&d<=-30)out.push({k:'down',label:'Caída ≥30%'});
  return out;
}

function v035ReconRail(counts){
  const c=counts||{total:0,active:0,terminated:0,noSii:0,matched:0};
  const total=Math.max(1,v019Num(c.total));
  return `<section class="v035-recon-rail-card">
    <div class="v035-card-head"><div><span>CONCILIACIÓN OPERATIVA</span><h3>UAF ↔ SII en una sola lectura</h3><p>Estado tributario materializado para el universo observado UAF.</p></div>${v035Help('sii_coverage')}</div>
    <div class="v035-recon-rail" role="group" aria-label="Estado de conciliación UAF SII">
      <button type="button" class="active" data-v035-recon="active"><span>${v035HelpLabel('Activos','sii_active')}</span><b>${v035Fmt(c.active)}</b><progress max="${total}" value="${v019Num(c.active)}"></progress><small>${v035Pct(c.active,total)}</small></button>
      <button type="button" class="terminated" data-v035-recon="terminated"><span>${v035HelpLabel('Término de giro','sii_terminated')}</span><b>${v035Fmt(c.terminated)}</b><progress max="${total}" value="${v019Num(c.terminated)}"></progress><small>${v035Pct(c.terminated,total)}</small></button>
      <button type="button" class="missing" data-v035-recon="unmatched"><span>${v035HelpLabel('Sin perfil SII','sii_missing')}</span><b>${v035Fmt(c.noSii)}</b><progress max="${total}" value="${v019Num(c.noSii)}"></progress><small>${v035Pct(c.noSii,total)}</small></button>
    </div>
    <div class="v035-recon-foot"><span>Selecciona un estado para abrir la conciliación entidad a entidad.</span><button type="button" data-v035-recon="review">Ver casos a revisar →</button></div>
  </section>`;
}

function v035GapSectors(core){
  const rows=v019Array(core?.gapSectors).slice().sort((a,b)=>v019Num(b.candidate_pairs)-v019Num(a.candidate_pairs)).slice(0,7);
  const max=Math.max(1,...rows.map(r=>v019Num(r.candidate_pairs)));
  return `<section class="v035-gap-card">
    <div class="v035-card-head"><div><span>SCREENING SUPERVISIVO</span><h3>Dónde aparece la brecha potencial</h3><p>Volumen de pares candidatos por sector; no personas únicas.</p></div>${v035Help('gap_sector')}</div>
    <div class="v035-gap-list">${rows.length?rows.map((r,i)=>`<button type="button" data-v035-gap-sector="${esc(r.sector_name)}"><em>${i+1}</em><span><b>${esc(v019Truncate(r.sector_name,46))}</b><progress max="${max}" value="${v019Num(r.candidate_pairs)}"></progress></span><strong>${v035Fmt(r.candidate_pairs)}</strong><small>pares</small></button>`).join(''):'<div class="v019-empty">Sin screening sectorial materializado.</div>'}</div>
    <div class="v035-data-caveat">La deduplicación jurídica a SO potencial único no está materializada; el indicador conserva la unidad <b>par RUT–actividad</b>.</div>
  </section>`;
}

function v035UafSituation(core,uaf,counts){
  const dash=uaf?.dashboard?.kpis||{};
  const total=v019Num(dash.registered_total_latest)||v019Array(core?.uafRegions).reduce((a,r)=>a+v019Num(r.uaf_observed),0)||v019Num(counts?.total);
  const matched=v019Num(counts?.matched);
  const gapPairs=v019Array(core?.gaps).reduce((a,r)=>a+v019Num(r.candidate_pairs),0);
  const topGap=v019Array(core?.gapSectors).slice().sort((a,b)=>v019Num(b.candidate_pairs)-v019Num(a.candidate_pairs))[0];
  return `<section class="v035-uaf-zone">
    <div class="v035-section-title"><div><span>01 · SITUACIÓN UAF Y SUJETOS OBLIGADOS</span><h2>Registro, conciliación y brecha supervisiva</h2><p>Primera lectura operativa del universo UAF antes de profundizar en cualquier otro radar.</p></div><span class="v035-live-badge">UAF + SII + Fusion</span></div>
    <div class="v035-kpi-grid v035-kpi-grid-3">
      <article class="v035-kpi"><div class="v035-kpi-top">${v035HelpLabel('SO observados UAF','uaf_total')}<span class="v035-kpi-chip">universo</span></div><b>${v035Fmt(total)}</b><p>${esc(dash.registered_total_as_of||'último corte materializado')}</p></article>
      <article class="v035-kpi accent"><div class="v035-kpi-top">${v035HelpLabel('Cobertura de conciliación','sii_coverage')}<span class="v035-kpi-chip">UAF↔SII</span></div><b>${v035Pct(matched,total)}</b><p>${v035Fmt(matched)} con perfil SII · activos o terminados</p></article>
      <article class="v035-kpi warn"><div class="v035-kpi-top">${v035HelpLabel('Screening potencial no inscrito','gap_screening')}<span class="v035-kpi-chip">validar</span></div><b>${v035Fmt(gapPairs)}</b><p>${topGap?`mayor volumen: ${esc(v019Truncate(topGap.sector_name,42))}`:'pares RUT–actividad candidatos'}</p></article>
    </div>
    <div class="v035-uaf-analysis-grid">${v035ReconRail(counts)}${v035GapSectors(core)}</div>
  </section>`;
}

function v035ReportingStats(uaf){
  const sectors=v019Array(uaf?.sectors);
  const total=v019Num(uaf?.report?.totals?.ros_2025)||sectors.reduce((a,r)=>a+v019Num(r.ros_2025),0);
  const silence=sectors.filter(r=>Boolean(r.silence_5y));
  const intensities=sectors.map(r=>v019Num(r.ros_per_100_so_2025)).filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  const median=intensities.length?(intensities.length%2?intensities[(intensities.length-1)/2]:(intensities[intensities.length/2-1]+intensities[intensities.length/2])/2):0;
  const ranked=sectors.slice().sort((a,b)=>v019Num(b.ros_2025)-v019Num(a.ros_2025));
  const top5=ranked.slice(0,5).reduce((a,r)=>a+v019Num(r.ros_2025),0);
  return {sectors,total,silence,median,ranked,top5,top5Share:total>0?100*top5/total:0};
}

function v035SilenceMatrix(stats,uaf){
  const rows=stats.sectors.map(r=>({row:r,flags:v035SectorFlags(r,uaf)})).filter(x=>x.flags.length)
    .sort((a,b)=>{
      const weight=x=>x.flags.some(f=>f.k==='silence')?4:x.flags.some(f=>f.k==='low')?3:x.flags.some(f=>f.k==='down')?2:1;
      return weight(b)-weight(a)||v019Num(b.row.registered_so_2025)-v019Num(a.row.registered_so_2025);
    }).slice(0,9);
  return `<section class="v035-report-card v035-silence-card">
    <div class="v035-card-head"><div><span>SEÑAL SECTORIAL</span><h3>Silencio e intensidad, sin confundir tamaño con señal</h3><p>Prioriza marcas persistentes y muestra la base de SO junto al flujo relativo.</p></div>${v035Help('silence_matrix')}</div>
    <div class="v035-silence-list">${rows.length?rows.map(({row,flags})=>{
      const delta=Number(row.delta_ros_2025_vs_2024_pct);
      const tone=flags.some(f=>f.k==='silence')?'critical':flags.some(f=>f.k==='low')?'high':flags.some(f=>f.k==='down')?'medium':'neutral';
      return `<button type="button" class="${tone}" data-v035-uaf-sector="${esc(row.sector_name)}"><span class="v035-signal-dot"></span><span class="copy"><b>${esc(v019Truncate(row.sector_name,50))}</b><small>${v035Fmt(row.registered_so_2025)} SO · ${v035Fmt(row.ros_per_100_so_2025,2)} ROS/100 SO</small></span><span class="flags">${flags.slice(0,2).map(f=>`<em>${esc(f.label)}</em>`).join('')}</span><strong>${Number.isFinite(delta)?`${delta>0?'+':''}${v035Fmt(delta,1)}%`:'—'}</strong></button>`;
    }).join(''):'<div class="v019-empty">Sin marcas sectoriales materializadas.</div>'}</div>
  </section>`;
}

function v035ConcentrationLens(stats){
  const rows=stats.ranked.filter(r=>v019Num(r.ros_2025)>0).slice(0,7);
  const max=Math.max(1,...rows.map(r=>v019Num(r.ros_2025)));
  return `<section class="v035-report-card v035-concentration-card">
    <div class="v035-card-head"><div><span>DISTRIBUCIÓN DE REPORTES</span><h3>Lente de concentración ROS 2025</h3><p>Quién explica el flujo agregado y cuánto pesa sobre el total.</p></div>${v035Help('concentration_lens')}</div>
    <div class="v035-concentration-list">${rows.length?rows.map((r,i)=>`<button type="button" data-v035-uaf-sector="${esc(r.sector_name)}"><em>${String(i+1).padStart(2,'0')}</em><span><b>${esc(v019Truncate(r.sector_name,46))}</b><progress max="${max}" value="${v019Num(r.ros_2025)}"></progress></span><strong>${v035Pct(r.ros_2025,stats.total)}</strong><small>${v035Fmt(r.ros_2025)} ROS</small></button>`).join(''):'<div class="v019-empty">Sin distribución ROS materializada.</div>'}</div>
  </section>`;
}

function v035FocusCards(focus,uaf){
  if(!focus.length)return '<div class="v019-empty">No fue posible materializar SO individuales para este corte.</div>';
  return `<div class="v035-focus-list">${focus.map((r,i)=>{
    const sr=v035SectorReport(r.uaf_sector_label,uaf),flags=v035SectorFlags(sr,uaf);
    const title=r.resolved_name||r.uaf_category_hint||`RUT ${r.rut||'—'}`;
    const status=r.reconciliation_status==='SII_TERMINATED'?'Término de giro SII':'Sin perfil SII materializado';
    return `<details class="v035-focus-card" ${i===0?'open':''}><summary><span><b>${esc(v019Truncate(title,62))}</b><small>${esc(r.rut||'—')} · ${esc(r.uaf_sector_label||'sector UAF no materializado')}</small></span><span class="v035-focus-status ${r.reconciliation_status==='SII_TERMINATED'?'terminated':'missing'}">${esc(status)}</span><span class="v035-chevron">⌄</span></summary><div class="v035-focus-body">
      <div class="v035-focus-facts"><div><span>Prioridad conciliación</span><b>${esc(r.operational_priority||'—')}</b></div><div><span>Hallazgos Fusion</span><b>${v035Fmt(r.finding_count)}</b></div><div><span>Sanciones</span><b>${v035Fmt(r.sanction_count)}</b></div><div><span>Fuentes máx.</span><b>${v035Fmt(r.max_finding_sources)}</b></div></div>
      <div class="v035-focus-report"><span>Contexto sectorial de reportabilidad ${v035Help('subject_focus')}</span>${sr?`<b>${v035Fmt(sr.ros_2025)} ROS 2025 · ${v035Fmt(sr.ros_per_100_so_2025,2)} ROS/100 SO</b><small>${flags.length?flags.map(f=>f.label).join(' · '):'sin marca sectorial prioritaria'}</small>`:'<b>Sin emparejamiento sectorial de reportabilidad</b><small>revisar homologación del sector UAF</small>'}</div>
      <div class="v035-focus-note">No existe historial ROS/ROE individual materializado para inferir “último reporte” de este SO.</div>
      <div class="v035-focus-actions"><button type="button" data-v035-entity="${esc(r.entity_id)}">Abrir Entity 360 →</button>${r.reconciliation_status==='SII_TERMINATED'?'<button type="button" data-v035-recon="terminated">Ver cohorte de términos →</button>':'<button type="button" data-v035-recon="unmatched">Revisar matching SII →</button>'}</div>
    </div></details>`;
  }).join('')}</div>`;
}

function v035Reportability(uaf,focus){
  const s=v035ReportingStats(uaf);
  return `<section class="v035-report-zone">
    <div class="v035-section-title"><div><span>02 · REPORTABILIDAD Y SILENCIOS</span><h2>Flujo ROS, concentración y señales sectoriales</h2><p>La lectura individual se mantiene separada de lo que solo puede observarse a nivel agregado.</p></div><span class="v035-live-badge secondary">2021–2025</span></div>
    <div class="v035-kpi-grid v035-kpi-grid-4">
      <article class="v035-kpi"><div class="v035-kpi-top">${v035HelpLabel('ROS 2025','ros_total')}<span class="v035-kpi-chip">flujo</span></div><b>${v035Fmt(s.total)}</b><p>total agregado materializado</p></article>
      <article class="v035-kpi danger"><div class="v035-kpi-top">${v035HelpLabel('Silencio persistente','silence')}<span class="v035-kpi-chip">5 años</span></div><b>${v035Fmt(s.silence.length)}</b><p>sectores con 0 ROS 2021–2025</p></article>
      <article class="v035-kpi"><div class="v035-kpi-top">${v035HelpLabel('Mediana intensidad','intensity')}<span class="v035-kpi-chip">ROS/100 SO</span></div><b>${v035Fmt(s.median,1)}</b><p>comparación relativa entre sectores</p></article>
      <article class="v035-kpi accent"><div class="v035-kpi-top">${v035HelpLabel('Concentración Top 5','concentration')}<span class="v035-kpi-chip">participación</span></div><b>${v035Fmt(s.top5Share,1)}%</b><p>de ROS 2025 en cinco sectores</p></article>
    </div>
    <div class="v035-report-grid">${v035SilenceMatrix(s,uaf)}${v035ConcentrationLens(s)}</div>
    <section class="v035-subject-focus"><div class="v035-card-head"><div><span>FICHAS DESPLEGABLES</span><h3>Sujetos obligados en foco de conciliación</h3><p>Entidad + contexto SII + señales Fusion + contexto sectorial de reportabilidad.</p></div>${v035Help('subject_focus')}</div>${v035FocusCards(focus,uaf)}</section>
  </section>`;
}

function v035LatestSanctions(analytics){
  const rows=v019Array(analytics?.sanYears).slice().sort((a,b)=>Number(a.year)-Number(b.year));
  return rows[rows.length-1]||null;
}
function v035TopRegion(core){return v019Array(core?.regions).filter(r=>v019RegionNorm(r.region)!=='Sin región').slice().sort((a,b)=>v019Num(b.attention_index)-v019Num(a.attention_index))[0]||null;}
function v035TopPress(core){return v019Array(core?.press?.phenomena).slice().sort((a,b)=>v019Num(b.recent_vs_baseline_ratio)-v019Num(a.recent_vs_baseline_ratio))[0]||null;}

function v035PulseCard({cls='',eyebrow,title,value,detail,help,action,label}){
  return `<button type="button" class="v035-pulse ${esc(cls)}" ${action||''}><span class="v035-pulse-top"><span>${esc(eyebrow)}</span>${v035Help(help)}</span><b>${esc(String(value))}</b><strong>${esc(title)}</strong><small>${esc(detail)}</small><em>${esc(label||'Abrir →')}</em></button>`;
}

function v035Consolidated(core,analytics,osfl){
  const pmap=v035ProducerMap(analytics),san=v035LatestSanctions(analytics),region=v035TopRegion(core),press=v035TopPress(core),budget=analytics?.budget||{};
  const osflActive=v019Num(osfl?.quality?.ipa3_positive);
  const cgr=v019Num(pmap.get('RADAR_CGR')?.finding_count);
  const budgetP1=v019Num(budget?.metrics?.priority_p1);
  const sanCount=v019Num(san?.sanction_count);
  return `<section class="v035-consolidated">
    <div class="v035-section-title"><div><span>03 · PRIMERA MIRADA CONSOLIDADA</span><h2>Pulse multirradar: dónde profundizar después</h2><p>Cada bloque muestra una señal distinta; evita convertir fuentes heterogéneas en un score universal.</p></div><span class="v035-live-badge tertiary">navegable</span></div>
    <div class="v035-pulse-grid">
      ${v035PulseCard({cls:'sanctions',eyebrow:'SANCIONES',title:`Eventos ${san?.year||'—'}`,value:v035Fmt(sanCount),detail:`${v035Fmt(san?.laft_direct_count)} con flag LA/FT`,help:'sanctions',action:'data-v035-nav="sanctions"',label:'Abrir Sanciones →'})}
      ${v035PulseCard({cls:'territory',eyebrow:'TERRITORIO',title:region?v019RegionShort(region.region):'Sin región prioritaria',value:region?v035Fmt(region.attention_index,1):'—',detail:'índice de atención territorial',help:'territory',action:'data-v035-nav="territory"',label:'Abrir Territorio →'})}
      ${v035PulseCard({cls:'budget',eyebrow:'GASTO PÚBLICO',title:'Señales prioridad P1',value:v035Fmt(budgetP1),detail:`${v035Fmt(budget?.metrics?.signals)} señales en preview`,help:'budget',action:'data-v035-budget-open',label:'Ver señal líder →'})}
      ${v035PulseCard({cls:'osfl',eyebrow:'OSFL',title:'IPA3 activo',value:osflActive?v035Fmt(osflActive):'—',detail:'prioridad analítica shadow',help:'osfl',action:'data-v035-nav="osfl"',label:'Abrir OSFL →'})}
      ${v035PulseCard({cls:'cgr',eyebrow:'CGR',title:'Hallazgos Fusion',value:v035Fmt(cgr),detail:'productor RADAR_CGR',help:'cgr',action:'data-v035-cgr',label:'Ver hallazgos →'})}
      ${v035PulseCard({cls:'press',eyebrow:'PRENSA',title:press?v019Truncate(press.phenomenon,38):'Sin fenómeno',value:press&&Number.isFinite(Number(press.recent_vs_baseline_ratio))?`${v035Fmt(press.recent_vs_baseline_ratio,1)}×`:'—',detail:'momentum reciente vs baseline',help:'press',action:press?'data-v035-press="0"':'disabled',label:'Abrir evidencia →'})}
    </div>
    <div class="v035-public-context-slot"></div>
  </section>`;
}

function v035Priority(core){
  const rows=(typeof v0194NonUafFindings==='function'?v0194NonUafFindings(core):v019Array(core?.findings)).filter(f=>f.entity_id).slice(0,5);
  return `<section class="v035-priority-zone"><div class="v035-card-head"><div><span>COLA ANALÍTICA</span><h3>Qué revisar primero</h3><p>Cinco hallazgos concretos para iniciar navegación desde el Radar Integrado.</p></div>${v035Help('priority')}</div>${rows.length?`<div class="v035-priority-list">${rows.map((f,i)=>`<button type="button" class="v035-priority-row" data-finding="${esc(f.finding_key)}" data-region="${esc(f.region||'')}"><em>${i+1}</em><span><b>${esc(v019Truncate(f.title||f.entity_id,84))}</b><small>${esc(v019FindingType(f.finding_type))} · ${esc(v019RegionShort(f.region||'Sin región'))}</small></span><span class="v035-priority-proof"><strong>${v035Fmt(f.score_investigate,1)}</strong><small>IPA</small></span><span class="v035-priority-proof"><strong>${v035Fmt(f.source_count)}</strong><small>fuentes</small></span><span class="v035-priority-proof"><strong>${v035Fmt(f.evidence_count)}</strong><small>evidencias</small></span></button>`).join('')}</div>`:'<div class="v019-empty">Sin hallazgos individualizables en este corte.</div>'}</section>`;
}

function v035Dashboard(core,uaf,analytics,freshness,counts,focus,osfl){
  const missing=v035Unavailable();
  return `<div class="v035-dashboard">
    ${missing.length?`<div class="v024-source-warning"><b>Carga parcial</b><span>${esc(missing.join(' · '))}</span></div>`:''}
    ${typeof v024AuditHtml==='function'?v024AuditHtml(freshness):''}
    ${v035UafSituation(core,uaf,counts)}
    ${v035Reportability(uaf,focus)}
    ${v035Consolidated(core,analytics,osfl)}
    ${v035Priority(core)}
    <div class="v035-method-strip"><div><span>Regla de lectura</span><b>Señal ≠ conclusión</b><small>Los índices ordenan revisión; no estiman probabilidad de delito.</small></div><div><span>Trazabilidad</span><b>Detalle por clic</b><small>Las visualizaciones enlazan a sector, entidad, cohorte o radar fuente cuando existe contrato de datos.</small></div><div><span>Reportabilidad individual</span><b>No inferida</b><small>Sin eventos ROS/ROE por SO materializados, Workbench conserva la lectura sectorial y lo declara.</small></div></div>
    <div class="v035-popover" id="v035-popover" role="dialog" aria-modal="false" aria-live="polite" hidden><button type="button" class="v035-popover-close" data-v035-help-close aria-label="Cerrar ayuda">×</button><span>AYUDA METODOLÓGICA</span><h3 data-v035-help-title></h3><p data-v035-help-body></p></div>
  </div>`;
}

function v035OpenGapSector(name,core){
  const row=v019Array(core?.gapSectors).find(r=>String(r.sector_name)===String(name));
  if(!row)return;
  v019OpenDrawer(`<div class="ey">Brecha supervisiva · screening</div><h2>${esc(row.sector_name)}</h2><p class="lead">Volumen acumulado de pares RUT–actividad candidatos para revisión de cobertura.</p><div class="v024-drawer-kpis"><div><span>Pares candidatos</span><b>${v035Fmt(row.candidate_pairs)}</b></div><div><span>Territorios</span><b>${v035Fmt(row.territory_count)}</b></div><div><span>IPA supervisión</span><b>${v035Fmt(row.ipa_supervise,1)}</b></div></div><div class="v019-note warn"><b>Unidad analítica:</b> pares RUT–actividad. Este valor no es un conteo deduplicado de personas jurídicas ni acredita no inscripción UAF.</div>`);
}

function v035OpenCgr(core){
  const rows=v019Array(core?.findings).filter(f=>v019Array(f?.payload?.producer_ids).includes('RADAR_CGR')).slice(0,12);
  if(!rows.length){v019OpenDrawer('<div class="ey">CGR</div><h2>Hallazgos Fusion</h2><p class="lead">El productor CGR está materializado, pero los primeros 50 hallazgos cargados en esta vista no contienen filas CGR para desplegar aquí. Usa Entity 360 o la cola de hallazgos cuando aparezcan entidades vinculadas.</p>');return;}
  v019OpenDrawer(`<div class="ey">CGR · Fusion</div><h2>Hallazgos CGR en el corte visible</h2><p class="lead">Selecciona un hallazgo para revisar evidencia y entidad vinculada.</p><div class="v019-stack">${rows.map(f=>`<article class="v019-listitem" data-finding="${esc(f.finding_key)}"><div><h3>${esc(v019Truncate(f.title||'Hallazgo CGR',96))}</h3><p>${esc(v019RegionShort(f.region||'Sin región'))}</p></div><div class="value"><b>${v035Fmt(f.score_investigate,1)}</b><span>IPA</span></div></article>`).join('')}</div>`);
}

function v035ShowHelp(key){
  const h=V035_HELP[key],pop=document.querySelector('#v035-popover');if(!h||!pop)return;
  const title=pop.querySelector('[data-v035-help-title]'),body=pop.querySelector('[data-v035-help-body]');
  if(title)title.textContent=h.title;if(body)body.textContent=h.body;pop.hidden=false;pop.classList.add('open');
}
function v035CloseHelp(){const pop=document.querySelector('#v035-popover');if(pop){pop.classList.remove('open');pop.hidden=true;}}

function v035Bind(core,uaf,analytics){
  if(typeof v024BindOverview==='function')v024BindOverview(core,uaf,analytics);
  document.querySelectorAll('[data-v035-help]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();v035ShowHelp(b.dataset.v035Help);}));
  document.querySelector('[data-v035-help-close]')?.addEventListener('click',v035CloseHelp);
  document.querySelectorAll('[data-v035-recon]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const filter=b.dataset.v035Recon;if(typeof v0205LoadReconciliation==='function')void v0205LoadReconciliation(filter==='active'?'active':filter);}));
  document.querySelectorAll('[data-v035-gap-sector]').forEach(b=>b.addEventListener('click',()=>v035OpenGapSector(b.dataset.v035GapSector,core)));
  document.querySelectorAll('[data-v035-uaf-sector]').forEach(b=>b.addEventListener('click',()=>{if(typeof v0193OpenSector==='function')v0193OpenSector(b.dataset.v035UafSector,uaf);}));
  document.querySelectorAll('[data-v035-entity]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();if(b.dataset.v035Entity)openEntity(b.dataset.v035Entity);}));
  document.querySelectorAll('[data-v035-nav]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();void navigate(b.dataset.v035Nav);}));
  document.querySelector('[data-v035-budget-open]')?.addEventListener('click',e=>{e.preventDefault();if(typeof v020OpenBudgetSignal==='function')v020OpenBudgetSignal(0,analytics?.budget);});
  document.querySelector('[data-v035-cgr]')?.addEventListener('click',e=>{e.preventDefault();v035OpenCgr(core);});
  document.querySelectorAll('[data-v035-press]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();const rows=v019Array(core?.press?.phenomena).slice().sort((a,b)=>v019Num(b.recent_vs_baseline_ratio)-v019Num(a.recent_vs_baseline_ratio));const idx=Number(b.dataset.v035Press)||0;if(rows[idx]&&typeof v019OpenPress==='function'){const original=v019Array(core?.press?.phenomena).indexOf(rows[idx]);v019OpenPress(Math.max(0,original),core.press);}}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')v035CloseHelp();},{once:true});
}

v019LoadOverview=async function(){
  state.view='overview';
  shell('Radar integrado','Situación UAF, conciliación UAF–SII, reportabilidad y pulse consolidado para decidir dónde profundizar.');
  try{
    const settled=await Promise.allSettled([
      v019LoadCore(),
      v0193LoadUafData(),
      v020LoadAnalytics(),
      typeof v0207LoadFreshness==='function'?v0207LoadFreshness():Promise.resolve(null),
      typeof v0205LoadCounts==='function'?v0205LoadCounts():Promise.resolve(null),
      v035LoadFocusEntities(),
      typeof v030LoadMeta==='function'?v030LoadMeta():Promise.resolve(null)
    ]);
    const core=v035Safe(settled[0],{findings:[],patterns:[],gaps:[],gapSectors:[],uafRegions:[],uafCross:[],regions:[],press:{phenomena:[]}});
    const uaf=v035Safe(settled[1],{report:{totals:{}},dashboard:{kpis:{}},sectors:[],rules:[],q1:0,median:0});
    const analytics=v035Safe(settled[2],{sanYears:[],budget:{metrics:{},top_signals:[]},producers:[]});
    const freshness=v035Safe(settled[3],null);
    const counts=v035Safe(settled[4],{total:0,active:0,terminated:0,noSii:0,matched:0,review:0});
    const focus=v035Safe(settled[5],[]);
    const osfl=v035Safe(settled[6],null);
    v019Content().innerHTML=v035Dashboard(core,uaf,analytics,freshness,counts,focus,osfl);
    v035Bind(core,uaf,analytics);
    v035PruneUafNav();
    window.__AML_V035_CONTEXT={core,uaf,analytics,freshness,counts,focus,osfl};
  }catch(e){
    v019Content().innerHTML=`<div class="v019-error"><b>No fue posible construir Radar Integrado v0.35.</b><br>${esc(e?.message||String(e))}</div>`;
  }
};
loadOverview=v019LoadOverview;

if(!window.__V035_EVENTS){
  window.__V035_EVENTS=true;
  document.addEventListener('click',e=>{
    const oldUaf=e.target.closest('[data-home-view="uaf"],[data-v0205-back="uaf"]');
    if(oldUaf){e.preventDefault();e.stopPropagation();void navigate('overview');}
  },true);
}

const v035PublicObserver=new MutationObserver(()=>{
  v035PruneUafNav();
  const strip=document.querySelector('#v0344-public-overview');
  const slot=document.querySelector('.v035-public-context-slot');
  if(strip&&slot&&strip.parentElement!==slot)slot.appendChild(strip);
});
v035PublicObserver.observe(document.documentElement,{childList:true,subtree:true});

window.__AML_V035={version:V035,build:V035_BUILD,help:V035_HELP};
