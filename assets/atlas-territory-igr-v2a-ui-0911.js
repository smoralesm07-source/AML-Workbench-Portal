function renderDetail(){
  if(!selected)return;
  const r=selected,meta=layerMeta(),national=rows.map(val).filter(Number.isFinite),regional=rows.filter(x=>x.region_name===r.region_name).map(val).filter(Number.isFinite);
  const rv=val(r),nat=mean(national),reg=mean(regional),pn=percentile(national,rv),pr=percentile(regional,rv);
  const nationalRank=[...rows].filter(x=>Number.isFinite(val(x))).sort((a,b)=>val(b)-val(a)).findIndex(x=>x.commune_code===r.commune_code)+1;
  const regionalRank=[...rows].filter(x=>x.region_name===r.region_name&&Number.isFinite(val(x))).sort((a,b)=>val(b)-val(a)).findIndex(x=>x.commune_code===r.commune_code)+1;

  const similar=[...rows].filter(x=>x.region_name!==r.region_name&&Number.isFinite(val(x))).sort((a,b)=>Math.abs(val(a)-rv)-Math.abs(val(b)-rv)).slice(0,12);
  const similarAvg=mean(similar.map(val));

  $('#summary').innerHTML=`<div class="score-row"><div><div class="kicker">FICHA TERRITORIAL</div><h2>${esc(r.commune_name)}</h2><div class="meta">${esc(r.region_name)} · corte ${esc(r.period)}</div></div><div class="igr-score-block"><small>IGR</small><div class="score">${num(r.score,1)}</div><div class="level">${esc(r.level||band(r.score))}</div></div></div><div class="pills"><span class="pill">P${pn} nacional</span><span class="pill">P${pr} regional</span><span class="pill">#${regionalRank} región</span><span class="pill confidence">Confianza ${num(r.confidence,0)}%</span></div><div class="hero-note"><b>IGR · v2A</b> · en esta etapa el score representa íntegramente amenaza territorial CEAD-LA. Las capas transfronteriza y evidencia territorial LA aún no aportan puntaje.</div>`;

  const topDrivers=comps(r),lead=topDrivers[0],risingNow=[...topDrivers].filter(c=>Number.isFinite(Number(c.trend))).sort((a,b)=>Number(b.trend)-Number(a.trend))[0];
  const trajectory=(Number(risingNow?.trend)>=65?'Presión emergente':Number(risingNow?.trend)<=35?'Presión desacelerando':'Dinámica estable');
  $('#readout').innerHTML=`<div class="readout-head"><div><div class="kicker">LECTURA EJECUTIVA</div><h3>Qué está explicando el IGR</h3></div><span class="readout-state">${trajectory}</span></div><div class="readout-grid"><div><span>Principal driver</span><b>${esc(lead?.label||'—')}</b><small>${num(lead?.points,1)} pts de aporte</small></div><div><span>Mayor aceleración</span><b>${esc(risingNow?.label||'—')}</b><small>tendencia ${num(risingNow?.trend,1)}/100</small></div><div><span>Posición nacional</span><b>P${pn}</b><small>#${nationalRank} de ${national.length}</small></div></div>`;

  $('#compare').innerHTML=`<h3>Comparación territorial</h3><div class="comparison">
    <div class="comp"><span>Comuna</span><b>${num(rv,1)}</b><small>valor actual</small></div>
    <div class="comp"><span>Promedio región</span><b>${num(reg,1)}</b><small>${rv>=reg?'+':''}${num(rv-reg,1)} pts</small></div>
    <div class="comp"><span>Promedio país</span><b>${num(nat,1)}</b><small>${rv>=nat?'+':''}${num(rv-nat,1)} pts</small></div>
    <div class="comp"><span>Comunas similares</span><b>${num(similarAvg,1)}</b><small>${rv>=similarAvg?'+':''}${num(rv-similarAvg,1)} pts</small></div>
  </div><div class="pills"><span class="pill">#${nationalRank}/${national.length} nacional</span><span class="pill">#${regionalRank}/${regional.length} regional</span></div>`;

  renderTrend(r);
  renderMatrix(r);

  $('#breakdown').innerHTML=`<div class="panel-head-help"><h3>Composición del IGR actual</h3><button class="inline-help" data-help="composition" type="button">i</button></div><div class="breakdown">${Object.entries(meta).map(([k,[label,w]])=>{const sc=Number(r.layers?.[k]?.score),pts=Number.isFinite(sc)?sc*w:0;return `<div class="br"><div><b>${label}</b><div class="bar"><i style="width:${Math.max(0,Math.min(100,sc||0))}%"></i></div></div><strong>${num(sc,1)}</strong><span>${num(pts,1)} pts</span></div>`}).join('')}</div>`;
  const cs=comps(r);
  $('#drivers').innerHTML=`<h3>Drivers territoriales principales</h3>${cs.slice(0,5).map(c=>`<div class="driver"><div><b>${esc(c.label)}</b><small>${num(c.value,0)} casos · tendencia ${num(c.trend,1)} · persistencia ${num(c.persistence,1)}</small></div><strong>+${num(c.points,1)} pts</strong></div>`).join('')}`;
  const top=cs[0],rising=[...cs].filter(c=>Number.isFinite(Number(c.trend))).sort((a,b)=>Number(b.trend)-Number(a.trend))[0],persistent=cs.filter(c=>Number(c.years_observed)>=5&&Number(c.persistence)>=75);
  $('#explain').innerHTML=`<h3>¿Por qué ${esc(r.commune_name)}?</h3><p class="explain">La comuna se ubica en <b>P${pn} nacional</b>. El driver de mayor aporte es <b>${esc(top?.label||'—')}</b>. La mayor presión de tendencia corresponde a <b>${esc(rising?.label||'—')}</b> (${num(rising?.trend,1)}/100), con <b>${persistent.length}</b> señales de persistencia alta. La matriz distingue presión territorial persistente de fenómenos emergentes; no atribuye conducta LA/FT a personas o empresas.</p>`;
  $('#roadmap').innerHTML=`<div class="panel-head-help"><div><div class="kicker">EVOLUCIÓN METODOLÓGICA</div><h3>De IGR v2A al IGR completo</h3></div><button class="inline-help" data-help="roadmap" type="button">i</button></div><div class="roadmap"><div class="road-step on"><span>v2A · ahora</span><b>CEAD-LA</b><small>100% del IGR</small></div><div class="road-line"></div><div class="road-step"><span>v2B</span><b>+ Exposición transfronteriza</b><small>85% CEAD-LA + 15% frontera/logística</small></div><div class="road-line"></div><div class="road-step"><span>v2C</span><b>+ Evidencia territorial LA</b><small>75% CEAD-LA + 15% transfronteriza + 10% evidencia LA</small></div></div><div class="road-note">ATLAS no imputará valores neutros ni redistribuirá silenciosamente pesos por fuentes aún inexistentes. Cada versión será trazable y explícita.</div>`;

  $('#trace').innerHTML=`<h3>Trazabilidad metodológica</h3><div class="trace"><span>Indicador</span><b>IGR · v2A</b></div><div class="trace"><span>Núcleo vigente</span><b>CEAD-LA · casos policiales</b></div><div class="trace"><span>Corte vigente</span><b>${esc(r.period)}</b></div><div class="trace"><span>Historia</span><b>2020–2025 · real</b></div><div class="trace"><span>Confianza 2025</span><b>${num(r.confidence,0)}%</b></div><div class="trace"><span>Capas CEAD-LA</span><b>55 / 35 / 10</b></div><div class="trace"><span>Features</span><b>40 / 25 / 20 / 15</b></div><div class="trace"><span>Serie sintética</span><b>No utilizada</b></div>`;
  renderRanking();
}
function renderRanking(){
  const top=[...rows].filter(r=>Number.isFinite(val(r))).sort((a,b)=>val(b)-val(a)).slice(0,8);
  $('#ranking').innerHTML=`<h3>Ranking territorial</h3><div class="ranklist">${top.map((r,i)=>`<div class="rankrow" data-code="${esc(r.commune_code)}"><em>${i+1}</em><div><b>${esc(r.commune_name)}</b><small>${esc(r.region_name)}</small></div><strong>${num(val(r),1)}</strong></div>`).join('')}</div>`;
  document.querySelectorAll('.rankrow').forEach(el=>el.onclick=()=>{selected=rows.find(r=>String(r.commune_code)===el.dataset.code);renderDetail();geolayer.setStyle(styleFeature)});
}
const METHOD_HELP={
  igr:{title:'IGR · Índice de Riesgo Geográfico',body:`<p><b>Versión v2A:</b> el IGR se construye hoy íntegramente con Amenaza territorial CEAD-LA. No incluye vulnerabilidad sectorial, densidad de SO, IPA, IVO ni reportabilidad, evitando doble conteo con IRAR-E y la futura prioridad individual.</p><p>La arquitectura objetivo evoluciona a 75% CEAD-LA + 15% exposición transfronteriza/logística + 10% evidencia territorial LA. Las dos últimas capas no aportan puntaje hasta disponer de datos reales y cobertura suficiente.</p>`},
  composition:{title:'Composición CEAD-LA del IGR v2A',body:`<p><b>55%</b> Amenazas precedentes LA · <b>35%</b> economía criminal/facilitadores · <b>10%</b> contexto criminógeno.</p><p>Cada driver combina intensidad 40%, persistencia 25%, tendencia 20% y anomalía 15%. En esta versión, la capa de amenazas precedentes está materializada principalmente con delitos de drogas; su expansión a fraude, corrupción, delitos económicos, contrabando y crimen organizado requiere nuevas fuentes territoriales.</p>`},
  roadmap:{title:'Evolución gobernada del IGR',body:`<p>ATLAS cambia de versión sólo cuando una nueva capa está materializada. No se utiliza 50 como valor neutro ni se redistribuyen pesos de manera silenciosa.</p><p><b>v2A:</b> 100% CEAD-LA. <b>v2B:</b> 85/15 con exposición transfronteriza. <b>v2C:</b> 75/15/10 incorporando evidencia territorial de LA.</p>`}
};
function openMethod(k){const h=METHOD_HELP[k];if(!h)return;$('#methodTitle').textContent=h.title;$('#methodBody').innerHTML=h.body;$('#methodPop').classList.add('open');$('#methodPop').setAttribute('aria-hidden','false')}
function closeMethod(){$('#methodPop').classList.remove('open');$('#methodPop').setAttribute('aria-hidden','true')}

