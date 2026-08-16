'use strict';

/* AML Workbench v0.19.1 · strategic tuning layer
 * - UAF terminology: sujetos obligados / inscritos en la UAF
 * - deeper screening-gap analysis
 * - SII economic context from Context Hub
 * - real Chile silhouette map adapted from Monitor Prensa
 * - explainable intelligence marks (not conclusions)
 */

const V0191='0.19.1';
const V0191_ECON_URL='https://raw.githubusercontent.com/smoralesm07-source/Context-Hub/main/data/gold/economic_system_snapshot_v1.json';
const v0191BaseLoadCore=v019LoadCore;
const v0191BaseLoadOverview=v019LoadOverview;
const v0191BaseRenderTerritoryDetail=v019RenderTerritoryDetail;
const v0191BaseSearchEntity=v019SearchEntity;

const V0191_REGION_CODE={
  'Tarapacá':'01','Antofagasta':'02','Atacama':'03','Coquimbo':'04','Valparaíso':'05',
  "Libertador General Bernardo O'Higgins":'06','Maule':'07','Biobío':'08','La Araucanía':'09',
  'Los Lagos':'10','Aysén del General Carlos Ibáñez del Campo':'11','Magallanes y de la Antártica Chilena':'12',
  'Metropolitana de Santiago':'13','Los Ríos':'14','Arica y Parinacota':'15','Ñuble':'16'
};
const V0191_REGION_GEO={
  'Arica y Parinacota':[-70.31,-18.48],'Tarapacá':[-70.14,-20.22],'Antofagasta':[-70.4,-23.65],
  'Atacama':[-70.33,-27.37],'Coquimbo':[-71.25,-29.9],'Valparaíso':[-71.62,-33.05],
  'Metropolitana de Santiago':[-70.67,-33.45],"Libertador General Bernardo O'Higgins":[-70.74,-34.17],
  'Maule':[-71.67,-35.43],'Ñuble':[-72.1,-36.61],'Biobío':[-73.05,-36.82],
  'La Araucanía':[-72.59,-38.74],'Los Ríos':[-73.25,-39.81],'Los Lagos':[-72.94,-41.47],
  'Aysén del General Carlos Ibáñez del Campo':[-72.07,-45.57],'Magallanes y de la Antártica Chilena':[-70.91,-53.16]
};
const V0191_REGION_ABBR={
  'Arica y Parinacota':'AP','Tarapacá':'TA','Antofagasta':'AN','Atacama':'AT','Coquimbo':'CO','Valparaíso':'VA',
  'Metropolitana de Santiago':'RM',"Libertador General Bernardo O'Higgins":'OH','Maule':'ML','Ñuble':'NB',
  'Biobío':'BB','La Araucanía':'AR','Los Ríos':'LR','Los Lagos':'LL','Aysén del General Carlos Ibáñez del Campo':'AY',
  'Magallanes y de la Antártica Chilena':'MG'
};
const V0191_MAP_BOUNDS={minLon:-75.644395,minLat:-55.611830,maxLon:-66.959920,maxLat:-17.580012,x0:36,x1:765,y0:42,y1:224};
const V0191_MAP_PATHS=[
  'M731.0,182.5 L775.3,182.5 L775.8,216.0 L783.8,209.4 L790.0,192.2 L787.8,170.5 L781.8,155.9 L778.9,134.9 L757.2,89.3 L735.0,61.7 L739.2,78.2 L752.4,106.3 L759.5,132.9 L750.4,143.2 L736.9,149.7 L728.7,168.2 L731.0,182.5 Z',
  'M36.0,163.3 L49.5,173.1 L63.8,175.8 L72.2,186.3 L91.4,180.0 L113.6,190.8 L140.9,198.6 L138.2,213.1 L143.2,215.5 L163.8,208.6 L173.6,186.8 L206.6,187.4 L213.0,183.2 L220.8,189.2 L233.1,175.1 L251.7,162.0 L269.7,154.8 L288.9,156.7 L309.3,144.4 L343.5,153.6 L347.1,158.8 L365.4,158.8 L384.7,147.3 L401.3,147.8 L414.2,132.6 L432.4,132.7 L451.8,138.8 L459.0,126.8 L497.0,116.7 L521.2,120.1 L525.2,112.0 L548.1,116.7 L555.6,125.8 L563.9,119.2 L567.9,128.4 L575.3,130.6 L579.1,121.8 L590.7,124.0 L617.0,116.7 L633.9,106.1 L643.9,108.4 L656.5,102.0 L665.2,86.7 L686.3,88.4 L693.4,95.5 L692.2,108.8 L707.0,108.4 L718.6,116.7 L721.2,165.1 L724.3,183.7 L724.2,165.9 L736.2,138.2 L754.7,134.9 L755.2,126.4 L748.8,103.8 L734.9,80.9 L723.6,56.0 L711.0,49.7 L699.4,55.4 L686.2,45.3 L652.4,42.7 L633.4,51.2 L618.1,72.4 L612.3,42.0 L594.8,61.1 L561.8,67.9 L568.8,90.2 L527.7,100.6 L522.5,87.2 L547.2,80.9 L544.4,68.3 L479.3,81.4 L465.8,90.6 L446.4,84.9 L424.1,83.2 L423.5,91.6 L359.7,117.8 L330.2,126.3 L300.5,121.7 L284.1,127.6 L259.7,125.2 L235.5,137.0 L197.1,140.6 L111.6,153.3 L79.1,151.8 L51.2,147.6 L46.2,157.9 L36.0,163.3 Z'
];

