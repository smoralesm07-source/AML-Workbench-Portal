'use strict';
/* ATLAS AML · Gasto Público GP12 · capa de interacción vinculada
 * Añade selección persistente, cross-filtering, contexto analítico y detalle
 * a las superficies GP11 sin alterar la autoridad de datos ni sus reglas.
 */
(function atlasGastoPublicoInteractions1200(){
  if(window.__ATLAS_GP_INTERACTIONS_1200__)return;
  window.__ATLAS_GP_INTERACTIONS_1200__=true;

  const VERSION='GP12.0-linked';
  const SRC={
    findings:'aml_mv_gp10_finding', scatter:'aml_v_gp10_scatter',
    region:'aml_v_gp10_region', buyers:'aml_mv_gp10_buyer_risk', lorenz:'aml_v_gp10_lorenz'
  };
  const CODE_LABEL={
    EMPRESA_RECIENTE_MONTO_ALTO:'Empresa reciente · monto alto',
    CAPITAL_DESPROPORCIONADO:'Capital desproporcionado',
    CAPTURA_COMPRADOR:'Proveedor concentra un servicio',
    POSIBLE_FRACCIONAMIENTO:'Posible fraccionamiento',
    CONCENTRACION_PROVEEDOR:'Servicio concentrado',
    DEPENDENCIA_COMPRADOR_UNICO:'Proveedor cautivo',
    SANCION_OBSERVADA:'Sanción observada', UAF_OBSERVADO:'Sujeto obligado UAF',
    LOBBY_OBSERVADO:'Lobby observado'
  };
  const FAMILIES={
    concentracion:['CAPTURA_COMPRADOR','CONCENTRACION_PROVEEDOR','CONCENTRACION_RELEVANTE','MERCADO_CONCENTRADO'],
    reciente:['EMPRESA_RECIENTE_MONTO_ALTO','EMPRESA_NUEVA','CAPITAL_DESPROPORCIONADO'],
    fraccionamiento:['POSIBLE_FRACCIONAMIENTO','MONTO_ATIPICO'],
    dependencia:['DEPENDENCIA_COMPRADOR_UNICO','COMPRADOR_UNICO']
  };
  const FAMILY_LABEL={concentracion:'Concentración',reciente:'Empresa reciente / capital',fraccionamiento:'Fraccionamiento / atípico',dependencia:'Dependencia'};
  const NF=new Intl.NumberFormat('es-CL');
  const D={findings:[],scatter:[],regions:[],buyers:[],lorenz:[],loaded:false,loading:false,error:null};
  const F={region:null,signal:null,family:null,severity:null,riskBand:null,supplierKey:null,supplierName:null,buyerName:null,heatMetric:null};
  const roots=new WeakSet();
  let observer=null;

  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const money=v=>{const n=num(v),a=Math.abs(n);if(a>=1e12)return '$'+(n/1e12).toLocaleString('es-CL',{maximumFractionDigits:2})+' bill.';if(a>=1e9)return '$'+(n/1e9).toLocaleString('es-CL',{maximumFractionDigits:1})+' mil M';if(a>=1e6)return '$'+(n/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+' M';return '$'+NF.format(Math.round(n));};
  const pct=v=>Number.isFinite(Number(v))?(100*Number(v)).toLocaleString('es-CL',{maximumFractionDigits:1})+'%':'—';
  const dec=(v,d=3)=>Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{maximumFractionDigits:d}):'—';
  const codeLabel=c=>CODE_LABEL[c]||String(c||'').replaceAll('_',' ');
  const shortRegion=r=>String(r||'').replace(/^Regi[oó]n\s+(de\s+|del\s+)?/i,'').trim()||'Sin región';
  const sameRegion=(a,b)=>{const x=norm(shortRegion(a)),y=norm(shortRegion(b));return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x));};
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};

  function publish(status,extra){
    window.__ATLAS_GP_INTERACTIONS__=Object.assign({status,version:VERSION,checkedAt:new Date().toISOString()},extra||{});
  }
  async function loadData(){
    if(D.loaded||D.loading)return;
    const c=db();
    if(!c){D.error='Sesión de datos ATLAS no disponible.';publish('degraded',{error:D.error});return;}
    D.loading=true;publish('loading');
    try{
      const [f,s,r,b,l]=await Promise.all([
        c.from(SRC.findings).select('*').order('severity_rank',{ascending:false}).order('amount_clp',{ascending:false}).limit(1200),
        c.from(SRC.scatter).select('*').order('total_clp',{ascending:false}).limit(3200),
        c.from(SRC.region).select('*'),
        c.from(SRC.buyers).select('*').order('total_clp',{ascending:false}).limit(800),
        c.from(SRC.lorenz).select('*').order('pct_suppliers',{ascending:true})
      ]);
      D.findings=f.error?[]:(f.data||[]);
      D.scatter=s.error?[]:(s.data||[]);
      D.regions=r.error?[]:(r.data||[]);
      D.buyers=b.error?[]:(b.data||[]);
      D.lorenz=l.error?[]:(l.data||[]);
      D.error=f.error?String(f.error.message||f.error):null;
      D.loaded=true;
      publish(D.error?'degraded':'ready',{findings:D.findings.length,scatter:D.scatter.length,regions:D.regions.length,buyers:D.buyers.length});
      document.querySelectorAll('.gp10').forEach(root=>{decorate(root);sync(root);});
    }catch(err){D.error=String(err?.message||err);publish('degraded',{error:D.error});}
    finally{D.loading=false;}
  }

  function active(){return Object.entries(F).some(([k,v])=>k!=='heatMetric'&&v);}
  function riskOk(v){const s=num(v);if(F.riskBand==='high')return s>=60;if(F.riskBand==='mid')return s>=20&&s<40;return true;}
  function familyOk(code){return !F.family||(FAMILIES[F.family]||[]).includes(code);}
  function findingOk(r){
    if(F.region&&!sameRegion(r.region,F.region))return false;
    if(F.signal&&r.finding_code!==F.signal)return false;
    if(!familyOk(r.finding_code))return false;
    if(F.severity&&norm(r.severity)!==norm(F.severity))return false;
    if(F.riskBand&&!riskOk(r.attention_score))return false;
    if(F.supplierName){const n=norm(F.supplierName);if(!norm(`${r.subject_name} ${r.counterpart_name}`).includes(n))return false;}
    if(F.buyerName){const n=norm(F.buyerName);if(!norm(`${r.subject_name} ${r.counterpart_name}`).includes(n))return false;}
    return true;
  }
  function scatterOk(r){
    if(F.region&&r.region&&!sameRegion(r.region,F.region))return false;
    if(F.signal&&r.lead_signal!==F.signal)return false;
    if(F.family&&!(FAMILIES[F.family]||[]).includes(r.lead_signal))return false;
    if(F.riskBand&&!riskOk(r.attention_score))return false;
    if(F.supplierKey&&String(r.supplier_key)!==String(F.supplierKey))return false;
    if(F.supplierName&&!norm(r.supplier_name).includes(norm(F.supplierName)))return false;
    return true;
  }
  function buyerOk(r){
    if(F.region&&!sameRegion(r.region,F.region))return false;
    if(F.buyerName&&!norm(r.buyer_name).includes(norm(F.buyerName)))return false;
    return true;
  }
  function filteredFindings(){return D.findings.filter(findingOk);}
  function filteredScatter(){return D.scatter.filter(scatterOk);}
  function filteredBuyers(){return D.buyers.filter(buyerOk);}

  function sectionByTitle(root,text){
    return [...root.querySelectorAll('.gp10-panel')].find(p=>norm(p.querySelector('h3')?.textContent).includes(norm(text)))||null;
  }
  function svgTitle(el,text){
    if(!el||!text)return;
    let t=[...el.children].find(x=>x.tagName&&x.tagName.toLowerCase()==='title');
    if(!t){t=document.createElementNS('http://www.w3.org/2000/svg','title');el.prepend(t);}t.textContent=text;
    el.setAttribute('aria-label',text);
  }
  function makeKeyboard(el){
    if(!el||el.dataset.gpxKeyboard)return;
    el.dataset.gpxKeyboard='1';el.setAttribute('tabindex','0');el.setAttribute('role','button');
    el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  }

  function decorateKpis(root){
    root.querySelectorAll('.gp10-kpi').forEach(k=>{
      const lb=norm(k.querySelector('span')?.textContent);
      let kind='';if(lb.includes('HALLAZGOS ALTA'))kind='severity';else if(lb.includes('RIESGO ALTO'))kind='risk-high';else if(lb.includes('ZONA CRITICA'))kind='risk-mid';else if(lb.includes('GASTO OBSERVADO')||lb.includes('PROVEEDORES'))kind='reset';
      if(!kind)return;k.dataset.gpxKpi=kind;k.classList.add('gpx-interactive');makeKeyboard(k);
    });
  }
  function decorateSignalBars(root){
    const p=sectionByTitle(root,'Hallazgos por tipo');if(!p)return;
    const reverse=new Map(Object.entries(CODE_LABEL).map(([k,v])=>[norm(v),k]));
    p.querySelectorAll('.gp10-lrow').forEach(row=>{
      const label=row.querySelector('.gp10-ln')?.textContent||'';
      let code=reverse.get(norm(label));
      if(!code){code=Object.keys(CODE_LABEL).find(k=>norm(codeLabel(k))===norm(label));}
      if(!code)return;
      row.dataset.gpxSignal=code;row.classList.add('gpx-interactive');makeKeyboard(row);
      row.setAttribute('aria-label',`Filtrar por ${label}`);
    });
  }
  function decorateScatter(root){
    const p=sectionByTitle(root,'Riesgo × materialidad');if(!p||!D.scatter.length)return;
    const circles=[...p.querySelectorAll('svg circle')];
    const rows=D.scatter.slice().sort((a,b)=>num(b.total_clp)-num(a.total_clp)).reverse();
    circles.slice(0,Math.min(rows.length,circles.length)).forEach((c,i)=>{
      const r=rows[i];c.dataset.gpxSupplierKey=String(r.supplier_key||'');c.dataset.gpxSupplierName=String(r.supplier_name||'');
      c.dataset.gpxSignal=String(r.lead_signal||'');c.dataset.gpxScore=String(num(r.attention_score));c.dataset.gpxAmount=String(num(r.total_clp));
      c.classList.add('gpx-mark');makeKeyboard(c);
      svgTitle(c,`${r.supplier_name||'Proveedor'} · atención ${num(r.attention_score)} · ${money(r.total_clp)} · ${codeLabel(r.lead_signal)}`);
    });
  }
  function decorateHeat(root){
    const p=sectionByTitle(root,'Dónde se concentra cada patrón');if(!p||!D.regions.length)return;
    const cols=[['concentrated_buyers','Concentración'],['recent_suppliers','Empresas recientes'],['frag_pairs','Fraccionamiento'],['hhi_avg','HHI'],['lobby_buyers','Lobby'],['attention_avg','Atención']];
    const rows=D.regions.slice().sort((a,b)=>num(b.total_clp)-num(a.total_clp)).slice(0,11);
    const rects=[...p.querySelectorAll('svg rect')];let i=0;
    rows.forEach(r=>cols.forEach(([key,label])=>{const el=rects[i++];if(!el)return;el.dataset.gpxHeatRegion=String(r.region||'');el.dataset.gpxHeatMetric=key;el.classList.add('gpx-mark');makeKeyboard(el);svgTitle(el,`${shortRegion(r.region)} · ${label}: ${key.includes('hhi')||key.includes('attention')?dec(r[key],3):NF.format(num(r[key]))}`);}));
  }
  function decorateTreemap(root){
    root.querySelectorAll('[data-gp10-region]').forEach(el=>{el.classList.add('gpx-mark');makeKeyboard(el);const r=D.regions.find(x=>sameRegion(x.region,el.dataset.gp10Region));if(r)svgTitle(el,`${shortRegion(r.region)} · ${money(r.total_clp)} · HHI ${dec(r.hhi_avg,3)} · ${NF.format(num(r.concentrated_buyers))} servicios concentrados`);});
    const p=sectionByTitle(root,'Concentración media por región');if(p){p.querySelectorAll('.gp10-lrow.reg').forEach(row=>{const lb=row.querySelector('.gp10-ln')?.textContent||'';const r=D.regions.find(x=>sameRegion(x.region,lb));if(!r)return;row.dataset.gpxRegion=r.region;row.classList.add('gpx-interactive');makeKeyboard(row);});}
  }
  function decorateBuyers(root){
    const p=sectionByTitle(root,'Concentración vs tamaño');if(!p||!D.buyers.length)return;
    const eligible=D.buyers.filter(b=>num(b.total_clp)>=1e8).sort((a,b)=>num(a.total_clp)-num(b.total_clp));
    const circles=[...p.querySelectorAll('svg circle')];
    circles.slice(0,Math.min(eligible.length,circles.length)).forEach((c,i)=>{const b=eligible[i];c.dataset.gpxBuyer=String(b.buyer_name||'');c.classList.add('gpx-mark');makeKeyboard(c);svgTitle(c,`${b.buyer_name||'Servicio'} · ${money(b.total_clp)} · HHI ${dec(b.hhi,3)} · principal ${pct(b.top_supplier_share)}`);});
  }
  function decorateLorenz(root){
    const p=sectionByTitle(root,'Concentración del gasto');if(!p||!D.lorenz.length)return;
    p.dataset.gpxLorenz='1';p.classList.add('gpx-click-panel');makeKeyboard(p);
    const first=D.lorenz[0];p.setAttribute('aria-label',first?`Concentración del gasto: ${first.pct_suppliers}% de proveedores capta ${dec(first.pct_spend,1)}%`:'Explorar concentración del gasto');
  }
  function decorate(root){
    if(!root)return;
    decorateKpis(root);decorateSignalBars(root);decorateScatter(root);decorateHeat(root);decorateTreemap(root);decorateBuyers(root);decorateLorenz(root);
  }

  function clearFilters(){Object.keys(F).forEach(k=>F[k]=null);}
  function setQuick(kind){
    if(kind==='clear'){clearFilters();return;}
    F.signal=null;F.supplierKey=null;F.supplierName=null;F.buyerName=null;
    if(kind==='alta'){F.severity=F.severity==='ALTA'?null:'ALTA';}
    else if(kind==='high'){F.riskBand=F.riskBand==='high'?null:'high';}
    else if(kind==='mid'){F.riskBand=F.riskBand==='mid'?null:'mid';}
    else if(FAMILIES[kind]){F.family=F.family===kind?null:kind;}
  }
  function filterLabel(){
    const out=[];
    if(F.region)out.push(['region',shortRegion(F.region)]);
    if(F.signal)out.push(['signal',codeLabel(F.signal)]);
    if(F.family)out.push(['family',FAMILY_LABEL[F.family]||F.family]);
    if(F.severity)out.push(['severity',`Severidad ${F.severity.toLowerCase()}`]);
    if(F.riskBand)out.push(['riskBand',F.riskBand==='high'?'Atención ≥60':'Atención 20–40']);
    if(F.supplierName)out.push(['supplier',F.supplierName]);
    if(F.buyerName)out.push(['buyer',F.buyerName]);
    return out;
  }
  function mode(rows,key){
    const m=new Map();rows.forEach(r=>{const v=r[key];if(v)m.set(v,(m.get(v)||0)+1);});return [...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  }
  function aggregateSubjects(rows){
    const m=new Map();rows.forEach(r=>{const n=String(r.subject_name||'Sin nombre'),k=norm(n);if(!m.has(k))m.set(k,{name:n,n:0,amount:0,max:0,id:r.finding_id});const x=m.get(k);x.n++;x.amount+=num(r.amount_clp);x.max=Math.max(x.max,num(r.amount_clp));if(num(r.amount_clp)>=x.max)x.id=r.finding_id;});return [...m.values()].sort((a,b)=>b.max-a.max||b.n-a.n);
  }
  function detailHtml(fRows,sRows,bRows){
    const top=aggregateSubjects(fRows).slice(0,5);
    const codes=new Map();fRows.forEach(r=>codes.set(r.finding_code,(codes.get(r.finding_code)||0)+1));
    const sigs=[...codes.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);const mx=Math.max(1,...sigs.map(x=>x[1]));
    let title='Panorama completo',copy='Selecciona un punto, barra, celda o región. La selección queda activa y se cruza con el resto de la vista.';
    let context='';
    if(F.region){const r=D.regions.find(x=>sameRegion(x.region,F.region));title=`Región ${shortRegion(F.region)}`;copy='Lectura territorial vinculada: gasto, concentración y patrones observados en la región.';if(r){const hh=D.regions.map(x=>num(x.hhi_avg)).sort((a,b)=>a-b),med=hh[Math.floor(hh.length/2)]||0;context=`<div class="gpx-contextfacts"><span><b>${money(r.total_clp)}</b><small>gasto observado</small></span><span><b>${dec(r.hhi_avg,3)}</b><small>HHI medio ${num(r.hhi_avg)>=med?'sobre':'bajo'} mediana</small></span><span><b>${NF.format(num(r.concentrated_buyers))}</b><small>servicios concentrados</small></span><span><b>${NF.format(num(r.frag_pairs))}</b><small>pares con señal de fraccionamiento</small></span></div>`;}}
    else if(F.supplierName){const r=D.scatter.find(x=>String(x.supplier_key)===String(F.supplierKey))||D.scatter.find(x=>norm(x.supplier_name)===norm(F.supplierName));title=F.supplierName;copy='Proveedor seleccionado desde la nube de riesgo × materialidad.';if(r)context=`<div class="gpx-contextfacts"><span><b>${money(r.total_clp)}</b><small>monto contratado</small></span><span><b>${NF.format(num(r.attention_score))}</b><small>índice de atención</small></span><span><b>${codeLabel(r.lead_signal)}</b><small>señal principal</small></span><span><b>${NF.format(num(r.buyer_count))}</b><small>compradores</small></span></div>`;}
    else if(F.buyerName){const r=D.buyers.find(x=>norm(x.buyer_name)===norm(F.buyerName));title=F.buyerName;copy='Servicio comprador seleccionado desde la estructura de mercado.';if(r)context=`<div class="gpx-contextfacts"><span><b>${money(r.total_clp)}</b><small>gasto observado</small></span><span><b>${dec(r.hhi,3)}</b><small>HHI</small></span><span><b>${pct(r.top_supplier_share)}</b><small>participación principal</small></span><span><b>${NF.format(num(r.supplier_count))}</b><small>proveedores</small></span></div>`;}
    else if(F.signal||F.family){title=F.signal?codeLabel(F.signal):(FAMILY_LABEL[F.family]||'Señal');copy='La selección actual cruza la composición de hallazgos con territorio, materialidad y cola de revisión.';}
    else if(F.severity||F.riskBand){title=F.severity?`Severidad ${F.severity.toLowerCase()}`:(F.riskBand==='high'?'Atención alta ≥60':'Banda crítica 20–40');copy='Filtro de priorización aplicado sobre casos y proveedores observados.';}
    return `<div class="gpx-detailcopy"><span class="gpx-eyebrow">Lectura de selección</span><h4>${esc(title)}</h4><p>${esc(copy)}</p>${context}</div>
      <div class="gpx-mini"><div class="gpx-minihead"><b>Señales dominantes</b><small>${NF.format(fRows.length)} hallazgos</small></div>${sigs.length?sigs.map(([k,n])=>`<button type="button" class="gpx-rank" data-gpx-signal="${esc(k)}"><span>${esc(codeLabel(k))}</span><progress max="${mx}" value="${n}"></progress><b>${NF.format(n)}</b></button>`).join(''):'<p class="gpx-none">Sin hallazgos para la selección.</p>'}</div>
      <div class="gpx-mini"><div class="gpx-minihead"><b>Entidades a revisar</b><small>máxima exposición asociada</small></div>${top.length?top.map(x=>`<button type="button" class="gpx-entity" data-gp10-case="${esc(x.id)}"><span><b>${esc(x.name)}</b><small>${NF.format(x.n)} señal(es)</small></span><strong>${esc(money(x.max))}</strong></button>`).join(''):'<p class="gpx-none">Sin entidades para la selección.</p>'}</div>`;
  }
  function panelHtml(){
    if(D.loading&&!D.loaded)return `<section class="gpx-linked" data-gpx-linked><div class="gpx-loading">Activando análisis vinculado…</div></section>`;
    if(D.error&&!D.loaded)return `<section class="gpx-linked" data-gpx-linked><div class="gpx-loading">La vista principal sigue operativa. El cruce interactivo no pudo cargar datos adicionales.</div></section>`;
    const fRows=filteredFindings(),sRows=filteredScatter(),bRows=filteredBuyers();
    const subjects=new Set(fRows.map(r=>norm(r.subject_name)).filter(Boolean));
    const maxScore=Math.max(0,...sRows.map(r=>num(r.attention_score)));
    const amount=sRows.reduce((a,r)=>a+num(r.total_clp),0);
    const domRegion=mode(fRows,'region');
    const chips=filterLabel();
    const quick=[['alta','Alta'],['concentracion','Concentración'],['reciente','Empresa reciente'],['fraccionamiento','Fraccionamiento'],['high','Atención ≥60'],['mid','Banda 20–40']];
    return `<section class="gpx-linked" data-gpx-linked>
      <div class="gpx-top"><div><span class="gpx-eyebrow">Análisis vinculado</span><h3>Explora y cruza el gasto sin perder contexto</h3><p>Haz clic en KPIs, puntos, barras, celdas o regiones. Cada selección actualiza el detalle y la cola de revisión.</p></div>
        <div class="gpx-quick" aria-label="Filtros rápidos">${quick.map(([k,l])=>`<button type="button" class="gpx-qbtn ${((F.family===k)||(k==='alta'&&F.severity==='ALTA')||(k==='high'&&F.riskBand==='high')||(k==='mid'&&F.riskBand==='mid'))?'on':''}" data-gpx-quick="${k}">${l}</button>`).join('')}<button type="button" class="gpx-qbtn clear" data-gpx-quick="clear" ${active()?'':'disabled'}>Limpiar</button></div></div>
      <div class="gpx-chips">${chips.length?chips.map(([k,l])=>`<button type="button" class="gpx-chip" data-gpx-remove="${k}" title="Quitar filtro">${esc(l)} <span>×</span></button>`).join(''):'<span class="gpx-emptychip">Sin filtros: universo completo</span>'}</div>
      <div class="gpx-metrics">
        <div class="gpx-metric"><span>Hallazgos</span><b>${NF.format(fRows.length)}</b><small>${subjects.size?NF.format(subjects.size)+' entidades':'sin entidades'}</small></div>
        <div class="gpx-metric"><span>Proveedores en nube</span><b>${NF.format(sRows.length)}</b><small>${money(amount)} observado</small></div>
        <div class="gpx-metric"><span>Atención máxima</span><b>${NF.format(maxScore)}</b><small>${maxScore>=60?'prioridad alta':maxScore>=20?'prioridad intermedia':'prioridad baja'}</small></div>
        <div class="gpx-metric"><span>Región dominante</span><b>${esc(domRegion?shortRegion(domRegion):'—')}</b><small>${bRows.length?NF.format(bRows.length)+' servicios en contexto':'sin selección territorial'}</small></div>
      </div>
      <div class="gpx-detailgrid">${detailHtml(fRows,sRows,bRows)}</div>
      <p class="gpx-caveat">Las señales orientan revisión analítica. La interacción no altera los datos fuente ni convierte una señal en una conclusión de irregularidad.</p>
    </section>`;
  }
  function ensurePanel(root){
    if(root.querySelector('[data-gpx-linked]'))return;
    const tabs=root.querySelector('.gp10-tabs');if(!tabs)return;
    tabs.insertAdjacentHTML('afterend',panelHtml());
  }
  function syncPanel(root){const old=root.querySelector('[data-gpx-linked]');if(old)old.outerHTML=panelHtml();else ensurePanel(root);}

  function markState(root){
    const fids=new Set(filteredFindings().map(r=>String(r.finding_id)));
    root.querySelectorAll('[data-gp10-case]').forEach(el=>{if(el.classList.contains('gpx-entity'))return;const id=String(el.dataset.gp10Case||'');if(id)el.hidden=active()&&!fids.has(id);});
    root.querySelectorAll('[data-gpx-signal]').forEach(el=>{const selected=F.signal===el.dataset.gpxSignal;el.classList.toggle('gpx-selected',selected);el.classList.toggle('gpx-dim',!!F.signal&&!selected);});
    root.querySelectorAll('[data-gp10-region],[data-gpx-region],[data-gpx-heat-region]').forEach(el=>{const rg=el.dataset.gp10Region||el.dataset.gpxRegion||el.dataset.gpxHeatRegion;const selected=F.region&&sameRegion(rg,F.region);el.classList.toggle('gpx-selected',!!selected);el.classList.toggle('gpx-dim',!!F.region&&!selected);});
    root.querySelectorAll('[data-gpx-supplier-key]').forEach(el=>{const selected=F.supplierKey&&String(el.dataset.gpxSupplierKey)===String(F.supplierKey);let ok=true;if(F.signal)ok=el.dataset.gpxSignal===F.signal;if(F.family)ok=(FAMILIES[F.family]||[]).includes(el.dataset.gpxSignal);if(F.riskBand)ok=ok&&riskOk(el.dataset.gpxScore);if(F.supplierKey)ok=ok&&selected;el.classList.toggle('gpx-selected',!!selected);el.classList.toggle('gpx-dim',active()&&!ok);});
    root.querySelectorAll('[data-gpx-buyer]').forEach(el=>{const selected=F.buyerName&&norm(el.dataset.gpxBuyer)===norm(F.buyerName);el.classList.toggle('gpx-selected',!!selected);el.classList.toggle('gpx-dim',!!F.buyerName&&!selected);});
    root.querySelectorAll('[data-gpx-kpi]').forEach(el=>{const k=el.dataset.gpxKpi,on=(k==='severity'&&F.severity==='ALTA')||(k==='risk-high'&&F.riskBand==='high')||(k==='risk-mid'&&F.riskBand==='mid');el.classList.toggle('gpx-selected',!!on);});
    const queue=sectionByTitle(root,'Casos priorizados')||sectionByTitle(root,'Severidad × materialidad');if(queue){const small=queue.querySelector('.gp10-ph small');if(small)small.textContent=`${NF.format(fids.size)} visibles`;} 
  }
  function sync(root){if(!root)return;ensurePanel(root);decorate(root);syncPanel(root);markState(root);}
  function syncAll(){document.querySelectorAll('.gp10').forEach(sync);}

  function removeFilter(k){
    if(k==='supplier'){F.supplierKey=null;F.supplierName=null;}
    else if(k==='buyer')F.buyerName=null;
    else if(k in F)F[k]=null;
  }
  function bindRoot(root){
    if(roots.has(root))return;roots.add(root);
    root.addEventListener('click',ev=>{
      const quick=ev.target.closest('[data-gpx-quick]');if(quick){setQuick(quick.dataset.gpxQuick);syncAll();return;}
      const remove=ev.target.closest('[data-gpx-remove]');if(remove){removeFilter(remove.dataset.gpxRemove);syncAll();return;}
      const kpi=ev.target.closest('[data-gpx-kpi]');if(kpi){const k=kpi.dataset.gpxKpi;if(k==='reset')clearFilters();else if(k==='severity')setQuick('alta');else if(k==='risk-high')setQuick('high');else if(k==='risk-mid')setQuick('mid');syncAll();return;}
      const supplier=ev.target.closest('[data-gpx-supplier-key]');if(supplier){F.supplierKey=F.supplierKey===supplier.dataset.gpxSupplierKey?null:supplier.dataset.gpxSupplierKey;F.supplierName=F.supplierKey?supplier.dataset.gpxSupplierName:null;F.buyerName=null;syncAll();return;}
      const buyer=ev.target.closest('[data-gpx-buyer]');if(buyer){F.buyerName=F.buyerName===buyer.dataset.gpxBuyer?null:buyer.dataset.gpxBuyer;F.supplierKey=null;F.supplierName=null;syncAll();return;}
      const signal=ev.target.closest('[data-gpx-signal]');if(signal){F.signal=F.signal===signal.dataset.gpxSignal?null:signal.dataset.gpxSignal;F.family=null;syncAll();return;}
      const heat=ev.target.closest('[data-gpx-heat-region]');if(heat){F.region=F.region&&sameRegion(F.region,heat.dataset.gpxHeatRegion)?null:heat.dataset.gpxHeatRegion;F.heatMetric=heat.dataset.gpxHeatMetric||null;syncAll();return;}
      const region=ev.target.closest('[data-gpx-region],[data-gp10-region]');if(region){const rg=region.dataset.gpxRegion||region.dataset.gp10Region;F.region=F.region&&sameRegion(F.region,rg)?null:rg;syncAll();return;}
      const lorenz=ev.target.closest('[data-gpx-lorenz]');if(lorenz&&D.lorenz.length){const p=D.lorenz[0];F.family=null;syncAll();const panel=root.querySelector('[data-gpx-linked]');const copy=panel?.querySelector('.gpx-detailcopy');if(copy&&p)copy.insertAdjacentHTML('beforeend',`<div class="gpx-lorenznote"><b>${esc(p.pct_suppliers)}% de proveedores</b> concentra <b>${esc(dec(p.pct_spend,1))}% del gasto acumulado</b> en el punto de referencia publicado.</div>`);}
    },true);
  }

  function enhanceRoot(root){
    if(!root)return;
    bindRoot(root);decorate(root);ensurePanel(root);sync(root);
  }
  function scan(){document.querySelectorAll('.gp10').forEach(enhanceRoot);}
  function start(){
    scan();loadData();
    if(!observer){observer=new MutationObserver(()=>{clearTimeout(start._t);start._t=setTimeout(scan,35);});observer.observe(document.body,{childList:true,subtree:true});}
    window.addEventListener('atlas:nav-refresh',()=>setTimeout(scan,0));
    window.addEventListener('atlas:runtime-ready',()=>setTimeout(scan,0));
    publish('installed');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();