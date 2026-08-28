'use strict';
/* ATLAS AML · Empresas (RES) · source-pure analytical cockpit · 0.95.0 */
(function atlasResIntelligence0950(){
  if(window.__ATLAS_RES_INTELLIGENCE_0950__) return;
  window.__ATLAS_RES_INTELLIGENCE_0950__=true;

  const VERSION='0.95.0';
  const CUT='31-07-2026';
  const DATA={
    total:1609372,ytd:129213,ytdPrev:114314,spaShare:79.7,medianCapital:1500000,p90Capital:10000000,
    annual:[[2013,20704],[2014,51557],[2015,64829],[2016,76123],[2017,87550],[2018,102011],[2019,109411],[2020,134855],[2021,172038],[2022,145634],[2023,147752],[2024,165289],[2025,202406],[2026,129213]],
    types:[
      ['SpA',1000796,103032,86327,1500000],['EIRL',360963,16892,17565,1000000],['SRL',247111,9263,10392,2000000],
      ['SA',430,20,23,10000000],['SCC',39,3,3,24489946],['SCA',14,1,2,1000000],['SCS',12,2,2,16500000],['SAGR',7,0,0,null]
    ],
    regions:[
      ['Metropolitana',58263,51424],['Valparaíso',12684,11572],['Biobío',9585,8439],['Maule',7067,6297],['Los Lagos',6751,5738],['La Araucanía',6668,5690],['O’Higgins',6432,5676],['Coquimbo',4824,4469],['Antofagasta',4220,3641],['Ñuble',3010,2615],['Los Ríos',2646,2239],['Tarapacá',2291,2211],['Atacama',1649,1433],['Magallanes',1157,1087],['Arica y Parinacota',1153,1030],['Aysén',811,751]
    ],
    communes:[
      ['Providencia',8362,'Metropolitana'],['Santiago',6924,'Metropolitana'],['Las Condes',5693,'Metropolitana'],['Viña del Mar',3057,'Valparaíso'],['Antofagasta',3029,'Antofagasta'],['Temuco',2830,'La Araucanía'],['Concepción',2764,'Biobío'],['Maipú',2735,'Metropolitana'],['Puente Alto',2669,'Metropolitana'],['Puerto Montt',2459,'Los Lagos'],['Ñuñoa',2438,'Metropolitana'],['La Florida',2432,'Metropolitana'],['Talca',2036,'Maule'],['La Serena',1907,'Coquimbo'],['Rancagua',1799,'O’Higgins']
    ],
    weekly:[['04-05',4420],['11-05',4485],['18-05',4015],['25-05',4805],['01-06',4797],['08-06',4550],['15-06',4249],['22-06',4263],['29-06',3706],['06-07',4123],['13-07',3368],['20-07',4152],['27-07',3899]],
    anomalies:[
      ['Atacama','Feb',214,136.8,56.5,7.27],['Ñuble','Abr',491,267.3,83.7,5.63],['Antofagasta','Mar',669,469.3,42.6,5.29],['Coquimbo','Mar',788,565.3,39.4,4.52],['Metropolitana','Feb',7386,5245,40.8,4.47],['Ñuble','Feb',403,237.8,69.5,4.46],['Aysén','Feb',128,83.5,53.3,4.36],['Los Lagos','Jun',1070,644.5,66.0,4.28],['Los Lagos','Feb',884,581.8,52.0,4.16],['Los Ríos','Jun',410,259,58.3,4.14],['Biobío','Mar',1499,1028.5,45.7,4.11],['Arica y Parinacota','Jul',208,128.5,61.9,4.05]
    ],
    clusters:[
      ['2026-07-01','Providencia','SpA',1000000,31,'Concentración temporal de constituciones con parámetros comunes'],
      ['2026-06-16','Providencia','SpA',1000000,31,'Concentración temporal de constituciones con parámetros comunes'],
      ['2026-06-15','Providencia','SpA',1000000,30,'Concentración temporal de constituciones con parámetros comunes'],
      ['2026-05-25','Providencia','SpA',1000000,30,'Concentración temporal de constituciones con parámetros comunes'],
      ['2026-06-04','Providencia','SpA',1000000,29,'Concentración temporal de constituciones con parámetros comunes'],
      ['2026-06-09','Las Condes','SpA',1000000,25,'Concentración temporal de constituciones con parámetros comunes'],
      ['2026-07-20','Macul','SpA',5000000,19,'Muestra: COMERCIALIZADORA YUMI · COSMICS CREATIONS · JESSLEY MARKET · KERYO GLOBAL MARKET'],
      ['2026-07-17','Macul','SpA',5000000,19,'Muestra: BAOYU SUPPLIES · FENG HUANG CENTER · FENSHI HUANG · FIKI LUNG'],
      ['2026-07-15','Huechuraba','SpA',1000000,18,'Muestra: Eureka Consulting · KAMI CHILLAN 2 · KAMI COQUIMBO · KAMI LA SERENA'],
      ['2026-06-02','Santiago','SpA',5000000,17,'Muestra: ARIRANG CENTER · AURASEOUL · BLUE DRAGON GROUP · DAWHAN MARKET'],
      ['2026-07-04','Las Cabras','SpA',1000000,15,'Muestra: AGRICOM · AGRO · AGROSER · campo verde'],
      ['2026-06-25','Maipú','SpA',1000000,15,'Muestra: BJ TRANSITRIDE · Comer Fernanda · Comer Javiera · Comer Mirasol']
    ]
  };

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const money=v=>v==null?'—':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const growth=(a,b)=>b?((a/b-1)*100):0;
  const content=()=>document.querySelector('#content');

  function svgLine(rows){
    const w=760,h=220,p=28,max=Math.max(...rows.map(r=>r[1])),min=Math.min(...rows.map(r=>r[1]));
    const span=Math.max(1,max-min);const dx=(w-p*2)/(rows.length-1);
    const pts=rows.map((r,i)=>[p+i*dx,h-p-((r[1]-min)/span)*(h-p*2)]);
    const path=pts.map((pnt,i)=>`${i?'L':'M'}${pnt[0].toFixed(1)},${pnt[1].toFixed(1)}`).join(' ');
    const ticks=rows.map((r,i)=>i%2===0||i===rows.length-1?`<text x="${pts[i][0]}" y="${h-7}" text-anchor="middle">${r[0]}</text>`:'').join('');
    const dots=pts.map((pnt,i)=>`<circle cx="${pnt[0]}" cy="${pnt[1]}" r="3"><title>${rows[i][0]}: ${num(rows[i][1])}</title></circle>`).join('');
    return `<svg class="res95-line" viewBox="0 0 ${w} ${h}" role="img" aria-label="Constituciones RES por año"><path class="axis" d="M${p},${h-p}H${w-p}"/><path class="trend" d="${path}"/>${dots}${ticks}</svg>`;
  }

  function progress(value,max,label){
    return `<div class="res95-progress"><div class="res95-progress-top"><span>${esc(label)}</span><b>${num(value)}</b></div><progress max="${max}" value="${value}"></progress></div>`;
  }

  function tabs(active='pulse'){
    const items=[['pulse','Pulso RES'],['territory','Territorio'],['phenomena','Fenómenos'],['structure','Estructura & red']];
    return `<div class="res95-tabs" role="tablist">${items.map(([id,label])=>`<button type="button" data-res-tab="${id}" class="${active===id?'active':''}">${label}</button>`).join('')}</div>`;
  }

  function header(){
    return `<section class="res95-hero"><div><div class="res95-eyebrow">ANALÍTICA · EMPRESAS · REGISTRO DE EMPRESAS Y SOCIEDADES</div><h2>Empresas (RES)</h2><p>Lectura estructural y temporal construida exclusivamente con datos RES. Identifica concentración, aceleraciones y atipicidades societarias; no clasifica riesgo LA/FT.</p></div><div class="res95-health"><span>● Datos operativos</span><b>Corte ${CUT}</b><small>${num(DATA.total)} sociedades</small></div></section>`;
  }

  function kpis(){
    return `<div class="res95-kpis"><article><span>Universo RES</span><b>${num(DATA.total)}</b><small>RUT únicos observados</small></article><article><span>Constituidas 2026 YTD</span><b>${num(DATA.ytd)}</b><small>${pct(growth(DATA.ytd,DATA.ytdPrev))} vs ene–jul 2025</small></article><article><span>Participación SpA</span><b>${pct(DATA.spaShare)}</b><small>de constituciones 2026 YTD</small></article><article><span>Capital mediano</span><b>${money(DATA.medianCapital)}</b><small>P90 ${money(DATA.p90Capital)}</small></article></div>`;
  }

  function pulse(){
    const maxType=Math.max(...DATA.types.map(r=>r[2]));const maxWeek=Math.max(...DATA.weekly.map(r=>r[1]));
    return `${header()}${tabs('pulse')}${kpis()}<div class="res95-grid res95-grid-2"><article class="res95-card res95-wide"><div class="res95-card-head"><div><span>Serie histórica</span><h3>Constituciones por año</h3></div><em>2013 → jul 2026</em></div>${svgLine(DATA.annual)}<p class="res95-note">2026 corresponde a enero–julio; no es comparable como año completo.</p></article><article class="res95-card"><div class="res95-card-head"><div><span>Forma jurídica</span><h3>Mix 2026 YTD</h3></div></div><div class="res95-stack">${DATA.types.slice(0,4).map(r=>progress(r[2],maxType,r[0])).join('')}</div></article><article class="res95-card"><div class="res95-card-head"><div><span>Ritmo reciente</span><h3>Constituciones semanales</h3></div></div><div class="res95-weekly">${DATA.weekly.map(([d,v])=>`<div><progress max="${maxWeek}" value="${v}"></progress><b>${num(v)}</b><span>${d}</span></div>`).join('')}</div></article></div><article class="res95-reading"><b>Lectura ejecutiva</b><p>El flujo de constituciones ene–jul 2026 supera en ${pct(growth(DATA.ytd,DATA.ytdPrev))} al mismo período de 2025. La SpA domina el flujo reciente y concentra ${pct(DATA.spaShare)} del YTD. Estas métricas describen dinámica societaria; cualquier hipótesis analítica debe validarse con evidencia adicional.</p></article>`;
  }

  function territory(){
    return `${header()}${tabs('territory')}${kpis()}<div class="res95-toolbar"><label>Orden regional <select id="res95-region-sort"><option value="volume">Volumen 2026</option><option value="growth">Crecimiento vs 2025</option></select></label><label>Filtrar <input id="res95-region-q" type="search" placeholder="Región o comuna"></label></div><div class="res95-grid res95-grid-2"><article class="res95-card"><div class="res95-card-head"><div><span>Territorio</span><h3>Constituciones 2026 YTD por región</h3></div><em>ene–jul</em></div><div id="res95-region-list" class="res95-region-list">${regionRows(DATA.regions,'volume','')}</div></article><article class="res95-card"><div class="res95-card-head"><div><span>Concentración comunal</span><h3>Comunas con mayor flujo</h3></div><em>2026 YTD</em></div><div id="res95-commune-list" class="res95-table-wrap">${communeTable('')}</div></article></div><article class="res95-reading"><b>Uso analítico</b><p>La comparación territorial prioriza cambios relativos y concentración de constituciones. Un aumento regional puede responder a cambios económicos, administrativos o de composición jurídica y no constituye por sí mismo una señal de irregularidad.</p></article>`;
  }

  function regionRows(rows,sort,q){
    const term=String(q||'').toLocaleLowerCase('es-CL');const filtered=rows.filter(r=>!term||r[0].toLocaleLowerCase('es-CL').includes(term));const ordered=[...filtered].sort((a,b)=>sort==='growth'?growth(b[1],b[2])-growth(a[1],a[2]):b[1]-a[1]);const max=Math.max(1,...ordered.map(r=>r[1]));
    return ordered.map(r=>`<button type="button" class="res95-region-row" data-res-region="${esc(r[0])}"><span><b>${esc(r[0])}</b><small>${pct(growth(r[1],r[2]))} vs 2025</small></span><progress max="${max}" value="${r[1]}"></progress><strong>${num(r[1])}</strong></button>`).join('')||'<div class="res95-empty">Sin coincidencias.</div>';
  }

  function communeTable(q){
    const term=String(q||'').toLocaleLowerCase('es-CL');const rows=DATA.communes.filter(r=>!term||`${r[0]} ${r[2]}`.toLocaleLowerCase('es-CL').includes(term));
    return `<table><thead><tr><th>Comuna</th><th>Región</th><th>2026</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[2])}</td><td>${num(r[1])}</td></tr>`).join('')}</tbody></table>`;
  }

  function phenomena(){
    return `${header()}${tabs('phenomena')}<div class="res95-method"><b>Atipicidad societaria ≠ riesgo AML</b><span>Los desvíos se usan para exploración. El z-score compara el mes 2026 contra el mismo mes de 2022–2025; con cuatro observaciones históricas es una señal exploratoria, no un modelo concluyente.</span></div><div class="res95-toolbar"><label>Umbral z <input id="res95-z" type="range" min="2" max="7" step="0.25" value="4"><output id="res95-z-out">4,00</output></label><label>Mín. cluster <input id="res95-cluster-min" type="range" min="10" max="31" step="1" value="15"><output id="res95-cluster-out">15</output></label><label>Buscar <input id="res95-cluster-q" type="search" placeholder="Comuna, tipo, fecha"></label><button type="button" id="res95-export">Exportar CSV</button></div><div class="res95-grid res95-grid-2"><article class="res95-card"><div class="res95-card-head"><div><span>Desvíos estacionales</span><h3>Región · mes · 2026</h3></div><em id="res95-anom-count"></em></div><div id="res95-anomalies" class="res95-table-wrap"></div></article><article class="res95-card"><div class="res95-card-head"><div><span>Concentraciones estructurales</span><h3>Misma fecha + comuna + tipo + capital</h3></div><em id="res95-cluster-count"></em></div><div id="res95-clusters" class="res95-clusters"></div></article></div><div id="res95-detail" class="res95-detail" hidden></div>`;
  }

  function anomalyTable(z){
    const rows=DATA.anomalies.filter(r=>r[5]>=z);return {rows,html:`<table><thead><tr><th>Región</th><th>Mes</th><th>Obs.</th><th>Base</th><th>Δ</th><th>z</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${num(r[2])}</td><td>${num(r[3])}</td><td>+${pct(r[4])}</td><td><b>${Number(r[5]).toFixed(2)}</b></td></tr>`).join('')}</tbody></table>`};
  }

  function clusterRows(min,q){const term=String(q||'').toLocaleLowerCase('es-CL');return DATA.clusters.filter(r=>r[4]>=min&&(!term||`${r[0]} ${r[1]} ${r[2]} ${r[3]} ${r[5]}`.toLocaleLowerCase('es-CL').includes(term)));}
  function renderClusters(min,q){const rows=clusterRows(min,q);return {rows,html:rows.map((r,i)=>`<button type="button" class="res95-cluster" data-res-cluster="${i}" data-res-key="${esc(r.join('|'))}"><span class="res95-cluster-n">${r[4]}</span><span><b>${esc(r[1])} · ${esc(r[2])}</b><small>${esc(r[0])} · capital ${money(r[3])}</small></span><span class="res95-arrow">›</span></button>`).join('')||'<div class="res95-empty">No hay clusters con estos filtros.</div>'};}

  function structure(){
    const cards=[['Sociedad / RUT','Disponible','1.609.372 sociedades individualizadas'],['Fecha constitución','Disponible','Cobertura 100%'],['Región / comuna','Disponible','Cobertura territorial casi total'],['Capital','Disponible','Permite distribución y patrones de repetición'],['Representantes / administradores','Pendiente','Tabla de relaciones preparada, aún sin filas materializadas'],['Socios / accionistas','Pendiente','Requiere capa oficial de relaciones/evidencia'],['Domicilio exacto','Pendiente','Hoy existe comuna/región, no calle + número'],['Actuaciones de ciclo de vida','Parcial','Constitución cargada; modificaciones y disoluciones aún no materializadas']];
    return `${header()}${tabs('structure')}<div class="res95-availability">${cards.map(r=>`<article class="${r[1]==='Disponible'?'ok':r[1]==='Parcial'?'partial':'pending'}"><span>${esc(r[0])}</span><b>${esc(r[1])}</b><small>${esc(r[2])}</small></article>`).join('')}</div><div class="res95-grid res95-grid-2"><article class="res95-card"><div class="res95-card-head"><div><span>Capital por tipo</span><h3>Mediana observada</h3></div></div><div class="res95-stack">${DATA.types.filter(r=>r[4]!=null).slice(0,7).map(r=>`<div class="res95-cap"><span>${esc(r[0])}</span><b>${money(r[4])}</b></div>`).join('')}</div></article><article class="res95-card res95-locked"><div class="res95-lock">↗</div><div><span>Red societaria</span><h3>Persona ↔ sociedad ↔ domicilio</h3><p>El modelo está preparado, pero Atlas no inferirá vínculos sin evidencia RES materializada. La visualización se habilitará cuando existan relaciones oficiales suficientes.</p></div></article></div><article class="res95-reading"><b>Principio de gobernanza</b><p>Esta sección conserva pureza de fuente: RES explica estructura societaria. No se mezclan SII, UAF, sanciones ni otras fuentes dentro de sus indicadores. Las señales RES podrán luego consumirse como evidencia separada en otras vistas de Atlas.</p></article>`;
  }

  function bindTabs(){document.querySelectorAll('[data-res-tab]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.resTab)));}
  function bindTerritory(){const sort=document.querySelector('#res95-region-sort'),q=document.querySelector('#res95-region-q'),regionList=document.querySelector('#res95-region-list'),communes=document.querySelector('#res95-commune-list');const refresh=()=>{regionList.innerHTML=regionRows(DATA.regions,sort.value,q.value);communes.innerHTML=communeTable(q.value);bindRegionDetail();};sort?.addEventListener('change',refresh);q?.addEventListener('input',refresh);bindRegionDetail();}
  function bindRegionDetail(){document.querySelectorAll('[data-res-region]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.resRegion,row=DATA.regions.find(r=>r[0]===name);if(!row)return;const related=DATA.communes.filter(r=>r[2]===name).slice(0,6);let box=document.querySelector('#res95-detail');if(!box){box=document.createElement('div');document.querySelector('.res95-root')?.appendChild(box);}box.id='res95-detail';box.className='res95-detail';box.hidden=false;box.innerHTML=`<button type="button" data-res-close>×</button><span>Región seleccionada</span><h3>${esc(name)}</h3><div class="res95-detail-kpis"><b>${num(row[1])}<small>2026 YTD</small></b><b>${pct(growth(row[1],row[2]))}<small>vs 2025</small></b></div>${related.length?`<p>Comunas visibles en top nacional: ${related.map(r=>`${esc(r[0])} (${num(r[1])})`).join(' · ')}</p>`:'<p>Sin comunas de esta región dentro del top nacional mostrado.</p>'}`;box.querySelector('[data-res-close]')?.addEventListener('click',()=>box.remove());}));}
  function bindPhenomena(){const z=document.querySelector('#res95-z'),zo=document.querySelector('#res95-z-out'),min=document.querySelector('#res95-cluster-min'),mo=document.querySelector('#res95-cluster-out'),q=document.querySelector('#res95-cluster-q');const refresh=()=>{const zv=Number(z.value),mv=Number(min.value);zo.value=zv.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2});mo.value=String(mv);const a=anomalyTable(zv),c=renderClusters(mv,q.value);document.querySelector('#res95-anomalies').innerHTML=a.html;document.querySelector('#res95-anom-count').textContent=`${a.rows.length} señales`;document.querySelector('#res95-clusters').innerHTML=c.html;document.querySelector('#res95-cluster-count').textContent=`${c.rows.length} grupos`;document.querySelectorAll('[data-res-cluster]').forEach(btn=>btn.addEventListener('click',()=>showCluster(btn.dataset.resKey)));};z?.addEventListener('input',refresh);min?.addEventListener('input',refresh);q?.addEventListener('input',refresh);refresh();document.querySelector('#res95-export')?.addEventListener('click',()=>exportCsv(clusterRows(Number(min.value),q.value)));}
  function showCluster(key){const r=String(key||'').split('|');const box=document.querySelector('#res95-detail');if(!box)return;box.hidden=false;box.innerHTML=`<button type="button" data-res-close>×</button><span>Cluster estructural</span><h3>${esc(r[1])} · ${esc(r[2])}</h3><div class="res95-detail-kpis"><b>${num(r[4])}<small>sociedades</small></b><b>${money(r[3])}<small>capital común</small></b></div><p><b>Fecha:</b> ${esc(r[0])}</p><p>${esc(r[5])}</p><div class="res95-caution">Coincidir en fecha, comuna, tipo y capital no demuestra propietario, representante o domicilio común.</div>`;box.querySelector('[data-res-close]')?.addEventListener('click',()=>{box.hidden=true;});}
  function exportCsv(rows){const head=['fecha','comuna','tipo','capital_clp','n_sociedades','nota'];const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[head.join(','),...rows.map(r=>r.map(quote).join(','))].join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='atlas_res_clusters_2026.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  function render(tab='pulse'){const host=content();if(!host)return false;host.innerHTML=`<div class="res95-root" data-res95-root>${tab==='territory'?territory():tab==='phenomena'?phenomena():tab==='structure'?structure():pulse()}</div>`;bindTabs();if(tab==='territory')bindTerritory();if(tab==='phenomena')bindPhenomena();markActive();return true;}
  function markActive(){document.querySelectorAll('.v019-nav-btn[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='res'));}
  function open(){try{if(typeof state!=='undefined')state.view='res';}catch(_e){}const shellFn=(typeof shell==='function'?shell:window.shell);if(typeof shellFn==='function')shellFn('Empresas (RES)','Dinámica, territorio y atipicidad societaria sobre fuente RES exclusivamente.');render('pulse');markActive();try{window.AtlasCurrentUI?.refresh?.();}catch(_e){}document.dispatchEvent(new CustomEvent('atlas:routechange',{detail:{view:'res',source:'RES_0950'}}));return true;}

  let lastNavigate=null;
  function pinNavigate(){let current=null;try{current=(typeof navigate==='function'?navigate:window.navigate);}catch(_e){current=window.navigate;}if(typeof current!=='function'||current.__atlasRes0950)return false;if(current===lastNavigate)return true;const wrapped=async function(view){if(view==='res')return open();return current.apply(this,arguments);};wrapped.__atlasRes0950=true;wrapped.__base=current;lastNavigate=wrapped;try{navigate=wrapped;}catch(_e){}window.navigate=wrapped;return true;}
  document.addEventListener('click',ev=>{const trigger=ev.target?.closest?.('[data-view="res"]');if(!trigger)return;ev.preventDefault();ev.stopImmediatePropagation();open();},true);
  const observer=new MutationObserver(()=>{pinNavigate();if(document.querySelector('[data-res95-root]'))markActive();});observer.observe(document.documentElement,{childList:true,subtree:true});let tries=0;const timer=setInterval(()=>{tries++;pinNavigate();if(tries>120)clearInterval(timer);},250);
  window.AtlasRes0950={open,render,data:DATA,cutoff:CUT,version:VERSION,methodology:'RES_SOURCE_PURE_STRUCTURAL_ANOMALY_NOT_AML_RISK'};
  pinNavigate();window.dispatchEvent(new CustomEvent('atlas:nav-refresh'));
})();
