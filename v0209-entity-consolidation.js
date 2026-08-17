'use strict';

/* AML Workbench v0.20.9
 * - NO_SII_PROFILE is a technical coverage state, never an alert or review priority.
 * - UAF ↔ SII visible reconciliation is restricted to records with a materialized SII profile.
 * - Entity 360 groups repeated findings by analytical family and exposes one entity-level priority score.
 */
const V0209='0.20.9';
const V0209_FINDING_MAP=new Map();
const V0209_CONTEXT_ONLY_SOURCES=new Set(['RADAR_UAF','RADAR_PRENSA']);
const v0209BaseShell=shell;
const v0209BaseUafMonitor=v0203UafMonitor;
const v0209BaseReconciliation=v0205LoadReconciliation;
const v0209BaseRenderEntity=v0203RenderEntity;
const v0209BaseBindEntity=v0203BindEntity;
const v0209BaseAppendEntityReconciliation=typeof v0205AppendEntityReconciliation==='function'?v0205AppendEntityReconciliation:null;

shell=function(title,subtitle){
  v0209BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0209}`;
};

function v0209FindingKey(f){
  return String(f?.finding_type||f?.title||'OTHER').trim()||'OTHER';
}
function v0209FindingScore(f){
  const n=Number(f?.score_investigate);
  return Number.isFinite(n)?n:0;
}
function v0209GroupEvidence(rows){
  const ids=new Set();
  for(const f of rows||[])for(const id of v019Array(f?.payload?.evidence_ids))if(id)ids.add(String(id));
  if(ids.size)return ids.size;
  return Math.max(0,...(rows||[]).map(f=>v019Num(f?.evidence_count)));
}
function v0209GroupFindings(findings){
  const groups=new Map();
  for(const f of findings||[]){
    const key=v0209FindingKey(f);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(f);
  }
  return [...groups.entries()].map(([key,rows])=>{
    const ordered=[...rows].sort((a,b)=>v0209FindingScore(b)-v0209FindingScore(a));
    const representative=ordered[0];
    const sources=new Set();
    for(const f of rows)for(const id of v019Array(f?.payload?.producer_ids))if(id)sources.add(String(id));
    return {key,rows,representative,count:rows.length,maxScore:v0209FindingScore(representative),minScore:Math.min(...rows.map(v0209FindingScore)),sources:[...sources],evidence:v0209GroupEvidence(rows)};
  }).sort((a,b)=>b.maxScore-a.maxScore||b.count-a.count);
}
function v0209EntityPriority(findings){
  const groups=v0209GroupFindings(findings);
  const base=groups.length?Math.max(...groups.map(g=>g.maxScore)):0;
  const scoringSources=new Set();
  for(const g of groups)for(const id of g.sources)if(!V0209_CONTEXT_ONLY_SOURCES.has(id))scoringSources.add(id);
  const familyBonus=Math.min(9,Math.max(0,groups.length-1)*3);
  const sourceBonus=Math.min(6,Math.max(0,scoringSources.size-1)*2);
  const score=groups.length?Math.min(100,base+familyBonus+sourceBonus):null;
  return {score,base,familyBonus,sourceBonus,groups,scoringSources:[...scoringSources]};
}
function v0209GroupHtml(groups,limit=100){
  const rows=(groups||[]).slice(0,limit);
  if(!rows.length)return '<div class="v019-empty">Sin alertas materializadas para esta entidad.</div>';
  return `<div class="v0209-alert-groups">${rows.map(g=>{
    const f=g.representative;
    const mapKey=String(f?.finding_key||f?.finding_id||`${g.key}-${Math.random()}`);
    V0209_FINDING_MAP.set(mapKey,f);
    const range=g.count>1&&g.minScore!==g.maxScore?`${v019Fmt(g.minScore,1)}–${v019Fmt(g.maxScore,1)}`:v019Fmt(g.maxScore,1);
    return `<article class="v0209-alert-group"><div class="v0209-alert-head"><div><span>${esc(v019FindingType(g.key))}</span><b>${esc(v019Truncate(f?.title||v019FindingType(g.key),74))}</b></div><strong>${v019Fmt(g.maxScore,1)}</strong></div><div class="v0209-alert-meta"><span>${v019Fmt(g.count)} ${g.count===1?'registro':'registros'} agrupados</span><span>${v019Fmt(g.evidence)} evidencias</span><span>${v019Fmt(g.sources.length)} fuentes</span><span>IPA ${esc(range)}</span></div><div class="v0209-alert-foot">${v0202SourceBadges(g.sources)}<button type="button" data-v0209-open-finding="${esc(mapKey)}">Ver evidencia principal →</button></div></article>`;
  }).join('')}</div>`;
}

/* UAF overview: remove unmatched SII from the signal surface. */
v0203UafMonitor=function(core,uaf){
  const html=v0209BaseUafMonitor(core,uaf);
  const dash=uaf.dashboard?.kpis||{};
  const total=v019Num(dash.registered_total_latest)||core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0);
  const cross=new Map(core.uafCross.map(r=>[String(r.radar_id),v019Num(r.uaf_entities)]));
  const matched=cross.get('RADAR_SII')||0;
  const three=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0);
  const sanctioned=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0);
  const start=html.indexOf('<div class="v0205-recon-kpis">');
  const end=html.indexOf('<div class="v0203-uaf-grid">',start);
  if(start<0||end<0)return html;
  const replacement=`<div class="v0205-recon-kpis v0209-recon-kpis">
    <button type="button" data-v0205-recon-open="all"><span>SO inscritos UAF</span><b>${v019Fmt(total)}</b><small>universo completo →</small></button>
    <button type="button" class="matched" data-v0205-recon-open="matched"><span>Con cruce SII disponible</span><b>${v019Fmt(matched)}</b><small>cobertura técnica · no señal</small></button>
    <button type="button" class="terminated" data-v0205-recon-open="terminated"><span>Término de giro en SII</span><b data-v0205-home-terminated>…</b><small>revisar vigencia UAF →</small></button>
  </div><div class="v0205-recon-context v0209-recon-context"><span><b>${v019Fmt(three)}</b> SO con 3+ fuentes</span><span><b>${v019Fmt(sanctioned)}</b> SO con sanciones</span><button type="button" data-v0205-recon-open="terminated">Revisar conciliación UAF ↔ SII →</button></div><div class="v0209-method-inline">Los SO sin perfil SII quedan fuera del análisis comparativo y no se consideran hallazgo. El upstream SII está orientado a personas jurídicas y UAF no entrega hoy una clasificación PN/PJ suficientemente trazable para imputar la ausencia.</div>`;
  return html.slice(0,start)+replacement+html.slice(end);
};

function v0209ComparableCoverage(c){
  return `<div class="v0205-coverage v0209-coverage"><div><span>Coincidencia activa</span><progress class="active" max="${Math.max(1,c.matched)}" value="${c.active}"></progress><b>${v019Fmt(c.active)}</b><small>${v0205Pct(c.active,c.matched)} del cruce SII</small></div><div><span>Término de giro</span><progress class="terminated" max="${Math.max(1,c.matched)}" value="${c.terminated}"></progress><b>${v019Fmt(c.terminated)}</b><small>${v0205Pct(c.terminated,c.matched)} del cruce SII</small></div></div>`;
}
async function v0209TransformReconciliation(){
  const c=await v0205LoadCounts();
  document.querySelector('[data-v0205-filter="unmatched"]')?.remove();
  const hero=document.querySelector('.v0205-hero');
  if(hero){
    const p=hero.querySelector('p');if(p)p.textContent='Comparación operativa limitada a SO UAF con perfil SII materializado. La ausencia de perfil SII no se interpreta como hallazgo.';
    const box=hero.querySelector('.v0205-review');if(box)box.innerHTML=`<span>Término de giro a revisar</span><b>${v019Fmt(c.terminated)}</b><small>${v0205Pct(c.terminated,c.matched)} de los SO con cruce SII</small>`;
  }
  const kpis=document.querySelector('.v0205-kpis');
  if(kpis){
    const matched=kpis.querySelector('[data-v0205-filter="matched"] small');if(matched)matched.textContent='universo comparable con SII';
    const term=kpis.querySelector('[data-v0205-filter="terminated"] small');if(term)term.textContent=`${v0205Pct(c.terminated,c.matched)} del cruce SII`;
    const active=kpis.querySelector('[data-v0205-filter="active"] small');if(active)active.textContent=`${v0205Pct(c.active,c.matched)} del cruce SII`;
  }
  const coverage=document.querySelector('.v0205-coverage');if(coverage)coverage.outerHTML=v0209ComparableCoverage(c);
  const note=document.querySelector('.v0205-method-note');if(note)note.innerHTML='<b>Criterio de comparabilidad:</b> esta vista no intenta clasificar como persona natural a quien no aparece en Radar SII. Los estados sin perfil SII permanecen técnicamente disponibles en backend, pero se excluyen del monitoreo y de las prioridades hasta contar con una clasificación PN/PJ independiente y trazable.';
  const listTitle=document.querySelector('#v0205-list-title');if(listTitle&&V0205_STATE.filter==='terminated')listTitle.textContent='SO UAF con término de giro publicado en SII';
}
v0205LoadReconciliation=async function(filter='terminated',initialSearch=''){
  const safeFilter=(filter==='review'||filter==='unmatched')?'terminated':filter;
  await v0209BaseReconciliation(safeFilter,initialSearch);
  try{await v0209TransformReconciliation();}catch{}
};

/* Do not append an entity-level warning for technical NO_SII_PROFILE status. */
if(v0209BaseAppendEntityReconciliation){
  v0205AppendEntityReconciliation=async function(e){
    if(!e?.is_uaf_observed)return;
    const {data:r,error}=await sb.from(V0205_VIEW).select('reconciliation_status').eq('entity_id',e.entity_id).maybeSingle();
    if(error||!r||r.reconciliation_status==='NO_SII_PROFILE')return;
    return v0209BaseAppendEntityReconciliation(e);
  };
}

function v0209TransformEntity(pkg){
  const {findings}=pkg;
  const priority=v0209EntityPriority(findings);
  const groups=priority.groups;
  const hero=document.querySelector('.v0203-hero-score');
  if(hero)hero.innerHTML=`<b>${priority.score==null?'—':v019Fmt(priority.score,1)}</b><span>Score consolidado</span><small>prioridad de entidad · no probabilidad LA/FT</small>`;
  const kpi=document.querySelector('.v0203-entity-kpis');
  if(kpi){
    const first=kpi.querySelector('div');if(first)first.innerHTML=`<span>Familias de alerta</span><b>${v019Fmt(groups.length)}</b><small>${v019Fmt(findings.length)} registros subyacentes</small>`;
    kpi.insertAdjacentHTML('afterend',`<div class="v0209-score-explain"><b>Cómo se consolida</b><span>Base IPA ${v019Fmt(priority.base,1)} + diversidad de familias ${v019Fmt(priority.familyBonus,0)} + fuentes analíticas ${v019Fmt(priority.sourceBonus,0)} = <strong>${priority.score==null?'—':v019Fmt(priority.score,1)}</strong></span><small>Los registros repetidos dentro de una misma familia no incrementan el score. UAF como registro y Radar Prensa como contexto no aportan bonus de fuente.</small></div>`);
  }
  const alertTab=document.querySelector('[data-v0203-tab="alerts"] span');if(alertTab)alertTab.textContent=v019Fmt(groups.length);
  const top=document.querySelector('.v0203-top-alerts');
  if(top){const title=top.querySelector('h2');if(title)title.textContent='Alertas agrupadas';const p=top.querySelector('p');if(p)p.textContent='Una fila por familia analítica; los duplicados quedan como evidencia subyacente.';const body=top.querySelector('.v0202-finding-list, .v0202-alert-list');if(body)body.outerHTML=v0209GroupHtml(groups,4);else{const head=top.querySelector('.v019-card-head');if(head)head.insertAdjacentHTML('afterend',v0209GroupHtml(groups,4));}}
  const toolbar=document.querySelector('.v0203-alert-toolbar');if(toolbar){const span=toolbar.querySelector('span');if(span)span.textContent='Agrupadas por familia analítica; filtrar no vuelve a separar duplicados.';}
  const results=document.querySelector('#v0203-alert-results');if(results)results.innerHTML=v0209GroupHtml(groups,100);
}
v0203RenderEntity=function(pkg){
  v0209BaseRenderEntity(pkg);
  v0209TransformEntity(pkg);
};
v0203BindEntity=function(pkg){
  v0209BaseBindEntity(pkg);
  document.querySelectorAll('[data-v0203-source]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.v0203Source;
    const filtered=id==='ALL'?pkg.findings:pkg.findings.filter(f=>v019Array(f?.payload?.producer_ids).includes(id));
    const box=document.querySelector('#v0203-alert-results');if(box)box.innerHTML=v0209GroupHtml(v0209GroupFindings(filtered),100);
  }));
};

if(!window.__V0209_EVENTS){
  window.__V0209_EVENTS=true;
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-v0209-open-finding]');if(!btn)return;
    e.preventDefault();const f=V0209_FINDING_MAP.get(btn.dataset.v0209OpenFinding);if(f)v019OpenFinding(f);
  });
}

window.__AML_BUILD__=V0209;
setTimeout(()=>{const version=document.querySelector('.v019-brand small');if(version)version.textContent=`Operational Radar · v${V0209}`;},0);
