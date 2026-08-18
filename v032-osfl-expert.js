'use strict';

/* AML Workbench v0.32.0 · OSFL expert UX/AML layer
 * - Regional map selection filters Activity, IPA3, SII trajectory, public exposure and explorer.
 * - IPA3 bands become exact, navigable filters with entity drill-down.
 * - OSFL 360 adds sales-band history and lazy Presupuesto Abierto exposure by RUT.
 * - Public/registry/R.8 context never scores by itself.
 */
const V032='0.32.0';
const V032_BUILD='0320';
const V032_ENTITY_RUNTIME='aml_osfl_entity_runtime_snapshot';
const V032_REGION_RUNTIME='aml_osfl_region_runtime_snapshot';
const V032_BUDGET_QUEUE='https://raw.githubusercontent.com/smoralesm07-source/Rada_Presupuesto_Abierto/main/docs/data/investigation_queue.json';
const V032_CACHE={regionDash:null,budgetPromise:null};
V030_STATE.ipaBand=V030_STATE.ipaBand||'';
V030_STATE.publicFilter=V030_STATE.publicFilter||'';

function v032Scope(){
  if(!V032_CACHE.regionDash)return null;
  return V032_CACHE.regionDash.get(V030_STATE.region||'__ALL__')||V032_CACHE.regionDash.get('__ALL__')||null;
}
function v032ScopeLabel(){return V030_STATE.region?`Región · ${v030RegionShort(V030_STATE.region)}`:'Todo Chile';}
function v032Money(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n):'—';}
function v032RutKey(v){const x=String(v||'').toUpperCase().replace(/[^0-9K]/g,'');return x.length>1?`${x.slice(0,-1)}-${x.slice(-1)}`:'';}
async function v032LoadRegionDash(force=false){
  if(V032_CACHE.regionDash&&!force)return V032_CACHE.regionDash;
  const {data,error}=await sb.from(V032_REGION_RUNTIME).select('*');
  if(error)throw error;
  V032_CACHE.regionDash=new Map((data||[]).map(r=>[String(r.scope_key),r]));
  return V032_CACHE.regionDash;
}
function v032Rows(key,fallback=[]){const s=v032Scope(),v=s?.[key];return Array.isArray(v)?v:fallback;}

/* Hero: remove redundant source-linkage KPIs; add regulated-entity context. */
v030Hero=function(){
  const q=V030_CACHE.quality||{},src=V030_CACHE.meta?.universe||{},reg=V030_CACHE.meta?.registries||{},all=V032_CACHE.regionDash?.get('__ALL__');
  const source=v030N(src.expanded)||v030N(V030_CACHE.sourceCoverage?.source_profiles)||v030N(all?.entity_count);
  const r8=v030N(all?.r8_count)||v030N(src.r8_candidates);
  const pub=v030N(all?.law21440_count)+v030N(all?.registro19862_count)-v030N(all?.dual_public_registry_count);
  const so=v030N(all?.uaf_so_count)||v030N(q.uaf_so);
  const ipa=v030N(all?.ipa3_positive_count)||v030N(q.ipa3_positive);
  return `<section class="v030-hero v032-hero"><div class="v030-hero-copy"><span class="v030-kicker">INTELIGENCIA OSFL · CHILE</span><h2>Universo, exposición pública y prioridad analítica</h2><p>Explora organizaciones sin fines de lucro desde el panorama nacional hasta la entidad. El mapa y las tarjetas comparten filtro regional; IPA 3.0 orienta revisión y no representa probabilidad de LA/FT.</p><div class="v030-hero-tags"><span>Entity Hub</span><span>SII 2020–2024</span><span>Registros públicos</span><span>Presupuesto Abierto</span><span>UAF + sanciones</span><span>IPA3 v0.4 shadow</span></div></div><div class="v030-hero-score"><span>OSFL con IPA3 activo</span><b>${v030Fmt(ipa)}</b><small>${v030Pct(ipa,source)} del universo Radar_OSFL</small><em>prioridad analítica</em></div><div class="v030-hero-metrics v032-hero-metrics"><div><span>Universo Radar_OSFL</span><b>${v030Fmt(source)}</b><small>snapshot fuente gobernado</small></div><div class="uaf"><span>También son SO UAF</span><b>${v030Fmt(so)}</b><small>cruce exacto por identidad</small></div><div><span>R.8 candidatas</span><b>${v030Fmt(r8)}</b><small>cribado funcional · aporte IPA 0</small></div><div><span>Registro público</span><b>${v030Fmt(pub)}</b><small>Ley 21.440 y/o 19.862</small></div></div></section>`;
};

