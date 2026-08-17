'use strict';

/* AML Workbench v0.21.0 · UAF↔SII reconciliation analysis
 * - Termination cohort bar chart replaces generic universe distribution.
 * - Default alphabetical ordering; sortable columns.
 * - UAF sector comes from governed Radar_UAF entity registry materialized in aml_entities.profile.
 * - Year and sector filters are interactive and composable.
 */
const V0210='0.21.0';
const V0210_VIEW='aml_v0210_uaf_sii_reconciliation';
const V0210_YEAR_VIEW='aml_v0210_uaf_sii_terminated_year';
const V0210_STATE={year:'',sector:'',sort:'resolved_name',asc:true,years:[],sectors:[]};
const V0210_SORTABLE=new Set(['resolved_name','rut','uaf_sector_label','termination_date','termination_year','region','main_activity']);
const v0210BaseShell=shell;
const v0210BaseReconciliation=v0205LoadReconciliation;
const v0210BaseOpenEntityDrawer=v0205OpenEntityDrawer;

shell=function(title,subtitle){
  v0210BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0210}`;
};

function v0210FmtDate(v){
  if(!v)return '—';
  const d=new Date(`${String(v).slice(0,10)}T12:00:00Z`);
  if(Number.isNaN(d.getTime()))return String(v);
  return new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(d);
}
function v0210SortIcon(column){
  if(V0210_STATE.sort!==column)return '↕';
  return V0210_STATE.asc?'↑':'↓';
}
function v0210SectorLabel(r){
  if(r?.uaf_sector_label)return r.uaf_sector_label;
  const arr=v019Array(r?.uaf_sector_names).filter(Boolean);
  return arr.length?arr.join(' · '):'—';
}

/* Override the shared fetcher so pagination/search continue to use existing controls. */
v0205FetchRows=async function(){
  const s=V0205_STATE,from=s.page*V0205_PAGE_SIZE,to=from+V0205_PAGE_SIZE-1;
  let q=sb.from(V0210_VIEW).select('*',{count:'exact'});
  q=v0205ApplyFilter(q,s.filter);q=v0205ApplySignal(q,s.signal);
  const term=cleanSearch(s.search);
  if(term){
    const safe=term.replace(/,/g,' ');
    q=q.or(`rut.ilike.%${safe}%,resolved_name.ilike.%${safe}%,uaf_sector_label.ilike.%${safe}%,main_activity.ilike.%${safe}%`);
  }
  if(V0210_STATE.year)q=q.eq('termination_year',Number(V0210_STATE.year));
  if(V0210_STATE.sector)q=q.contains('uaf_sector_names',[V0210_STATE.sector]);
  const sort=V0210_SORTABLE.has(V0210_STATE.sort)?V0210_STATE.sort:'resolved_name';
  q=q.order(sort,{ascending:V0210_STATE.asc,nullsFirst:false});
  if(sort!=='resolved_name')q=q.order('resolved_name',{ascending:true,nullsFirst:false});
  if(sort!=='rut')q=q.order('rut',{ascending:true});
  q=q.range(from,to);
  const {data,count,error}=await q;if(error)throw error;
  V0205_ROWS.clear();for(const r of data||[])V0205_ROWS.set(r.entity_id,r);
  s.total=count||0;return data||[];
};

function v0210Th(label,column){
  return `<th><button type="button" class="v0210-sort" data-v0210-sort="${esc(column)}">${esc(label)} <span>${v0210SortIcon(column)}</span></button></th>`;
}
v0205RowsHtml=function(rows){
  if(!rows.length)return '<div class="v019-empty">No hay entidades para los filtros seleccionados.</div>';
  return `<div class="v0205-tablewrap"><table class="v0205-table v0210-table"><thead><tr>${v0210Th('Entidad','resolved_name')}${v0210Th('RUT','rut')}${v0210Th('Sector UAF','uaf_sector_label')}${v0210Th('Término SII','termination_date')}${v0210Th('Año','termination_year')}${v0210Th('Región','region')}${v0210Th('Actividad SII','main_activity')}<th>Contexto</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td class="identity">${v0205RowTitle(r)}</td><td>${esc(r.rut||'—')}</td><td class="uaf-sector">${esc(v0210SectorLabel(r))}</td><td>${esc(v0210FmtDate(r.termination_date))}</td><td>${esc(r.termination_year==null?'—':String(r.termination_year))}</td><td>${esc(v019RegionShort(r.region||'—'))}</td><td class="activity">${esc(v019Truncate(r.main_activity||'—',82))}</td><td><span class="v0205-context">${esc(v0205SignalSummary(r))}</span></td><td><button type="button" class="v0205-open" data-v0205-entity="${esc(r.entity_id)}">Ver ficha →</button></td></tr>`).join('')}</tbody></table></div>`;
};

