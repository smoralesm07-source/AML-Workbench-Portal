function v17PriorityBand(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return {label:'Sin cálculo',cls:'neutral'};
  if (n >= 75) return {label:'Muy alta',cls:'high'};
  if (n >= 60) return {label:'Alta',cls:'med'};
  if (n >= 45) return {label:'Media',cls:'low'};
  return {label:'Baja',cls:'neutral'};
}

function v17FindingCards(rows, modeKey=V17_FINDING_MODE, compact=false) {
  if (!rows.length) return empty('Sin hallazgos','No hay hallazgos vinculados en este corte.');
  const mode = V17_MODE[modeKey] || V17_MODE.investigate;
  return `<div class="finding-deck">${rows.map(f => {
    const p = f.payload || {};
    const score = Number(f[mode.scoreField]);
    const band = v17PriorityBand(score);
    const facts = p.decision_facts || {};
    const producers = p.producer_ids || [];
    const next = p.suggested_next_steps || [];
    const sourceBtn = v17InfoButton('Fuentes y evidencia', v17EvidenceExplanation(f), true);
    const calcBtn = v17InfoButton('Cómo se calculó', v17ScoreExplanation(f,modeKey), true);
    return `<article class="finding-card ${compact?'compact':''}">
      <div class="finding-card-head">
        <div><div class="finding-type">${esc(v17FindingLabel(f.finding_type))}</div><h3>${esc(f.title || v17FindingLabel(f.finding_type))}</h3></div>
        <div class="priority-box ${band.cls}"><span>Prioridad para ${esc(mode.label.toLowerCase())}</span><strong>${fmtScore(score)}</strong><small>${esc(band.label)}</small></div>
      </div>
      <p class="finding-summary">${esc(v17PlainFindingSummary(f))}</p>
      <div class="fact-strip">
        <div><span>Fuentes</span><strong>${fmtNum(facts.independent_sources ?? producers.length ?? f.source_count ?? 0)}</strong></div>
        <div><span>Evidencias</span><strong>${fmtNum(f.evidence_count ?? facts.evidence_count ?? 0)}</strong></div>
        <div><span>Región</span><strong>${esc(f.region || 'No informada')}</strong></div>
        ${f.entity_id ? `<div><span>Entidad</span><strong class="mono">${esc(f.entity_id)}</strong></div>` : ''}
      </div>
      <div class="card-actions">${calcBtn}${sourceBtn}${f.entity_id ? `<button type="button" class="info-btn compact" data-open-entity="${esc(f.entity_id)}">Abrir entidad</button>`:''}</div>
      ${!compact && next.length ? `<div class="next-check"><strong>Qué verificar después</strong><ul>${next.slice(0,4).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    </article>`;
  }).join('')}</div>`;
}

function v17PatternExplanation(p) {
  const rule = v16PatternRule(p);
  const payload = p.payload || {};
  const sourceVersion = payload.source_version || '0.12.0';
  return `<div class="formula-summary">
    <div><span>Tipo de comparación</span><strong>${esc(v17PatternLabel(p.pattern_type,p.title))}</strong></div>
    <div><span>Ámbito</span><strong>${esc(p.scope_label || p.scope_id || p.scope_type || '—')}</strong></div>
    <div><span>Índice comparativo</span><strong>${fmtScore(p.strength)}/100</strong></div>
  </div>
  <h3 class="modal-subtitle">Regla utilizada</h3><p>${esc(rule)}</p>
  <p class="plain-note">Este índice expresa intensidad o posición relativa dentro del universo comparado. No es probabilidad de LA/FT.</p>
  <div class="plain-note">Versión de origen: ${esc(sourceVersion)} · tipo técnico: <span class="mono">${esc(p.pattern_type)}</span></div>`;
}

function v17PatternCards(rows, contextOnly=false) {
  if (!rows.length) return empty('Sin fenómenos','No hay fenómenos materializados en el alcance actual.');
  return `<div class="phenomena-grid">${rows.map(p => {
    const info = v17InfoButton('Qué significa y cómo se obtuvo', v17PatternExplanation(p), true);
    const priority = String(p.priority || '—').replaceAll('_',' ');
    return `<article class="phenomenon-card">
      <div class="phenomenon-top"><span>${esc(p.scope_type || 'Ámbito')}</span><span class="priority-label">${esc(priority)}</span></div>
      <h3>${esc(v17PatternLabel(p.pattern_type,p.title))}</h3>
      <p>${esc(p.summary || '')}</p>
      <div class="phenomenon-metric"><span>Índice comparativo</span><strong>${fmtScore(p.strength)}/100</strong></div>
      ${contextOnly?'<div class="context-badge">Contexto sectorial: no se atribuye automáticamente a la entidad.</div>':''}
      <div class="card-actions">${info}</div>
    </article>`;
  }).join('')}</div>`;
}

function v17MetricCard(label,value,description,formulaHtml) {
  return `<div class="metric-card"><div class="metric-label">${esc(label)}</div><div class="metric-value">${fmtNum(value)}</div><div class="metric-description">${esc(description)}</div>${v17InfoButton('Definición',formulaHtml,true)}</div>`;
}

function v17BarChart(title, entries, infoHtml='') {
  if (!entries.length) return '';
  const max = Math.max(...entries.map(x=>Number(x.value)||0),1);
  return `<section class="viz-card"><div class="viz-head"><h2>${esc(title)}</h2>${infoHtml?v17InfoButton('Cómo leerlo',infoHtml,true):''}</div>
    <div class="bar-chart">${entries.map(x=>`<div class="bar-row"><div class="bar-label">${esc(x.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,Math.round((Number(x.value)||0)*100/max))}%"></div></div><div class="bar-value">${fmtNum(x.value)}</div></div>`).join('')}</div>
  </section>`;
}

function v17FiveYearSanctions(rows) {
  const now = new Date();
  const startYear = now.getFullYear() - 4;
  const counts = new Map();
  for (let y=startYear;y<=now.getFullYear();y++) counts.set(y,0);
  rows.forEach(r=>{
    const y = r.event_date ? Number(String(r.event_date).slice(0,4)) : null;
    if (counts.has(y)) counts.set(y,counts.get(y)+1);
  });
  return [...counts.entries()].map(([label,value])=>({label:String(label),value}));
}

function v17PatternScopes(rows) {
  const counts = new Map();
  rows.forEach(r=>{
    const raw = r.scope_type || 'OTRO';
    const label = ({ENTITY:'Entidad',SECTOR:'Sector',TERRITORY:'Territorio',NETWORK:'Red',ORGANIZATION:'Organización',PROVIDER:'Proveedor'})[raw] || raw;
    counts.set(label,(counts.get(label)||0)+1);
  });
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
}

function v17Shell(title, subtitle) {
  const role = state.access?.role || 'viewer';
  const email = state.user?.email || 'usuario';
  app.innerHTML = `<div class="shell v17-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">AML</div><div class="brand-copy"><strong>Analytical Workbench</strong><span>Análisis OSINT trazable</span></div></div>
      <nav class="nav">
        ${navButton('overview','Panorama','01')}
        ${navButton('entities','Entidades','02')}
        ${navButton('findings','Hallazgos','03')}
        ${navButton('sanctions','Sanciones','04')}
        ${navButton('patterns','Fenómenos','05')}
      </nav>
      <div class="sidebar-principle"><strong>Regla de lectura</strong><span>Hecho → cálculo → evidencia → interpretación.</span></div>
      <div class="sidebar-foot"><div class="small muted">${esc(email)}</div><span class="role">${esc(role)}</span><button class="ghost" id="logout">Cerrar sesión</button></div>
    </aside>
    <main class="main">
      <header class="topbar"><div><div class="eyebrow">AML Analytical Workbench · v${V17}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
        <div class="status"><span class="status-pill good">● Acceso seguro</span><span class="status-pill good">● RLS activo</span><span class="status-pill">${esc(role)}</span></div>
      </header>
      <div class="analyst-note"><strong>Lectura analítica:</strong> los indicadores ordenan dónde mirar. No expresan probabilidad de delito. Todo cálculo visible debe poder reconstruirse y toda señal debe conservar su evidencia.</div>
      <section id="content"><div class="loading">Consultando datos autorizados…</div></section>
    </main>
  </div>`;
  document.querySelector('#logout').onclick = signOut;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
}
shell = v17Shell;
