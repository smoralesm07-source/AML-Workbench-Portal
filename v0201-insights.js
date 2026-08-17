'use strict';

/* AML Workbench v0.20.1 · insight-first drawers
 * Principle: show the unusual fact first. Scores order review; methodology is secondary.
 */

const V0201='0.20.1';
const V0201_FINDING_MAP=new Map();

const V0201_SII_LABELS={
  SALES_BAND_JUMP:'Salto relevante de tramo de ventas',
  HIGH_SALES_LOW_WORKFORCE:'Ventas altas con dotación muy baja',
  RECENT_START_HIGH_SALES:'Inicio reciente con tramo de ventas alto',
  HIGH_SALES_NEGATIVE_EQUITY:'Ventas altas con capital propio negativo',
  WORKFORCE_DROP_STABLE_SALES:'Caída de dotación con ventas estables',
  MAIN_ACTIVITY_CHANGE:'Cambio de actividad principal',
  REGION_CHANGE:'Cambio de región',
  ACTIVITY_BREADTH:'Número inusual de actividades registradas',
  ADDRESS_HISTORY_BREADTH:'Historial amplio de domicilios',
  REACTIVATION_PATTERN:'Patrón de reactivación registral'
};

function v0201Norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function v0201Unique(values){const out=[],seen=new Set();for(const v of values){const s=String(v||'').trim();const k=v0201Norm(s);if(s&&!seen.has(k)){seen.add(k);out.push(s);}}return out;}
function v0201SplitPipe(v){return String(v||'').split('|').map(x=>x.trim()).filter(Boolean);}
function v0201FmtRut(f){return f?.payload?.entity_rut||String(f?.entity_id||'').replace('ENT-RUT-','')||'—';}
function v0201Band(score){if(typeof v17PriorityBand==='function')return v17PriorityBand(score);const n=Number(score)||0;return {label:n>=60?'Alta':n>=45?'Media':'Baja',cls:n>=60?'med':n>=45?'low':'neutral'};}
function v0201ModeScore(f,modeKey='investigate'){const mode=(typeof V17_MODE!=='undefined'&&V17_MODE[modeKey])?V17_MODE[modeKey]:null;return mode&&f[mode.scoreField]!=null?Number(f[mode.scoreField]):Number(f.score_investigate);}

function v0201ParseAnomalyText(text){
  const s=String(text||'');
  const m=s.match(/contextual\(es\):\s*(.*?)(?:\.\s*Se agrupan|\.\s*Se agrupa|$)/i);
  if(!m)return [];
  return m[1].split(',').map(x=>x.trim().replace(/[.;]+$/,'')).filter(Boolean);
}

function v0201TaxSignals(tax){
  if(!tax)return [];
  return v0201SplitPipe(tax.signal_types).map(code=>V0201_SII_LABELS[code]||String(code).replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase()));
}

function v0201AnomalyItems(f,related,tax){
  const names=[];
  for(const row of related||[]){if(row.finding_type==='CONTEXTUAL_ANOMALY')names.push(...v0201ParseAnomalyText(row.payload?.explanation));}
  if(f.finding_type==='CONTEXTUAL_ANOMALY')names.push(...v0201ParseAnomalyText(f.payload?.explanation));
  names.push(...v0201TaxSignals(tax));
  return v0201Unique(names);
}

