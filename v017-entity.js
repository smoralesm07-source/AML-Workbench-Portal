function v17NormalizeEntityPackage(e,findings,sanctions,directPatterns,tax,sector,reporting,sectorPatterns) {
  return {
    export_schema:'AML_ANALYST_TRANSFER_V1',
    exported_at:new Date().toISOString(),
    source_application:`AML Analytical Workbench ${V17}`,
    entity:{
      entity_id:e.entity_id, rut:e.rut, name:e.name, entity_type:e.entity_type, region:e.region, commune:e.commune,
      source_count:e.source_count, is_uaf_observed:e.is_uaf_observed, is_sanctioned:e.is_sanctioned,
      snapshot_id:e.snapshot_id, updated_at:e.updated_at
    },
    sector:sector || null,
    reporting_rule:reporting || null,
    tax_profile:tax || null,
    findings:(findings||[]).map(f=>({
      finding_id:f.finding_id||f.finding_key, finding_type:f.finding_type, title:f.title, region:f.region, commune:f.commune,
      score_explore:f.score_explore, score_supervise:f.score_supervise, score_investigate:f.score_investigate,
      source_count:f.source_count, evidence_count:f.evidence_count, snapshot_id:f.snapshot_id, updated_at:f.updated_at,
      producer_ids:f.payload?.producer_ids||[], evidence_ids:f.payload?.evidence_ids||[],
      decision_facts:f.payload?.decision_facts||{}, decision_features:f.payload?.decision_features||{},
      explanation:f.payload?.explanation||null
    })),
    sanctions:(sanctions||[]).map(s=>({
      sanction_id:s.sanction_id,event_date:s.event_date,regulator:s.regulator,entity_name:s.entity_name,entity_id:s.entity_id,
      identity_status:s.identity_status,laft_direct:s.laft_direct,amount_uf:s.amount_uf,subject:s.subject,snapshot_id:s.snapshot_id,updated_at:s.updated_at
    })),
    phenomena_direct:(directPatterns||[]).map(p=>({
      alert_id:p.alert_id,pattern_type:p.pattern_type,scope_type:p.scope_type,scope_id:p.scope_id,scope_label:p.scope_label,
      strength:p.strength,priority:p.priority,title:p.title,summary:p.summary,snapshot_id:p.snapshot_id,updated_at:p.updated_at
    })),
    phenomena_sector_context:(sectorPatterns||[]).map(p=>({
      alert_id:p.alert_id,pattern_type:p.pattern_type,scope_type:p.scope_type,scope_id:p.scope_id,scope_label:p.scope_label,
      strength:p.strength,priority:p.priority,title:p.title,summary:p.summary,snapshot_id:p.snapshot_id,updated_at:p.updated_at
    }))
  };
}

