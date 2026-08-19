'use strict';

/* v0.36.0 hardening · exact analytical fidelity to radarintegradoreal.html */
const V036_PROTO_FINANCIAL_ALIAS=new Set(['EMPRESAS DE DEPOSITO DE VALORES REGIDAS POR LA LEY N 18 876']);
const V036_CROSS_SECTOR_VIEW='aml_v024_uaf_cross_sector';

/* Preserve the proposal's segmentation, including the only typography variant
 * that differs after normalization from the current Workbench alias list. */
const v036HardBaseSegment=v036Segment;
v036Segment=function(name){
  const n=v036Norm(name);
  if(V036_PROTO_FINANCIAL_ALIAS.has(n))return 'FINANCIERO';
  return v036HardBaseSegment(name);
};

/* Marks match the delivered proposal exactly:
 * - structural: SO >=100 and intensity <5, excluding absolute silence
 * - rise/fall: only when 2024 base >=10
 * - concentrator: >=3% of 2025 ROS and intensity >=100
 */
v036Marks=function(r){
  const out=[];
  const so=v036N(r.so),intensity=v036N(r.int),d=r.delta;
  if(r.nominal)out.push('nominal');
  if(!r.nominal&&so>=100&&intensity<5)out.push('estructural');
  if(d!==null&&Number.isFinite(Number(d))&&r.base>=10&&Number(d)<=-30)out.push('caida');
  if(d!==null&&Number.isFinite(Number(d))&&r.base>=10&&Number(d)>=100)out.push('alza');
  if(v036N(r.shareROS)>=3&&intensity>=100)out.push('concentrador');
  if(!out.length)out.push('proporcional');
  return out;
};

/* Null deltas remain null. Number(null) would otherwise turn an unavailable
 * comparison into a false 0%, distorting exactly the weak-base convention the
 * delivered design protects. */
v036PrepareRows=function(uaf){
  const sectors=v019Array(uaf?.sectors);
  const totalSO=v036N(uaf?.report?.totals?.registered_so_2025)||v036Sum(sectors,'registered_so_2025');
  const totalROS=v036N(uaf?.report?.totals?.ros_2025)||v036Sum(sectors,'ros_2025');
  return sectors.map(r=>{
    const series=V036_YEARS.map(y=>v036N(r[`ros_${y}`]));
    const so=v036N(r.registered_so_2025),ros=v036N(r.ros_2025),base=v036N(r.ros_2024);
    const rawDelta=r.delta_ros_2025_vs_2024_pct;
    const delta=(rawDelta===null||rawDelta===undefined||rawDelta==='')?null:Number(rawDelta);
    const row={
      name:r.sector_name,
      seg:v036Segment(r.sector_name),
      so,ros,
      int:v036N(r.ros_per_100_so_2025),
      shareSO:totalSO?100*so/totalSO:0,
      shareROS:totalROS?100*ros/totalROS:0,
      delta:Number.isFinite(delta)?delta:null,
      base,
      s:series,
      total:series.reduce((a,v)=>a+v,0),
      nominal:Boolean(r.silence_5y),
      raw:r
    };
    row.marks=v036Marks(row);
    return row;
  });
};