function v0201RegionCount(tax){return v0201Unique(v0201SplitPipe(tax?.address_regions)).length;}
function v0201AnomalyDetail(label,tax,f){
  const k=v0201Norm(label),sector=v019Array(f?.payload?.sector_names)[0];
  if(k.includes('DOMICIL')){const n=Number(tax?.address_count)||0,r=v0201RegionCount(tax);return n?`${v019Fmt(n)} domicilios históricos${r?` distribuidos en ${v019Fmt(r)} regiones`:''}.`:'';}
  if(k.includes('TRAMO')&&k.includes('VENT'))return tax?.sales_band_code?`El Radar SII detectó un salto entre años consecutivos; el último tramo materializado es ${esc(String(tax.sales_band_code))}.`:'Cambio relevante entre tramos de ventas publicados por SII.';
  if(k.includes('UAF')&&k.includes('SII'))return `${sector?`Sector UAF: ${sector}. `:''}${tax?.main_activity?`Actividad principal SII: ${tax.main_activity}.`:''}`;
  if(k.includes('DOTACION'))return tax?.workers_numeric!=null?`Última dotación materializada: ${v019Fmt(tax.workers_numeric)} trabajadores dependientes; la señal proviene del cambio respecto del período anterior.`:'La variación de dotación no fue acompañada por una caída equivalente del tramo de ventas.';
  if(k.includes('ACTIVIDAD PRINCIPAL'))return tax?.main_activity?`Actividad principal más reciente: ${tax.main_activity}.`:'Se observó un cambio de actividad principal entre períodos.';
  if(k.includes('ACTIVIDADES REGISTRADAS'))return tax?.activity_count!=null?`${v019Fmt(tax.activity_count)} actividades económicas materializadas.`:'';
  if(k.includes('REGION'))return tax?.region?`Última región publicada: ${tax.region}.`:'';
  if(k.includes('REACTIV'))return 'Coexiste un término de giro histórico con estado activo en el registro más reciente.';
  return '';
}

async function v0201FindingContext(f){
  if(!f?.entity_id)return {related:[f],tax:null,sanctions:[]};
  const [rq,tq,sq]=await Promise.all([
    sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,payload').eq('entity_id',f.entity_id).order('score_investigate',{ascending:false,nullsFirst:false}).limit(20),
    sb.from('aml_entity_tax_profile').select('entity_id,commercial_year,sales_band_code,workers_numeric,region,commune,economic_sector,economic_subsector,main_activity,taxpayer_type,taxpayer_subtype,current_status,activity_start_date,activity_count,address_count,current_address_count,address_regions,communes,ownership_edge_count,societies_as_partner_count,signal_count,signal_types').eq('entity_id',f.entity_id).order('commercial_year',{ascending:false,nullsFirst:false}).limit(1),
    sb.from('aml_sanctions').select('regulator,event_date,subject,laft_direct,payload').eq('entity_id',f.entity_id).order('event_date',{ascending:false,nullsFirst:false}).limit(8)
  ]);
  return {related:rq.error?[f]:(rq.data||[f]),tax:tq.error?null:(tq.data||[])[0]||null,sanctions:sq.error?[]:(sq.data||[])};
}

function v0201SignalRows(f,ctx){
  const p=f.payload||{},facts=p.decision_facts||{},items=[];
  for(const label of v0201AnomalyItems(f,ctx.related,ctx.tax))items.push({tone:'attention',label,detail:v0201AnomalyDetail(label,ctx.tax,f)});
  if(Number(facts.direct_aml_signals)>0)items.unshift({tone:'critical',label:`${v019Fmt(facts.direct_aml_signals)} señal AML gobernada`,detail:'Existe una regla AML materializada con evidencia trazable. Requiere lectura de la evidencia fuente y contexto.'});
  if(Number(facts.sanctions)>0){const latest=ctx.sanctions[0],cat=latest?.payload?.attributes?.category;items.push({tone:'attention',label:`${v019Fmt(facts.sanctions)} sanción(es) administrativa(s) vinculada(s)`,detail:latest?`${latest.regulator||'Supervisor'} · ${fmtDate(latest.event_date)}${cat?` · ${cat}`:''}.`:'Revisar materia, fecha y recurrencia de los eventos sancionatorios.'});}
  if(Number(facts.supervisory_gap_candidates)>0)items.push({tone:'attention',label:`${v019Fmt(facts.supervisory_gap_candidates)} pares RUT–actividad para validar`,detail:'Screening agregado SII–UAF. No equivale a entidades jurídicamente no inscritas.'});
  if(Number(facts.independent_sources)>=3)items.push({tone:'context',label:`Convergencia en ${v019Fmt(facts.independent_sources)} fuentes independientes`,detail:v019Array(p.producer_ids).map(x=>String(x).replace('RADAR_','')).join(' · ')});
  if(Number(facts.observed_relationships)>0)items.push({tone:'context',label:`${v019Fmt(facts.observed_relationships)} relaciones observadas`,detail:'Las relaciones aportan contexto para explorar la red; no transmiten riesgo por sí solas.'});
  if(!items.length)items.push({tone:'neutral',label:v019FindingType(f.finding_type),detail:p.explanation||'Hallazgo priorizado para revisión.'});
  return items.slice(0,7);
}

