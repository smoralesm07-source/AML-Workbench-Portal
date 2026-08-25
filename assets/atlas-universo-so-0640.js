'use strict';
(function atlasUniversoSO0672(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0640__={active:false,reason:'obligated-core-unavailable'};return;}
  const SCOPE='aml_uaf_potential_screening_scope_0650';
  const SECTORS='aml_v_uaf_potential_sector_current_v0671';
  const UNIVERSE='aml_v_uaf_universe_current_v0671';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const fmt=core.fmt||((v)=>Number(v||0).toLocaleString('es-CL'));
  const esc=core.esc||((v)=>String(v??''));
  let dataCache=null,dataPromise=null,patchQueued=false,patchRunning=false;

  function load0660(){
    if(document.querySelector('script[data-atlas-uso66]'))return;
    const s=document.createElement('script');
    s.src='./assets/atlas-universo-so-0660.js?v=0672-1';
    s.dataset.atlasUso66='1';
    document.head.appendChild(s);
  }

  function cleanLegacyCards(){document.querySelectorAll('.uso64-tier-strip').forEach(n=>n.remove());}
  function humanizePendingSector(){
    document.querySelectorAll('.so-row .label, option').forEach(n=>{
      if((n.textContent||'').trim()==='SIN_SECTOR_MATERIALIZADO')n.textContent='Sector UAF pendiente de materialización';
    });
  }

  function overviewFallback(){
    const p=core.state?.overview?.potential||{};
    const u=p.universe||{};
    const n=Number(u.candidates);
    return {
      scope:n>0?{potential_count:n,sii_cutoff:null,criteria:{acteco_policy:'candidate_use=SI',sii_status:'ACTIVE_AS_PUBLISHED',uaf_exclusion:'RUT exacto no observado en padrón UAF'}}:null,
      sectors:Array.isArray(p.sectors)?p.sectors.map(x=>({sector:x.sector,potential_ruts:Number(x.candidates||0),res_overlap_ruts:Number(x.res_overlap||0)})).filter(x=>x.sector):[],
      universe:n>0?{potential_ruts:n,potential_res_overlap_ruts:Number(u.res_overlap||0),obligated_ruts:Number(core.state?.overview?.registry?.subjects||0),sii_cutoff:null}:null
    };
  }

  async function loadData(){
    if(dataCache)return dataCache;
    if(dataPromise)return dataPromise;
    const client=db();
    if(!client){dataCache=overviewFallback();return dataCache;}
    dataPromise=(async()=>{
      try{
        const [sc,sec,uni]=await Promise.all([
          client.from(SCOPE).select('*').eq('snapshot_key','CURRENT').maybeSingle(),
          client.from(SECTORS).select('*').order('potential_ruts',{ascending:false}).order('sector',{ascending:true}),
          client.from(UNIVERSE).select('*').maybeSingle()
        ]);
        if(sc.error)throw sc.error;if(sec.error)throw sec.error;if(uni.error)throw uni.error;
        dataCache={scope:sc.data||null,sectors:sec.data||[],universe:uni.data||null};
        if(!dataCache.scope||!dataCache.universe)throw new Error('CURRENT_UNIVERSE_UNAVAILABLE');
      }catch(_e){dataCache=overviewFallback();}
      finally{dataPromise=null;}
      return dataCache;
    })();
    return dataPromise;
  }

  function patchOverviewState(data){
    const p=core.state?.overview?.potential;if(!p)return;
    const scope=data?.scope||{},uni=data?.universe||{};
    const count=Number(scope.potential_count||uni.potential_ruts||0);
    p.universe=p.universe||{};
    if(count>0){p.universe.candidates=count;p.universe.actionable=count;}
    p.universe.res_overlap=Number(uni.potential_res_overlap_ruts||p.universe.res_overlap||0);
    p.universe.definition='ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT';
    if(Array.isArray(data?.sectors)&&data.sectors.length){
      p.sectors=data.sectors.map(r=>({sector:r.sector,candidates:Number(r.potential_ruts||0),actionable:Number(r.potential_ruts||0),res_overlap:Number(r.res_overlap_ruts||0)}));
      p.universe.sectors=p.sectors.length;
    }
    delete p.tiers;
  }

  function countOf(data){return Number(data?.scope?.potential_count||data?.universe?.potential_ruts||0);}
  function cutoffOf(data){return data?.scope?.sii_cutoff||data?.universe?.sii_cutoff||'último corte SII';}

  function criteriaHtml(data){
    const count=countOf(data);
    return `<section class="uso65-screening">
      <div class="uso65-head"><div><span>SCREENING VIGENTE</span><strong>${count>0?fmt(count):'—'}</strong><small>Potenciales SO · RUT únicos del último corte materializado</small></div><div class="uso65-cut"><b>SII ${esc(cutoffOf(data))}</b><small>Actividad económica vigente</small></div></div>
      <div class="uso65-criteria">
        <div><b>1</b><strong>ACTECO relacionado con Ley 19.913</strong><small>Política de screening con <code>candidate_use=SI</code>.</small></div>
        <div><b>2</b><strong>Vigente ante el SII</strong><small>Estado <code>ACTIVE_AS_PUBLISHED</code> en el corte tributario publicado.</small></div>
        <div><b>3</b><strong>RUT no observado en UAF</strong><small>Exclusión exacta contra el padrón UAF vigente en Atlas.</small></div>
      </div>
      <div class="uso65-rule">“Potencial SO” es una hipótesis de screening, no una calificación jurídica de obligación o incumplimiento. A/B/C, IVO, materialidad y RES no filtran la entrada al universo.</div>
    </section>`;
  }

  function sectorHtml(data){
    const rows=Array.isArray(data?.sectors)?data.sectors:[];
    if(!rows.length)return `<section class="so-card uso72-sectors"><h2>Distribución sectorial de potenciales SO</h2><div class="so-empty">La distribución sectorial vigente no está disponible en esta sesión.</div></section>`;
    const max=Math.max(...rows.map(r=>Number(r.potential_ruts||0)),1);
    return `<section class="so-card uso72-sectors">
      <div class="uso72-sector-head"><div><h2>Distribución sectorial de potenciales SO</h2><p>RUT distintos por sector inferido desde ACTECO. Corte actual del mismo universo de ${fmt(countOf(data))} potenciales.</p></div><b>${fmt(rows.length)}<small>sectores con candidatos</small></b></div>
      <div class="uso72-sector-list">${rows.map((r,i)=>{
        const n=Number(r.potential_ruts||0),res=Number(r.res_overlap_ruts||0);
        return `<div class="uso72-sector-row"><span class="uso72-rank">${i+1}</span><div><strong>${esc(r.sector)}</strong><progress max="${max}" value="${n}">${n}</progress><small>${res?fmt(res)+' con enriquecimiento RES':'Sin solapamiento RES observado'}</small></div><b>${fmt(n)}</b></div>`;
      }).join('')}</div>
      <div class="uso65-rule"><b>Lectura metodológica:</b> un mismo RUT puede mapear a más de un sector UAF cuando posee más de un ACTECO elegible. Por ello las filas sectoriales no son aditivas y no deben sumarse para reconstruir los ${fmt(countOf(data))} RUT únicos.</div>
    </section>`;
  }

  function renderPotential(data){
    const host=document.querySelector('#so-potential');if(!host)return;
    const count=countOf(data),uni=data?.universe||{};
    host.dataset.uso65='1';
    host.innerHTML=`${criteriaHtml(data)}
      <section class="so-card uso65-definition"><h2>Universo de potenciales sujetos obligados</h2><p>Entidades con ACTECO elegible, vigentes ante el SII y no observadas por RUT exacto en el padrón UAF del corte.</p>
      <div class="uso65-facts"><div><b>${count>0?fmt(count):'—'}</b><span>Potenciales SO vigentes</span></div><div><b>${fmt(Number(uni.obligated_ruts||core.state?.overview?.registry?.subjects||0))}</b><span>SO inscritos usados en exclusión</span></div><div><b>${fmt(Number(uni.potential_res_overlap_ruts||0))}</b><span>Potenciales con RES</span></div><div><b>${fmt((data?.sectors||[]).length)}</b><span>Sectores con potenciales</span></div></div>
      <details><summary>Ayuda metodológica</summary><p>“Potencial SO” es una población de screening. No afirma que la entidad esté obligada jurídicamente, que deba inscribirse ni que exista incumplimiento. El universo se deduplica por RUT antes de publicar su total.</p></details></section>
      ${sectorHtml(data)}`;
  }

  function renderCoverage(data){
    const content=document.querySelector('#content');if(!content)return;
    content.innerHTML=`<section class="so-root uso65-coverage"><div class="so-modes"><button type="button" data-uso65-back>← Potenciales SO</button><button class="on" type="button">Gestión de cobertura</button></div>${criteriaHtml(data)}<section class="so-card"><h2>Gestión sobre universo amplio</h2><p>El universo vigente contiene ${fmt(countOf(data))} RUT potenciales. Las capas históricas de priorización/IVO no se usan para redefinir este total; cualquier cola de revisión debe declararse explícitamente como subconjunto analítico.</p></section>${sectorHtml(data)}</section>`;
    content.querySelector('[data-uso65-back]')?.addEventListener('click',()=>{core.state.mode='potenciales';void core.render();});
  }

  function setTextIfChanged(node,value){if(node&&node.textContent!==value)node.textContent=value;}
  function patchPanoramaCopy(){
    const root=document.querySelector('.so-root');if(!root)return;
    const firstKpi=root.querySelector('.so-kpis .so-kpi:first-child b');
    const firstLabel=root.querySelector('.so-kpis .so-kpi:first-child span');
    if(firstKpi&&core.state?.overview?.registry?.subjects!=null)setTextIfChanged(firstKpi,fmt(core.state.overview.registry.subjects));
    if(firstLabel)setTextIfChanged(firstLabel,'Sujetos obligados inscritos');
  }

  async function patch(){
    if(patchRunning)return;patchRunning=true;
    try{
      cleanLegacyCards();humanizePendingSector();
      const data=await loadData();patchOverviewState(data);patchPanoramaCopy();
      if(core.state?.mode==='potenciales')renderPotential(data);
    }finally{patchRunning=false;}
  }
  function schedulePatch(){if(patchQueued)return;patchQueued=true;requestAnimationFrame(()=>{patchQueued=false;void patch();});}

  document.addEventListener('click',async(e)=>{
    const b=e.target?.closest?.('[data-atlas-coverage]');if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();renderCoverage(await loadData());
  },true);

  const obs=new MutationObserver(schedulePatch);
  const start=()=>{load0660();const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});schedulePatch();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0640__={active:true,version:'0.67.2',operationalSO:null,potentialSO:null,potentialDefinition:'ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',sectorView:SECTORS,universeView:UNIVERSE,multisource:true,legacy2033:false,patch:schedulePatch};
})();