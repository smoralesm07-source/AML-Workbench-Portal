'use strict';

/* AML Workbench v0.20.5 · UAF ↔ SII reconciliation
 * Operational registry reconciliation. This is NOT an AML risk score.
 */
const V0205='0.20.5';
const V0205_VIEW='aml_v0205_uaf_sii_reconciliation';
const V0205_PAGE_SIZE=50;
const V0205_ROWS=new Map();
let V0205_COUNTS=null;
let V0205_STATE={filter:'review',search:'',signal:'',page:0,total:0};
const v0205BaseShell=shell;
const v0205BaseUafMonitor=v0203UafMonitor;
const v0205BaseOverview=v019LoadOverview;
const v0205BaseRenderEntity=v0203RenderEntity;

shell=function(title,subtitle){
  v0205BaseShell(title,subtitle);
  const version=document.querySelector('.v019-brand small');
  if(version)version.textContent=`Operational Radar · v${V0205}`;
};

async function v0205Count(apply){
  let q=sb.from(V0205_VIEW).select('*',{count:'exact',head:true});
  if(apply)q=apply(q);
  const {count,error}=await q;if(error)throw error;return count||0;
}
async function v0205LoadCounts(force=false){
  if(V0205_COUNTS&&!force)return V0205_COUNTS;
  const [total,active,terminated,noSii]=await Promise.all([
    v0205Count(),
    v0205Count(q=>q.eq('reconciliation_status','SII_ACTIVE')),
    v0205Count(q=>q.eq('reconciliation_status','SII_TERMINATED')),
    v0205Count(q=>q.eq('reconciliation_status','NO_SII_PROFILE'))
  ]);
  V0205_COUNTS={total,active,terminated,noSii,matched:active+terminated,review:terminated+noSii};
  return V0205_COUNTS;
}
function v0205Pct(n,d){return d?`${(100*n/d).toLocaleString('es-CL',{maximumFractionDigits:1})}%`:'—';}
function v0205StatusMeta(status){
  return ({
    SII_ACTIVE:{label:'Coincidencia activa',cls:'active',type:'Conciliado'},
    SII_TERMINATED:{label:'Término de giro / terminado',cls:'terminated',type:'Revisar vigencia UAF'},
    NO_SII_PROFILE:{label:'Sin perfil SII materializado',cls:'missing',type:'Validar matching'}
  })[status]||{label:status||'Sin clasificar',cls:'unknown',type:'Revisar'};
}
function v0205FilterLabel(k){return ({review:'Requieren revisión',unmatched:'Sin perfil SII',terminated:'Término de giro',matched:'Con presencia SII',active:'Coincidencia activa',all:'Todos los SO'})[k]||'Conciliación';}

/* Replace v0.20.3 UAF top KPIs with reconciliation-aware, clickable cards. */
v0203UafMonitor=function(core,uaf){
  const html=v0205BaseUafMonitor(core,uaf);
  const dash=uaf.dashboard?.kpis||{};
  const total=v019Num(dash.registered_total_latest)||core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_observed),0);
  const cross=new Map(core.uafCross.map(r=>[String(r.radar_id),v019Num(r.uaf_entities)]));
  const matched=cross.get('RADAR_SII')||0,noSii=Math.max(0,total-matched);
  const three=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0),sanctioned=core.uafRegions.reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0);
  const start=html.indexOf('<div class="v0203-uaf-kpis">'),end=html.indexOf('<div class="v0203-uaf-grid">',start);
  if(start<0||end<0)return html;
  const replacement=`<div class="v0205-recon-kpis">
    <button type="button" data-v0205-recon-open="all"><span>SO inscritos UAF</span><b>${v019Fmt(total)}</b><small>ver universo completo →</small></button>
    <button type="button" class="matched" data-v0205-recon-open="matched"><span>Con presencia SII</span><b>${v019Fmt(matched)}</b><small>${v0205Pct(matched,total)} · incluye terminados</small></button>
    <button type="button" class="missing" data-v0205-recon-open="unmatched"><span>Sin perfil SII</span><b>${v019Fmt(noSii)}</b><small>${v0205Pct(noSii,total)} · validar uno a uno →</small></button>
    <button type="button" class="terminated" data-v0205-recon-open="terminated"><span>Término de giro en SII</span><b data-v0205-home-terminated>…</b><small>posible actualización UAF →</small></button>
  </div><div class="v0205-recon-context"><span><b>${v019Fmt(three)}</b> SO con 3+ fuentes</span><span><b>${v019Fmt(sanctioned)}</b> SO con sanciones</span><button type="button" data-v0205-recon-open="review">Abrir conciliación UAF ↔ SII →</button></div>`;
  return html.slice(0,start)+replacement+html.slice(end);
};

