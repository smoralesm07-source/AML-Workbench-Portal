'use strict';

/* ATLAS AML 0.44.4 · backend stability layer
 * - Replaces exact-count reconciliation scans with one lightweight governed summary view.
 * - Keeps the v0435 sequential/fail-soft aggregate loader intact.
 * - Does not alter Auth, allowlist, RLS or entity authorization.
 */
(function atlasBackendStability0444(){
  const RELEASE='0.44.4';
  const BUILD='0444';
  const SUMMARY_VIEW='aml_v0444_uaf_sii_summary';
  const TTL=5*60*1000;
  let cached=null;
  let cachedAt=0;
  let inFlight=null;

  function now(){return Date.now();}
  function health(stage,extra={}){
    window.__ATLAS_BACKEND_STABILITY__={
      active:true,
      release:RELEASE,
      build:BUILD,
      stage,
      summaryView:SUMMARY_VIEW,
      exactReconciliationCounts:false,
      reconciliationSectorView:'aml_v0434_uaf_sii_sector',
      reconciliationMatrixView:'aml_v0434_uaf_sii_sector_matrix',
      checkedAt:new Date().toISOString(),
      ...extra
    };
  }
  function normalize(row){
    const total=Number(row?.total)||0;
    const active=Number(row?.active)||0;
    const terminated=Number(row?.terminated)||0;
    const noSii=Number(row?.no_sii)||0;
    const matched=Number(row?.matched)||active+terminated;
    const review=Number(row?.review)||terminated+noSii;
    return {total,active,terminated,noSii,matched,review,__source:SUMMARY_VIEW};
  }
  function unavailable(error){
    return {
      total:0,active:0,terminated:0,noSii:0,matched:0,review:0,
      __unavailable:true,
      __source:SUMMARY_VIEW,
      __error:String(error?.message||error||'summary unavailable')
    };
  }

  async function loadSummary(force=false){
    if(!force&&cached&&(now()-cachedAt)<TTL)return cached;
    if(inFlight&&!force)return inFlight;
    inFlight=(async()=>{
      try{
        const {data,error}=await sb.from(SUMMARY_VIEW)
          .select('total,active,terminated,no_sii,matched,review')
          .limit(1);
        if(error)throw error;
        const row=Array.isArray(data)?data[0]:data;
        const result=normalize(row||{});
        if(result.total<=0)throw new Error('Resumen UAF–SII sin universo materializado');
        cached=result;
        cachedAt=now();
        try{V0205_COUNTS=result;}catch(_error){}
        health('summary-ok',{total:result.total,review:result.review});
        return result;
      }catch(error){
        if(cached){
          const stale={...cached,__stale:true,__error:String(error?.message||error)};
          health('summary-stale',{error:stale.__error,total:stale.total});
          return stale;
        }
        const result=unavailable(error);
        health('summary-unavailable',{error:result.__error});
        return result;
      }finally{
        inFlight=null;
      }
    })();
    return inFlight;
  }

  try{
    v0205LoadCounts=async function(force=false){
      return loadSummary(force);
    };
  }catch(error){
    health('install-failed',{error:String(error?.message||error)});
    return;
  }

  /* Remove stale load-shed flags left by an earlier in-memory attempt. */
  try{
    if(V0205_COUNTS?.__unavailable)V0205_COUNTS=null;
    if(V0434_CACHE?.counts?.__unavailable){
      V0434_CACHE.counts=null;
      V0434_CACHE.__v0440Ready=false;
      V0434_CACHE.__v0437Ready=false;
    }
  }catch(_error){}

  window.AtlasBackendStability={
    release:RELEASE,
    build:BUILD,
    refresh:()=>loadSummary(true),
    snapshot:()=>cached?{...cached}:null
  };
  health('installed');
})();

/* ATLAS AML · Reconciliation interaction refinement
 * - Removes the UAF × SII bubble matrix from the visible page.
 * - Existing lightweight matrix data remains available only to drive filter-aware aggregates.
 * - Status, UAF sector and SII economic-sector filters become reversible with one click.
 * - Active filters update hero/KPIs/status flow/sector distribution and the entity explorer together.
 */