v030ActivityChart=function(){
  const rows=v032Rows('activities',V030_CACHE.activities).slice(0,7),max=Math.max(1,...rows.map(r=>v030N(r.entity_count)));
  return `<section class="v030-card v032-activity-card"><div class="v030-card-head"><div><span>ACTIVIDAD · ${esc(v032ScopeLabel())}</span><h3>Composición del universo</h3><p>Actividad económica disponible para el ámbito seleccionado. Seleccionar una actividad filtra el explorador.</p></div><span class="v030-hint">clic → filtrar</span></div><div class="v030-activity-list">${rows.map(r=>`<button type="button" class="v030-activity ${V030_STATE.activity===r.activity_group?'active':''}" data-v030-activity="${esc(r.activity_group)}"><span><b>${esc(r.activity_group)}</b><small>${v030Fmt(r.ipa3_positive_count)} IPA3 · ${v030Fmt(r.uaf_so_count)} SO · ${v030Fmt(r.r8_known_count)} R.8</small></span><progress max="${max}" value="${v030N(r.entity_count)}"></progress><strong>${v030Fmt(r.entity_count)}</strong></button>`).join('')}</div><div class="v032-card-foot">Se muestran las 7 categorías con mayor presencia en el ámbito actual.</div></section>`;
};

v030Timeline=function(){
  const s=v032Scope(),rows=v032Rows('sii_years',V030_CACHE.years),last=rows[rows.length-1]||{},first=rows[0]||{};
  const growth=rows.reduce((a,r)=>a+v030N(r.growth_2plus_count),0),drop=rows.reduce((a,r)=>a+v030N(r.contraction_2plus_count),0);
  const max=Math.max(1,...rows.map(r=>v030N(r.entity_count)));
  return `<section class="v030-card v032-timeline-card"><div class="v030-card-head"><div><span>TRAYECTORIA SII · ${esc(v032ScopeLabel())}</span><h3>Ventas, empleo y cambios 2020–2024</h3><p>Tramos de ventas SII y trabajadores materializados por año. El tramo representa un rango de ventas, no un monto exacto.</p></div></div><div class="v032-sii-kpis"><div><span>Con historia SII</span><b>${v030Fmt(s?.history_entity_count)}</b><small>${v030Pct(s?.history_entity_count,s?.entity_count)} del ámbito</small></div><div><span>Mediana tramo 2024</span><b>${last.median_sales_band_rank==null?'—':`T${v030Fmt(last.median_sales_band_rank,0)}`}</b><small>promedio T${v030Fmt(last.avg_sales_band_rank,1)}</small></div><div><span>Mediana trabajadores</span><b>${v030Fmt(last.median_workers,0)}</b><small>último año disponible</small></div><div><span>Movimientos fuertes</span><b>${v030Fmt(growth)}↑ · ${v030Fmt(drop)}↓</b><small>cambios ≥2 tramos</small></div></div><div class="v032-sii-years">${rows.map(r=>`<div class="v032-sii-year"><header><b>${esc(String(r.commercial_year))}</b><span>${v030Fmt(r.entity_count)} entidades</span></header><progress max="${max}" value="${v030N(r.entity_count)}"></progress><div><span>Tramo mediano <b>${r.median_sales_band_rank==null?'—':`T${v030Fmt(r.median_sales_band_rank,0)}`}</b></span><span>Trab. mediana <b>${v030Fmt(r.median_workers,0)}</b></span></div><small><em>↑ ${v030Fmt(r.growth_2plus_count)}</em><em>↓ ${v030Fmt(r.contraction_2plus_count)}</em><em>actividad Δ ${v030Fmt(r.activity_change_count)}</em></small></div>`).join('')}</div>${rows.length?`<div class="v032-trajectory-note">Cobertura visible: ${esc(String(first.commercial_year||'—'))}–${esc(String(last.commercial_year||'—'))}. Cambios agregados sirven para localizar fenómenos; no se atribuyen automáticamente a una OSFL individual.</div>`:''}</section>`;
};