async function v0210LoadMeta(force=false){
  if(!force&&V0210_STATE.years.length)return V0210_STATE;
  const [yearRes,sectorRes]=await Promise.all([
    sb.from(V0210_YEAR_VIEW).select('termination_year,entity_count').order('termination_year',{ascending:true}),
    sb.from(V0210_VIEW).select('uaf_sector_names').eq('reconciliation_status','SII_TERMINATED').limit(1000)
  ]);
  if(yearRes.error)throw yearRes.error;if(sectorRes.error)throw sectorRes.error;
  V0210_STATE.years=yearRes.data||[];
  const sectors=new Set();
  for(const row of sectorRes.data||[])for(const s of v019Array(row.uaf_sector_names))if(s)sectors.add(String(s));
  V0210_STATE.sectors=[...sectors].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  return V0210_STATE;
}
function v0210CohortStats(years){
  const now=new Date().getFullYear();
  const total=(years||[]).reduce((a,r)=>a+v019Num(r.entity_count),0);
  const valid=(years||[]).filter(r=>Number.isFinite(Number(r.termination_year)));
  const oldest=valid.length?Math.min(...valid.map(r=>Number(r.termination_year))):null;
  const five=valid.filter(r=>Number(r.termination_year)<=now-5).reduce((a,r)=>a+v019Num(r.entity_count),0);
  const ten=valid.filter(r=>Number(r.termination_year)<=now-10).reduce((a,r)=>a+v019Num(r.entity_count),0);
  return {total,oldest,five,ten,now};
}
function v0210CohortChart(years){
  const rows=years||[],max=Math.max(1,...rows.map(r=>v019Num(r.entity_count)));
  if(!rows.length)return '<div class="v019-empty">Sin fechas de término materializadas.</div>';
  return `<div class="v0210-year-chart" role="group" aria-label="Entidades por año de término de giro">${rows.map(r=>{const y=String(r.termination_year),active=String(V0210_STATE.year)===y;return `<button type="button" class="v0210-year-row ${active?'active':''}" data-v0210-year="${esc(y)}"><span>${esc(y)}</span><progress max="${max}" value="${v019Num(r.entity_count)}"></progress><b>${v019Fmt(r.entity_count)}</b></button>`;}).join('')}</div>`;
}
function v0210CohortPanel(){
  const st=v0210CohortStats(V0210_STATE.years);
  return `<div class="v0210-cohort-panel"><div class="v019-card-head"><div><h2>Antigüedad de términos de giro en SO inscritos UAF</h2><p>Cada barra representa el año desde el cual SII publica el término de giro de una entidad que continúa en el universo UAF del corte actual. Selecciona un año para filtrar el listado.</p></div><button type="button" class="v0210-clear-year" data-v0210-clear-year ${V0210_STATE.year?'':'disabled'}>Limpiar año</button></div><div class="v0210-cohort-kpis"><div><span>Total a revisar</span><b>${v019Fmt(st.total)}</b><small>SO UAF con término SII</small></div><div><span>Año más antiguo</span><b>${esc(st.oldest==null?'—':String(st.oldest))}</b><small>cohorte más antigua</small></div><div><span>${esc(String(st.now-5))} o anterior</span><b>${v019Fmt(st.five)}</b><small>antigüedad ≥5 años calendario</small></div><div><span>${esc(String(st.now-10))} o anterior</span><b>${v019Fmt(st.ten)}</b><small>antigüedad ≥10 años calendario</small></div></div>${v0210CohortChart(V0210_STATE.years)}<div class="v0210-chart-note">El año indica la fecha de término publicada por SII. La permanencia en el universo UAF justifica una revisión de vigencia/actualización administrativa, pero no implica incumplimiento por sí sola.</div></div>`;
}
function v0210ToolbarHtml(){
  const years=[...V0210_STATE.years].map(r=>Number(r.termination_year)).filter(Number.isFinite).sort((a,b)=>b-a);
  return `<div class="v0210-toolbar-row"><input id="v0205-search" type="search" value="${esc(V0205_STATE.search||'')}" placeholder="Buscar entidad, RUT, sector UAF o actividad SII"><select id="v0210-year-filter"><option value="">Todos los años de término</option>${years.map(y=>`<option value="${y}" ${String(V0210_STATE.year)===String(y)?'selected':''}>${y}</option>`).join('')}</select><select id="v0210-sector-filter"><option value="">Todos los sectores UAF</option>${V0210_STATE.sectors.map(s=>`<option value="${esc(s)}" ${V0210_STATE.sector===s?'selected':''}>${esc(s)}</option>`).join('')}</select><select id="v0205-signal"><option value="" ${!V0205_STATE.signal?'selected':''}>Todo contexto</option><option value="findings" ${V0205_STATE.signal==='findings'?'selected':''}>Con hallazgos</option><option value="sanctions" ${V0205_STATE.signal==='sanctions'?'selected':''}>Con sanciones</option><option value="multi" ${V0205_STATE.signal==='multi'?'selected':''}>Con 3+ fuentes</option></select><button type="button" id="v0205-search-btn">Aplicar</button><button type="button" class="v0210-reset" data-v0210-reset>Limpiar filtros</button></div>`;
}
async function v0210EnhancePage(){
  await v0210LoadMeta();
  const coverage=document.querySelector('.v0205-coverage')?.closest('.v019-card');
  if(coverage)coverage.innerHTML=v0210CohortPanel();
  const toolbar=document.querySelector('.v0205-toolbar');if(toolbar){toolbar.classList.add('v0210-toolbar');toolbar.innerHTML=v0210ToolbarHtml();}
  const title=document.querySelector('#v0205-list-title');
  if(title&&V0205_STATE.filter==='terminated')title.textContent=V0210_STATE.year?`Términos de giro · ${V0210_STATE.year}`:'SO UAF con término de giro publicado en SII';
  await v0205RenderRows();
}

