'use strict';

/* ATLAS AML · Entidad 360 · Historia Inteligente · 2026-09-03
 * Visual authority: Proposal 3, native ATLAS palette.
 * Read-only. Identity joins only by entity_id or exact normalized RUT variants.
 * Missing materialization is never interpreted as zero/non-existence.
 */
(function atlasEntity360History20260903(){
  const RELEASE='0.72.0';
  const BUILD='20260903-e360-3'; /* compatibility with current force authority */
  const VARIANT='HISTORY_INTELLIGENCE_ATLAS_V1';
  const AUTHORITY='ENTITY360_HISTORY_INTELLIGENCE_ATLAS';
  const MASTER='aml_entity_master_v0553';
  const TAX='aml_entity_tax_profile';
  const UAF='aml_uaf_entity_profile';
  const SAN='aml_v_ipa3_sanction_entity_summary';
  const SPEND='aml_v_public_spend_provider_intel_0720';
  const HISTORY='aml_sii_entity_year';
  const TTL=5*60*1000;
  const CACHE=new Map();
  const INFLIGHT=new Map();
  const CSS='./assets/atlas-entity360-history-20260903.css?v=20260903-history1';

  if(window.__ATLAS_ENTITY360_EXECUTIVE__?.variant===VARIANT)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=(v,d=0)=>{const n=num(v);return n==null?'—':n.toLocaleString('es-CL',{maximumFractionDigits:d,minimumFractionDigits:0});};
  const money=v=>{const n=num(v);if(n==null)return '—';const a=Math.abs(n);if(a>=1e12)return '$ '+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';if(a>=1e9)return '$ '+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil MM';if(a>=1e6)return '$ '+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' MM';return '$ '+n.toLocaleString('es-CL',{maximumFractionDigits:0});};
  const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
  const split=v=>Array.isArray(v)?v:String(v||'').split('|').map(x=>x.trim()).filter(Boolean);
  const cleanText=v=>String(v??'').trim();
  const day=v=>v?String(v).slice(0,10):'';
  const dateLabel=v=>{if(!v)return 'Sin fecha materializada';const d=new Date(String(v).slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});};
  const yearOf=v=>{const m=String(v||'').match(/(19|20)\d{2}/);return m?Number(m[0]):null;};
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const appState=()=>window.amlState||(()=>{try{return typeof state!=='undefined'?state:(window.state||null);}catch(_e){return window.state||null;}})();
  const selected=()=>appState()?.selectedEntity||window.__ATLAS_ENTITY360_CURRENT__?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity||null;
  const inEntities=()=>{const v=String(appState()?.view||'');return !v||['entities','entity','entity360'].includes(v);};
  const soft=p=>Promise.resolve(p).then(value=>({value,error:value?.error||null}),error=>({value:null,error}));

  function ensureCss(){
    if(document.querySelector('link[data-atlas-e360-history-css]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=CSS;link.dataset.atlasE360HistoryCss='1';document.head.appendChild(link);
  }

  function rutVariants(rut){
    const raw=cleanText(rut);if(!raw)return [];
    const compact=raw.replace(/\./g,'').replace(/\s+/g,'').toUpperCase();
    const bare=compact.replace(/-/g,'');
    const variants=[raw,compact,bare];
    const m=bare.match(/^(\d+)([0-9K])$/i);if(m)variants.push(`${m[1]}-${m[2].toUpperCase()}`);
    return [...new Set(variants.filter(Boolean))];
  }

  function currentTax(data){return data?.tax||null;}
  function historyRows(data){
    const rows=(data?.history||[]).slice();
    if(data?.tax&&num(data.tax.commercial_year)!=null&&!rows.some(r=>num(r.commercial_year)===num(data.tax.commercial_year)))rows.push(data.tax);
    return rows.sort((a,b)=>(num(a.commercial_year)||0)-(num(b.commercial_year)||0));
  }

  function sourceCount(data){
    let n=0;if(data?.tax)n++;if(data?.uaf||data?.entity?.is_uaf_observed===true)n++;if(data?.sanctions||data?.entity?.is_sanctioned===true)n++;if(data?.master?.res_available===true)n++;if(data?.spend)n++;return n;
  }

  function taxEnded(tax){const s=cleanText(tax?.current_status).toUpperCase();return !!tax?.termination_date||/TERMIN|CESAD|INACTIV|NO VIGENT/.test(s);}
  function statusPill(data){const tax=currentTax(data);if(!tax)return '<span class="eh-status neutral">SII no materializado</span>';return `<span class="eh-status ${taxEnded(tax)?'warn':'ok'}">${esc(cleanText(tax.current_status)||'Perfil tributario disponible')}</span>`;}

  function buildEvents(data){
    const events=[];const master=data?.master||{},tax=currentTax(data),uaf=data?.uaf,san=data?.sanctions,spend=data?.spend;
    const push=(kind,date,year,title,detail,source,meta={})=>events.push({id:`${kind}-${events.length+1}`,kind,date:date||'',year:year||yearOf(date),title,detail,source,meta});
    if(master.res_constitution_date)push('constitution',day(master.res_constitution_date),null,'Constitución societaria','Constitución materializada en Registro de Empresas y Sociedades.','RES',{companyCode:master.res_company_code||''});
    if(tax?.activity_start_date)push('start',day(tax.activity_start_date),null,'Inicio de actividades SII',tax.main_activity||'Actividad principal no materializada.','SII');
    if(master.res_sii_approval_date&&day(master.res_sii_approval_date)!==day(tax?.activity_start_date))push('tax',day(master.res_sii_approval_date),null,'Aprobación SII asociada a RES','Hito materializado desde el registro societario.','RES / SII');
    historyRows(data).forEach(row=>{
      const y=num(row.commercial_year);if(!y)return;
      if(row.main_activity_changed===true)push('tax','',y,'Cambio de actividad principal observado',row.main_activity||'La serie histórica marca un cambio de actividad principal.','SII histórico',{yearOnly:true});
      if(row.region_changed===true)push('tax','',y,'Cambio territorial observado',[row.region,row.commune].filter(Boolean).join(' · ')||'La serie histórica marca un cambio territorial.','SII histórico',{yearOnly:true});
    });
    if(uaf){const d=day(uaf.updated_at);push('uaf',d,yearOf(d),'Registro UAF materializado',arr(uaf.sector_names).join(' · ')||uaf.registry_class||'Detalle sectorial no materializado.','UAF',{cutDate:true,registryClass:uaf.registry_class||''});}
    if((num(san?.sanction_event_count)||0)>0){const d=day(san.latest_sanction_date);push('sanctions',d,yearOf(d),'Antecedente sancionatorio materializado',`${fmt(san.sanction_event_count)} evento(s) en el resumen gobernado. Reguladores: ${arr(san.regulators).join(' · ')||'no materializados'}.`,'Radar Sancionatorio',{count:num(san.sanction_event_count),direct:num(san.laft_direct_count)});}
    if(spend?.first_order_date)push('spend',day(spend.first_order_date),null,'Primera compra pública materializada',`${fmt(spend.order_count)} orden(es) de compra en el corte disponible.`,'Compras Públicas',{amount:spend.total_clp});
    if(spend?.last_order_date&&day(spend.last_order_date)!==day(spend.first_order_date))push('spend',day(spend.last_order_date),null,'Última compra pública materializada',`Último hito observado en el corte de compras públicas. Monto acumulado materializado: ${money(spend.total_clp)}.`,'Compras Públicas',{amount:spend.total_clp});
    return events.filter(e=>e.year).sort((a,b)=>(a.year-b.year)||String(a.date).localeCompare(String(b.date))||a.title.localeCompare(b.title));
  }

  function summaryText(data){
    const t=currentTax(data),e=data?.entity||{},m=data?.master||{};
    const activity=t?.main_activity||'actividad principal no materializada';
    const loc=[t?.commune||e.commune||m.res_tax_commune,t?.region||e.region].filter(Boolean).join(' · ');
    const sales=t?.sales_band||t?.sales_band_code;
    const workers=num(t?.workers_numeric);
    const pieces=[activity];if(loc)pieces.push(loc);if(sales)pieces.push(`tramo de ventas ${sales}`);if(workers!=null)pieces.push(`${fmt(workers)} trabajador(es)`);
    return pieces.join(' · ')+'.';
  }

  function factsText(data,events){
    const parts=[];const san=num(data?.sanctions?.sanction_event_count);const orders=num(data?.spend?.order_count);const rel=num(data?.master?.res_relationship_count);
    parts.push(`${sourceCount(data)} de 5 fuentes ejecutivas con dato materializado`);
    if(san!=null&&san>0)parts.push(`${fmt(san)} evento(s) sancionatorio(s)`);
    if(orders!=null&&orders>0)parts.push(`${fmt(orders)} orden(es) de compra`);
    if(rel!=null&&rel>0)parts.push(`${fmt(rel)} relación(es) RES documentada(s)`);
    if(events.length)parts.push(`${events.length} hito(s) cronológicos`);
    return parts.slice(0,3).join(' · ')+'.';
  }

  function changesText(data){
    const rows=historyRows(data);const activityYears=rows.filter(r=>r.main_activity_changed===true).map(r=>r.commercial_year);const regionYears=rows.filter(r=>r.region_changed===true).map(r=>r.commercial_year);const parts=[];
    if(activityYears.length)parts.push(`cambio de actividad en ${activityYears.join(', ')}`);
    if(regionYears.length)parts.push(`cambio territorial en ${regionYears.join(', ')}`);
    const first=day(data?.spend?.first_order_date),last=day(data?.spend?.last_order_date);if(first&&last&&first!==last)parts.push(`compras públicas observadas entre ${dateLabel(first)} y ${dateLabel(last)}`);
    return parts.length?parts.join(' · ')+'.':'No hay cambios históricos materializados suficientes para sintetizar una trayectoria.';
  }

  function icon(kind){return ({constitution:'▦',start:'▶',tax:'↗',uaf:'◇',sanctions:'⚑',spend:'▣',relations:'◎'}[kind]||'•');}
  function label(kind){return ({constitution:'Constitución',start:'Inicio actividades',tax:'Cambios tributarios',uaf:'UAF',sanctions:'Sanciones',spend:'Compras Públicas',relations:'Relaciones societarias'}[kind]||kind);}

  function identityBlock(data,id){
    const e=data?.entity||{},m=data?.master||{},t=currentTax(data);const name=e.name||m.name||m.res_legal_name||id;const rut=e.rut||m.rut||'RUT no materializado';const type=e.entity_type||m.entity_type||'Tipo no materializado';const loc=[t?.commune||e.commune||m.res_tax_commune,t?.region||e.region].filter(Boolean).join(' · ')||'Territorio no materializado';
    const tags=[data?.uaf||e.is_uaf_observed===true?'UAF':null,t?'SII':null,data?.spend?'Compras públicas':null,m.res_available===true?'RES':null].filter(Boolean);
    return `<article class="eh-identity"><div class="eh-entity-icon" aria-hidden="true">▥</div><div class="eh-identity-copy"><div class="eh-title-line"><h2>${esc(name)}</h2>${statusPill(data)}</div><div class="eh-idline"><b>${esc(rut)}</b><span>${esc(type)}</span><span>${esc(loc)}</span></div><div class="eh-tags">${tags.map(x=>`<span>${esc(x)}</span>`).join('')||'<span>Fuentes ejecutivas en consulta</span>'}</div></div></article>`;
  }

  function insightCard(kind,title,text,accent){return `<article class="eh-insight ${accent}"><div class="eh-insight-icon">${icon(kind)}</div><div><span>${esc(title)}</span><p>${esc(text)}</p></div></article>`;}

  function topStory(data,id,events){return `<section class="eh-story-head">${identityBlock(data,id)}${insightCard('uaf','Caracterización actual',summaryText(data),'blue')}${insightCard('constitution','Hechos relevantes',factsText(data,events),'cyan')}${insightCard('tax','Cambios observados',changesText(data),'amber')}</section>`;}

  function filterButtons(events){
    const kinds=['constitution','start','tax','uaf','sanctions','spend','relations'];
    return kinds.map(kind=>{const count=events.filter(e=>e.kind===kind).length;return `<button type="button" class="eh-filter ${kind}${count?' active':' empty'}" data-eh-filter="${kind}" aria-pressed="${count?'true':'false'}" ${count?'':'disabled'}><i></i>${esc(label(kind))}<b>${count}</b></button>`;}).join('');
  }

  function eventMarkup(e,index){
    const when=e.date?dateLabel(e.date):`Año ${e.year}`;return `<button type="button" class="eh-event ${e.kind} ${index%2===0?'top':'bottom'}" data-eh-event="${esc(e.id)}"><span class="eh-event-icon">${icon(e.kind)}</span><span class="eh-event-copy"><b>${esc(when)}</b><strong>${esc(e.title)}</strong><small>${esc(e.detail)}</small></span></button>`;
  }

  function historyPanel(events){
    const min=events.length?Math.min(...events.map(e=>e.year)):null,max=events.length?Math.max(...events.map(e=>e.year)):null;
    const years=min&&max?Array.from({length:max-min+1},(_,i)=>min+i):[];
    return `<section class="eh-history" id="e360-history"><header><div><span class="eh-kicker">HISTORIA DE LA ENTIDAD</span><h3>Trayectoria observable</h3><p>Hitos materializados por fuente. Selecciona un evento para revisar su evidencia y contexto.</p></div><div class="eh-history-actions"><button type="button" data-eh-mode="timeline" class="active">Cronología</button><button type="button" data-eh-mode="table">Tabla</button><button type="button" data-eh-scroll="prev" aria-label="Desplazar atrás">‹</button><button type="button" data-eh-zoom="out" aria-label="Alejar">−</button><button type="button" data-eh-zoom="in" aria-label="Acercar">+</button><button type="button" data-eh-scroll="next" aria-label="Desplazar adelante">›</button></div></header><div class="eh-filters">${filterButtons(events)}</div><div class="eh-timeline-wrap"><div class="eh-timeline zoom-2" data-eh-track>${events.length?events.map(eventMarkup).join(''):'<div class="eh-no-events">No hay hitos cronológicos materializados para esta identidad.</div>'}<div class="eh-axis">${years.map(y=>`<span>${y}</span>`).join('')}</div></div></div><div class="eh-table-view" hidden><table><thead><tr><th>Fecha / año</th><th>Tipo</th><th>Hito</th><th>Fuente</th></tr></thead><tbody>${events.map(e=>`<tr data-eh-row="${esc(e.id)}"><td>${esc(e.date?dateLabel(e.date):`Año ${e.year}`)}</td><td>${esc(label(e.kind))}</td><td>${esc(e.title)}</td><td>${esc(e.source)}</td></tr>`).join('')||'<tr><td colspan="4">Sin hitos materializados.</td></tr>'}</tbody></table></div><aside class="eh-event-drawer" data-eh-drawer hidden><button type="button" class="eh-drawer-close" data-eh-close>×</button><span class="eh-kicker">DETALLE DE EVENTO</span><div data-eh-drawer-body></div></aside></section>`;
  }

  function characterization(data){
    const t=currentTax(data),e=data?.entity||{},m=data?.master||{};const activities=split(t?.activity_names).slice(0,3);
    const row=(k,v,d='')=>`<div class="eh-character-row"><span>${esc(k)}</span><b>${esc(v||'—')}</b>${d?`<small>${esc(d)}</small>`:''}</div>`;
    return `<section class="eh-character"><header><span class="eh-kicker">CARACTERIZACIÓN ACTUAL</span><h3>Perfil materializado</h3></header>${row('Actividad económica',t?.main_activity||'No materializada')}${row('Otras actividades',activities.filter(x=>x!==t?.main_activity).join(' · ')||'No materializadas')}${row('Tramo de ventas',t?.sales_band||t?.sales_band_code||'—',t?.commercial_year?`Año ${t.commercial_year}`:'')}${row('Trabajadores',t?.workers_numeric!=null?fmt(t.workers_numeric):'—',t?.commercial_year?`Año ${t.commercial_year}`:'')}${row('Región',t?.region||e.region||'—')}${row('Comuna',t?.commune||e.commune||m.res_tax_commune||'—')}${row('Inicio actividades',t?.activity_start_date?dateLabel(t.activity_start_date):'No materializado')}${row('Término de giro',t?.termination_date?dateLabel(t.termination_date):'No materializado','Sin fecha materializada no implica inexistencia')}<button type="button" class="eh-secondary" data-e360-lens="character">Ver caracterización completa <span>↗</span></button></section>`;
  }

  function sanctionsCard(data){const s=data?.sanctions,e=data?.entity||{};const count=num(s?.sanction_event_count);const n36=num(s?.sanction_count_36m),n60=num(s?.sanction_count_60m),direct=num(s?.laft_direct_count);return `<article class="eh-card eh-san"><header><div><span class="eh-kicker">RADAR SANCIONATORIO</span><h3>Sanciones</h3></div><button type="button" data-e360-lens="signals">Abrir</button></header>${s?`<div class="eh-san-total"><b>${fmt(count)}</b><span>evento(s) materializados</span></div><div class="eh-san-bars"><div><span>36 meses</span><b>${fmt(n36)}</b></div><div><span>60 meses</span><b>${fmt(n60)}</b></div><div><span>LA/FT directo</span><b>${fmt(direct)}</b></div></div><p>Reguladores: ${esc(arr(s.regulators).join(' · ')||'no materializados')}.</p><small>Una sanción administrativa no acredita por sí sola LA/FT ni delito.</small>`:`<div class="eh-empty"><b>${e.is_sanctioned===true?'Antecedente observado, sin resumen gobernado':'Resumen no materializado'}</b><span>No se interpreta como ausencia de sanciones.</span></div>`}</article>`;}

  function resCard(data){const r=data?.master;return `<article class="eh-card eh-res"><header><div><span class="eh-kicker">RES / EMPRESA EN UN DÍA</span><h3>Registro societario</h3></div><button type="button" data-e360-lens="identity">Abrir</button></header>${r?.res_available===true?`<div class="eh-res-logo">RES</div><div class="eh-res-state"><span>Registro enlazado</span><b>${esc(r.res_legal_name||r.name||'Razón social materializada')}</b></div><div class="eh-mini-grid"><div><span>Constitución</span><b>${esc(dateLabel(r.res_constitution_date))}</b></div><div><span>Relaciones</span><b>${fmt(r.res_relationship_count)}</b></div></div><small>Vínculo RES por RUT exacto.</small>`:`<div class="eh-empty"><b>Registro RES no materializado</b><span>No se afirma inexistencia en el registro.</span></div>`}</article>`;}

  function spendDonut(spend){const total=Math.max(0,num(spend?.order_count)||0),direct=Math.max(0,num(spend?.direct_order_count)||0);const pct=total?Math.min(100,Math.round(direct/total*100)):0;return `<svg class="eh-donut" viewBox="0 0 44 44" role="img" aria-label="Proporción de trato directo"><circle class="base" cx="22" cy="22" r="16"></circle><circle class="value" cx="22" cy="22" r="16" pathLength="100" stroke-dasharray="${pct} ${100-pct}" transform="rotate(-90 22 22)"></circle><text x="22" y="21" text-anchor="middle">${pct}%</text><text x="22" y="27" text-anchor="middle">directo</text></svg>`;}
  function spendCard(data){const s=data?.spend;return `<article class="eh-card eh-spend"><header><div><span class="eh-kicker">COMPRAS PÚBLICAS</span><h3>Actividad como proveedor</h3></div><button type="button" data-e360-lens="evidence">Abrir</button></header>${s?`<div class="eh-spend-body">${spendDonut(s)}<div><strong>${money(s.total_clp)}</strong><span>monto materializado</span><div class="eh-mini-grid"><div><span>Órdenes</span><b>${fmt(s.order_count)}</b></div><div><span>Compradores</span><b>${fmt(s.buyer_count)}</b></div></div></div></div><small>${esc(dateLabel(s.first_order_date))} → ${esc(dateLabel(s.last_order_date))}. Presencia en compras públicas no implica irregularidad.</small>`:`<div class="eh-empty"><b>Proveedor no materializado en esta vista</b><span>No se interpreta como inexistencia fuera del corte disponible.</span></div>`}</article>`;}

  function evidenceCard(data){const docs=arr(data?.uaf?.source_document_ids).filter(Boolean).slice(0,4);const rows=[];docs.forEach((id,i)=>rows.push(`<li><span>Documento UAF ${i+1}</span><code>${esc(id)}</code></li>`));if(data?.master?.res_company_code)rows.push(`<li><span>Código societario RES</span><code>${esc(data.master.res_company_code)}</code></li>`);return `<article class="eh-card eh-docs"><header><div><span class="eh-kicker">DOCUMENTOS Y EVIDENCIA</span><h3>Trazabilidad</h3></div><button type="button" data-e360-lens="evidence">Abrir</button></header>${rows.length?`<ul>${rows.join('')}</ul>`:`<div class="eh-empty"><b>Identificadores documentales no materializados</b><span>Usa el lente de evidencia para revisar el expediente gobernado disponible.</span></div>`}<button type="button" class="eh-secondary" data-e360-lens="evidence">Ver evidencia completa <span>↗</span></button></article>`;}

  function compareCard(data){const t=currentTax(data),mode='sector';return `<section class="eh-compare"><header><span class="eh-kicker">COMPARAR CON</span><h3>Contexto</h3></header><div class="eh-compare-tabs"><button type="button" class="active" data-eh-compare="sector">Sector</button><button type="button" data-eh-compare="territory">Territorio</button></div><div class="eh-compare-body" data-eh-compare-body data-mode="${mode}"><div><span>Entidad</span><b>${esc(t?.sales_band||t?.sales_band_code||'Tramo no materializado')}</b><small>${esc(t?.economic_sector||'Sector no materializado')}</small></div><p>Referencia de pares no materializada en Entidad 360. ATLAS no inventa un promedio comparativo.</p></div><button type="button" class="eh-secondary" data-e360-lens="character">Abrir análisis comparativo <span>↗</span></button></section>`;}

  function bottomCards(data){return `<section class="eh-bottom-grid">${sanctionsCard(data)}${resCard(data)}${spendCard(data)}${evidenceCard(data)}</section>`;}

  function footer(data){const cuts=[data?.tax?.updated_at,data?.uaf?.updated_at,data?.master?.updated_at].filter(Boolean).map(day).filter(Boolean).sort();const latest=cuts.length?cuts[cuts.length-1]:'corte no materializado';return `<footer class="eh-footer"><span>ⓘ</span><p>La vista integra hechos materializados bajo RLS. Cruces por Entity ID o RUT exacto normalizado. Vacío de dato ≠ cero o inexistencia.</p><b>Último corte visible: ${esc(latest)}</b></footer>`;}

  function markup(data,id,meta){
    const safe=data||{entity:{...(meta||{}),entity_id:id},master:null,tax:null,uaf:null,sanctions:null,spend:null,history:[],errors:[]};const events=buildEvents(safe);
    return `<div class="e360-history" data-e360-history-variant="${VARIANT}"><div class="eh-layout"><main class="eh-main">${topStory(safe,id,events)}${historyPanel(events)}${bottomCards(safe)}</main><aside class="eh-side">${characterization(safe)}${compareCard(safe)}</aside></div>${footer(safe)}</div>`;
  }

  function rootForEntity(){return document.querySelector('#content .a45')||document.querySelector('#content .aed-dossier')||document.querySelector('#content .v0203-entity')||document.querySelector('#content .v038-entity')||document.querySelector('#content');}

  function eventById(host,id){return host.__ehEvents?.find(e=>e.id===id)||null;}
  function renderDrawer(host,event){const drawer=host.querySelector('[data-eh-drawer]'),body=host.querySelector('[data-eh-drawer-body]');if(!drawer||!body||!event)return;body.innerHTML=`<span class="eh-event-type ${esc(event.kind)}">${esc(label(event.kind))}</span><h4>${esc(event.title)}</h4><time>${esc(event.date?dateLabel(event.date):`Año ${event.year}`)}</time><p>${esc(event.detail)}</p><dl><div><dt>Fuente</dt><dd>${esc(event.source)}</dd></div>${event.meta?.cutDate?'<div><dt>Nota</dt><dd>La fecha corresponde al corte/actualización materializada, no necesariamente a la inscripción original.</dd></div>':''}${event.meta?.companyCode?`<div><dt>Código RES</dt><dd>${esc(event.meta.companyCode)}</dd></div>`:''}</dl>`;drawer.hidden=false;drawer.classList.add('open');}

  function bind(host,data,root){
    host.__ehEvents=buildEvents(data||{});
    const filters=new Set(host.__ehEvents.map(e=>e.kind));
    host.querySelectorAll('[data-eh-filter]').forEach(btn=>btn.addEventListener('click',()=>{const kind=btn.dataset.ehFilter;if(btn.disabled)return;if(filters.has(kind)){filters.delete(kind);btn.classList.remove('active');btn.setAttribute('aria-pressed','false');}else{filters.add(kind);btn.classList.add('active');btn.setAttribute('aria-pressed','true');}host.querySelectorAll('[data-eh-event]').forEach(node=>{const ev=eventById(host,node.dataset.ehEvent);node.hidden=!!ev&&!filters.has(ev.kind);});host.querySelectorAll('[data-eh-row]').forEach(row=>{const ev=eventById(host,row.dataset.ehRow);row.hidden=!!ev&&!filters.has(ev.kind);});}));
    host.querySelectorAll('[data-eh-event]').forEach(btn=>btn.addEventListener('click',()=>renderDrawer(host,eventById(host,btn.dataset.ehEvent))));
    host.querySelectorAll('[data-eh-row]').forEach(row=>row.addEventListener('click',()=>renderDrawer(host,eventById(host,row.dataset.ehRow))));
    host.querySelector('[data-eh-close]')?.addEventListener('click',()=>{const d=host.querySelector('[data-eh-drawer]');if(d){d.classList.remove('open');d.hidden=true;}});
    host.querySelectorAll('[data-eh-mode]').forEach(btn=>btn.addEventListener('click',()=>{const history=host.querySelector('.eh-history'),table=history?.querySelector('.eh-table-view'),wrap=history?.querySelector('.eh-timeline-wrap');const isTable=btn.dataset.ehMode==='table';host.querySelectorAll('[data-eh-mode]').forEach(b=>b.classList.toggle('active',b===btn));if(table)table.hidden=!isTable;if(wrap)wrap.hidden=isTable;}));
    host.querySelectorAll('[data-eh-scroll]').forEach(btn=>btn.addEventListener('click',()=>{const wrap=host.querySelector('.eh-timeline-wrap');wrap?.scrollBy({left:(btn.dataset.ehScroll==='next'?1:-1)*Math.max(320,(wrap.clientWidth||640)*.72),behavior:'smooth'});}));
    let zoom=2;host.querySelectorAll('[data-eh-zoom]').forEach(btn=>btn.addEventListener('click',()=>{zoom=Math.max(1,Math.min(3,zoom+(btn.dataset.ehZoom==='in'?1:-1)));const track=host.querySelector('[data-eh-track]');if(track)track.className=`eh-timeline zoom-${zoom}`;}));
    host.querySelectorAll('[data-eh-compare]').forEach(btn=>btn.addEventListener('click',()=>{host.querySelectorAll('[data-eh-compare]').forEach(b=>b.classList.toggle('active',b===btn));const body=host.querySelector('[data-eh-compare-body]');if(!body)return;const t=currentTax(data),e=data?.entity||{};if(btn.dataset.ehCompare==='territory'){body.dataset.mode='territory';body.innerHTML=`<div><span>Entidad</span><b>${esc(t?.commune||e.commune||'Comuna no materializada')}</b><small>${esc(t?.region||e.region||'Región no materializada')}</small></div><p>Referencia territorial de pares no materializada en Entidad 360. No se estima un benchmark.</p>`;}else{body.dataset.mode='sector';body.innerHTML=`<div><span>Entidad</span><b>${esc(t?.sales_band||t?.sales_band_code||'Tramo no materializado')}</b><small>${esc(t?.economic_sector||'Sector no materializado')}</small></div><p>Referencia sectorial de pares no materializada en Entidad 360. No se estima un benchmark.</p>`;}}));
    host.querySelectorAll('[data-e360-lens]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.e360Lens;root.classList.add('e360-advanced-open');const navButton=root.querySelector(`[data-a45-lens="${key}"],[data-a45-tab="${key}"],[data-a45-nav="${key}"]`);navButton?.click?.();setTimeout(()=>root.querySelector(`[data-a45-panel="${key}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}),60);}));
  }

  function mount(id,meta,data){
    const root=rootForEntity();if(!root||!id)return false;ensureCss();root.classList.add('e360-modern','e360-history-active');
    let host=root.querySelector(':scope > #atlas-entity360-executive');if(!host){host=document.createElement('section');host.id='atlas-entity360-executive';root.insertBefore(host,root.firstChild);}host.className='e360-executive e360-history-host';host.dataset.entityId=id;host.dataset.e360Variant=VARIANT;host.innerHTML=markup(data,id,meta);bind(host,data,root);
    window.__ATLAS_ENTITY360_EXECUTIVE_STATE__={active:true,release:RELEASE,build:BUILD,variant:VARIANT,authority:AUTHORITY,entityId:id,hydrated:!!data,errors:data?.errors||[],renderedAt:new Date().toISOString()};
    return true;
  }

  async function fetchPackage(id,meta){
    const client=db();if(!client||!id)return null;
    const masterRes=await soft(client.from(MASTER).select('*').eq('entity_id',id).maybeSingle());
    const master=masterRes.value?.data||null;
    const entity={...(master||{}),...(meta||{}),entity_id:id,name:meta?.name||master?.name||master?.res_legal_name||id,rut:meta?.rut||master?.rut||null};
    const taxSelect='entity_id,commercial_year,sales_band,sales_band_code,sales_band_rank,workers_numeric,region,province,commune,economic_sector,economic_subsector,main_activity,taxpayer_type,taxpayer_subtype,activity_start_date,termination_date,current_status,activity_count,activity_codes,activity_names,address_count,current_address_count,communes,address_regions,ownership_edge_count,legal_entity_partner_count,societies_as_partner_count,signal_count,signal_types,updated_at';
    const taxP=soft(client.from(TAX).select(taxSelect).eq('entity_id',id).maybeSingle());
    const uafP=entity.rut?soft(client.from(UAF).select('*').in('rut',rutVariants(entity.rut)).limit(1).maybeSingle()):Promise.resolve({value:{data:null},error:null});
    const sanP=soft(client.from(SAN).select('*').eq('entity_id',id).maybeSingle());
    const spendP=soft(client.from(SPEND).select('supplier_rut,supplier_name,order_count,buyer_count,total_clp,first_order_date,last_order_date,direct_order_count,entity_id,region,commune,lobby_count,cgr_count,presupuesto_signal_count,attention_score,signal_codes').eq('entity_id',id).limit(1).maybeSingle());
    const historyP=soft(client.from(HISTORY).select('*').eq('entity_id',id).order('commercial_year',{ascending:false}).limit(8));
    const [taxRes,uafRes,sanRes,spendRes,historyRes]=await Promise.all([taxP,uafP,sanP,spendP,historyP]);
    return {entityId:id,entity,master,tax:taxRes.value?.data||null,uaf:uafRes.value?.data||null,sanctions:sanRes.value?.data||null,spend:spendRes.value?.data||null,history:Array.isArray(historyRes.value?.data)?historyRes.value.data:[],errors:[masterRes,taxRes,uafRes,sanRes,spendRes,historyRes].map(r=>r?.error?String(r.error?.message||r.error):null).filter(Boolean),loadedAt:Date.now()};
  }

  function load(id,meta){const hit=CACHE.get(id);if(hit&&Date.now()-hit.loadedAt<TTL)return Promise.resolve(hit);if(INFLIGHT.has(id))return INFLIGHT.get(id);const job=fetchPackage(id,meta).then(data=>{if(data)CACHE.set(id,data);return data;}).finally(()=>INFLIGHT.delete(id));INFLIGHT.set(id,job);return job;}
  async function openHistory(id,meta=null){if(!id||!inEntities())return false;mount(id,meta,null);const data=await load(id,meta);if(data&&String(selected()||id)===String(id)&&inEntities())mount(id,data.entity,data);return !!data;}

  function hookEntry(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;if(!entry||typeof entry.open!=='function')return false;if(entry.open.__atlasE360History===VARIANT)return true;const base=entry.open;
    const wrapped=async function atlasEntity360HistoryEntryOpen(entityId,meta,...rest){const result=await base.apply(this,[entityId,meta,...rest]);const id=entityId||meta?.entity_id||selected();if(id)await openHistory(id,meta);return result;};
    wrapped.__atlasE360History=VARIANT;wrapped.__atlasE360Base=base;entry.open=wrapped;return true;
  }

  let observer=null,timer=null,inflight=false,lastSeen='';
  function reconcile(reason='mutation'){
    clearTimeout(timer);timer=setTimeout(async()=>{if(inflight||!inEntities())return;const id=selected();if(!id)return;const host=document.querySelector('#atlas-entity360-executive');const stateNow=window.__ATLAS_ENTITY360_EXECUTIVE_STATE__;const correct=host?.dataset?.e360Variant===VARIANT&&String(stateNow?.entityId||'')===String(id)&&stateNow?.variant===VARIANT;if(correct)return;inflight=true;try{await openHistory(String(id),{entity_id:String(id)});lastSeen=String(id);}finally{inflight=false;}},reason==='startup'?0:55);
  }

  function installObserver(){const app=document.querySelector('#app');if(!app){setTimeout(installObserver,100);return;}if(!observer){observer=new MutationObserver(()=>reconcile('mutation'));observer.observe(app,{childList:true,subtree:true});}setInterval(()=>{const id=String(selected()||'');const host=document.querySelector('#atlas-entity360-executive');if(id&&(id!==lastSeen||host?.dataset?.e360Variant!==VARIANT))reconcile('poll');},500);}

  ensureCss();
  window.__ATLAS_ENTITY360_EXECUTIVE__={active:true,release:RELEASE,build:BUILD,variant:VARIANT,authority:AUTHORITY,sources:[MASTER,TAX,UAF,SAN,SPEND,HISTORY],identityPolicy:'ENTITY_ID_OR_EXACT_NORMALIZED_RUT_ONLY',missingSemantic:'MISSING_IS_NOT_ZERO_OR_ABSENCE',authMutation:false,scoreMutation:false,cachePolicy:'MEMORY_ONLY',open:openHistory,mount,hookEntry,clear:()=>CACHE.clear(),installedAt:new Date().toISOString()};
  window.__ATLAS_ENTITY360_HISTORY__={active:true,release:RELEASE,build:BUILD,variant:VARIANT,authority:AUTHORITY,installedAt:new Date().toISOString()};
  hookEntry();installObserver();
  document.addEventListener('atlas:entity-workspace-ready',()=>{hookEntry();reconcile('workspace-ready');});
  document.addEventListener('atlas:entity-entry-ready',()=>{hookEntry();reconcile('entry-ready');});
  window.addEventListener('load',()=>{hookEntry();reconcile('startup');},{once:true});
  [0,150,500,1200,3000].forEach(ms=>setTimeout(()=>reconcile('startup'),ms));
})();