v030IpaPanel=function(){
  const order=['MUY_ALTA','ALTA','MEDIA','BAJA','SIN_MARCA_SHADOW'],rows=v032Rows('bands',V030_CACHE.bands),map=new Map(rows.map(r=>[r.priority_band_shadow,r])),total=order.reduce((a,k)=>a+v030N(map.get(k)?.entity_count),0)||1;
  return `<section class="v030-card v030-ipa-card v032-ipa-card"><div class="v030-card-head"><div><span>IPA 3.0 · SHADOW · ${esc(v032ScopeLabel())}</span><h3>Prioridad analítica OSFL</h3><p>Selecciona una banda para filtrar exactamente ese universo y revisar sus entidades con mayor prioridad.</p></div><button type="button" data-v030-flag="ipa">Ver todo IPA3 &gt; 0 →</button></div><div class="v030-band-grid">${order.map(k=>{const r=map.get(k)||{},active=V030_STATE.ipaBand===k;return `<button type="button" class="${v030BandCls(k)} ${active?'selected':''}" data-v030-band="${esc(k)}"><span>${esc(v030Band(k))}</span><b>${v030Fmt(r.entity_count)}</b><small>${v030Pct(r.entity_count,total)} · máx ${v030Fmt(r.max_score,1)}</small></button>`;}).join('')}</div><div class="v032-ipa-top" data-v032-ipa-top><div class="v019-loading">Cargando entidades priorizadas…</div></div><div class="v030-ipa-guard">IPA3 es prioridad analítica gobernada. R.8, pertenencia OSFL y recepción de recursos públicos no generan puntos por sí solas.</div></section>`;
};

v030PublicContext=function(){
  const s=v032Scope()||{},total=Math.max(1,v030N(s.entity_count)),pubUnion=v030N(s.law21440_count)+v030N(s.registro19862_count)-v030N(s.dual_public_registry_count);
  const tile=(id,label,n,desc)=>`<button type="button" data-v032-public="${esc(id)}"><span>${esc(label)}</span><b>${v030Fmt(n)}</b><small>${v030Pct(n,total)} · ${esc(desc)}</small></button>`;
  return `<section class="v030-card v030-public-card v032-public-card"><div class="v030-card-head"><div><span>EXPOSICIÓN PÚBLICA · ${esc(v032ScopeLabel())}</span><h3>Registros, regulación y relación con el Estado</h3><p>Capas de exposición útiles para contextualizar una OSFL. Cada cifra puede filtrar el explorador.</p></div></div><div class="v030-public-grid v032-public-grid">${tile('law21440','Ley 21.440',s.law21440_count,'donatarias activas')}${tile('registro19862','Ley 19.862',s.registro19862_count,'colaboradores del Estado')}${tile('dual','Doble registro',s.dual_public_registry_count,'presencia en ambas capas')}${tile('uaf','SO UAF',s.uaf_so_count,'sujeto obligado inscrito')}${tile('sanctions','Sanciones',s.sanctioned_entity_count,'identidad reconciliada')}${tile('r8','FATF R.8',s.r8_count,'cribado funcional') }<div class="v032-budget-tile"><span>Presupuesto Abierto</span><b>RUT → organismo</b><small>Detalle de pagos/transacciones señalizadas disponible en OSFL 360.</small></div></div><div class="v032-public-summary"><b>${v030Fmt(pubUnion)}</b><span>organizaciones con al menos una presencia en Ley 21.440/19.862 dentro del ámbito actual.</span></div><div class="v030-context-rule"><b>Lectura AML:</b> exposición pública ≠ riesgo. El interés analítico surge al combinar materialidad, temporalidad, concentración, anomalías económicas, sanciones u otras marcas independientes.</div></section>`;
};

const v032BaseFilterOptions=v030FilterOptions;
v030FilterOptions=function(){
  const base=v032BaseFilterOptions();
  const chips=[];
  if(V030_STATE.region)chips.push(`<button type="button" data-v032-clear="region">Región · ${esc(v030RegionShort(V030_STATE.region))} ×</button>`);
  if(V030_STATE.ipaBand)chips.push(`<button type="button" data-v032-clear="band">IPA3 · ${esc(v030Band(V030_STATE.ipaBand))} ×</button>`);
  if(V030_STATE.publicFilter)chips.push(`<button type="button" data-v032-clear="public">Exposición · ${esc(V030_STATE.publicFilter)} ×</button>`);
  return `${base}${chips.length?`<div class="v032-filter-chips"><span>Filtros analíticos</span>${chips.join('')}</div>`:''}`;
};

