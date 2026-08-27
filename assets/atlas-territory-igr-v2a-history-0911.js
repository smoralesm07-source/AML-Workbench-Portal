function renderLine(data,decimals=1){
  const clean=data.filter(d=>Number.isFinite(d.value));if(!clean.length)return '<div class="loading">Sin serie comparable para esta selección.</div>';
  const W=410,H=150,pad=28,vals=clean.map(d=>d.value),rawMin=Math.min(...vals),rawMax=Math.max(...vals),spread=Math.max(1,rawMax-rawMin),min=Math.max(0,rawMin-spread*.18),max=rawMax+spread*.18;
  const x=i=>pad+i*((W-pad*2)/(data.length-1)),y=v=>H-pad-((v-min)/(max-min||1))*(H-pad*2);
  const pts=data.map((d,i)=>Number.isFinite(d.value)?`${x(i)},${y(d.value)}`:null).filter(Boolean).join(' ');
  return `<div class="trend-wrap"><svg class="trend-svg" viewBox="0 0 ${W} ${H}">
    ${[0,1,2,3].map(j=>{const yy=pad+j*((H-pad*2)/3);return `<line x1="${pad}" y1="${yy}" x2="${W-pad}" y2="${yy}" class="grid"/>`}).join('')}
    <line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" class="axis"/><polyline points="${pts}" class="trend-line"/>
    ${data.map((d,i)=>Number.isFinite(d.value)?`<circle cx="${x(i)}" cy="${y(d.value)}" r="4" class="trend-dot"/><text x="${x(i)}" y="${H-7}" class="trend-label" text-anchor="middle">${d.year}</text><text x="${x(i)}" y="${Math.max(11,y(d.value)-8)}" class="trend-value" text-anchor="middle">${num(d.value,decimals)}</text>`:`<text x="${x(i)}" y="${H-7}" class="trend-label" text-anchor="middle">${d.year}</text>`).join('')}
  </svg></div>`;
}
function trendStats(data,isScore){
  const clean=data.filter(d=>Number.isFinite(d.value));if(!clean.length)return '';
  const first=clean[0],last=clean[clean.length-1],delta=last.value-first.value,pct=first.value?100*delta/first.value:null;
  return `<div class="trend-stats"><div class="trend-stat"><span>${first.year}</span><b>${num(first.value,isScore?1:0)}</b></div><div class="trend-stat"><span>${last.year}</span><b>${num(last.value,isScore?1:0)}</b></div><div class="trend-stat"><span>Cambio</span><b>${isScore?(delta>=0?'+':'')+num(delta,1)+' pts':(pct==null?'—':(pct>=0?'+':'')+num(pct,1)+'%')}</b></div></div>`;
}
async function renderTrend(r){
  const token=++historyRenderToken;
  $('#trend').innerHTML=`<div class="trend-head"><div><h3>Historia real CEAD · 2020–2025</h3><div class="meta">Cargando casos policiales históricos…</div></div><span class="real-badge"><i class="real-dot"></i>SIN DATOS SINTÉTICOS</span></div><div class="loading"><b>Preparando serie anual.</b> La primera apertura procesa la base CEAD; luego la navegación entre comunas es inmediata.</div>`;
  try{
    const h=await loadHistoricalData();if(token!==historyRenderToken)return;
    const code=String(r.commune_code||'').padStart(5,'0'),crime=chooseCrimeFor(r,h),isScore=historyMode==='score';
    const data=isScore?seriesForScore(h,code):seriesForCrime(h,crime,code);
    const crimeOptions=(h.componentDefs||[]).map(c=>`<option value="${esc(c.id)}" ${c.id===crime?.id?'selected':''}>${esc(c.label)}</option>`).join('');
    $('#trend').innerHTML=`<div class="trend-head"><div><h3>${isScore?'IGR anual':'Casos policiales reales'} · 2020–2025</h3><div class="meta">${isScore?'IGR v2A recalculado año a año con la misma fórmula CEAD-LA (55/35/10)':'Conteo anual CEAD del driver seleccionado'} · ${esc(r.commune_name)}</div></div><span class="real-badge"><i class="real-dot"></i>CEAD REAL</span></div>
      <div class="trend-actions" style="margin-top:9px"><div class="segment" id="historyMode"><button data-mode="score" class="${isScore?'active':''}">IGR anual</button><button data-mode="cases" class="${!isScore?'active':''}">Casos reales</button></div>${!isScore?`<select id="historyCrime" class="trend-select">${crimeOptions}</select>`:''}</div>
      ${renderLine(data,isScore?1:0)}${trendStats(data,isScore)}
      <div class="trend-note">${isScore?'Cada punto usa únicamente información disponible hasta ese año: intensidad territorial, persistencia acumulada, tendencia versus hasta 3 años previos y anomalía, con pesos 40/25/20/15.':'Unidad: casos policiales CEAD (denuncias + hechos conocidos por detención en flagrancia). Se grafica una categoría a la vez para evitar doble conteo entre familias y subcategorías.'}</div>`;
    document.querySelectorAll('#historyMode button').forEach(b=>b.onclick=()=>{historyMode=b.dataset.mode;renderTrend(r)});
    const sel=$('#historyCrime');if(sel)sel.onchange=()=>{historyCrimeId=sel.value;renderTrend(r)};
  }catch(e){if(token!==historyRenderToken)return;$('#trend').innerHTML=`<div class="trend-head"><div><h3>Historia real CEAD · 2020–2025</h3><div class="meta">No fue posible cargar la serie histórica</div></div></div><div class="warn">${esc(e.message)}. El score 2025 del mapa sigue siendo el publicado por Radar Delictual; esta ficha no reemplaza datos faltantes por valores sintéticos.</div>`}
}
function renderMatrix(r){
  const exposure=Number(r.score)||50;
  const cs=comps(r);
  const trendVals=cs.map(c=>Number(c.trend)).filter(Number.isFinite);
  const dynamics=trendVals.length?mean(trendVals):50;
  const left=10 + 80*Math.max(0,Math.min(1,exposure/100));
  const top=90 - 80*Math.max(0,Math.min(1,dynamics/100));
  let quadrant='Menor prioridad';
  if(exposure>=60&&dynamics>=60)quadrant='Prioridad inmediata';
  else if(exposure>=60&&dynamics<60)quadrant='Riesgo estructural';
  else if(exposure<60&&dynamics>=60)quadrant='Vigilancia emergente';

  $('#matrix').innerHTML=`<h3>Exposición × Dinámica</h3>
    <div class="matrix">
      <div class="quad q1"><b>Prioridad inmediata</b><small>Alta exposición + alta aceleración.</small></div>
      <div class="quad q2"><b>Vigilancia emergente</b><small>Exposición menor, pero dinámica creciente.</small></div>
      <div class="quad q3"><b>Riesgo estructural</b><small>Alta exposición, comportamiento persistente.</small></div>
      <div class="quad q4"><b>Menor prioridad</b><small>Exposición y dinámica relativamente bajas.</small></div>
      <div class="marker" style="left:${left}%;top:${top}%"></div>
    </div>
    <div class="matrix-caption"><b>${esc(r.commune_name)}:</b> ${quadrant} · Exposición ${num(exposure,1)} · Dinámica ${num(dynamics,1)}</div>`;
}
