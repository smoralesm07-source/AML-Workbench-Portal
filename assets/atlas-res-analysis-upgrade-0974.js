'use strict';
/* ATLAS AML · Empresas (RES) · analyst upgrade 0.98.0 */
(function atlasResAnalysisUpgrade0980(){
  if(window.__ATLAS_RES_ANALYSIS_UPGRADE_0980__) return;
  window.__ATLAS_RES_ANALYSIS_UPGRADE_0980__=true;
  window.__ATLAS_RES_ANALYSIS_UPGRADE_0974__=true;

  const VERSION='0.98.0';
  const START='2026-01-01',END='2026-07-31';
  const MONTHS=[['01','ENE'],['02','FEB'],['03','MAR'],['04','ABR'],['05','MAY'],['06','JUN'],['07','JUL']];
  const REGIONS={1:'Tarapacá',2:'Antofagasta',3:'Atacama',4:'Coquimbo',5:'Valparaíso',6:'O’Higgins',7:'Maule',8:'Biobío',9:'La Araucanía',10:'Los Lagos',11:'Aysén',12:'Magallanes',13:'Metropolitana',14:'Los Ríos',15:'Arica y Parinacota',16:'Ñuble'};
  const source=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const money=v=>v==null||v===''?'—':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v));
  const regionName=v=>REGIONS[Number(v)]||`Región ${v}`;
  const median=arr=>{const x=arr.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2;};
  const share=(n,d)=>d?100*n/d:0;

  function exactFinding(root,kind,key,term,control){
    const type=root.querySelector('#res952-phen-type');
    const q=root.querySelector('#res952-phen-q');
    const box=root.querySelector('#res952-findings');
    if(!type||!q||!box)return false;
    type.value=kind;
    type.dispatchEvent(new Event('change',{bubbles:true}));
    q.value=term||'';
    q.dispatchEvent(new Event('input',{bubbles:true}));
    const findExact=()=>[...box.querySelectorAll('[data-kind][data-key]')].find(x=>x.dataset.kind===kind&&String(x.dataset.key)===String(key));
    let target=findExact();
    if(!target){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));target=findExact();}
    if(!target)target=[...box.querySelectorAll(`[data-kind="${kind}"]`)][0]||null;
    if(!target)return false;
    root.querySelectorAll('[data-res974-kind].active').forEach(x=>x.classList.remove('active'));
    control?.classList.add('active');
    target.click();
    const card=root.querySelector('.res970-evidence-card');
    if(card){card.classList.remove('res974-evidence-pulse');requestAnimationFrame(()=>card.classList.add('res974-evidence-pulse'));setTimeout(()=>card.scrollIntoView?.({behavior:'smooth',block:'start'}),60);}
    return true;
  }

  function anomalyPanel(d){
    const rows=(d.anomalies||[]).slice(0,10);
    const zs=rows.map(r=>Number(r[5]||0)),gs=rows.map(r=>Number(r[4]||0));
    const minZ=Math.min(...zs),maxZ=Math.max(...zs),minG=Math.min(...gs),maxG=Math.max(...gs);
    const spanZ=Math.max(.01,maxZ-minZ),spanG=Math.max(.01,maxG-minG);
    const left=58,right=602,top=24,bottom=220;
    const x=z=>left+(z-minZ)/spanZ*(right-left);
    const y=g=>bottom-(g-minG)/spanG*(bottom-top);
    const vGrid=[0,.25,.5,.75,1].map(f=>{const xx=left+f*(right-left);const z=minZ+f*spanZ;return `<line x1="${xx.toFixed(1)}" y1="${top}" x2="${xx.toFixed(1)}" y2="${bottom}"/><text x="${xx.toFixed(1)}" y="244" text-anchor="middle">z ${z.toFixed(1)}</text>`;}).join('');
    const hGrid=[0,.25,.5,.75,1].map(f=>{const yy=bottom-f*(bottom-top);const g=minG+f*spanG;return `<line x1="${left}" y1="${yy.toFixed(1)}" x2="${right}" y2="${yy.toFixed(1)}"/><text x="48" y="${(yy+3).toFixed(1)}" text-anchor="end">+${Math.round(g)}%</text>`;}).join('');
    const points=rows.map((r,i)=>`<g class="res974-scatter-point" transform="translate(${x(Number(r[5])).toFixed(1)} ${y(Number(r[4])).toFixed(1)})" data-res974-kind="anomaly" data-res974-key="${i}" data-res974-term="${esc(regionName(r[0]))}" tabindex="0" role="button" aria-label="${esc(regionName(r[0]))}, ${esc(r[1])}, z ${Number(r[5]).toFixed(2)}, crecimiento ${pct(r[4])}"><circle r="${Math.max(8,Math.min(14,7+Math.sqrt(Number(r[2]||0))/7)).toFixed(1)}"></circle><text text-anchor="middle" y="3">${i+1}</text><title>${esc(regionName(r[0]))} · ${esc(r[1])} 2026 · z ${Number(r[5]).toFixed(2)} · +${pct(r[4])}</title></g>`).join('');
    return `<article class="res970-panel res974-panel res974-anomaly"><header><div><span>DESVÍOS REGIONALES</span><h3>Qué tan excepcional y acelerado es el cambio</h3></div><em>z-score × crecimiento</em></header><p class="res974-panel-note">Cada punto es un mes-región. Arriba y a la derecha implica mayor aceleración y mayor excepcionalidad estadística. Selecciona un punto para individualizar sociedades.</p><svg class="res974-scatter" viewBox="0 0 630 258" role="img" aria-label="Dispersión de desvíos regionales"><g class="res974-scatter-grid">${vGrid}${hGrid}</g>${points}<text class="res974-axis-label" x="330" y="257" text-anchor="middle">mayor excepcionalidad estadística →</text><text class="res974-axis-label" transform="translate(11 137) rotate(-90)" text-anchor="middle">mayor aceleración →</text></svg></article>`;
  }

  function communePanel(d){
    const rows=(d.communeGrowth||[]).slice(0,9);
    const maxDelta=Math.max(...rows.map(r=>Number(r[1])-Number(r[2])),1);
    return `<article class="res970-panel res974-panel"><header><div><span>CAMBIO COMUNAL</span><h3>Dónde se agregan más sociedades</h3></div><em>incremento neto · ene–jul</em></header><p class="res974-panel-note">El largo representa nuevas constituciones adicionales frente a 2025; el porcentaje muestra la velocidad del cambio.</p><div class="res974-delta-list">${rows.map((r,i)=>{const delta=Number(r[1])-Number(r[2]);return `<button type="button" data-res974-kind="commune" data-res974-key="${i}" data-res974-term="${esc(r[0])}"><span><b>${esc(r[0])}</b><small>${num(r[2])} → ${num(r[1])}</small></span><progress max="${maxDelta}" value="${delta}">${delta}</progress><strong>+${num(delta)}<small>+${pct(r[3])}</small></strong></button>`;}).join('')}</div></article>`;
  }

  function datePanel(d){
    const indexed=(d.criticalDates||[]).slice(0,15).map((r,i)=>({key:i,date:r[0],value:Number(r[1]||0)}));
    const max=Math.max(...indexed.map(x=>x.value),1);
    return `<article class="res970-panel res974-panel res974-date"><header><div><span>INTENSIDAD DIARIA</span><h3>Cuándo se concentran los picos</h3></div><em>Top 15 · distribución mensual</em></header><p class="res974-panel-note">En lugar de repetir un ranking, el calendario muestra en qué meses se acumulan los días de mayor flujo y permite abrir cada fecha.</p><div class="res974-month-grid">${MONTHS.map(([m,label])=>{const items=indexed.filter(x=>x.date.slice(5,7)===m);const peak=Math.max(...items.map(x=>x.value),0);return `<section><header><b>${label}</b><span>${items.length} pico${items.length===1?'':'s'}</span></header><div>${items.length?items.map(x=>{const level=Math.max(1,Math.min(5,Math.ceil(x.value/max*5)));return `<button type="button" class="l${level}" data-res974-kind="date" data-res974-key="${x.key}" data-res974-term="${esc(x.date)}"><time>${esc(x.date.slice(8,10))}</time><b>${num(x.value)}</b></button>`;}).join(''):'<small>sin fechas Top 15</small>'}</div>${peak?`<footer>máx. ${num(peak)}</footer>`:''}</section>`;}).join('')}</div></article>`;
  }

  function capitalPanel(d){
    const rows=(d.capitals||[]).slice(0,8);
    const topShare=Math.max(...rows.map(r=>Number(r[2]||0)),1);
    const cum4=rows.slice(0,4).reduce((s,r)=>s+Number(r[2]||0),0);
    const cum8=rows.reduce((s,r)=>s+Number(r[2]||0),0);
    return `<article class="res970-panel res974-panel"><header><div><span>REPETICIÓN DE CAPITAL</span><h3>Cuánto concentra la estandarización de montos</h3></div><em>2026 YTD</em></header><div class="res974-capital-summary"><span><b>${pct(rows[0]?.[2]||0)}</b><small>capital más frecuente</small></span><span><b>${pct(cum4)}</b><small>Top 4 capitales</small></span><span><b>${pct(cum8)}</b><small>Top 8 capitales</small></span></div><div class="res974-capital-list">${rows.map((r,i)=>`<button type="button" data-res974-kind="capital" data-res974-key="${i}" data-res974-term="${esc(money(r[0]))}"><span><b>${money(r[0])}</b><small>${num(r[1])} sociedades</small></span><progress max="${topShare}" value="${Number(r[2])}">${Number(r[2])}</progress><strong>${pct(r[2])}</strong></button>`).join('')}</div></article>`;
  }

  function patchExecutiveAndClusters(root,d){
    const exec=[...root.querySelectorAll('.res970-exec-grid>button')];
    const specs=[['cluster','0',d.clusters?.[0]?.[0]||''],['anomaly','0',regionName(d.anomalies?.[0]?.[0]||'')],['date','c0',d.communeDays?.[0]?.[1]||''],['commune','0',d.communeGrowth?.[0]?.[0]||'']];
    exec.forEach((b,i)=>{const s=specs[i];if(!s)return;b.removeAttribute('data-res970-kind');b.removeAttribute('data-res970-term');b.dataset.res974Kind=s[0];b.dataset.res974Key=s[1];b.dataset.res974Term=s[2];b.title='Abrir sociedades asociadas';});
    [...root.querySelectorAll('.res970-cluster-list>button')].forEach((b,i)=>{const r=d.clusters?.[i];if(!r)return;b.removeAttribute('data-res970-kind');b.removeAttribute('data-res970-term');b.dataset.res974Kind='cluster';b.dataset.res974Key=String(i);b.dataset.res974Term=r[0];});
  }

  function upgradePhenomena(){
    const root=document.querySelector('[data-res952-root].res952-root');
    const d=source();
    const grid=root?.querySelector('.res970-analytics-grid');
    if(!root||!d||!grid)return false;
    if(grid.dataset.res974==='1')return true;
    grid.dataset.res974='1';
    grid.innerHTML=`${anomalyPanel(d)}${communePanel(d)}${datePanel(d)}${capitalPanel(d)}`;
    patchExecutiveAndClusters(root,d);
    root.querySelector('.res970-title p')?.insertAdjacentHTML('beforeend',' <strong class="res974-click-hint">Cada visual responde una pregunta distinta y abre evidencia societaria.</strong>');
    window.__ATLAS_RES_FINDINGS_VISUALS__={version:VERSION,status:'ready',design:'complementary-views',evidence:'exact-key-drilldown',checkedAt:new Date().toISOString()};
    return true;
  }

  function activityCount(a){
    const candidates=[a?.count,a?.incidences,a?.incidenceCount,a?.incidence_count,a?.total,a?.value,a?.n];
    const hit=candidates.find(v=>Number.isFinite(Number(v))&&Number(v)>0);
    return hit==null?null:Number(hit);
  }

  function economyShell(card,st){
    const activities=(st?.model?.activities||[]).filter(a=>a?.code);
    if(!activities.length)return false;
    const legacy=card.textContent||'';
    const totalMatch=legacy.match(/([\d.]+)\s+sociedades\s+constituidas/i);
    const coverageMatch=legacy.match(/([\d,]+)%\s+cobertura/i);
    const knownTotal=activities.reduce((s,a)=>s+(activityCount(a)||0),0);
    const totalLabel=totalMatch?.[1]||(knownTotal?num(knownTotal):'—');
    const coverageLabel=coverageMatch?.[1]?`${coverageMatch[1]}%`:'cobertura parcial';
    if(!st.selected||!activities.some(a=>a.code===st.selected))st.selected=activities[0].code;
    card.dataset.res980='1';
    card.classList.add('res980-economy');
    card.innerHTML=`
      <header class="res980-econ-head">
        <div><span>ENRIQUECIMIENTO EXTERNO · RES ↔ SII</span><h2>Perfil estructural de nuevas sociedades</h2><p>Selecciona una actividad económica para analizar <b>cuándo</b> se constituyen, <b>dónde</b> se concentran, <b>qué forma societaria</b> adoptan y <b>cómo declaran capital</b>. Las sociedades que sustentan el hallazgo quedan visibles para revisión.</p></div>
        <div class="res980-econ-context"><strong>${esc(totalLabel)}</strong><small>sociedades con actividad SII materializada</small><em>${esc(coverageLabel)} YTD</em></div>
      </header>
      <div class="res980-econ-layout">
        <aside class="res980-activity-rail">
          <header><div><span>1</span><b>Elegir actividad SII</b></div><label><span>Buscar</span><input type="search" data-res980-activity-search placeholder="código o actividad"></label></header>
          <div class="res980-activity-list" data-res980-activity-list>${activities.map(a=>{const c=activityCount(a);return `<button type="button" data-res980-activity="${esc(a.code)}" class="${a.code===st.selected?'active':''}"><code>${esc(a.code)}</code><span><b>${esc(a.name||a.activity_name||'Actividad económica')}</b>${c?`<small>${num(c)} incidencias materializadas</small>`:'<small>seleccionar para perfilar sociedades</small>'}</span><i>›</i></button>`;}).join('')}</div>
        </aside>
        <main class="res980-analysis">
          <section class="res980-focus" data-res980-focus><div class="res980-loading">Preparando perfil de sociedades…</div></section>
        </main>
      </div>
      <section class="res980-evidence" data-res980-evidence><div class="res980-loading">La evidencia societaria aparecerá aquí al seleccionar una actividad.</div></section>
      <footer class="res980-econ-note"><b>Cómo leerlo:</b> este módulo describe la estructura observada en el cruce RES–SII; no asigna riesgo AML. La cobertura SII es parcial y el análisis se limita a sociedades efectivamente materializadas en el cruce.</footer>`;
    return true;
  }

  function grouped(rows,keyFn){
    const m=new Map();
    rows.forEach(r=>{const k=keyFn(r);if(!k)return;m.set(k,(m.get(k)||0)+1);});
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }

  function monthlySeries(rows){
    return MONTHS.map(([m,label])=>({m,label,n:rows.filter(r=>String(r.constitution_date||'').slice(5,7)===m).length}));
  }

  function temporalSvg(series){
    const W=520,H=170,left=32,right=508,top=18,bottom=137;
    const max=Math.max(...series.map(x=>x.n),1);
    const step=(right-left)/series.length;
    const bw=Math.min(42,step*.56);
    const grid=[0,.5,1].map(f=>{const y=bottom-f*(bottom-top);return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text x="27" y="${y+3}" text-anchor="end">${Math.round(max*f)}</text>`;}).join('');
    const bars=series.map((x,i)=>{const h=x.n/max*(bottom-top),cx=left+step*(i+.5),y=bottom-h;return `<g><rect class="res980-month-bar" x="${(cx-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,h).toFixed(1)}" rx="4"><title>${esc(x.label)} · ${num(x.n)} sociedades</title></rect><text class="res980-month-value" x="${cx.toFixed(1)}" y="${Math.max(11,y-5).toFixed(1)}" text-anchor="middle">${num(x.n)}</text><text class="res980-month-label" x="${cx.toFixed(1)}" y="155" text-anchor="middle">${esc(x.label)}</text></g>`;}).join('');
    return `<svg class="res980-temporal-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Constituciones mensuales"><g class="res980-chart-grid">${grid}</g>${bars}</svg>`;
  }

  function capitalBands(rows){
    const bands=[['Hasta $500 mil',v=>v>0&&v<=500000],['$500 mil–$1 millón',v=>v>500000&&v<=1000000],['$1–$5 millones',v=>v>1000000&&v<=5000000],['$5–$20 millones',v=>v>5000000&&v<=20000000],['Más de $20 millones',v=>v>20000000]];
    const valid=rows.map(r=>Number(r.capital)).filter(v=>Number.isFinite(v)&&v>0);
    return {valid,rows:bands.map(([label,fn])=>[label,valid.filter(fn).length])};
  }

  function profileHtml(act,rows,totalCount){
    const unique=[];const seen=new Set();
    rows.forEach(r=>{const k=String(r.rut||`${r.legal_name}|${r.constitution_date}`);if(!seen.has(k)){seen.add(k);unique.push(r);}});
    const n=unique.length;
    const months=monthlySeries(unique);
    const peak=months.reduce((a,b)=>b.n>a.n?b:a,months[0]||{label:'—',n:0});
    const communes=grouped(unique,r=>String(r.social_commune||'').trim()).slice(0,6);
    const types=grouped(unique,r=>String(r.company_code||'').trim()).slice(0,6);
    const capitals=capitalBands(unique);
    const medCapital=median(capitals.valid);
    const lags=unique.map(r=>{const a=new Date(r.constitution_date),b=new Date(r.sii_approval_date);const d=(b-a)/86400000;return Number.isFinite(d)&&d>=0&&d<3650?d:NaN;}).filter(Number.isFinite);
    const medLag=median(lags);
    const geoBase=unique.filter(r=>String(r.social_commune||'').trim()).length;
    const topCommune=communes[0]||['Sin comuna',0];
    const typeBase=unique.filter(r=>String(r.company_code||'').trim()).length;
    const sampled=Number(totalCount||n)>n;
    const profileBase=n||1;
    const maxComm=Math.max(...communes.map(x=>x[1]),1);
    const maxType=Math.max(...types.map(x=>x[1]),1);
    const maxBand=Math.max(...capitals.rows.map(x=>x[1]),1);
    return `
      <header class="res980-selected-head"><div><span>2 · PERFIL DE LA ACTIVIDAD</span><h3><code>${esc(act.code)}</code> ${esc(act.name||act.activity_name||'Actividad económica')}</h3><p>${num(totalCount||n)} sociedades en el cruce 2026${sampled?` · perfil calculado sobre ${num(n)} registros cargados`:''}.</p></div><span class="res980-source-badge">RES + SII</span></header>
      <div class="res980-kpis">
        <article><span>Sociedades</span><b>${num(totalCount||n)}</b><small>universo de la actividad</small></article>
        <article><span>Mes de mayor flujo</span><b>${esc(peak.label)}</b><small>${num(peak.n)} constituciones</small></article>
        <article><span>Mayor concentración</span><b>${pct(share(topCommune[1],geoBase))}</b><small>${esc(topCommune[0])}</small></article>
        <article><span>Capital mediano</span><b>${medCapital==null?'—':money(medCapital)}</b><small>${num(capitals.valid.length)} con capital utilizable</small></article>
        <article><span>Constitución → SII</span><b>${medLag==null?'—':`${Math.round(medLag)} días`}</b><small>mediana en ${num(lags.length)} casos</small></article>
      </div>
      <div class="res980-profile-grid">
        <article class="res980-insight-card res980-temporal"><header><div><span>RITMO</span><h4>Constituciones por mes</h4></div><em>¿Cuándo?</em></header>${temporalSvg(months)}<p>Permite distinguir concentración temporal de un simple volumen acumulado.</p></article>
        <article class="res980-insight-card"><header><div><span>TERRITORIO</span><h4>Comunas con mayor presencia</h4></div><em>¿Dónde?</em></header><div class="res980-ranked-bars">${communes.length?communes.map(([k,v],i)=>`<div><span><b>${i+1}. ${esc(k)}</b><small>${num(v)} · ${pct(share(v,geoBase))}</small></span><progress max="${maxComm}" value="${v}">${v}</progress></div>`).join(''):'<p>Sin comuna materializada.</p>'}</div><p>${geoBase?`${num(geoBase)} sociedades con comuna social disponible.`:'Sin cobertura territorial para esta actividad.'}</p></article>
        <article class="res980-insight-card"><header><div><span>ESTRUCTURA LEGAL</span><h4>Formas societarias observadas</h4></div><em>¿Qué vehículo?</em></header><div class="res980-ranked-bars">${types.length?types.map(([k,v],i)=>`<div><span><b>${esc(k)}</b><small>${num(v)} · ${pct(share(v,typeBase))}</small></span><progress max="${maxType}" value="${v}">${v}</progress></div>`).join(''):'<p>Sin tipo societario materializado.</p>'}</div><p>${types.length?`${num(types.length)} formas societarias visibles en el perfil cargado.`:'Sin información de tipo.'}</p></article>
        <article class="res980-insight-card"><header><div><span>CAPITAL DECLARADO</span><h4>Distribución por tramos</h4></div><em>¿Con qué escala?</em></header><div class="res980-ranked-bars res980-capital-bands">${capitals.rows.map(([k,v])=>`<div><span><b>${esc(k)}</b><small>${num(v)} · ${pct(share(v,capitals.valid.length||profileBase))}</small></span><progress max="${maxBand}" value="${v}">${v}</progress></div>`).join('')}</div><p>${num(capitals.valid.length)} de ${num(n)} sociedades con capital positivo utilizable.</p></article>
      </div>`;
  }

  function evidenceHtml(card){
    const all=card.__res980Rows||[];
    const q=String(card.__res980Query||'').toLocaleLowerCase('es');
    const type=String(card.__res980Type||'');
    const commune=String(card.__res980Commune||'');
    const filtered=all.filter(r=>{
      const text=[r.legal_name,r.rut,r.social_commune,r.company_code].join(' ').toLocaleLowerCase('es');
      return (!q||text.includes(q))&&(!type||String(r.company_code||'')===type)&&(!commune||String(r.social_commune||'')===commune);
    });
    const limit=card.__res980Limit||80;
    const shown=filtered.slice(0,limit);
    const types=grouped(all,r=>String(r.company_code||'').trim()).map(x=>x[0]);
    const communes=grouped(all,r=>String(r.social_commune||'').trim()).map(x=>x[0]);
    card.__res980Visible=shown;
    return `<header class="res980-evidence-head"><div><span>3 · SOCIEDADES DETRÁS DEL HALLAZGO</span><h3>Revisión societaria directa</h3><p>Filtra el universo y abre cualquier fila para revisar RES + contexto tributario SII.</p></div><strong>${num(filtered.length)}<small> coincidencias</small></strong></header>
      <div class="res980-evidence-tools"><label><span>Buscar sociedad</span><input type="search" data-res980-company-search value="${esc(card.__res980Query||'')}" placeholder="RUT, razón social, comuna o tipo"></label><label><span>Tipo</span><select data-res980-company-type><option value="">Todos</option>${types.map(x=>`<option value="${esc(x)}" ${x===type?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label><span>Comuna</span><select data-res980-company-commune><option value="">Todas</option>${communes.slice(0,80).map(x=>`<option value="${esc(x)}" ${x===commune?'selected':''}>${esc(x)}</option>`).join('')}</select></label></div>
      ${shown.length?`<div class="res980-company-head"><span>Sociedad</span><span>Constitución</span><span>Tipo</span><span>Capital</span><span>Comuna</span></div><div class="res980-company-list">${shown.map((r,i)=>`<button type="button" data-res980-company="${i}"><span><b>${esc(r.legal_name||'Sin razón social')}</b><small>${esc(r.rut||'—')}</small></span><time>${esc(String(r.constitution_date||'').slice(0,10)||'—')}</time><em>${esc(r.company_code||'—')}</em><strong>${money(r.capital)}</strong><span>${esc(r.social_commune||'—')}</span></button>`).join('')}</div>${filtered.length>shown.length?`<button type="button" class="res980-more" data-res980-more>Mostrar ${num(Math.min(80,filtered.length-shown.length))} sociedades más</button>`:''}`:'<div class="res980-empty">No hay sociedades que coincidan con los filtros actuales.</div>'}`;
  }

  function renderEvidence(card){
    const box=card.querySelector('[data-res980-evidence]');
    if(box)box.innerHTML=evidenceHtml(card);
  }

  async function loadEconomyProfile(card,code){
    const st=card?.__res971;
    const activities=st?.model?.activities||[];
    const act=activities.find(a=>String(a.code)===String(code));
    const focus=card?.querySelector('[data-res980-focus]');
    const evidence=card?.querySelector('[data-res980-evidence]');
    if(!act||!focus||!evidence)return;
    st.selected=act.code;
    card.querySelectorAll('[data-res980-activity]').forEach(b=>b.classList.toggle('active',b.dataset.res980Activity===String(act.code)));
    card.__res980Query='';card.__res980Type='';card.__res980Commune='';card.__res980Limit=80;
    const token=(st.__res980Seq=(st.__res980Seq||0)+1);
    focus.innerHTML=`<div class="res980-loading"><b>${esc(act.code)} · ${esc(act.name||act.activity_name||'Actividad')}</b><span>Cargando perfil estructural y sociedades asociadas…</span></div>`;
    evidence.innerHTML='<div class="res980-loading">Preparando evidencia societaria…</div>';
    const client=db();
    if(!client){focus.innerHTML='<div class="res980-empty">Cliente de datos no disponible.</div>';evidence.innerHTML='';return;}
    try{
      const res=await client.from('aml_res_activity_company').select('rut,legal_name,constitution_date,registry_date,sii_approval_date,company_code,capital,social_commune,social_region,tax_commune,tax_region',{count:'exact'}).eq('activity_code',act.code).gte('constitution_date',START).lte('constitution_date',END).order('constitution_date',{ascending:true}).limit(1000);
      if(token!==st.__res980Seq)return;
      if(res?.error)throw res.error;
      const rows=Array.isArray(res?.data)?res.data:[];
      card.__res980Rows=rows;
      focus.innerHTML=profileHtml(act,rows,res?.count??rows.length);
      renderEvidence(card);
      window.__ATLAS_RES_ECONOMY_EXPLORER__={version:VERSION,status:'ready',activity:act.code,companies:res?.count??rows.length,loaded:rows.length,checkedAt:new Date().toISOString()};
    }catch(err){
      if(token!==st.__res980Seq)return;
      focus.innerHTML=`<div class="res980-empty">No fue posible construir el perfil: ${esc(err?.message||err)}</div>`;
      evidence.innerHTML='<div class="res980-empty">La evidencia societaria no está disponible para esta selección.</div>';
    }
  }

  function upgradeEconomy(){
    const card=document.querySelector('.res971-economy');
    const st=card?.__res971;
    if(!card||!st?.model?.activities?.length)return false;
    if(card.dataset.res980==='1')return true;
    if(!economyShell(card,st))return false;
    loadEconomyProfile(card,st.selected);
    return true;
  }

  async function openEconomyCompany(row){
    if(!row)return;
    let drawer=document.querySelector('#res974-econ-drawer');
    if(!drawer){drawer=document.createElement('aside');drawer.id='res974-econ-drawer';drawer.className='res974-econ-drawer';document.body.appendChild(drawer);}
    drawer.classList.add('open');
    drawer.innerHTML=`<button type="button" class="res974-drawer-close" data-res974-drawer-close>×</button><span class="res974-drawer-eyebrow">SOCIEDAD RES · ACTIVIDAD SII</span><h3>${esc(row.legal_name||'Sociedad')}</h3><p>${esc(row.rut||'—')}</p><div class="res974-drawer-kpis"><div><span>Constitución</span><b>${esc(String(row.constitution_date||'').slice(0,10)||'—')}</b></div><div><span>Tipo</span><b>${esc(row.company_code||'—')}</b></div><div><span>Capital</span><b>${money(row.capital)}</b></div></div><dl><dt>Comuna social</dt><dd>${esc(row.social_commune||'—')}</dd><dt>Región social</dt><dd>${esc(regionName(row.social_region))}</dd><dt>Comuna tributaria</dt><dd>${esc(row.tax_commune||'—')}</dd><dt>Registro RES</dt><dd>${esc(String(row.registry_date||'').slice(0,10)||'—')}</dd><dt>Materialización SII</dt><dd>${esc(String(row.sii_approval_date||'').slice(0,10)||'—')}</dd></dl><section class="res974-drawer-enrichment"><div class="res980-loading">Cargando contexto SII…</div></section>`;
    drawer.querySelector('[data-res974-drawer-close]')?.addEventListener('click',()=>drawer.classList.remove('open'));
    const client=db();
    const box=drawer.querySelector('.res974-drawer-enrichment');
    if(!client||!row.rut){if(box)box.innerHTML='<p>Sin enriquecimiento disponible.</p>';return;}
    try{
      const [reg,acts]=await Promise.all([
        client.from('aml_sii_registry_company').select('entity_id,activity_start_date,termination_date,current_status').eq('rut',row.rut).maybeSingle(),
        client.from('aml_sii_registry_activity').select('activity_code,activity_name,activity_status').eq('rut',row.rut).limit(8)
      ]);
      let latest={data:null};
      if(reg?.data?.entity_id)latest=await client.from('aml_sii_entity_year').select('commercial_year,main_activity,economic_sector,economic_subsector,sales_band_code,workers_numeric').eq('entity_id',reg.data.entity_id).order('commercial_year',{ascending:false}).limit(1).maybeSingle();
      if(!box)return;
      const ar=Array.isArray(acts?.data)?acts.data:[];
      box.innerHTML=`<header><b>Contexto tributario</b><span>SII · enriquecimiento externo</span></header><dl><dt>Inicio actividades</dt><dd>${esc(reg?.data?.activity_start_date||'—')}</dd><dt>Estado</dt><dd>${esc(reg?.data?.current_status||'—')}</dd><dt>Término de giro</dt><dd>${esc(reg?.data?.termination_date||'—')}</dd><dt>Sector</dt><dd>${esc(latest?.data?.economic_sector||'—')}</dd><dt>Subsector</dt><dd>${esc(latest?.data?.economic_subsector||'—')}</dd><dt>Actividad principal</dt><dd>${esc(latest?.data?.main_activity||ar[0]?.activity_name||'—')}</dd><dt>Ventas</dt><dd>${esc(latest?.data?.sales_band_code||'—')}</dd><dt>Trabajadores</dt><dd>${latest?.data?.workers_numeric==null?'—':num(latest.data.workers_numeric)}</dd></dl>${ar.length?`<div class="res974-drawer-acts">${ar.map(a=>`<span><code>${esc(a.activity_code)}</code>${esc(a.activity_name)}${a.activity_status?` <small>· ${esc(a.activity_status)}</small>`:''}</span>`).join('')}</div>`:''}`;
    }catch(err){if(box)box.innerHTML=`<p>No fue posible cargar contexto SII: ${esc(err?.message||err)}</p>`;}
  }

  function handleClick(e){
    const activity=e.target?.closest?.('[data-res980-activity]');
    if(activity){const card=activity.closest('.res980-economy');if(card){e.preventDefault();loadEconomyProfile(card,activity.dataset.res980Activity);}return;}
    const company=e.target?.closest?.('[data-res980-company]');
    if(company){const card=company.closest('.res980-economy');const row=card?.__res980Visible?.[Number(company.dataset.res980Company)];if(row){e.preventDefault();openEconomyCompany(row);}return;}
    const more=e.target?.closest?.('[data-res980-more]');
    if(more){const card=more.closest('.res980-economy');if(card){e.preventDefault();card.__res980Limit=(card.__res980Limit||80)+80;renderEvidence(card);}return;}
    const control=e.target?.closest?.('[data-res974-kind]');
    if(control){const root=control.closest('[data-res952-root]');if(root){e.preventDefault();e.stopPropagation();exactFinding(root,control.dataset.res974Kind,control.dataset.res974Key,control.dataset.res974Term||'',control);}return;}
  }

  function handleInput(e){
    const activitySearch=e.target?.closest?.('[data-res980-activity-search]');
    if(activitySearch){const card=activitySearch.closest('.res980-economy');const q=activitySearch.value.toLocaleLowerCase('es');card?.querySelectorAll('[data-res980-activity]').forEach(b=>{b.hidden=!!q&&!b.textContent.toLocaleLowerCase('es').includes(q);});return;}
    const card=e.target?.closest?.('.res980-economy');
    if(!card)return;
    if(e.target.matches('[data-res980-company-search]'))card.__res980Query=e.target.value||'';
    else if(e.target.matches('[data-res980-company-type]'))card.__res980Type=e.target.value||'';
    else if(e.target.matches('[data-res980-company-commune]'))card.__res980Commune=e.target.value||'';
    else return;
    card.__res980Limit=80;renderEvidence(card);
    const target=card.querySelector('[data-res980-company-search]');
    if(e.target.matches('[data-res980-company-search]')&&target){target.focus();target.setSelectionRange?.(target.value.length,target.value.length);}
  }

  function handleKey(e){
    if(!['Enter',' '].includes(e.key))return;
    const control=e.target?.closest?.('[data-res974-kind]');
    if(!control)return;
    e.preventDefault();control.click();
  }

  document.addEventListener('click',handleClick,true);
  document.addEventListener('input',handleInput,true);
  document.addEventListener('change',handleInput,true);
  document.addEventListener('keydown',handleKey,true);

  let timers=[];
  function apply(){
    timers.forEach(clearTimeout);
    timers=[0,80,220,600,1200,2200,3600].map(ms=>setTimeout(()=>{upgradePhenomena();upgradeEconomy();},ms));
  }
  apply();
  document.addEventListener('atlas:routechange',apply);
  document.addEventListener('atlas:nav-refresh',apply);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-res952-route]'))setTimeout(apply,0);},true);

  window.__ATLAS_RES_ANALYSIS_UPGRADE__={version:VERSION,status:'ready',phenomena:'four-complementary-views',findingDrilldown:'exact-key',economy:'structural-activity-explorer',economyDrilldown:'always-visible-company-evidence',checkedAt:new Date().toISOString()};
})();