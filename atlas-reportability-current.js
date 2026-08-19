'use strict';

/* ATLAS AML 0.43.9 · Radar Integrado reportability methodology authority
 * Replaces ROS/100 as the primary comparative metric with:
 *   - ROS/SO: absolute reportability intensity per registered subject.
 *   - IIR: relative reportability intensity = sector share of ROS / sector share of SO.
 * The legacy ROS/100 value is retained in row.int/raw for traceability only.
 */
(function atlasReportabilityCurrent(){
  const RELEASE='0.43.9',BUILD='0439';
  const IIR_BANDS={VERY_LOW:.25,LOW:.75,PROPORTIONAL_MAX:1.5,HIGH_MAX:3};

  function iirBand(value){
    const x=Number(value);
    if(!Number.isFinite(x)||x<0)return 'sin_base';
    if(x<IIR_BANDS.VERY_LOW)return 'muy_bajo';
    if(x<IIR_BANDS.LOW)return 'bajo';
    if(x<=IIR_BANDS.PROPORTIONAL_MAX)return 'proporcional';
    if(x<=IIR_BANDS.HIGH_MAX)return 'alto';
    return 'muy_alto';
  }
  function iirLabel(value){
    return {sin_base:'Sin base',muy_bajo:'Muy bajo',bajo:'Bajo',proporcional:'Proporcional',alto:'Alto',muy_alto:'Muy alto'}[iirBand(value)]||'Sin base';
  }
  function iirRead(row){
    const label=iirLabel(row.iir),x=v036F(row.iir,2),rosPerSo=v036F(row.rosPerSo,row.rosPerSo<10?2:1);
    const text={
      muy_bajo:`El sector aporta una fracción del flujo ROS muy inferior a su peso en el padrón (IIR ${x}×). Registra ${rosPerSo} ROS por SO en 2025. Es una señal comparativa sectorial; no prueba subreporte ni incumplimiento.`,
      bajo:`El sector aporta menos flujo ROS que su peso relativo en el padrón (IIR ${x}×). Registra ${rosPerSo} ROS por SO en 2025. La diferencia requiere contexto de exposición, actividad y capacidad de detección.`,
      proporcional:`El peso del sector en el flujo ROS es aproximadamente proporcional a su peso en el padrón (IIR ${x}×). Registra ${rosPerSo} ROS por SO en 2025.`,
      alto:`El sector aporta más flujo ROS que su peso relativo en el padrón (IIR ${x}×). Registra ${rosPerSo} ROS por SO en 2025. Esto describe intensidad de reportabilidad, no calidad ni riesgo.`,
      muy_alto:`El sector aporta varias veces su peso relativo en el padrón al flujo ROS (IIR ${x}×). Registra ${rosPerSo} ROS por SO en 2025. Conviene revisar concentración por entidad y contexto antes de interpretar la causa.`,
      sin_base:'No existe una base suficiente para interpretar intensidad relativa.'
    }[iirBand(row.iir)];
    return `<b>${label}</b>. ${text}`;
  }

  try{
    V036_HELP.intensity={t:'ROS por sujeto obligado',b:'ROS 2025 dividido por sujetos obligados inscritos al 31-12-2025 del mismo sector. Se expresa como ROS/SO y evita extrapolar artificialmente a una base de 100 cuando el sector es pequeño. El denominador es una foto de cierre de año y debe leerse con esa limitación temporal.'};
    V036_HELP.iir={t:'Intensidad relativa de reportabilidad (IIR)',b:'Compara el peso del sector en los ROS 2025 con su peso en el padrón 2025: IIR = %ROS / %SO. 1,0× representa proporcionalidad; >1 indica una participación en ROS superior a su peso en el padrón y <1 una participación inferior. No mide riesgo, calidad del ROS ni cumplimiento.'};
  }catch{}

  v036Marks=function atlasV036Marks(row){
    const out=[],so=v036N(row.so),rosPerSo=v036N(row.rosPerSo),d=Number(row.delta);
    if(row.nominal)out.push('nominal');
    if(!row.nominal&&so>=100&&rosPerSo<.05)out.push('estructural');
    if(Number.isFinite(d)&&row.base>=10&&d<=-30)out.push('caida');
    if(Number.isFinite(d)&&row.base>=10&&d>=100)out.push('alza');
    out.push(iirBand(row.iir));
    return [...new Set(out)];
  };

  v036Badge=function atlasV036Badge(mark){
    const meta={
      estructural:['crit','Silencio estructural'],nominal:['warn','Silencio nominal'],caida:['info','Caída ≥30%'],alza:['info','Alza ≥100%'],
      muy_bajo:['crit','IIR muy bajo'],bajo:['warn','IIR bajo'],proporcional:['ok','Proporcional'],alto:['info','IIR alto'],muy_alto:['acc','IIR muy alto'],sin_base:['info','Sin base IIR']
    }[mark]||['ok',mark];
    return `<span class="v036-badge ${meta[0]}">${esc(meta[1])}</span>`;
  };

  v036PrepareRows=function atlasV036PrepareRows(uaf){
    const sectors=v019Array(uaf?.sectors);
    const totalSO=v036N(uaf?.report?.totals?.registered_so_2025)||v036Sum(sectors,'registered_so_2025');
    const totalROS=v036N(uaf?.report?.totals?.ros_2025)||v036Sum(sectors,'ros_2025');
    return sectors.map(r=>{
      const s=V036_YEARS.map(y=>v036N(r[`ros_${y}`]));
      const so=v036N(r.registered_so_2025),ros=v036N(r.ros_2025),base=v036N(r.ros_2024);
      const delta=Number(r.delta_ros_2025_vs_2024_pct);
      const shareSO=totalSO?100*so/totalSO:0,shareROS=totalROS?100*ros/totalROS:0;
      const row={
        name:r.sector_name,seg:v036Segment(r.sector_name),so,ros,
        int:v036N(r.ros_per_100_so_2025),
        rosPerSo:so?ros/so:0,
        iir:shareSO?shareROS/shareSO:0,
        shareSO,shareROS,delta:Number.isFinite(delta)?delta:null,base,s,total:s.reduce((a,v)=>a+v,0),nominal:Boolean(r.silence_5y),raw:r
      };
      row.marks=v036Marks(row);
      return row;
    });
  };

  v036SectorMedian=function atlasV036SectorMedian(ctx,seg){
    return v036Median(ctx.rows.filter(r=>r.seg===seg&&r.so>=10).map(r=>r.iir));
  };

  v036Asym=function atlasV036Asym(ctx){
    const s=v036Stats(ctx);
    return ['APNFD','FINANCIERO','PUBLICO'].map(k=>{
      const v=s.segments[k],m=V036_SEG[k],iir=v.shareSO?v.shareROS/v.shareSO:0,rosPerSo=v.so?v.ros/v.so:0;
      return `<div class="v036-asym-row"><div class="v036-asym-key"><i style="background:${m.color}"></i><div>${m.label}<small>${v.n} sectores</small></div></div><div class="v036-asym-bars"><div class="v036-asym-bar"><span>padrón</span><div class="v036-track" data-v036-tip="${esc(m.label)} · padrón|${v036F(v.shareSO,1)}%|${v036F(v.so)} SO"><div class="v036-fill ${v.shareSO<14?'tiny':''}" style="width:${Math.max(1,v.shareSO).toFixed(1)}%;background:${m.color}"><b>${v036F(v.shareSO,1)}%</b></div></div></div><div class="v036-asym-bar"><span>flujo ROS</span><div class="v036-track" data-v036-tip="${esc(m.label)} · ROS|${v036F(v.shareROS,1)}%|${v036F(v.ros)} ROS"><div class="v036-fill ${v.shareROS<14?'tiny':''}" style="width:${Math.max(1,v.shareROS).toFixed(1)}%;background:#22364b"><b>${v036F(v.shareROS,1)}%</b></div></div></div></div><div class="v036-asym-int" data-v036-tip="${esc(m.label)} · IIR|${v036F(iir,2)}×|${v036F(rosPerSo,2)} ROS/SO"><b style="color:${m.color}">${v036F(iir,2)}×</b><small>IIR</small></div></div>`;
    }).join('');
  };

  v036Reframe=function atlasV036Reframe(ctx){
    const s=v036Stats(ctx),biggest=s.nom.length?Math.max(...s.nom.map(r=>r.so)):0;
    return `<div class="v036-rf nominal"><span>Marca vigente · silencio nominal ${v036Help('nominal')}</span><h4>Cero ROS agregados en cinco años</h4><div class="v036-rfv"><b>${s.nom.length}</b><small>sectores · ${v036F(s.nomSO)} SO · ${v036Pct(s.nomSO,s.totalSO)} del padrón</small></div><p>Detecta silencio absoluto agregado. En el corte actual el mayor sector marcado contiene ${v036F(biggest)} SO.</p></div><div class="v036-rf structural"><span>Marca propuesta · silencio estructural ${v036Help('structural')}</span><h4>Padrón grande con reportabilidad casi nula</h4><div class="v036-rfv"><b>${s.est.length}</b><small>sectores · ${v036F(s.estSO)} SO · ${v036Pct(s.estSO,s.totalSO)} del padrón</small></div><p>SO ≥100 y menos de 0,05 ROS/SO en 2025. Aportan ${v036Pct(s.estROS,s.totalROS)} del flujo. Es una priorización supervisiva que requiere validación.</p></div>`;
  };

  v036Dossier=function atlasV036Dossier(row,ctx){
    const hi=Math.max(...row.s),years=row.s.map((v,i)=>`<div class="v036-year ${v===0?'zero':v===hi&&hi>0?'peak':''}"><span>${V036_YEARS[i]}</span><b>${v036F(v)}</b></div>`).join('');
    const med=v036SectorMedian(ctx,row.seg);
    let read=iirRead(row);
    if(row.marks.includes('nominal'))read=`Sector con <b>${v036F(row.so)} SO</b> y cero ROS agregados durante 2021–2025. Antes de interpretar la marca debe verificarse actividad efectiva, obligación aplicable y cobertura del registro.`;
    else if(row.marks.includes('estructural'))read=`Con <b>${v036F(row.so)} SO</b> (${v036F(row.shareSO,1)}% del padrón), produce ${v036F(row.ros)} ROS en 2025: ${v036F(row.rosPerSo,2)} ROS/SO e IIR ${v036F(row.iir,2)}×. La prioridad es supervisiva y comparativa; no sancionatoria.`;
    else if(row.marks.includes('caida'))read=`${iirRead(row)} Además, el flujo cae <b>${v036F(Math.abs(row.delta),1)}%</b> frente a 2024. Debe contrastarse con la serie completa y la concentración por entidad antes de atribuir una causa.`;
    else if(row.marks.includes('alza'))read=`${iirRead(row)} Además, el flujo sube <b>${v036F(row.delta,1)}%</b> frente a 2024. Una variación fuerte puede estar concentrada en pocos SO.`;
    const rule=typeof v0193FindRule==='function'?v0193FindRule(row.raw,ctx.uaf.ruleMap):null;
    return `<div class="v036-dossier-in"><div class="v036-dsec"><div class="v036-dname">${esc(row.name)}</div><h4>Serie ROS 2021–2025</h4><div class="v036-years">${years}</div><h4 style="margin-top:13px">Lectura analítica</h4><p>${read}</p></div><div class="v036-dsec"><h4>Posición en el universo</h4><div class="v036-rules"><div class="v036-rule"><span>Segmento analítico</span><b>${V036_SEG[row.seg].label}</b><small>Clasificación de esta vista; no es una categoría de riesgo.</small></div><div class="v036-rule"><span>SO 2025</span><b class="big">${v036F(row.so)}</b><small>${v036F(row.shareSO,1)}% del padrón sectorial.</small></div><div class="v036-rule"><span>ROS 2025</span><b class="big">${v036F(row.ros)}</b><small>${v036F(row.shareROS,2)}% del flujo.</small></div><div class="v036-rule"><span>Acumulado 5 años</span><b class="big">${v036F(row.total)}</b></div></div></div><div class="v036-dsec"><h4>Intensidad y obligación</h4><div class="v036-rules"><div class="v036-rule"><span>ROS/SO</span><b class="big">${v036F(row.rosPerSo,row.rosPerSo<10?2:1)}</b><small>ROS 2025 por sujeto inscrito al cierre 2025. ${v036Help('intensity')}</small></div><div class="v036-rule"><span>IIR</span><b class="big">${v036F(row.iir,2)}×</b><small>${iirLabel(row.iir)} · %ROS / %SO. ${v036Help('iir')}</small></div><div class="v036-rule"><span>Mediana IIR del segmento</span><b class="big">${v036F(med,2)}×</b><small>Sectores con ≥10 SO.</small></div><div class="v036-rule"><span>ROE</span><b>${rule?.roe_required===true?'Obligación materializada':rule?.roe_required===false?'No obligatorio / no materializado':'Revisar regla'}</b><small>${esc(rule?.roe_frequency||rule?.notes||'Contrato normativo disponible en aml_reporting_rules.')}</small></div></div><div class="v036-actions"><button class="v036-btn" data-v036-sector="${esc(row.name)}">Abrir ficha UAF</button><button class="v036-btn" data-v036-recon-sector="${esc(row.name)}">Conciliación</button><button class="v036-btn" data-v036-nav="sanctions">Sanciones</button></div></div></div><div class="v036-guard"><b>Guardrail:</b> IIR y ROS/SO describen intensidad agregada sectorial. No miden calidad del ROS, riesgo LA/FT ni cumplimiento individual. El padrón es una foto al cierre de 2025.</div>`;
  };

  v036RenderMatrix=function atlasV036RenderMatrix(){
    const host=document.querySelector('#v036-rows');if(!host)return;
    const rows=v036Filtered(),ctx=V036_STATE.ctx;
    host.innerHTML=rows.length?rows.map((r,i)=>{
      const idx=V036_STATE.rows.indexOf(r),iir=iirLabel(r.iir);
      return `<button class="v036-mxrow" data-v036-row="${idx}" aria-expanded="false"><div class="v036-mxname" title="${esc(r.name)}">${esc(v036Cut(r.name,48))}<small><i style="background:${V036_SEG[r.seg].color}"></i>${V036_SEG[r.seg].label}</small></div><div class="v036-mxn">${v036F(r.so)}</div><div class="v036-mxn">${v036F(r.ros)}</div><div class="v036-mxn strong" data-v036-tip="ROS por sujeto obligado|${v036F(r.rosPerSo,r.rosPerSo<10?2:1)}|${v036F(r.ros)} ROS / ${v036F(r.so)} SO">${v036F(r.rosPerSo,r.rosPerSo<10?2:1)}</div><div class="v036-mxn strong" data-v036-tip="Intensidad relativa de reportabilidad|${v036F(r.iir,2)}× · ${esc(iir)}|${v036F(r.shareROS,2)}% ROS / ${v036F(r.shareSO,2)}% SO">${v036F(r.iir,2)}×</div>${v036Delta(r)}${v036Spark(r,i)}<div class="v036-marks">${r.marks.slice(0,2).map(v036Badge).join('')}</div><div class="v036-chev">▶</div></button><div class="v036-dossier" data-v036-dossier="${idx}"></div>`;
    }).join(''):'<div style="padding:30px;text-align:center;color:#5b7188">Sin sectores para el filtro activo.</div>';
    const so=v036Sum(rows,'so'),ros=v036Sum(rows,'ros'),fs=document.querySelector('#v036-fstate');
    if(fs)fs.innerHTML=`Mostrando <b>${rows.length}</b> de ${V036_STATE.rows.length} sectores · <b>${v036F(so)}</b> SO (${v036Pct(so,v036Sum(V036_STATE.rows,'so'))}) · <b>${v036F(ros)}</b> ROS (${v036Pct(ros,v036Sum(V036_STATE.rows,'ros'))})`;
    host.querySelectorAll('[data-v036-row]').forEach(btn=>btn.addEventListener('click',()=>{const idx=Number(btn.dataset.v036Row),box=document.querySelector(`[data-v036-dossier="${idx}"]`),open=box?.classList.contains('open');document.querySelectorAll('.v036-dossier.open').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.v036-mxrow[aria-expanded="true"]').forEach(x=>x.setAttribute('aria-expanded','false'));if(box&&!open){box.innerHTML=v036Dossier(V036_STATE.rows[idx],ctx);box.classList.add('open');btn.setAttribute('aria-expanded','true');v036BindDynamic(ctx);}}));
  };

  const previousDashboard=v036Dashboard;
  v036Dashboard=function atlasV036Dashboard(ctx){
    let html=previousDashboard(ctx);
    html=html.replace('data-v036-sort="int">ROS/100</button><button data-v036-sort="shareROS">% flujo</button>','data-v036-sort="rosPerSo">ROS/SO</button><button data-v036-sort="iir">IIR '+v036Help('iir')+'</button>');
    html=html.replace('Intensidad = ROS/100 SO '+v036Help('intensity'),'IIR = %ROS / %SO '+v036Help('iir'));
    html=html.replace(/<button class="v036-chip ([^"]*)" data-v036-filter="concentrador">Concentrador <b>\d+<\/b><\/button>/,`<button class="v036-chip $1" data-v036-filter="muy_alto">IIR muy alto <b>${ctx.rows.filter(r=>r.marks.includes('muy_alto')).length}</b></button>`);
    html=html.replace('<b>La intensidad</b> normaliza el flujo por cada 100 SO.','<b>ROS/SO</b> muestra el flujo medio por sujeto inscrito. <b>IIR</b> compara la participación del sector en ROS con su participación en el padrón; 1,0× representa proporcionalidad.');
    html=html.replace('<b>Silencio estructural</b> agrega una lente de escala: padrón ≥100 e intensidad &lt;5.','<b>Silencio estructural</b> agrega una lente de escala: padrón ≥100 y menos de 0,05 ROS/SO.');
    return html;
  };

  window.ATLAS_REPORTABILITY_CURRENT={release:RELEASE,build:BUILD,metric:'ROS_PER_SO+IIR',iir_formula:'SHARE_ROS/SHARE_SO',legacy_ros_per_100:'TRACEABILITY_ONLY',bands:{very_low:'<0.25x',low:'0.25–<0.75x',proportional:'0.75–1.50x',high:'>1.50–3.00x',very_high:'>3.00x'},guardrail:'SECTOR_COMPARISON_NOT_RISK_OR_COMPLIANCE'};
})();
