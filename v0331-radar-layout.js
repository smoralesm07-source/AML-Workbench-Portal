'use strict';

/* AML Workbench v0.33.1 · Radar Integrado hierarchy refinement.
 * Reuses the existing v0.24 data/rendering functions and only rearranges the
 * resulting cards after their bindings are attached.
 */
const V0331='0.33.1';
const V0331_BUILD='0331';
const v0331BaseOverview=v019LoadOverview;
const v0331BaseShell=shell;

function v0331ApplyVersion(){
  window.__AML_ACTIVE_VERSION__=V0331;
  window.__AML_BUILD__=V0331_BUILD;
  const label=`Operational Radar · v${V0331}`;
  const badge=document.querySelector('.v019-brand small');
  if(badge){
    badge.textContent=label;
    badge.setAttribute('aria-label',label);
    badge.setAttribute('data-runtime-label',label);
    badge.dataset.activeVersion=V0331;
  }
  document.title=`AML Analytical Workbench · v${V0331}`;
  document.documentElement.setAttribute('data-aml-version',V0331);
  document.documentElement.setAttribute('data-aml-build',V0331_BUILD);
}

function v0331Section(className,child){
  const section=document.createElement('section');
  section.className=className;
  if(child)section.appendChild(child);
  return section;
}

function v0331ArrangeRadar(){
  if(state?.view!=='overview')return;
  const content=typeof v019Content==='function'?v019Content():document.querySelector('.v019-content');
  if(!content||content.dataset.v0331RadarLayout==='1')return;

  const mainGrid=content.querySelector('.v024-main-grid');
  const analysisGrid=content.querySelector('.v024-analysis-grid');
  const uaf=content.querySelector('.v024-uaf-card');
  const priority=content.querySelector('.v024-priority');
  const sanctions=content.querySelector('.v024-sanctions');
  const context=content.querySelector('.v024-context-card');
  const budget=content.querySelector('.v024-budget');
  const anchor=mainGrid||analysisGrid||budget;

  if(!anchor||(!uaf&&!priority&&!sanctions&&!context&&!budget))return;

  if(uaf)anchor.before(v0331Section('v0331-uaf-primary',uaf));
  if(priority)anchor.before(v0331Section('v0331-priority-primary',priority));

  const support=document.createElement('section');
  support.className='v0331-support';
  support.innerHTML=`
    <div class="v0331-support-head">
      <div><span>CAPAS COMPLEMENTARIAS</span><h2>Señales y contexto para profundizar</h2><p>Sanciones, contexto económico/prensa y gasto público en un único bloque de apoyo.</p></div>
    </div>
    <div class="v0331-support-grid"></div>`;
  const supportGrid=support.querySelector('.v0331-support-grid');
  [sanctions,context,budget].filter(Boolean).forEach(card=>supportGrid.appendChild(card));
  if(supportGrid.children.length)anchor.before(support);

  mainGrid?.remove();
  analysisGrid?.remove();
  content.dataset.v0331RadarLayout='1';
}

shell=function(title,subtitle){
  v0331BaseShell(title,subtitle);
  v0331ApplyVersion();
};
if(typeof v0211ApplyVersion==='function')v0211ApplyVersion=v0331ApplyVersion;

v019LoadOverview=async function(...args){
  await v0331BaseOverview(...args);
  v0331ArrangeRadar();
  v0331ApplyVersion();
};
loadOverview=v019LoadOverview;

window.__AML_RUNTIME_VERSION_APPLIER__=v0331ApplyVersion;
v0331ApplyVersion();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',v0331ApplyVersion,{once:true});