(function atlasReconciliationFilters0446(){
  if(typeof V0434_STATE==='undefined'||typeof V0434_CACHE==='undefined')return;

  const base={
    hero:typeof v0434Hero==='function'?v0434Hero:null,
    kpis:typeof v0434Kpis==='function'?v0434Kpis:null,
    flow:typeof v0434Flow==='function'?v0434Flow:null,
    reads:typeof v0434Reads==='function'?v0434Reads:null,
    sectorPanel:typeof v0434SectorPanel==='function'?v0434SectorPanel:null,
    renderWorkspace:typeof v0434RenderWorkspace==='function'?v0434RenderWorkspace:null
  };
  if(!base.hero||!base.kpis||!base.flow||!base.sectorPanel||!base.renderWorkspace)return;

  const style=document.createElement('style');
  style.id='atlas-reconciliation-filter-ux';
  style.textContent=`
    .v0434-matrix-card{display:none!important}
    .v0446-filterbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:9px 11px;border:1px solid var(--atlas-line);border-radius:10px;background:var(--atlas-panel-lift)}
    .v0446-filterbar>span{font-size:8.5px;font-weight:850;letter-spacing:.05em;color:var(--atlas-muted);text-transform:uppercase;margin-right:2px}
    .v0446-filterbar button{border:1px solid var(--atlas-accent-border);border-radius:999px;background:var(--atlas-accent-soft);color:var(--atlas-accent-hi);padding:5px 9px;font-size:8.5px;font-weight:800;cursor:pointer}
    .v0446-filterbar button:hover{background:var(--atlas-panel-hi)}
    .v0446-filterbar button.reset{border-color:var(--atlas-line);background:var(--atlas-panel);color:var(--atlas-muted)}
    .v0446-filterbar small{font-size:8px;color:var(--atlas-muted)}
    .v0434-kpis>button.v0446-selected,.v0434-flow-legend button.v0446-selected{outline:2px solid var(--atlas-accent-hi);outline-offset:1px;background:var(--atlas-accent-soft)}
    .v0434-kpis.v0446-filtered>button:not(.v0446-selected){opacity:.72}
    .v0434-flow-legend.v0446-filtered>button:not(.v0446-selected){opacity:.62}
    .v0434-sector-card.v0446-filtered{border-color:var(--atlas-accent-border)}
  `;
  document.head.appendChild(style);

  function n(v){const x=Number(v);return Number.isFinite(x)?x:0;}
  function statusKey(){return ['active','terminated','missing'].includes(V0434_STATE.status)?V0434_STATE.status:'all';}
  function rawCounts(){
    const baseCounts=V0434_CACHE.counts||{total:0,active:0,terminated:0,noSii:0,matched:0,review:0};
    const sector=V0434_STATE.sector||'';
    const economic=V0434_STATE.economic||'';
    if(!sector&&!economic)return {...baseCounts};

    if(sector&&!economic){
      const r=(V0434_CACHE.sectors||[]).find(x=>x.sector_name===sector);
      if(!r)return {total:0,active:0,terminated:0,noSii:0,matched:0,review:0};
      const active=n(r.active_count),terminated=n(r.terminated_count),noSii=n(r.no_sii_count),total=n(r.entity_count);
      return {total,active,terminated,noSii,matched:active+terminated,review:terminated+noSii,__scope:'sector'};
    }

    const rows=(V0434_CACHE.matrix||[]).filter(r=>(!sector||r.sector_name===sector)&&(!economic||r.sii_economic_sector===economic));
    const active=rows.reduce((a,r)=>a+n(r.active_count),0);
    const terminated=rows.reduce((a,r)=>a+n(r.terminated_count),0);
    const noSii=rows.reduce((a,r)=>a+n(r.no_sii_count),0);
    const total=rows.reduce((a,r)=>a+n(r.entity_count),0);
    return {total,active,terminated,noSii,matched:active+terminated,review:terminated+noSii,__scope:sector?'sector-economic':'economic-pairs'};
  }
  function scopedCounts(){
    const c=rawCounts(),k=statusKey();
    if(k==='active')return {...c,total:c.active,active:c.active,terminated:0,noSii:0,matched:c.active,review:0,__status:'active'};
    if(k==='terminated')return {...c,total:c.terminated,active:0,terminated:c.terminated,noSii:0,matched:c.terminated,review:c.terminated,__status:'terminated'};
    if(k==='missing')return {...c,total:c.noSii,active:0,terminated:0,noSii:c.noSii,matched:0,review:c.noSii,__status:'missing'};
    return c;
  }
  function scopedSectors(){
    let rows;
    if(V0434_STATE.economic){
      rows=(V0434_CACHE.matrix||[]).filter(r=>r.sii_economic_sector===V0434_STATE.economic).map(r=>({...r}));
    }else{
      rows=(V0434_CACHE.sectors||[]).map(r=>({...r}));
    }
    if(V0434_STATE.sector)rows=rows.filter(r=>r.sector_name===V0434_STATE.sector);
    const k=statusKey();
    rows=rows.map(r=>{
      const active=n(r.active_count),terminated=n(r.terminated_count),missing=n(r.no_sii_count);
      if(k==='active')return {...r,entity_count:active,active_count:active,terminated_count:0,no_sii_count:0,with_sii_count:active};
      if(k==='terminated')return {...r,entity_count:terminated,active_count:0,terminated_count:terminated,no_sii_count:0,with_sii_count:terminated};
      if(k==='missing')return {...r,entity_count:missing,active_count:0,terminated_count:0,no_sii_count:missing,with_sii_count:0};
      return r;
    }).filter(r=>n(r.entity_count)>0).sort((a,b)=>n(b.entity_count)-n(a.entity_count));
    return rows;
  }
  function withCounts(fn){
    const old=V0434_CACHE.counts;V0434_CACHE.counts=scopedCounts();
    try{return fn();}finally{V0434_CACHE.counts=old;}
  }
  function withScope(fn){
    const oldCounts=V0434_CACHE.counts,oldSectors=V0434_CACHE.sectors;
    V0434_CACHE.counts=scopedCounts();V0434_CACHE.sectors=scopedSectors();
    try{return fn();}finally{V0434_CACHE.counts=oldCounts;V0434_CACHE.sectors=oldSectors;}
  }

  try{v0434Matrix=()=>'';}catch(_error){}
  try{v0434Hero=()=>withCounts(base.hero);}catch(_error){}
  try{v0434Kpis=()=>withCounts(base.kpis);}catch(_error){}
  try{v0434Flow=()=>withCounts(base.flow);}catch(_error){}
  if(base.reads){try{v0434Reads=()=>withScope(base.reads);}catch(_error){}}
  try{v0434SectorPanel=()=>withScope(base.sectorPanel);}catch(_error){}

  function chip(label,key){return `<button type="button" data-v0446-clear="${key}">${v0434Esc(label)} ×</button>`;}
  function filterBar(){
    const chips=[];
    const k=statusKey();
    if(k!=='all')chips.push(chip(k==='active'?'Activo SII':k==='terminated'?'Término de giro':'Sin perfil SII','status'));
    if(V0434_STATE.sector)chips.push(chip(`UAF · ${v0434Cut(V0434_STATE.sector,40)}`,'sector'));
    if(V0434_STATE.economic)chips.push(chip(`SII · ${v0434Cut(V0434_STATE.economic,40)}`,'economic'));
    if(!chips.length)return '<div class="v0446-filterbar"><span>Filtros interactivos</span><small>Haz clic en un KPI, estado o sector para filtrar; vuelve a hacer clic para quitarlo.</small></div>';
    const note=V0434_STATE.economic&&!V0434_STATE.sector?'<small>El cruce económico usa agregados sectoriales; una entidad multisegmento puede participar en más de una combinación.</small>':'';
    return `<div class="v0446-filterbar"><span>Filtros activos</span>${chips.join('')}<button type="button" class="reset" data-v0446-clear="all">Limpiar todo</button>${note}</div>`;
  }
  function placeFilterBar(){
    const page=document.querySelector('.v0434-recon');if(!page)return;
    const old=page.querySelector('.v0446-filterbar');if(old)old.remove();
    const kpis=page.querySelector('.v0434-kpis');if(kpis)kpis.insertAdjacentHTML('afterend',filterBar());
  }
  function markSelection(){
    const page=document.querySelector('.v0434-recon');if(!page)return;
    const k=statusKey();
    const kpis=page.querySelector('.v0434-kpis');
    if(kpis){kpis.classList.toggle('v0446-filtered',k!=='all'||!!V0434_STATE.sector||!!V0434_STATE.economic);kpis.querySelectorAll('[data-v0434-kpi]').forEach(b=>b.classList.toggle('v0446-selected',(k==='all'&&b.dataset.v0434Kpi==='all')||b.dataset.v0434Kpi===k));}
    const legend=page.querySelector('.v0434-flow-legend');
    if(legend){legend.classList.toggle('v0446-filtered',k!=='all');legend.querySelectorAll('[data-v0434-status]').forEach(b=>b.classList.toggle('v0446-selected',b.dataset.v0434Status===k));}
    page.querySelector('.v0434-sector-card')?.classList.toggle('v0446-filtered',!!V0434_STATE.sector||!!V0434_STATE.economic||k!=='all');
  }
  function replace(selector,html){const node=document.querySelector(selector);if(!node)return;const t=document.createElement('div');t.innerHTML=html;const fresh=t.firstElementChild;if(fresh)node.replaceWith(fresh);}
  async function refreshAll(renderWorkspace=true){
    const page=document.querySelector('.v0434-recon');if(!page)return;
    page.querySelector('.v0434-matrix-card')?.remove();
    replace('.v0434-hero',v0434Hero());
    replace('.v0434-kpis',v0434Kpis());
    const grid=page.querySelector('.v0434-grid-2');if(grid)grid.innerHTML=`${v0434Flow()}${v0434Reads()}`;
    replace('.v0434-sector-card',v0434SectorPanel());
    placeFilterBar();markSelection();
    if(renderWorkspace)await base.renderWorkspace();
    markSelection();
    window.__ATLAS_RECON_FILTERS__={active:true,status:statusKey(),sector:V0434_STATE.sector||'',economic:V0434_STATE.economic||'',matrixVisible:false,updatedAt:new Date().toISOString()};
  }

  try{v0434RerenderHeader=function(){void refreshAll(false);};}catch(_error){}

  function toggleStatus(next){
    V0434_STATE.status=statusKey()===next?'all':next;
    if(V0434_STATE.status!=='terminated'&&V0434_STATE.lens==='terminated')V0434_STATE.lens='tax';
    if(V0434_STATE.status==='terminated'&&V0434_STATE.lens==='candidates')V0434_STATE.lens='tax';
    V0434_STATE.page=0;
  }
  function clearFilter(key){
    if(key==='all'){V0434_STATE.status='all';V0434_STATE.sector='';V0434_STATE.economic='';V0434_STATE.query='';V0434_STATE.year='';V0434_STATE.page=0;return;}
    if(key==='status')V0434_STATE.status='all';
    if(key==='sector')V0434_STATE.sector='';
    if(key==='economic')V0434_STATE.economic='';
    V0434_STATE.page=0;
  }

  document.addEventListener('click',async e=>{
    if(!e.target?.closest?.('.v0434-recon'))return;
    const clear=e.target.closest('[data-v0446-clear]');
    if(clear){e.preventDefault();e.stopImmediatePropagation();clearFilter(clear.dataset.v0446Clear);await refreshAll(true);return;}

    const kpi=e.target.closest('[data-v0434-kpi]');
    if(kpi&&kpi.dataset.v0434Kpi!=='candidates'){
      e.preventDefault();e.stopImmediatePropagation();
      const k=kpi.dataset.v0434Kpi;
      if(k==='all')V0434_STATE.status='all';else toggleStatus(k);
      V0434_STATE.lens='tax';V0434_STATE.page=0;await refreshAll(true);return;
    }

    const status=e.target.closest('[data-v0434-status]');
    if(status){e.preventDefault();e.stopImmediatePropagation();toggleStatus(status.dataset.v0434Status);V0434_STATE.lens='tax';await refreshAll(true);return;}

    const read=e.target.closest('[data-v0434-read]');
    if(read&&read.dataset.v0434Read!=='candidates'){
      e.preventDefault();e.stopImmediatePropagation();
      const action=read.dataset.v0434Read,sector=read.dataset.v0434Sector||'';
      if(action==='missing')toggleStatus('missing');else toggleStatus('terminated');
      if(sector)V0434_STATE.sector=V0434_STATE.sector===sector?'':sector;
      V0434_STATE.lens='tax';V0434_STATE.page=0;await refreshAll(true);return;
    }

    const sector=e.target.closest('[data-v0434-sector]');
    if(sector&&!sector.matches('[data-v0434-read]')){
      e.preventDefault();e.stopImmediatePropagation();
      const value=sector.dataset.v0434Sector||'';
      V0434_STATE.sector=V0434_STATE.sector===value?'':value;V0434_STATE.page=0;V0434_STATE.lens='tax';
      await refreshAll(true);return;
    }

    const reset=e.target.closest('[data-v0434-reset]');
    if(reset){e.preventDefault();e.stopImmediatePropagation();clearFilter('all');await refreshAll(true);return;}
  },true);

  document.addEventListener('change',async e=>{
    if(!e.target?.closest?.('.v0434-recon'))return;
    if(e.target.id==='v0434-sector'){
      e.stopImmediatePropagation();V0434_STATE.sector=e.target.value||'';V0434_STATE.page=0;await refreshAll(true);return;
    }
    if(e.target.id==='v0434-status'){
      e.stopImmediatePropagation();V0434_STATE.status=e.target.value||'all';V0434_STATE.page=0;await refreshAll(true);return;
    }
    if(e.target.id==='v0434-economic'){
      e.stopImmediatePropagation();V0434_STATE.economic=e.target.value||'';V0434_STATE.page=0;await refreshAll(true);return;
    }
  },true);

  const observer=new MutationObserver(()=>{
    const matrix=document.querySelector('.v0434-matrix-card');if(matrix)matrix.remove();
    if(document.querySelector('.v0434-recon')&&!document.querySelector('.v0446-filterbar')){placeFilterBar();markSelection();}
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.AtlasReconciliationFilters={
    version:'0.44.6-ui',
    matrixVisible:false,
    refresh:()=>refreshAll(true),
    clear:()=>{clearFilter('all');return refreshAll(true);}
  };
})();