async function v0205HydrateHome(){
  try{const c=await v0205LoadCounts();document.querySelectorAll('[data-v0205-home-terminated]').forEach(x=>x.textContent=v019Fmt(c.terminated));}catch{}
}
v019LoadOverview=async function(){await v0205BaseOverview();await v0205HydrateHome();};
loadOverview=v019LoadOverview;

function v0205ApplyFilter(q,filter){
  if(filter==='review')return q.in('reconciliation_status',['NO_SII_PROFILE','SII_TERMINATED']);
  if(filter==='unmatched')return q.eq('reconciliation_status','NO_SII_PROFILE');
  if(filter==='terminated')return q.eq('reconciliation_status','SII_TERMINATED');
  if(filter==='matched')return q.in('reconciliation_status',['SII_ACTIVE','SII_TERMINATED']);
  if(filter==='active')return q.eq('reconciliation_status','SII_ACTIVE');
  return q;
}
function v0205ApplySignal(q,signal){
  if(signal==='sanctions')return q.gt('sanction_count',0);
  if(signal==='findings')return q.gt('finding_count',0);
  if(signal==='multi')return q.gte('max_finding_sources',3);
  return q;
}
async function v0205FetchRows(){
  const s=V0205_STATE,from=s.page*V0205_PAGE_SIZE,to=from+V0205_PAGE_SIZE-1;
  let q=sb.from(V0205_VIEW).select('*',{count:'exact'});
  q=v0205ApplyFilter(q,s.filter);q=v0205ApplySignal(q,s.signal);
  const term=cleanSearch(s.search);
  if(term){
    const safe=term.replace(/,/g,' ');
    q=q.or(`rut.ilike.%${safe}%,resolved_name.ilike.%${safe}%,uaf_category_hint.ilike.%${safe}%,main_activity.ilike.%${safe}%`);
  }
  q=q.order('operational_priority',{ascending:true}).order('termination_date',{ascending:false,nullsFirst:false}).order('rut',{ascending:true}).range(from,to);
  const {data,count,error}=await q;if(error)throw error;
  V0205_ROWS.clear();for(const r of data||[])V0205_ROWS.set(r.entity_id,r);
  s.total=count||0;return data||[];
}
function v0205KpiButton(key,label,value,sub,cls=''){
  return `<button type="button" class="v0205-kpi ${esc(cls)} ${V0205_STATE.filter===key?'active':''}" data-v0205-filter="${esc(key)}"><span>${esc(label)}</span><b>${v019Fmt(value)}</b><small>${esc(sub)}</small></button>`;
}
function v0205Coverage(c){
  return `<div class="v0205-coverage"><div><span>Coincidencia activa</span><progress class="active" max="${c.total}" value="${c.active}"></progress><b>${v019Fmt(c.active)}</b><small>${v0205Pct(c.active,c.total)}</small></div><div><span>Término de giro</span><progress class="terminated" max="${c.total}" value="${c.terminated}"></progress><b>${v019Fmt(c.terminated)}</b><small>${v0205Pct(c.terminated,c.total)}</small></div><div><span>Sin perfil SII</span><progress class="missing" max="${c.total}" value="${c.noSii}"></progress><b>${v019Fmt(c.noSii)}</b><small>${v0205Pct(c.noSii,c.total)}</small></div></div>`;
}
function v0205RowTitle(r){
  if(r.resolved_name)return `<b>${esc(r.resolved_name)}</b><small>${esc(r.rut||r.entity_id)}</small>`;
  return `<b>RUT ${esc(r.rut||'—')}</b><small>${r.uaf_category_hint?`Categoría UAF: ${esc(r.uaf_category_hint)}`:'Identidad pendiente de enriquecimiento'}</small>`;
}
function v0205SignalSummary(r){
  const parts=[];
  if(v019Num(r.finding_count))parts.push(`${v019Fmt(r.finding_count)} hallazgos`);
  if(v019Num(r.sanction_count))parts.push(`${v019Fmt(r.sanction_count)} sanción(es)`);
  if(v019Num(r.max_finding_sources)>=3)parts.push(`${v019Fmt(r.max_finding_sources)} fuentes`);
  return parts.length?parts.join(' · '):'Sin señales adicionales materializadas';
}
function v0205RowsHtml(rows){
  if(!rows.length)return '<div class="v019-empty">No hay entidades para los filtros seleccionados.</div>';
  return `<div class="v0205-tablewrap"><table class="v0205-table"><thead><tr><th>Prioridad</th><th>Entidad / categoría UAF</th><th>Conciliación</th><th>Estado SII</th><th>Término</th><th>Actividad SII</th><th>Contexto</th><th></th></tr></thead><tbody>${rows.map(r=>{const m=v0205StatusMeta(r.reconciliation_status);return `<tr><td><span class="v0205-priority ${esc(r.operational_priority)}">${esc(r.operational_priority)}</span></td><td class="identity">${v0205RowTitle(r)}</td><td><span class="v0205-status ${esc(m.cls)}">${esc(m.label)}</span></td><td>${esc(r.sii_current_status==='ACTIVE_AS_PUBLISHED'?'Activo publicado':r.sii_current_status==='TERMINATED_AS_PUBLISHED'?'Terminado publicado':'Sin perfil')}</td><td>${esc(r.termination_date||'—')}</td><td class="activity">${esc(v019Truncate(r.main_activity||'—',82))}</td><td><span class="v0205-context">${esc(v0205SignalSummary(r))}</span></td><td><button type="button" class="v0205-open" data-v0205-entity="${esc(r.entity_id)}">Ver ficha →</button></td></tr>`;}).join('')}</tbody></table></div>`;
}
function v0205Pager(){
  const s=V0205_STATE,pages=Math.max(1,Math.ceil(s.total/V0205_PAGE_SIZE));
  return `<div class="v0205-pager"><span>${v019Fmt(s.total)} resultados · página ${s.page+1} de ${pages}</span><div><button type="button" data-v0205-page="prev" ${s.page<=0?'disabled':''}>← Anterior</button><button type="button" data-v0205-page="next" ${s.page>=pages-1?'disabled':''}>Siguiente →</button></div></div>`;
}
async function v0205RenderRows(){
  const box=document.querySelector('#v0205-results');if(!box)return;box.innerHTML='<div class="v019-loading">Consultando conciliación autorizada…</div>';
  try{const rows=await v0205FetchRows();box.innerHTML=v0205RowsHtml(rows)+v0205Pager();}catch(e){box.innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}

async function v0205LoadReconciliation(filter='review',initialSearch=''){
  state.view='reconciliation';V0205_STATE={filter,search:initialSearch||'',signal:'',page:0,total:0};
  shell('Conciliación UAF ↔ SII','Quiénes coinciden, quiénes requieren validación y qué casos muestran término de giro en SII.');
  try{
    const c=await v0205LoadCounts();
    v019Content().innerHTML=`<div class="v0205-recon-page">
      <div class="v0205-command"><button type="button" class="v0203-back" data-v0205-back="radar">← Radar</button><button type="button" class="v0203-link" data-v0205-back="uaf">Inteligencia UAF</button></div>
      <section class="v0205-hero"><div><span>CONCILIACIÓN DE REGISTRO</span><h2>UAF ↔ SII</h2><p>La brecha se interpreta como un problema de conciliación y actualización de datos, no como incumplimiento ni riesgo AML.</p></div><div class="v0205-review"><span>Requieren revisión</span><b>${v019Fmt(c.review)}</b><small>${v019Fmt(c.noSii)} sin perfil SII + ${v019Fmt(c.terminated)} terminados</small></div></section>
      <section class="v0205-kpis">${v0205KpiButton('all','SO inscritos UAF',c.total,'universo del corte')}${v0205KpiButton('matched','Con presencia SII',c.matched,`${v0205Pct(c.matched,c.total)} del universo`,'matched')}${v0205KpiButton('unmatched','Sin perfil SII',c.noSii,'validar identidad / cobertura','missing')}${v0205KpiButton('terminated','Término de giro',c.terminated,'revisar vigencia UAF','terminated')}${v0205KpiButton('active','Coincidencia activa',c.active,'monitoreo normal','active')}</section>
      <section class="v019-card"><div class="v019-card-head"><div><h2>Cómo se distribuye el universo</h2><p>La coincidencia SII incluye tanto activos como sujetos publicados como terminados.</p></div></div>${v0205Coverage(c)}<div class="v0205-method-note"><b>Clave:</b> los ${v019Fmt(c.noSii)} casos “sin perfil SII” no significan que el RUT no exista en SII; significa que no tiene una fila materializada en <code>aml_entity_tax_profile</code>. Requieren validación del upstream/matching.</div></section>
      <section class="v019-card"><div class="v019-card-head"><div><h2 id="v0205-list-title">${esc(v0205FilterLabel(filter))}</h2><p>Abre cada fila para ver el motivo, contexto disponible y acción sugerida.</p></div></div><div class="v0205-toolbar"><input id="v0205-search" type="search" value="${esc(initialSearch||'')}" placeholder="Buscar RUT, nombre, categoría UAF o actividad SII"><select id="v0205-signal"><option value="">Todo contexto</option><option value="findings">Con hallazgos</option><option value="sanctions">Con sanciones</option><option value="multi">Con 3+ fuentes</option></select><button type="button" id="v0205-search-btn">Buscar</button></div><div id="v0205-results"></div></section>
    </div>`;
    await v0205RenderRows();
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
}

function v0205OpenEntityDrawer(r){
  const m=v0205StatusMeta(r.reconciliation_status);
  const title=r.resolved_name||`RUT ${r.rut||'—'}`;
  const interpretation=r.reconciliation_status==='SII_TERMINATED'
    ?`El RUT está inscrito en el universo UAF y SII lo publica como terminado${r.termination_date?` desde ${r.termination_date}`:''}. Es un candidato directo para revisar vigencia/actualización del registro UAF.`
    :r.reconciliation_status==='NO_SII_PROFILE'
      ?'El RUT está en el universo UAF, pero no existe un perfil SII materializado en el Workbench. Antes de cualquier acción regulatoria debe validarse cobertura, identidad y matching con la fuente SII.'
      :'Existe presencia UAF y perfil SII activo. No hay una brecha básica de conciliación en este corte.';
  v019OpenDrawer(`<div class="v0205-detail"><div class="v0205-detail-tags">${v0202SourceBadges(['RADAR_UAF',...(r.reconciliation_status==='NO_SII_PROFILE'?[]:['RADAR_SII'])])}<span class="v0205-status ${esc(m.cls)}">${esc(m.label)}</span><span class="v0205-priority ${esc(r.operational_priority)}">Prioridad operativa ${esc(r.operational_priority)}</span></div><h2>${esc(title)}</h2><p class="lead">${r.uaf_category_hint?`Categoría UAF de origen: ${esc(r.uaf_category_hint)}`:`RUT ${esc(r.rut||'—')}`}</p><section class="v0205-interpret"><b>Qué hay de fondo</b><p>${esc(interpretation)}</p></section><div class="v0205-detail-grid"><div><span>RUT</span><b>${esc(r.rut||'—')}</b></div><div><span>Último estado SII</span><b>${esc(r.sii_current_status==='ACTIVE_AS_PUBLISHED'?'Activo publicado':r.sii_current_status==='TERMINATED_AS_PUBLISHED'?'Terminado publicado':'Sin perfil')}</b></div><div><span>Fecha término</span><b>${esc(r.termination_date||'—')}</b></div><div><span>Último año comercial</span><b>${esc(r.sii_latest_commercial_year??'—')}</b></div><div><span>Tramo ventas</span><b>${esc(r.sales_band_code||'—')}</b></div><div><span>Trabajadores</span><b>${v019Fmt(r.workers_numeric)}</b></div></div>${r.main_activity?`<section class="v0205-detail-block"><span>Actividad principal SII</span><b>${esc(r.main_activity)}</b></section>`:''}<section class="v0205-detail-block"><span>Contexto adicional</span><b>${esc(v0205SignalSummary(r))}</b><small>${v019Fmt(r.evidence_count)} evidencias · IPA máximo ${r.max_ipa==null?'—':v019Fmt(r.max_ipa,1)}</small></section><section class="v0205-action"><span>Acción sugerida</span><b>${esc(r.suggested_action)}</b></section><div class="v0205-guard">Prioridad P1/P2/P3 = prioridad de conciliación administrativa, no score AML ni probabilidad de incumplimiento.</div><div class="v019-actions"><button type="button" class="v019-action" data-v0205-open360="${esc(r.entity_id)}">Abrir Entity 360</button><button type="button" class="v019-action" data-v0205-copy-rut="${esc(r.rut||'')}">Copiar RUT</button></div></div>`);
}

/* Entity 360: append reconciliation status and fix misleading UAF-only title. */
v0203RenderEntity=function(pkg){
  v0205BaseRenderEntity(pkg);
  v0205AppendEntityReconciliation(pkg.e).catch(()=>{});
};
async function v0205AppendEntityReconciliation(e){
  if(!e?.is_uaf_observed)return;
  const {data:r,error}=await sb.from(V0205_VIEW).select('*').eq('entity_id',e.entity_id).maybeSingle();if(error||!r)return;
  const hero=document.querySelector('.v0203-entity-hero');if(!hero)return;
  if(r.reconciliation_status==='NO_SII_PROFILE'&&r.uaf_category_hint){
    const h=hero.querySelector('h1'),p=hero.querySelector('p');if(h)h.textContent=`RUT ${r.rut||'—'}`;if(p)p.textContent=`Categoría UAF: ${r.uaf_category_hint} · identidad pendiente de enriquecimiento SII`;
  }
  const m=v0205StatusMeta(r.reconciliation_status);
  const panel=document.createElement('section');panel.className=`v0205-entity-recon ${m.cls}`;panel.innerHTML=`<div><span>CONCILIACIÓN UAF ↔ SII</span><b>${esc(m.label)}</b><small>${esc(r.suggested_action)}</small></div><button type="button" class="v0203-link" data-v0205-entity-recon="${esc(r.rut||'')}">Abrir conciliación →</button>`;
  const kpis=document.querySelector('.v0203-entity-kpis');if(kpis)kpis.insertAdjacentElement('afterend',panel);else hero.insertAdjacentElement('afterend',panel);
}

if(!window.__V0205_EVENTS){
  window.__V0205_EVENTS=true;
  document.addEventListener('click',async e=>{
    const open=e.target.closest('[data-v0205-recon-open]');if(open){e.preventDefault();await v0205LoadReconciliation(open.dataset.v0205ReconOpen);return;}
    const filter=e.target.closest('[data-v0205-filter]');if(filter){e.preventDefault();V0205_STATE.filter=filter.dataset.v0205Filter;V0205_STATE.page=0;document.querySelectorAll('[data-v0205-filter]').forEach(x=>x.classList.toggle('active',x===filter));const t=document.querySelector('#v0205-list-title');if(t)t.textContent=v0205FilterLabel(V0205_STATE.filter);await v0205RenderRows();return;}
    const row=e.target.closest('[data-v0205-entity]');if(row){e.preventDefault();const r=V0205_ROWS.get(row.dataset.v0205Entity);if(r)v0205OpenEntityDrawer(r);return;}
    const page=e.target.closest('[data-v0205-page]');if(page&&!page.disabled){e.preventDefault();V0205_STATE.page=Math.max(0,V0205_STATE.page+(page.dataset.v0205Page==='next'?1:-1));await v0205RenderRows();return;}
    const back=e.target.closest('[data-v0205-back]');if(back){e.preventDefault();if(back.dataset.v0205Back==='uaf')await v019LoadUaf();else await v019LoadOverview();return;}
    const open360=e.target.closest('[data-v0205-open360]');if(open360){e.preventDefault();v019CloseDrawer();await openEntity(open360.dataset.v0205Open360);return;}
    const recon=e.target.closest('[data-v0205-entity-recon]');if(recon){e.preventDefault();await v0205LoadReconciliation('all',recon.dataset.v0205EntityRecon);return;}
    const copy=e.target.closest('[data-v0205-copy-rut]');if(copy){e.preventDefault();try{await navigator.clipboard.writeText(copy.dataset.v0205CopyRut);copy.textContent='RUT copiado';}catch{}return;}
    if(e.target.id==='v0205-search-btn'){e.preventDefault();V0205_STATE.search=document.querySelector('#v0205-search')?.value||'';V0205_STATE.signal=document.querySelector('#v0205-signal')?.value||'';V0205_STATE.page=0;await v0205RenderRows();}
  });
  document.addEventListener('keydown',async e=>{if(e.key==='Enter'&&e.target?.id==='v0205-search'){e.preventDefault();V0205_STATE.search=e.target.value||'';V0205_STATE.signal=document.querySelector('#v0205-signal')?.value||'';V0205_STATE.page=0;await v0205RenderRows();}});
  document.addEventListener('change',async e=>{if(e.target?.id==='v0205-signal'){V0205_STATE.signal=e.target.value||'';V0205_STATE.page=0;await v0205RenderRows();}});
}
