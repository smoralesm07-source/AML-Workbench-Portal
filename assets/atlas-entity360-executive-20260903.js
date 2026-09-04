'use strict';

/* ATLAS AML · Entidad 360 Executive · 2026-09-03
 * Producción: se engancha al entry point real de Entidades (__ATLAS_ENTITY_ENTRY__)
 * y NO depende de que el renderer legado v0203RenderEntity exista.
 * Sólo lectura bajo sesión/RLS; cruces por entity_id o RUT exacto.
 */
(function atlasEntity360Executive20260903(){
  const RELEASE='0.71.1';
  const BUILD='20260903-e360-3';
  const AUTHORITY='ENTITY360_EXECUTIVE_PRODUCTION_ENTRY';
  const MASTER='aml_entity_master_v0553';
  const TAX='aml_entity_tax_profile';
  const UAF='aml_uaf_entity_profile';
  const SAN='aml_v_ipa3_sanction_entity_summary';
  const SPEND='aml_v_public_spend_provider_intel_0720';
  const HISTORY='aml_sii_entity_year';
  const TTL=5*60*1000;
  const CACHE=new Map();
  const INFLIGHT=new Map();

  if(window.__ATLAS_ENTITY360_EXECUTIVE__?.build===BUILD)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=(v,d=0)=>{const n=num(v);return n==null?'—':n.toLocaleString('es-CL',{maximumFractionDigits:d,minimumFractionDigits:0});};
  const money=v=>{const n=num(v);if(n==null)return'—';const a=Math.abs(n);if(a>=1e12)return'$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';if(a>=1e9)return'$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M';if(a>=1e6)return'$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M';return'$'+n.toLocaleString('es-CL',{maximumFractionDigits:0});};
  const day=v=>v?String(v).slice(0,10):'—';
  const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
  const split=v=>Array.isArray(v)?v:String(v||'').split('|').map(x=>x.trim()).filter(Boolean);
  const soft=p=>Promise.resolve(p).then(value=>({value,error:value?.error||null}),error=>({value:null,error}));
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const appState=()=>{try{return typeof state!=='undefined'?state:(window.state||null);}catch(_e){return window.state||null;}};
  const selected=()=>appState()?.selectedEntity||null;
  const inEntities=()=>{const v=String(appState()?.view||'');return !v||v==='entities'||v==='entity'||v==='entity360';};
  const statusText=v=>String(v||'').replaceAll('_',' ').trim();

  function pill(label,tone='neutral'){return `<span class="e360-pill ${tone}"><i></i>${esc(label)}</span>`;}
  function fact(label,value,detail=''){return `<div class="e360-fact"><span>${esc(label)}</span><b>${esc(value==null||value===''?'—':value)}</b>${detail?`<small>${esc(detail)}</small>`:''}</div>`;}
  function empty(title,body){return `<div class="e360-empty"><b>${esc(title)}</b><span>${esc(body)}</span></div>`;}
  function card(id,eyebrow,title,body,wide=false){return `<article class="e360-card${wide?' wide':''}" id="${esc(id)}"><header><div><span>${esc(eyebrow)}</span><h3>${esc(title)}</h3></div></header>${body}</article>`;}
  function currentTax(data){return data?.tax||null;}
  function taxSeries(data){const rows=(data?.history||[]).slice();if(!rows.length&&data?.tax)rows.push(data.tax);return rows.sort((a,b)=>(num(a.commercial_year)||0)-(num(b.commercial_year)||0));}

  function taxStatus(data){const tax=currentTax(data);if(!tax)return pill('SII · consultando / no materializado');const s=statusText(tax.current_status),ended=!!tax.termination_date||/TERMIN|CESAD|INACTIV|NO VIGENT/i.test(s);if(ended)return pill(`SII · ${s||'término observado'}`,'warn');return pill(`SII · ${s||'perfil disponible'}`,'ok');}
  function uafStatus(data){if(data?.uaf)return pill('UAF · registro materializado','uaf');if(data?.entity?.is_uaf_observed===true)return pill('UAF · observado, sin detalle','uaf');return pill('UAF · sin detalle materializado');}
  function sanctionStatus(data){const n=num(data?.sanctions?.sanction_event_count);if(n!=null&&n>0)return pill(`Sanciones · ${fmt(n)} evento${n===1?'':'s'}`,'warn');if(data?.entity?.is_sanctioned===true)return pill('Sanciones · antecedente observado','warn');return pill('Sanciones · sin eventos materializados');}
  function resStatus(data){return data?.master?.res_available===true?pill('RES · registro enlazado','res'):pill('RES · no materializado');}
  function spendStatus(data){const n=num(data?.spend?.order_count);return n!=null&&n>0?pill(`Compras públicas · ${fmt(n)} OC`,'spend'):pill('Compras públicas · sin registro materializado');}

  function taxChart(data){
    const rows=taxSeries(data).filter(r=>num(r.commercial_year)!=null);
    if(rows.length<2)return '<div class="e360-chart-empty">Trayectoria histórica SII no materializada para esta identidad.</div>';
    const W=560,H=160,pl=30,pr=24,pt=18,pb=30,iw=W-pl-pr,ih=H-pt-pb;
    const years=rows.map(r=>num(r.commercial_year)),minY=Math.min(...years),maxY=Math.max(...years),span=Math.max(1,maxY-minY);
    const maxRank=Math.max(13,...rows.map(r=>num(r.sales_band_rank)||0));
    const maxWorkers=Math.max(1,...rows.map(r=>num(r.workers_numeric)||0));
    const x=y=>pl+(y-minY)/span*iw,yr=v=>pt+ih-(Math.max(0,v)/maxRank)*ih,yw=v=>pt+ih-(Math.max(0,v)/maxWorkers)*ih;
    const sales=rows.map(r=>`${x(num(r.commercial_year)).toFixed(1)},${yr(num(r.sales_band_rank)||0).toFixed(1)}`).join(' ');
    const workers=rows.map(r=>`${x(num(r.commercial_year)).toFixed(1)},${yw(num(r.workers_numeric)||0).toFixed(1)}`).join(' ');
    const events=rows.filter(r=>r.region_changed===true||r.main_activity_changed===true);
    return `<div class="e360-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trayectoria anual de ventas y trabajadores">${[0,.5,1].map(f=>`<line class="grid" x1="${pl}" y1="${(pt+ih*f).toFixed(1)}" x2="${W-pr}" y2="${(pt+ih*f).toFixed(1)}"></line>`).join('')}${events.map(r=>`<line class="event-line" x1="${x(num(r.commercial_year)).toFixed(1)}" y1="${pt}" x2="${x(num(r.commercial_year)).toFixed(1)}" y2="${pt+ih}"><title>${esc(r.commercial_year)} · ${r.region_changed===true?'cambio regional ':''}${r.main_activity_changed===true?'cambio actividad principal':''}</title></line>`).join('')}<polyline class="sales" points="${sales}"></polyline><polyline class="workers" points="${workers}"></polyline>${rows.map(r=>`<circle class="sales-dot" cx="${x(num(r.commercial_year)).toFixed(1)}" cy="${yr(num(r.sales_band_rank)||0).toFixed(1)}" r="3"><title>${esc(r.commercial_year)} · rango ventas ${esc(fmt(r.sales_band_rank))}</title></circle>`).join('')}${rows.map(r=>`<circle class="workers-dot" cx="${x(num(r.commercial_year)).toFixed(1)}" cy="${yw(num(r.workers_numeric)||0).toFixed(1)}" r="3"><title>${esc(r.commercial_year)} · ${esc(fmt(r.workers_numeric))} trabajador(es)</title></circle>`).join('')}${rows.map(r=>`<text x="${x(num(r.commercial_year)).toFixed(1)}" y="${H-10}" text-anchor="middle">${esc(r.commercial_year)}</text>`).join('')}</svg><div class="e360-chart-legend"><span class="sales">tramo de ventas</span><span class="workers">trabajadores</span>${events.length?'<span class="events">cambios observados</span>':''}<small>Escalas independientes; lectura descriptiva.</small></div></div>`;
  }

  function giroList(tax){
    if(!tax)return empty('Giros en consulta','ATLAS está consultando el perfil tributario materializado.');
    const names=split(tax.activity_names),codes=split(tax.activity_codes),n=Math.max(names.length,codes.length);
    if(!n)return empty('Giros no materializados','El perfil tributario no trae detalle de actividades en este corte.');
    const max=Math.min(n,5),items=[];
    for(let i=0;i<max;i++)items.push(`<li><code>${esc(codes[i]||'—')}</code><span>${esc(names[i]||'Actividad declarada')}</span></li>`);
    return `<div class="e360-activities"><div class="e360-subhead"><b>Giros declarados</b><span>${fmt(tax.activity_count??n)} actividad(es)</span></div><ul>${items.join('')}</ul>${n>max?`<small>+ ${fmt(n-max)} actividad(es) adicionales.</small>`:''}</div>`;
  }

  function taxCard(data){
    const tax=currentTax(data);
    if(!tax)return card('e360-tax','SII','Perfil tributario',empty(data?'Perfil tributario no materializado':'Consultando perfil tributario','ATLAS no completa este bloque mediante inferencia.'),true);
    const status=statusText(tax.current_status)||'Estado no informado';
    const ended=!!tax.termination_date||/TERMIN|CESAD|INACTIV|NO VIGENT/i.test(status);
    const location=[tax.region||data?.entity?.region,tax.commune||data?.entity?.commune].filter(Boolean).join(' · ')||'—';
    const summary=`<div class="e360-tax-lead"><div><span>Actividad principal</span><b>${esc(tax.main_activity||'—')}</b><small>${esc([tax.economic_sector,tax.economic_subsector].filter(Boolean).join(' · ')||'sector no materializado')}</small></div><div class="e360-state ${ended?'warn':''}"><i></i><b>${esc(status)}</b><span>${esc(location)}</span></div></div>`;
    const facts=`<div class="e360-facts cols6">${fact('Inicio actividades',day(tax.activity_start_date))}${fact('Término de giro',tax.termination_date?day(tax.termination_date):'—','Sin fecha no implica inexistencia')}${fact('Ventas',tax.sales_band||tax.sales_band_code||'—',`año ${tax.commercial_year||'—'}`)}${fact('Trabajadores',fmt(tax.workers_numeric),`año ${tax.commercial_year||'—'}`)}${fact('Región',tax.region||data?.entity?.region||'—')}${fact('Comuna',tax.commune||data?.entity?.commune||'—')}</div>`;
    return card('e360-tax','SII','Perfil tributario',summary+facts+giroList(tax)+taxChart(data),true);
  }

  function sourceState(ok,label,detail,tone='neutral'){return `<div class="e360-source ${tone}"><i></i><div><b>${esc(label)}</b><span>${esc(detail)}</span></div><strong>${ok?'✓':'—'}</strong></div>`;}
  function sourceCard(data){
    const t=currentTax(data),u=data?.uaf,s=data?.sanctions,r=data?.master,p=data?.spend,e=data?.entity||{};
    const rows=[
      sourceState(!!t,'SII',t?`Perfil ${t.commercial_year||'vigente'} · ${t.activity_count??'—'} giros`:'perfil no materializado',t?'ok':'neutral'),
      sourceState(!!u||e.is_uaf_observed===true,'UAF',u?`${arr(u.sector_names).length} sector(es)`:e.is_uaf_observed===true?'observado · detalle pendiente':'registro no materializado',u||e.is_uaf_observed===true?'uaf':'neutral'),
      sourceState((num(s?.sanction_event_count)||0)>0||e.is_sanctioned===true,'Sanciones',s?`${fmt(s.sanction_event_count)} evento(s)`:e.is_sanctioned===true?'antecedente observado':'sin resumen materializado',(num(s?.sanction_event_count)||0)>0||e.is_sanctioned===true?'warn':'neutral'),
      sourceState(r?.res_available===true,'RES',r?.res_available===true?`constitución ${day(r.res_constitution_date)}`:'registro no materializado',r?.res_available===true?'res':'neutral'),
      sourceState((num(p?.order_count)||0)>0,'Compras públicas',p?`${fmt(p.order_count)} OC · ${fmt(p.buyer_count)} compradores`:'proveedor no materializado',p?'spend':'neutral')
    ];
    return card('e360-sources','COBERTURA','Fuentes disponibles',`<div class="e360-sources">${rows.join('')}</div><p class="e360-note">Cobertura describe información disponible, no nivel de riesgo.</p>`);
  }

  function uafCard(data){const u=data?.uaf,e=data?.entity||{};if(!u)return card('e360-uaf','UAF','Perímetro UAF',empty(e.is_uaf_observed===true?'Entidad observada por UAF, sin detalle materializado':'Registro UAF no materializado','La ausencia de detalle no se interpreta como exclusión del perímetro UAF.'));return card('e360-uaf','UAF','Perímetro UAF',`<div class="e360-facts cols2">${fact('Clase registral',u.registry_class||'—')}${fact('Corte',day(u.updated_at))}</div><div class="e360-list"><span>Sectores</span><b>${esc(arr(u.sector_names).join(' · ')||'—')}</b></div><div class="e360-list"><span>Denominaciones</span><b>${esc(arr(u.registry_names).join(' · ')||'—')}</b></div><div class="e360-meta-line"><span>${esc(u.source_scope||'alcance no informado')}</span><span>${fmt(arr(u.source_document_ids).length)} documento(s) fuente</span></div>`);}

  function sanctionsCard(data){const s=data?.sanctions,e=data?.entity||{};if(!s)return card('e360-sanctions','RADAR SANCIONATORIO','Sanciones',empty('Resumen no materializado',e.is_sanctioned===true?'Existe una marca sancionatoria en la identidad, sin resumen gobernado disponible.':'No hay resumen sancionatorio materializado para esta identidad.'));return card('e360-sanctions','RADAR SANCIONATORIO','Sanciones',`<div class="e360-number"><b>${fmt(s.sanction_event_count)}</b><span>evento(s) resuelto(s) contra la identidad</span></div><div class="e360-facts cols3">${fact('Últimos 36 meses',fmt(s.sanction_count_36m))}${fact('Últimos 60 meses',fmt(s.sanction_count_60m))}${fact('LA/FT directo',fmt(s.laft_direct_count))}</div><div class="e360-list"><span>Reguladores</span><b>${esc(arr(s.regulators).join(' · ')||'—')}</b></div><div class="e360-meta-line"><span>Último evento: ${esc(day(s.latest_sanction_date))}</span><span>Confianza identidad: ${s.min_identity_confidence==null?'—':esc(fmt(s.min_identity_confidence,2))}</span></div><p class="e360-note">Una sanción administrativa no acredita por sí sola LA/FT ni delito.</p>`);}

  function resCard(data){const r=data?.master;if(!r||r.res_available!==true)return card('e360-res','RES / EMPRESA EN UN DÍA','Registro societario',empty('Registro RES no materializado','No se afirma inexistencia en RES; este corte no aporta un vínculo registral para la identidad consultada.'));return card('e360-res','RES / EMPRESA EN UN DÍA','Registro societario',`<div class="e360-number compact"><b>Sí</b><span>registro RES enlazado por RUT exacto</span></div><div class="e360-facts cols2">${fact('Constitución',day(r.res_constitution_date))}${fact('Aprobación SII',day(r.res_sii_approval_date))}${fact('Capital',money(r.res_capital))}${fact('Código societario',r.res_company_code||'—')}</div><div class="e360-list"><span>Razón social RES</span><b>${esc(r.res_legal_name||r.name||'—')}</b></div><div class="e360-meta-line"><span>${esc([r.res_tax_commune,r.res_tax_region!=null?'Región '+r.res_tax_region:null].filter(Boolean).join(' · ')||'domicilio tributario no materializado')}</span><span>${fmt(r.res_relationship_count)} relación(es) documentada(s)</span></div><p class="e360-note">Fuente RES materializada; identidad vinculada sólo por RUT exacto.</p>`);}

  function spendCard(data){const s=data?.spend;if(!s)return card('e360-spend','COMPRAS PÚBLICAS','Proveedor del Estado',empty('Sin registro materializado como proveedor','La ausencia en esta vista no se interpreta como inexistencia de compras públicas fuera del corte disponible.'));return card('e360-spend','COMPRAS PÚBLICAS','Proveedor del Estado',`<div class="e360-number"><b>${money(s.total_clp)}</b><span>monto total materializado</span></div><div class="e360-facts cols2">${fact('Órdenes de compra',fmt(s.order_count))}${fact('Compradores',fmt(s.buyer_count))}${fact('Trato directo',fmt(s.direct_order_count))}${fact('Última orden',day(s.last_order_date))}</div><div class="e360-range"><span>${esc(day(s.first_order_date))}</span><i></i><span>${esc(day(s.last_order_date))}</span></div><div class="e360-meta-line"><span>${fmt(s.presupuesto_signal_count)} señal(es) presupuesto</span><span>${fmt(s.lobby_count)} lobby · ${fmt(s.cgr_count)} CGR</span></div><p class="e360-note">Actividad pública observada; no constituye por sí misma una señal de irregularidad.</p>`);}

  function advancedCard(){const buttons=[['character','Caracterización'],['signals','Señales / IPA3'],['network','Red y vínculos'],['timeline','Cronología'],['evidence','Evidencia'],['identity','Identidad']];return card('e360-advanced','PROFUNDIZACIÓN','Análisis avanzado',`<p class="e360-copy">La vista ejecutiva concentra los hechos esenciales. Para metodología, pares, vínculos, trayectoria y evidencia documental, abre el lente correspondiente.</p><div class="e360-deep-links">${buttons.map(([k,l])=>`<button type="button" data-e360-lens="${k}">${esc(l)}<span>→</span></button>`).join('')}</div><p class="e360-note">IPA3 ordena prioridad comparativa de revisión; no estima probabilidad de LA/FT.</p>`,true);}

  function header(data,id,meta){const e=data?.entity||meta||{},t=currentTax(data),r=data?.master||{},name=e.name||r.name||r.res_legal_name||id,rut=e.rut||r.rut||'RUT no materializado',type=e.entity_type||r.entity_type||'tipo no materializado',location=[t?.region||e.region||r.region,t?.commune||e.commune||r.commune].filter(Boolean).join(' · ')||'Territorio no materializado',updated=day(t?.updated_at||r.updated_at||e.updated_at);return `<section class="e360-head"><div class="e360-title"><span>ENTIDAD 360 · RESUMEN OPERATIVO</span><h2>${esc(name)}</h2><div class="e360-idline"><b>${esc(rut)}</b><span>${esc(type)}</span><span>${esc(location)}</span></div></div><div class="e360-head-side"><div class="e360-head-label">Último corte visible</div><b>${esc(updated)}</b><small>${esc(id)}</small></div><div class="e360-status-row">${taxStatus(data)}${uafStatus(data)}${sanctionStatus(data)}${resStatus(data)}${spendStatus(data)}</div></section>`;}
  function quickFacts(data){const t=currentTax(data),s=data?.sanctions,r=data?.master,p=data?.spend;return `<section class="e360-quick">${fact('Inicio actividades',t?day(t.activity_start_date):'—')}${fact('Ventas',t?.sales_band||t?.sales_band_code||'—',t?.commercial_year?`año ${t.commercial_year}`:'')}${fact('Trabajadores',t?fmt(t.workers_numeric):'—',t?.commercial_year?`año ${t.commercial_year}`:'')}${fact('Giros',t?fmt(t.activity_count):'—')}${fact('Sanciones',s?fmt(s.sanction_event_count):(data?.entity?.is_sanctioned===true?'observado':'—'))}${fact('RES',r?.res_available===true?'Sí':'—')}${fact('Compras públicas',p?fmt(p.order_count):'—','órdenes materializadas')}</section>`;}
  function nav(){return `<nav class="e360-nav" aria-label="Navegación Entidad 360"><button type="button" data-e360-go="e360-tax">Tributario</button><button type="button" data-e360-go="e360-uaf">UAF</button><button type="button" data-e360-go="e360-sanctions">Sanciones</button><button type="button" data-e360-go="e360-res">RES</button><button type="button" data-e360-go="e360-spend">Compras públicas</button><button type="button" data-e360-go="e360-advanced">Análisis avanzado</button></nav>`;}
  function markup(data,id,meta){return `${header(data,id,meta)}${quickFacts(data)}${nav()}<div class="e360-grid">${taxCard(data)}${sourceCard(data)}${uafCard(data)}${sanctionsCard(data)}${resCard(data)}${spendCard(data)}${advancedCard()}</div>`;}

  function findRoot(){return document.querySelector('#content .a45')||document.querySelector('#content .aed-dossier')||document.querySelector('#content .v0203-entity')||document.querySelector('#content');}
  function bind(host,root){host.querySelectorAll('[data-e360-go]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.e360Go)?.scrollIntoView({behavior:'smooth',block:'start'})));host.querySelectorAll('[data-e360-lens]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.e360Lens,navButton=root.querySelector(`[data-a45-lens="${key}"],[data-a45-tab="${key}"],[data-a45-nav="${key}"]`);if(navButton&&typeof navButton.click==='function')navButton.click();root.querySelector(`[data-a45-panel="${key}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});}));}
  function mount(id,meta,data){const root=findRoot();if(!root||!id)return false;root.classList.add('e360-modern');let host=root.querySelector(':scope > #atlas-entity360-executive');if(!host){host=document.createElement('section');host.id='atlas-entity360-executive';host.className='e360-executive';root.insertBefore(host,root.firstChild);}host.innerHTML=markup(data,id,meta);bind(host,root);window.__ATLAS_ENTITY360_EXECUTIVE_STATE__={active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,entityId:id,hydrated:!!data,errors:data?.errors||[],entryHooked:!!window.__ATLAS_ENTITY_ENTRY__?.open?.__atlasE360Executive,renderedAt:new Date().toISOString()};return true;}

  async function fetchPackage(id,meta){
    const client=db();if(!client||!id)return null;
    const masterRes=await soft(client.from(MASTER).select('*').eq('entity_id',id).maybeSingle());
    const master=masterRes.value?.data||null;
    const entity={...(master||{}),...(meta||{}),entity_id:id,name:meta?.name||master?.name||master?.res_legal_name||id,rut:meta?.rut||master?.rut||null};
    const rut=entity.rut;
    const taxSelect='entity_id,commercial_year,sales_band,sales_band_code,sales_band_rank,workers_numeric,region,province,commune,economic_sector,economic_subsector,main_activity,taxpayer_type,taxpayer_subtype,activity_start_date,termination_date,current_status,activity_count,activity_codes,activity_names,address_count,current_address_count,communes,address_regions,ownership_edge_count,legal_entity_partner_count,societies_as_partner_count,signal_count,signal_types,updated_at';
    const tasks=[
      soft(client.from(TAX).select(taxSelect).eq('entity_id',id).maybeSingle()),
      rut?soft(client.from(UAF).select('*').eq('rut',rut).limit(1).maybeSingle()):Promise.resolve({value:{data:null},error:null}),
      soft(client.from(SAN).select('*').eq('entity_id',id).maybeSingle()),
      soft(client.from(SPEND).select('supplier_rut,supplier_name,order_count,buyer_count,total_clp,first_order_date,last_order_date,direct_order_count,entity_id,region,commune,lobby_count,cgr_count,presupuesto_signal_count,attention_score,signal_codes').eq('entity_id',id).limit(1).maybeSingle()),
      soft(client.from(HISTORY).select('*').eq('entity_id',id).order('commercial_year',{ascending:false}).limit(5))
    ];
    const [taxRes,uafRes,sanRes,spendRes,historyRes]=await Promise.all(tasks);
    return {entityId:id,entity,master,tax:taxRes.value?.data||null,uaf:uafRes.value?.data||null,sanctions:sanRes.value?.data||null,spend:spendRes.value?.data||null,history:Array.isArray(historyRes.value?.data)?historyRes.value.data:[],errors:[masterRes,taxRes,uafRes,sanRes,spendRes,historyRes].map(r=>r?.error?String(r.error?.message||r.error):null).filter(Boolean),loadedAt:Date.now()};
  }

  function load(id,meta){const hit=CACHE.get(id);if(hit&&Date.now()-hit.loadedAt<TTL)return Promise.resolve(hit);if(INFLIGHT.has(id))return INFLIGHT.get(id);const job=fetchPackage(id,meta).then(data=>{if(data)CACHE.set(id,data);return data;}).finally(()=>INFLIGHT.delete(id));INFLIGHT.set(id,job);return job;}
  async function openExecutive(id,meta=null){if(!id||!inEntities())return false;mount(id,meta,null);const data=await load(id,meta);if(data&&selected()===id&&inEntities())mount(id,data.entity,data);return !!data;}

  function hookEntry(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;
    if(!entry||typeof entry.open!=='function')return false;
    if(entry.open.__atlasE360Executive===BUILD)return true;
    const base=entry.open;
    const wrapped=async function atlasEntity360EntryOpen(entityId,meta,...rest){const result=await base.apply(this,[entityId,meta,...rest]);const id=entityId||meta?.entity_id||selected();if(id)void openExecutive(id,meta);return result;};
    wrapped.__atlasE360Executive=BUILD;
    wrapped.__atlasE360Base=base;
    entry.open=wrapped;
    window.__ATLAS_ENTITY360_EXECUTIVE_ENTRY_STATE__={hooked:true,build:BUILD,authority:entry.authority||null,version:entry.version||null,hookedAt:new Date().toISOString()};
    return true;
  }

  function hookLegacy(){
    if(typeof window.v0203RenderEntity!=='function'||window.v0203RenderEntity.__atlasE360Executive===BUILD)return false;
    const base=window.v0203RenderEntity;
    const wrapped=function atlasEntity360LegacyRender(pkg,...args){const result=base.apply(this,[pkg,...args]);const id=pkg?.e?.entity_id;if(id){mount(id,pkg.e,null);void load(id,pkg.e).then(data=>{if(data&&selected()===id&&inEntities())mount(id,data.entity,data);});}return result;};
    wrapped.__atlasE360Executive=BUILD;
    wrapped.__atlasE360Base=base;
    try{v0203RenderEntity=wrapped;}catch(_e){}window.v0203RenderEntity=wrapped;
    return true;
  }

  window.__ATLAS_ENTITY360_EXECUTIVE__={active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,sources:[MASTER,TAX,UAF,SAN,SPEND,HISTORY],identityPolicy:'ENTITY_ID_OR_EXACT_RUT_ONLY',missingSemantic:'MISSING_IS_NOT_ZERO_OR_ABSENCE',authMutation:false,scoreMutation:false,cachePolicy:'MEMORY_ONLY',open:openExecutive,mount,hookEntry,clear:()=>CACHE.clear(),installedAt:new Date().toISOString()};

  hookEntry();
  hookLegacy();
  document.addEventListener('atlas:entity-workspace-ready',()=>{hookEntry();hookLegacy();});
  document.addEventListener('atlas:entity-entry-ready',()=>{hookEntry();hookLegacy();});
  window.addEventListener('load',()=>{hookEntry();hookLegacy();},{once:true});
  [250,1000,2500,5000].forEach(ms=>setTimeout(()=>{hookEntry();hookLegacy();},ms));
  const current=selected();if(current&&inEntities())setTimeout(()=>void openExecutive(current,null),80);
})();