v030FetchRows=async function(){
  const from=V030_STATE.page*V030_PAGE_SIZE,to=from+V030_PAGE_SIZE-1;
  let q=sb.from(V032_ENTITY_RUNTIME).select('entity_id,rut,name,region,commune,confirmation_level,detail_profile,activity_group,main_activity,sales_band_rank,sales_band,workers_numeric,current_status,activity_start_date,termination_date,sii_year_count,first_year,latest_year,max_sales_band_increase,max_sales_band_decrease,law21440_active,registro19862,fatf_r8_candidate,direct_confirmed,is_uaf_observed,sanction_count,regulator_count,latest_sanction_date,ipa3_score,priority_band_shadow,score_confidence_pct,coverage_index_pct,dominant_mark_id,included_mark_ids,diagnostic_mark_ids,independent_group_count',{count:'exact'});
  if(V030_STATE.region)q=q.eq('region',V030_STATE.region);
  if(V030_STATE.activity)q=q.eq('activity_group',V030_STATE.activity);
  const term=String(V030_STATE.search||'').trim().replace(/,/g,' ');if(term)q=q.or(`name.ilike.%${term}%,rut.ilike.%${term}%`);
  if(V030_STATE.ipaBand)q=q.eq('priority_band_shadow',V030_STATE.ipaBand);
  if(V030_STATE.flag==='ipa')q=q.gt('ipa3_score',0);
  if(V030_STATE.flag==='r8')q=q.eq('fatf_r8_candidate',true);
  if(V030_STATE.flag==='public')q=q.or('law21440_active.eq.true,registro19862.eq.true');
  if(V030_STATE.flag==='uaf')q=q.eq('is_uaf_observed',true);
  if(V030_STATE.flag==='sanctions')q=q.gt('sanction_count',0);
  if(V030_STATE.flag==='history')q=q.gt('sii_year_count',0);
  if(V030_STATE.publicFilter==='law21440')q=q.eq('law21440_active',true);
  if(V030_STATE.publicFilter==='registro19862')q=q.eq('registro19862',true);
  if(V030_STATE.publicFilter==='dual')q=q.eq('law21440_active',true).eq('registro19862',true);
  if(V030_STATE.publicFilter==='uaf')q=q.eq('is_uaf_observed',true);
  if(V030_STATE.publicFilter==='sanctions')q=q.gt('sanction_count',0);
  if(V030_STATE.publicFilter==='r8')q=q.eq('fatf_r8_candidate',true);
  q=q.order(V030_STATE.sort,{ascending:V030_STATE.asc,nullsFirst:false});if(V030_STATE.sort!=='name')q=q.order('name',{ascending:true,nullsFirst:false});
  const {data,count,error}=await q.range(from,to);if(error)throw error;V030_STATE.total=count||0;V030_CACHE.rows.clear();for(const r of data||[])V030_CACHE.rows.set(r.entity_id,r);return data||[];
};

async function v032HydrateIpaTop(){
  const host=document.querySelector('[data-v032-ipa-top]');if(!host)return;
  if(V030_STATE.ipaBand==='SIN_MARCA_SHADOW'){host.innerHTML='<div class="v032-ipa-empty">Banda sin marca scoring: utilice el explorador para revisar cobertura/contexto.</div>';return;}
  let q=sb.from(V032_ENTITY_RUNTIME).select('entity_id,name,rut,region,ipa3_score,priority_band_shadow,dominant_mark_id,score_confidence_pct').gt('ipa3_score',0).order('ipa3_score',{ascending:false}).limit(6);
  if(V030_STATE.region)q=q.eq('region',V030_STATE.region);if(V030_STATE.ipaBand)q=q.eq('priority_band_shadow',V030_STATE.ipaBand);
  const {data,error}=await q;if(error){host.innerHTML=`<div class="v019-error">${esc(error.message)}</div>`;return;}
  const rows=data||[];for(const r of rows)V030_CACHE.rows.set(r.entity_id,Object.assign(V030_CACHE.rows.get(r.entity_id)||{},r));
  host.innerHTML=rows.length?`<div class="v032-ipa-top-head"><b>Entidades a revisar primero</b><span>clic → OSFL 360</span></div>${rows.map((r,i)=>`<button type="button" data-v032-ipa-open="${esc(r.entity_id)}"><em>${i+1}</em><span><b>${esc(v019Truncate(r.name||'Entidad',48))}</b><small>${esc(v030RegionShort(r.region))}${r.dominant_mark_id?` · ${esc(r.dominant_mark_id)}`:''}</small></span><strong>${v030Fmt(r.ipa3_score,1)}</strong></button>`).join('')}`:'<div class="v032-ipa-empty">Sin entidades con IPA3 activo en este ámbito.</div>';
}