function v0191MapPoint(lon,lat){const b=V0191_MAP_BOUNDS;return{x:b.x0+(b.maxLat-lat)/(b.maxLat-b.minLat)*(b.x1-b.x0),y:b.y1-(lon-b.minLon)/(b.maxLon-b.minLon)*(b.y1-b.y0)}}
function v0191EconRegion(core,region){const code=V0191_REGION_CODE[v019RegionNorm(region)];return code?v019Num(core?.economy?.regions_2024_by_cut?.[code]):0}
function v0191Pct(v,total){return total>0?100*v019Num(v)/total:0}
function v0191Per1000(v,total){return total>0?1000*v019Num(v)/total:0}
function v0191DeltaPct(a,b){return b>0?100*(v019Num(a)-v019Num(b))/v019Num(b):0}
function v0191Quartile(values,q=.75){const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const i=(a.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo)}

async function v0191FetchEconomy(){
  if(v019Cache.economy)return v019Cache.economy;
  try{const r=await fetch(V0191_ECON_URL,{cache:'no-store'});if(!r.ok)throw new Error('Context Hub económico no disponible');v019Cache.economy=await r.json();}
  catch(error){v019Cache.economy={error,context_only:true};}
  return v019Cache.economy;
}

v019LoadCore=async function(force=false){
  const core=await v0191BaseLoadCore(force);
  core.economy=await v0191FetchEconomy();
  return core;
};

function v0191ReplaceTerminology(root=document){
  if(!root)return;
  const reps=[
    [/Sujetos observados UAF/gi,'Sujetos obligados UAF inscritos'],
    [/sujetos observados en el corte público/gi,'sujetos obligados inscritos en la UAF'],
    [/Observados en corte UAF/gi,'Inscritos en la UAF'],
    [/Observados UAF/gi,'Inscritos UAF'],
    [/UAF observado/gi,'Inscrito UAF'],
    [/universo UAF observado/gi,'universo de sujetos obligados inscritos en la UAF'],
    [/entidades observadas UAF/gi,'sujetos obligados inscritos en la UAF'],
    [/observados en la UAF/gi,'inscritos en la UAF']
  ];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let n;while((n=walker.nextNode())){let s=n.nodeValue;for(const [rx,to] of reps)s=s.replace(rx,to);if(s!==n.nodeValue)n.nodeValue=s;}
}

function v0191UafCrossBars(core){
  const total=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0)||1;
  const rows=core.uafCross.filter(r=>r.radar_id!=='RADAR_UAF');
  return `<div class="v019-uaf-summary"><div class="v019-uafbox"><span>Inscritos en la UAF</span><b>${v019Fmt(total)}</b><small>sujetos obligados · corte público</small></div><div class="v019-uafbox"><span>Inscritos con 3+ productores</span><b>${v019Fmt(core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0))}</b><small>convergencia de fuentes</small></div><div class="v019-uafbox"><span>Inscritos UAF + sanción</span><b>${v019Fmt(core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0))}</b><small>contexto sancionatorio</small></div></div><div class="v019-bars">${rows.map(r=>`<div class="v019-barrow"><span class="v019-barlabel">${esc(String(r.radar_id).replace('RADAR_',''))}</span><div class="v019-track"><div class="v019-fill green ${v019Width(r.uaf_entities,total)}"></div></div><span class="v019-barvalue">${v019Fmt(r.uaf_entities)}</span></div>`).join('')}</div>`;
}
v019UafCrossBars=v0191UafCrossBars;