v0205LoadReconciliation=async function(filter='terminated',initialSearch=''){
  V0210_STATE.year='';V0210_STATE.sector='';V0210_STATE.sort='resolved_name';V0210_STATE.asc=true;
  await v0210BaseReconciliation(filter,initialSearch);
  try{await v0210EnhancePage();}catch(e){console.error('v0.21 reconciliation enhancement',e);}
};

v0205OpenEntityDrawer=function(r){
  v0210BaseOpenEntityDrawer(r);
  const detail=document.querySelector('.v0205-detail');
  if(detail&&v0210SectorLabel(r)!=='—'){
    const interpret=detail.querySelector('.v0205-interpret');
    const block=document.createElement('section');block.className='v0205-detail-block v0210-uaf-sector-detail';block.innerHTML=`<span>Sector económico UAF</span><b>${esc(v0210SectorLabel(r))}</b>`;
    if(interpret)interpret.insertAdjacentElement('afterend',block);else detail.appendChild(block);
  }
};

if(!window.__V0210_EVENTS){
  window.__V0210_EVENTS=true;
  document.addEventListener('click',async e=>{
    const year=e.target.closest('[data-v0210-year]');
    if(year){e.preventDefault();V0210_STATE.year=year.dataset.v0210Year||'';V0205_STATE.filter='terminated';V0205_STATE.page=0;document.querySelectorAll('[data-v0205-filter]').forEach(x=>x.classList.toggle('active',x.dataset.v0205Filter==='terminated'));const yf=document.querySelector('#v0210-year-filter');if(yf)yf.value=V0210_STATE.year;const card=year.closest('.v019-card');if(card)card.innerHTML=v0210CohortPanel();const t=document.querySelector('#v0205-list-title');if(t)t.textContent=`Términos de giro · ${V0210_STATE.year}`;await v0205RenderRows();return;}
    if(e.target.closest('[data-v0210-clear-year]')){e.preventDefault();V0210_STATE.year='';V0205_STATE.page=0;const yf=document.querySelector('#v0210-year-filter');if(yf)yf.value='';const card=e.target.closest('.v019-card');if(card)card.innerHTML=v0210CohortPanel();const t=document.querySelector('#v0205-list-title');if(t)t.textContent='SO UAF con término de giro publicado en SII';await v0205RenderRows();return;}
    const sort=e.target.closest('[data-v0210-sort]');
    if(sort){e.preventDefault();const col=sort.dataset.v0210Sort;if(!V0210_SORTABLE.has(col))return;if(V0210_STATE.sort===col)V0210_STATE.asc=!V0210_STATE.asc;else{V0210_STATE.sort=col;V0210_STATE.asc=true;}V0205_STATE.page=0;await v0205RenderRows();return;}
    if(e.target.closest('[data-v0210-reset]')){e.preventDefault();V0210_STATE.year='';V0210_STATE.sector='';V0210_STATE.sort='resolved_name';V0210_STATE.asc=true;V0205_STATE.search='';V0205_STATE.signal='';V0205_STATE.page=0;const search=document.querySelector('#v0205-search');if(search)search.value='';const yf=document.querySelector('#v0210-year-filter');if(yf)yf.value='';const sf=document.querySelector('#v0210-sector-filter');if(sf)sf.value='';const sig=document.querySelector('#v0205-signal');if(sig)sig.value='';const card=document.querySelector('.v0210-cohort-panel')?.closest('.v019-card');if(card)card.innerHTML=v0210CohortPanel();await v0205RenderRows();return;}
  });
  document.addEventListener('change',async e=>{
    if(e.target?.id==='v0210-year-filter'){V0210_STATE.year=e.target.value||'';if(V0210_STATE.year)V0205_STATE.filter='terminated';V0205_STATE.page=0;const card=document.querySelector('.v0210-cohort-panel')?.closest('.v019-card');if(card)card.innerHTML=v0210CohortPanel();await v0205RenderRows();return;}
    if(e.target?.id==='v0210-sector-filter'){V0210_STATE.sector=e.target.value||'';V0205_STATE.page=0;await v0205RenderRows();return;}
  });
  document.addEventListener('click',e=>{
    const f=e.target.closest('[data-v0205-filter]');if(!f)return;
    if(f.dataset.v0205Filter!=='terminated')V0210_STATE.year='';
  },true);
}

window.__AML_BUILD__=V0210;
setTimeout(()=>{const version=document.querySelector('.v019-brand small');if(version)version.textContent=`Operational Radar · v${V0210}`;},0);
