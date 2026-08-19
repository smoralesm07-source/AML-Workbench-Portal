'use strict';

/* ATLAS AML · Entity 360 current authority
 * Production adaptation of the approved entity360.html analytical design.
 * Uses only governed/materialized ATLAS data. No synthetic entity facts.
 * Missing data is declared as a gap; context never transfers risk.
 */
(function atlasEntity360Current0445(){
  const RELEASE='0.44.5';
  const BUILD='0445';
  const AUTHORITY='ENTITY360_HTML_PRODUCTION_ADAPTATION_0445';
  const BASE_OPEN=typeof v0203OpenEntity==='function'?v0203OpenEntity:(typeof window.openEntity==='function'?window.openEntity:null);
  const EXTRAS=new Map();
  const INFLIGHT=new Map();
  let activeLens='identity';

  const SOURCES=[
    {id:'SII',label:'Radar SII',cls:'sii'},
    {id:'UAF',label:'Radar UAF',cls:'uaf'},
    {id:'SPEND',label:'Presupuesto',cls:'spend'},
    {id:'SAN',label:'Sanciones',cls:'san'},
    {id:'CGR',label:'Radar CGR',cls:'cgr'},
    {id:'OSFL',label:'Radar OSFL',cls:'osfl'},
    {id:'DEL',label:'Radar Delictual',cls:'del'},
    {id:'PRESS',label:'Prensa',cls:'press'}
  ];
  const LENSES=[
    ['identity','01','Identidad'],
    ['character','02','Caracterización'],
    ['timeline','03','Cronología'],
    ['network','04','Red de exposición'],
    ['signals','05','Señales y convergencia'],
    ['evidence','06','Evidencia y decisión']
  ];

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function arr(v){
    if(Array.isArray(v))return v;
    if(v==null||v==='')return [];
    if(typeof v==='string'){
      try{const j=JSON.parse(v);if(Array.isArray(j))return j;}catch(_e){}
      return v.split(/[|;]/).map(x=>x.trim()).filter(Boolean);
    }
    return [v];
  }
  function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
  function fmt(v,d=0){const n=num(v);return n==null?'—':n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});}
  function money(v){
    const n=num(v);if(n==null)return'—';const a=Math.abs(n);
    if(a>=1e12)return'$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';
    if(a>=1e9)return'$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M';
    if(a>=1e6)return'$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M';
    return'$'+Math.round(n).toLocaleString('es-CL');
  }
  function short(v,n=78){const s=String(v??'');return s.length>n?s.slice(0,n-1)+'…':s;}
  function clean(v){return String(v??'').trim().replace(/[%_]/g,'').slice(0,120);}
  function content(){return typeof v019Content==='function'?v019Content():document.querySelector('#content');}
  function producerIds(f){
    const ids=arr(f?.payload?.producer_ids||f?.producer_ids).map(String);
    if(f?.producer_id)ids.push(String(f.producer_id));
    return [...new Set(ids)];
  }
  function hasProducer(findings,needle){return (findings||[]).some(f=>producerIds(f).some(x=>x.toUpperCase().includes(needle)));}
  function evidenceIds(f){return arr(f?.payload?.evidence_ids||f?.evidence_ids).map(String).filter(Boolean);}
  function evidenceCount(findings){
    const set=new Set((findings||[]).flatMap(evidenceIds));
    if(set.size)return set.size;
    return (findings||[]).reduce((a,f)=>a+(num(f.evidence_count)||0),0);
  }
  function taxCurrent(pkg){return pkg.tax||((pkg.taxRows||[]).length?pkg.taxRows[pkg.taxRows.length-1]:null);}
  function parseDateYear(v){
    if(v==null)return null;
    const m=String(v).match(/(19|20)\d{2}/);
    return m?Number(m[0]):null;
  }
  function latestDate(values){
    const cleanVals=values.filter(Boolean).map(String);
    if(!cleanVals.length)return null;
    cleanVals.sort();
    return cleanVals.at(-1);
  }
  function priority(pkg){
    try{
      if(typeof v0209EntityPriority==='function'){
        const p=v0209EntityPriority(pkg.findings||[]);
        if(num(p?.score)!=null)return num(p.score);
      }
    }catch(_e){}
    const vals=(pkg.findings||[]).map(f=>num(f.score_investigate)).filter(v=>v!=null);
    return vals.length?Math.max(...vals):null;
  }
  function priorityTier(score){
    if(score==null)return{tier:'—',label:'sin prioridad materializada'};
    if(score>=75)return{tier:'P1',label:'revisión prioritaria'};
    if(score>=50)return{tier:'P2',label:'revisión intermedia'};
    return{tier:'P3',label:'revisión contextual'};
  }
  function reportingSector(pkg){
    if(pkg.sector)return pkg.sector;
    for(const f of pkg.findings||[]){
      const s=arr(f?.payload?.sector_names).find(Boolean);
      if(s)return String(s);
    }
    return null;
  }
  function taxStatus(tax){
    if(!tax)return{tone:'neutral',label:'Sin perfil SII materializado'};
    const raw=String(tax.current_status||'').toUpperCase();
    if(/TERM|CES|INACT|NO VIG/.test(raw))return{tone:'bad',label:tax.current_status||'Término / inactividad publicada'};
    return{tone:'good',label:tax.current_status||'Actividad tributaria vigente'};
  }
  function extraFor(pkg){return EXTRAS.get(pkg?.e?.entity_id)||{spend:null,recon:null,hydrating:true,error:null};}

  function sourceStates(pkg,extra){
    const findings=pkg.findings||[],tax=taxCurrent(pkg),e=pkg.e||{},san=pkg.sanctions||[];
    const cgrRows=findings.filter(f=>producerIds(f).some(x=>x.toUpperCase().includes('CGR')));
    const cgrCandidate=cgrRows.some(f=>/CANDID|NAME|NOMBRE/i.test(String(f?.payload?.identity_status||'')+' '+String(f?.payload?.match_method||'')));
    const sector=reportingSector(pkg);
    const map={
      SII:{state:tax?'RESUELTA':'SIN DATO',method:tax?'ENTITY_ID / RUT gobernado':null,asOf:tax?.commercial_year||tax?.updated_at||e.updated_at,detail:tax?'Perfil tributario materializado':'Sin perfil tributario disponible'},
      UAF:{state:e.is_uaf_observed?'RESUELTA':sector||extra?.recon?'SCREENING':'SIN DATO',method:e.is_uaf_observed?'Registro UAF materializado':sector?'Compatibilidad sectorial / conciliación':'Sin condición materializada',asOf:extra?.recon?.updated_at||e.updated_at,detail:e.is_uaf_observed?'Figura como observado UAF en el corte ATLAS':sector?'Screening: no acredita condición jurídica de sujeto obligado':'No se concluye pertenencia o exclusión del perímetro UAF'},
      SPEND:{state:extra?.spend?.matched?'RESUELTA':extra?.hydrating?'CARGANDO':'SIN DATO',method:extra?.spend?.matched?'RUT exacto':null,asOf:extra?.spend?.lastYear||null,detail:extra?.spend?.matched?`${money(extra.spend.amount)} observados en ${fmt(extra.spend.organizations)} organismo(s)`:'Sin match exacto materializado'},
      SAN:{state:san.length?'RESUELTA':'SIN DATO',method:san.length?'Entity ID / identidad resuelta':null,asOf:latestDate(san.map(x=>x.event_date||x.updated_at)),detail:san.length?`${san.length} evento(s) administrativo(s)`:'Sin evento sancionatorio materializado'},
      CGR:{state:cgrRows.length?(cgrCandidate?'CANDIDATA':'OBSERVADA'):'SIN DATO',method:cgrRows.length?(cgrRows[0]?.payload?.match_method||cgrRows[0]?.payload?.identity_method||'Asociación materializada'):null,asOf:latestDate(cgrRows.map(x=>x.updated_at||x?.payload?.observed_from)),detail:cgrRows.length?`${cgrRows.length} hallazgo(s)/contexto(s) CGR`:'Sin hallazgo CGR materializado'},
      OSFL:{state:hasProducer(findings,'OSFL')?'OBSERVADA':'SIN DATO',method:hasProducer(findings,'OSFL')?'Asociación de productor':null,asOf:latestDate(findings.filter(f=>producerIds(f).some(x=>x.toUpperCase().includes('OSFL'))).map(x=>x.updated_at)),detail:hasProducer(findings,'OSFL')?'Existe evidencia OSFL asociada':'Sin dato OSFL para esta entidad'},
      DEL:{state:hasProducer(findings,'DELICT')?'CONTEXTO':'SIN DATO',method:hasProducer(findings,'DELICT')?'Contexto territorial':null,asOf:latestDate(findings.filter(f=>producerIds(f).some(x=>x.toUpperCase().includes('DELICT'))).map(x=>x.updated_at)),detail:hasProducer(findings,'DELICT')?'Contexto agregado; nunca atribución individual':'Sin contexto delictual asociado'},
      PRESS:{state:hasProducer(findings,'PRENSA')||hasProducer(findings,'PRESS')?'CONTEXTO':'SIN DATO',method:hasProducer(findings,'PRENSA')||hasProducer(findings,'PRESS')?'Mención / contexto':null,asOf:latestDate(findings.filter(f=>producerIds(f).some(x=>/PRENSA|PRESS/i.test(x))).map(x=>x.updated_at)),detail:hasProducer(findings,'PRENSA')||hasProducer(findings,'PRESS')?'Menciones/contexto materializado':'Sin mención de prensa materializada'}
    };
    return SOURCES.map(s=>({...s,...map[s.id]}));
  }

  async function hydrateExtras(pkg){
    const id=pkg?.e?.entity_id;if(!id||INFLIGHT.has(id))return INFLIGHT.get(id);
    const job=(async()=>{
      const extra={spend:null,recon:null,hydrating:true,error:null};
      EXTRAS.set(id,extra);
      const tasks=[];
      tasks.push((async()=>{
        try{
          if(typeof v037LoadData==='function')await v037LoadData();
          if(typeof v038PublicSpendContext==='function')extra.spend=v038PublicSpendContext(pkg);
        }catch(e){extra.spend=null;extra.spendError=String(e?.message||e);}
      })());
      tasks.push((async()=>{
        try{
          if(typeof sb==='undefined')return;
          const {data,error}=await sb.from('aml_v0210_uaf_sii_reconciliation').select('*').eq('entity_id',id).limit(1);
          if(error)throw error;
          extra.recon=Array.isArray(data)?(data[0]||null):data||null;
        }catch(e){extra.recon=null;extra.reconError=String(e?.message||e);}
      })());
      await Promise.all(tasks);
      extra.hydrating=false;
      EXTRAS.set(id,extra);
      if(state?.selectedEntity===id)renderEntity(pkg,true);
      return extra;
    })().finally(()=>INFLIGHT.delete(id));
    INFLIGHT.set(id,job);
    return job;
  }

  function roleChips(pkg,extra){
    const out=[],tax=taxCurrent(pkg),ts=taxStatus(tax),states=sourceStates(pkg,extra);
    if(tax)out.push([ts.label,ts.tone]);
    if(pkg.e?.is_uaf_observed)out.push(['SO UAF observado','uaf']);
    else if(reportingSector(pkg)||extra?.recon)out.push(['Perímetro UAF a verificar','warn']);
    if(extra?.spend?.matched)out.push(['Proveedor del Estado','spend']);
    if((pkg.sanctions||[]).length)out.push(['Con sanciones','bad']);
    const cgr=states.find(x=>x.id==='CGR');if(cgr?.state!=='SIN DATO')out.push(['Contexto CGR',cgr.state==='CANDIDATA'?'warn':'cgr']);
    return out.map(([t,c])=>`<span class="${esc(c)}">${esc(t)}</span>`).join('');
  }

  function sourceRibbon(pkg,extra){
    const states=sourceStates(pkg,extra);
    return `<div class="a45-source-ribbon">${states.map(s=>`<button type="button" class="a45-source ${esc(s.cls)} ${s.state==='SIN DATO'?'muted':''}" data-a45-source="${s.id}">
      <i></i><b>${esc(s.label)}</b><span>${esc(s.state)}</span><small>${esc(s.asOf||'corte no informado')}</small>
    </button>`).join('')}</div>`;
  }

  function hero(pkg,extra){
    const e=pkg.e,tax=taxCurrent(pkg),score=priority(pkg),pt=priorityTier(score);
    const states=sourceStates(pkg,extra),resolved=states.filter(s=>!['SIN DATO','CARGANDO'].includes(s.state)).length;
    const ev=evidenceCount(pkg.findings||[]);
    const place=e.commune||e.region||tax?.commune||tax?.region||'territorio no materializado';
    return `<section class="a45-cover">
      <div class="a45-command">
        <button type="button" class="a45-btn ghost" id="a45-back">← Entidades</button>
        <div><span class="a45-live">Expediente gobernado</span><button type="button" class="a45-btn" id="a45-export">Exportar expediente</button></div>
      </div>
      <div class="a45-cover-grid">
        <div class="a45-identity">
          <span class="a45-eyebrow">EXPEDIENTE ANALÍTICO 360 · IDENTIDAD CANÓNICA</span>
          <h1>${esc(e.name||e.entity_id)}</h1>
          <p><b>${esc(e.rut||'RUT no materializado')}</b><span>·</span>${esc(place)}<span>·</span><code>${esc(e.entity_id)}</code></p>
          <div class="a45-roles">${roleChips(pkg,extra)}</div>
        </div>
        <div class="a45-readings">
          <div><span>Fuentes con dato</span><strong>${resolved}<small>/ ${SOURCES.length}</small></strong><em>cobertura observable</em></div>
          <div><span>Prioridad de revisión</span><strong class="tier">${esc(pt.tier)}</strong><em>${esc(pt.label)} · no probabilidad</em></div>
          <div><span>Evidencia trazable</span><strong>${fmt(ev)}</strong><em>referencias materializadas</em></div>
        </div>
      </div>
      ${sourceRibbon(pkg,extra)}
    </section>`;
  }

  function lensNav(){
    return `<nav class="a45-lenses" aria-label="Lentes del expediente">${LENSES.map(([id,n,t])=>`<button type="button" data-a45-lens="${id}" class="${activeLens===id?'active':''}"><span>${n}</span>${esc(t)}</button>`).join('')}</nav>`;
  }

  function sourceTable(pkg,extra){
    const states=sourceStates(pkg,extra);
    return `<div class="a45-table"><table><thead><tr><th>Fuente</th><th>Resolución</th><th>Método</th><th>Corte</th><th>Lectura</th></tr></thead><tbody>${states.map(s=>`<tr>
      <td><span class="a45-src-pill ${s.cls}"><i></i>${esc(s.label)}</span></td>
      <td><span class="a45-state ${/RESUELTA|OBSERVADA/.test(s.state)?'good':/CANDID|SCREENING|CARGANDO/.test(s.state)?'warn':'neutral'}">${esc(s.state)}</span></td>
      <td>${esc(s.method||'—')}</td><td>${esc(s.asOf||'—')}</td><td>${esc(s.detail||'—')}</td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  function identityConflicts(pkg,extra){
    const states=sourceStates(pkg,extra),items=[];
    if(!pkg.e?.rut)items.push(['Identidad','La entidad no tiene RUT materializado; los cruces sensibles deben mantenerse como candidatos.']);
    for(const s of states){
      if(s.state==='CANDIDATA')items.push([s.label,`${s.detail}. Toda inferencia hereda esta incertidumbre de identidad.`]);
      if(s.id==='UAF'&&s.state==='SCREENING')items.push(['Perímetro UAF','Existe compatibilidad/conciliación sectorial, pero no se infiere la calidad jurídica de sujeto obligado desde ACTECO.']);
    }
    if(!items.length)items.push(['Sin conflicto de identidad abierto','No se detectó en los datos cargados una asociación explícitamente candidata. Esto no sustituye la revisión de fuente.']);
    return `<div class="a45-stack">${items.map(([t,d])=>`<div class="a45-gap"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>`;
  }

  function aliases(pkg){
    const rows=[];
    const add=(name,src)=>{const n=String(name||'').trim();if(n&&!rows.some(r=>r[0]===n&&r[1]===src))rows.push([n,src]);};
    add(pkg.e?.name,'Entidad canónica');
    for(const s of pkg.sanctions||[])add(s.entity_name,'Radar Sanciones');
    for(const f of pkg.findings||[]){
      const p=f.payload||{};
      add(p.source_entity_name||p.matched_name||p.entity_name,producerIds(f)[0]||'Hallazgo');
    }
    return rows.length?`<div class="a45-table"><table><thead><tr><th>Denominación observada</th><th>Origen</th></tr></thead><tbody>${rows.slice(0,20).map(r=>`<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>`:`<div class="a45-empty">No hay alias adicionales materializados.</div>`;
  }

  function identityPanel(pkg,extra){
    return `<section class="a45-panel ${activeLens==='identity'?'active':''}" data-a45-panel="identity">
      <div class="a45-panel-head"><span class="a45-eyebrow">LENTE 01 · IDENTIDAD</span><h2>Quién es esta entidad, y con qué certeza</h2><p>Cada fuente conserva su método de vinculación. Una asociación candidata nunca se eleva automáticamente a identidad canónica.</p></div>
      <div class="a45-grid g21"><article class="a45-card"><h3>Resolución por fuente</h3>${sourceTable(pkg,extra)}</article><article class="a45-card"><h3>Conflictos y cautelas abiertos</h3>${identityConflicts(pkg,extra)}</article></div>
      <div class="a45-grid g11"><article class="a45-card"><h3>Roles observados</h3><div class="a45-role-list">${roleChips(pkg,extra)||'<span>Sin roles adicionales materializados</span>'}</div><p class="a45-note">Los roles pueden coexistir y no se heredan entre entidades relacionadas.</p></article><article class="a45-card"><h3>Denominaciones y alias</h3>${aliases(pkg)}</article></div>
    </section>`;
  }

  function activityRows(tax){
    if(!tax)return[];
    const codes=arr(tax.activity_codes),names=arr(tax.activity_names);
    return codes.map((code,i)=>({code,name:names[i]||'Glosa no materializada'}));
  }

  function trajectorySvg(pkg){
    const rows=(pkg.taxRows||[]).filter(r=>parseDateYear(r.commercial_year)).sort((a,b)=>Number(a.commercial_year)-Number(b.commercial_year));
    if(rows.length<2)return`<div class="a45-empty">La serie tributaria no tiene suficientes períodos para dibujar trayectoria.</div>`;
    const W=760,H=210,pl=42,pr=18,top=25,bottom=34,iw=W-pl-pr,ih=H-top-bottom;
    const years=rows.map(r=>Number(r.commercial_year)),minY=Math.min(...years),maxY=Math.max(...years);
    const maxBand=Math.max(12,...rows.map(r=>num(r.sales_band_rank)||num(r.sales_band_code)||0));
    const maxWorkers=Math.max(1,...rows.map(r=>num(r.workers_numeric)||0));
    const x=y=>pl+(maxY===minY?0.5:(y-minY)/(maxY-minY))*iw;
    const yBand=v=>top+ih-(v/maxBand)*ih;
    const yWork=v=>top+ih-(v/maxWorkers)*ih;
    const line=(key,scale)=>rows.map((r,i)=>`${i?'L':'M'}${x(Number(r.commercial_year)).toFixed(1)},${scale(num(r[key])||0).toFixed(1)}`).join(' ');
    return `<div class="a45-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trayectoria tributaria">
      ${[0,.5,1].map(f=>`<line x1="${pl}" y1="${(top+ih*f).toFixed(1)}" x2="${W-pr}" y2="${(top+ih*f).toFixed(1)}" class="grid"/>`).join('')}
      <path d="${line('sales_band_rank',yBand)}" class="sales"/>
      <path d="${line('workers_numeric',yWork)}" class="workers"/>
      ${rows.map(r=>`<circle cx="${x(Number(r.commercial_year)).toFixed(1)}" cy="${yBand(num(r.sales_band_rank)||num(r.sales_band_code)||0).toFixed(1)}" r="4" class="sales-dot"><title>${esc(r.commercial_year)} · tramo ${esc(r.sales_band||r.sales_band_code||'—')}</title></circle>
      <circle cx="${x(Number(r.commercial_year)).toFixed(1)}" cy="${yWork(num(r.workers_numeric)||0).toFixed(1)}" r="4" class="workers-dot"><title>${esc(r.commercial_year)} · ${fmt(r.workers_numeric)} trabajadores</title></circle>
      <text x="${x(Number(r.commercial_year)).toFixed(1)}" y="${H-10}" text-anchor="middle">${esc(r.commercial_year)}</text>`).join('')}
    </svg><div class="a45-legend"><span class="sales-key">Tramo de ventas (rango)</span><span class="workers-key">Trabajadores</span></div><p class="a45-note">Las dos series se escalan por separado para evitar un eje doble engañoso. Los tramos son rangos, no ventas exactas.</p></div>`;
  }

  function peerContext(pkg){
    const p=pkg.e?.profile?.peer_context||pkg.e?.profile?.economic_peer_context||taxCurrent(pkg)?.peer_context||null;
    if(!p)return`<div class="a45-gap"><b>Benchmark de pares no materializado</b><p>ATLAS no inventa percentiles. Cuando Context Hub entregue grupo y métricas de pares, esta tarjeta mostrará posición relativa por giro, territorio y período.</p></div>`;
    const metrics=Array.isArray(p.metrics)?p.metrics:Object.entries(p.metrics||{}).map(([k,v])=>({label:k,value:v}));
    return `<p class="a45-note">Grupo: ${esc(p.level||p.group||p.label||'materializado')}</p><div class="a45-peer">${metrics.slice(0,8).map(m=>{const v=num(m.pct??m.percentile??m.value);return`<div><span>${esc(m.label||m.k||m.name||'Métrica')}</span><progress max="100" value="${Math.max(0,Math.min(100,v||0))}"></progress><b>${v==null?'—':'p'+Math.round(v)}</b></div>`;}).join('')}</div>`;
  }

  function uafBox(pkg,extra){
    const sector=reportingSector(pkg),r=pkg.reporting||{},registered=pkg.e?.is_uaf_observed===true;
    const recon=extra?.recon;
    return `<div class="a45-uafbox ${registered?'registered':sector?'screening':''}">
      <span class="a45-eyebrow">PERÍMETRO Y REPORTABILIDAD</span>
      <h4>${registered?'Inscripción UAF materializada':sector?'Condición UAF a verificar':'Sin condición UAF materializada'}</h4>
      <p>${registered?'El registro UAF es el dato rector en ATLAS.':sector?'Existe compatibilidad sectorial/ACTECO, que sirve para preselección y no acredita obligación legal.':'No se afirma que la entidad esté dentro o fuera del perímetro cuando falta dato rector.'}</p>
      <dl><dt>Sector</dt><dd>${esc(sector||'—')}</dd><dt>Conciliación UAF–SII</dt><dd>${esc(recon?.reconciliation_status||'—')}</dd><dt>ROS</dt><dd>${r.ros_required===true?'Regla sectorial materializada':r.ros_required===false?'No requerido según regla':'—'}</dd><dt>ROE</dt><dd>${r.roe_required===true?esc(r.roe_frequency||'Regla sectorial materializada'):r.roe_required===false?'No requerido según regla':'—'}</dd></dl>
      <small>Las reglas ROS/ROE son sectoriales. ATLAS no infiere reportabilidad individual desde información pública agregada.</small>
    </div>`;
  }

  function characterPanel(pkg,extra){
    const tax=taxCurrent(pkg),acts=activityRows(tax),ts=taxStatus(tax);
    const facts=[
      ['Estado tributario',ts.label],['Forma / tipo',tax?.taxpayer_type||pkg.e?.entity_type||'—'],['Subtipo',tax?.taxpayer_subtype||'—'],
      ['Inicio de actividades',tax?.activity_start_date||'—'],['Actividad principal',tax?.main_activity||'—'],['Tramo de ventas',tax?.sales_band||tax?.sales_band_code||'—'],
      ['Trabajadores',fmt(tax?.workers_numeric)],['Domicilios publicados',fmt(tax?.address_count)],['Regiones históricas',arr(tax?.address_regions).length?fmt(arr(tax.address_regions).length):'—']
    ];
    return `<section class="a45-panel ${activeLens==='character'?'active':''}" data-a45-panel="character">
      <div class="a45-panel-head"><span class="a45-eyebrow">LENTE 02 · CARACTERIZACIÓN</span><h2>Qué es esta entidad, cómo opera y dónde están los límites del dato</h2><p>Combina estado tributario, actividad económica, trayectoria y perímetro UAF. Los benchmarks solo aparecen cuando están realmente materializados.</p></div>
      <div class="a45-grid g12"><article class="a45-card"><h3>Ficha registral y tributaria</h3><dl class="a45-dl">${facts.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></article><article class="a45-card"><h3>Posición frente a pares</h3>${peerContext(pkg)}</article></div>
      <div class="a45-grid g21"><article class="a45-card"><h3>Giros y perímetro UAF</h3>${acts.length?`<div class="a45-table"><table><thead><tr><th>ACTECO</th><th>Glosa</th></tr></thead><tbody>${acts.map(a=>`<tr><td><code>${esc(a.code)}</code></td><td>${esc(a.name)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="a45-empty">No hay actividades económicas desagregadas en el perfil actual.</div>`}${uafBox(pkg,extra)}</article><article class="a45-card"><h3>Trayectoria económica</h3>${trajectorySvg(pkg)}</article></div>
    </section>`;
  }

  function timelineEvents(pkg,extra){
    const rows=[];
    const add=(year,source,title,detail,kind='event',raw=null)=>{const y=parseDateYear(year);if(y)rows.push({year:y,source,title,detail,kind,raw});};
    for(const t of pkg.taxRows||[])add(t.commercial_year,'SII',`Corte tributario ${t.commercial_year}`,`Tramo ${t.sales_band||t.sales_band_code||'—'} · ${fmt(t.workers_numeric)} trabajadores`,'tax',t);
    for(const s of pkg.sanctions||[])add(s.event_date,'SAN',s.regulator||'Sanción',s.subject||'Evento administrativo','adverse',s);
    for(const y of extra?.spend?.annual||[])add(y.year,'SPEND','Gasto del Estado',`${money(y.value)} observado en el año`,'flow',y);
    (pkg.findings||[]).forEach((f,i)=>{
      const p=f.payload||{};
      const when=p.observed_from||p.event_date||p.period_start||p.period||p.year;
      if(when)add(when,sourceKeyFromFinding(f),f.title||f.finding_type||'Hallazgo',p.explanation||p.summary||f.finding_type||'Señal materializada','signal',{f,i});
    });
    return rows.sort((a,b)=>a.year-b.year||String(a.source).localeCompare(String(b.source)));
  }
  function sourceKeyFromFinding(f){
    const ids=producerIds(f).map(x=>x.toUpperCase());
    if(ids.some(x=>x.includes('CGR')))return'CGR';
    if(ids.some(x=>x.includes('OSFL')))return'OSFL';
    if(ids.some(x=>x.includes('PRENSA')||x.includes('PRESS')))return'PRESS';
    if(ids.some(x=>x.includes('DELICT')))return'DEL';
    if(ids.some(x=>x.includes('UAF')))return'UAF';
    if(ids.some(x=>x.includes('SANC')))return'SAN';
    if(ids.some(x=>x.includes('PRESUP')||x.includes('SPEND')))return'SPEND';
    if(ids.some(x=>x.includes('SII')))return'SII';
    return'OTHER';
  }
  function timelineChart(pkg,extra){
    const ev=timelineEvents(pkg,extra);
    if(!ev.length)return`<div class="a45-empty">No hay eventos con período explícito suficiente para construir cronología. ATLAS no sustituye fecha de ocurrencia por fecha de carga.</div>`;
    const lanes=[...new Set(ev.map(x=>x.source))],years=ev.map(x=>x.year),min=Math.min(...years),max=Math.max(...years),W=900,laneH=44,pl=130,pr=20,top=32,H=top+lanes.length*laneH+38,iw=W-pl-pr;
    const x=y=>pl+(max===min?0.5:(y-min)/(max-min))*iw;
    const sourceCls=id=>(SOURCES.find(s=>s.id===id)?.cls||'fusion');
    const convergence={};for(const e of ev){convergence[e.year]??=new Set();convergence[e.year].add(e.source);}
    return `<div class="a45-timeline-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cronología multi-fuente">
      ${Object.entries(convergence).filter(([,set])=>set.size>=3).map(([y])=>`<rect x="${(x(Number(y))-14).toFixed(1)}" y="${top-18}" width="28" height="${lanes.length*laneH+18}" class="convwin"/>`).join('')}
      ${[...new Set(years)].map(y=>`<line x1="${x(y).toFixed(1)}" y1="${top-14}" x2="${x(y).toFixed(1)}" y2="${top+lanes.length*laneH}" class="grid"/><text x="${x(y).toFixed(1)}" y="14" text-anchor="middle">${y}</text>`).join('')}
      ${lanes.map((l,i)=>{const yy=top+i*laneH+laneH/2;return`<text x="4" y="${yy+4}" class="lane">${esc(SOURCES.find(s=>s.id===l)?.label||l)}</text><line x1="${pl}" y1="${yy}" x2="${W-pr}" y2="${yy}" class="lane-line"/>`;}).join('')}
      ${ev.map((e,i)=>{const yy=top+lanes.indexOf(e.source)*laneH+laneH/2;return`<circle cx="${x(e.year).toFixed(1)}" cy="${yy}" r="${e.kind==='adverse'?7:5}" class="event ${sourceCls(e.source)}" data-a45-event="${i}"><title>${esc(e.year+' · '+e.title+' · '+e.detail)}</title></circle>`;}).join('')}
    </svg></div>
    <div class="a45-conv-years">${Object.entries(convergence).sort((a,b)=>Number(a[0])-Number(b[0])).map(([y,set])=>`<div class="${set.size>=3?'strong':''}"><b>${y}</b><span>${set.size} fuente(s)</span></div>`).join('')}</div>
    <p class="a45-note">La franja destaca años con ≥3 fuentes independientes con eventos fechados. Coincidencia temporal no implica causalidad.</p>`;
  }
  function timelinePanel(pkg,extra){
    return `<section class="a45-panel ${activeLens==='timeline'?'active':''}" data-a45-panel="timeline">
      <div class="a45-panel-head"><span class="a45-eyebrow">LENTE 03 · CRONOLOGÍA</span><h2>Cuándo ocurrió cada cosa, y qué coincidió con qué</h2><p>Se usan fechas/períodos explícitos de la evidencia. Una actualización técnica no se presenta como fecha del hecho.</p></div>
      <article class="a45-card"><h3>Cronología multi-fuente</h3>${timelineChart(pkg,extra)}</article>
    </section>`;
  }

  function relationships(pkg,extra){
    const raw=arr(pkg.e?.profile?.relaciones||pkg.e?.profile?.relationships);
    const out=[];
    raw.forEach((r,i)=>{
      if(typeof r==='string'){out.push({id:'r'+i,target:r,type:'RELACIÓN',source:'Fusion',confidence:null,assertion:'DERIVED'});return;}
      const target=r?.target_name||r?.related_entity_name||r?.entity_name||r?.target_label||r?.name||r?.target_entity_id||r?.target_id;
      if(!target)return;
      out.push({id:'r'+i,target,type:r.relationship_type||r.relation_type||r.type||'RELACIÓN',source:r.producer_id||r.source||r.radar_id||'Fusion',confidence:num(r.confidence),assertion:r.assertion_type||r.assertion||r.status||'DERIVED',detail:r.detail||r.note||r.attribute||''});
    });
    (extra?.spend?.top||[]).slice(0,6).forEach((o,i)=>out.push({id:'sp'+i,target:o.name||o.id,type:'PAGO_PÚBLICO',source:'RADAR_PRESUPUESTO_ABIERTO',confidence:1,assertion:'ASSERTED',detail:money(o.amount),amount:o.amount}));
    return out.slice(0,18);
  }
  function networkSvg(pkg,extra){
    const rel=relationships(pkg,extra);
    if(!rel.length)return`<div class="a45-gap"><b>Red no materializada</b><p>No hay relaciones gobernadas suficientes para dibujar un grafo. ATLAS no crea vínculos por similitud de nombre ni propaga riesgo desde vecinos.</p></div>`;
    const W=780,H=430,cx=W/2,cy=H/2,R=160;
    return `<div class="a45-network"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Red de exposición">
      ${rel.map((r,i)=>{const a=2*Math.PI*i/rel.length-Math.PI/2,x=cx+R*Math.cos(a),y=cy+R*Math.sin(a),derived=!/ASSERT|REGISTR|EXACT/i.test(r.assertion)||((r.confidence??1)<.9);return`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="${derived?'derived':'asserted'}"><title>${esc(r.type+' · '+r.source+' · confianza '+(r.confidence??'—'))}</title></line>`;}).join('')}
      <circle cx="${cx}" cy="${cy}" r="34" class="focal"/><text x="${cx}" y="${cy+4}" text-anchor="middle" class="focal-text">FOCO</text>
      ${rel.map((r,i)=>{const a=2*Math.PI*i/rel.length-Math.PI/2,x=cx+R*Math.cos(a),y=cy+R*Math.sin(a);return`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="18" class="node"/><text x="${x.toFixed(1)}" y="${(y+34).toFixed(1)}" text-anchor="middle" class="node-label">${esc(short(r.target,24))}</text>`;}).join('')}
    </svg></div><p class="a45-note">Trazo continuo = relación registral/asertada; discontinuo = derivada/candidata. El vínculo vale lo que vale su eslabón más débil y nunca transfiere un score.</p>`;
  }
  function networkPanel(pkg,extra){
    const rel=relationships(pkg,extra);
    return `<section class="a45-panel ${activeLens==='network'?'active':''}" data-a45-panel="network">
      <div class="a45-panel-head"><span class="a45-eyebrow">LENTE 04 · RED DE EXPOSICIÓN</span><h2>Con quién se conecta, por qué vía y con qué evidencia</h2><p>La red visualiza relaciones observadas. No transforma cercanía, domicilio compartido ni contraparte pública en riesgo heredado.</p></div>
      <div class="a45-caution"><b>Una relación no transfiere riesgo.</b> Las rutas derivadas o candidatas se muestran discontinuas y deben confirmarse antes de sostener una conclusión.</div>
      <div class="a45-grid g21"><article class="a45-card"><h3>Grafo de exposición</h3>${networkSvg(pkg,extra)}</article><article class="a45-card"><h3>Vínculos observados</h3>${rel.length?`<div class="a45-stack">${rel.map(r=>`<div class="a45-relation"><b>${esc(r.target)}</b><span>${esc(r.type)} · ${esc(r.source)}</span><small>${esc(r.assertion)} · confianza ${r.confidence==null?'—':r.confidence.toFixed(2)} ${r.detail?'· '+short(r.detail,60):''}</small></div>`).join('')}</div>`:`<div class="a45-empty">Sin vínculos materializados.</div>`}</article></div>
    </section>`;
  }

  const TYPES=[
    {id:'struct',label:'Estructural'},
    {id:'economic',label:'Económica'},
    {id:'perimeter',label:'Perímetro'},
    {id:'public',label:'Contratación'},
    {id:'adverse',label:'Adversa'},
    {id:'context',label:'Contextual'}
  ];
  function findingType(f){
    const text=(String(f.finding_type||'')+' '+String(f.title||'')+' '+producerIds(f).join(' ')).toUpperCase();
    if(/UAF|OBLIG|REPORT|ROS|ROE|PERIM/.test(text))return'perimeter';
    if(/PRESUP|SPEND|GASTO|PROVEED|CONTRAT|PAYMENT/.test(text))return'public';
    if(/SANC|CGR|ADVERSE|INTEGR/.test(text))return'adverse';
    if(/DELICT|PRENSA|PRESS|TERRITOR|CONTEXT/.test(text))return'context';
    if(/SALES|VENTA|WORK|TRABAJ|ECON|BAND|DOTACION|DOTACIÓN/.test(text))return'economic';
    return'struct';
  }
  function findingRows(pkg){
    return (pkg.findings||[]).map((f,i)=>({f,i,type:findingType(f),sources:producerIds(f),evidence:evidenceIds(f),score:num(f.score_investigate)}));
  }
  function typeProfile(pkg){
    const rows=findingRows(pkg);
    return TYPES.map(t=>{
      const r=rows.filter(x=>x.type===t.id),ev=new Set(r.flatMap(x=>x.evidence)),src=new Set(r.flatMap(x=>x.sources));
      return{...t,count:r.length,evidence:ev.size||r.reduce((a,x)=>a+(num(x.f.evidence_count)||0),0),sources:src.size,score:r.map(x=>x.score).filter(x=>x!=null).reduce((a,b)=>Math.max(a,b),0)};
    });
  }
  function matrix(pkg){
    const rows=findingRows(pkg);
    const cols=['SII','UAF','SPEND','SAN','CGR','OSFL','DEL','PRESS'];
    const sourceMatch=(x,c)=>{
      const ids=x.sources.map(s=>s.toUpperCase());
      const pats={SII:['SII'],UAF:['UAF'],SPEND:['PRESUP','SPEND'],SAN:['SANC'],CGR:['CGR'],OSFL:['OSFL'],DEL:['DELICT'],PRESS:['PRENSA','PRESS']}[c];
      return ids.some(id=>pats.some(p=>id.includes(p)));
    };
    return{cols,rows:TYPES.map(t=>({t,vals:cols.map(c=>rows.filter(x=>x.type===t.id&&sourceMatch(x,c)).length)}))};
  }
  function counterEvidence(pkg){
    const out=[];
    for(const f of pkg.findings||[]){
      const p=f.payload||{};
      for(const key of ['counter_evidence','negative_evidence','mitigants','counter_indications','alternative_explanations']){
        for(const x of arr(p[key]))if(x)out.push(typeof x==='string'?x:(x.text||x.title||x.description||JSON.stringify(x)));
      }
    }
    return [...new Set(out.map(String))].slice(0,12);
  }
  function gaps(pkg,extra){
    const states=sourceStates(pkg,extra),out=[];
    states.filter(s=>s.state==='SIN DATO').forEach(s=>out.push(`${s.label}: sin dato materializado para esta entidad. La ausencia no equivale a ausencia del hecho.`));
    if(!relationships(pkg,extra).length)out.push('Red relacional: no hay relaciones gobernadas suficientes para análisis de exposición.');
    if(!pkg.e?.profile?.peer_context&&!pkg.e?.profile?.economic_peer_context)out.push('Benchmark de pares: percentiles/contexto comparativo no materializados en esta ficha.');
    if(!counterEvidence(pkg).length)out.push('Contra-indicios: el paquete actual no trae un campo explícito de evidencia mitigante; no se inventan explicaciones alternativas.');
    return out;
  }
  function signalsPanel(pkg,extra){
    const prof=typeProfile(pkg),mx=matrix(pkg),counters=counterEvidence(pkg),gapRows=gaps(pkg,extra);
    const max=Math.max(1,...prof.map(x=>x.evidence));
    return `<section class="a45-panel ${activeLens==='signals'?'active':''}" data-a45-panel="signals">
      <div class="a45-panel-head"><span class="a45-eyebrow">LENTE 05 · SEÑALES Y CONVERGENCIA</span><h2>Qué dice cada señal, cuánto se corrobora y qué la contradice</h2><p>Se separa intensidad de evidencia, repetición dentro de una fuente y corroboración entre productores independientes.</p></div>
      <div class="a45-grid g11"><article class="a45-card"><h3>Perfil por tipología</h3><div class="a45-profile">${prof.map(p=>`<div><span>${esc(p.label)}</span><progress max="${max}" value="${p.evidence}"></progress><b>${fmt(p.evidence)} ev.</b><small>${p.sources} fuente(s) · IPA máx. ${p.score?fmt(p.score,1):'—'}</small></div>`).join('')}</div><p class="a45-note">El eje compara cantidad de evidencia trazable por dimensión; no es un score de riesgo.</p></article>
      <article class="a45-card"><h3>Matriz tipología × fuente</h3><div class="a45-matrix"><div class="corner"></div>${mx.cols.map(c=>`<b>${esc(c)}</b>`).join('')}${mx.rows.map(row=>`<span>${esc(row.t.label)}</span>${row.vals.map(v=>`<i class="${v>=3?'hot':v?'warm':''}" title="${v} hallazgo(s)">${v||''}</i>`).join('')}`).join('')}</div><p class="a45-note">Una fila activa en varias columnas sugiere corroboración; muchos registros en una sola columna siguen siendo una sola fuente.</p></article></div>
      <article class="a45-card"><h3>Señales gobernadas</h3>${(pkg.findings||[]).length?`<div class="a45-signal-list">${(pkg.findings||[]).slice(0,60).map((f,i)=>`<button type="button" data-a45-finding="${i}"><i></i><div><code>${esc(f.finding_type||'SIGNAL')}</code><b>${esc(f.title||f.finding_type||'Hallazgo')}</b><p>${esc(short(f?.payload?.explanation||f?.payload?.summary||'Detalle disponible en evidencia.',160))}</p><small>${esc(producerIds(f).join(' · ')||'Fuente no declarada')} · ${fmt(f.evidence_count)} evidencia(s)</small></div><strong>${num(f.score_investigate)==null?'—':fmt(f.score_investigate,1)}</strong></button>`).join('')}</div>`:`<div class="a45-empty">Sin hallazgos materializados.</div>`}</article>
      <div class="a45-grid g11"><article class="a45-card"><h3>Contra-indicios</h3>${counters.length?`<div class="a45-stack">${counters.map(x=>`<div class="a45-counter"><b>−</b><p>${esc(x)}</p></div>`).join('')}</div>`:`<div class="a45-empty">No existe un campo explícito de contra-evidencia en el paquete actual. ATLAS no fabrica contrapesos.</div>`}</article><article class="a45-card"><h3>Vacíos declarados</h3><div class="a45-stack">${gapRows.map(x=>`<div class="a45-gap"><b>?</b><p>${esc(x)}</p></div>`).join('')}</div></article></div>
    </section>`;
  }

  function evidencePanel(pkg){
    const findings=pkg.findings||[],san=pkg.sanctions||[];
    return `<section class="a45-panel ${activeLens==='evidence'?'active':''}" data-a45-panel="evidence">
      <div class="a45-panel-head"><span class="a45-eyebrow">LENTE 06 · EVIDENCIA Y DECISIÓN</span><h2>Qué sostiene el expediente y qué decisión queda registrada</h2><p>La evidencia conserva productor, identificadores y trazabilidad disponible. La disposición analítica se registra en auditoría ATLAS y exige fundamento.</p></div>
      <div class="a45-grid g21"><article class="a45-card"><h3>Inventario de evidencia</h3>${findings.length?`<div class="a45-evidence-list">${findings.slice(0,80).map((f,i)=>`<button type="button" data-a45-finding="${i}"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(f.title||f.finding_type||'Hallazgo')}</b><small>${esc(producerIds(f).join(' · ')||'Fuente no declarada')} · ${evidenceIds(f).length||fmt(f.evidence_count)} referencia(s)</small></div><em>abrir</em></button>`).join('')}</div>`:`<div class="a45-empty">Sin hallazgos materializados.</div>`}${san.length?`<h4 class="a45-subhead">Eventos sancionatorios</h4><div class="a45-evidence-list">${san.slice(0,30).map((s,i)=>`<button type="button" data-a45-sanction="${i}"><span>S</span><div><b>${esc(s.regulator||'Supervisor')} · ${esc(s.event_date||'sin fecha')}</b><small>${esc(short(s.subject||'Evento administrativo',120))}</small></div><em>abrir</em></button>`).join('')}</div>`:''}</article>
      <article class="a45-card"><h3>Disposición del expediente</h3><div class="a45-decision" id="a45-decision"><button type="button" data-decision="ESCALAR_A_REPORTE"><b>Escalar a reporte</b><span>Derivar con paquete de evidencia.</span></button><button type="button" data-decision="MANTENER_VIGILANCIA" class="active"><b>Mantener en vigilancia</b><span>Revisar al aparecer evidencia nueva.</span></button><button type="button" data-decision="ARCHIVAR_CON_FUNDAMENTO"><b>Archivar con fundamento</b><span>Conservar traza y motivo.</span></button></div><label class="a45-label" for="a45-justification">Fundamento</label><textarea id="a45-justification" rows="5" placeholder="Explica qué evidencia sostiene la disposición y qué vacíos permanecen."></textarea><button type="button" class="a45-btn primary" id="a45-sign">Registrar disposición en auditoría ATLAS</button><p class="a45-sign-msg" id="a45-sign-msg"></p><div class="a45-caution compact"><b>Alcance.</b> Este control registra una disposición analítica/audit trail; no genera por sí mismo un ROS, una denuncia ni una decisión institucional.</div></article></div>
    </section>`;
  }

  function drawerShell(){
    return `<div class="a45-scrim" id="a45-scrim"></div><aside class="a45-drawer" id="a45-drawer" aria-hidden="true"><header><div><span class="a45-eyebrow">TRAZABILIDAD</span><h3 id="a45-drawer-title"></h3></div><button type="button" id="a45-drawer-close">×</button></header><div class="a45-drawer-body" id="a45-drawer-body"></div></aside>`;
  }
  function openDrawer(title,html){
    const d=document.querySelector('#a45-drawer'),s=document.querySelector('#a45-scrim');
    if(!d||!s)return;
    document.querySelector('#a45-drawer-title').textContent=title;
    document.querySelector('#a45-drawer-body').innerHTML=html;
    d.classList.add('open');s.classList.add('open');d.setAttribute('aria-hidden','false');
  }
  function closeDrawer(){
    document.querySelector('#a45-drawer')?.classList.remove('open');
    document.querySelector('#a45-scrim')?.classList.remove('open');
    document.querySelector('#a45-drawer')?.setAttribute('aria-hidden','true');
  }
  function sourceDrawer(pkg,extra,id){
    const s=sourceStates(pkg,extra).find(x=>x.id===id);if(!s)return;
    openDrawer(s.label,`<div class="a45-drawer-accent ${s.cls}"></div><dl class="a45-drawer-dl"><dt>Estado</dt><dd>${esc(s.state)}</dd><dt>Método</dt><dd>${esc(s.method||'—')}</dd><dt>Corte</dt><dd>${esc(s.asOf||'—')}</dd><dt>Lectura</dt><dd>${esc(s.detail||'—')}</dd></dl><div class="a45-caution compact">El estado de una fuente describe cobertura/resolución en este expediente. No es un indicador de riesgo.</div>`);
  }
  function findingDrawer(pkg,index){
    const f=(pkg.findings||[])[index];if(!f)return;
    const p=f.payload||{},ids=evidenceIds(f);
    openDrawer(f.title||f.finding_type||'Hallazgo',`<dl class="a45-drawer-dl"><dt>Tipo</dt><dd>${esc(f.finding_type||'—')}</dd><dt>Productores</dt><dd>${esc(producerIds(f).join(' · ')||'—')}</dd><dt>IPA investigar</dt><dd>${num(f.score_investigate)==null?'—':fmt(f.score_investigate,1)}</dd><dt>Evidencias</dt><dd>${esc(ids.join(' · ')||String(f.evidence_count||'—'))}</dd><dt>Snapshot</dt><dd>${esc(f.snapshot_id||'—')}</dd><dt>Actualizado</dt><dd>${esc(f.updated_at||'—')}</dd></dl><p class="a45-drawer-text">${esc(p.explanation||p.summary||p.why||'Sin explicación adicional materializada.')}</p>${p.checks||p.discards?`<div class="a45-caution compact"><b>Descartes / verificaciones:</b> ${esc(p.checks||p.discards)}</div>`:''}`);
  }
  function sanctionDrawer(pkg,index){
    const s=(pkg.sanctions||[])[index];if(!s)return;
    openDrawer(`${s.regulator||'Supervisor'} · ${s.event_date||'evento'}`,`<dl class="a45-drawer-dl"><dt>ID</dt><dd>${esc(s.sanction_id||'—')}</dd><dt>Entidad</dt><dd>${esc(s.entity_name||pkg.e?.name||'—')}</dd><dt>Identidad</dt><dd>${esc(s.identity_status||'—')}</dd><dt>LA/FT directo</dt><dd>${s.laft_direct?'Sí':'No / no materializado'}</dd><dt>Monto UF</dt><dd>${fmt(s.amount_uf)}</dd><dt>Snapshot</dt><dd>${esc(s.snapshot_id||'—')}</dd></dl><p class="a45-drawer-text">${esc(s.subject||'Sin materia adicional.')}</p><div class="a45-caution compact">Una sanción administrativa no acredita por sí sola lavado de activos, financiamiento del terrorismo ni delito.</div>`);
  }

  function bindDetail(pkg,extra){
    document.querySelector('#a45-back')?.addEventListener('click',()=>loadEntities());
    document.querySelector('#a45-export')?.addEventListener('click',async()=>{
      const pack={...((typeof V17_ENTITY_CACHE!=='undefined'&&V17_ENTITY_CACHE)||{}),entity360:{release:RELEASE,design:AUTHORITY,public_spend:extra?.spend||null,uaf_sii_reconciliation:extra?.recon||null,principles:{priority_is_probability:false,missing_is_zero:false,relationship_transfers_risk:false}}};
      try{await audit('EXPORT',{objectType:'entity_package',objectId:pkg.e.entity_id,payload:{format:'json',schema:'AML_ANALYST_TRANSFER_V1+ENTITY360_0445'}});}catch(_e){}
      if(typeof v17Download==='function')v17Download(`atlas_entity_${String(pkg.e.rut||pkg.e.entity_id).replace(/[^0-9A-Za-zKk-]/g,'_')}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(pack,null,2),'application/json;charset=utf-8');
    });
    document.querySelectorAll('[data-a45-lens]').forEach(b=>b.addEventListener('click',()=>{
      activeLens=b.dataset.a45Lens;
      document.querySelectorAll('[data-a45-lens]').forEach(x=>x.classList.toggle('active',x===b));
      document.querySelectorAll('[data-a45-panel]').forEach(x=>x.classList.toggle('active',x.dataset.a45Panel===activeLens));
      document.querySelector('.a45-cover')?.scrollIntoView({block:'start',behavior:'smooth'});
    }));
    document.querySelectorAll('[data-a45-source]').forEach(b=>b.addEventListener('click',()=>sourceDrawer(pkg,extra,b.dataset.a45Source)));
    document.querySelectorAll('[data-a45-finding]').forEach(b=>b.addEventListener('click',()=>findingDrawer(pkg,Number(b.dataset.a45Finding))));
    document.querySelectorAll('[data-a45-sanction]').forEach(b=>b.addEventListener('click',()=>sanctionDrawer(pkg,Number(b.dataset.a45Sanction))));
    document.querySelector('#a45-drawer-close')?.addEventListener('click',closeDrawer);
    document.querySelector('#a45-scrim')?.addEventListener('click',closeDrawer);
    let decision='MANTENER_VIGILANCIA';
    document.querySelectorAll('#a45-decision [data-decision]').forEach(b=>b.addEventListener('click',()=>{
      decision=b.dataset.decision;document.querySelectorAll('#a45-decision [data-decision]').forEach(x=>x.classList.toggle('active',x===b));
    }));
    document.querySelector('#a45-sign')?.addEventListener('click',async()=>{
      const text=document.querySelector('#a45-justification')?.value?.trim()||'',msg=document.querySelector('#a45-sign-msg');
      if(text.length<12){if(msg){msg.textContent='El fundamento debe explicar la decisión (mínimo 12 caracteres).';msg.className='a45-sign-msg error';}return;}
      try{
        await audit('ENTITY_DISPOSITION',{objectType:'entity',objectId:pkg.e.entity_id,payload:{disposition:decision,justification:text,entity360_release:RELEASE}});
        if(msg){msg.textContent='Disposición registrada en la auditoría ATLAS.';msg.className='a45-sign-msg ok';}
      }catch(e){if(msg){msg.textContent='No fue posible registrar la disposición: '+String(e?.message||e);msg.className='a45-sign-msg error';}}
    });
  }

  function renderEntity(pkg,preserve=false){
    if(!pkg?.e)return;
    if(!preserve)activeLens='identity';
    const extra=extraFor(pkg),c=content();if(!c)return;
    c.innerHTML=`<div class="a45">${hero(pkg,extra)}${lensNav()}<main>${identityPanel(pkg,extra)}${characterPanel(pkg,extra)}${timelinePanel(pkg,extra)}${networkPanel(pkg,extra)}${signalsPanel(pkg,extra)}${evidencePanel(pkg)}</main><footer class="a45-footer">Entidad 360 organiza hechos materializados y trazables. Prioridad no es probabilidad; ausencia de dato no equivale a cero; una relación no transfiere riesgo; el screening UAF no sustituye la condición jurídica.</footer>${drawerShell()}</div>`;
    bindDetail(pkg,extra);
    if(!EXTRAS.has(pkg.e.entity_id)&&!INFLIGHT.has(pkg.e.entity_id))void hydrateExtras(pkg);
    window.__ATLAS_ENTITY360_CURRENT__={release:RELEASE,build:BUILD,authority:AUTHORITY,entityId:pkg.e.entity_id,lenses:LENSES.map(x=>x[0]),extrasHydrated:!extra.hydrating,renderedAt:new Date().toISOString()};
  }

  function landingCard(r){
    const tags=[r.is_uaf_observed?'UAF observado':null,r.is_sanctioned?'Con sanciones':null].filter(Boolean);
    return `<button type="button" class="a45-land-card" data-a45-entity="${esc(r.entity_id)}"><div><h4>${esc(r.name||r.entity_id)}</h4><p>${esc(r.rut||'RUT no materializado')} · ${esc([r.commune,r.region].filter(Boolean).join(' · ')||'sin territorio')}</p><div>${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div><aside><b>${fmt(r.source_count)}</b><small>fuentes</small></aside></button>`;
  }
  async function plannedCount(filter){
    let q=sb.from('aml_entities').select('entity_id',{count:'planned',head:true});if(filter)q=filter(q);
    const {count,error}=await q;if(error)throw error;return count;
  }
  async function landingStats(){
    const sum=document.querySelector('#a45-land-stats'),featured=document.querySelector('#a45-featured');if(!sum||typeof sb==='undefined')return;
    try{
      const topRes=await sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned').order('source_count',{ascending:false}).limit(12);
      if(topRes.error)throw topRes.error;
      const counts=[];
      for(const f of [null,q=>q.eq('is_uaf_observed',true),q=>q.eq('is_sanctioned',true),q=>q.gte('source_count',3)]){try{counts.push(await plannedCount(f));}catch(_e){counts.push(null);}}
      const labels=[['Entidades Fusion',counts[0],'cobertura estimada bajo RLS'],['UAF observado',counts[1],'presencia materializada'],['Con sanciones',counts[2],'eventos administrativos'],['3+ fuentes',counts[3],'cobertura, no riesgo']];
      sum.innerHTML=labels.map(([l,v,s])=>`<div><span>${l}</span><b>${fmt(v)}</b><small>${s}</small></div>`).join('');
      featured.innerHTML=(topRes.data||[]).length?`<div class="a45-land-grid">${topRes.data.map(landingCard).join('')}</div>`:`<div class="a45-empty">Sin entidades destacadas bajo la política actual.</div>`;
      bindLandingCards(featured);
    }catch(e){sum.innerHTML=`<div><span>Cobertura</span><b>—</b><small>Indicadores temporalmente no disponibles.</small></div>`;featured.innerHTML=`<div class="a45-empty">${esc(e?.message||e)}</div>`;}
  }
  function bindLandingCards(root=document){root.querySelectorAll('[data-a45-entity]').forEach(b=>b.addEventListener('click',()=>openEntityCurrent(b.dataset.a45Entity)));}
  async function searchCurrent(ev){
    ev?.preventDefault?.();
    const input=document.querySelector('#entity-q'),box=document.querySelector('#entity-results');if(!input||!box)return;
    const q=clean(input.value);if(q.length<2){box.innerHTML='<div class="a45-empty">Ingresa al menos 2 caracteres.</div>';return;}
    box.innerHTML='<div class="a45-loading">Resolviendo identidad bajo RLS…</div>';
    try{
      if(typeof sha256==='function'&&typeof audit==='function'){const h=await sha256(q.toLocaleLowerCase('es-CL'));await audit('SEARCH',{objectType:'entity',queryHash:h,queryLength:q.length,payload:{mode:'entity360_0445'}}).catch(()=>{});}
      let query=sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,snapshot_id,updated_at');
      if(/^ENT-/i.test(q))query=query.eq('entity_id',q.toUpperCase());
      else if(/^[0-9kK.\-\s]+$/.test(q))query=query.ilike('rut',`%${q.replace(/[.\s]/g,'')}%`);
      else query=query.ilike('name',`%${q}%`);
      const {data,error}=await query.order('source_count',{ascending:false}).limit(50);if(error)throw error;
      box.innerHTML=(data||[]).length?`<div class="a45-result-count">${fmt(data.length)} coincidencia(s) · identidad primero</div><div class="a45-land-grid">${data.map(landingCard).join('')}</div>`:'<div class="a45-empty">Sin coincidencias. Prueba con razón social más corta, RUT o Entity ID.</div>';
      bindLandingCards(box);
    }catch(e){box.innerHTML=`<div class="a45-empty"><b>No fue posible ejecutar la búsqueda.</b><br>${esc(e?.message||e)}</div>`;}
  }
  function loadEntitiesCurrent(){
    state.view='entities';
    shell('Entidades','Expediente Analítico 360 · identidad, caracterización, cronología, red, convergencia y evidencia.');
    const c=content();if(!c)return;
    c.innerHTML=`<div class="a45 a45-landing"><section class="a45-land-hero"><div><span class="a45-eyebrow">ENTIDAD 360 · EXPEDIENTE ANALÍTICO</span><h2>Caracteriza primero. Interpreta después.</h2><p>ATLAS resuelve identidad y reúne situación tributaria, condición UAF cuando corresponde, gasto del Estado, sanciones/CGR, relaciones, cronología y evidencia en seis lentes. Los vacíos quedan explícitos.</p></div><div class="a45-lens-preview">${LENSES.map(([id,n,t])=>`<span><b>${n}</b>${esc(t)}</span>`).join('')}</div></section>
      <section class="a45-land-search"><form id="entity-search"><input id="entity-q" autocomplete="off" placeholder="Razón social, RUT o Entity ID…"><button type="submit">Abrir expediente</button></form><small>RLS activo · máximo 50 resultados · la búsqueda se audita sin guardar texto plano.</small></section>
      <div class="a45-land-stats" id="a45-land-stats"><div><span>Cobertura</span><b>…</b><small>cargando</small></div></div>
      <section class="a45-card a45-land-section"><header><div><span class="a45-eyebrow">EXPLORACIÓN RÁPIDA</span><h3>Entidades con mayor cobertura observable</h3><p>Sirven como accesos de análisis. Cantidad de fuentes no equivale a riesgo.</p></div></header><div id="a45-featured"><div class="a45-loading">Cargando identidades…</div></div></section>
      <section class="a45-card a45-land-section"><header><div><span class="a45-eyebrow">RESULTADOS</span><h3>Búsqueda de entidad</h3><p>Al abrir una entidad se cargan los seis lentes del expediente con datos reales disponibles.</p></div></header><div id="entity-results" class="a45-empty">Busca una entidad para abrir su Expediente Analítico 360.</div></section>
      <div class="a45-principles"><div><b>Identidad ≠ similitud</b><span>RUT/Entity ID gobiernan cruces sensibles.</span></div><div><b>Ausencia ≠ cero</b><span>Los vacíos se declaran.</span></div><div><b>Prioridad ≠ probabilidad</b><span>Ordena revisión, no acusa.</span></div><div><b>Relación ≠ transferencia</b><span>La red no hereda riesgo.</span></div></div></div>`;
    document.querySelector('#entity-search')?.addEventListener('submit',searchCurrent);
    void landingStats();
    window.__ATLAS_ENTITY360_CURRENT__={release:RELEASE,build:BUILD,authority:AUTHORITY,mode:'landing',lenses:LENSES.map(x=>x[0]),renderedAt:new Date().toISOString()};
  }
  async function openEntityCurrent(entityId){
    if(!entityId||!BASE_OPEN)return;
    return BASE_OPEN(entityId);
  }

  /* Final production renderer replaces the simplified 0.38 detail while keeping
     the governed v0.20.3 data loader and RLS authorization path. */
  if(typeof v0203RenderEntity==='function'){
    v0203RenderEntity=renderEntity;
    window.v0203RenderEntity=renderEntity;
  }
  try{loadEntities=loadEntitiesCurrent;}catch(_e){}
  try{searchEntities=searchCurrent;}catch(_e){}
  window.loadEntities=loadEntitiesCurrent;
  window.searchEntities=searchCurrent;
  window.openEntity=openEntityCurrent;
  window.__ATLAS_ENTITY_ENTRY__={
    version:'0445',
    release:RELEASE,
    authority:AUTHORITY,
    load:loadEntitiesCurrent,
    search:searchCurrent,
    open:openEntityCurrent,
    lenses:LENSES.map(x=>x[0]),
    countPolicy:'PLANNED_LANDING_ONLY_NO_EXACT_BOOT_COUNTS'
  };
  window.__ATLAS_ENTITY360_CURRENT__={release:RELEASE,build:BUILD,authority:AUTHORITY,mode:'installed',lenses:LENSES.map(x=>x[0]),installedAt:new Date().toISOString()};
})();