function v0191EconomicContext(core){
  const e=core.economy;if(!e||e.error)return `<div class="v019-empty">El Context Hub económico no está disponible en este corte.</div>`;
  const h=e.history_entities||{}, y24=v019Num(h['2024']),y23=v019Num(h['2023']),y20=v019Num(h['2020']);
  const hist=Object.entries(h).sort((a,b)=>Number(a[0])-Number(b[0]));const max=Math.max(...hist.map(x=>v019Num(x[1])),1);
  const top=Object.entries(e.regions_2024_by_cut||{}).sort((a,b)=>v019Num(b[1])-v019Num(a[1])).slice(0,5);
  const names=Object.fromEntries(Object.entries(V0191_REGION_CODE).map(([k,v])=>[v,k]));
  return `<div class="v0191-econ-kpis"><div><span>Empresas-año 2024</span><b>${v019Fmt(e.company_year_rows_2024)}</b><small>corte SII materializado</small></div><div><span>Variación 2023→2024</span><b>${v0191DeltaPct(y24,y23)>=0?'+':''}${v019Fmt(v0191DeltaPct(y24,y23),1)}%</b><small>contexto económico</small></div><div><span>Variación 2020→2024</span><b>${v0191DeltaPct(y24,y20)>=0?'+':''}${v019Fmt(v0191DeltaPct(y24,y20),1)}%</b><small>cinco cortes anuales</small></div><div><span>Activas publicadas</span><b>${v019Fmt(e.kpis?.active_as_published)}</b><small>métrica nativa SII</small></div></div><div class="v0191-econ-body"><div class="v0191-history">${hist.map(([year,val])=>`<div class="v0191-hrow"><span>${esc(year)}</span><div class="v0191-htrack"><i style="width:${Math.max(3,100*v019Num(val)/max).toFixed(1)}%"></i></div><b>${v019Fmt(val)}</b></div>`).join('')}</div><div class="v0191-econ-top"><b>Concentración territorial 2024</b>${top.map(([code,val])=>`<div><span>${esc(v019RegionShort(names[code]||code))}</span><strong>${v019Fmt(v0191Pct(val,e.company_year_rows_2024),1)}%</strong></div>`).join('')}</div></div><div class="v019-note v0191-context-note"><b>Contexto económico, no señal AML:</b> este bloque ayuda a distinguir volumen económico de concentración de alertas. No infiere ventas exactas ni modifica scores de riesgo.</div>`;
}

function v0191IntelligenceMarks(core){
  const regs=core.regions.filter(r=>v019RegionNorm(r.region)!=='Sin región');
  const gaps=core.gaps.filter(g=>v019RegionNorm(g.region)!=='Sin región'&&g.gap_attention_index!==null);
  const topTerr=regs.slice().sort((a,b)=>v019Num(b.attention_index)-v019Num(a.attention_index))[0];
  const topGap=gaps.slice().sort((a,b)=>v019Num(b.gap_attention_index)-v019Num(a.gap_attention_index))[0];
  const econTotal=v019Num(core.economy?.company_year_rows_2024);const candTotal=gaps.reduce((a,g)=>a+v019Num(g.candidate_pairs),0);
  const mismatch=gaps.map(g=>{const econ=v0191EconRegion(core,g.region);return {...g,econ,delta:v0191Pct(g.candidate_pairs,candTotal)-v0191Pct(econ,econTotal)}}).sort((a,b)=>b.delta-a.delta)[0];
  const conv=core.uafRegions.slice().sort((a,b)=>v019Num(b.uaf_three_plus_sources)-v019Num(a.uaf_three_plus_sources))[0];
  const p=core.press?.phenomena?.find(x=>['NEW_ACTIVITY','ELEVATED'].includes(x.status));
  const marks=[];
  if(topGap)marks.push({code:'BRECHA↑',tone:'amber',title:'Brecha de screening elevada',where:v019RegionShort(topGap.region),metric:`IBS ${v019Fmt(topGap.gap_attention_index,1)}`,why:`${v019Fmt(topGap.candidate_pairs)} pares RUT–actividad candidatos`});
  if(mismatch&&mismatch.delta>0)marks.push({code:'ECO↔UAF',tone:'blue',title:'Desalineamiento económico-supervisivo',where:v019RegionShort(mismatch.region),metric:`+${v019Fmt(mismatch.delta,1)} pp`,why:'peso de candidatos sobre-representado frente al peso económico regional'});
  if(conv&&v019Num(conv.uaf_three_plus_sources)>0)marks.push({code:'CONV 3+',tone:'green',title:'Convergencia multisource',where:v019RegionShort(conv.region),metric:v019Fmt(conv.uaf_three_plus_sources),why:'sujetos obligados UAF inscritos presentes en 3+ productores'});
  if(topTerr)marks.push({code:'IAT',tone:v019Num(topTerr.attention_index)>=80?'red':'blue',title:'Atención territorial elevada',where:v019RegionShort(topTerr.region),metric:v019Fmt(topTerr.attention_index,1),why:`${v019Fmt(topTerr.high_priority_count)} hallazgos con prioridad ≥60`});
  if(p)marks.push({code:'PRENSA↗',tone:'press',title:'Momentum contextual',where:p.phenomenon,metric:v019PressStatus(p.status),why:'cambio de cobertura periodística; CONTEXT_ONLY'});
  return `<div class="v0191-marks">${marks.slice(0,5).map(m=>`<article class="v0191-mark ${m.tone}"><span class="code">${esc(m.code)}</span><div><h3>${esc(m.title)}</h3><p><b>${esc(m.where)}</b> · ${esc(m.why)}</p></div><strong>${esc(m.metric)}</strong></article>`).join('')}</div><div class="v019-note"><b>Marca de inteligencia ≠ conclusión:</b> las marcas combinan señales explicables para dirigir atención. Deben abrir evidencia y guardrails antes de cualquier inferencia.</div>`;
}

