'use strict';

/* AML Workbench v0.19.2 · SO 360 + supervisory explorer
 * Keeps the v0.19.1 analytical layer, but rebuilds Entity 360 around:
 *  - SO inscrito en la UAF
 *  - direct radar coverage
 *  - regional context kept separate from individual evidence
 *  - visible help for IBS / IAT / IPA and UAF status
 */

const V0192='0.19.2';
const v0192BaseLoadUaf=v019LoadUaf;
const v0192BaseLoadTerritory=v019LoadTerritory;
let V0192_SO_CACHE=[];

const V0192_RADARS=[
  ['RADAR_UAF','UAF'],['RADAR_SII','SII'],['RADAR_CGR','CGR'],['RADAR_SANCIONES','Sanciones'],
  ['PRESUPUESTO_ABIERTO','Presupuesto'],['RADAR_DELICTUAL','Delictual'],['RADAR_OSFL','OSFL'],['RADAR_PRENSA','Prensa']
];

function v0192HelpButton(label,title,html){return `<span class="v0192-help-term"><b>${esc(label)}</b>${v17InfoButton(title,html,true)}</span>`;}
function v0192HelpSO(){return v0192HelpButton('SO inscrito en la UAF','Qué significa SO inscrito en la UAF',`<div class="v0192-help-copy"><p><strong>SO</strong> significa Sujeto Obligado. En esta herramienta la etiqueta <strong>SO inscrito en la UAF</strong> identifica una entidad cuya identidad fue vinculada con la nómina pública integrada de sujetos obligados de la UAF.</p><p>Esta condición describe cobertura de fuente y condición regulatoria. <strong>No es un score AML ni una evaluación de conducta.</strong></p></div>`);}
function v0192HelpIBS(){return v0192HelpButton('IBS','IBS · Índice de Brecha Supervisiva',`<div class="v0192-help-copy"><p><strong>IBS</strong> ordena territorios para revisar posibles brechas entre SO inscritos en la UAF y pares RUT–actividad que las reglas de screening consideran candidatos.</p><div class="formula-box"><code>IBS = 30% densidad relativa + 50% volumen log-normalizado + 20% amplitud sectorial</code></div><p>Los candidatos son pares RUT–actividad, no personas jurídicas únicas. Por eso IBS <strong>no mide incumplimiento</strong> ni permite afirmar que una entidad esté legalmente no inscrita.</p></div>`);}
function v0192HelpIAT(){return v0192HelpButton('IAT','IAT · Índice de Atención Territorial',`<div class="v0192-help-copy"><p><strong>IAT</strong> prioriza regiones usando hallazgos estructurados de Fusion.</p><div class="formula-box"><code>IAT = 65% P90 de prioridad investigativa + 25% volumen relativo de hallazgos ≥60 + 10% diversidad media de fuentes</code></div><p>Sirve para decidir dónde profundizar. <strong>No es incidencia LA/FT ni probabilidad de delito.</strong></p></div>`);}
function v0192HelpIPA(){return v0192HelpButton('IPA','IPA · Índice de Prioridad Analítica',`<div class="v0192-help-copy"><p><strong>IPA</strong> es un índice de priorización que combina hechos observables y factores explicables como independencia de fuentes, fuerza de regla, recurrencia, contexto relacional y amplitud de evidencia.</p><p>Su objetivo es ordenar trabajo analítico. <strong>No representa probabilidad de LA/FT, culpabilidad o incumplimiento.</strong></p></div>`);}
function v0192Glossary(){return `<div class="v0192-glossary"><span>Ayuda:</span>${v0192HelpSO()}${v0192HelpIBS()}${v0192HelpIAT()}${v0192HelpIPA()}</div>`;}

