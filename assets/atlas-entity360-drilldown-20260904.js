'use strict';

/* ATLAS AML · Entidad 360 · navegación y fichas gobernadas · 2026-09-04
 * - Botón Volver: regresa al explorador inmediatamente anterior de Entidades.
 * - Drill-down bajo demanda: Sanciones, RES, Compras Públicas y Evidencia.
 * - Ventas: presenta el código SII como categoría + rango anual en UF.
 * Read-only. Todas las consultas usan la sesión/RLS activa; no se inventan documentos.
 */
(function atlasEntity360Drilldown20260904(){
  const BUILD='20260904-e360-drilldown-1';
  if(window.__ATLAS_ENTITY360_DRILLDOWN_20260904__?.build===BUILD)return;

  const MASTER='aml_entity_master_v0553';
  const TAX='aml_entity_tax_profile';
  const UAF='aml_uaf_entity_profile';
  const SAN='aml_sanctions_radiography_runtime_snapshot_v0961';
  const RES_COMPANY='aml_res_company';
  const RES_ACT='aml_res_actuation';
  const RES_REL='aml_res_relationship';
  const RES_DOC='aml_res_document_evidence';
  const SPEND_SUM='aml_v_public_spend_provider_intel_0720';
  const SPEND_ORDERS='aml_v_gp10_order';
  const CSS='./assets/atlas-entity360-drilldown-20260904.css?v=20260904-e360-drilldown1';
  const CACHE=new Map();

  const SALES={
    1:'Sin información de ventas',
    2:'Micro 1 · 0,01–200 UF/año',
    3:'Micro 2 · 200,01–600 UF/año',
    4:'Micro 3 · 600,01–2.400 UF/año',
    5:'Pequeña 1 · 2.400,01–5.000 UF/año',
    6:'Pequeña 2 · 5.000,01–10.000 UF/año',
    7:'Pequeña 3 · 10.000,01–25.000 UF/año',
    8:'Mediana 1 · 25.000,01–50.000 UF/año',
    9:'Mediana 2 · 50.000,01–100.000 UF/año',
    10:'Grande 1 · 100.000,01–200.000 UF/año',
    11:'Grande 2 · 200.000,01–600.000 UF/año',
    12:'Grande 3 · 600.000,01–1.000.000 UF/año',
    13:'Grande 4 · Más de 1.000.000 UF/año'
  };

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=v=>num(v)==null?'—':num(v).toLocaleString('es-CL',{maximumFractionDigits:0});
  const money=v=>num(v)==null?'—':'$ '+Math.round(num(v)).toLocaleString('es-CL');
  const uf=v=>num(v)==null?'—':num(v).toLocaleString('es-CL',{maximumFractionDigits:2})+' UF';
  const date=v=>{if(!v)return '—';const s=String(v).slice(0,10),d=new Date(s+'T12:00:00');return Number.isNaN(d.getTime())?s:d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'});};
  const clip=(v,n=520)=>{const s=String(v??'').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const currentState=()=>{try{return typeof state!=='undefined'?state:(window.state||window.amlState||null);}catch(_e){return window.state||window.amlState||null;}};
  const host=()=>document.querySelector('#atlas-entity360-executive.e360-history-host');
  const entityId=()=>host()?.dataset?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.entityId||window.__ATLAS_ENTITY360_CURRENT__?.selectedEntity||currentState()?.selectedEntity||null;
  const rutKey=v=>String(v||'').toUpperCase().replace(/[^0-9K]/g,'');
  const rutVariants=v=>{const k=rutKey(v);if(!k)return[];const a=[String(v||'').trim(),k];if(k.length>1)a.push(k.slice(0,-1)+'-'+k.slice(-1));return [...new Set(a.filter(Boolean))];};
  const soft=async p=>{try{const r=await p;return r||{};}catch(error){return {data:null,error};}};

  function ensureCss(){
    if(document.querySelector('link[data-atlas-e360-drilldown-css]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href=CSS;l.dataset.atlasE360DrilldownCss='1';document.head.appendChild(l);
  }

  function salesLabel(raw){
    const global=window.__ATLAS_SII_SALES_RANGES__||window.ATLAS_SII_SALES_RANGES;
    try{if(global?.format){const shown=global.format(raw);if(shown&&shown!==String(raw))return shown;}}catch(_e){}
    const s=String(raw??'').trim();if(!s)return '—';if(/\bUF\b/i.test(s))return s;
    const code=/^(?:[1-9]|1[0-3])$/.test(s)?Number(s):null;return code&&SALES[code]?SALES[code]:s;
  }

  function formatSales(root){
    if(!root)return;
    root.querySelectorAll('.eh-character-row').forEach(row=>{
      const label=row.querySelector(':scope > span');const value=row.querySelector(':scope > b,:scope > strong');
      if(!label||!value)return;
      if(/tramo.*ventas|ventas.*anuales/i.test(label.textContent||'')){
        label.textContent='Ventas anuales (UF)';
        value.textContent=salesLabel(value.textContent);
      }
    });
    root.querySelectorAll('.eh-compare-body > div > b').forEach(el=>{const shown=salesLabel(el.textContent);if(shown!==el.textContent)el.textContent=shown;});
    root.querySelectorAll('.eh-insight p').forEach(p=>{
      if(p.children.length)return;
      p.textContent=(p.textContent||'').replace(/tramo de ventas\s+(1[0-3]|[1-9])/gi,(_m,c)=>'ventas anuales '+salesLabel(c));
    });
  }

  function safeUrl(raw){
    try{const u=new URL(String(raw||''),location.href);return /^https?:$/.test(u.protocol)?u.href:null;}catch(_e){return null;}
  }
  function link(raw,label='Abrir documento'){
    const href=safeUrl(raw);return href?`<a class="e360-detail-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
  }
  function chip(text,tone=''){return text?`<span class="e360-detail-chip ${esc(tone)}">${esc(text)}</span>`:'';}
  function field(k,v){return `<div class="e360-detail-field"><span>${esc(k)}</span><b>${esc(v??'—')}</b></div>`;}
  function empty(text){return `<div class="e360-detail-empty">${esc(text)}</div>`;}

  function ensureDrawer(){
    let backdrop=document.querySelector('[data-e360-detail-backdrop]');
    let drawer=document.querySelector('[data-e360-detail-drawer]');
    if(!backdrop){backdrop=document.createElement('div');backdrop.className='e360-detail-backdrop';backdrop.dataset.e360DetailBackdrop='1';backdrop.hidden=true;document.body.appendChild(backdrop);backdrop.addEventListener('click',closeDrawer);}
    if(!drawer){drawer=document.createElement('aside');drawer.className='e360-detail-drawer';drawer.dataset.e360DetailDrawer='1';drawer.hidden=true;drawer.innerHTML='<div class="e360-detail-head"><div><span class="kicker" data-e360-detail-kicker>ENTIDAD 360</span><h3 data-e360-detail-title>Detalle</h3></div><button type="button" class="e360-detail-close" data-e360-detail-close aria-label="Cerrar detalle">×</button></div><div data-e360-detail-body></div>';document.body.appendChild(drawer);drawer.querySelector('[data-e360-detail-close]')?.addEventListener('click',closeDrawer);}
    return {backdrop,drawer,body:drawer.querySelector('[data-e360-detail-body]'),title:drawer.querySelector('[data-e360-detail-title]'),kicker:drawer.querySelector('[data-e360-detail-kicker]')};
  }
  function closeDrawer(){const d=document.querySelector('[data-e360-detail-drawer]'),b=document.querySelector('[data-e360-detail-backdrop]');if(d)d.hidden=true;if(b)b.hidden=true;document.documentElement.removeAttribute('data-e360-detail-open');}
  function openShell(title,kicker='ENTIDAD 360'){const x=ensureDrawer();x.title.textContent=title;x.kicker.textContent=kicker;x.body.innerHTML='<div class="e360-detail-loading">Consultando antecedentes materializados bajo la sesión actual…</div>';x.drawer.hidden=false;x.backdrop.hidden=false;document.documentElement.setAttribute('data-e360-detail-open','1');return x.body;}

  async function identity(id){
    if(CACHE.has('id:'+id))return CACHE.get('id:'+id);
    const c=db();if(!c)throw new Error('Sesión de datos no disponible');
    const m=await soft(c.from(MASTER).select('*').eq('entity_id',id).maybeSingle());
    const row=m.data||{entity_id:id};CACHE.set('id:'+id,row);return row;
  }
  async function taxProfile(id){
    const c=db();if(!c)return null;const r=await soft(c.from(TAX).select('*').eq('entity_id',id).maybeSingle());return r.data||null;
  }
  async function uafProfile(rut){
    const c=db();if(!c||!rut)return null;const variants=rutVariants(rut);if(!variants.length)return null;const r=await soft(c.from(UAF).select('*').in('rut',variants).limit(1).maybeSingle());return r.data||null;
  }

  async function sanctions(id){
    const body=openShell('Ficha sancionatoria','RADAR SANCIONATORIO');
    try{
      const c=db(),ident=await identity(id),rut=ident.rut||ident.res_rut||null;
      let r=await soft(c.from(SAN).select('*').eq('entity_id',id).order('event_date',{ascending:false}).limit(100));
      let rows=Array.isArray(r.data)?r.data:[];
      if(!rows.length&&rut){const variants=rutVariants(rut);r=await soft(c.from(SAN).select('*').in('rut',variants).order('event_date',{ascending:false}).limit(100));rows=Array.isArray(r.data)?r.data:[];}
      if(r.error)throw r.error;
      if(!rows.length){body.innerHTML=empty('No hay eventos sancionatorios materializados para esta identidad en el corte consultado.');return;}
      const direct=rows.filter(x=>String(x.event_class||'').toUpperCase().includes('SANC')||x.sanction_record===true).length;
      const docs=rows.filter(x=>safeUrl(x.document_url)).length;
      const ufTotal=rows.reduce((a,x)=>a+(num(x.amount_uf)||0),0);
      body.innerHTML=`<div class="e360-detail-summary"><div class="e360-detail-kpi"><span>Eventos</span><b>${fmt(rows.length)}</b></div><div class="e360-detail-kpi"><span>Con documento</span><b>${fmt(docs)}</b></div><div class="e360-detail-kpi"><span>Multas UF</span><b>${ufTotal?esc(uf(ufTotal)):'—'}</b></div></div><section class="e360-detail-section"><header><h4>Antecedentes materializados</h4><span>${fmt(direct)} registro(s) sancionatorio(s)</span></header><div class="e360-detail-list">${rows.map(x=>`<article class="e360-detail-item"><div class="row"><strong>${esc(x.regulator||x.event_kind||'Evento sancionatorio')}</strong><time>${esc(date(x.event_date))}</time></div><div class="meta">${chip(x.event_class||x.event_kind,'red')}${chip(x.current_condition||x.identity_status)}${x.amount_uf?chip(uf(x.amount_uf),'amber'):x.amount_clp?chip(money(x.amount_clp),'amber'):''}</div><p>${esc(clip(x.reason||'Motivo no materializado en este corte.'))}</p>${x.document_excerpt?`<p class="excerpt">${esc(clip(x.document_excerpt,700))}</p>`:''}<div class="meta">${x.resolution_ref?chip('Resolución '+x.resolution_ref):''}${x.evidence_id?chip('Evidencia '+x.evidence_id):''}${x.document_quality?chip(x.document_quality):''}</div>${link(x.document_url,'Abrir documento fuente')}</article>`).join('')}</div></section><p class="e360-detail-note">La ficha reproduce antecedentes materializados en el Radar Sancionatorio. Una sanción administrativa no acredita por sí sola LA/FT ni delito.</p>`;
    }catch(error){console.warn('[ATLAS E360] sanction drilldown',error);body.innerHTML='<div class="e360-detail-error">No fue posible consultar el detalle sancionatorio con la sesión actual.</div>';}
  }

  async function resDetail(id){
    const body=openShell('Ficha societaria RES','RES / EMPRESA EN UN DÍA');
    try{
      const c=db(),ident=await identity(id),rut=ident.rut||null,key=rutKey(rut);
      if(!key){body.innerHTML=empty('La entidad no tiene un RUT materializado que permita un cruce RES exacto.');return;}
      let companyRes=await soft(c.from(RES_COMPANY).select('*').eq('rut_key',key).limit(1).maybeSingle());
      const company=companyRes.data||null;
      const companyRut=company?.rut||rut;
      const [actsRes,relsRes,docsByEntity]=await Promise.all([
        soft(c.from(RES_ACT).select('*').eq('rut_key',key).order('actuation_date',{ascending:false}).limit(60)),
        soft(c.from(RES_REL).select('*').eq('company_rut',companyRut).order('valid_from',{ascending:false}).limit(80)),
        soft(c.from(RES_DOC).select('*').eq('entity_id',id).order('actuation_date',{ascending:false}).limit(60))
      ]);
      let docs=Array.isArray(docsByEntity.data)?docsByEntity.data:[];
      if(!docs.length){const d=await soft(c.from(RES_DOC).select('*').eq('company_rut_key',key).order('actuation_date',{ascending:false}).limit(60));docs=Array.isArray(d.data)?d.data:[];}
      const acts=Array.isArray(actsRes.data)?actsRes.data:[],rels=Array.isArray(relsRes.data)?relsRes.data:[];
      if(!company&&!acts.length&&!rels.length&&!docs.length){body.innerHTML=empty('No se materializó un vínculo RES exacto para esta identidad. Esto no afirma inexistencia fuera del corte disponible.');return;}
      body.innerHTML=`${company?`<div class="e360-detail-grid">${field('Razón social',company.legal_name||ident.name)}${field('RUT',company.rut||rut)}${field('Constitución',date(company.constitution_date))}${field('Aprobación SII',date(company.sii_approval_date))}${field('Capital',company.capital!=null?money(company.capital):'—')}${field('Comuna social',company.social_commune||company.tax_commune||'—')}${field('Código RES',company.company_code||'—')}${field('Última actualización',date(company.refreshed_at))}</div>`:''}<div class="e360-detail-summary"><div class="e360-detail-kpi"><span>Actuaciones</span><b>${fmt(acts.length)}</b></div><div class="e360-detail-kpi"><span>Relaciones</span><b>${fmt(rels.length)}</b></div><div class="e360-detail-kpi"><span>Documentos</span><b>${fmt(docs.length)}</b></div></div>${acts.length?`<section class="e360-detail-section"><header><h4>Actuaciones societarias</h4><span>Más recientes primero</span></header><div class="e360-detail-list">${acts.slice(0,20).map(x=>`<article class="e360-detail-item"><div class="row"><strong>${esc(x.actuation_type||'Actuación')}</strong><time>${esc(date(x.actuation_date||x.registry_date))}</time></div><div class="meta">${x.evidence_status?chip(x.evidence_status):''}${x.source_document_id?chip('Doc '+x.source_document_id):''}</div>${link(x.public_document_url,'Abrir documento RES')}</article>`).join('')}</div></section>`:''}${rels.length?`<section class="e360-detail-section"><header><h4>Relaciones materializadas</h4><span>${fmt(rels.length)} vínculo(s)</span></header><div class="e360-detail-table-wrap"><table class="e360-detail-table"><thead><tr><th>Relacionado</th><th>Rol</th><th>Participación</th><th>Vigencia</th></tr></thead><tbody>${rels.slice(0,40).map(x=>`<tr><td><b>${esc(x.related_name||x.related_rut||'—')}</b><br>${esc(x.related_rut||'')}</td><td>${esc(x.role_label||x.relationship_type||'—')}</td><td>${x.ownership_pct!=null?esc(String(x.ownership_pct)+'%'):'—'}</td><td>${esc(date(x.valid_from))}${x.valid_to?' → '+esc(date(x.valid_to)):''}</td></tr>`).join('')}</tbody></table></div></section>`:''}${docs.length?`<section class="e360-detail-section"><header><h4>Documentos y evidencia RES</h4><span>${fmt(docs.length)} materializado(s)</span></header><div class="e360-detail-list">${docs.slice(0,25).map(x=>`<article class="e360-detail-item"><div class="row"><strong>${esc(x.document_title||x.document_type||'Documento RES')}</strong><time>${esc(date(x.actuation_date||x.registry_date||x.submitted_at))}</time></div><div class="meta">${x.cve?chip('CVE '+x.cve):''}${x.review_status?chip(x.review_status):''}${x.extraction_status?chip(x.extraction_status):''}</div>${x.notes?`<p>${esc(clip(x.notes))}</p>`:''}${link(x.source_url,'Abrir documento fuente')}</article>`).join('')}</div></section>`:''}`;
    }catch(error){console.warn('[ATLAS E360] RES drilldown',error);body.innerHTML='<div class="e360-detail-error">No fue posible consultar el detalle RES con la sesión actual.</div>';}
  }

  async function spendDetail(id){
    const body=openShell('Ficha de compras públicas','COMPRAS PÚBLICAS');
    try{
      const c=db(),ident=await identity(id),rut=ident.rut||null,key=rutKey(rut);
      if(!key){body.innerHTML=empty('La entidad no tiene RUT materializado para buscar su actividad como proveedor.');return;}
      const [sumRes,ordersRes]=await Promise.all([
        soft(c.from(SPEND_SUM).select('*').eq('entity_id',id).limit(1).maybeSingle()),
        soft(c.from(SPEND_ORDERS).select('*').eq('supplier_key',key).order('order_date',{ascending:false}).limit(100))
      ]);
      if(ordersRes.error)throw ordersRes.error;
      const s=sumRes.data||{},rows=Array.isArray(ordersRes.data)?ordersRes.data:[];
      if(!rows.length&&!s.order_count){body.innerHTML=empty('No se materializó actividad como proveedor en el corte disponible. Esto no equivale a inexistencia fuera del corte.');return;}
      const buyerMap=new Map();rows.forEach(x=>buyerMap.set(x.buyer_name||x.buyer_key,(buyerMap.get(x.buyer_name||x.buyer_key)||0)+(num(x.clp_amount)||0)));
      const buyers=[...buyerMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
      body.innerHTML=`<div class="e360-detail-summary"><div class="e360-detail-kpi"><span>Monto materializado</span><b>${esc(money(s.total_clp??rows.reduce((a,x)=>a+(num(x.clp_amount)||0),0)))}</b></div><div class="e360-detail-kpi"><span>Órdenes</span><b>${fmt(s.order_count??rows.length)}</b></div><div class="e360-detail-kpi"><span>Compradores</span><b>${fmt(s.buyer_count??buyerMap.size)}</b></div></div>${buyers.length?`<section class="e360-detail-section"><header><h4>Principales compradores</h4><span>Sobre órdenes materializadas visibles</span></header><div class="e360-detail-list">${buyers.map(([name,amount])=>`<article class="e360-detail-item"><div class="row"><strong>${esc(name)}</strong><b>${esc(money(amount))}</b></div></article>`).join('')}</div></section>`:''}${rows.length?`<section class="e360-detail-section"><header><h4>Órdenes recientes</h4><span>Hasta 100 registros</span></header><div class="e360-detail-table-wrap"><table class="e360-detail-table"><thead><tr><th>Fecha</th><th>Orden</th><th>Comprador</th><th>Mecanismo</th><th>Monto</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(date(x.order_date))}</td><td><b>${esc(x.order_id||'—')}</b></td><td>${esc(x.buyer_name||x.buyer_key||'—')}</td><td>${esc(x.mechanism||x.status||'—')}</td><td>${esc(money(x.clp_amount))}</td></tr>`).join('')}</tbody></table></div></section>`:''}<p class="e360-detail-note">La presencia en compras públicas no implica irregularidad. La ficha expone únicamente órdenes materializadas en el corte disponible.</p>`;
    }catch(error){console.warn('[ATLAS E360] public spend drilldown',error);body.innerHTML='<div class="e360-detail-error">No fue posible consultar el detalle de compras públicas con la sesión actual.</div>';}
  }

  async function evidenceDetail(id){
    const body=openShell('Trazabilidad documental','DOCUMENTOS Y EVIDENCIA');
    try{
      const c=db(),ident=await identity(id),rut=ident.rut||null,key=rutKey(rut);
      const [uaf,docsRes,sanRes]=await Promise.all([
        uafProfile(rut),
        soft(c.from(RES_DOC).select('*').eq('entity_id',id).order('actuation_date',{ascending:false}).limit(50)),
        soft(c.from(SAN).select('event_id,event_date,regulator,resolution_ref,evidence_id,document_url,document_quality,document_excerpt').eq('entity_id',id).order('event_date',{ascending:false}).limit(50))
      ]);
      let resDocs=Array.isArray(docsRes.data)?docsRes.data:[];
      if(!resDocs.length&&key){const d=await soft(c.from(RES_DOC).select('*').eq('company_rut_key',key).order('actuation_date',{ascending:false}).limit(50));resDocs=Array.isArray(d.data)?d.data:[];}
      const sanDocs=(Array.isArray(sanRes.data)?sanRes.data:[]).filter(x=>x.evidence_id||x.resolution_ref||x.document_url);
      const uafIds=Array.isArray(uaf?.source_document_ids)?uaf.source_document_ids:(uaf?.source_document_ids?[uaf.source_document_ids]:[]);
      if(!uafIds.length&&!resDocs.length&&!sanDocs.length&&!uaf?.source_ref){body.innerHTML=empty('No hay identificadores documentales materializados para esta identidad en las fuentes ejecutivas consultadas.');return;}
      body.innerHTML=`${uaf?`<section class="e360-detail-section"><header><h4>UAF</h4><span>Trazabilidad de la fuente materializada</span></header><div class="e360-detail-grid">${field('Clase de registro',uaf.registry_class||'—')}${field('Ámbito fuente',uaf.source_scope||'—')}${field('Referencia fuente',uaf.source_ref||'—')}${field('Actualización',date(uaf.updated_at))}</div>${uafIds.length?`<div class="e360-detail-list">${uafIds.map((x,i)=>`<article class="e360-detail-item"><div class="row"><strong>Documento UAF ${i+1}</strong><code>${esc(x)}</code></div></article>`).join('')}</div>`:''}</section>`:''}${sanDocs.length?`<section class="e360-detail-section"><header><h4>Radar sancionatorio</h4><span>${fmt(sanDocs.length)} evidencia(s)</span></header><div class="e360-detail-list">${sanDocs.map(x=>`<article class="e360-detail-item"><div class="row"><strong>${esc(x.regulator||'Antecedente sancionatorio')}</strong><time>${esc(date(x.event_date))}</time></div><div class="meta">${x.resolution_ref?chip('Resolución '+x.resolution_ref):''}${x.evidence_id?chip('Evidencia '+x.evidence_id):''}${x.document_quality?chip(x.document_quality):''}</div>${x.document_excerpt?`<p class="excerpt">${esc(clip(x.document_excerpt,600))}</p>`:''}${link(x.document_url,'Abrir documento fuente')}</article>`).join('')}</div></section>`:''}${resDocs.length?`<section class="e360-detail-section"><header><h4>RES</h4><span>${fmt(resDocs.length)} documento(s)</span></header><div class="e360-detail-list">${resDocs.slice(0,30).map(x=>`<article class="e360-detail-item"><div class="row"><strong>${esc(x.document_title||x.document_type||'Documento RES')}</strong><time>${esc(date(x.actuation_date||x.registry_date))}</time></div><div class="meta">${x.cve?chip('CVE '+x.cve):''}${x.review_status?chip(x.review_status):''}</div>${link(x.source_url,'Abrir documento fuente')}</article>`).join('')}</div></section>`:''}<p class="e360-detail-note">Los identificadores UAF se muestran sólo cuando están materializados. ATLAS no construye URLs ni documentos que la fuente no haya entregado.</p>`;
    }catch(error){console.warn('[ATLAS E360] evidence drilldown',error);body.innerHTML='<div class="e360-detail-error">No fue posible consultar la trazabilidad documental con la sesión actual.</div>';}
  }

  async function goBack(){
    closeDrawer();
    const ret=window.__ATLAS_E360_RETURN__||{};
    const states=[];try{if(typeof state!=='undefined'&&state)states.push(state);}catch(_e){};if(window.state)states.push(window.state);if(window.amlState)states.push(window.amlState);
    [...new Set(states)].forEach(s=>{try{s.view='entities';s.selectedEntity=null;if('entityId'in s)s.entityId=null;if('selectedEntityId'in s)s.selectedEntityId=null;}catch(_e){}});
    try{
      const entry=window.__ATLAS_ENTITY_ENTRY__;
      if(entry?.load){await entry.load();setTimeout(()=>{const q=ret.query||'';const input=document.querySelector('#aex-q,#a47-entity-q,#entity-q');if(input&&q){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));}input?.focus?.();},50);return;}
      if(typeof window.navigate==='function'){await window.navigate('entities');return;}
      window.history.back();
    }catch(error){console.warn('[ATLAS E360] back navigation',error);if(typeof window.navigate==='function')window.navigate('entities');}
  }

  function captureReturn(){
    const q=document.querySelector('#aex-q,#a47-entity-q,#entity-q')?.value||'';
    window.__ATLAS_E360_RETURN__={view:String(currentState()?.view||'entities'),query:String(q),capturedAt:new Date().toISOString()};
  }
  function hookEntry(){
    const entry=window.__ATLAS_ENTITY_ENTRY__;if(!entry||typeof entry.open!=='function'||entry.open.__atlasE360ReturnHook)return false;
    const base=entry.open.bind(entry);
    const wrapped=async(...args)=>{captureReturn();return base(...args);};
    Object.defineProperty(wrapped,'__atlasE360ReturnHook',{value:true});entry.open=wrapped;return true;
  }

  function replaceAction(card,key){
    if(!card)return;
    card.classList.add('e360-detail-card');card.dataset.e360DetailCard=key;card.tabIndex=0;card.setAttribute('role','button');
    const old=card.querySelector('header button');if(old){const b=old.cloneNode(true);b.removeAttribute('data-e360-lens');b.dataset.e360Detail=key;b.textContent='Ver detalle';old.replaceWith(b);}
    if(key==='evidence')card.querySelectorAll('.eh-secondary').forEach(old=>{const b=old.cloneNode(true);b.removeAttribute('data-e360-lens');b.dataset.e360Detail=key;b.innerHTML='Ver evidencia completa <span>↗</span>';old.replaceWith(b);});
  }
  function dispatchDetail(key,id){if(!id)return;if(key==='sanctions')return sanctions(id);if(key==='res')return resDetail(id);if(key==='spend')return spendDetail(id);if(key==='evidence')return evidenceDetail(id);}

  function decorate(root=host()){
    if(!root)return false;ensureCss();formatSales(root);
    if(!root.querySelector('.e360-detail-toolbar')){const bar=document.createElement('div');bar.className='e360-detail-toolbar';bar.innerHTML='<button type="button" class="e360-back-btn" data-e360-back>← Volver</button><small>Regresa al explorador anterior de Entidades</small>';root.insertBefore(bar,root.firstChild);}
    replaceAction(root.querySelector('.eh-card.eh-san'),'sanctions');
    replaceAction(root.querySelector('.eh-card.eh-res'),'res');
    replaceAction(root.querySelector('.eh-card.eh-spend'),'spend');
    replaceAction(root.querySelector('.eh-card.eh-docs'),'evidence');
    if(!root.dataset.e360DetailBound){
      root.dataset.e360DetailBound='1';
      root.addEventListener('click',event=>{
        const back=event.target.closest('[data-e360-back]');if(back){event.preventDefault();event.stopPropagation();void goBack();return;}
        const action=event.target.closest('[data-e360-detail]');if(action){event.preventDefault();event.stopPropagation();void dispatchDetail(action.dataset.e360Detail,entityId());return;}
        const card=event.target.closest('[data-e360-detail-card]');if(card&&!event.target.closest('a,button,input,select,textarea')){event.preventDefault();void dispatchDetail(card.dataset.e360DetailCard,entityId());}
      },true);
      root.addEventListener('keydown',event=>{const card=event.target.closest('[data-e360-detail-card]');if(card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();void dispatchDetail(card.dataset.e360DetailCard,entityId());}});
    }
    return true;
  }

  let timer=null,observer=null,hookTimer=null,hookAttempts=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>decorate(host()),30);}
  function install(){
    ensureCss();hookEntry();decorate(host());
    const app=document.querySelector('#app')||document.body;
    if(app&&!observer){observer=new MutationObserver(schedule);observer.observe(app,{childList:true,subtree:true});}
    ['atlas:entity-workspace-ready','atlas:entity-entry-ready'].forEach(name=>document.addEventListener(name,()=>{hookEntry();schedule();}));
    hookTimer=setInterval(()=>{hookAttempts++;hookEntry();if(hookAttempts>24){clearInterval(hookTimer);hookTimer=null;}},500);
  }

  const API={build:BUILD,decorate,openSanctions:sanctions,openRes:resDetail,openSpend:spendDetail,openEvidence:evidenceDetail,close:closeDrawer,back:goBack};
  window.__ATLAS_ENTITY360_DRILLDOWN_20260904__=API;
  window.AtlasEntity360Drilldown=API;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