function populateRegions(){const regs=[...new Set(rows.map(r=>r.region_name))].sort((a,b)=>a.localeCompare(b,'es'));$('#region').innerHTML='<option value="ALL">Todo Chile</option>'+regs.map(r=>`<option>${esc(r)}</option>`).join('')}
function applyFilters(){const reg=$('#region').value,q=norm($('#search').value);geolayer.eachLayer(l=>{const name=propName(l.feature.properties),r=findRow(name),show=(!q||norm(name).includes(q))&&(reg==='ALL'||r?.region_name===reg);l.setStyle({...styleFeature(l.feature),fillOpacity:show?(r?.score!=null?.78:.10):.02,opacity:show?1:.08})})}
async function init(){
  try{
    const [g,c]=await Promise.all([fetch(GEOJSON).then(r=>r.json()),fetch(CEAD).then(r=>r.json())]);
    rows=(c||[]).filter(r=>r&&r.commune_name);populateRegions();
    geolayer=L.geoJSON(g,{style:styleFeature,onEachFeature:onEach}).addTo(map);
    map.fitBounds(geolayer.getBounds(),{padding:[8,8]});
    selected=[...rows].sort((a,b)=>Number(b.score)-Number(a.score))[0]||null;renderDetail();
  }catch(e){document.getElementById('map').innerHTML=`<div style="padding:20px;color:#cbd8e1">No fue posible cargar el mapa: ${esc(e.message)}</div>`}
}
document.addEventListener('click',e=>{const h=e.target.closest('[data-help]');if(h)openMethod(h.dataset.help)});
$('#igrHelp').addEventListener('click',()=>openMethod('igr'));$('#methodClose').addEventListener('click',closeMethod);$('#methodPop').addEventListener('click',e=>{if(e.target===$('#methodPop'))closeMethod()});
$('#layers').addEventListener('click',e=>{const b=e.target.closest('button[data-layer]');if(!b)return;currentLayer=b.dataset.layer;document.querySelectorAll('#layers button').forEach(x=>x.classList.toggle('active',x===b));if(geolayer){geolayer.setStyle(styleFeature);applyFilters()}if(selected)renderDetail()});
$('#region').addEventListener('change',applyFilters);$('#search').addEventListener('input',applyFilters);
init();
