loadPatterns = async function() {
  state.view='patterns'; shell('Fenómenos','Comportamientos agregados o comparativos que pueden orientar una línea de análisis.');
  try {
    const [rowsRes,scopeCounts]=await Promise.all([
      sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,snapshot_id,updated_at,payload',{count:'exact'}).order('strength',{ascending:false,nullsFirst:false}).limit(150),
      v17PatternScopeCounts()
    ]);
    if(rowsRes.error) throw rowsRes.error;
    const rows=rowsRes.data||[];
    content().innerHTML=`<div class="workbench-toolbar"><div><h2>Fenómenos detectados</h2><p>Mostrando ${fmtNum(rows.length)} de ${fmtNum(rowsRes.count||0)} alertas comparativas.</p></div></div>
      ${v17BarChart('Fenómenos por ámbito',scopeCounts,'<p>Conteo exacto por ámbito bajo la sesión y RLS actuales. No mide riesgo.</p>')}
      <div class="gap-top">${v17PatternCards(rows)}</div>`;
  } catch(e) { showContentError(e); }
};

loadSanctions = async function() {
  state.view='sanctions'; shell('Sanciones','Eventos administrativos presentados como hechos, sin convertirlos automáticamente en señal LA/FT.');
  try {
    const [rowsRes,sanctionTrend]=await Promise.all([
      sb.from('aml_sanctions').select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,laft_direct,amount_uf,subject,snapshot_id,updated_at,payload',{count:'exact'}).order('event_date',{ascending:false,nullsFirst:false}).limit(500),
      v17FiveYearSanctionCounts()
    ]);
    if(rowsRes.error) throw rowsRes.error;
    const rows=rowsRes.data||[];
    content().innerHTML=`<div class="workbench-toolbar"><div><h2>Eventos sancionatorios</h2><p>Mostrando ${fmtNum(rows.length)} de ${fmtNum(rowsRes.count||0)} eventos.</p></div></div>
      ${v17BarChart('Sanciones · últimos 5 años',sanctionTrend,'<p>Conteo exacto por año de todos los eventos visibles bajo RLS. Se calcula desde <code>event_date</code>; no implica relación con LA/FT.</p>')}
      <section class="panel gap-top"><div class="panel-head"><h2>Detalle</h2><span>${fmtNum(rows.length)} eventos cargados</span></div><div class="panel-body">${v16SanctionCards(rows)}</div></section>`;
  } catch(e) { showContentError(e); }
};

function v17OverviewFindingList(rows) {
  return v17FindingCards(rows,'investigate',true);
}

loadOverview = async function() {
  state.view='overview'; shell('Panorama','Una lectura inmediata de qué está pasando y qué merece atención.');
  try {
    const [entities,findings,sanctions,patterns,uafObserved,taxProfiles,topRes,scopeCounts,sanctionTrend] = await Promise.all([
      countRows('aml_entities'),
      countRows('aml_findings'),
      countRows('aml_sanctions'),
      countRows('aml_pattern_alerts'),
      countRows('aml_entities',q=>q.eq('is_uaf_observed',true)),
      countRows('aml_entity_tax_profile'),
      sb.from('aml_findings').select('finding_key,finding_id,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,snapshot_id,updated_at,payload').order('score_investigate',{ascending:false,nullsFirst:false}).limit(5),
      v17PatternScopeCounts(),
      v17FiveYearSanctionCounts()
    ]);
    if(topRes.error) throw topRes.error;
    const metricInfo = {
      entities:'<p>Conteo exacto de filas visibles en <code>aml_entities</code> bajo la sesión y RLS actual. Cada fila representa una entidad canónica Fusion.</p>',
      findings:'<p>Conteo exacto de hallazgos materializados en <code>aml_findings</code>. Un hallazgo prioriza revisión; no constituye una conclusión AML.</p>',
      sanctions:'<p>Conteo exacto de eventos en <code>aml_sanctions</code>. Una sanción administrativa no se interpreta automáticamente como LA/FT.</p>',
      patterns:'<p>Conteo exacto de alertas comparativas en <code>aml_pattern_alerts</code>. Se presentan como fenómenos para evitar exponer términos técnicos del motor.</p>'
    };
    content().innerHTML=`<div class="metric-grid">
      ${v17MetricCard('Entidades disponibles',entities,'Universo canónico consultable',metricInfo.entities)}
      ${v17MetricCard('Hallazgos detectados',findings,'Señales que ameritan lectura',metricInfo.findings)}
      ${v17MetricCard('Sanciones registradas',sanctions,'Eventos administrativos',metricInfo.sanctions)}
      ${v17MetricCard('Fenómenos detectados',patterns,'Alertas agregadas o comparativas',metricInfo.patterns)}
    </div>
    <div class="overview-grid">
      <section class="overview-main"><div class="section-title"><div><span>Prioridad inmediata</span><h2>Qué revisaría primero</h2></div><button class="ghost compact-action" data-view-shortcut="findings">Ver todos</button></div>${v17OverviewFindingList(topRes.data||[])}</section>
      <aside class="overview-side">
        <section class="insight-card"><span>Cobertura pública UAF</span><strong>${fmtNum(uafObserved)}</strong><p>Entidades observadas en el corte público integrado. No equivale al padrón operacional completo.</p></section>
        <section class="insight-card"><span>Perfiles tributarios disponibles</span><strong>${fmtNum(taxProfiles)}</strong><p>Perfiles SII disponibles para el universo Fusion consultable.</p></section>
      </aside>
    </div>
    <div class="dashboard-viz-grid">
      ${v17BarChart('Sanciones · últimos 5 años',sanctionTrend,'<p>Conteo exacto por <code>event_date</code> para los últimos cinco años calendario. Es actividad administrativa, no riesgo.</p>')}
      ${v17BarChart('Fenómenos por ámbito',scopeCounts,'<p>Conteo exacto de alertas por ámbito. Ayuda a decidir si mirar entidades, sectores, territorios o redes.</p>')}
    </div>
    <div class="footer-note">Todos los conteos se ejecutan en línea bajo la sesión actual y RLS. La interfaz no contiene snapshots ni datos AML embebidos en el repositorio público.</div>`;
    document.querySelector('[data-view-shortcut="findings"]')?.addEventListener('click',()=>navigate('findings'));
  } catch(e) { showContentError(e); }
};