async function v036LoadCrossSector(){
  const {data,error}=await sb.from(V036_CROSS_SECTOR_VIEW).select('radar_id,sector_name,entity_count');
  if(error)throw error;
  return data||[];
}
function v036SectorEquivalent(a,b){
  if(typeof v0193SectorMatch==='function')return v0193SectorMatch(a,b);
  return v036Norm(a)===v036Norm(b);
}
function v036CrossCount(cross,radarId,activeRows){
  return v019Array(cross).filter(x=>String(x.radar_id)===radarId&&activeRows.some(r=>v036SectorEquivalent(r.name,x.sector_name))).reduce((a,x)=>a+v036N(x.entity_count),0);
}
function v036FilteredRadarCards(ctx){
  const active=v036Filtered();
  const so=v036Sum(active,'so'),ros=v036Sum(active,'ros'),cross=ctx.crossSector||[];
  const sii=v036CrossCount(cross,'RADAR_SII',active),san=v036CrossCount(cross,'RADAR_SANCIONES',active),osfl=v036CrossCount(cross,'RADAR_OSFL',active),press=v036CrossCount(cross,'RADAR_PRENSA',active);
  const pmap=new Map(v019Array(ctx.analytics?.producers).map(p=>[String(p.producer_id),p]));
  const region=v036TopRegion(ctx.core),gap=v036TopGap(ctx.core),budget=ctx.analytics?.budget||{};
  const cards=[
    {k:'uaf',n:'Radar UAF',st:'recorte activo',big:`${v036F(active.length)} sectores`,cap:`${v036F(so)} SO · ${v036F(ros)} ROS 2025`,a:'Padrón',av:v036Pct(so,v036Sum(ctx.rows,'so')),b:'Flujo',bv:v036Pct(ros,v036Sum(ctx.rows,'ros')),c:'#5bb4f5'},
    {k:'entities',n:'Radar SII',st:'cruce sectorial',big:v036F(sii),cap:'Entidades UAF del recorte observadas en el cruce sectorial SII',a:'SO recorte',av:v036F(so),b:'Unidad',bv:'entidad',c:'#3b98e0'},
    {k:'sanctions',n:'Radar Sanciones',st:'cruce sectorial',big:v036F(san),cap:'Entidades del recorte con sanción materializada',a:'Eventos globales',av:v036F(v019Array(ctx.analytics?.sanYears).reduce((a,r)=>a+v036N(r.sanction_count),0)),b:'Recorte',bv:`${active.length} sectores`,c:'#ef5350'},
    {k:'osfl',n:'Radar OSFL',st:'cruce sectorial',big:v036F(osfl),cap:'Entidades del recorte observadas también en universo OSFL',a:'SO recorte',av:v036F(so),b:'Contexto',bv:'no adverso',c:'#2c9c66'},
    {k:'press',n:'Radar Prensa',st:'contexto',big:v036F(press),cap:'Entidades del recorte con observación de prensa materializada',a:'Semántica',av:'contexto',b:'Score',bv:'aporte 0',c:'#815f96'},
    {k:'territory',n:'Radar Territorio',st:'sistema',big:region?v036F(region.attention_index,1):'—',cap:region?`${v019RegionShort(region.region)} lidera atención territorial`:'Sin región prioritaria',a:'Filtro sector',av:'no transferido',b:'Unidad',bv:'territorio',c:'#2b7dc0'},
    {k:'cgr',n:'Radar CGR',st:'Fusion',big:v036F(pmap.get('RADAR_CGR')?.finding_count),cap:'Hallazgos CGR materializados en Workbench',a:'Filtro sector',av:'sin cruce',b:'Lectura',bv:'evidencia',c:'#8b5cf6'},
    {k:'budget',n:'Gasto público',st:'preview',big:v036F(budget?.metrics?.priority_p1),cap:`${v036F(budget?.metrics?.signals)} señales en Radar Presupuesto Abierto`,a:'Filtro sector',av:'sin cruce',b:'Estado',bv:'preview',c:'#a8842a'},
    {k:'gap',n:'Brecha UAF',st:'screening',big:gap?v036F(gap.gap_attention_index,1):'—',cap:gap?`${v019RegionShort(gap.region)} · ${v036F(gap.candidate_pairs)} pares RUT–actividad`:'Sin brecha regional',a:'Unidad',av:'pares',b:'Conclusión',bv:'requiere validar',c:'#c99a1e'}
  ];
  return cards.map(c=>`<button class="v036-rcard" data-v036-radar="${c.k}" style="border-top-color:${c.c}"><div class="v036-rcard-head"><b>${c.n}</b><span>${c.st}</span></div><strong>${c.big}</strong><p>${esc(c.cap)}</p><div class="v036-rcard-foot"><span>${c.a} <b>${c.av}</b></span><span>${c.b} <b>${c.bv}</b></span></div><em>Abrir / profundizar →</em></button>`).join('');
}
function v036BindRadarCards(ctx){
  document.querySelectorAll('[data-v036-radar]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.v036Radar;
    if(k==='uaf'){const first=v036Filtered()[0];if(first&&typeof v0193OpenSector==='function')return v0193OpenSector(first.name,ctx.uaf);return;}
    if(k==='sanctions')return void navigate('sanctions');
    if(k==='territory'||k==='gap')return void navigate('territory');
    if(k==='osfl')return void navigate('osfl');
    if(k==='entities')return void navigate('entities');
    if(k==='budget'){if(typeof v020OpenBudgetSignal==='function')return v020OpenBudgetSignal(0,ctx.analytics?.budget);return;}
    if(k==='press'){const p=v036TopPress(ctx.core);if(p&&typeof v019OpenPress==='function'){const i=v019Array(ctx.core?.press?.phenomena).indexOf(p);return v019OpenPress(Math.max(0,i),ctx.core.press);}return;}
    if(k==='cgr'&&typeof v035OpenCgr==='function')return v035OpenCgr(ctx.core);
  }));
}
function v036RenderFilteredConvergence(){
  const ctx=V036_STATE.ctx,host=document.querySelector('.v036-radars');
  if(!ctx||!host||!Array.isArray(ctx.crossSector))return;
  host.innerHTML=v036FilteredRadarCards(ctx);
  v036BindRadarCards(ctx);
}