function v0201MetricRows(f){
  const m=f.payload?.metrics||{};
  const candidates=[
    ['Inusualidad',m.unusualness],['Convergencia',m.convergence],['Evidencia',m.evidence_strength],
    ['Cambio temporal',m.temporal_change],['Red',m.network],['Sanciones',m.sanctions],['Brecha regulatoria',m.regulatory_gap]
  ];
  return candidates.filter(([,v])=>Number(v)>0).slice(0,5);
}

function v0201MetricsHtml(rows){
  if(!rows.length)return '';
  return `<section class="v0201-block"><div class="v0201-block-head"><h3>Lecturas analíticas</h3><span>0–100 · comparación, no probabilidad</span></div><div class="v0201-meters">${rows.map(([label,value])=>`<div class="v0201-meter-row"><span>${esc(label)}</span><progress max="100" value="${Math.max(0,Math.min(100,Number(value)||0))}"></progress><b>${v019Fmt(value,0)}</b></div>`).join('')}</div></section>`;
}

function v0201SanctionHtml(rows){
  if(!rows?.length)return '';
  return `<section class="v0201-block"><div class="v0201-block-head"><h3>Eventos sancionatorios recientes</h3><span>${v019Fmt(rows.length)} visible(s)</span></div><div class="v0201-timeline">${rows.slice(0,4).map(s=>{const a=s.payload?.attributes||{};return `<div><span>${fmtDate(s.event_date)}</span><b>${esc(s.regulator||a.supervisor||'Supervisor')}</b><small>${esc(a.category||s.subject||'Evento administrativo')}</small></div>`;}).join('')}</div></section>`;
}

function v0201WhyText(f,signals){
  if(f.finding_type==='ENTITY_CONVERGENCE')return 'La utilidad está en revisar si las inusualidades observadas por fuentes distintas describen un mismo fenómeno o hechos independientes.';
  if(f.finding_type==='CONTEXTUAL_ANOMALY')return 'Los cambios salen de la trayectoria registral o económica observada. Conviene revisar cronología y comparables antes de formular una hipótesis.';
  if(f.finding_type==='PRUDENTIAL_SANCTION')return 'La sanción aporta un antecedente administrativo verificable. Lo relevante es su materia, recurrencia y coincidencia temporal con otras señales.';
  if(f.finding_type==='GOVERNED_AML_SIGNAL')return 'Existe una señal AML gobernada. La prioridad es abrir su evidencia y contrastarla con el resto del perfil antes de concluir.';
  if(f.finding_type==='SUPERVISORY_GAP')return 'La señal identifica un conjunto que merece validación supervisiva. Es un universo de screening, no una lista de incumplidores.';
  return signals[0]?.detail||'El hallazgo ordena una revisión basada en evidencia.';
}

function v0201MethodButton(f){
  if(typeof v17InfoButton!=='function')return '';
  const body=typeof v17ScoreExplanation==='function'?v17ScoreExplanation(f,'investigate'):'<p>El IPA ordena prioridad de revisión a partir de hechos observables. No estima probabilidad de delito.</p>';
  return v17InfoButton('Metodología del IPA',body,true);
}

