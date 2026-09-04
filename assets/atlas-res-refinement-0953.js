'use strict';
/* ATLAS AML · Empresas (RES) · analyst refinement 0.97.0 */
(function atlasResRefinement0970(){
  if(window.__ATLAS_RES_REFINEMENT_0953__) return;
  window.__ATLAS_RES_REFINEMENT_0953__=true;
  const VERSION='0.97.0';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const money=v=>v==null?'—':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v));
  const source=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const cutoff=()=>window.AtlasRes0952?.cutoff||window.AtlasRes0950?.cutoff||'31-07-2026';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const regions={1:'Tarapacá',2:'Antofagasta',3:'Atacama',4:'Coquimbo',5:'Valparaíso',6:'O’Higgins',7:'Maule',8:'Biobío',9:'La Araucanía',10:'Los Lagos',11:'Aysén',12:'Magallanes',13:'Metropolitana',14:'Los Ríos',15:'Arica y Parinacota',16:'Ñuble'};
  const safeUrl=v=>/^https?:\/\//i.test(String(v||''))?String(v):'';

  function compact(root){
    const hero=root.querySelector('.res952-hero');
    if(hero&&!root.querySelector('.res970-sourcebar')){
      const bar=document.createElement('div');bar.className='res970-sourcebar';
      bar.innerHTML=`<span>● RES operativo</span><i></i><b>${num(source()?.total||0)} sociedades</b><i></i><b>Corte ${esc(cutoff())}</b>`;
      hero.replaceWith(bar);
    }
    const tab=root.querySelector('[data-res952-route="territory"]');
    if(tab){tab.textContent='Mapa';tab.removeAttribute('disabled');tab.title='Abrir análisis territorial RES';}
    if(root.querySelector('#res952-temporal-chart')&&root.dataset.res970Pulse!=='1'){
      root.dataset.res970Pulse='1';
      const weekly=[...root.querySelectorAll('.res952-card')].find(x=>(x.querySelector('header span')?.textContent||'').trim().toUpperCase()==='LECTURA SEMANAL');
      if(weekly){const p=weekly.parentElement;weekly.remove();if(p?.querySelector('.res952-economic'))p.classList.add('res970-economic-only');}
    }
  }

  function hideLegacy(root){
    root.querySelector('.res952-kpis-phen')?.classList.add('res970-hidden-source');
    root.querySelectorAll('.res952-toolbar').forEach(x=>x.classList.add('res970-hidden-source'));
    root.querySelector('#res952-findings')?.closest('.res952-card')?.classList.add('res970-hidden-source');
    const labels=new Set(['FRECUENCIA','CONCENTRACIÓN','REPETICIÓN','COINCIDENCIA REGISTRAL']);
    root.querySelectorAll('.res952-card').forEach(x=>{if(labels.has((x.querySelector('header span')?.textContent||'').trim().toUpperCase()))x.classList.add('res970-hidden-source');});
  }

  function trigger(root,kind,term,scroll=true){
    const type=root.querySelector('#res952-phen-type'),q=root.querySelector('#res952-phen-q'),box=root.querySelector('#res952-findings');
    if(!type||!q||!box)return;
    type.value=kind;type.dispatchEvent(new Event('change',{bubbles:true}));q.value=term||'';q.dispatchEvent(new Event('input',{bubbles:true}));
    const needle=String(term||'').toLocaleLowerCase('es-CL');
    const rows=[...box.querySelectorAll(`[data-kind="${kind}"]`)];
    (rows.find(x=>!needle||(x.textContent||'').toLocaleLowerCase('es-CL').includes(needle))||rows[0])?.click();
    if(scroll)setTimeout(()=>root.querySelector('.res970-evidence-card')?.scrollIntoView?.({behavior:'smooth',block:'start'}),40);
  }

  function executiveCards(d){
    const a=d.anomalies?.[0],cl=d.clusters?.[0],cd=d.communeDays?.[0],cg=d.communeGrowth?.[0];
    const nat=(d.criticalDates||[]).find(x=>x[0]===cd?.[0]);const dayShare=nat?.[1]?cd[2]/nat[1]*100:0;
    return `<div class="res970-exec-grid">
      <button data-res970-kind="cluster" data-res970-term="${esc(cl?.[0])}"><span>COINCIDENCIA REGISTRAL</span><b>${num(cl?.[5])} sociedades</b><strong>${esc(cl?.[2])} · ${esc(cl?.[3])} · ${money(cl?.[4])}</strong><small>4 atributos idénticos en la misma fecha</small></button>
      <button data-res970-kind="anomaly" data-res970-term="${esc(regions[a?.[0]]||'')}"><span>DESVÍO TERRITORIAL</span><b>z ${Number(a?.[5]||0).toFixed(2)}</b><strong>${esc(regions[a?.[0]]||'—')} · ${esc(a?.[1]||'—')}</strong><small>${num(a?.[2])} constituciones · +${pct(a?.[4])}</small></button>
      <button data-res970-kind="date" data-res970-term="${esc(cd?.[1])}"><span>CONCENTRACIÓN COMUNA-DÍA</span><b>${pct(dayShare)}</b><strong>${esc(cd?.[1]||'—')} · ${esc(cd?.[0]||'—')}</strong><small>${num(cd?.[2])} de ${num(nat?.[1])} constituciones del día</small></button>
      <button data-res970-kind="commune" data-res970-term="${esc(cg?.[0])}"><span>ACELERACIÓN COMUNAL</span><b>+${pct(cg?.[3])}</b><strong>${esc(cg?.[0]||'—')}</strong><small>${num(cg?.[1])} vs ${num(cg?.[2])} ene–jul</small></button>
    </div>`;
  }

  function dateChart(d){
    const rows=(d.criticalDates||[]).slice(0,10),vals=rows.map(r=>Number(r[1]||0)),lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(1,hi-lo);
    return `<article class="res970-panel"><header><div><span>INTENSIDAD DIARIA</span><h3>Top 10 de fechas críticas</h3></div><em>escala relativa del Top 10</em></header><p class="res970-caption">La escala visual amplifica diferencias dentro del Top 10; el valor exacto permanece visible.</p><div class="res970-lollipops">${rows.map(r=>{const rel=12+88*((r[1]-lo)/span);return `<button data-res970-kind="date" data-res970-term="${esc(r[0])}"><time>${esc(r[0])}</time><span class="res970-lolli-track"><i style="--x:${rel.toFixed(1)}%"></i></span><b>${num(r[1])}</b></button>`}).join('')}</div></article>`;
  }

  function capitalChart(d){
    const rows=(d.capitals||[]).slice(0,9),max=Math.max(...rows.map(r=>Number(r[1]||0)),1);let cum=0;
    return `<article class="res970-panel"><header><div><span>REPETICIÓN DE CAPITAL</span><h3>Capitales declarados más frecuentes</h3></div><em>participación 2026 YTD</em></header><div class="res970-pareto-head"><span>Capital</span><span>Frecuencia relativa</span><span>Sociedades · cuota</span></div><div class="res970-pareto">${rows.map(r=>{cum+=Number(r[2]||0);const w=100*Number(r[1]||0)/max;return `<button data-res970-kind="capital" data-res970-term="${Number(r[0])}"><span>${money(r[0])}</span><span class="res970-pareto-track"><i style="--w:${w.toFixed(1)}%"></i></span><b>${num(r[1])} · ${pct(r[2])}<small>Σ ${pct(cum)}</small></b></button>`}).join('')}</div></article>`;
  }

  function anomalyChart(d){
    const rows=(d.anomalies||[]).slice(0,10),maxZ=Math.max(...rows.map(r=>Number(r[5]||0)),1),maxG=Math.max(...rows.map(r=>Number(r[4]||0)),1);
    return `<article class="res970-panel res970-anomaly-panel"><header><div><span>DESVÍOS REGIONALES</span><h3>Magnitud estadística vs aceleración</h3></div><em>z ≥ 4</em></header><div class="res970-scatter" aria-label="Matriz de desvíos regionales"><div class="res970-axis-y">mayor crecimiento ↑</div><div class="res970-axis-x">mayor z-score →</div>${rows.map((r,i)=>{const x=8+84*(Number(r[5])/maxZ),y=88-76*(Number(r[4])/maxG);return `<button style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%" data-res970-kind="anomaly" data-res970-term="${esc(regions[r[0]]||'')}"><i>${i+1}</i><span>${esc(regions[r[0]]||r[0])}<small>${esc(r[1])} · z ${Number(r[5]).toFixed(2)} · +${pct(r[4])}</small></span></button>`}).join('')}</div></article>`;
  }

  function communeChart(d){
    const rows=(d.communeGrowth||[]).slice(0,9),max=Math.max(...rows.flatMap(r=>[Number(r[1]||0),Number(r[2]||0)]),1);
    return `<article class="res970-panel"><header><div><span>CAMBIO COMUNAL</span><h3>2026 frente a 2025</h3></div><em>ene–jul · mín. 100</em></header><div class="res970-compare-legend"><span><i class="a"></i>2025</span><span><i class="b"></i>2026</span></div><div class="res970-compare">${rows.map(r=>`<button data-res970-kind="commune" data-res970-term="${esc(r[0])}"><span><b>${esc(r[0])}</b><small>+${pct(r[3])}</small></span><span class="res970-twin"><i class="a" style="--w:${(100*r[2]/max).toFixed(1)}%"></i><i class="b" style="--w:${(100*r[1]/max).toFixed(1)}%"></i></span><strong>${num(r[2])} → ${num(r[1])}</strong></button>`).join('')}</div></article>`;
  }

  function clustersTable(d){
    const rows=(d.clusters||[]).slice(0,16);
    return `<article class="res970-panel res970-clusters"><header><div><span>COINCIDENCIA REGISTRAL</span><h3>Grupos con atributos idénticos</h3></div><em>${num(d.clusterGroups)} grupos ≥10 · ${num(d.clusterCompanies)} sociedades</em></header><div class="res970-cluster-head"><span>N</span><span>Fecha</span><span>Comuna</span><span>Tipo</span><span>Capital</span><span></span></div><div class="res970-cluster-list">${rows.map(r=>`<button data-res970-kind="cluster" data-res970-term="${esc(r[0])}"><b>${num(r[5])}</b><time>${esc(r[0])}</time><span>${esc(r[2])}</span><em>${esc(r[3])}</em><strong>${money(r[4])}</strong><i>abrir →</i></button>`).join('')}</div></article>`;
  }

  function build(root){
    if(!root.querySelector('#res952-findings')||root.querySelector('.res970-phenomena'))return;
    const d=source();if(!d)return;
    const s=document.createElement('section');s.className='res970-phenomena';
    s.innerHTML=`<header class="res970-title"><div><span>INTELIGENCIA REGISTRAL · RES</span><h2>Hallazgos estructurales</h2></div><p>El objetivo es encontrar patrones de constitución, repetición, concentración y convergencia que merecen revisión. Son señales de exploración, no imputaciones ni una probabilidad de LA/FT.</p></header>${executiveCards(d)}<div class="res970-analytics-grid">${anomalyChart(d)}${communeChart(d)}${dateChart(d)}${capitalChart(d)}</div>${clustersTable(d)}<div class="res970-context"><b>Lectura conjunta</b><span>Una señal aislada puede ser frecuente o explicable. La prioridad aumenta cuando fecha, territorio, tipo societario, capital, relaciones o actuaciones convergen sobre las mismas sociedades.</span><span><strong>${pct(d.top10CommuneShare)}</strong> del YTD se concentra en las 10 comunas principales · HHI comunal ${Number(d.hhiCommune||0).toFixed(0)}.</span></div>`;
    (root.querySelector('.res952-tabs')||root.firstElementChild)?.insertAdjacentElement('afterend',s);
    hideLegacy(root);
    const method=root.querySelector('.res952-method');if(method){method.classList.add('res970-method');method.innerHTML='<b>Criterio de uso</b><span>Los fenómenos se detectan con RES. La caracterización SII y otras fuentes se muestran separadamente dentro de la ficha y no alteran el hallazgo registral.</span>';}
    const evidence=root.querySelector('#res952-company-list')?.closest('.res952-company-card');if(evidence){evidence.classList.add('res970-evidence-card');const h=evidence.querySelector('header h3');if(h)h.textContent='Sociedades asociadas al hallazgo seleccionado';const t=evidence.querySelector('header span');if(t)t.textContent='EVIDENCIA INDIVIDUALIZADA · RES';}
    s.addEventListener('click',e=>{const b=e.target.closest('[data-res970-kind]');if(!b)return;e.preventDefault();trigger(root,b.dataset.res970Kind,b.dataset.res970Term||'',true);});
  }

  async function take(p){try{const r=await p;return r?.error?null:r?.data??null;}catch(_e){return null;}}
  const scalarRows=o=>Object.entries(o||{}).filter(([,v])=>v!==null&&v!==''&&['string','number','boolean'].includes(typeof v)).slice(0,12);
  const label=k=>String(k).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

  async function enhanceCompany(row){
    const drawer=document.querySelector('#res952-drawer');if(!drawer||!row?.rut||drawer.dataset.res970Rut===String(row.rut))return;
    drawer.dataset.res970Rut=String(row.rut);drawer.classList.add('res970-rich-drawer');
    let panel=drawer.querySelector('.res970-company-intelligence');if(!panel){panel=document.createElement('section');panel.className='res970-company-intelligence';drawer.appendChild(panel);}
    panel.innerHTML='<div class="res970-profile-loading"><i></i><span>Cargando expediente societario RES…</span></div>';
    const client=db();if(!client){panel.innerHTML='<p class="res970-profile-empty">No hay cliente de datos disponible.</p>';return;}
    const rut=row.rut;
    const [company,acts,rels,adds,docs,bridge]=await Promise.all([
      take(client.from('aml_res_company').select('rut,legal_name,constitution_date,registry_date,sii_approval_date,company_code,capital,social_commune,social_region,tax_commune,tax_region,source_record_id,source_snapshot_id,source_payload,first_seen_at,last_seen_at,refreshed_at').eq('rut',rut).maybeSingle()),
      take(client.from('aml_res_actuation').select('actuation_type,actuation_date,registry_date,public_document_url,source_document_id,evidence_status').eq('rut',rut).order('actuation_date',{ascending:false}).limit(15)),
      take(client.from('aml_res_relationship').select('related_rut,related_name,relationship_type,ownership_pct,shares_count,valid_from,valid_to,relationship_status,confidence,requires_review,source_document_url,related_entity_type,role_label').eq('company_rut',rut).order('valid_from',{ascending:false}).limit(25)),
      take(client.from('aml_res_address_history').select('address_type,address_text,commune,region,valid_from,valid_to,address_status,confidence').eq('company_rut',rut).order('valid_from',{ascending:false}).limit(12)),
      take(client.from('aml_res_document_evidence').select('document_type,actuation_type,actuation_date,registry_date,document_title,source_url,cve,extraction_status,review_status').eq('company_rut',rut).order('actuation_date',{ascending:false}).limit(15)),
      take(client.from('aml_res_entity_bridge').select('entity_id,match_method,confidence').eq('rut',rut).maybeSingle())
    ]);
    const entityId=bridge?.entity_id||null;
    const tax=entityId?await take(client.from('aml_entity_tax_profile').select('commercial_year,sales_band,sales_band_code,workers_numeric,region,province,commune,economic_sector,economic_subsector,main_activity,taxpayer_type,taxpayer_subtype,positive_equity_band,negative_equity_band,activity_start_date,termination_date,current_status,activity_count,activity_codes,activity_names,address_count,current_address_count,ownership_edge_count,legal_entity_partner_count,societies_as_partner_count,signal_count,signal_types,updated_at').eq('entity_id',entityId).order('commercial_year',{ascending:false}).limit(1).maybeSingle()):null;
    const A=Array.isArray(acts)?acts:[],R=Array.isArray(rels)?rels:[],D=Array.isArray(adds)?adds:[],E=Array.isArray(docs)?docs:[];
    const src=scalarRows(company?.source_payload);
    const geoMismatch=company?.social_commune&&company?.tax_commune&&String(company.social_commune).toUpperCase()!==String(company.tax_commune).toUpperCase();
    panel.innerHTML=`<div class="res970-profile-summary"><div><span>EXPEDIENTE SOCIETARIO</span><h4>Caracterización disponible</h4></div><div class="res970-profile-counts"><b>${A.length}<small>actuaciones</small></b><b>${R.length}<small>relaciones</small></b><b>${D.length}<small>domicilios</small></b><b>${E.length}<small>documentos</small></b></div></div>
      <section class="res970-profile-section"><header><b>Identidad y ciclo registral</b><span>RES</span></header><div class="res970-facts"><div><span>RUT</span><b>${esc(company?.rut||rut)}</b></div><div><span>Tipo societario</span><b>${esc(company?.company_code||row.company_code||'—')}</b></div><div><span>Constitución</span><b>${esc(company?.constitution_date||row.constitution_date||'—')}</b></div><div><span>Registro</span><b>${esc(company?.registry_date||'—')}</b></div><div><span>Capital</span><b>${money(company?.capital??row.capital)}</b></div><div><span>Aprobación SII</span><b>${esc(company?.sii_approval_date||'—')}</b></div></div></section>
      <section class="res970-profile-section"><header><b>Geografía registral</b><span>${geoMismatch?'REVISAR COHERENCIA':'RES'}</span></header><div class="res970-facts"><div><span>Comuna social</span><b>${esc(company?.social_commune||'—')}</b></div><div><span>Región social</span><b>${esc(regions[company?.social_region]||company?.social_region||'—')}</b></div><div><span>Comuna tributaria</span><b>${esc(company?.tax_commune||'—')}</b></div><div><span>Región tributaria</span><b>${esc(regions[company?.tax_region]||company?.tax_region||'—')}</b></div></div>${geoMismatch?'<p class="res970-profile-note">La comuna social y la tributaria difieren. Es una diferencia registral para revisar, no una señal AML por sí sola.</p>':''}</section>
      <section class="res970-profile-section"><header><b>Personas y entidades relacionadas</b><span>${R.length} registros</span></header>${R.length?`<div class="res970-relations">${R.map(r=>`<div><span><b>${esc(r.related_name||'Sin nombre')}</b><small>${esc(r.related_rut||r.related_entity_type||'—')}</small></span><em>${esc(r.role_label||r.relationship_type||'RELACIÓN')}</em><strong>${r.ownership_pct==null?'':pct(r.ownership_pct)}</strong><small>${esc(r.relationship_status||'—')}${r.requires_review?' · requiere revisión':''}</small>${safeUrl(r.source_document_url)?`<a href="${esc(r.source_document_url)}" target="_blank" rel="noopener">evidencia ↗</a>`:''}</div>`).join('')}</div>`:'<p class="res970-profile-empty">Sin relaciones materializadas para esta sociedad.</p>'}</section>
      <section class="res970-profile-section"><header><b>Actuaciones y documentos</b><span>${A.length} actuaciones · ${E.length} documentos</span></header>${A.length?`<div class="res970-timeline">${A.map(a=>`<div><time>${esc(a.actuation_date||a.registry_date||'—')}</time><span><b>${esc(a.actuation_type||'Actuación')}</b><small>${esc(a.evidence_status||'—')}</small></span>${safeUrl(a.public_document_url)?`<a href="${esc(a.public_document_url)}" target="_blank" rel="noopener">abrir ↗</a>`:''}</div>`).join('')}</div>`:'<p class="res970-profile-empty">Sin actuaciones materializadas.</p>'}${E.length?`<div class="res970-docs">${E.map(e=>`<div><span><b>${esc(e.document_type||e.actuation_type||'Documento')}</b><small>${esc(e.document_title||e.actuation_date||e.registry_date||'')}</small></span><em>${esc(e.extraction_status||'—')}</em>${safeUrl(e.source_url)?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">fuente ↗</a>`:''}</div>`).join('')}</div>`:''}</section>
      <section class="res970-profile-section"><header><b>Historial de domicilios</b><span>${D.length} registros</span></header>${D.length?`<div class="res970-addresses">${D.map(a=>`<div><span><b>${esc(a.address_type||'Domicilio')} · ${esc(a.commune||'—')}</b><small>${esc(a.address_text||'Dirección no materializada')}</small></span><em>${esc(a.address_status||'—')}</em><small>${esc(a.valid_from||'')} ${a.valid_to?'→ '+esc(a.valid_to):''}</small></div>`).join('')}</div>`:'<p class="res970-profile-empty">Sin historial de domicilios materializado.</p>'}</section>
      <section class="res970-profile-section res970-sii-enrichment"><header><b>Caracterización económica</b><span>SII · enriquecimiento externo</span></header>${tax?`<div class="res970-facts"><div><span>Estado</span><b>${esc(tax.current_status||'—')}</b></div><div><span>Año comercial</span><b>${esc(tax.commercial_year||'—')}</b></div><div class="wide"><span>Actividad principal</span><b>${esc(tax.main_activity||'—')}</b></div><div><span>Sector</span><b>${esc(tax.economic_sector||'—')}</b></div><div><span>Subsector</span><b>${esc(tax.economic_subsector||'—')}</b></div><div><span>Ventas</span><b>${esc(tax.sales_band||tax.sales_band_code||'—')}</b></div><div><span>Trabajadores</span><b>${tax.workers_numeric==null?'—':num(tax.workers_numeric)}</b></div><div><span>Actividades</span><b>${tax.activity_count==null?'—':num(tax.activity_count)}</b></div><div><span>Domicilios</span><b>${tax.address_count==null?'—':num(tax.address_count)}</b></div><div><span>Relaciones propiedad</span><b>${tax.ownership_edge_count==null?'—':num(tax.ownership_edge_count)}</b></div></div>`:'<p class="res970-profile-empty">Sin perfil económico materializado para esta sociedad.</p>'}<p class="res970-profile-note">Este bloque caracteriza a la empresa; no se usa para crear ni aumentar el hallazgo RES mostrado arriba.</p></section>
      ${src.length?`<section class="res970-profile-section"><header><b>Atributos adicionales de la fuente</b><span>source_payload RES</span></header><dl class="res970-source-fields">${src.map(([k,v])=>`<dt>${esc(label(k))}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>`:''}
      <section class="res970-profile-provenance"><span>Snapshot RES</span><b>${esc(company?.source_snapshot_id||'—')}</b><span>Última observación</span><b>${esc(company?.last_seen_at||company?.refreshed_at||'—')}</b><span>Vínculo entidad</span><b>${esc(bridge?.match_method||'no materializado')}${bridge?.confidence!=null?' · '+pct(Number(bridge.confidence)*100):''}</b></section>`;
  }

  let routeTimer=0;const retryTimers=new Set();
  function apply(){const root=document.querySelector('[data-res952-root]');if(!root)return false;compact(root);build(root);window.__ATLAS_RES_REFINEMENT__={version:VERSION,status:'ready',phenomena:'analyst-dashboard',companyDrawer:'full-res-characterization',observer:'none',checkedAt:new Date().toISOString()};return true;}
  function clearRetries(){retryTimers.forEach(clearTimeout);retryTimers.clear();}
  function runBoundedInit(){clearRetries();[0,80,220,550,1100].forEach(ms=>{const id=setTimeout(()=>{retryTimers.delete(id);apply();},ms);retryTimers.add(id);});}
  function schedule(){clearTimeout(routeTimer);routeTimer=setTimeout(runBoundedInit,20);}
  runBoundedInit();
  document.addEventListener('atlas:routechange',schedule);
  document.addEventListener('click',e=>{
    const tab=e.target?.closest?.('[data-res952-route]');if(tab)setTimeout(runBoundedInit,0);
    const company=e.target?.closest?.('[data-res952-company]');if(company){const list=company.closest('#res952-company-list');const row=(list?.__rows||[])[Number(company.dataset.res952Company)];if(row)setTimeout(()=>enhanceCompany(row),180);}
  },true);
})();