function v032SalesHistory(rows){
  if(!rows?.length)return v030Empty('Sin historia SII entity-year materializada.');
  const max=Math.max(13,...rows.map(r=>v030N(r.sales_band_rank)));
  return `<div class="v032-sales-history">${rows.map(r=>{const d=r.sales_band_delta==null?null:Number(r.sales_band_delta),tone=d==null?'neutral':d>=2?'up':d<=-2?'down':'flat';return `<div class="v032-sales-year ${tone}"><header><b>${esc(String(r.commercial_year))}</b><span>${esc(r.sales_band_code||`Tramo ${r.sales_band_rank??'—'}`)}</span></header><div class="bar"><progress max="${max}" value="${v030N(r.sales_band_rank)}"></progress><strong>T${esc(String(r.sales_band_rank??'—'))}</strong></div><footer><span>${v030Fmt(r.workers_numeric)} trabajadores</span><em>${d==null?'sin Δ':`${d>0?'+':''}${d} tramos`}</em></footer>${r.main_activity?`<small>${esc(v019Truncate(r.main_activity,70))}</small>`:''}</div>`;}).join('')}</div><div class="v032-sales-note">SII publica tramos/rangos de ventas. La ficha no transforma el tramo en un monto de ventas exacto.</div>`;
}
function v032MarkList(rows){return v030MarkList(rows);}