function v0201FindingDrawerHtml(f,ctx){
  const p=f.payload||{},facts=p.decision_facts||{},signals=v0201SignalRows(f,ctx),score=Number(f.score_investigate),band=v0201Band(score),sector=v019Array(p.sector_names)[0];
  const next=v019Array(p.suggested_next_steps).filter(Boolean).slice(0,3);
  const sources=v019Array(p.producer_ids);
  return `<div class="v0201-finding">
    <div class="v0201-kicker">${esc(v019FindingType(f.finding_type))}</div>
    <div class="v0201-title-row"><div><h2>${esc(p.entity_label||f.title||'Hallazgo')}</h2><p>${esc(f.region||'')}${f.commune?` · ${esc(f.commune)}`:''}${f.entity_id?` · RUT ${esc(v0201FmtRut(f))}`:''}</p></div><div class="v0201-score ${esc(band.cls)}"><b>${v019Fmt(score,1)}</b><span>IPA · ${esc(band.label)}</span></div></div>
    <section class="v0201-hero"><span>QUÉ LLAMA LA ATENCIÓN</span><h3>${signals.length===1?'1 elemento concreto para revisar':`${signals.length} elementos concretos para revisar`}</h3><p>${esc(v0201WhyText(f,signals))}</p></section>
    <div class="v0201-signal-list">${signals.map(s=>`<article class="v0201-signal ${esc(s.tone)}"><span></span><div><b>${esc(s.label)}</b>${s.detail?`<small>${esc(s.detail)}</small>`:''}</div></article>`).join('')}</div>
    ${v0201MetricsHtml(v0201MetricRows(f))}
    <section class="v0201-block"><div class="v0201-block-head"><h3>Hechos que sostienen la revisión</h3><span>evidencia observable</span></div><div class="v0201-fact-grid"><div><span>Fuentes</span><b>${v019Fmt(facts.independent_sources??f.source_count)}</b></div><div><span>Evidencias</span><b>${v019Fmt(f.evidence_count??facts.evidence_count)}</b></div><div><span>Anomalías</span><b>${v019Fmt(facts.contextual_anomalies||0)}</b></div><div><span>Sanciones</span><b>${v019Fmt(facts.sanctions||0)}</b></div></div>${sector?`<div class="v0201-context-line"><span>Sector</span><b>${esc(sector)}</b></div>`:''}<div class="v019-chips">${sources.map(x=>`<span class="v019-chip">${esc(String(x).replace('RADAR_',''))}</span>`).join('')}</div></section>
    ${v0201SanctionHtml(ctx.sanctions)}
    ${next.length?`<section class="v0201-block"><div class="v0201-block-head"><h3>Siguiente revisión útil</h3></div><div class="v0201-next">${next.map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`:''}
    <div class="v0201-guardrail">${esc(v019Array(p.contradicting_factors)[0]||'El IPA ordena revisión; no acredita delito, LA/FT ni incumplimiento.')}</div>
    <div class="v019-actions">${f.entity_id?'<button type="button" class="v019-action" id="v0201-open-entity">Abrir Entidad 360</button>':''}<button type="button" class="v019-action" id="v0201-go-findings">Ver hallazgos</button></div>
    <div class="v0201-method">${v0201MethodButton(f)}</div>
  </div>`;
}

v019OpenFinding=async function(f){
  if(!f)return;
  V0201_FINDING_MAP.set(f.finding_key||f.finding_id||String(Math.random()),f);
  v019OpenDrawer(`<div class="v0201-loading"><b>Preparando lectura del hallazgo…</b><span>Buscando inusualidades y evidencia relacionada.</span></div>`);
  let ctx;try{ctx=await v0201FindingContext(f);}catch{ctx={related:[f],tax:null,sanctions:[]};}
  const body=document.querySelector('#v019-drawer-body');if(!body)return;
  body.innerHTML=v0201FindingDrawerHtml(f,ctx);
  document.querySelector('#v0201-open-entity')?.addEventListener('click',()=>{v019CloseDrawer();if(typeof v019LegacyOpenEntity==='function')v019LegacyOpenEntity(f.entity_id);});
  document.querySelector('#v0201-go-findings')?.addEventListener('click',()=>{v019CloseDrawer();if(typeof loadFindings==='function'){state.view='findings';loadFindings();}});
};

function v0201FindingCardSummary(f){
  const p=f.payload||{},facts=p.decision_facts||{},names=v0201ParseAnomalyText(p.explanation);
  if(names.length)return names.slice(0,3).join(' · ')+(names.length>3?' · …':'');
  if(Number(facts.sanctions)>0)return `${v019Fmt(facts.sanctions)} sanción(es) vinculada(s) · ${v019Fmt(facts.independent_sources||f.source_count)} fuentes`;
  if(Number(facts.supervisory_gap_candidates)>0)return `${v019Fmt(facts.supervisory_gap_candidates)} pares RUT–actividad para validar · screening agregado`;
  if(Number(facts.direct_aml_signals)>0)return `${v019Fmt(facts.direct_aml_signals)} señal AML gobernada · ${v019Fmt(facts.independent_sources||f.source_count)} fuentes`;
  if(Number(facts.independent_sources)>=3)return `Convergencia en ${v019Fmt(facts.independent_sources)} fuentes · ${v019Fmt(facts.contextual_anomalies||0)} anomalías · ${v019Fmt(facts.observed_relationships||0)} relaciones`;
  return p.explanation||'Hallazgo priorizado para revisión.';
}

v17FindingCards=function(rows,modeKey=typeof V17_FINDING_MODE!=='undefined'?V17_FINDING_MODE:'investigate',compact=false){
  if(!rows.length)return empty('Sin hallazgos','No hay hallazgos vinculados en este corte.');
  const mode=(typeof V17_MODE!=='undefined'&&V17_MODE[modeKey])?V17_MODE[modeKey]:{label:'Investigar'};
  return `<div class="finding-deck v0201-finding-deck">${rows.map(f=>{const key=f.finding_key||f.finding_id;V0201_FINDING_MAP.set(key,f);const p=f.payload||{},facts=p.decision_facts||{},score=v0201ModeScore(f,modeKey),band=v0201Band(score);return `<article class="finding-card ${compact?'compact':''} v0201-finding-card"><div class="finding-card-head"><div><div class="finding-type">${esc(v019FindingType(f.finding_type))}</div><h3>${esc(p.entity_label||f.title||v019FindingType(f.finding_type))}</h3></div><div class="priority-box ${esc(band.cls)}"><span>Prioridad</span><strong>${v019Fmt(score,1)}</strong><small>${esc(band.label)}</small></div></div><p class="v0201-card-insight">${esc(v0201FindingCardSummary(f))}</p><div class="v0201-card-facts"><span><b>${v019Fmt(facts.independent_sources??f.source_count)}</b> fuentes</span><span><b>${v019Fmt(f.evidence_count??facts.evidence_count)}</b> evidencias</span>${Number(facts.contextual_anomalies)>0?`<span><b>${v019Fmt(facts.contextual_anomalies)}</b> anomalías</span>`:''}${Number(facts.sanctions)>0?`<span><b>${v019Fmt(facts.sanctions)}</b> sanciones</span>`:''}</div><div class="card-actions"><button type="button" class="info-btn compact" data-v0201-finding="${esc(key)}">Ver lo importante</button>${f.entity_id?`<button type="button" class="info-btn compact" data-v0201-entity="${esc(f.entity_id)}">Entidad 360</button>`:''}</div></article>`;}).join('')}</div>`;
};

v17RenderFindingsPage=function(rows,totalCount=typeof V17_FINDINGS_TOTAL!=='undefined'?V17_FINDINGS_TOTAL:rows.length){
  V17_FINDINGS_CACHE=rows||[];V17_FINDINGS_TOTAL=Number(totalCount??V17_FINDINGS_CACHE.length);
  const mode=V17_MODE[V17_FINDING_MODE];
  const sorted=[...V17_FINDINGS_CACHE].sort((a,b)=>(v17HasNumber(b[mode.scoreField])?Number(b[mode.scoreField]):-Infinity)-(v17HasNumber(a[mode.scoreField])?Number(a[mode.scoreField]):-Infinity));
  content().innerHTML=`<div class="workbench-toolbar"><div><h2>Qué merece revisión</h2><p>Mostrando ${fmtNum(V17_FINDINGS_CACHE.length)} de ${fmtNum(V17_FINDINGS_TOTAL)} hallazgo(s). Abre una ficha para ver primero la inusualidad y la evidencia concreta.</p></div><div class="toolbar-actions">${v17ModeSelector()}<button type="button" class="secondary compact-action" id="export-findings">Exportar ${fmtNum(V17_FINDINGS_CACHE.length)} filas CSV</button></div></div><div class="v0201-findings-note"><b>Regla de lectura:</b> el score sólo ordena. La ficha explica qué cambió, qué coincide o qué antecedente concreto merece revisión.</div>${v17FindingCards(sorted,V17_FINDING_MODE,false)}`;
  document.querySelectorAll('[data-v17-mode]').forEach(btn=>btn.addEventListener('click',()=>{V17_FINDING_MODE=btn.dataset.v17Mode;v17RenderFindingsPage(V17_FINDINGS_CACHE,V17_FINDINGS_TOTAL);}));
  document.querySelector('#export-findings')?.addEventListener('click',()=>v17ExportFindings(sorted));
};

v020OpenBudgetSignal=function(i,budget){
  const s=v019Array(budget?.top_signals)[i];if(!s)return;
  const observed=Number(s.observed_value??s.transaction_amount),expected=Number(s.expected_value),ratio=Number.isFinite(observed)&&Number.isFinite(expected)&&expected>0?observed/expected:null;
  let checks=[];try{checks=Array.isArray(s.recommended_checks)?s.recommended_checks:JSON.parse(s.recommended_checks||'[]');}catch{}
  const signals=[];
  if(Number.isFinite(observed)&&Number.isFinite(expected)&&expected>0)signals.push({label:`Monto observado ${ratio>=10?`${v019Fmt(ratio,0)}×`:`${v019Fmt(ratio,1)}×`} sobre la referencia`,detail:`$${v019Fmt(observed)} observado frente a $${v019Fmt(expected)} esperado para el grupo comparable.`});
  if(Number(s.provider_signal_count)>0)signals.push({label:`${v019Fmt(s.provider_signal_count)} señales asociadas al proveedor`,detail:`${v019Fmt(s.provider_signal_types||0)} tipos de patrón en el radar de gasto.`});
  if(Number(s.cgr_match_count)>0)signals.push({label:'Coincidencia candidata con evidencia CGR',detail:`${v019Fmt(s.cgr_match_count)} enlace(s) candidato(s) · ${v019Fmt(s.cgr_finding_count||0)} hallazgo(s) en Radar CGR.`});
  v019OpenDrawer(`<div class="v0201-finding"><div class="v0201-kicker">Presupuesto Abierto · preview</div><div class="v0201-title-row"><div><h2>${esc(s.provider_or_recipient_name||s.organization_name||'Señal')}</h2><p>${esc(s.organization_name||'')} · ${esc(s.signal_type||'Señal')}</p></div><div class="v0201-score med"><b>${v019Fmt(s.investigation_priority_score)}</b><span>prioridad</span></div></div><section class="v0201-hero"><span>QUÉ LLAMA LA ATENCIÓN</span><h3>${esc(s.why_flagged||'Patrón inusual en gasto público')}</h3><p>El score ordena la cola del radar; aquí se muestran los hechos que explican por qué vale la pena abrir el caso.</p></section><div class="v0201-signal-list">${signals.map(x=>`<article class="v0201-signal attention"><span></span><div><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></div></article>`).join('')||'<article class="v0201-signal neutral"><span></span><div><b>Señal priorizada</b><small>Revisar documento y contexto transaccional.</small></div></article>'}</div>${checks.length?`<section class="v0201-block"><div class="v0201-block-head"><h3>Siguiente revisión útil</h3></div><div class="v0201-next">${checks.slice(0,4).map(x=>`<span>${esc(x)}</span>`).join('')}</div></section>`:''}<div class="v0201-guardrail">${esc(budget?.guardrail||'Preview no canónico: requiere verificación documental y no constituye hallazgo AML.')}</div></div>`);
};

v019OpenGapRegion=function(region,core){
  const g=core.gaps.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region)&&x.gap_attention_index!==null);if(!g)return;
  const per1000=Number(g.candidate_pairs_per_1000_entities);
  v019OpenDrawer(`<div class="v0201-finding"><div class="v0201-kicker">Inteligencia UAF · screening regional</div><div class="v0201-title-row"><div><h2>${esc(v019RegionShort(region))}</h2><p>Brecha potencial para validar, no incumplimiento</p></div><div class="v0201-score low"><b>${v019Fmt(g.gap_attention_index,1)}</b><span>prioridad</span></div></div><section class="v0201-hero"><span>QUÉ LLAMA LA ATENCIÓN</span><h3>${v019Fmt(g.candidate_pairs)} pares RUT–actividad requieren validación</h3><p>Se distribuyen en ${v019Fmt(g.sector_breadth)} sectores dentro de un universo regional de ${v019Fmt(g.entity_universe)} entidades.</p></section><div class="v0201-signal-list"><article class="v0201-signal attention"><span></span><div><b>Volumen de screening</b><small>${v019Fmt(g.candidate_pairs)} pares con match fuerte SII no observados en el corte público UAF.</small></div></article>${Number.isFinite(per1000)?`<article class="v0201-signal context"><span></span><div><b>Densidad regional</b><small>${v019Fmt(per1000,1)} pares por cada 1.000 entidades del universo materializado.</small></div></article>`:''}</div><div class="v0201-guardrail">Pares RUT–actividad ≠ personas jurídicas únicas. Actividad SII ≠ obligación UAF por sí sola. No observado en el corte ≠ jurídicamente no inscrito.</div><div class="v019-actions"><button type="button" class="v019-action" id="v0201-open-uaf">Abrir Inteligencia UAF</button></div></div>`);
  document.querySelector('#v0201-open-uaf')?.addEventListener('click',()=>{v019CloseDrawer();v019LoadUaf(region);});
};