const _v16RenderEntityOriginal = v16RenderEntity;
v16RenderEntity = function(e,findings,sanctions,directPatterns,tax,sector,reporting,sectorPatterns) {
  V17_ENTITY_CACHE = v17NormalizeEntityPackage(e,findings,sanctions,directPatterns,tax,sector,reporting,sectorPatterns);
  const profile=e.profile||{};
  const obliged=e.is_uaf_observed||profile.contexto?.sujeto_obligado===true||(profile.roles||[]).includes('OBLIGED_ENTITY');
  const evidenceCount=findings.reduce((a,r)=>a+Number(r.evidence_count||0),0);
  const maxInvestigate = findings.length ? Math.max(...findings.map(x=>Number(x.score_investigate)||0)) : null;
  const priorityBand = v17PriorityBand(maxInvestigate);
  const identityInfo = `<p><strong>Método:</strong> ${esc(profile.identity_method_es||'Identidad Fusion')}</p><p><strong>Confianza:</strong> ${profile.identity_confidence!=null?Math.round(Number(profile.identity_confidence)*100)+'%':'No informada'}</p><p>La confianza describe calidad de vinculación de identidad; no es riesgo AML.</p>`;
  content().innerHTML=`<div class="entity-command">
      <button class="ghost compact-action" id="back-entities">← Volver</button>
      <button class="secondary compact-action" id="export-entity">Exportar paquete normalizado JSON</button>
    </div>
    <div class="entity-hero">
      <div><div class="eyebrow">${esc(profile.tipo_entidad_es||e.entity_type||'Entidad')}</div><h2>${esc(e.name)}</h2><div class="mono small muted">${esc(e.entity_id)}</div></div>
      <div class="entity-priority"><span>Mayor prioridad para investigar</span><strong>${maxInvestigate==null?'—':fmtScore(maxInvestigate)}</strong><small>${esc(priorityBand.label)}</small></div>
    </div>
    <div class="detail-core">
      ${v16Datum('RUT',e.rut)}
      ${v16Datum('Región',e.region)}
      ${v16Datum('Comuna',e.commune)}
      <div class="datum"><span>Identidad</span><strong>${esc(profile.identity_method_es||'Fusion')}</strong>${v17InfoButton('Cómo se vinculó',identityInfo,true)}</div>
    </div>
    <div class="metric-grid entity-metrics">
      ${v17MetricCard('Hallazgos',findings.length,'Señales vinculadas a esta entidad','<p>Conteo de filas de <code>aml_findings</code> vinculadas por <code>entity_id</code>.</p>')}
      ${v17MetricCard('Sanciones',sanctions.length,'Eventos administrativos vinculados','<p>Conteo de eventos de <code>aml_sanctions</code> resueltos al mismo <code>entity_id</code>.</p>')}
      ${v17MetricCard('Evidencias',evidenceCount,'Referencias usadas por los hallazgos','<p>Suma de <code>evidence_count</code> de los hallazgos vinculados. Puede contener evidencia compartida entre hallazgos; por eso se muestra como referencias, no como documentos únicos.</p>')}
      ${v17MetricCard('Fuentes',e.source_count,'Productores que aportan al perfil','<p>Conteo materializado de productores asociados a la entidad canónica. Más fuentes no equivale por sí solo a mayor riesgo.</p>')}
    </div>
    <div class="section-grid">
      ${v16Regulatory(e,sector,obliged,reporting)}
      ${v16TaxProfile(tax)}
      ${v16Relations(profile.relaciones||[])}
      ${v16Coverage(profile,e)}
    </div>
    <section class="panel gap-top"><div class="panel-head"><h2>Hallazgos</h2><span>${findings.length}</span></div><div class="panel-body">${v17FindingCards(findings,'investigate',false)}</div></section>
    <section class="panel gap-top"><div class="panel-head"><h2>Sanciones</h2><span>${sanctions.length}</span></div><div class="panel-body">${v16SanctionCards(sanctions,e.name)}</div></section>
    <section class="panel gap-top"><div class="panel-head"><h2>Fenómenos relacionados</h2><span>directos + contexto sectorial</span></div><div class="panel-body">
      <h3 class="subhead">Directamente vinculados a la entidad</h3>${directPatterns.length?v17PatternCards(directPatterns):empty('Sin fenómenos directos','No hay una alerta comparativa atribuida directamente a este Entity ID.')}
      <h3 class="subhead">Contexto del sector ${esc(sector||'no determinado')}</h3>${sectorPatterns.length?v17PatternCards(sectorPatterns,true):empty('Sin contexto sectorial materializado','No se encontraron alertas comparativas para la clasificación disponible.')}
    </div></section>
    <div class="footer-note">La entidad se presenta como un conjunto trazable de hechos públicos. Contexto sectorial, territorial o relacional no se hereda como riesgo individual.</div>`;
  document.querySelector('#back-entities').onclick=loadEntities;
  document.querySelector('#export-entity').onclick=async()=>{
    if(!V17_ENTITY_CACHE) return;
    await audit('EXPORT',{objectType:'entity_package',objectId:e.entity_id,payload:{format:'json',schema:'AML_ANALYST_TRANSFER_V1'}});
    v17Download(`aml_entity_${String(e.rut||e.entity_id).replace(/[^0-9A-Za-zKk-]/g,'_')}_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(V17_ENTITY_CACHE,null,2), 'application/json;charset=utf-8');
  };
};

document.addEventListener('click',(ev)=>{
  const open=ev.target.closest('[data-open-entity]');
  if(open){ ev.preventDefault(); openEntity(open.dataset.openEntity); }
});

const _loadEntitiesV15 = loadEntities;
loadEntities = async function() {
  await _loadEntitiesV15();
  const title = document.querySelector('.topbar h1');
  const subtitle = document.querySelector('.topbar p');
  if(title) title.textContent='Entidades';
  if(subtitle) subtitle.textContent='Busca por nombre, RUT o identificador y abre un perfil analítico trazable.';
  const panelHead = document.querySelector('.panel-head h2');
  if(panelHead) panelHead.textContent='Buscar entidad';
};

setTimeout(()=>{ if(state.user&&state.access) loadOverview(); },0);