async function v032BudgetIndex(){
  if(V032_CACHE.budgetPromise)return V032_CACHE.budgetPromise;
  V032_CACHE.budgetPromise=(async()=>{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
    try{
      const res=await fetch(`${V032_BUDGET_QUEUE}?_=${Math.floor(Date.now()/3600000)}`,{cache:'default',signal:ctrl.signal});if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const raw=await res.json(),index=new Map();
      for(const row of raw.queue||[]){
        const keys=new Set();
        for(const id of [row.provider_id,row.recipient_id]){const m=String(id||'').match(/RUT-(\d+-[0-9K])$/i);if(m)keys.add(m[1].toUpperCase());}
        for(const key of keys){if(!index.has(key))index.set(key,{signals:0,signalTypes:new Set(),transactions:new Map(),organizations:new Map(),maxPriority:0,p1:0});const x=index.get(key);x.signals++;x.signalTypes.add(row.signal_type);x.maxPriority=Math.max(x.maxPriority,Number(row.investigation_priority_score)||0);if(row.priority_tier==='P1')x.p1++;const txid=String(row.transaction_id||row.signal_id);if(!x.transactions.has(txid))x.transactions.set(txid,{amount:Number(row.transaction_amount)||0,year:row.periodo,month:row.mes,organization:row.organization_name||'Organismo no informado',id:txid});}
      }
      for(const x of index.values())for(const tx of x.transactions.values()){const k=tx.organization;if(!x.organizations.has(k))x.organizations.set(k,{name:k,amount:0,transactions:0,years:new Set()});const o=x.organizations.get(k);o.amount+=tx.amount;o.transactions++;if(tx.year)o.years.add(tx.year);}
      return {generated_at:raw.generated_at||null,index};
    } finally {clearTimeout(timer);}
  })();
  try{return await V032_CACHE.budgetPromise;}catch(e){V032_CACHE.budgetPromise=null;throw e;}
}
async function v032BudgetExposure(rut){const key=v032RutKey(rut);if(!key)return {status:'NO_RUT'};const b=await v032BudgetIndex(),x=b.index.get(key);if(!x)return {status:'NO_SIGNALIZED_TRANSACTION',generated_at:b.generated_at};const tx=[...x.transactions.values()],organizations=[...x.organizations.values()].map(o=>({...o,years:[...o.years].sort()})).sort((a,b)=>b.amount-a.amount);return {status:'MATCH',generated_at:b.generated_at,signals:x.signals,signalTypes:[...x.signalTypes].sort(),transactions:tx.length,totalAmount:tx.reduce((a,t)=>a+t.amount,0),organizations,maxPriority:x.maxPriority,p1:x.p1,years:[...new Set(tx.map(t=>t.year).filter(Boolean))].sort()};}
function v032BudgetHtml(x){
  if(!x)return '<div class="v019-loading">Consultando Presupuesto Abierto por RUT…</div>';
  if(x.status==='ERROR')return `<div class="v032-budget-empty"><b>Presupuesto Abierto no disponible</b><span>${esc(x.message||'No fue posible consultar el corte público.')}</span></div>`;
  if(x.status==='NO_RUT')return '<div class="v032-budget-empty"><b>Sin RUT para cruce</b><span>No es posible efectuar conciliación determinística con Presupuesto Abierto.</span></div>';
  if(x.status==='NO_SIGNALIZED_TRANSACTION')return `<div class="v032-budget-empty"><b>Sin transacción señalizada materializada para este RUT</b><span>Esto no equivale a no haber recibido recursos públicos. La cobertura corresponde a la cola de señales del Radar Presupuesto Abierto, no al total de pagos del Estado.</span><small>Corte ${esc(x.generated_at||'—')}</small></div>`;
  return `<div class="v032-budget-summary"><div><span>Monto observado</span><b>${v032Money(x.totalAmount)}</b><small>${v030Fmt(x.transactions)} transacciones únicas en cola</small></div><div><span>Organismos</span><b>${v030Fmt(x.organizations.length)}</b><small>${esc((x.years||[]).join(' · ')||'años no informados')}</small></div><div><span>Señales</span><b>${v030Fmt(x.signals)}</b><small>${v030Fmt(x.p1)} P1 · prioridad máx ${v030Fmt(x.maxPriority)}</small></div></div><div class="v032-budget-orgs">${x.organizations.slice(0,8).map(o=>`<div><span><b>${esc(v019Truncate(o.name,72))}</b><small>${v030Fmt(o.transactions)} transacciones · ${(o.years||[]).join(', ')}</small></span><strong>${v032Money(o.amount)}</strong></div>`).join('')}</div><div class="v032-budget-types"><b>Tipologías de señal materializadas</b><span>${(x.signalTypes||[]).map(t=>`<em>${esc(t)}</em>`).join('')}</span></div><div class="v032-budget-warning">Los montos corresponden únicamente a transacciones presentes en la cola de señales del Radar Presupuesto Abierto. No representan el total histórico de recursos públicos recibidos ni constituyen irregularidad por sí mismos.</div>`;
}

