'use strict';

/* AML Workbench v0.24.1 · restore UAF↔SII reconciliation on Radar
 * Restores the operational reconciliation summary removed in v0.24.0.
 * Keeps NO_SII_PROFILE out of the visible analytical surface.
 * Reuses the governed v0.21 reconciliation deep-dive (cohorts, UAF sector,
 * sorting, filters and Entity 360) instead of creating a parallel analysis.
 */
const V0241='0.24.1';
const v0241BaseShell=shell;
const v0241BaseOverview=v019LoadOverview;

function v0241ApplyVersion(){
  try{
    if(typeof V0206_VERSION_OBSERVER!=='undefined'&&V0206_VERSION_OBSERVER){
      V0206_VERSION_OBSERVER.disconnect();
      V0206_VERSION_OBSERVER=null;
    }
  }catch{}
  const label=`Operational Radar · v${V0241}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){badge.textContent=label;badge.setAttribute('aria-label',label);}
  document.title=`AML Analytical Workbench · v${V0241}`;
  document.documentElement.setAttribute('data-aml-build',V0241);
}

shell=function(title,subtitle){v0241BaseShell(title,subtitle);v0241ApplyVersion();};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0241ApplyVersion;

function v0241ReconciliationHtml(c,st){
  const comparable=Math.max(1,v019Num(c?.matched));
  const total=Math.max(1,v019Num(c?.total));
  const active=v019Num(c?.active),terminated=v019Num(c?.terminated),matched=v019Num(c?.matched);
  const five=v019Num(st?.five),oldest=st?.oldest==null?'—':String(st.oldest);
  return `<section class="v0241-reconciliation" aria-label="Conciliación UAF y SII">
    <div class="v0241-recon-head">
      <div><span>CONCILIACIÓN UAF ↔ SII</span><h3>Vigencia registral de sujetos obligados</h3><p>Universo comparable con perfil SII materializado. Las diferencias orientan revisión administrativa y no implican incumplimiento por sí solas.</p></div>
      <button type="button" class="v0241-recon-open" data-v0241-recon="matched">Abrir análisis completo →</button>
    </div>
    <div class="v0241-recon-kpis">
      <button type="button" class="matched" data-v0241-recon="matched"><span>Con cruce SII</span><b>${v019Fmt(matched)}</b><small>${v024Pct(matched,total)} del universo UAF · ver comparables</small></button>
      <button type="button" class="active" data-v0241-recon="active"><span>Activos en SII</span><b>${v019Fmt(active)}</b><small>${v024Pct(active,comparable)} del cruce · abrir entidades</small></button>
      <button type="button" class="terminated" data-v0241-recon="terminated"><span>Término de giro</span><b>${v019Fmt(terminated)}</b><small>${v024Pct(terminated,comparable)} del cruce · analizar cohortes</small></button>
      <button type="button" class="aged" data-v0241-recon="terminated"><span>Término 2021 o anterior</span><b>${v019Fmt(five)}</b><small>cohorte antigua · más antiguo ${esc(oldest)}</small></button>
    </div>
    <div class="v0241-recon-bar" aria-label="Distribución del universo comparable"><span class="active"><i></i><b>${v019Fmt(active)}</b> activos</span><progress max="${comparable}" value="${active}"></progress><span class="terminated"><i></i><b>${v019Fmt(terminated)}</b> terminados</span></div>
  </section>`;
}

async function v0241HydrateReconciliation(){
  const monitor=document.querySelector('.v024-uaf-monitor');
  const anchor=monitor?.querySelector('.v024-uaf-kpis');
  if(!monitor||!anchor||monitor.querySelector('.v0241-reconciliation'))return;
  try{
    const c=await v0205LoadCounts();
    let st={five:0,oldest:null};
    if(typeof v0210LoadMeta==='function'&&typeof v0210CohortStats==='function'){
      await v0210LoadMeta();
      st=v0210CohortStats(V0210_STATE.years);
    }
    anchor.insertAdjacentHTML('afterend',v0241ReconciliationHtml(c,st));
  }catch(error){
    console.warn('v0.24.1 reconciliation summary unavailable',error);
  }
}

v019LoadOverview=async function(){
  await v0241BaseOverview();
  v0241ApplyVersion();
  await v0241HydrateReconciliation();
};
loadOverview=v019LoadOverview;

if(!window.__V0241_EVENTS){
  window.__V0241_EVENTS=true;
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-v0241-recon]');
    if(!btn)return;
    e.preventDefault();
    const filter=btn.dataset.v0241Recon||'matched';
    if(typeof v0205LoadReconciliation==='function')await v0205LoadReconciliation(filter);
    v0241ApplyVersion();
  });
}

window.__AML_ACTIVE_VERSION__=V0241;
window.__AML_BUILD__=V0241;
setTimeout(v0241ApplyVersion,0);
