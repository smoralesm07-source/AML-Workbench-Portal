'use strict';
/* ATLAS AML · IRAR sectorial + perfil IIR × IRAR. */
(function atlasReportabilityIrar(){
  const core=window.ATLAS_IRAR_CURRENT;
  const UI_VERSION='IRAR-UI-1.5';
  if(!core){console.warn('[ATLAS] IRAR authority unavailable');return;}

  function fmt(v,d=2){return Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function metricFor(row,uaf){return core.findMetric(row?.sector_name||row?.name,uaf?.__atlasIrar?.dataset);}
  function profileClass(key){return String(key||'SIN_BASE').toLowerCase().replaceAll('_','-');}
  function profileShort(metric){
    if(!metric)return 'Sin base';
    const label=metric.profile?.label||'Sin base';
    return metric.profile?.limited?`${label} · evidencia limitada`:label;
  }
  function segMeta(seg){
    const meta=V036_SEG?.[seg]||{};
    return {key:seg??'SIN_SEG',label:meta.label||meta.name||meta.title||meta.short||String(seg||'Sin segmento'),color:meta.color||'#5bb4f5'};
  }

  try{
    V036_HELP.irar={t:'IRAR · Rendimiento Analítico de ROS',b:'IRAR estima el rendimiento analítico histórico asociado al flujo sectorial de ROS. El valor observado es ROS con indicios agregados 2021–2025 / ROS enviados agregados 2021–2025. Para comparar sectores, ATLAS muestra prioritariamente un IRAR ajustado por credibilidad: combina el dato observado con el rendimiento esperado de una familia comparable, excluyendo al propio sector. Si no existen al menos cuatro pares y 100 ROS de base, usa referencia nacional leave-one-out. No es una probabilidad de conversión de una cohorte, no mide calidad individual, riesgo LA/FT ni cumplimiento.'};
    V036_HELP.irar_credibility={t:'Credibilidad estadística IRAR',b:'Peso que tienen los datos propios del sector frente al suavizamiento: ROS/(ROS+100). No es una probabilidad ni un intervalo de confianza. Con pocos ROS el valor ajustado depende más de la referencia de pares; con gran volumen converge al valor observado. Sectores con menos de 100 ROS acumulados no deben usarse como ranking principal.'};
    V036_HELP.irar_confidence=V036_HELP.irar_credibility;
    V036_HELP.reportability_profile={t:'Perfil IIR × IRAR',b:'Cruza intensidad relativa de reportabilidad 2025 (IIR) con rendimiento analítico histórico ajustado 2021–2025 relativo a pares (IRAR). Los perfiles son descriptivos y orientan revisión: intensivo–productivo, intensivo–bajo rendimiento, selectivo–productivo, baja activación o comportamiento esperado. Ningún cuadrante prueba subreporte, reporte defensivo, calidad, riesgo o incumplimiento.'};
  }catch{}

  if(typeof v0193LoadUafData==='function'){
    const baseLoad=v0193LoadUafData;
    v0193LoadUafData=async function(...args){
      const [uaf,loaded]=await Promise.all([baseLoad(...args),core.load().catch(error=>({error}))]);
      if(loaded?.dataset)uaf.__atlasIrar={...loaded,status:'ok'};
      else uaf.__atlasIrar={dataset:null,status:'degraded',error:String(loaded?.error?.message||loaded?.error||'IRAR unavailable')};
      return uaf;
    };
  }

  if(typeof v036PrepareRows==='function'){
    const basePrepare=v036PrepareRows;
    v036PrepareRows=function atlasIrarPrepareRows(uaf){
      const rows=basePrepare(uaf);
      for(const row of rows){
        const m=metricFor(row.raw||row,uaf);
        if(!Number.isFinite(Number(row.iir))&&Number.isFinite(Number(m?.iir)))row.iir=Number(m.iir);
        row.irarObserved=m?.observed_pct??null; row.irarAdjusted=m?.adjusted_pct??null; row.irarPeer=m?.peer_expected_pct??null; row.irarRelative=m?.relative_peer??null;
        row.irarCredibility=m?.confidence_pct??0; row.irarConfidence=row.irarCredibility; row.irarCredibilityBand=m?.confidence_band||'baja'; row.irarConfidenceBand=row.irarCredibilityBand;
        row.irarScore=m?.score??50; row.irarFamily=m?.family?.label||'Sin familia'; row.irarPeerSource=m?.peer_source||'sin_base'; row.irarPeerCount=m?.peer_count??0; row.irarPeerRos=m?.peer_ros??0;
        row.irarRankingEligible=Boolean(m?.ranking_eligible); row.reportabilityProfile=m?.profile||{key:'SIN_BASE',label:'Sin base suficiente'};
        if(row.marks&&m?.profile?.key&&m.profile.key!=='SIN_BASE')row.marks=[...new Set([...row.marks,`perfil_${m.profile.key.toLowerCase()}`])];
      }
      return rows;
    };
  }

  if(typeof v036Dashboard==='function'){
    const baseDashboard=v036Dashboard;
    v036Dashboard=function atlasIrarDashboard(ctx){
      let html=baseDashboard(ctx);
      if(!html.includes('data-v036-sort="irarAdjusted"')){
        const iirHeader=/(<button data-v036-sort="iir"[^>]*>.*?<\/button>)/;
        if(iirHeader.test(html))html=html.replace(iirHeader,`$1<button data-v036-sort="irarAdjusted">IRAR ${typeof v036Help==='function'?v036Help('irar'):''}</button>`);
      }
      html=html.replace(/ICR\s*(?:UAF)?/g,'IRAR');
      html=html.replace('Análisis de reportabilidad · silencios por industria','Análisis de reportabilidad · intensidad y rendimiento por industria');
      html=html.replace('Los filtros gobiernan la matriz; cada sector abre un dossier explicativo en el mismo lugar.','Los filtros gobiernan la matriz; IIR describe intensidad relativa 2025 e IRAR el rendimiento analítico ajustado 2021–2025. Cada sector abre un dossier explicativo en el mismo lugar.');
      return html;
    };
  }

  function irarCell(row){
    if(!Number.isFinite(Number(row?.irarAdjusted)))return '<div class="v036-mxn strong atlas-irar" data-v036-tip="IRAR · Rendimiento analítico|Sin base|No existen ROS enviados en 2021–2025 o no hay correspondencia sectorial suficiente.">—</div>';
    const profile=profileShort({profile:row.reportabilityProfile});
    const tip=`IRAR ajustado|${fmt(row.irarAdjusted,2)}% · ${profile}|Observado ${fmt(row.irarObserved,2)}% · pares ${fmt(row.irarPeer,2)}% · credibilidad ${fmt(row.irarCredibility,0)}% · ${row.irarFamily}`;
    return `<div class="v036-mxn strong atlas-irar ${profileClass(row.reportabilityProfile?.key)}" data-v036-tip="${esc(tip)}"><span>${fmt(row.irarAdjusted,2)}%</span><i title="${esc(profile)}"></i></div>`;
  }

  function profileInterpretation(row){const m={profile:row.reportabilityProfile};return core.profileRead(m)+(row.reportabilityProfile?.limited?' <b>Evidencia limitada:</b> el resultado depende principalmente del suavizamiento por bajo volumen.':'');}

  if(typeof v036Dossier==='function'){
    const baseDossier=v036Dossier;
    v036Dossier=function atlasIrarDossier(row,ctx){
      let html=baseDossier(row,ctx); const profile=profileShort({profile:row.reportabilityProfile});
      const block=`<div class="atlas-irar-dossier"><h4>Rendimiento analítico y perfil de reportabilidad ${v036Help('reportability_profile')}</h4><div class="atlas-irar-dossier-grid"><div><span>IRAR ajustado</span><b>${fmt(row.irarAdjusted,2)}%</b><small>Valor comparativo principal · ${esc(row.irarFamily||'Sin familia')}</small></div><div><span>IRAR observado</span><b>${fmt(row.irarObserved,2)}%</b><small>Cociente histórico bruto; denominación ICR queda legacy.</small></div><div><span>Referencia de pares</span><b>${fmt(row.irarPeer,2)}%</b><small>${row.irarPeerSource==='familia_leave_one_out'?'Familia comparable leave-one-out':'Referencia nacional leave-one-out'} · ${v036F(row.irarPeerCount)} pares</small></div><div><span>Credibilidad</span><b>${fmt(row.irarCredibility,0)}%</b><small>${esc(row.irarCredibilityBand)} · ${v036Help('irar_credibility')}</small></div><div><span>IRAR relativo</span><b>${Number.isFinite(Number(row.irarRelative))?fmt(row.irarRelative,2)+'×':'—'}</b><small>1,0× = rendimiento esperado de referencia.</small></div><div><span>Perfil IIR × IRAR</span><b>${esc(profile)}</b><small>IIR 2025 ${fmt(row.iir,2)}× · ${row.irarRankingEligible?'apto para comparación principal':'fuera del ranking principal por volumen'}</small></div></div><p>${profileInterpretation(row)}</p></div>`;
      html=html.replace('<div class="v036-guard">',`${block}<div class="v036-guard">`);
      html=html.replace('IIR y ROS/SO describen intensidad agregada sectorial.','IIR y ROS/SO describen intensidad agregada sectorial; IRAR describe rendimiento analítico histórico ajustado.');
      return html;
    };
  }

  function profileMapRows(){return typeof v036Filtered==='function'?v036Filtered():(V036_STATE?.rows||[]);}
  function pos(value){const n=Number(value);if(!Number.isFinite(n))return null;if(n<=0)return 2;return Math.max(2,Math.min(98,50+25*Math.log2(n)));}
  function focusRowByIndex(idx){const row=document.querySelector(`.v036-mxrow[data-v036-row="${idx}"]`);if(row){row.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>row.click(),250);}}
  function buildColorLegend(rows){
    const bag=new Map();
    rows.forEach(r=>{const meta=segMeta(r.seg);const hit=bag.get(meta.key)||{...meta,count:0};hit.count+=1;bag.set(meta.key,hit);});
    if(!bag.size)return '';
    const chips=[...bag.values()].sort((a,b)=>String(a.label).localeCompare(String(b.label),'es')).map(meta=>`<span class="atlas-irar-color-chip"><svg class="atlas-irar-color-swatch" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="${esc(meta.color)}"></circle></svg><b>${esc(meta.label)}</b><small>${meta.count}</small></span>`).join('');
    return `<div class="atlas-irar-color-legend"><span class="atlas-irar-color-legend-title">Color de punto = segmento</span>${chips}</div>`;
  }
  function renderProfileMap(){
    const matrix=document.querySelector('.v036-matrix');if(!matrix||!V036_STATE?.rows)return;
    let panel=document.querySelector('#atlas-irar-profile-map');
    if(!panel){matrix.insertAdjacentHTML('afterend','<section id="atlas-irar-profile-map" class="atlas-irar-profile-map"></section>');panel=document.querySelector('#atlas-irar-profile-map');}
    const rows=profileMapRows().filter(r=>Number.isFinite(Number(r.iir))&&Number(r.iir)>=0&&Number.isFinite(Number(r.irarRelative))&&Number(r.irarRelative)>=0);
    const counts={INTENSIVO_PRODUCTIVO:0,INTENSIVO_BAJO_RENDIMIENTO:0,SELECTIVO_PRODUCTIVO:0,BAJA_ACTIVACION:0,COMPORTAMIENTO_ESPERADO:0};
    rows.forEach(r=>{if(counts[r.reportabilityProfile?.key]!==undefined)counts[r.reportabilityProfile.key]++;});
    const legendHtml=buildColorLegend(rows);
    panel.innerHTML=`<div class="atlas-irar-map-head"><div><span>MAPA DE REPORTABILIDAD</span><h3>Quién reporta más y con qué rendimiento</h3><p>Derecha = más reporte · Arriba = mejor rendimiento. Los puntos más alejados de la zona esperada son los principales focos de revisión.</p>${legendHtml}</div><div class="atlas-irar-map-legend"><span>Intensivo–productivo <b>${counts.INTENSIVO_PRODUCTIVO}</b></span><span>Intensivo–bajo rendimiento <b>${counts.INTENSIVO_BAJO_RENDIMIENTO}</b></span><span>Selectivo–productivo <b>${counts.SELECTIVO_PRODUCTIVO}</b></span><span>Baja activación <b>${counts.BAJA_ACTIVACION}</b></span><span>Esperado <b>${counts.COMPORTAMIENTO_ESPERADO}</b></span></div></div><div class="atlas-irar-plane"><span class="atlas-irar-zone-label">Zona esperada</span><span class="atlas-irar-q q1">Selectivo–productivo</span><span class="atlas-irar-q q2">Intensivo–productivo</span><span class="atlas-irar-q q3">Baja activación</span><span class="atlas-irar-q q4">Intensivo–bajo rendimiento</span><span class="atlas-irar-axis-label xlow">IIR bajo</span><span class="atlas-irar-axis-label xhigh">IIR alto</span><span class="atlas-irar-axis-label ylow">IRAR relativo bajo</span><span class="atlas-irar-axis-label yhigh">IRAR relativo alto</span></div><div class="atlas-irar-map-foot"><b>Zona esperada:</b> IIR entre 0,75× y 1,50× e IRAR relativo entre 0,80× y 1,25×. Los ejes finos marcan 1,0×; las líneas discontinuas marcan los umbrales de perfil. Los extremos son señales comparativas para revisión, no hallazgos ni determinaciones de cumplimiento.</div>`;
    const plane=panel.querySelector('.atlas-irar-plane');
    const planeWidth=Math.max(640,Math.round(plane.clientWidth||1000)); const planeHeight=Math.max(280,Math.round(plane.clientHeight||330));
    const dots=rows.map(r=>{
      const idx=V036_STATE.rows.indexOf(r),x=planeWidth*(pos(r.iir)/100),y=planeHeight*((100-pos(r.irarRelative))/100),sent=Number(r.total)||0;
      const radius=Math.max(3.2,Math.min(6.2,3.2+.68*Math.log10(sent+1))),opacity=Math.max(.42,Math.min(1,(Number(r.irarCredibility)||0)/100));
      const meta=segMeta(r.seg); const tip=`${r.name}|${r.reportabilityProfile?.label||'Sin perfil'}|IIR 2025 ${fmt(r.iir,2)}× · IRAR ajustado ${fmt(r.irarAdjusted,2)}% · relativo ${fmt(r.irarRelative,2)}× · credibilidad ${fmt(r.irarCredibility,0)}% · ${meta.label}`;
      return `<circle class="atlas-irar-dot ${profileClass(r.reportabilityProfile?.key)}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${esc(meta.color)}" fill-opacity="${opacity.toFixed(2)}" stroke="#e7eef5" stroke-opacity=".72" stroke-width="1.1" vector-effect="non-scaling-stroke" data-atlas-irar-row="${idx}" data-v036-tip="${esc(tip)}" aria-label="${esc(r.name)}" role="button" tabindex="0"></circle>`;
    }).join('');
    const xLow=planeWidth*(pos(.75)/100),xHigh=planeWidth*(pos(1.50)/100),yLow=planeHeight*(pos(.80)/100),yHigh=planeHeight*(pos(1.25)/100);
    const zoneTop=planeHeight-yHigh,zoneBottom=planeHeight-yLow,zoneWidth=xHigh-xLow,zoneHeight=zoneBottom-zoneTop;
    const svg=`<svg class="atlas-irar-svg" viewBox="0 0 ${planeWidth} ${planeHeight}" preserveAspectRatio="none" role="img" aria-label="Mapa IIR 2025 por IRAR relativo 2021–2025"><rect class="atlas-irar-expected-zone-svg" x="${xLow.toFixed(2)}" y="${zoneTop.toFixed(2)}" width="${zoneWidth.toFixed(2)}" height="${zoneHeight.toFixed(2)}" rx="10" ry="10"></rect><line class="atlas-irar-threshold-svg" x1="${xLow.toFixed(2)}" y1="0" x2="${xLow.toFixed(2)}" y2="${planeHeight}"></line><line class="atlas-irar-threshold-svg" x1="${xHigh.toFixed(2)}" y1="0" x2="${xHigh.toFixed(2)}" y2="${planeHeight}"></line><line class="atlas-irar-threshold-svg" x1="0" y1="${zoneTop.toFixed(2)}" x2="${planeWidth}" y2="${zoneTop.toFixed(2)}"></line><line class="atlas-irar-threshold-svg" x1="0" y1="${zoneBottom.toFixed(2)}" x2="${planeWidth}" y2="${zoneBottom.toFixed(2)}"></line><line class="atlas-irar-axis-svg" x1="${(planeWidth/2).toFixed(2)}" y1="0" x2="${(planeWidth/2).toFixed(2)}" y2="${planeHeight}"></line><line class="atlas-irar-axis-svg" x1="0" y1="${(planeHeight/2).toFixed(2)}" x2="${planeWidth}" y2="${(planeHeight/2).toFixed(2)}"></line>${dots}</svg>`;
    plane.insertAdjacentHTML('afterbegin',svg);
    plane.querySelectorAll('[data-atlas-irar-row]').forEach(dot=>{dot.addEventListener('click',()=>focusRowByIndex(Number(dot.dataset.atlasIrarRow)));dot.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();focusRowByIndex(Number(dot.dataset.atlasIrarRow));}});});
    if(!window.__atlasIrarProfileMapResizeBound){window.__atlasIrarProfileMapResizeBound=true;window.addEventListener('resize',()=>{clearTimeout(window.__atlasIrarProfileMapResizeTimer);window.__atlasIrarProfileMapResizeTimer=setTimeout(()=>{try{renderProfileMap();}catch{}},120);});}
  }

  if(typeof v036RenderMatrix==='function'){
    const baseRender=v036RenderMatrix;
    v036RenderMatrix=function atlasIrarRenderMatrix(){const result=baseRender();document.querySelectorAll('.v036-mxrow[data-v036-row]').forEach(btn=>{if(btn.querySelector('.atlas-irar'))return;const row=V036_STATE?.rows?.[Number(btn.dataset.v036Row)],iir=btn.children[4];if(iir)iir.insertAdjacentHTML('afterend',irarCell(row));});renderProfileMap();return result;};
  }

  window.ATLAS_ICR={acronym:'ICR',status:'LEGACY_TRACEABILITY_ONLY',replacement:'IRAR',replacement_api:'ATLAS_IRAR_CURRENT'};
  window.ATLAS_IRAR_UI={version:core.version,integration_version:UI_VERSION,profile_map:'IIR_X_IRAR',primary:'IRAR_ADJUSTED',credibility_label:'CREDIBILIDAD_IRAR',legacy:'ICR_OBSERVED_TRACEABILITY_ONLY'};
})();