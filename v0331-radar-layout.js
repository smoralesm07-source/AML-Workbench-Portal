'use strict';

/* AML Workbench v0.33.1 · Radar Integrado hierarchy refinement.
 * Reuses the existing v0.24 data/rendering functions and only rearranges the
 * resulting cards after their bindings are attached. Runtime/version authority
 * remains in v0331-runtime-bootstrap.js.
 */
const v0331RadarBaseOverview=v019LoadOverview;

function v0331RadarSection(className,child){
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

  if(uaf)anchor.before(v0331RadarSection('v0331-uaf-primary',uaf));
  if(priority)anchor.before(v0331RadarSection('v0331-priority-primary',priority));

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

v019LoadOverview=async function(...args){
  await v0331RadarBaseOverview(...args);
  v0331ArrangeRadar();
};
loadOverview=v019LoadOverview;