v019LoadOverview=async function(){
  await v0191BaseLoadOverview();
  try{
    const core=await v019LoadCore();const grid=v019Content()?.querySelector('.v019-grid');if(!grid)return;
    const press=[...grid.children].find(x=>x.textContent.includes('Contexto longitudinal de prensa'));
    const econ=document.createElement('article');econ.className='v019-card v019-full v0191-econ-card';econ.innerHTML=`<div class="v019-card-head"><div><h2>Contexto económico</h2><p>Tamaño y evolución del universo empresarial SII para interpretar concentraciones y brechas.</p></div><span class="hint">Context Hub · CONTEXT_ONLY</span></div>${v0191EconomicContext(core)}`;
    const marks=document.createElement('article');marks.className='v019-card v019-full v0191-marks-card';marks.innerHTML=`<div class="v019-card-head"><div><h2>Marcas de inteligencia</h2><p>Señales explicables que priorizan dónde mirar; no atribuyen delito ni incumplimiento.</p></div><span class="hint">alertas estratégicas</span></div>${v0191IntelligenceMarks(core)}`;
    if(press){grid.insertBefore(econ,press);grid.insertBefore(marks,press);}else{grid.append(econ,marks);}
    v0191ReplaceTerminology(v019Content());
  }catch(e){console.warn('v0.19.1 overview enrichment',e);}
};
loadOverview=v019LoadOverview;

function v0191GapRows(core){
  const econTotal=v019Num(core.economy?.company_year_rows_2024);const candTotal=core.gaps.reduce((a,g)=>a+v019Num(g.candidate_pairs),0);
  return core.gaps.filter(g=>v019RegionNorm(g.region)!=='Sin región').map(g=>{
    const region=v019RegionNorm(g.region),u=core.uafRegions.find(r=>v019RegionNorm(r.region)===region),econ=v0191EconRegion(core,region);
    const registered=v019Num(u?.uaf_observed),candidates=v019Num(g.candidate_pairs);
    return {region,g,u,econ,registered,candidates,registered1000:v0191Per1000(registered,econ),candidate1000:v0191Per1000(candidates,econ),candidatePerRegistered:registered?candidates/registered:null,misalign:v0191Pct(candidates,candTotal)-v0191Pct(econ,econTotal)};
  }).sort((a,b)=>v019Num(b.g.gap_attention_index)-v019Num(a.g.gap_attention_index));
}