/* The delivered proposal says the filters govern both the matrix and deck 04.
 * This wrapper makes that contract real using exact sector-level Fusion crosses. */
const v036HardBaseRenderMatrix=v036RenderMatrix;
v036RenderMatrix=function(){
  v036HardBaseRenderMatrix();
  v036RenderFilteredConvergence();
};

function v036PriorityHtml(ctx){
  const candidates=v019Array(ctx?.core?.findings).filter(f=>f.entity_id&&String(f.finding_type)!=='SUPERVISORY_GAP');
  const rows=candidates.slice().sort((a,b)=>v036N(b.score_investigate)-v036N(a.score_investigate)||v036N(b.source_count)-v036N(a.source_count)).slice(0,5);
  if(!rows.length)return '';
  return `<article class="v036-card v036-priority-card"><div class="v036-card-head"><div><h3>Qué revisar primero</h3><p>Casos individualizables para pasar de la lectura sistémica a evidencia concreta sin convertir el dashboard en un ranking único.</p></div><span class="v036-hint">hallazgo → evidencia</span></div><div class="v036-priority-list">${rows.map((f,i)=>`<button type="button" data-v036-finding="${esc(f.finding_key)}"><em>${String(i+1).padStart(2,'0')}</em><span><b>${esc(v036Cut(f.title||f.entity_id,82))}</b><small>${esc(v019FindingType(f.finding_type))} · ${esc(v019RegionShort(f.region||'Sin región'))}</small></span><span><strong>${v036F(f.score_investigate,1)}</strong><small>IPA</small></span><span><strong>${v036F(f.source_count)}</strong><small>fuentes</small></span><span><strong>${v036F(f.evidence_count)}</strong><small>evidencias</small></span></button>`).join('')}</div></article>`;
}
function v036MountPriority(ctx){
  const entries=document.querySelector('.v036-entries');
  if(!entries||document.querySelector('.v036-priority-card'))return;
  entries.insertAdjacentHTML('afterend',v036PriorityHtml(ctx));
  document.querySelectorAll('[data-v036-finding]').forEach(b=>b.addEventListener('click',()=>{
    const f=v019Array(ctx?.core?.findings).find(x=>String(x.finding_key)===String(b.dataset.v036Finding));
    if(f&&typeof v019OpenFinding==='function')v019OpenFinding(f);
  }));
}

/* v024 audit remains useful, but it must behave as a native part of the new
 * command center instead of a passive legacy strip. */
const v036HardBaseBind=v036Bind;
v036Bind=function(ctx){
  v036HardBaseBind(ctx);
  const audit=document.querySelector('[data-v024-audit-toggle]');
  if(audit&&!audit.dataset.v036Bound){
    audit.dataset.v036Bound='1';
    audit.addEventListener('click',()=>{
      const detail=document.querySelector('[data-v024-audit-detail]');
      if(!detail)return;
      const expanded=audit.getAttribute('aria-expanded')==='true';
      audit.setAttribute('aria-expanded',String(!expanded));
      detail.hidden=expanded;
    });
  }
  v036MountPriority(ctx);
};

/* Load cross-sector facts after the primary dashboard is visible. Failure is
 * non-fatal: deck 04 keeps the global radar state already rendered by v036. */
const v036HardBaseOverview=v019LoadOverview;
v019LoadOverview=async function(...args){
  const result=await v036HardBaseOverview(...args);
  const ctx=window.__AML_V036_CONTEXT;
  if(ctx&&window.state?.view==='overview'){
    try{
      ctx.crossSector=await v036LoadCrossSector();
      V036_STATE.ctx=ctx;
      v036RenderFilteredConvergence();
    }catch(error){
      console.warn('[AML v0.36] sector cross-radar convergence unavailable',error);
    }
  }
  return result;
};
loadOverview=v019LoadOverview;

/* Public-entity context is asynchronous; keep it inside the dedicated slot
 * even when the registry finishes after Radar Integrado has rendered. */
const v036PublicObserver=new MutationObserver(()=>{
  if(window.state?.view!=='overview')return;
  const strip=document.querySelector('#v0344-public-overview');
  const slot=document.querySelector('.v036-public-slot');
  if(strip&&slot&&strip.parentElement!==slot)slot.appendChild(strip);
});
v036PublicObserver.observe(document.documentElement,{childList:true,subtree:true});

window.__AML_V036_HARDENING__={
  structural:{minSo:100,maxIntensityExclusive:5},
  deltaBaseMin:10,
  concentrator:{minRosSharePct:3,minIntensity:100},
  nullDeltaPreserved:true,
  publicContextSlot:true,
  auditInteractive:true,
  filteredConvergence:true,
  crossSectorView:V036_CROSS_SECTOR_VIEW,
  priorityQueue:true
};
