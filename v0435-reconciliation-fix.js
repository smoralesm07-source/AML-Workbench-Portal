'use strict';

/* ATLAS AML 0.43.5 · reconciliation hardening
 * - Termination cohorts filter the governed termination_year field.
 * - Help affordances avoid nested interactive <button> markup inside KPI buttons.
 * - The selected termination cohort is visible and reset with the lens.
 */
(function atlasReconciliation0435(){
  if(typeof V0434_STATE==='undefined')return;
  V0434_STATE.year=V0434_STATE.year||'';

  if(typeof v0434Help==='function'){
    v0434Help=function(key){
      return `<span class="v0434-help" data-v0434-help="${v0434Esc(key)}" role="button" tabindex="0" aria-label="Ayuda metodológica">?</span>`;
    };
  }

  if(typeof v0434Timeline==='function'){
    v0434Timeline=function(){
      const rows=V0434_CACHE.years||[],max=Math.max(1,...rows.map(r=>v0434N(r.entity_count))),now=new Date().getFullYear();
      return `<div class="v0434-timeline">${rows.map(r=>{const y=String(r.termination_year),age=now-v0434N(r.termination_year),cls=age>=10?'old':age>=5?'mid':'recent',active=String(V0434_STATE.year)===y;return `<button class="${cls} ${active?'active':''}" data-v0434-year="${v0434Esc(y)}"><span>${v0434Esc(y)}</span><progress max="${max}" value="${v0434N(r.entity_count)}"></progress><b>${v0434Fmt(r.entity_count)}</b><small>${age} años</small></button>`;}).join('')}</div>`;
    };
  }

  v0434FetchEntities=async function(){
    const s=V0434_STATE,from=s.page*V0434_PAGE_SIZE,to=from+V0434_PAGE_SIZE-1;
    let q=sb.from(V0434_RECON_VIEW).select('entity_id,rut,resolved_name,uaf_sector_names,uaf_sector_label,reconciliation_status,sii_current_status,termination_date,termination_year,activity_start_date,main_activity,economic_sector,economic_subsector,sales_band_code,sales_band_rank,workers_numeric,sii_region,sii_commune,sii_signal_count,sii_signal_types,source_count,sanction_count,max_finding_sources',{count:'exact'});
    if(s.lens==='terminated')q=q.eq('reconciliation_status','SII_TERMINATED');
    else if(s.status==='active')q=q.eq('reconciliation_status','SII_ACTIVE');
    else if(s.status==='terminated')q=q.eq('reconciliation_status','SII_TERMINATED');
    else if(s.status==='missing')q=q.eq('reconciliation_status','NO_SII_PROFILE');
    if(s.lens==='terminated'&&s.year)q=q.eq('termination_year',Number(s.year));
    if(s.sector)q=q.contains('uaf_sector_names',[s.sector]);
    if(s.economic)q=q.eq('economic_sector',s.economic);
    const term=String(s.query||'').trim().replace(/,/g,' ');
    if(term)q=q.or(`rut.ilike.%${term}%,resolved_name.ilike.%${term}%,main_activity.ilike.%${term}%`);
    q=q.order(s.lens==='terminated'?'termination_date':'resolved_name',{ascending:s.lens!=='terminated',nullsFirst:false}).order('rut',{ascending:true}).range(from,to);
    const {data,count,error}=await q;if(error)throw error;s.total=count||0;return data||[];
  };

  const baseSetLens=typeof v0434SetLens==='function'?v0434SetLens:null;
  if(baseSetLens){
    v0434SetLens=function(lens){
      if(lens!=='terminated')V0434_STATE.year='';
      return baseSetLens(lens);
    };
  }

  document.addEventListener('click',async e=>{
    const year=e.target.closest?.('[data-v0434-year]');
    if(year){
      e.preventDefault();e.stopImmediatePropagation();
      const selected=String(year.dataset.v0434Year||'');
      V0434_STATE.year=V0434_STATE.year===selected?'':selected;
      V0434_STATE.query='';V0434_STATE.page=0;V0434_STATE.lens='terminated';V0434_STATE.status='terminated';
      await v0434RenderWorkspace();
      return;
    }
    if(e.target.closest?.('[data-v0434-reset]'))V0434_STATE.year='';
  },true);

  document.addEventListener('keydown',e=>{
    const help=e.target.closest?.('[data-v0434-help]');
    if(!help||!['Enter',' '].includes(e.key))return;
    e.preventDefault();e.stopPropagation();v0434ShowHelp(help.dataset.v0434Help);
  },true);

  if(window.__ATLAS_RECONCILIATION__){
    window.__ATLAS_RECONCILIATION__.release='0.43.5';
    window.__ATLAS_RECONCILIATION__.yearFilter='GOVERNED_TERMINATION_YEAR';
    window.__ATLAS_RECONCILIATION__.candidatePolicy='RADAR_SII_CANDIDATE_USE_SI_ONLY';
  }
})();