v019OpenRegion=function(region,core){
  const r=core.regions.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region));if(!r)return;
  const findings=core.findings.filter(f=>v019RegionNorm(f.region)===v019RegionNorm(region)).sort((a,b)=>v019Num(b.score_investigate)-v019Num(a.score_investigate)).slice(0,5);
  v019OpenDrawer(`<div class="v0201-finding"><div class="v0201-kicker">Territorio · lectura regional</div><div class="v0201-title-row"><div><h2>${esc(v019RegionShort(region))}</h2><p>Concentración de hallazgos, no incidencia LA/FT</p></div><div class="v0201-score low"><b>${v019Fmt(r.attention_index,1)}</b><span>atención</span></div></div><section class="v0201-hero"><span>QUÉ LLAMA LA ATENCIÓN</span><h3>${v019Fmt(r.finding_count)} hallazgos materializados</h3><p>${v019Fmt(r.high_priority_count)} tienen IPA ≥60; el máximo regional es ${v019Fmt(r.max_investigate,1)}.</p></section>${findings.length?`<section class="v0201-block"><div class="v0201-block-head"><h3>Hallazgos que explican la atención</h3></div><div class="v0201-mini-list">${findings.map(f=>{const key=f.finding_key||f.finding_id;V0201_FINDING_MAP.set(key,f);return `<button type="button" data-v0201-finding="${esc(key)}"><span><b>${esc(v019Truncate(f.payload?.entity_label||f.title||'Hallazgo',62))}</b><small>${esc(v019FindingType(f.finding_type))} · ${v019Fmt(f.source_count)} fuentes</small></span><strong>${v019Fmt(f.score_investigate,1)}</strong></button>`;}).join('')}</div></section>`:''}<div class="v0201-guardrail">Una concentración territorial de hallazgos ordena revisión; no implica causalidad ni mayor incidencia de LA/FT.</div></div>`);
};

if(!window.__V0201_INSIGHT_EVENTS){
  window.__V0201_INSIGHT_EVENTS=true;
  document.addEventListener('click',e=>{
    const fbtn=e.target.closest('[data-v0201-finding]');
    if(fbtn){const f=V0201_FINDING_MAP.get(fbtn.dataset.v0201Finding);if(f){e.preventDefault();v019OpenFinding(f);}return;}
    const ebtn=e.target.closest('[data-v0201-entity]');
    if(ebtn&&typeof v019LegacyOpenEntity==='function'){e.preventDefault();v019LegacyOpenEntity(ebtn.dataset.v0201Entity);}
  });
}