v019OpenGapRegion=function(region,core){
  const row=v0191GapRows(core).find(x=>x.region===v019RegionNorm(region));if(!row)return;const {g}=row;
  const rows=core.gaps.filter(x=>v019RegionNorm(x.region)!=='Sin región'&&x.gap_attention_index!==null),maxPairs=Math.max(...rows.map(x=>v019Num(x.candidate_pairs)),1),maxDensity=Math.max(...rows.map(x=>v019Num(x.candidate_pairs_per_1000_entities)),1),maxBreadth=Math.max(...rows.map(x=>v019Num(x.sector_breadth)),1);
  const density=100*v019Num(g.candidate_pairs_per_1000_entities)/maxDensity,volume=100*Math.log1p(v019Num(g.candidate_pairs))/Math.log1p(maxPairs),breadth=100*v019Num(g.sector_breadth)/maxBreadth,calc=.30*density+.50*volume+.20*breadth;
  v019OpenDrawer(`<div class="ey">Supervisión UAF · brecha de screening</div><h2>${esc(v019RegionShort(region))}</h2><p class="lead">Comparación entre sujetos obligados UAF inscritos y universo potencial detectado por reglas de screening. Ordena revisión; no determina incumplimiento.</p><div class="v019-dscore"><b>${v019Fmt(g.gap_attention_index,1)}</b><span>IBS / 100</span></div><div class="v019-dbox"><h3>Inscritos vs potenciales</h3><div class="v0191-gap-compare"><div><span>Inscritos en la UAF</span><b>${v019Fmt(row.registered)}</b><small>corte público</small></div><div><span>Pares candidatos</span><b>${v019Fmt(row.candidates)}</b><small>RUT–actividad; no únicos</small></div><div><span>Empresas-año SII 2024</span><b>${row.econ?v019Fmt(row.econ):'—'}</b><small>contexto económico</small></div><div><span>Candidatos / 1.000 SII</span><b>${row.econ?v019Fmt(row.candidate1000,2):'—'}</b><small>presión de screening</small></div></div></div><div class="v019-dbox"><h3>Fórmula IBS</h3><div class="v019-factor"><span>Densidad relativa de pares · ${v019Fmt(density,1)} × 0,30</span><b>${v019Fmt(.30*density,2)}</b></div><div class="v019-factor"><span>Volumen log-normalizado · ${v019Fmt(volume,1)} × 0,50</span><b>${v019Fmt(.50*volume,2)}</b></div><div class="v019-factor"><span>Amplitud sectorial · ${v019Fmt(breadth,1)} × 0,20</span><b>${v019Fmt(.20*breadth,2)}</b></div><div class="v019-factor"><span><b>Resultado</b></span><b>${v019Fmt(calc,2)}</b></div></div><div class="v019-dbox"><h3>Marca económica-supervisiva</h3><div class="v019-plain">Peso de candidatos vs peso económico regional: <b>${row.misalign>=0?'+':''}${v019Fmt(row.misalign,1)} pp</b>. Una sobre-representación positiva sugiere revisar composición sectorial, no asumir menor cumplimiento.</div></div><div class="v019-dbox warn"><h3>Limitación jurídica</h3><div class="v019-plain">Los ${v019Fmt(row.candidates)} registros son <b>pares RUT–actividad candidatos</b>, no personas jurídicas únicas. La ausencia de match con el corte de inscritos UAF no confirma que una entidad esté legalmente no inscrita; actividad SII tampoco prueba por sí sola la obligación de reportar.</div></div>`);
};

v019OpenRegion=function(region,core){
  const r=core.regions.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region));if(!r)return;const gap=core.gaps.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region)),uaf=core.uafRegions.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region)),econ=v0191EconRegion(core,region);
  const maxHigh=Math.max(...core.regions.filter(x=>v019RegionNorm(x.region)!=='Sin región').map(x=>v019Num(x.high_priority_count)),1),p90=v019Num(r.p90_investigate),volume=100*Math.log1p(v019Num(r.high_priority_count))/Math.log1p(maxHigh),sources=Math.min(100,25*v019Num(r.avg_sources)),calc=.65*p90+.25*volume+.10*sources;
  v019OpenDrawer(`<div class="ey">Atención territorial</div><h2>${esc(v019RegionShort(region))}</h2><p class="lead">Índice para ordenar revisión regional usando hallazgos estructurados. Contexto económico y prensa se muestran separadamente y no alteran el IAT.</p><div class="v019-dscore"><b>${v019Fmt(r.attention_index,1)}</b><span>IAT / 100</span></div><div class="v019-dbox"><h3>Fórmula</h3><div class="v019-factor"><span>P90 prioridad investigativa · ${v019Fmt(p90,1)} × 0,65</span><b>${v019Fmt(.65*p90,2)}</b></div><div class="v019-factor"><span>Volumen relativo de hallazgos ≥60 · ${v019Fmt(volume,1)} × 0,25</span><b>${v019Fmt(.25*volume,2)}</b></div><div class="v019-factor"><span>Diversidad media de fuentes · ${v019Fmt(sources,1)} × 0,10</span><b>${v019Fmt(.10*sources,2)}</b></div><div class="v019-factor"><span><b>Resultado</b></span><b>${v019Fmt(calc,2)}</b></div></div><div class="v019-dbox"><h3>Lectura regional</h3><div class="v019-plain">${v019Fmt(r.finding_count)} hallazgos · ${v019Fmt(r.high_priority_count)} con prioridad ≥60 · máximo ${v019Fmt(r.max_investigate,1)}.</div>${uaf?`<div class="v019-plain">Sujetos obligados UAF inscritos: <b>${v019Fmt(uaf.uaf_observed)}</b>.</div>`:''}${gap?`<div class="v019-plain">Screening de brecha: <b>${v019Fmt(gap.candidate_pairs)}</b> pares candidatos · IBS ${v019Fmt(gap.gap_attention_index,1)}.</div>`:''}${econ?`<div class="v019-plain">Contexto SII 2024: <b>${v019Fmt(econ)}</b> empresas-año.</div>`:''}</div><div class="v019-dbox warn"><h3>Guardrail</h3><div class="v019-plain">Concentración territorial de hallazgos no implica causalidad ni mayor incidencia LA/FT. Los indicadores ordenan revisión y deben abrir evidencia.</div></div><div class="v019-actions"><button class="v019-action" type="button" id="v019-open-territory">Abrir territorio</button></div>`);
  document.querySelector('#v019-open-territory')?.addEventListener('click',()=>{v019CloseDrawer();v019LoadTerritory(region);});
};

