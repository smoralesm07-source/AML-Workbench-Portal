function v17ModeSelector() {
  return `<div class="mode-selector" id="v17-mode-selector">
    ${Object.entries(V17_MODE).map(([k,v])=>`<button type="button" class="mode-btn ${V17_FINDING_MODE===k?'active':''}" data-v17-mode="${k}">${esc(v.label)}</button>`).join('')}
  </div>`;
}

function v17RenderFindingsPage(rows, totalCount=V17_FINDINGS_TOTAL) {
  V17_FINDINGS_CACHE = rows || [];
  V17_FINDINGS_TOTAL = Number(totalCount ?? V17_FINDINGS_CACHE.length);
  const mode = V17_MODE[V17_FINDING_MODE];
  const sorted = [...V17_FINDINGS_CACHE].sort((a,b)=>(v17HasNumber(b[mode.scoreField])?Number(b[mode.scoreField]):-Infinity)-(v17HasNumber(a[mode.scoreField])?Number(a[mode.scoreField]):-Infinity));
  content().innerHTML = `<div class="workbench-toolbar">
      <div><h2>Qué merece revisión</h2><p>Mostrando ${fmtNum(V17_FINDINGS_CACHE.length)} de ${fmtNum(V17_FINDINGS_TOTAL)} hallazgo(s). Ordenados según el objetivo analítico.</p></div>
      <div class="toolbar-actions">${v17ModeSelector()}<button type="button" class="secondary compact-action" id="export-findings">Exportar ${fmtNum(V17_FINDINGS_CACHE.length)} filas CSV</button></div>
    </div>
    <div class="mode-explanation">${esc(mode.purpose)} ${v17InfoButton('Ver fórmula de priorización', `<p>Los pesos para <strong>${esc(mode.label)}</strong> son:</p><ul>${Object.entries(mode.weights).map(([k,w])=>`<li>${esc(V17_FEATURE_LABELS[k]||k)}: <strong>${w}%</strong></li>`).join('')}</ul><div class="formula-box"><code>Prioridad = Σ(valor × peso) / Σ(pesos disponibles)</code></div>`, true)}</div>
    ${v17FindingCards(sorted,V17_FINDING_MODE,false)}`;
  document.querySelectorAll('[data-v17-mode]').forEach(btn=>btn.onclick=()=>{
    V17_FINDING_MODE = btn.dataset.v17Mode;
    v17RenderFindingsPage(V17_FINDINGS_CACHE,V17_FINDINGS_TOTAL);
  });
  document.querySelector('#export-findings')?.addEventListener('click',()=>v17ExportFindings(sorted));
}

function v17CsvCell(v) {
  const s = String(v ?? '');
  return `"${s.replaceAll('"','""')}"`;
}
function v17Download(name, contentText, mime='text/plain;charset=utf-8') {
  const blob = new Blob([contentText], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function v17ExportFindings(rows) {
  const headers = ['finding_id','finding_type','entity_id','title','region','commune','score_explore','score_supervise','score_investigate','source_count','evidence_count','snapshot_id','updated_at','producer_ids','evidence_ids'];
  const lines = [headers.join(',')];
  rows.forEach(f=>{
    const p=f.payload||{};
    const row = {
      finding_id:f.finding_id||f.finding_key, finding_type:f.finding_type, entity_id:f.entity_id, title:f.title,
      region:f.region, commune:f.commune, score_explore:f.score_explore, score_supervise:f.score_supervise,
      score_investigate:f.score_investigate, source_count:f.source_count, evidence_count:f.evidence_count,
      snapshot_id:f.snapshot_id, updated_at:f.updated_at,
      producer_ids:(p.producer_ids||[]).join('|'), evidence_ids:(p.evidence_ids||[]).join('|')
    };
    lines.push(headers.map(h=>v17CsvCell(row[h])).join(','));
  });
  await audit('EXPORT',{objectType:'finding_view',objectId:`v17-${V17_FINDING_MODE}`,payload:{rows:rows.length,format:'csv'}});
  v17Download(`aml_hallazgos_${V17_FINDING_MODE}_${new Date().toISOString().slice(0,10)}.csv`, '\ufeff'+lines.join('\n'), 'text/csv;charset=utf-8');
}

loadFindings = async function() {
  state.view='findings'; shell('Hallazgos','Señales priorizadas con cálculo reconstruible, evidencia y siguiente paso.');
  try {
    const {data,error,count}=await sb.from('aml_findings')
      .select('finding_key,finding_id,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,snapshot_id,updated_at,payload',{count:'exact'})
      .order('score_investigate',{ascending:false,nullsFirst:false}).limit(100);
    if(error) throw error;
    v17RenderFindingsPage(data||[],count||0);
  } catch(e) { showContentError(e); }
};
