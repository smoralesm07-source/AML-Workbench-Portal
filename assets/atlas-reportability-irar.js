'use strict';
/* ATLAS AML · IRAR sectorial + perfil IIR × IRAR. */
(function atlasReportabilityIrar(){
  const core=window.ATLAS_IRAR_CURRENT;
  if(!core){console.warn('[ATLAS] IRAR authority unavailable');return;}

  function fmt(v,d=2){return Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function metricFor(row,uaf){return core.findMetric(row?.sector_name||row?.name,uaf?.__atlasIrar?.dataset);}
  function profileClass(key){return String(key||'SIN_BASE').toLowerCase().replaceAll('_','-');}
  function profileShort(metric){
    if(!metric)return 'Sin base';
    const label=metric.profile?.label||'Sin base';
    return metric.profile?.limited?`${label} · evidencia limitada`:label;
  }

  try{
    V036_HELP.irar={
      t:'IRAR · Rendimiento Analítico de ROS',
      b:'IRAR estima el rendimiento analítico histórico asociado al flujo sectorial de ROS. El valor observado es ROS con indicios agregados 2021–2025 / ROS enviados agregados 2021–2025. Para comparar sectores, ATLAS muestra prioritariamente un IRAR ajustado por credibilidad: combina el dato observado con el rendimiento esperado de una familia comparable, excluyendo al propio sector. Si no existen al menos cuatro pares y 100 ROS de base, usa referencia nacional leave-one-out. No es una probabilidad de conversión de una cohorte, no mide calidad individual, riesgo LA/FT ni cumplimiento.'
    };
    V036_HELP.irar_confidence={
      t:'Confianza estadística IRAR',
      b:'Peso que tienen los datos propios del sector frente al suavizamiento: ROS/(ROS+100). Con pocos ROS el valor ajustado depende más de la referencia de pares; con gran volumen converge al valor observado. Sectores con menos de 100 ROS acumulados no deben usarse como ranking principal.'
    };
    V036_HELP.reportability_profile={
      t:'Perfil IIR × IRAR',
      b:'Cruza intensidad relativa de reportabilidad (IIR) con rendimiento analítico ajustado relativo a pares (IRAR). Los perfiles son descriptivos y orientan revisión: intensivo–productivo, intensivo–bajo rendimiento, selectivo–productivo, baja activación o comportamiento esperado. Ningún cuadrante prueba subreporte, reporte defensivo, calidad, riesgo o incumplimiento.'
    };
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
        row.irarObserved=m?.observed_pct??null;
        row.irarAdjusted=m?.adjusted_pct??null;
        row.irarPeer=m?.peer_expected_pct??null;
        row.irarRelative=m?.relative_peer??null;
        row.irarConfidence=m?.confidence_pct??0;
        row.irarConfidenceBand=m?.confidence_band||'baja';
        row.irarScore=m?.score??50;
        row.irarFamily=m?.family?.label||'Sin familia';
        row.irarPeerSource=m?.peer_source||'sin_base';
        row.irarPeerCount=m?.peer_count??0;
        row.irarPeerRos=m?.peer_ros??0;
        row.irarRankingEligible=Boolean(m?.ranking_eligible);
        row.reportabilityProfile=m?.profile||{key:'SIN_BASE',label:'Sin base suficiente'};
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
        html=html.replace(/(<button data-v036-sort="iir"[^>]*>.*?<\/button>)/,`$1<button data-v036-sort="irarAdjusted">IRAR ${typeof v036Help==='function'?v036Help('irar'):''}</button>`);
      }
      html=html.replace(/ICR\s*(?:UAF)?/g,'IRAR');
      return html;
    };
  }

  function irarCell(row){
    if(!Number.isFinite(Number(row?.irarAdjusted)))return '<div class="v036-mxn strong atlas-irar" data-v036-tip="IRAR · Rendimiento analítico|Sin base|No existen ROS enviados en 2021–2025 o no hay correspondencia sectorial suficiente.">—</div>';
    const profile=profileShort({profile:row.reportabilityProfile});
    const tip=`IRAR ajustado|${fmt(row.irarAdjusted,2)}% · ${profile}|Observado ${fmt(row.irarObserved,2)}% · pares ${fmt(row.irarPeer,2)}% · confianza ${fmt(row.irarConfidence,0)}% · ${row.irarFamily}`;
    return `<div class="v036-mxn strong atlas-irar ${profileClass(row.reportabilityProfile?.key)}" data-v036-tip="${esc(tip)}"><span>${fmt(row.irarAdjusted,2)}%</span><i title="${esc(profile)}"></i></div>`;
  }

  function profileInterpretation(row){
    const m={profile:row.reportabilityProfile};
    return core.profileRead(m)+(row.reportabilityProfile?.limited?' <b>Evidencia limitada:</b> el resultado depende principalmente del suavizamiento por bajo volumen.':'');
  }

  if(typeof v036Dossier==='function'){
    const baseDossier=v036Dossier;
    v036Dossier=function atlasIrarDossier(row,ctx){
      let html=baseDossier(row,ctx);
      const profile=profileShort({profile:row.reportabilityProfile});
      const block=`<div class="atlas-irar-dossier"><h4>Rendimiento analítico y perfil de reportabilidad ${v036Help('reportability_profile')}</h4><div class="atlas-irar-dossier-grid"><div><span>IRAR ajustado</span><b>${fmt(row.irarAdjusted,2)}%</b><small>Valor comparativo principal · ${esc(row.irarFamily||'Sin familia')}</small></div><div><span>IRAR observado</span><b>${fmt(row.irarObserved,2)}%</b><small>Cociente histórico bruto; denominación ICR queda legacy.</small></div><div><span>Referencia de pares</span><b>${fmt(row.irarPeer,2)}%</b><small>${row.irarPeerSource==='familia_leave_one_out'?'Familia comparable leave-one-out':'Referencia nacional leave-one-out'} · ${v036F(row.irarPeerCount)} pares</small></div><div><span>Confianza</span><b>${fmt(row.irarConfidence,0)}%</b><small>${esc(row.irarConfidenceBand)} · ${v036Help('irar_confidence')}</small></div><div><span>IRAR relativo</span><b>${Number.isFinite(Number(row.irarRelative))?fmt(row.irarRelative,2)+'×':'—'}</b><small>1,0× = rendimiento esperado de referencia.</small></div><div><span>Perfil IIR × IRAR</span><b>${esc(profile)}</b><small>IIR ${fmt(row.iir,2)}× · ${row.irarRankingEligible?'apto para comparación principal':'fuera del ranking principal por volumen'}</small></div></div><p>${profileInterpretation(row)}</p></div>`;
      html=html.replace('<div class="v036-guard">',`${block}<div class="v036-guard">`);
      html=html.replace('IIR y ROS/SO describen intensidad agregada sectorial.','IIR y ROS/SO describen intensidad agregada sectorial; IRAR describe rendimiento analítico histórico ajustado.');
      return html;
    };
  }

  function profileMapRows(){return typeof v036Filtered==='function'?v036Filtered():(V036_STATE?.rows||[]);}
  function pos(value){if(!(Number(value)>0))return 2;return Math.max(2,Math.min(98,50+25*Math.log2(Number(value))));}
  function renderProfileMap(){
    const matrix=document.querySelector('.v036-matrix');if(!matrix||!V036_STATE?.rows)return;
    let panel=document.querySelector('#atlas-irar-profile-map');
    if(!panel){matrix.insertAdjacentHTML('afterend','<section id="atlas-irar-profile-map" class="atlas-irar-profile-map"></section>');panel=document.querySelector('#atlas-irar-profile-map');}
    const rows=profileMapRows().filter(r=>Number(r.iir)>0&&Number(r.irarRelative)>0);
    const counts={INTENSIVO_PRODUCTIVO:0,INTENSIVO_BAJO_RENDIMIENTO:0,SELECTIVO_PRODUCTIVO:0,BAJA_ACTIVACION:0,COMPORTAMIENTO_ESPERADO:0};
    rows.forEach(r=>{if(counts[r.reportabilityProfile?.key]!==undefined)counts[r.reportabilityProfile.key]++;});
    const dots=rows.map(r=>{
      const idx=V036_STATE.rows.indexOf(r),left=pos(r.iir),top=100-pos(r.irarRelative),sent=Number(r.total)||0;
      const size=Math.max(8,Math.min(20,8+3*Math.log10(sent+1))),opacity=Math.max(.28,Math.min(1,(Number(r.irarConfidence)||0)/100));
      const tip=`${r.name}|${r.reportabilityProfile?.label||'Sin perfil'}|IIR ${fmt(r.iir,2)}× · IRAR ${fmt(r.irarAdjusted,2)}% · relativo ${fmt(r.irarRelative,2)}× · confianza ${fmt(r.irarConfidence,0)}%`;
      return `<button class="atlas-irar-dot ${profileClass(r.reportabilityProfile?.key)}" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;opacity:${opacity};background:${V036_SEG?.[r.seg]?.color||'currentColor'}" data-atlas-irar-row="${idx}" data-v036-tip="${esc(tip)}" aria-label="${esc(r.name)}"></button>`;
    }).join('');
    panel.innerHTML=`<div class="atlas-irar-map-head"><div><span>PERFIL DE REPORTABILIDAD</span><h3>IIR × IRAR ajustado</h3><p>La posición conserva dos dimensiones: intensidad del reporte y rendimiento analítico relativo a pares. Tamaño = ROS 5 años · opacidad = confianza.</p></div><div class="atlas-irar-map-legend"><span>Intensivo–productivo <b>${counts.INTENSIVO_PRODUCTIVO}</b></span><span>Intensivo–bajo rendimiento <b>${counts.INTENSIVO_BAJO_RENDIMIENTO}</b></span><span>Selectivo–productivo <b>${counts.SELECTIVO_PRODUCTIVO}</b></span><span>Baja activación <b>${counts.BAJA_ACTIVACION}</b></span><span>Esperado <b>${counts.COMPORTAMIENTO_ESPERADO}</b></span></div></div><div class="atlas-irar-plane"><div class="atlas-irar-axis x"></div><div class="atlas-irar-axis y"></div><span class="atlas-irar-q q1">Selectivo–productivo</span><span class="atlas-irar-q q2">Intensivo–productivo</span><span class="atlas-irar-q q3">Baja activación</span><span class="atlas-irar-q q4">Intensivo–bajo rendimiento</span><span class="atlas-irar-axis-label xlow">IIR bajo</span><span class="atlas-irar-axis-label xhigh">IIR alto</span><span class="atlas-irar-axis-label ylow">IRAR relativo bajo</span><span class="atlas-irar-axis-label yhigh">IRAR relativo alto</span>${dots}</div><div class="atlas-irar-map-foot"><b>Centro = comportamiento esperado.</b> Las posiciones extremas son señales comparativas para revisión y requieren contexto; no son hallazgos ni determinaciones de cumplimiento.</div>`;
    panel.querySelectorAll('[data-atlas-irar-row]').forEach(dot=>dot.addEventListener('click',()=>{
      const idx=Number(dot.dataset.atlasIrarRow),row=document.querySelector(`.v036-mxrow[data-v036-row="${idx}"]`);if(row){row.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>row.click(),250);}
    }));
  }

  if(typeof v036RenderMatrix==='function'){
    const baseRender=v036RenderMatrix;
    v036RenderMatrix=function atlasIrarRenderMatrix(){
      const result=baseRender();
      document.querySelectorAll('.v036-mxrow[data-v036-row]').forEach(btn=>{
        if(btn.querySelector('.atlas-irar'))return;
        const row=V036_STATE?.rows?.[Number(btn.dataset.v036Row)],iir=btn.children[4];
        if(iir)iir.insertAdjacentHTML('afterend',irarCell(row));
      });
      renderProfileMap();
      return result;
    };
  }

  window.ATLAS_ICR={acronym:'ICR',status:'LEGACY_TRACEABILITY_ONLY',replacement:'IRAR',replacement_api:'ATLAS_IRAR_CURRENT'};
  window.ATLAS_IRAR_UI={version:core.version,profile_map:'IIR_X_IRAR',primary:'IRAR_ADJUSTED',legacy:'ICR_OBSERVED_TRACEABILITY_ONLY'};
})();
