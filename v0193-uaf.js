'use strict';

/* AML Workbench v0.19.3 · UAF Intelligence
 * Consolidates every high-level UAF analytical reading into one section:
 * - current SO registry vs matched 2025 reporting denominator
 * - sector ROS series 2021-2025
 * - persistent silence and relative-low-intensity flags
 * - ROS/ROE reporting rules
 * - screening gaps and cross-radar convergence
 * Radar Integrado is deliberately kept cross-radar and free of duplicated UAF analysis.
 */

const V0193='0.19.3';
const V0193_REPORT_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_UAF/main/docs/data/reportability_sector_2025.json';
const V0193_DASH_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_UAF/main/docs/data/dashboard.json';
let V0193_UAF_CACHE=null;
const v0193BaseShell=shell;

function v0193Norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/N[°º]/g,'N').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function v0193Pct(v,d=1){const n=Number(v);return Number.isFinite(n)?`${n>0?'+':''}${n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';}
function v0193Median(sorted){if(!sorted.length)return 0;const m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;}
function v0193Quantile(values,q){const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const p=(a.length-1)*q,b=Math.floor(p),r=p-b;return a[b+1]!==undefined?a[b]+r*(a[b+1]-a[b]):a[b];}
function v0193Series(row){return [2021,2022,2023,2024,2025].map(y=>({year:y,value:v019Num(row[`ros_${y}`])}));}
function v0193RuleMap(rules=[]){const m=new Map();rules.forEach(r=>m.set(v0193Norm(r.sector_name),r));return m;}
function v0193FindRule(row,map){return map.get(v0193Norm(row.sector_name))||null;}
function v0193PatternIsUaf(p){const s=v0193Norm(`${p.pattern_type||''} ${p.family||''} ${p.title||''}`);return /ROS|REPORTABIL|COBERTURA UAF|BRECHA/.test(s);}
function v0193FindingIsUaf(f){return ['SUPERVISORY_GAP','REGULATORY_GAP'].includes(String(f.finding_type||''));}
function v0193SectorMatch(a,b){const x=v0193Norm(a),y=v0193Norm(b);if(!x||!y)return false;if(x===y||x.includes(y)||y.includes(x))return true;const aliases=[['ORGANIZACIONES DEPORTIVAS PROFESIONALES LEY 20 190','ORGANIZACIONES DEPORTIVAS PROFESIONALES REGIDAS POR LEY 20 019'],['EMPRESAS DE DEPOSITOS DE VALORES','EMPRESAS DE DEPOSITO DE VALORES REGIDAS POR LA LEY N18 876'],['EMISORAS U OPERADORAS DE TARJETAS','EMISORAS U OPERADORAS DE TARJETAS DE CREDITO']];return aliases.some(([u,v])=>(x.includes(u)&&y.includes(v))||(x.includes(v)&&y.includes(u)));}

shell=function(title,subtitle){
  v0193BaseShell(title,subtitle);
  const uaf=document.querySelector('[data-view="uaf"]');
  if(uaf){const n=uaf.querySelector('.n');uaf.childNodes[0].nodeValue='Inteligencia UAF';if(n)n.textContent='';}
  const version=document.querySelector('.v019-brand small');if(version)version.textContent=`Operational Radar · v${V0193}`;
};

async function v0193LoadUafData(force=false){
  if(V0193_UAF_CACHE&&!force)return V0193_UAF_CACHE;
  const [reportRes,dashRes,rulesRes]=await Promise.all([
    fetch(V0193_REPORT_URL,{cache:'no-store'}),
    fetch(V0193_DASH_URL,{cache:'no-store'}),
    sb.from('aml_reporting_rules').select('sector_name,sector_group,ros_required,ros_trigger,roe_required,roe_frequency,roe_threshold_usd,roe_deadline,legal_basis,as_of_date,notes')
  ]);
  if(!reportRes.ok)throw new Error('No fue posible cargar la matriz sectorial de reportabilidad de Radar UAF.');
  if(rulesRes.error)throw rulesRes.error;
  const report=await reportRes.json();
  let dashboard=null;try{if(dashRes.ok)dashboard=await dashRes.json();}catch{}
  const sectors=v019Array(report.sectors).map(r=>({...r}));
  const comparable=sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y);
  const q1=v0193Quantile(comparable.map(r=>v019Num(r.ros_per_100_so_2025)),.25);
  const median=v0193Median(comparable.map(r=>v019Num(r.ros_per_100_so_2025)).sort((a,b)=>a-b));
  V0193_UAF_CACHE={report,dashboard,rules:rulesRes.data||[],ruleMap:v0193RuleMap(rulesRes.data||[]),sectors,q1,median};
  return V0193_UAF_CACHE;
}

function v0193Flags(row,uaf){
  const out=[];const reg=v019Num(row.registered_so_2025),intensity=v019Num(row.ros_per_100_so_2025),delta=Number(row.delta_ros_2025_vs_2024_pct);
  if(row.silence_5y)out.push({k:'silence',label:'Silencio ROS 5 años'});
  else if(v019Num(row.ros_2025)===0)out.push({k:'zero',label:'0 ROS en 2025'});
  if(reg>=10&&!row.silence_5y&&intensity<=uaf.q1)out.push({k:'low',label:'Q1 intensidad'});
  if(Number.isFinite(delta)&&delta<=-30)out.push({k:'down',label:'Caída ≥30%'});
  if(Number.isFinite(delta)&&delta>=50)out.push({k:'up',label:'Alza ≥50%'});
  return out;
}
function v0193FlagHtml(flags){return flags.length?flags.map(x=>`<span class="v0193-flag ${x.k}">${esc(x.label)}</span>`).join(''):'<span class="v0193-flag neutral">Sin marca prioritaria</span>';}
function v0193Spark(row){const series=v0193Series(row),max=Math.max(...series.map(x=>x.value),1);return `<div class="v0193-spark" aria-label="ROS 2021 a 2025">${series.map(x=>`<span class="v0193-spark-col"><i class="${v019Width(x.value,max)}"></i><small>${String(x.year).slice(2)}</small></span>`).join('')}</div>`;}

function v0193ReportHelp(){return v17InfoButton('Cómo leer reportabilidad',`<div class="v0192-help-copy"><p><strong>ROS:</strong> no posee una periodicidad mínima. Se remite cuando el SO detecta una operación sospechosa. Por eso un valor cero no equivale automáticamente a incumplimiento.</p><p><strong>Intensidad ROS:</strong> ROS 2025 por cada 100 SO inscritos al 31-12-2025 del mismo sector. Compara stock y flujo del mismo corte.</p><p><strong>Q1 intensidad:</strong> sectores con al menos 10 SO cuya intensidad está en el 25% inferior entre sectores comparables con ROS.</p><p><strong>Silencio ROS 5 años:</strong> sector con SO inscritos y cero ROS agregados en cada año 2021-2025. Es una marca de revisión, no una conclusión de incumplimiento individual.</p><p><strong>ROE:</strong> cuando corresponde, sí tiene calendario periódico. La tabla muestra la frecuencia normativa materializada para el sector.</p></div>`,true);}

function v0193OverviewPriority(core){
  const rows=core.findings.filter(f=>!v0193FindingIsUaf(f)&&f.entity_id).slice(0,10);
  if(!rows.length)return '<div class="v019-empty">No hay hallazgos individualizables en el corte actual.</div>';
  return `<div class="v0193-priority-list">${rows.map(f=>`<article class="v0193-priority-row" data-finding="${esc(f.finding_key)}"><div><span>${esc(v019FindingType(f.finding_type))}</span><b>${esc(v019Truncate(f.title||f.entity_id,88))}</b><small>${esc(v019RegionShort(f.region||'Sin región'))}</small></div><div class="v0193-proof"><span><b>${v019Fmt(f.score_investigate,1)}</b> IPA</span><span><b>${v019Fmt(f.source_count)}</b> fuentes</span><span><b>${v019Fmt(f.evidence_count)}</b> evidencias</span></div></article>`).join('')}</div>`;
}

v019LoadOverview=async function(){
  state.view='overview';shell('Radar integrado','Lectura transversal de hallazgos, convergencias, fenómenos y contexto. La inteligencia UAF se concentra en una sección especializada.');
  try{
    const core=await v019LoadCore();
    const findings=core.findings.filter(f=>!v0193FindingIsUaf(f));
    const patterns=core.patterns.filter(p=>p.scope_type!=='SYSTEM'&&!v0193PatternIsUaf(p));
    const top=findings.find(f=>f.entity_id)||findings[0],pat=patterns[0];
    const multi=findings.slice().sort((a,b)=>v019Num(b.source_count)-v019Num(a.source_count))[0];
    v019Content().innerHTML=`
      <section class="v0193-overview-kpis">
        <div><span>Mayor IPA investigativo</span><b>${top?v019Fmt(top.score_investigate,1):'—'}</b><small>${esc(v019Truncate(top?.title||'Sin hallazgo',52))}</small></div>
        <div><span>Mayor convergencia</span><b>${multi?v019Fmt(multi.source_count):'—'}</b><small>fuentes independientes en un hallazgo</small></div>
        <div><span>Fenómeno comparativo</span><b>${pat?v019Fmt(pat.strength,1):'—'}</b><small>${esc(v019Truncate(pat?.title||'Sin patrón',52))}</small></div>
        <div class="uaf-link"><span>Lectura regulatoria</span><b>UAF</b><small>consolidada en Inteligencia UAF</small><button type="button" id="v0193-go-uaf">Abrir sección</button></div>
      </section>
      <section class="v019-grid">
        <article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Qué revisar primero</h2><p>Hallazgos concretos ordenados por IPA, mostrando inmediatamente fuentes y evidencia. Reemplaza el antiguo ranking territorial “Dónde mirar primero”.</p></div><span class="hint">hallazgo → evidencia</span></div>${v0193OverviewPriority(core)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Fenómenos comparativos</h2><p>Patrones transversales no regulatorios con mayor fuerza relativa.</p></div><span class="hint">fuerza ≠ probabilidad</span></div>${v019PatternList(patterns,7)}</article>
        <article class="v019-card"><div class="v019-card-head"><div><h2>Atención territorial</h2><p>IAT como navegación territorial; no mezcla reportabilidad ni brecha UAF.</p></div><span class="hint">clic en región</span></div>${v019RegionBars(core.regions,9)}</article>
        <article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Contexto longitudinal de prensa</h2><p>Momentum reciente frente a baseline. Se mantiene como contexto independiente.</p></div><span class="hint">CONTEXT_ONLY</span></div>${v019PressCards(core.press)}</article>
      </section>`;
    document.querySelector('#v0193-go-uaf')?.addEventListener('click',()=>v019LoadUaf());
    v019BindCommon(core);
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};
loadOverview=v019LoadOverview;

function v0193SilencePanels(uaf){
  const silence=uaf.sectors.filter(r=>r.silence_5y).sort((a,b)=>v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025));
  const low=uaf.sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y&&v019Num(r.ros_per_100_so_2025)<=uaf.q1).sort((a,b)=>v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025));
  const list=(rows,type)=>rows.map(r=>`<button type="button" class="v0193-signal-row" data-uaf-sector="${esc(r.sector_name)}"><span class="v0193-signal-icon ${type}"></span><span><b>${esc(r.sector_name)}</b><small>${v019Fmt(r.registered_so_2025)} SO · ${v019Fmt(r.ros_2025)} ROS 2025 · ${v019Fmt(r.ros_per_100_so_2025,2)} ROS/100 SO</small></span></button>`).join('');
  return `<div class="v0193-silence-grid"><div><div class="v0193-subhead"><b>Silencio persistente</b><span>0 ROS agregados · 2021–2025</span></div>${list(silence,'silence')}</div><div><div class="v0193-subhead"><b>Intensidad relativa baja</b><span>Q1 entre sectores con ≥10 SO · corte 2025</span></div>${list(low,'low')}</div></div>`;
}

function v0193ReportTable(uaf){
  const rows=uaf.sectors.slice().sort((a,b)=>{
    const af=v0193Flags(a,uaf),bf=v0193Flags(b,uaf);const aw=af.some(x=>x.k==='silence')?4:af.some(x=>x.k==='low')?3:af.some(x=>x.k==='down')?2:af.length?1:0;const bw=bf.some(x=>x.k==='silence')?4:bf.some(x=>x.k==='low')?3:bf.some(x=>x.k==='down')?2:bf.length?1:0;return bw-aw||v019Num(b.registered_so_2025)-v019Num(a.registered_so_2025);
  });
  return `<div class="v0193-table-tools"><input type="search" id="v0193-sector-search" placeholder="Buscar sector"><select id="v0193-sector-signal"><option value="">Todas las marcas</option><option value="silence">Silencio ROS 5 años</option><option value="low">Q1 intensidad</option><option value="down">Caída ≥30%</option><option value="up">Alza ≥50%</option></select><span id="v0193-sector-count">${rows.length} sectores</span></div><div class="v019-tablewrap"><table class="v019-table v0193-report-table"><thead><tr><th>Sector</th><th>SO 2025</th><th>ROS 2025</th><th>ROS / 100 SO</th><th>Δ 24→25</th><th>Serie ROS</th><th>ROE</th><th>Marca analítica</th></tr></thead><tbody>${rows.map(r=>{const rule=v0193FindRule(r,uaf.ruleMap),flags=v0193Flags(r,uaf);return `<tr data-uaf-sector-row="${esc(r.sector_name)}" data-flags="${esc(flags.map(x=>x.k).join(' '))}"><td><button type="button" class="v0193-sector-name" data-uaf-sector="${esc(r.sector_name)}">${esc(r.sector_name)}</button></td><td>${v019Fmt(r.registered_so_2025)}</td><td>${v019Fmt(r.ros_2025)}</td><td><b>${v019Fmt(r.ros_per_100_so_2025,2)}</b></td><td class="${Number(r.delta_ros_2025_vs_2024_pct)<0?'neg':'pos'}">${v0193Pct(r.delta_ros_2025_vs_2024_pct)}</td><td>${v0193Spark(r)}</td><td>${esc(rule?.roe_frequency|| (v0193Norm(r.sector_name)==='INSTITUCIONES PUBLICAS'?'No aplica en esta matriz':'—'))}</td><td><div class="v0193-flags">${v0193FlagHtml(flags)}</div></td></tr>`;}).join('')}</tbody></table></div>`;
}

function v0193SectorDrawer(name,core,uaf){
  const r=uaf.sectors.find(x=>x.sector_name===name);if(!r)return;
  const rule=v0193FindRule(r,uaf.ruleMap);const flags=v0193Flags(r,uaf);const pats=core.patterns.filter(p=>v0193SectorMatch(p.scope_label,name)&&v0193PatternIsUaf(p)).slice(0,6);const gap=core.gapSectors.find(g=>v0193SectorMatch(g.sector_name,name));
  const rosText=rule?.ros_required?'Aplicable ante detección de una operación sospechosa':'Regla sectorial no materializada';
  const roeText=rule?.roe_required?`${rule.roe_frequency||'Aplicable'} · umbral USD ${v019Fmt(rule.roe_threshold_usd)}`:(v0193Norm(name)==='INSTITUCIONES PUBLICAS'?'No aplica ROE en esta lectura de sector público':'No materializado');
  v019OpenDrawer(`<div class="v0193-sector-drawer"><span class="v0193-drawer-kicker">Inteligencia UAF · reportabilidad sectorial</span><h2>${esc(name)}</h2><div class="v0193-drawer-kpis"><div><span>SO inscritos 2025</span><b>${v019Fmt(r.registered_so_2025)}</b></div><div><span>ROS 2025</span><b>${v019Fmt(r.ros_2025)}</b></div><div><span>ROS / 100 SO</span><b>${v019Fmt(r.ros_per_100_so_2025,2)}</b></div><div><span>ROS 2021–2025</span><b>${v019Fmt(r.ros_total_2021_2025)}</b></div></div><div class="v0193-flags drawer-flags">${v0193FlagHtml(flags)}</div><section><h3>Serie ROS</h3><div class="v0193-year-grid">${v0193Series(r).map(x=>`<div><span>${x.year}</span><b>${v019Fmt(x.value)}</b></div>`).join('')}</div><p class="v0193-delta">Variación 2025 vs 2024: <b>${v0193Pct(r.delta_ros_2025_vs_2024_pct)}</b></p></section><section><h3>Reglas de reportabilidad</h3><div class="v0193-rule-grid"><div><span>ROS</span><b>${esc(rosText)}</b><small>${esc(rule?.ros_trigger||'El ROS no se interpreta como reporte periódico mínimo.')}</small></div><div><span>ROE</span><b>${esc(roeText)}</b><small>${esc(rule?.roe_deadline||'Sin calendario materializado para este sector.')}</small></div></div></section>${gap?`<section><h3>Brecha de cobertura / screening</h3><p><b>${v019Fmt(gap.candidate_pairs)}</b> pares RUT–actividad candidatos agregados para este sector. No equivalen a personas jurídicas únicas ni demuestran falta de inscripción.</p></section>`:''}${pats.length?`<section><h3>Patrones UAF materializados</h3>${v019PatternList(pats,6)}</section>`:''}<div class="v019-note warn"><b>Guardrail:</b> la serie es agregada por sector. No permite saber qué SO individual remitió o no remitió un ROS. Un silencio sectorial es una señal para priorizar análisis de supervisión, no una constatación de incumplimiento.</div></div>`);
  v019BindCommon(core);
}

function v0193CrossAndGap(core){
  const total=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0)||1;
  const cross=core.uafCross.filter(r=>r.radar_id!=='RADAR_UAF').slice(0,8);
  const gaps=core.gaps.filter(g=>g.gap_attention_index!==null&&v019RegionNorm(g.region)!=='Sin región').slice(0,8);
  return `<article class="v019-card"><div class="v019-card-head"><div><h2>SO inscritos × otros radares</h2><p>Entidades UAF con evidencia materializada en productores adicionales.</p></div><span class="hint">convergencia ≠ riesgo</span></div><div class="v019-bars">${cross.map(r=>`<div class="v019-barrow"><span class="v019-barlabel">${esc(String(r.radar_id).replace('RADAR_',''))}</span><div class="v019-track"><div class="v019-fill green ${v019Width(r.uaf_entities,total)}"></div></div><span class="v019-barvalue">${v019Fmt(r.uaf_entities)}</span></div>`).join('')}</div></article><article class="v019-card"><div class="v019-card-head"><div><h2>Brecha potencial de cobertura</h2><p>IBS y pares RUT–actividad para orientar screening territorial.</p></div>${v0192HelpIBS()}</div><div class="v019-bars">${gaps.map(r=>`<div class="v019-barrow" data-gap-region="${esc(v019RegionNorm(r.region))}"><span class="v019-barlabel">${esc(v019RegionShort(r.region))}</span><div class="v019-track"><div class="v019-fill amber ${v019Width(r.gap_attention_index,100)}"></div></div><span class="v019-barvalue">${v019Fmt(r.gap_attention_index,1)}</span></div>`).join('')}</div></article>`;
}

function v0193BindReportability(core,uaf){
  document.querySelectorAll('[data-uaf-sector]').forEach(el=>el.addEventListener('click',()=>v0193SectorDrawer(el.dataset.uafSector,core,uaf)));
  const search=document.querySelector('#v0193-sector-search'),signal=document.querySelector('#v0193-sector-signal'),count=document.querySelector('#v0193-sector-count');
  const apply=()=>{const q=v0193Norm(search?.value),s=signal?.value||'';let n=0;document.querySelectorAll('[data-uaf-sector-row]').forEach(tr=>{const okQ=!q||v0193Norm(tr.dataset.uafSectorRow).includes(q),okS=!s||String(tr.dataset.flags||'').split(' ').includes(s),show=okQ&&okS;tr.classList.toggle('v0193-hidden',!show);if(show)n++;});if(count)count.textContent=`${n} sectores`;};
  search?.addEventListener('input',apply);signal?.addEventListener('change',apply);
}

v019LoadUaf=async function(selectedRegion=''){
  state.view='uaf';shell('Inteligencia UAF','SO inscritos, reportabilidad sectorial, silencios ROS, reglas ROS/ROE, brechas de cobertura y convergencia con otros radares en una sola lectura.');
  try{
    const [core,uaf]=await Promise.all([v019LoadCore(),v0193LoadUafData()]);
    const latest=v019Num(uaf.dashboard?.kpis?.registered_total_latest)||core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0);
    const latestDate=uaf.dashboard?.kpis?.registered_total_as_of||'último corte';
    const silence=uaf.sectors.filter(r=>r.silence_5y),silenceSO=silence.reduce((a,r)=>a+v019Num(r.registered_so_2025),0);
    const low=uaf.sectors.filter(r=>v019Num(r.registered_so_2025)>=10&&!r.silence_5y&&v019Num(r.ros_per_100_so_2025)<=uaf.q1);
    v019Content().innerHTML=`<section class="v0193-uaf-hero"><div><span class="v0193-kicker">UAF · supervisión y reportabilidad</span><h2>De la inscripción al comportamiento agregado de reporte</h2><p>La lectura compara SO y ROS con denominadores temporalmente compatibles, agrega reglas ROS/ROE y mantiene separadas las conclusiones individuales.</p></div>${v0193ReportHelp()}</section><section class="v0193-uaf-kpis"><div><span>SO inscritos · último corte</span><b>${v019Fmt(latest)}</b><small>${esc(latestDate)} · Radar UAF</small></div><div><span>Base comparable 2025</span><b>${v019Fmt(uaf.report.totals.registered_so_2025)}</b><small>denominador para ROS 2025</small></div><div><span>ROS 2025</span><b>${v019Fmt(uaf.report.totals.ros_2025)}</b><small>${v0193Pct(100*(v019Num(uaf.report.totals.ros_2025)-v019Num(uaf.report.totals.ros_2024))/Math.max(v019Num(uaf.report.totals.ros_2024),1))} vs 2024</small></div><div class="alert"><span>Sectores en silencio 5 años</span><b>${v019Fmt(silence.length)}</b><small>${v019Fmt(silenceSO)} SO expuestos a la marca</small></div><div><span>Q1 intensidad relativa</span><b>${v019Fmt(low.length)}</b><small>umbral ${v019Fmt(uaf.q1,2)} ROS/100 SO</small></div></section><section class="v019-grid"><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Silencios y baja intensidad de reportabilidad</h2><p>Prioriza sectores con SO inscritos pero actividad ROS nula o baja frente a pares comparables.</p></div>${v0193ReportHelp()}</div>${v0193SilencePanels(uaf)}<div class="v019-note warn"><b>Interpretación:</b> el silencio es sectorial y agregado. No equivale a incumplimiento, porque el ROS se activa ante sospecha y no tiene una cuota periódica.</div></article><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Matriz sectorial de reportabilidad</h2><p>SO inscritos 2025 + ROS 2021–2025 + intensidad + tendencia + frecuencia ROE. Clic en un sector abre su explicación completa.</p></div><span class="hint">48 sectores con SO en 2025</span></div>${v0193ReportTable(uaf)}</article>${v0193CrossAndGap(core)}<article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Lectura metodológica</h2><p>Qué sí puede concluirse de la combinación UAF.</p></div><span class="hint">trazabilidad primero</span></div><div class="v0193-method-grid"><div><b>Silencio persistente</b><p>Hay SO inscritos y el agregado sectorial publica 0 ROS en los cinco años. Prioriza revisión del fenómeno.</p></div><div><b>Intensidad relativa</b><p>Normaliza ROS 2025 por 100 SO del mismo corte para no confundir tamaño de sector con propensión agregada a reportar.</p></div><div><b>ROE periódico</b><p>La frecuencia normativa permite distinguir obligaciones periódicas de la lógica eventual del ROS.</p></div><div><b>Brecha de cobertura</b><p>Screening SII/UAF sugiere dónde revisar potenciales sujetos; no identifica por sí solo incumplimiento jurídico.</p></div></div></article></section>`;
    v019BindCommon(core);v0193BindReportability(core,uaf);
    await v0192AppendSOExplorer();
    const explorer=document.querySelector('.v0192-so-explorer'),grid=v019Content()?.querySelector('.v019-grid');if(explorer&&grid)grid.append(explorer);
    if(selectedRegion)setTimeout(()=>v019OpenGapRegion(selectedRegion,core),0);
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};

setTimeout(()=>{if(state.user&&state.access&&state.view==='overview')v019LoadOverview();},0);