function v0192ProducerSet(e,findings=[]){
  const out=new Set();
  v019Array(e?.profile?.fuentes).forEach(x=>out.add(String(x)));
  findings.forEach(f=>v019Array(f?.payload?.producer_ids).forEach(x=>out.add(String(x))));
  if(e?.is_uaf_observed)out.add('RADAR_UAF');
  return out;
}
function v0192HasProducer(set,id){
  if(set.has(id))return true;
  const alias={PRESUPUESTO_ABIERTO:['RADAR_PRESUPUESTO_ABIERTO','PRESUPUESTO'],RADAR_SANCIONES:['SANCIONES'],RADAR_PRENSA:['PRENSA']};
  return (alias[id]||[]).some(x=>set.has(x));
}
function v0192Sector(e,findings=[],tax=null){
  const fromFind=findings.flatMap(f=>v019Array(f?.payload?.sector_names)).find(Boolean);
  return fromFind||tax?.economic_sector||tax?.main_activity||e?.profile?.contexto?.sector_uaf||'Sector no materializado';
}
function v0192MaxInvestigate(findings=[]){const vals=findings.map(f=>Number(f.score_investigate)).filter(Number.isFinite);return vals.length?Math.max(...vals):null;}
function v0192SalesBand(tax){if(!tax)return 'Sin perfil SII';const code=Number(tax.sales_band_code||tax.sales_band_rank||tax.sales_band);return SALES_BAND_V16?.[code]||tax.sales_band||`Tramo ${code||'—'}`;}

function v0192RadarMatrix(e,findings,sanctions,tax){
  const producers=v0192ProducerSet(e,findings);
  const counts=new Map();
  findings.forEach(f=>v019Array(f?.payload?.producer_ids).forEach(id=>counts.set(String(id),(counts.get(String(id))||0)+1)));
  const cards=V0192_RADARS.map(([id,label])=>{
    let active=v0192HasProducer(producers,id),detail='Sin dato directo materializado';
    if(id==='RADAR_UAF'){active=Boolean(e.is_uaf_observed);detail=active?'SO inscrito en la UAF':'Sin condición SO inscrito UAF materializada';}
    else if(id==='RADAR_SII'){active=Boolean(tax)||active;detail=tax?`${tax.commercial_year||'—'} · ${v0192SalesBand(tax)}`:(active?'Presencia en Radar SII':'Sin perfil SII materializado');}
    else if(id==='RADAR_SANCIONES'){active=sanctions.length>0||active;detail=sanctions.length?`${v019Fmt(sanctions.length)} evento(s) vinculado(s)`:(active?'Presencia en radar':'Sin sanción vinculada');}
    else if(active){detail=`Dato directo · ${v019Fmt(counts.get(id)||0)} hallazgo(s) asociado(s)`;}
    return `<div class="v0192-radar ${active?'active':'inactive'}"><span class="dot"></span><div><b>${esc(label)}</b><small>${esc(detail)}</small></div></div>`;
  }).join('');
  return `<div class="v0192-radar-grid">${cards}</div>`;
}

function v0192TaxSummary(tax){
  if(!tax)return `<div class="v0192-empty-light"><b>Perfil SII no materializado para este Entity ID.</b><span>Esto no significa ausencia de información en la fuente de origen.</span></div>`;
  return `<div class="v0192-tax-grid"><div><span>Año comercial</span><b>${esc(tax.commercial_year||'—')}</b></div><div><span>Tramo de ventas</span><b>${esc(v0192SalesBand(tax))}</b></div><div><span>Trabajadores</span><b>${esc(tax.workers_numeric??'—')}</b></div><div><span>Actividad principal</span><b>${esc(tax.main_activity||'—')}</b></div><div><span>Sector económico</span><b>${esc(tax.economic_sector||'—')}</b></div><div><span>Estado</span><b>${esc(tax.current_status||'—')}</b></div><div><span>Actividades</span><b>${esc(tax.activity_count??'—')}</b></div><div><span>Domicilios históricos</span><b>${esc(tax.address_count??'—')}</b></div></div>`;
}