v019LoadUaf=async function(selectedRegion=''){
  state.view='uaf';shell('Supervisión UAF','Sujetos obligados UAF inscritos, universo potencial detectado por screening y brechas territoriales/sectoriales con contexto económico.');
  try{
    const core=await v019LoadCore(),rows=v0191GapRows(core),total=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0),gapTotal=rows.reduce((a,r)=>a+r.candidates,0),econTotal=v019Num(core.economy?.company_year_rows_2024);
    const maxSector=Math.max(...core.gapSectors.map(x=>v019Num(x.candidate_pairs)),1);
    const hot=rows.filter(r=>v019Num(r.g.gap_attention_index)>=60).length;
    v019Content().innerHTML=`<section class="v019-grid"><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Universo de sujetos obligados UAF inscritos</h2><p>Inscritos en la UAF y presencia de esos sujetos en los demás productores materializados.</p></div><span class="hint">corte público</span></div>${v0191UafCrossBars(core)}</article><article class="v019-card v019-full v0191-gap-hero"><div class="v019-card-head"><div><h2>Brecha entre inscritos y potenciales sujetos obligados</h2><p>El universo potencial se aproxima mediante pares RUT–actividad candidatos; se mantiene separado del universo jurídico confirmado.</p></div><span class="hint">screening ≠ incumplimiento</span></div><div class="v0191-gap-kpis"><div><span>Inscritos UAF</span><b>${v019Fmt(total)}</b><small>sujetos obligados</small></div><div><span>Pares candidatos</span><b>${v019Fmt(gapTotal)}</b><small>potenciales · no deduplicados</small></div><div><span>Regiones IBS ≥60</span><b>${v019Fmt(hot)}</b><small>atención supervisiva</small></div><div><span>Candidatos / 1.000 SII</span><b>${econTotal?v019Fmt(v0191Per1000(gapTotal,econTotal),2):'—'}</b><small>contexto económico 2024</small></div></div><div class="v0191-gap-table"><div class="v0191-gap-head"><span>Región</span><span>Inscritos</span><span>Candidatos</span><span>Cand./1.000 SII</span><span>Cand./inscrito</span><span>IBS</span></div>${rows.map(r=>`<button type="button" class="v0191-gap-row" data-gap-region="${esc(r.region)}"><span><b>${esc(v019RegionShort(r.region))}</b><small>${r.misalign>=0?'+':''}${v019Fmt(r.misalign,1)} pp vs peso económico</small></span><span>${v019Fmt(r.registered)}</span><span>${v019Fmt(r.candidates)}</span><span>${r.econ?v019Fmt(r.candidate1000,2):'—'}</span><span>${r.candidatePerRegistered!==null?v019Fmt(r.candidatePerRegistered,2)+'×':'—'}</span><span><b>${r.g.gap_attention_index!==null?v019Fmt(r.g.gap_attention_index,1):'—'}</b></span></button>`).join('')}</div><div class="v019-note warn"><b>Lectura correcta:</b> “candidatos” mide presión de screening, no número de entidades no inscritas. La razón candidatos/inscrito tampoco es una tasa de cobertura legal.</div></article><article class="v019-card"><div class="v019-card-head"><div><h2>Sectores con mayor brecha potencial</h2><p>Participación en el screening de pares RUT–actividad.</p></div><span class="hint">top 12</span></div><div class="v019-bars">${core.gapSectors.slice(0,12).map(s=>`<div class="v019-barrow"><span class="v019-barlabel">${esc(v019Truncate(s.sector_name,34))}</span><div class="v019-track"><div class="v019-fill amber ${v019Width(s.candidate_pairs,maxSector)}"></div></div><span class="v019-barvalue">${v019Fmt(s.candidate_pairs)}</span></div>`).join('')}</div></article><article class="v019-card"><div class="v019-card-head"><div><h2>Contexto económico para supervisión</h2><p>Normaliza volumen de screening por tamaño económico regional.</p></div><span class="hint">SII 2024</span></div>${v0191EconomicContext(core)}</article></section>`;
    v019BindCommon(core);document.querySelectorAll('.v0191-gap-row[data-gap-region]').forEach(el=>el.addEventListener('click',()=>v019OpenGapRegion(el.dataset.gapRegion,core)));v0191ReplaceTerminology(v019Content());if(selectedRegion)setTimeout(()=>v019OpenGapRegion(selectedRegion,core),0);
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};