async function v032GetEntity(id){if(V030_CACHE.rows.has(id))return V030_CACHE.rows.get(id);const {data,error}=await sb.from(V032_ENTITY_RUNTIME).select('*').eq('entity_id',id).maybeSingle();if(error)throw error;if(data)V030_CACHE.rows.set(id,data);return data;}
v030OpenEntity=async function(id){
  const base=await v032GetEntity(id);if(!base)return;V030_STATE.selectedEntity=id;
  v019OpenDrawer('<div class="v030-drawer v032-drawer"><div class="v030-drawer-loading">Construyendo OSFL 360…</div></div>');
  try{
    const [histRes,marksRes,uafRes,sancRes]=await Promise.allSettled([
      sb.from('aml_sii_entity_year').select('commercial_year,sales_band_code,sales_band_rank,workers_numeric,sales_band_delta,workforce_ratio,region,main_activity,main_activity_changed,region_changed').eq('entity_id',id).order('commercial_year',{ascending:true}),
      sb.from('aml_v_ipa3_mark_scores_v0_4').select('mark_id,mark_name,included_in_score,contribution,raw_intensity,readiness,evidence').eq('entity_id',id).order('contribution',{ascending:false}),
      base.rut?sb.from('aml_uaf_entity_profile').select('sector_names,registry_names,source_scope,updated_at').eq('rut',base.rut).maybeSingle():Promise.resolve({data:null,error:null}),
      sb.from('aml_v028_sanctions_with_identity').select('sanction_id,event_date,regulator,subject,laft_direct,amount_uf').eq('entity_id',id).order('event_date',{ascending:false}).limit(12)
    ]);
    const ok=(r,f)=>r.status==='fulfilled'&&!r.value.error?(r.value.data??f):f,hist=ok(histRes,[]),marks=ok(marksRes,[]),uaf=ok(uafRes,null),san=ok(sancRes,[]),latest=hist[hist.length-1]||{};
    const body=document.querySelector('#v019-drawer-body');if(!body)return;
    body.innerHTML=`<div class="v030-drawer v032-drawer"><div class="v030-drawer-head v032-drawer-head"><span>OSFL 360 · ENTIDAD CANÓNICA</span><h2>${esc(base.name||'Entidad')}</h2><p>${esc(base.rut||'RUT no informado')} · ${esc(v030RegionShort(base.region))}${base.commune?` · ${esc(base.commune)}`:''}</p><div>${v030RowFlags(base)}</div></div><div class="v030-drawer-score ${v030BandCls(base.priority_band_shadow)}"><span>IPA 3.0 · SHADOW</span><b>${v030Fmt(base.ipa3_score,1)}</b><small>${esc(v030Band(base.priority_band_shadow))} · confianza ${v030Fmt(base.score_confidence_pct,0)}% · cobertura ${v030Fmt(base.coverage_index_pct,0)}%</small><em>${base.dominant_mark_id?`marca conductora ${esc(base.dominant_mark_id)}`:'sin marca conductora scoring'}</em></div><section class="v030-detail-grid v032-detail-grid"><div><span>Confirmación OSFL</span><b>${esc(v030Confirmation(base.confirmation_level))}</b><small>Radar_OSFL / Entity Hub</small></div><div><span>Actividad</span><b>${esc(base.activity_group||'—')}</b><small>${esc(v019Truncate(base.main_activity||'',68))}</small></div><div><span>Ventas SII 2024</span><b>${esc(latest.sales_band_code||base.sales_band||`Tramo ${latest.sales_band_rank??base.sales_band_rank??'—'}`)}</b><small>rango/tramo, no monto exacto</small></div><div><span>Trabajadores 2024</span><b>${v030Fmt(latest.workers_numeric??base.workers_numeric)}</b><small>${latest.sales_band_delta!=null?`Δ ventas ${latest.sales_band_delta>0?'+':''}${latest.sales_band_delta} tramos`:'sin variación disponible'}</small></div><div><span>UAF</span><b>${base.is_uaf_observed?'SO inscrito en UAF':'Sin condición SO materializada'}</b><small>${uaf?.sector_names?.join(' · ')||'ausencia no infiere obligación'}</small></div><div><span>Sanciones resueltas</span><b>${v030Fmt(base.sanction_count)}</b><small>${v030Fmt(base.regulator_count)} regulador(es)</small></div><div><span>Registros públicos</span><b>${base.law21440_active?'21.440 ':''}${base.registro19862?'19.862':''||'—'}</b><small>exposición registral</small></div><div><span>R.8</span><b>${base.fatf_r8_candidate===true?'Candidata de cribado':base.fatf_r8_candidate===false?'No determinada como candidata':'Cobertura pendiente'}</b><small>aporte directo IPA 0</small></div></section><section class="v030-detail-section"><div class="v030-detail-head"><span>VENTAS Y EMPLEO SII</span><b>Trayectoria económica 2020–2024</b></div>${v032SalesHistory(hist)}</section><section class="v030-detail-section v032-budget-section"><div class="v030-detail-head"><span>PRESUPUESTO ABIERTO</span><b>Recursos públicos observados / organismo</b></div><div data-v032-budget>${v032BudgetHtml(null)}</div></section><section class="v030-detail-section"><div class="v030-detail-head"><span>IPA 3.0</span><b>Marcas y aportes</b></div>${v032MarkList(marks)}</section><section class="v030-detail-section"><div class="v030-detail-head"><span>SANCIONES</span><b>Eventos con identidad reconciliada</b></div>${san.length?`<div class="v030-san-list">${san.map(s=>`<div><span>${esc(s.event_date||'—')} · ${esc(s.regulator||'—')}</span><b>${esc(v019Truncate(s.subject||'Evento administrativo',90))}</b><small>${s.laft_direct?'flag LA/FT materializado · ':''}${s.amount_uf!=null?`${v030Fmt(s.amount_uf,1)} UF`:''}</small></div>`).join('')}</div>`:v030Empty('Sin sanciones resueltas a esta entidad.')}</section><div class="v030-drawer-actions"><button type="button" data-v030-open-entity360="${esc(id)}">Abrir Entity 360 completo →</button></div><div class="v030-drawer-guard">Pertenecer al universo OSFL, estar en registros públicos, recibir recursos estatales o ser candidata R.8 no constituye señal adversa. La prioridad se interpreta con materialidad, temporalidad, comparación y evidencia independiente.</div></div>`;
    void v032BudgetExposure(base.rut).then(x=>{const h=document.querySelector('[data-v032-budget]');if(h)h.innerHTML=v032BudgetHtml(x);}).catch(e=>{const h=document.querySelector('[data-v032-budget]');if(h)h.innerHTML=v032BudgetHtml({status:'ERROR',message:e?.message||String(e)});});
  }catch(e){const body=document.querySelector('#v019-drawer-body');if(body)body.innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};

const v032BaseSync=v030SyncMapAndCharts;
v030SyncMapAndCharts=function(){
  const map=document.querySelector('.v030-map-card');if(map)map.outerHTML=v030Map();
  const activity=document.querySelector('.v032-activity-card');if(activity)activity.outerHTML=v030ActivityChart();
  const ipa=document.querySelector('.v032-ipa-card');if(ipa)ipa.outerHTML=v030IpaPanel();
  const timeline=document.querySelector('.v032-timeline-card');if(timeline)timeline.outerHTML=v030Timeline();
  const pub=document.querySelector('.v032-public-card');if(pub)pub.outerHTML=v030PublicContext();
  const rf=document.querySelector('[data-v030-region-filter]');if(rf)rf.value=V030_STATE.region;const af=document.querySelector('[data-v030-activity-filter]');if(af)af.value=V030_STATE.activity;
  setTimeout(()=>void v032HydrateIpaTop(),0);
};

const v032BaseLoad=v030LoadOsfl;
v030LoadOsfl=async function(){await v032LoadRegionDash(true);await v032BaseLoad();setTimeout(()=>void v032HydrateIpaTop(),0);};

if(!window.__V032_EVENTS){window.__V032_EVENTS=true;
  document.addEventListener('click',e=>{
    const band=e.target.closest?.('[data-v030-band]');if(band){e.preventDefault();e.stopImmediatePropagation();const k=band.dataset.v030Band;V030_STATE.ipaBand=V030_STATE.ipaBand===k?'':k;V030_STATE.flag='';V030_STATE.page=0;v030SyncMapAndCharts();void v030RenderRows();return;}
    const open=e.target.closest?.('[data-v032-ipa-open]');if(open){e.preventDefault();e.stopImmediatePropagation();void v030OpenEntity(open.dataset.v032IpaOpen);return;}
    const pub=e.target.closest?.('[data-v032-public]');if(pub){e.preventDefault();e.stopImmediatePropagation();V030_STATE.publicFilter=V030_STATE.publicFilter===pub.dataset.v032Public?'':pub.dataset.v032Public;V030_STATE.page=0;void v030RenderRows();return;}
    const clear=e.target.closest?.('[data-v032-clear]');if(clear){e.preventDefault();e.stopImmediatePropagation();if(clear.dataset.v032Clear==='region')V030_STATE.region='';if(clear.dataset.v032Clear==='band')V030_STATE.ipaBand='';if(clear.dataset.v032Clear==='public')V030_STATE.publicFilter='';V030_STATE.page=0;v030SyncMapAndCharts();void v030RenderRows();return;}
    if(e.target.closest?.('[data-v030-reset]')){V030_STATE.ipaBand='';V030_STATE.publicFilter='';}
  },true);
}

window.AML_OSFL=Object.assign(window.AML_OSFL||{},{expertUxVersion:V032,regionalSnapshot:V032_REGION_RUNTIME,budgetCoverage:'SIGNALIZED_TRANSACTIONS_ONLY',guardrails:['PUBLIC_FUNDING_IS_CONTEXT','R8_DOES_NOT_SCORE','SII_SALES_ARE_BANDS_NOT_EXACT_AMOUNTS']});