function v0192Relations(rows=[]){
  if(!rows.length)return `<div class="v0192-empty-light"><b>Sin relaciones materializadas.</b><span>La ausencia de relaciones en esta capa no implica que no existan en las fuentes.</span></div>`;
  return `<div class="v0192-relations">${rows.slice(0,10).map(r=>`<div><b>${esc(r.contraparte_nombre||r.contraparte_id||'Contraparte')}</b><span>${esc(r.tipo_es||r.tipo||'Relación')} · ${esc(r.sentido_es||'')}</span></div>`).join('')}</div>`;
}

function v0192RegionContextPlaceholder(region){return `<section class="v0192-block v0192-region-block"><div class="v0192-block-head"><div><span>Contexto territorial</span><h3>${esc(v019RegionShort(region||'Sin región'))}</h3></div>${v0192HelpIAT()}${v0192HelpIBS()}</div><div id="v0192-region-context"><div class="v019-loading">Consultando contexto regional…</div></div></section>`;}

async function v0192InjectRegionContext(e){
  const host=document.querySelector('#v0192-region-context');if(!host)return;
  try{
    const core=await v019LoadCore();const region=v019RegionNorm(e.region),r=core.regions.find(x=>v019RegionNorm(x.region)===region),g=core.gaps.find(x=>v019RegionNorm(x.region)===region),u=core.uafRegions.find(x=>v019RegionNorm(x.region)===region),econ=v0191EconRegion(core,region),patterns=core.patterns.filter(p=>p.scope_type==='REGION'&&v019RegionNorm(p.scope_label)===region).slice(0,3);
    host.innerHTML=`<div class="v0192-region-kpis"><div><span>IAT</span><b>${r?.attention_index!=null?v019Fmt(r.attention_index,1):'—'}</b><small>atención territorial</small></div><div><span>IBS</span><b>${g?.gap_attention_index!=null?v019Fmt(g.gap_attention_index,1):'—'}</b><small>brecha de screening</small></div><div><span>SO inscritos UAF</span><b>${v019Fmt(u?.uaf_observed)}</b><small>en la región</small></div><div><span>Empresas-año SII 2024</span><b>${econ?v019Fmt(econ):'—'}</b><small>contexto económico</small></div></div>${patterns.length?`<div class="v0192-region-patterns"><b>Patrones regionales disponibles</b>${patterns.map(p=>`<div><span>${esc(p.title||p.pattern_type)}</span><strong>${v019Fmt(p.strength,1)}</strong></div>`).join('')}</div>`:'<div class="v0192-empty-light"><span>Sin patrones regionales materializados en este corte.</span></div>'}<div class="v0192-context-guard">Este bloque describe la región. <strong>No se atribuye automáticamente al SO individual.</strong></div>${e.region?'<button type="button" class="v0192-link-btn" id="v0192-open-region">Abrir análisis territorial</button>':''}`;
    document.querySelector('#v0192-open-region')?.addEventListener('click',()=>v019LoadTerritory(region));
  }catch(err){host.innerHTML=`<div class="v019-error">${esc(err?.message||String(err))}</div>`;}
}