function v0191MapLevel(v){const n=v019Num(v);return n>=80?5:n>=65?4:n>=50?3:n>=35?2:n>0?1:0}
function v0191TerritoryMap(core,selected){
  const regions=core.regions.filter(r=>v019RegionNorm(r.region)!=='Sin región'),gaps=core.gaps.filter(g=>v019RegionNorm(g.region)!=='Sin región'),maxHigh=Math.max(...regions.map(r=>v019Num(r.high_priority_count)),1),gapQ=v0191Quartile(gaps.map(g=>v019Num(g.gap_attention_index)),.75);
  const land=`<g class="v0191-map-geography" transform="translate(0 266) scale(1 -1)">${V0191_MAP_PATHS.map(d=>`<path class="v0191-map-land" d="${d}"/>`).join('')}</g>`;
  const andes=Object.entries(V0191_REGION_GEO).map(([name,[lon,lat]])=>{const p=v0191MapPoint(lon+.55,lat);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ');
  const bubbles=Object.entries(V0191_REGION_GEO).map(([name,[lon,lat]])=>{const r=regions.find(x=>v019RegionNorm(x.region)===name),g=gaps.find(x=>v019RegionNorm(x.region)===name),p=v0191MapPoint(lon,lat),level=v0191MapLevel(r?.attention_index),radius=6+11*Math.sqrt(v019Num(r?.high_priority_count)/maxHigh),active=name===selected?' active':'',gapHot=v019Num(g?.gap_attention_index)>=gapQ&&v019Num(g?.gap_attention_index)>0;return `<g class="v0191-map-hit${active}" tabindex="0" role="button" data-territory-select="${esc(name)}" aria-label="${esc(name)}: IAT ${v019Fmt(r?.attention_index,1)}; IBS ${v019Fmt(g?.gap_attention_index,1)}"><circle class="v0191-map-bubble level${level}${active}${gapHot?' gap-hot':''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius.toFixed(1)}"><title>${esc(v019RegionShort(name))} · IAT ${v019Fmt(r?.attention_index,1)} · IBS ${v019Fmt(g?.gap_attention_index,1)}</title></circle>${gapHot?`<circle class="v0191-gap-dot" cx="${(p.x+radius*.7).toFixed(1)}" cy="${(p.y-radius*.7).toFixed(1)}" r="3.5"/>`:''}<text class="v0191-map-abbr${level>=4?' light':''}" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${V0191_REGION_ABBR[name]}</text></g>`}).join('');
  return `<div class="v0191-map"><svg viewBox="0 0 820 282" role="img" aria-label="Mapa físico de Chile con alertas territoriales AML"><defs><linearGradient id="v0191Ocean" x1="0" x2="1"><stop offset="0" stop-color="#e9f5f7"/><stop offset="1" stop-color="#f9fcfd"/></linearGradient></defs><rect class="v0191-map-bg" fill="url(#v0191Ocean)" x="0" y="0" width="820" height="282" rx="12"/><line class="v0191-ocean-line" x1="24" y1="82" x2="790" y2="82"/><line class="v0191-ocean-line" x1="24" y1="143" x2="790" y2="143"/><line class="v0191-ocean-line" x1="24" y1="204" x2="790" y2="204"/><text class="v0191-map-axis" x="30" y="24">NORTE</text><text class="v0191-map-axis" text-anchor="end" x="785" y="24">SUR</text><text class="v0191-map-axis" x="31" y="39">CORDILLERA · ESTE</text><text class="v0191-map-axis" x="31" y="252">PACÍFICO · OESTE</text>${land}<polyline class="v0191-andes" points="${andes}"/>${bubbles}<g transform="translate(28 268)"><circle class="v0191-map-bubble level2" cx="0" cy="0" r="6"/><text class="v0191-map-axis" x="10" y="3">IAT por color · tamaño = hallazgos ≥60</text><circle class="v0191-gap-dot" cx="184" cy="0" r="3.5"/><text class="v0191-map-axis" x="192" y="3">IBS en cuartil superior</text></g></svg></div>`;
}
v019TerritoryMap=v0191TerritoryMap;

function v0191TerritoryAlerts(core){
  const rows=core.regions.filter(r=>v019RegionNorm(r.region)!=='Sin región').map(r=>{const region=v019RegionNorm(r.region),g=core.gaps.find(x=>v019RegionNorm(x.region)===region),u=core.uafRegions.find(x=>v019RegionNorm(x.region)===region);return {region,r,g,u,score:.58*v019Num(r.attention_index)+.42*v019Num(g?.gap_attention_index)}}).sort((a,b)=>b.score-a.score).slice(0,6);
  return `<div class="v0191-map-alerts">${rows.map((x,i)=>`<button type="button" data-territory-select="${esc(x.region)}"><span class="rank">${i+1}</span><div><b>${esc(v019RegionShort(x.region))}</b><small>IAT ${v019Fmt(x.r.attention_index,1)} · IBS ${v019Fmt(x.g?.gap_attention_index,1)} · ${v019Fmt(x.u?.uaf_observed)} inscritos UAF</small></div><strong>${v019Fmt(x.score,1)}</strong></button>`).join('')}</div>`;
}

v019RenderTerritoryDetail=async function(region,core){
  await v0191BaseRenderTerritoryDetail(region,core);
  const box=document.querySelector('#v019-territory-detail');if(!box)return;const econ=v0191EconRegion(core,region),g=core.gaps.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region)),u=core.uafRegions.find(x=>v019RegionNorm(x.region)===v019RegionNorm(region));
  const facts=box.querySelector('.v019-facts');if(facts&&econ){facts.insertAdjacentHTML('beforeend',`<div class="v019-fact"><span>Empresas-año SII 2024</span><b>${v019Fmt(econ)}</b></div><div class="v019-fact"><span>Candidatos / 1.000 SII</span><b>${v019Fmt(v0191Per1000(g?.candidate_pairs,econ),2)}</b></div>`);}
  if(u){const note=document.createElement('div');note.className='v019-note v0191-context-note';note.innerHTML=`Sujetos obligados UAF inscritos: <b>${v019Fmt(u.uaf_observed)}</b>. Contexto económico y brecha se presentan como capas separadas del score territorial.`;box.append(note);}v0191ReplaceTerminology(box);
};

