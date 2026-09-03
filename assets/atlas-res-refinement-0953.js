'use strict';
/* ATLAS AML · Empresas (RES) · refinement 0.96.5 */
(function atlasResRefinement0965(){
  if(window.__ATLAS_RES_REFINEMENT_0953__) return;
  window.__ATLAS_RES_REFINEMENT_0953__=true;
  const VERSION='0.96.5';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v||0));
  const source=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const cutoff=()=>window.AtlasRes0952?.cutoff||window.AtlasRes0950?.cutoff||'31-07-2026';
  const regions={1:'Tarapacá',2:'Antofagasta',3:'Atacama',4:'Coquimbo',5:'Valparaíso',6:'O’Higgins',7:'Maule',8:'Biobío',9:'La Araucanía',10:'Los Lagos',11:'Aysén',12:'Magallanes',13:'Metropolitana',14:'Los Ríos',15:'Arica y Parinacota',16:'Ñuble'};

  function compact(root){
    const hero=root.querySelector('.res952-hero');
    if(hero&&!root.querySelector('.res953-sourcebar')){
      const bar=document.createElement('div');bar.className='res953-sourcebar';bar.innerHTML=`<span>● RES operativo</span><i></i><b>Corte ${esc(cutoff())}</b>`;hero.replaceWith(bar);
    }
    const tab=root.querySelector('[data-res952-route="territory"]');
    if(tab){
      if(tab.textContent!=='Mapa') tab.textContent='Mapa';
      if(tab.hasAttribute('disabled')) tab.removeAttribute('disabled');
      if(tab.title!=='Abrir mapa analítico RES') tab.title='Abrir mapa analítico RES';
    }
    if(root.querySelector('#res952-temporal-chart')&&root.dataset.res953Pulse!=='1'){
      root.dataset.res953Pulse='1';const card=[...root.querySelectorAll('.res952-card')].find(x=>(x.querySelector('header span')?.textContent||'').trim().toUpperCase()==='LECTURA SEMANAL');
      if(card){const p=card.parentElement;card.remove();if(p?.querySelector('.res952-economic'))p.classList.add('res953-economic-only');}
    }
  }

  function hideLegacy(root){
    root.querySelector('.res952-kpis-phen')?.classList.add('res953-hidden-source');
    root.querySelectorAll('.res952-toolbar').forEach(x=>x.classList.add('res953-hidden-source'));
    root.querySelector('#res952-findings')?.closest('.res952-card')?.classList.add('res953-hidden-source');
    const labels=new Set(['FRECUENCIA','CONCENTRACIÓN','REPETICIÓN','COINCIDENCIA REGISTRAL']);
    root.querySelectorAll('.res952-card').forEach(x=>{if(labels.has((x.querySelector('header span')?.textContent||'').trim().toUpperCase()))x.classList.add('res953-hidden-source');});
  }

  function trigger(root,kind,term,scroll=false){
    const type=root.querySelector('#res952-phen-type'),q=root.querySelector('#res952-phen-q'),box=root.querySelector('#res952-findings');if(!type||!q||!box)return;
    type.value=kind;type.dispatchEvent(new Event('change',{bubbles:true}));q.value=term||'';q.dispatchEvent(new Event('input',{bubbles:true}));
    const needle=String(term||'').toLocaleLowerCase('es-CL');const rows=[...box.querySelectorAll(`[data-kind="${kind}"]`)];(rows.find(x=>!needle||(x.textContent||'').toLocaleLowerCase('es-CL').includes(needle))||rows[0])?.click();
    const ev=root.querySelector('.res953-evidence-card');ev?.animate?.([{outline:'1px solid transparent'},{outline:'1px solid color-mix(in srgb,var(--r-orange) 60%,transparent)'},{outline:'1px solid transparent'}],{duration:850});
    if(scroll)requestAnimationFrame(()=>ev?.scrollIntoView?.({behavior:'smooth',block:'start'}));
  }

  function matrixRow(kind,term,title,sub,on){
    const labels=['Fecha','Comuna','Tipo','Capital','Territorio','Ritmo'];const n=on.filter(Boolean).length;
    return `<button type="button" class="res953-convergence-row${kind==='cluster'?' active':''}" data-res953-kind="${kind}" data-res953-term="${esc(term)}" data-res953-radar="${kind}" aria-pressed="${kind==='cluster'?'true':'false'}"><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>${on.map((v,i)=>`<span class="res953-signal-dot${v?' on':''}" title="${v?'Integra señal':'No integra esta regla'}: ${labels[i]}">${v?'●':'·'}</span>`).join('')}<span class="res953-signal-count">${n}/6</span></button>`;
  }

  function select(section,kind){
    const d=section.__radar?.[kind],box=section.querySelector('.res953-detail');if(!d||!box)return;
    section.querySelectorAll('[data-res953-radar]').forEach(x=>{const a=x.dataset.res953Radar===kind;x.classList.toggle('active',a);x.setAttribute('aria-pressed',a?'true':'false');});
    box.innerHTML=`<span class="res953-detail-kicker">HALLAZGO SELECCIONADO · ${esc(d.kicker)}</span><h4>${esc(d.title)}</h4><div class="res953-detail-metric"><b>${esc(d.metric)}</b><span>${esc(d.label)}</span></div><p class="res953-detail-fact">${esc(d.fact)}</p><div class="res953-detail-signals">${d.signals.map(x=>`<span>${esc(x)}</span>`).join('')}</div><button type="button" class="res953-detail-action" data-res953-kind="${d.kind}" data-res953-term="${esc(d.term)}" data-res953-scroll="1">Abrir sociedades / evidencia asociada →</button><span class="res953-detail-note">Convergencia para ordenar revisión; no equivale a clasificación de riesgo LA/FT.</span>`;
  }

  function build(root){
    if(!root.querySelector('#res952-findings')||root.querySelector('.res953-phenomenon-command'))return;
    const d=source();if(!d)return;
    const a=d.anomalies?.[0]||[3,'Feb',214,136.8,56.5,7.27],c=d.clusters?.[0]||['2026-07-01',13,'PROVIDENCIA','SpA',1000000,31],cd=d.communeDays?.[0]||['2026-02-03','PROVIDENCIA',76];
    const nat=(d.criticalDates||[]).find(r=>r[0]===cd[0])||[cd[0],0],capital=d.capitals?.[0]||[1000000,38654,29.91],commune=d.communeGrowth?.[0]||['CASTRO',462,297,55.6];
    const share=nat[1]?cd[2]/nat[1]*100:0,region=regions[a[0]]||`Región ${a[0]}`;
    const detail={
      cluster:{kind:'cluster',term:c[0],kicker:'Coincidencia registral',title:`${c[2]} · ${c[0]}`,metric:`${num(c[5])} sociedades`,label:`${c[3]} · capital ${money(c[4])}`,signals:['fecha','comuna','tipo societario','capital'],fact:'Coinciden cuatro dimensiones registrales observables en un mismo grupo. Es la mayor convergencia dimensional de los hallazgos mostrados.'},
      date:{kind:'date',term:cd[1],kicker:'Temporal + comunal',title:`${cd[1]} · ${cd[0]}`,metric:`${pct(share)} del día`,label:`${num(cd[2])} sociedades en la comuna · ${num(nat[1])} nacional`,signals:['fecha crítica','comuna-día'],fact:'La concentración comunal coincide con una fecha de alta intensidad nacional. La proporción usa directamente el total comunal sobre el total nacional del mismo día.'},
      anomaly:{kind:'anomaly',term:region,kicker:'Desvío territorial',title:`${region} · ${a[1]} 2026`,metric:`z ${Number(a[5]).toFixed(2)}`,label:`${num(a[2])} constituciones · +${pct(a[4])} sobre baseline`,signals:['desvío regional','aceleración'],fact:`El volumen observado (${num(a[2])}) supera el baseline (${Number(a[3]).toLocaleString('es-CL')}) y combina desviación territorial con aceleración.`}
    };
    const s=document.createElement('section');s.className='res953-phenomenon-command';s.__radar=detail;
    s.innerHTML=`<header><div><span>LECTURA EJECUTIVA AML · RES</span><h3>Señales que requieren revisión</h3></div><p>Prioriza convergencias registrales y cambios de comportamiento. Cada señal es exploratoria y debe validarse con evidencia.</p></header>
      <div class="res953-alert-grid">
        <button type="button" class="res953-alert" data-res953-kind="cluster" data-res953-term="${esc(c[0])}"><span class="res953-alert-index">01</span><span class="res953-alert-body"><span class="res953-alert-kicker">Mayor convergencia</span><span class="res953-alert-title">${esc(c[2])} · ${esc(c[0])}</span><span class="res953-alert-metric"><b>${num(c[5])}</b><span>${esc(c[3])} · ${esc(money(c[4]))}</span></span><span class="res953-alert-copy">Coinciden fecha, comuna, tipo societario y capital.</span><span class="res953-alert-action"><strong>Revisar:</strong> sociedades del grupo y coincidencias registrales adicionales.</span></span></button>
        <button type="button" class="res953-alert" data-res953-kind="date" data-res953-term="${esc(cd[1])}"><span class="res953-alert-index">02</span><span class="res953-alert-body"><span class="res953-alert-kicker">Temporal + comunal</span><span class="res953-alert-title">${esc(cd[1])} · ${esc(cd[0])}</span><span class="res953-alert-metric"><b>${num(cd[2])}</b><span>${pct(share)} del flujo nacional del día</span></span><span class="res953-alert-copy">Concentración comunal sobre una fecha de alta intensidad nacional.</span><span class="res953-alert-action"><strong>Revisar:</strong> atributos comunes y composición del cohorte.</span></span></button>
        <button type="button" class="res953-alert" data-res953-kind="anomaly" data-res953-term="${esc(region)}"><span class="res953-alert-index">03</span><span class="res953-alert-body"><span class="res953-alert-kicker">Desvío territorial</span><span class="res953-alert-title">${esc(region)} · ${esc(a[1])} 2026</span><span class="res953-alert-metric"><b>z ${Number(a[5]).toFixed(2)}</b><span>${num(a[2])} constituciones · +${pct(a[4])}</span></span><span class="res953-alert-copy">Desvío regional combinado con aceleración temporal.</span><span class="res953-alert-action"><strong>Revisar:</strong> composición del cohorte antes de escalar.</span></span></button>
      </div>
      <div class="res953-convergence"><article class="res953-convergence-panel"><div class="res953-panel-head"><b>Radar de convergencia</b><span>matriz dinámica de señales observables</span></div><div class="res953-radar-summary"><span><b>3</b> hallazgos priorizados</span><span><b>8</b> señales observables</span><span><b>4/6</b> máxima convergencia</span></div><div class="res953-convergence-workspace"><div><div class="res953-matrix"><div class="res953-matrix-head"><span>Hallazgo</span><span>Fecha</span><span>Comuna</span><span>Tipo</span><span>Capital</span><span>Territ.</span><span>Ritmo</span><span>Señales</span></div><div class="res953-convergence-list">${matrixRow('cluster',c[0],`${c[2]} · ${c[0]}`,`${c[3]} · ${money(c[4])}`,[1,1,1,1,0,0])}${matrixRow('date',cd[1],`${cd[1]} · ${cd[0]}`,`${num(cd[2])} sociedades en la comuna`,[1,1,0,0,0,0])}${matrixRow('anomaly',region,`${region} · ${a[1]}`,`${num(a[2])} constituciones`,[0,0,0,0,1,1])}</div></div><div class="res953-radar-legend"><span><i class="on"></i> integra la regla</span><span><i></i> dimensión no usada</span></div></div><aside class="res953-detail" aria-live="polite"></aside></div></article>
      <aside class="res953-context-panel"><div class="res953-panel-head"><b>Contexto para no sobrerreaccionar</b><span>señales débiles aisladas</span></div><div class="res953-context-list"><div class="res953-context-item"><span>Capital ${esc(money(capital[0]))}<br>Frecuente; aporta contexto, no especificidad por sí solo.</span><b>${pct(capital[2])}<br><small>${num(capital[1])} sociedades</small></b></div><div class="res953-context-item"><span>${esc(commune[0])}<br>Crecimiento comunal: observar si converge con otras señales.</span><b>+${pct(commune[3])}<br><small>${num(commune[1])} vs ${num(commune[2])}</small></b></div><div class="res953-context-item"><span>Top 10 comunas<br>Concentración nacional YTD.</span><b>${pct(d.top10CommuneShare)}</b></div></div><p class="res953-context-note">La prioridad analítica aumenta cuando dimensiones independientes convergen. Un capital redondo o un día intenso, aislados, no son señal AML suficiente.</p></aside></div>`;
    (root.querySelector('.res952-tabs')||root.firstElementChild)?.insertAdjacentElement('afterend',s);select(s,'cluster');hideLegacy(root);
    const method=root.querySelector('.res952-method');if(method){method.classList.add('res953-method-note');method.innerHTML='<b>Criterio de uso</b><span>RES es la fuente usada para detectar estos fenómenos. El enriquecimiento SII permanece separado y no modifica la priorización.</span>';}
    const evidence=root.querySelector('#res952-company-list')?.closest('.res952-company-card');if(evidence){evidence.classList.add('res953-evidence-card');const h=evidence.querySelector('header h3');if(h)h.textContent='Sociedades asociadas a la señal seleccionada';const t=evidence.querySelector('header span');if(t)t.textContent='EVIDENCIA · DRILL-DOWN RES';}
    s.addEventListener('click',e=>{const x=e.target.closest('[data-res953-kind]');if(!x)return;e.preventDefault();const kind=x.dataset.res953Kind;if(detail[kind])select(s,kind);trigger(root,kind,x.dataset.res953Term||'',x.dataset.res953Scroll==='1');});
  }

  let routeTimer=0;
  const retryTimers=new Set();
  function apply(){
    const root=document.querySelector('[data-res952-root]');if(!root)return false;
    compact(root);build(root);
    window.__ATLAS_RES_REFINEMENT__={version:VERSION,status:'ready',phenomena:'interactive-convergence-matrix',companyDrawer:'opaque-theme-safe',observer:'disabled-bounded-init',checkedAt:new Date().toISOString()};
    return true;
  }
  function clearRetries(){
    retryTimers.forEach(id=>clearTimeout(id));
    retryTimers.clear();
  }
  function runBoundedInit(){
    clearRetries();
    [0,120,400,900,1800,3200].forEach(ms=>{
      const id=setTimeout(()=>{retryTimers.delete(id);apply();},ms);
      retryTimers.add(id);
    });
  }
  function scheduleRouteInit(){
    clearTimeout(routeTimer);
    routeTimer=setTimeout(runBoundedInit,40);
  }
  runBoundedInit();
  document.addEventListener('atlas:routechange',scheduleRouteInit);
})();
