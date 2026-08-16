loadPatterns = async function() {
  state.view='patterns'; shell('Fenómenos','Comportamientos agregados o comparativos que pueden orientar una línea de análisis.');
  try {
    const {data,error,count}=await sb.from('aml_pattern_alerts')
      .select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,snapshot_id,updated_at,payload',{count:'exact'})
      .order('strength',{ascending:false,nullsFirst:false}).limit(150);
    if(error) throw error;
    const rows=data||[];
    content().innerHTML=`<div class="workbench-toolbar"><div><h2>Fenómenos detectados</h2><p>${fmtNum(count||0)} alertas comparativas materializadas.</p></div></div>
      ${v17BarChart('Fenómenos por ámbito',v17PatternScopes(rows),'<p>Cuenta cuántas alertas se asignan a cada ámbito: entidad, sector, territorio o red. No mide riesgo.</p>')}
      <div class="gap-top">${v17PatternCards(rows)}</div>`;
  } catch(e) { showContentError(e); }
};

loadSanctions = async function() {
  state.view='sanctions'; shell('Sanciones','Eventos administrativos presentados como hechos, sin convertirlos automáticamente en señal LA/FT.');
  try {
    const {data,error,count}=await sb.from('aml_sanctions')
      .select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,laft_direct,amount_uf,subject,snapshot_id,updated_at,payload',{count:'exact'})
      .order('event_date',{ascending:false,nullsFirst:false}).limit(500);
    if(error) throw error;
    const rows=data||[];
    content().innerHTML=`<div class="workbench-toolbar"><div><h2>Eventos sancionatorios</h2><p>${fmtNum(count||0)} eventos en la tabla autorizada.</p></div></div>
      ${v17BarChart('Sanciones por año · ventana reciente',v17FiveYearSanctions(rows),'<p>Conteo por año de los eventos cargados en esta vista. La serie se calcula desde <code>event_date</code>; no implica relación con LA/FT.</p>')}
      <section class="panel gap-top"><div class="panel-head"><h2>Detalle</h2><span>${fmtNum(rows.length)} eventos cargados</span></div><div class="panel-body">${v16SanctionCards(rows)}</div></section>`;
  } catch(e) { showContentError(e); }
};

function v17OverviewFindingList(rows) {
  return v17FindingCards(rows,'investigate',true);
}

loadOverview = async function() {
  state.view='overview'; shell('Panorama','Una lectura inmediata de qué está pasando y qué merece atención.');
  try {
    const fiveYearsAgo = `${new Date().getFullYear()-4}-01-01`;
    const [entities,findings,sanctions,patterns,uafObserved,taxProfiles,topRes,patternRes,sanctionTrendRes] = await Promise.all([
      countRows('aml_entities'),
      countRows('aml_findings'),
      countRows('aml_sanctions'),
      countRows('aml_pattern_alerts'),
      countRows('aml_entities',q=>q.eq('is_uaf_observed',true)),
      countRows('aml_entity_tax_profile'),
      sb.from('aml_findings').select('finding_key,finding_id,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,snapshot_id,updated_at,payload').order('score_investigate',{ascending:false,nullsFirst:false}).limit(5),
      sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,payload').order('strength',{ascending:false,nullsFirst:false}).limit(150),
      sb.from('aml_sanctions').select('sanction_id,event_date').gte('event_date',fiveYearsAgo).order('event_date',{ascending:true}).limit(1000)
    ]);
    [topRes,patternRes,sanctionTrendRes].forEach(r=>{if(r.error)throw r.error;});
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
        <section class="insight-card"><span>Perfiles tributarios disponibles</span><strong>${fmtNum(taxProfiles)}</strong><p>Perfiles SII materializados para el universo Fusion consultable.</p></section>
      </aside>
    </div>
    <div class="dashboard-viz-grid">
      ${v17BarChart('Sanciones · últimos 5 años',v17FiveYearSanctions(sanctionTrendRes.data||[]),'<p>Cuenta eventos por <code>event_date</code> desde el inicio del año de hace cuatro años hasta hoy. Es una medida de actividad administrativa, no de riesgo.</p>')}
      ${v17BarChart('Fenómenos por ámbito',v17PatternScopes(patternRes.data||[]),'<p>Cuenta alertas comparativas por ámbito. Ayuda a decidir si mirar entidades, sectores, territorios o redes.</p>')}
    </div>
    <div class="footer-note">Todos los conteos se ejecutan en línea bajo la sesión actual y RLS. La interfaz no contiene snapshots ni datos AML embebidos en el repositorio público.</div>`;
    document.querySelector('[data-view-shortcut="findings"]')?.addEventListener('click',()=>navigate('findings'));
  } catch(e) { showContentError(e); }
};