v019LoadTerritory=async function(initial=''){
  state.view='territory';shell('Territorio','Mapa físico de Chile con prioridad investigativa, brecha UAF, tamaño económico y principales alertas regionales.');
  try{
    const core=await v019LoadCore(),selected=initial||v019RegionNorm(core.regions.find(r=>v019RegionNorm(r.region)!=='Sin región')?.region)||'Metropolitana de Santiago';
    v019Content().innerHTML=`<section class="v019-grid"><article class="v019-card v019-full v0191-map-card"><div class="v019-card-head"><div><h2>Chile · mapa territorial de inteligencia</h2><p>Geografía real, alertas principales y lectura regional trazable.</p></div><span class="hint">clic en región o alerta</span></div><div class="v0191-map-layout"><div>${v0191TerritoryMap(core,selected)}</div><aside><h3>Alertas territoriales principales</h3><p>Combinación visual IAT + IBS para ordenar navegación; no es un nuevo score de riesgo.</p>${v0191TerritoryAlerts(core)}</aside></div><div class="v019-region-detail v0191-region-detail" id="v019-territory-detail"><div class="v019-loading">Preparando lectura regional…</div></div></article><article class="v019-card"><div class="v019-card-head"><div><h2>Ranking de atención territorial</h2><p>Índice IAT explicado por hallazgos estructurados.</p></div><span class="hint">IAT / 100</span></div>${v019RegionBars(core.regions,16)}</article><article class="v019-card"><div class="v019-card-head"><div><h2>Brecha supervisiva territorial</h2><p>IBS y presión de candidatos frente al universo económico.</p></div><span class="hint">screening</span></div>${v019GapBars(core.gaps,16)}</article><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Principio territorial</h2><p>La geografía localiza concentraciones; no propaga riesgo por cercanía ni crea causalidad.</p></div></div><div class="v019-note">El mapa usa la silueta física y coordenadas regionales del patrón visual de Monitor Prensa, pero aquí representa IAT, IBS y alertas del Workbench. Prensa y contexto económico permanecen como capas explicativas separadas.</div></article></section>`;
    const activate=el=>{const region=el.dataset.territorySelect;document.querySelectorAll('[data-territory-select]').forEach(x=>x.classList.toggle('active',x.dataset.territorySelect===region));v019RenderTerritoryDetail(region,core);};
    document.querySelectorAll('[data-territory-select]').forEach(el=>{el.addEventListener('click',()=>activate(el));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(el);}})});v019BindCommon(core);await v019RenderTerritoryDetail(selected,core);v0191ReplaceTerminology(v019Content());
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};

v019SearchEntity=async function(term){await v0191BaseSearchEntity(term);v0191ReplaceTerminology(document.querySelector('#v019-drawer'));};

/* UI-wide terminology guard: covers legacy entity/sanction views rendered inside the v0.19 shell. */
const v0191Observer=new MutationObserver(records=>{for(const rec of records){for(const node of rec.addedNodes){if(node.nodeType===1)v0191ReplaceTerminology(node);else if(node.nodeType===3&&node.parentElement)v0191ReplaceTerminology(node.parentElement);}}});
v0191Observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

/* Visible patch badge without rebuilding the base shell. */
(function v0191Badge(){const tick=()=>{const s=document.querySelector('.v019-brand small');if(s&&!s.textContent.includes(V0191))s.textContent=`Operational Radar · v${V0191}`;v0191ReplaceTerminology(document.querySelector('.v019-shell'));};setInterval(tick,1200);setTimeout(tick,50);})();
