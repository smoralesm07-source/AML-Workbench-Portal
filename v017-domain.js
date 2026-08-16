function v17HttpsUrl(value){return typeof value==='string'&&/^https:\/\//i.test(value)?value:null;}
function v17SourceAction(label,url){const safe=v17HttpsUrl(url);return safe?`<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';}

function v17SanctionCards(rows,canonicalName=null){
  if(!rows.length)return empty('Sin sanciones','No hay eventos sancionatorios vinculados en este corte.');
  return `<div class="finding-deck">${rows.map(s=>{
    const a=s.payload?.attributes||{};
    const sourceUrl=v17HttpsUrl(a.source_url||s.payload?.source_url||s.payload?.url);
    const sourceInfo=`<div class="formula-summary"><div><span>Organismo</span><strong>${esc(s.regulator||a.supervisor||'No informado')}</strong></div><div><span>Fecha</span><strong>${fmtDate(s.event_date)}</strong></div><div><span>Identidad</span><strong>${esc(s.identity_status||'No informada')}</strong></div></div><p class="plain-note">${esc(a.summary||s.subject||'Evento administrativo registrado por su fuente de origen.')}</p>${sourceUrl?`<div class="source-links">${v17SourceAction('Abrir documento o fuente',sourceUrl)}</div>`:'<p class="plain-note">El enlace directo no está disponible en este registro. La trazabilidad se mantiene mediante el identificador del evento y el snapshot.</p>'}`;
    return `<article class="finding-card">
      <div class="finding-card-head"><div><div class="finding-type">${esc(s.regulator||a.supervisor||'Organismo regulador')} · ${fmtDate(s.event_date)}</div><h3>${esc(canonicalName||s.entity_name||'Entidad')}</h3></div><div class="priority-box neutral"><span>Vínculo LA/FT</span><strong>${s.laft_direct?'Sí':'No'}</strong><small>${s.laft_direct?'Clasificado como directo':'Sólo contexto administrativo'}</small></div></div>
      <p class="finding-summary">${esc(a.summary||s.subject||'Evento sancionatorio administrativo.')}</p>
      <div class="fact-strip"><div><span>Resolución</span><strong>${esc(a.resolution||'No informada')}</strong></div><div><span>Materia</span><strong>${esc(a.category||'No informada')}</strong></div><div><span>Monto UF</span><strong>${s.amount_uf!=null?fmtNum(s.amount_uf):'No disponible'}</strong></div></div>
      <div class="card-actions">${v17InfoButton('Fuente y alcance',sourceInfo,true)}</div>
    </article>`;
  }).join('')}</div>`;
}

function v17Regulatory(e,sector,obliged,rule){
  const status=obliged?'Observada en el corte público UAF':'No observada en el corte público UAF';
  const ruleInfo=rule?`<div class="formula-summary"><div><span>Base</span><strong>${esc(rule.legal_basis||'No informada')}</strong></div><div><span>Fecha de regla</span><strong>${fmtDate(rule.as_of_date)}</strong></div><div><span>Sector</span><strong>${esc(sector||'No determinado')}</strong></div></div><p>${esc(rule.notes||'')}</p><div class="source-links">${v17SourceAction('Fuente UAF · ROS',rule.source_url_ros)}${v17SourceAction('Fuente UAF · ROE',rule.source_url_roe)}</div>`:'<p class="plain-note">La condición UAF está disponible, pero el catálogo aún no contiene una regla detallada de reportabilidad para esta clasificación.</p>';
  return `<section class="info-card"><div class="card-kicker">Condición UAF</div><h3>${esc(sector||'Sector UAF no determinado')}</h3><span class="status-big ${obliged?'good':'neutral'}">${esc(status)}</span><p class="muted">${obliged?'La entidad aparece en la información pública integrada para este corte.':'Esta ausencia no acredita no inscripción ni ausencia de obligación legal.'}</p>${rule?`<div class="report-grid"><div><span>ROS</span><strong>${rule.ros_required?'Obligación aplicable':'Sin regla aplicable registrada'}</strong><p>${esc(rule.ros_trigger||'')}</p></div><div><span>ROE</span><strong>${rule.roe_required?esc(rule.roe_frequency||'Obligación aplicable'):'Sin regla aplicable registrada'}</strong><p>${rule.roe_threshold_usd?`Umbral informado: USD ${fmtNum(rule.roe_threshold_usd)} o equivalente. `:''}${esc(rule.roe_deadline||'')}</p></div></div>`:''}<div class="card-actions">${v17InfoButton('Base y fuentes',ruleInfo,true)}</div></section>`;
}

function v17TaxProfile(t){
  if(!t)return `<section class="info-card wide"><div class="card-kicker">Información tributaria SII</div><h3>Sin perfil disponible en esta vista</h3><div class="data-status">Esto significa que el perfil no está disponible para este Entity ID en la capa consultada. No significa que el SII carezca de información.</div></section>`;
  const code=Number(t.sales_band_code||t.sales_band_rank||t.sales_band);
  const band=SALES_BAND_V16[code]||t.sales_band||`Tramo ${t.sales_band_code||'—'}`;
  const sigs=String(t.signal_types||'').split('|').map(s=>s.trim()).filter(Boolean);
  const sourceInfo=`<div class="formula-summary"><div><span>Año comercial</span><strong>${esc(t.commercial_year||'—')}</strong></div><div><span>Actualización</span><strong>${esc(fmtDateTime(t.updated_at))}</strong></div><div><span>Identificador de carga</span><strong class="mono">${esc(t.source_run_id||'—')}</strong></div></div><p class="plain-note">El SII publica tramos de ventas para esta fuente, no montos exactos. El código 1 corresponde a “Sin información” y no debe tratarse como cero.</p>`;
  return `<section class="info-card wide"><div class="card-kicker">Información tributaria SII</div><h3>Año comercial ${esc(t.commercial_year||'—')}</h3><div class="detail-core tax-grid">${v16Datum('Tramo de ventas',`Tramo ${code||'—'} · ${band}`,'Clasificación SII; no es monto exacto')}${v16Datum('Trabajadores dependientes',t.workers_numeric)}${v16Datum('Actividad principal',t.main_activity)}${v16Datum('Sector económico',t.economic_sector)}${v16Datum('Subsector',t.economic_subsector)}${v16Datum('Estado publicado',t.current_status)}${v16Datum('Inicio de actividades',fmtDate(t.activity_start_date))}${v16Datum('Término de giro',fmtDate(t.termination_date))}${v16Datum('Actividades registradas',t.activity_count)}${v16Datum('Domicilios históricos',t.address_count)}${v16Datum('Relaciones societarias',t.ownership_edge_count)}</div>${sigs.length?`<div class="signal-block"><h4>Cambios o características que merecen revisión</h4>${sigs.map(s=>`<div class="signal-row"><strong>${esc(SII_SIGNAL_LABELS_V16[s]||s)}</strong><p>${esc(SII_SIGNAL_RULES_V16[s]||'Regla determinística del Radar SII.')}</p></div>`).join('')}<small>Son señales contextuales. No constituyen por sí mismas hallazgo tributario, penal o AML.</small></div>`:''}<div class="card-actions">${v17InfoButton('Fuente y lectura del dato',sourceInfo,true)}</div></section>`;
}

function v17Relations(rows){
  return `<section class="info-card"><div class="card-kicker">Relaciones observadas</div><h3>${fmtNum(rows.length)} relación(es)</h3>${rows.length?`<div class="list compact">${rows.map(r=>`<div class="list-item"><strong>${esc(r.contraparte_nombre||r.contraparte_id||'Contraparte')}</strong><div class="meta"><span>${esc(r.tipo_es||r.tipo||'Relación')}</span><span>${esc(r.sentido_es||'')}</span>${r.confidence!=null?`<span>Confianza de vinculación ${Math.round(Number(r.confidence)*100)}%</span>`:''}</div></div>`).join('')}</div>`:empty('Sin relaciones disponibles','No hay relaciones observadas en el perfil consultado.')}<p class="muted small">Una relación aporta contexto; no transmite automáticamente señales o prioridad desde la contraparte.</p></section>`;
}

function v17Coverage(profile,e){
  const sources=profile.fuentes||[];
  const evidence=profile.evidence_ids||[];
  const sourceInfo=`<h3 class="modal-subtitle">Fuentes que aportan al perfil</h3><ul class="source-list">${sources.length?sources.map(s=>`<li><strong>${esc(v17ProducerLabel(s))}</strong><span class="mono">${esc(s)}</span></li>`).join(''):'<li>No se informaron productores en el perfil.</li>'}</ul><h3 class="modal-subtitle">Evidencia trazable</h3><ul class="evidence-list">${evidence.length?evidence.map(x=>`<li class="mono">${esc(x)}</li>`).join(''):'<li>Sin IDs compactos de evidencia en este perfil.</li>'}</ul>`;
  return `<section class="info-card"><div class="card-kicker">Datos disponibles</div><h3>${fmtNum(e.source_count)} fuente(s) aportan al perfil</h3><div class="chips">${sources.map(s=>v16Tag(v17ProducerLabel(s),'info')).join('')||'<span class="muted">Sin detalle de fuentes</span>'}</div><p class="muted small">Más fuentes pueden mejorar el contexto, pero no aumentan automáticamente el riesgo.</p><div class="card-actions">${v17InfoButton('Ver fuentes y evidencia',sourceInfo,true)}</div></section>`;
}

v16SanctionCards=v17SanctionCards;
v16Regulatory=v17Regulatory;
v16TaxProfile=v17TaxProfile;
v16Relations=v17Relations;
v16Coverage=v17Coverage;