v16RenderEntity=function(e,findings,sanctions,directPatterns,tax,sector,reporting,sectorPatterns){
  V17_ENTITY_CACHE=v17NormalizeEntityPackage(e,findings,sanctions,directPatterns,tax,sector,reporting,sectorPatterns);
  const profile=e.profile||{},obliged=Boolean(e.is_uaf_observed||profile.contexto?.sujeto_obligado===true||(profile.roles||[]).includes('OBLIGED_ENTITY'));
  const evidenceCount=findings.reduce((a,r)=>a+Number(r.evidence_count||0),0),maxInvestigate=v0192MaxInvestigate(findings),sectorLabel=v0192Sector(e,findings,tax),producers=v0192ProducerSet(e,findings);
  content().innerHTML=`<div class="v0192-entity360">
    <div class="v0192-entity-actions"><button type="button" class="v0192-link-btn" id="back-entities">← Volver</button><button type="button" class="v0192-link-btn secondary" id="export-entity">Exportar JSON normalizado</button></div>
    <section class="v0192-entity-hero">
      <div class="v0192-hero-main"><span class="v0192-kicker">SO 360 · inteligencia integrada</span><h2>${esc(e.name||'Entidad')}</h2><div class="v0192-identity-line"><b>${esc(e.rut||'RUT no informado')}</b><span>${esc(e.entity_id)}</span></div><div class="v0192-badges">${obliged?'<span class="v0192-badge so">SO inscrito en la UAF</span>':'<span class="v0192-badge neutral">Sin condición SO inscrito UAF materializada</span>'}${e.is_sanctioned?'<span class="v0192-badge warn">Con evento sancionatorio</span>':''}<span class="v0192-badge">${v019Fmt(e.source_count)} fuentes</span><span class="v0192-badge">${esc(v019RegionShort(e.region))}</span></div></div>
      <div class="v0192-hero-priority"><span>Prioridad máxima para investigar</span><b>${maxInvestigate==null?'—':v019Fmt(maxInvestigate,1)}</b><small>${v0192HelpIPA()}</small></div>
    </section>
    <div class="v0192-summary-grid"><div><span>Hallazgos</span><b>${v019Fmt(findings.length)}</b><small>vinculados por Entity ID</small></div><div><span>Sanciones</span><b>${v019Fmt(sanctions.length)}</b><small>eventos resueltos</small></div><div><span>Evidencias</span><b>${v019Fmt(evidenceCount)}</b><small>referencias de hallazgos</small></div><div><span>Radares con dato directo</span><b>${v019Fmt(V0192_RADARS.filter(([id])=>id==='RADAR_UAF'?obliged:v0192HasProducer(producers,id)||(id==='RADAR_SII'&&tax)||(id==='RADAR_SANCIONES'&&sanctions.length)).length)}</b><small>cobertura materializada</small></div></div>
    <div class="v0192-two-col">
      <section class="v0192-block"><div class="v0192-block-head"><div><span>Cobertura directa</span><h3>Qué radares saben algo de este SO</h3></div>${v0192HelpSO()}</div>${v0192RadarMatrix(e,findings,sanctions,tax)}<div class="v0192-context-guard">“Con dato directo” significa información vinculada al mismo Entity ID. El contexto regional se muestra por separado.</div></section>
      <section class="v0192-block"><div class="v0192-block-head"><div><span>Caracterización regulatoria</span><h3>${esc(sectorLabel)}</h3></div></div><div class="v0192-reg-status">${obliged?'<b>SO inscrito en la UAF</b><span>Condición materializada desde el universo público integrado UAF.</span>':'<b>Condición UAF no materializada</b><span>No se utiliza para afirmar ausencia de obligación legal.</span>'}</div>${reporting?`<div class="v0192-report-grid"><div><span>ROS</span><b>${reporting.ros_required?'Aplicable':'No materializado'}</b><small>${esc(reporting.ros_trigger||'')}</small></div><div><span>ROE</span><b>${reporting.roe_required?esc(reporting.roe_frequency||'Aplicable'):'No aplicable/materializado'}</b><small>${esc(reporting.roe_deadline||'')}</small></div></div>`:'<div class="v0192-empty-light"><span>Regla detallada de reportabilidad no materializada para este sector.</span></div>'}</section>
    </div>
    <div class="v0192-two-col">
      <section class="v0192-block"><div class="v0192-block-head"><div><span>Radar SII</span><h3>Caracterización económica y tributaria</h3></div></div>${v0192TaxSummary(tax)}</section>
      ${v0192RegionContextPlaceholder(e.region)}
    </div>
    <div class="v0192-two-col">
      <section class="v0192-block"><div class="v0192-block-head"><div><span>Relaciones</span><h3>Vínculos observados</h3></div></div>${v0192Relations(profile.relaciones||[])}</section>
      <section class="v0192-block"><div class="v0192-block-head"><div><span>Trazabilidad</span><h3>Identidad y evidencia</h3></div></div><div class="v0192-trace"><div><span>Método de identidad</span><b>${esc(profile.identity_method_es||'Identidad Fusion')}</b></div><div><span>Confianza de identidad</span><b>${profile.identity_confidence!=null?Math.round(Number(profile.identity_confidence)*100)+'%':'No informada'}</b></div><div><span>Snapshot</span><b>${esc(e.snapshot_id||'—')}</b></div><div><span>Actualizado</span><b>${esc(fmtDateTime(e.updated_at))}</b></div></div></section>
    </div>
    <section class="v0192-detail-panel"><div class="v0192-panel-head"><div><span>Señales de entidad</span><h3>Hallazgos explicados</h3></div><b>${v019Fmt(findings.length)}</b></div>${v17FindingCards(findings,'investigate',false)}</section>
    <section class="v0192-detail-panel"><div class="v0192-panel-head"><div><span>Contexto regulatorio</span><h3>Sanciones vinculadas</h3></div><b>${v019Fmt(sanctions.length)}</b></div>${v16SanctionCards(sanctions,e.name)}</section>
    <section class="v0192-detail-panel"><div class="v0192-panel-head"><div><span>Pattern Intelligence</span><h3>Fenómenos directos y contexto sectorial</h3></div><b>${v019Fmt(directPatterns.length+sectorPatterns.length)}</b></div><h4 class="v0192-subhead">Directos al Entity ID</h4>${directPatterns.length?v17PatternCards(directPatterns):'<div class="v0192-empty-light"><span>Sin fenómenos directos materializados.</span></div>'}<h4 class="v0192-subhead">Contexto del sector · no atribución</h4>${sectorPatterns.length?v17PatternCards(sectorPatterns,true):'<div class="v0192-empty-light"><span>Sin patrones sectoriales materializados.</span></div>'}</section>
    <div class="v0192-footer-guard">Entidad = hechos directos trazables. Sector, territorio y red aportan contexto, pero <strong>no transfieren riesgo automáticamente al SO.</strong></div>
  </div>`;
  document.querySelector('#back-entities')?.addEventListener('click',loadEntities);
  document.querySelector('#export-entity')?.addEventListener('click',async()=>{if(!V17_ENTITY_CACHE)return;await audit('EXPORT',{objectType:'entity_package',objectId:e.entity_id,payload:{format:'json',schema:'AML_ANALYST_TRANSFER_V1'}});v17Download(`aml_entity_${String(e.rut||e.entity_id).replace(/[^0-9A-Za-zKk-]/g,'_')}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(V17_ENTITY_CACHE,null,2),'application/json;charset=utf-8');});
  v0192InjectRegionContext(e);
};

async function v0192FetchSO(limit=100){
  const entityRes=await sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,profile').eq('is_uaf_observed',true).order('source_count',{ascending:false}).limit(limit);
  if(entityRes.error)throw entityRes.error;const entities=entityRes.data||[],ids=entities.map(e=>e.entity_id).filter(Boolean);if(!ids.length)return [];
  const [findRes,taxRes,sancRes]=await Promise.all([
    sb.from('aml_findings').select('entity_id,finding_type,score_investigate,source_count,evidence_count,payload').in('entity_id',ids).limit(2000),
    sb.from('aml_entity_tax_profile').select('entity_id,commercial_year,sales_band_code,sales_band_rank,sales_band,workers_numeric,main_activity,economic_sector,current_status,activity_count,address_count').in('entity_id',ids).limit(limit*2),
    sb.from('aml_sanctions').select('entity_id,sanction_id,regulator,event_date,laft_direct').in('entity_id',ids).limit(1000)
  ]);
  for(const r of [findRes,taxRes,sancRes])if(r.error)throw r.error;
  const byFind=new Map(),byTax=new Map(),bySanc=new Map();
  (findRes.data||[]).forEach(x=>{if(!byFind.has(x.entity_id))byFind.set(x.entity_id,[]);byFind.get(x.entity_id).push(x);});
  (taxRes.data||[]).forEach(x=>{const prev=byTax.get(x.entity_id);if(!prev||v019Num(x.commercial_year)>v019Num(prev.commercial_year))byTax.set(x.entity_id,x);});
  (sancRes.data||[]).forEach(x=>{if(!bySanc.has(x.entity_id))bySanc.set(x.entity_id,[]);bySanc.get(x.entity_id).push(x);});
  return entities.map(e=>{const findings=byFind.get(e.entity_id)||[],tax=byTax.get(e.entity_id)||null,sanctions=bySanc.get(e.entity_id)||[],sources=v0192ProducerSet(e,findings);return {e,findings,tax,sanctions,sources,sector:v0192Sector(e,findings,tax),max:v0192MaxInvestigate(findings)};});
}

function v0192SORow(r){
  const sourceLabels=V0192_RADARS.filter(([id])=>id==='RADAR_UAF'||v0192HasProducer(r.sources,id)||(id==='RADAR_SII'&&r.tax)||(id==='RADAR_SANCIONES'&&r.sanctions.length)).map(([,label])=>label);
  return `<article class="v0192-so-card" data-so-entity="${esc(r.e.entity_id)}"><div class="v0192-so-id"><div class="v0192-so-title"><span class="v0192-badge so">SO inscrito en la UAF</span>${r.e.is_sanctioned?'<span class="v0192-badge warn">Sanción</span>':''}</div><h3>${esc(r.e.name||'Sin nombre')}</h3><p>${esc(r.e.rut||'RUT no informado')} · ${esc(v019RegionShort(r.e.region))}${r.e.commune?` · ${esc(r.e.commune)}`:''}</p></div><div class="v0192-so-char"><span>Caracterización</span><b>${esc(v019Truncate(r.sector,50))}</b><small>${r.tax?`${esc(v019Truncate(r.tax.main_activity||'',42))} · ${esc(v0192SalesBand(r.tax))}`:'Sin perfil tributario compacto'}</small></div><div class="v0192-so-radars"><span>Radares con dato</span><div>${sourceLabels.slice(0,6).map(x=>`<i>${esc(x)}</i>`).join('')}</div></div><div class="v0192-so-signals"><span>Señales</span><b>${v019Fmt(r.findings.length)} hallazgos · ${v019Fmt(r.sanctions.length)} sanciones</b><small>${r.max!=null?`Prioridad investigar máx. ${v019Fmt(r.max,1)}`:'Sin IPA materializado'}</small></div><button type="button" class="v0192-open-so" data-open-so="${esc(r.e.entity_id)}">Abrir SO 360 →</button></article>`;
}

function v0192RenderSOList(){
  const host=document.querySelector('#v0192-so-list');if(!host)return;const q=(document.querySelector('#v0192-so-search')?.value||'').trim().toLowerCase(),region=document.querySelector('#v0192-so-region')?.value||'',sector=document.querySelector('#v0192-so-sector')?.value||'';
  const rows=V0192_SO_CACHE.filter(r=>(!q||`${r.e.name||''} ${r.e.rut||''}`.toLowerCase().includes(q))&&(!region||v019RegionNorm(r.e.region)===region)&&(!sector||r.sector===sector));
  host.innerHTML=rows.length?rows.map(v0192SORow).join(''):`<div class="v0192-empty-light"><b>Sin SO inscritos que coincidan con los filtros.</b></div>`;
  document.querySelector('#v0192-so-count').textContent=`${v019Fmt(rows.length)} mostrados`;
  host.querySelectorAll('[data-open-so]').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();v019LegacyOpenEntity?.(b.dataset.openSo);}));
  host.querySelectorAll('[data-so-entity]').forEach(card=>card.addEventListener('click',()=>v019LegacyOpenEntity?.(card.dataset.soEntity)));
}

async function v0192AppendSOExplorer(){
  const grid=v019Content()?.querySelector('.v019-grid');if(!grid)return;
  const panel=document.createElement('article');panel.className='v019-card v019-full v0192-so-explorer';panel.innerHTML=`<div class="v019-card-head"><div><h2>SO inscritos en la UAF · explorador de entidades</h2><p>Seleccione un sujeto obligado para ver qué información directa aportan los radares y qué contexto existe para su región.</p></div><span class="hint" id="v0192-so-count">cargando…</span></div>${v0192Glossary()}<div class="v0192-so-controls"><input type="search" id="v0192-so-search" placeholder="Buscar SO por nombre o RUT"><select id="v0192-so-region"><option value="">Todas las regiones</option></select><select id="v0192-so-sector"><option value="">Todos los sectores</option></select></div><div id="v0192-so-list"><div class="v019-loading">Consultando SO inscritos y su caracterización…</div></div><div class="v019-note"><b>Uso analítico:</b> el listado prioriza caracterización y cobertura de radares. Al abrir un SO, el bloque “Cobertura directa” muestra datos vinculados a su Entity ID y el bloque “Contexto territorial” mantiene separada la información de su región.</div>`;
  grid.prepend(panel);
  try{
    V0192_SO_CACHE=await v0192FetchSO(100);
    const regions=[...new Set(V0192_SO_CACHE.map(r=>v019RegionNorm(r.e.region)).filter(x=>x&&x!=='Sin región'))].sort((a,b)=>a.localeCompare(b,'es'));
    const sectors=[...new Set(V0192_SO_CACHE.map(r=>r.sector).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const regSel=document.querySelector('#v0192-so-region'),secSel=document.querySelector('#v0192-so-sector');regions.forEach(x=>regSel.insertAdjacentHTML('beforeend',`<option value="${esc(x)}">${esc(v019RegionShort(x))}</option>`));sectors.forEach(x=>secSel.insertAdjacentHTML('beforeend',`<option value="${esc(x)}">${esc(v019Truncate(x,55))}</option>`));
    document.querySelector('#v0192-so-search').addEventListener('input',v0192RenderSOList);regSel.addEventListener('change',v0192RenderSOList);secSel.addEventListener('change',v0192RenderSOList);v0192RenderSOList();
  }catch(err){document.querySelector('#v0192-so-list').innerHTML=`<div class="v019-error">${esc(err?.message||String(err))}</div>`;}
}

v019LoadUaf=async function(selectedRegion=''){
  await v0192BaseLoadUaf(selectedRegion);
  const shellTitle=document.querySelector('.v019-title h1');const shellSub=document.querySelector('.v019-title p');if(shellTitle)shellTitle.textContent='Supervisión UAF · SO inscritos';if(shellSub)shellSub.textContent='Explora sujetos obligados inscritos en la UAF, su caracterización, cobertura de radares y brechas de screening con ayuda metodológica.';
  await v0192AppendSOExplorer();
};

v019LoadTerritory=async function(initial=''){
  await v0192BaseLoadTerritory(initial);
  const contentEl=v019Content();if(contentEl&&!contentEl.querySelector('.v0192-glossary'))contentEl.insertAdjacentHTML('afterbegin',v0192Glossary());
};

/* Keep navigation calling the new wrapped functions. */
loadOverview=v019LoadOverview;

(function v0192Badge(){const apply=()=>{const s=document.querySelector('.v019-brand small');if(s)s.textContent=`Operational Radar · v${V0192}`;};setInterval(apply,1200);setTimeout(apply,50);})();
