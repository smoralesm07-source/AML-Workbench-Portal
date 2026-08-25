'use strict';
/* ATLAS AML · IRAR-E sectorial + clasificación IIR × IRAR-E × ICE. */
(function atlasReportabilityIrar(){
  const core=window.ATLAS_IRAR_CURRENT;
  const UI_VERSION='IRAR-UI-1.7';
  const MIN_EVIDENCE=.50;
  if(!core){console.warn('[ATLAS] IRAR authority unavailable');return;}

  function fmt(v,d=2){return Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function metricFor(row,uaf){return core.findMetric(row?.sector_name||row?.name,uaf?.__atlasIrar?.dataset);}
  function profileClass(key){return String(key||'SIN_BASE').toLowerCase().replaceAll('_','-');}
  function supervisionProfile(metric){
    const base=metric?.profile||{key:'SIN_BASE',label:'Sin base suficiente'};
    const c=Number(metric?.confidence_pct??metric?.credibility_pct??0)/100;
    if(base.key==='SIN_BASE')return {...base,base_key:base.key,limited:true};
    if(c<MIN_EVIDENCE)return {key:'EVIDENCIA_BAJA',label:'Evidencia baja',base_key:base.key,limited:true};
    if(base.key==='BAJA_ACTIVACION')return {key:'PRIORIDAD_REVISION',label:'Prioridad de revisión',base_key:base.key,limited:false};
    if(base.key==='INTENSIVO_BAJO_RENDIMIENTO')return {key:'REVISAR_EFECTIVIDAD',label:'Revisar efectividad',base_key:base.key,limited:false};
    if(base.key==='SELECTIVO_PRODUCTIVO')return {key:'SEGUIMIENTO_SELECTIVO',label:'Seguimiento selectivo',base_key:base.key,limited:false};
    if(base.key==='INTENSIVO_PRODUCTIVO')return {key:'MONITOREO_ESTABLE',label:'Monitoreo estable',base_key:base.key,limited:false};
    return {key:'MONITOREO_ORDINARIO',label:'Monitoreo ordinario',base_key:base.key,limited:false};
  }
  function segMeta(seg){
    const meta=V036_SEG?.[seg]||{};
    return {key:seg??'SIN_SEG',label:meta.label||meta.name||meta.title||meta.short||String(seg||'Sin segmento'),color:meta.color||'#5bb4f5'};
  }

  try{
    V036_HELP.iir={t:'IIR · Intensidad relativa de reporte',b:'Compara la participación del sector en ROS 2025 con su participación en el universo de sujetos obligados. 1,0× representa intensidad proporcional al peso sectorial; valores mayores indican más reporte relativo y menores, menos reporte relativo. No mide calidad, riesgo ni cumplimiento.'};
    V036_HELP.irar={t:'IRAR-E · Rendimiento Analítico ajustado por evidencia',b:'IRAR-E es el indicador comparativo principal. Parte del rendimiento observado (ROS con indicios 2021–2025 / ROS enviados 2021–2025) y lo suaviza hacia una referencia leave-one-out de sectores comparables mediante un prior de 100 ROS. Con poca evidencia, el resultado se acerca a la referencia; con mayor volumen converge al dato observado. No es una probabilidad de conversión, no mide calidad individual, riesgo LA/FT ni cumplimiento.'};
    V036_HELP.irar_e=V036_HELP.irar;
    V036_HELP.irar_observed={t:'IRAR observado',b:'Cociente histórico bruto entre ROS con indicios y ROS enviados en 2021–2025. Se mantiene sólo para trazabilidad; no debe usarse solo para clasificar sectores porque tasas extremas pueden provenir de muy pocos ROS.'};
    V036_HELP.irar_relative={t:'IRAR-E relativo',b:'Compara el IRAR-E del sector con el rendimiento esperado de su familia comparable. 1,0× equivale a la referencia; sobre 1,25× se considera rendimiento relativo alto y bajo 0,80× rendimiento relativo bajo. La lectura debe combinarse siempre con ICE.'};
    V036_HELP.irar_credibility={t:'ICE · Índice de Confianza de Evidencia',b:'Mide cuánto peso tienen los datos propios del sector frente al suavizamiento: ICE = ROS/(ROS+100). No es una probabilidad ni un intervalo de confianza. Con ICE inferior a 50%, ATLAS clasifica el resultado como “Evidencia baja” y evita inferencias de fiscalización a partir de una base inestable.'};
    V036_HELP.irar_confidence=V036_HELP.irar_credibility;
    V036_HELP.ice=V036_HELP.irar_credibility;
    V036_HELP.reportability_profile={t:'Clasificación de supervisión · IIR × IRAR-E × ICE',b:'Combina tres dimensiones: intensidad de reporte (IIR), rendimiento analítico ajustado (IRAR-E) y solidez de evidencia (ICE). Si ICE <50%, prevalece “Evidencia baja”. Con evidencia suficiente: baja intensidad + bajo rendimiento = “Prioridad de revisión”; alta intensidad + bajo rendimiento = “Revisar efectividad”; baja intensidad + alto rendimiento = “Seguimiento selectivo”; alta intensidad + alto rendimiento = “Monitoreo estable”; el resto = “Monitoreo ordinario”. Es una priorización analítica para orientar revisión, no una determinación de incumplimiento.'};
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
        row.irarCredibility=m?.confidence_pct??0; row.irarConfidence=row.irarCredibility; row.ice=row.irarCredibility; row.irarCredibilityBand=m?.confidence_band||'baja'; row.irarConfidenceBand=row.irarCredibilityBand;
        row.irarScore=m?.score??50; row.irarFamily=m?.family?.label||'Sin familia'; row.irarPeerSource=m?.peer_source||'sin_base'; row.irarPeerCount=m?.peer_count??0; row.irarPeerRos=m?.peer_ros??0;
        row.irarRankingEligible=Boolean(m?.ranking_eligible); row.reportabilityProfile=supervisionProfile(m);
        if(row.marks&&row.reportabilityProfile?.key&&row.reportabilityProfile.key!=='SIN_BASE')row.marks=[...new Set([...row.marks,`perfil_${row.reportabilityProfile.key.toLowerCase()}`])];
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
        if(iirHeader.test(html))html=html.replace(iirHeader,`$1<button data-v036-sort="irarAdjusted">IRAR-E ${typeof v036Help==='function'?v036Help('irar'):''}</button>`);
      }
      html=html.replace(/ICR\s*(?:UAF)?/g,'IRAR-E');
      html=html.replace('Análisis de reportabilidad · silencios por industria','Análisis de reportabilidad · intensidad, rendimiento y evidencia');
      html=html.replace('Los filtros gobiernan la matriz; cada sector abre un dossier explicativo en el mismo lugar.','Los filtros gobiernan la matriz; IIR, IRAR-E e ICE alimentan una clasificación orientada a priorización de supervisión. Cada sector abre un dossier explicativo en el mismo lugar.');
      return html;
    };
  }

  function irarCell(row){
    if(!Number.isFinite(Number(row?.irarAdjusted)))return '<div class="v036-mxn strong atlas-irar" data-v036-tip="IRAR-E|Sin base|No existen ROS enviados en 2021–2025 o no hay correspondencia sectorial suficiente.">—</div>';
    const profile=row.reportabilityProfile?.label||'Sin base';
    const tip=`IRAR-E|${fmt(row.irarAdjusted,2)}% · ${profile}|Observado ${fmt(row.irarObserved,2)}% · pares ${fmt(row.irarPeer,2)}% · ICE ${fmt(row.ice,0)}% · ${row.irarFamily}`;
    return `<div class="v036-mxn strong atlas-irar ${profileClass(row.reportabilityProfile?.key)}" data-v036-tip="${esc(tip)}"><span>${fmt(row.irarAdjusted,2)}%</span><i title="${esc(profile)}"></i></div>`;
  }

  function profileInterpretation(row){
    const p=row.reportabilityProfile?.key;
    const map={
      EVIDENCIA_BAJA:'La base estadística todavía es insuficiente para una lectura supervisora robusta. Conviene observar la evolución del sector y evitar conclusiones a partir de tasas extremas.',
      PRIORIDAD_REVISION:'Con evidencia suficiente, el sector combina baja intensidad relativa y bajo rendimiento analítico. Es una señal comparativa para priorizar revisión de cobertura, detección y patrones de reporte.',
      REVISAR_EFECTIVIDAD:'Con evidencia suficiente, el sector reporta intensamente pero obtiene rendimiento analítico relativo bajo. Conviene revisar composición, pertinencia y efectividad del flujo de reportes.',
      SEGUIMIENTO_SELECTIVO:'Con evidencia suficiente, el sector reporta con baja intensidad pero obtiene rendimiento analítico alto. Sugiere un patrón selectivo que amerita seguimiento, sin implicar por sí solo déficit de reporte.',
      MONITOREO_ESTABLE:'Con evidencia suficiente, el sector combina alta intensidad y alto rendimiento relativo. No surge una señal comparativa prioritaria; corresponde mantener monitoreo y revisar cambios relevantes.',
      MONITOREO_ORDINARIO:'Intensidad y rendimiento se mantienen sin una señal comparativa extrema con evidencia suficiente. Corresponde monitoreo ordinario y lectura conjunta con el contexto sectorial.',
      SIN_BASE:'No existe base suficiente para una lectura combinada IIR × IRAR-E × ICE.'
    };
    return map[p]||map.SIN_BASE;
  }

  if(typeof v036Dossier==='function'){
    const baseDossier=v036Dossier;
    v036Dossier=function atlasIrarDossier(row,ctx){
      let html=baseDossier(row,ctx); const profile=row.reportabilityProfile?.label||'Sin base';
      const block=`<div class="atlas-irar-dossier"><h4>Intensidad, rendimiento y evidencia ${v036Help('reportability_profile')}</h4><div class="atlas-irar-dossier-grid"><div><span>IIR ${v036Help('iir')}</span><b>${Number.isFinite(Number(row.iir))?fmt(row.iir,2)+'×':'—'}</b><small>Intensidad relativa de reporte</small></div><div><span>IRAR-E ${v036Help('irar')}</span><b>${fmt(row.irarAdjusted,2)}%</b><small>Rendimiento ajustado por evidencia · ${esc(row.irarFamily||'Sin familia')}</small></div><div><span>ICE ${v036Help('ice')}</span><b>${fmt(row.ice,0)}%</b><small>${esc(row.irarCredibilityBand)} · solidez de la evidencia</small></div><div><span>IRAR observado ${v036Help('irar_observed')}</span><b>${fmt(row.irarObserved,2)}%</b><small>Cociente histórico bruto; sólo trazabilidad.</small></div><div><span>IRAR-E relativo ${v036Help('irar_relative')}</span><b>${Number.isFinite(Number(row.irarRelative))?fmt(row.irarRelative,2)+'×':'—'}</b><small>1,0× = rendimiento esperado de referencia.</small></div><div><span>Clasificación de supervisión ${v036Help('reportability_profile')}</span><b>${esc(profile)}</b><small>${row.irarRankingEligible?'evidencia apta para comparación principal':'evidencia limitada o volumen insuficiente'}</small></div></div><p>${profileInterpretation(row)}</p></div>`;
      html=html.replace('<div class="v036-guard">',`${block}<div class="v036-guard">`);
      html=html.replace('IIR y ROS/SO describen intensidad agregada sectorial.','IIR describe intensidad; IRAR-E, rendimiento ajustado; e ICE, solidez de evidencia. La clasificación orienta priorización de supervisión, no determina incumplimiento.');
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
    const counts={EVIDENCIA_BAJA:0,PRIORIDAD_REVISION:0,REVISAR_EFECTIVIDAD:0,SEGUIMIENTO_SELECTIVO:0,MONITOREO_ESTABLE:0,MONITOREO_ORDINARIO:0};
    rows.forEach(r=>{if(counts[r.reportabilityProfile?.key]!==undefined)counts[r.reportabilityProfile.key]++;});
    const legendHtml=buildColorLegend(rows);
    panel.innerHTML=`<div class="atlas-irar-map-head"><div><span>MAPA DE REPORTABILIDAD</span><h3>Intensidad, rendimiento y evidencia ${typeof v036Help==='function'?v036Help('reportability_profile'):''}</h3><p>Derecha = mayor intensidad · Arriba = mayor rendimiento. Tamaño y opacidad = ICE. La clasificación resultante orienta la prioridad de revisión supervisora.</p>${legendHtml}</div><div class="atlas-irar-map-legend"><span>Prioridad de revisión <b>${counts.PRIORIDAD_REVISION}</b></span><span>Revisar efectividad <b>${counts.REVISAR_EFECTIVIDAD}</b></span><span>Seguimiento selectivo <b>${counts.SEGUIMIENTO_SELECTIVO}</b></span><span>Monitoreo estable <b>${counts.MONITOREO_ESTABLE}</b></span><span>Monitoreo ordinario <b>${counts.MONITOREO_ORDINARIO}</b></span><span>Evidencia baja <b>${counts.EVIDENCIA_BAJA}</b></span></div></div><div class="atlas-irar-plane"><span class="atlas-irar-zone-label">Zona esperada</span><span class="atlas-irar-q q1">Baja intensidad · alto rendimiento</span><span class="atlas-irar-q q2">Alta intensidad · alto rendimiento</span><span class="atlas-irar-q q3">Baja intensidad · bajo rendimiento</span><span class="atlas-irar-q q4">Alta intensidad · bajo rendimiento</span><span class="atlas-irar-axis-label xlow">IIR bajo</span><span class="atlas-irar-axis-label xhigh">IIR alto</span><span class="atlas-irar-axis-label ylow">IRAR-E relativo bajo</span><span class="atlas-irar-axis-label yhigh">IRAR-E relativo alto</span></div><div class="atlas-irar-map-foot"><b>Lectura supervisora:</b> la posición combina intensidad y rendimiento; ICE determina si existe evidencia suficiente para interpretar esa posición. Con ICE <50% prevalece “Evidencia baja”. Con ICE ≥50%, los extremos se traducen en prioridades de revisión o seguimiento. Son señales comparativas para fiscalización basada en riesgo, no hallazgos ni determinaciones de incumplimiento.</div>`;
    const plane=panel.querySelector('.atlas-irar-plane');
    const planeWidth=Math.max(640,Math.round(plane.clientWidth||1000)); const planeHeight=Math.max(280,Math.round(plane.clientHeight||330));
    const dots=rows.map(r=>{
      const idx=V036_STATE.rows.indexOf(r),x=planeWidth*(pos(r.iir)/100),y=planeHeight*((100-pos(r.irarRelative))/100),ice=Math.max(0,Math.min(1,(Number(r.ice)||0)/100));
      const radius=3.0+4.2*ice,opacity=.25+.75*ice;
      const meta=segMeta(r.seg); const tip=`${r.name}|${r.reportabilityProfile?.label||'Sin perfil'}|IIR ${fmt(r.iir,2)}× · IRAR-E ${fmt(r.irarAdjusted,2)}% · relativo ${fmt(r.irarRelative,2)}× · ICE ${fmt(r.ice,0)}% · ${meta.label}`;
      return `<circle class="atlas-irar-dot ${profileClass(r.reportabilityProfile?.key)}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${esc(meta.color)}" fill-opacity="${opacity.toFixed(2)}" stroke="#e7eef5" stroke-opacity=".72" stroke-width="1.1" vector-effect="non-scaling-stroke" data-atlas-irar-row="${idx}" data-v036-tip="${esc(tip)}" aria-label="${esc(r.name)}" role="button" tabindex="0"></circle>`;
    }).join('');
    const xLow=planeWidth*(pos(.75)/100),xHigh=planeWidth*(pos(1.50)/100),yLow=planeHeight*(pos(.80)/100),yHigh=planeHeight*(pos(1.25)/100);
    const zoneTop=planeHeight-yHigh,zoneBottom=planeHeight-yLow,zoneWidth=xHigh-xLow,zoneHeight=zoneBottom-zoneTop;
    const svg=`<svg class="atlas-irar-svg" viewBox="0 0 ${planeWidth} ${planeHeight}" preserveAspectRatio="none" role="img" aria-label="Mapa IIR 2025 por IRAR-E relativo 2021–2025"><rect class="atlas-irar-expected-zone-svg" x="${xLow.toFixed(2)}" y="${zoneTop.toFixed(2)}" width="${zoneWidth.toFixed(2)}" height="${zoneHeight.toFixed(2)}" rx="10" ry="10"></rect><line class="atlas-irar-threshold-svg" x1="${xLow.toFixed(2)}" y1="0" x2="${xLow.toFixed(2)}" y2="${planeHeight}"></line><line class="atlas-irar-threshold-svg" x1="${xHigh.toFixed(2)}" y1="0" x2="${xHigh.toFixed(2)}" y2="${planeHeight}"></line><line class="atlas-irar-threshold-svg" x1="0" y1="${zoneTop.toFixed(2)}" x2="${planeWidth}" y2="${zoneTop.toFixed(2)}"></line><line class="atlas-irar-threshold-svg" x1="0" y1="${zoneBottom.toFixed(2)}" x2="${planeWidth}" y2="${zoneBottom.toFixed(2)}"></line><line class="atlas-irar-axis-svg" x1="${(planeWidth/2).toFixed(2)}" y1="0" x2="${(planeWidth/2).toFixed(2)}" y2="${planeHeight}"></line><line class="atlas-irar-axis-svg" x1="0" y1="${(planeHeight/2).toFixed(2)}" x2="${planeWidth}" y2="${(planeHeight/2).toFixed(2)}"></line>${dots}</svg>`;
    plane.insertAdjacentHTML('afterbegin',svg);
    plane.querySelectorAll('[data-atlas-irar-row]').forEach(dot=>{dot.addEventListener('click',()=>focusRowByIndex(Number(dot.dataset.atlasIrarRow)));dot.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();focusRowByIndex(Number(dot.dataset.atlasIrarRow));}});});
    if(!window.__atlasIrarProfileMapResizeBound){window.__atlasIrarProfileMapResizeBound=true;window.addEventListener('resize',()=>{clearTimeout(window.__atlasIrarProfileMapResizeTimer);window.__atlasIrarProfileMapResizeTimer=setTimeout(()=>{try{renderProfileMap();}catch{}},120);});}
  }

  if(typeof v036RenderMatrix==='function'){
    const baseRender=v036RenderMatrix;
    v036RenderMatrix=function atlasIrarRenderMatrix(){const result=baseRender();document.querySelectorAll('.v036-mxrow[data-v036-row]').forEach(btn=>{if(btn.querySelector('.atlas-irar'))return;const row=V036_STATE?.rows?.[Number(btn.dataset.v036Row)],iir=btn.children[4];if(iir)iir.insertAdjacentHTML('afterend',irarCell(row));});renderProfileMap();return result;};
  }

  window.ATLAS_ICR={acronym:'ICR',status:'LEGACY_TRACEABILITY_ONLY',replacement:'IRAR-E',replacement_api:'ATLAS_IRAR_CURRENT'};
  window.ATLAS_IRAR_UI={version:core.version,integration_version:UI_VERSION,profile_map:'IIR_X_IRAR_E_X_ICE',primary:'IRAR_E_ADJUSTED',evidence:'ICE',classification:'SUPERVISION_PRIORITY',min_evidence_ice:50,legacy:'ICR_OBSERVED_TRACEABILITY_ONLY'};
})();