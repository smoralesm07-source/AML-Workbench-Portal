'use strict';
/* ATLAS AML · Empresas (RES) · analyst upgrade 0.97.4 */
(function atlasResAnalysisUpgrade0974(){
  if(window.__ATLAS_RES_ANALYSIS_UPGRADE_0974__) return;
  window.__ATLAS_RES_ANALYSIS_UPGRADE_0974__=true;

  const VERSION='0.97.4';
  const START='2026-01-01',END='2026-07-31';
  const MONTHS=[['01','ENE'],['02','FEB'],['03','MAR'],['04','ABR'],['05','MAY'],['06','JUN'],['07','JUL']];
  const REGIONS={1:'Tarapacá',2:'Antofagasta',3:'Atacama',4:'Coquimbo',5:'Valparaíso',6:'O’Higgins',7:'Maule',8:'Biobío',9:'La Araucanía',10:'Los Lagos',11:'Aysén',12:'Magallanes',13:'Metropolitana',14:'Los Ríos',15:'Arica y Parinacota',16:'Ñuble'};
  const source=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const money=v=>v==null?'—':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v));
  const regionName=v=>REGIONS[Number(v)]||`Región ${v}`;

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
    if(!target){
      q.value='';
      q.dispatchEvent(new Event('input',{bubbles:true}));
      target=findExact();
    }
    if(!target)target=[...box.querySelectorAll(`[data-kind="${kind}"]`)][0]||null;
    if(!target)return false;

    root.querySelectorAll('[data-res974-kind].active').forEach(x=>x.classList.remove('active'));
    control?.classList.add('active');
    target.click();
    const card=root.querySelector('.res970-evidence-card');
    if(card){
      card.classList.remove('res974-evidence-pulse');
      requestAnimationFrame(()=>card.classList.add('res974-evidence-pulse'));
      setTimeout(()=>card.scrollIntoView?.({behavior:'smooth',block:'start'}),60);
    }
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
    const specs=[
      ['cluster','0',d.clusters?.[0]?.[0]||''],
      ['anomaly','0',regionName(d.anomalies?.[0]?.[0]||'')],
      ['date','c0',d.communeDays?.[0]?.[1]||''],
      ['commune','0',d.communeGrowth?.[0]?.[0]||'']
    ];
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

  async function loadEconomyEvidence(card){
    const st=card?.__res971;
    const act=st?.model?.activities?.find(a=>a.code===st.selected);
    const box=card?.querySelector('[data-res971-evidence]');
    if(!act||!box)return;
    const token=(st.__res974Seq=(st.__res974Seq||0)+1);
    box.hidden=false;
    box.innerHTML=`<div class="res971-evidence-loading">Individualizando sociedades 2026 con actividad ${esc(act.code)}…</div>`;
    const client=db();
    if(!client){box.innerHTML='<div class="res971-evidence-loading">Cliente de datos no disponible.</div>';return;}
    try{
      const res=await client.from('aml_res_activity_company').select('rut,legal_name,constitution_date,registry_date,sii_approval_date,company_code,capital,social_commune,social_region,tax_commune,tax_region',{count:'exact'}).eq('activity_code',act.code).gte('constitution_date',START).lte('constitution_date',END).order('constitution_date',{ascending:false}).limit(80);
      if(token!==st.__res974Seq)return;
      if(res?.error)throw res.error;
      const rows=Array.isArray(res?.data)?res.data:[];
      box.__res974Rows=rows;
      box.innerHTML=`<header><div><b>${esc(act.code)} · ${esc(act.name)}</b><small>Cruce directo RES ↔ SII</small></div><span><strong>${num(res?.count??rows.length)}</strong> sociedades 2026${(res?.count??rows.length)>rows.length?` · mostrando ${num(rows.length)}`:''}</span></header>${rows.length?`<div class="res971-evidence-head"><span>Sociedad</span><span>Constitución</span><span>Tipo</span><span>Capital</span><span>Comuna</span></div><div class="res971-evidence-list">${rows.map((r,i)=>`<button type="button" class="res971-evidence-row res974-evidence-row" data-res974-econ-company="${i}"><span><b>${esc(r.legal_name||'Sin razón social')}</b><small>${esc(r.rut||'—')}</small></span><time>${esc(String(r.constitution_date||'').slice(0,10))}</time><em>${esc(r.company_code||'—')}</em><strong>${money(r.capital)}</strong><span>${esc(r.social_commune||'—')}</span></button>`).join('')}</div>`:'<div class="res971-evidence-loading">No hay sociedades RES 2026 para esta actividad dentro de la cobertura SII materializada.</div>'}`;
      box.scrollIntoView?.({behavior:'smooth',block:'nearest'});
    }catch(err){
      if(token!==st.__res974Seq)return;
      box.innerHTML=`<div class="res971-evidence-loading">No fue posible individualizar sociedades: ${esc(err?.message||err)}</div>`;
    }
  }

  async function openEconomyCompany(row){
    if(!row)return;
    let drawer=document.querySelector('#res974-econ-drawer');
    if(!drawer){drawer=document.createElement('aside');drawer.id='res974-econ-drawer';drawer.className='res974-econ-drawer';document.body.appendChild(drawer);}
    drawer.classList.add('open');
    drawer.innerHTML=`<button type="button" class="res974-drawer-close" data-res974-drawer-close>×</button><span class="res974-drawer-eyebrow">SOCIEDAD RES · ACTIVIDAD SII</span><h3>${esc(row.legal_name||'Sociedad')}</h3><p>${esc(row.rut||'—')}</p><div class="res974-drawer-kpis"><div><span>Constitución</span><b>${esc(String(row.constitution_date||'').slice(0,10)||'—')}</b></div><div><span>Tipo</span><b>${esc(row.company_code||'—')}</b></div><div><span>Capital</span><b>${money(row.capital)}</b></div></div><dl><dt>Comuna social</dt><dd>${esc(row.social_commune||'—')}</dd><dt>Región social</dt><dd>${esc(regionName(row.social_region))}</dd><dt>Comuna tributaria</dt><dd>${esc(row.tax_commune||'—')}</dd><dt>Registro RES</dt><dd>${esc(String(row.registry_date||'').slice(0,10)||'—')}</dd></dl><section class="res974-drawer-enrichment"><div class="res971-evidence-loading">Cargando contexto SII…</div></section>`;
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
      box.innerHTML=`<header><b>Contexto tributario</b><span>SII · enriquecimiento externo</span></header><dl><dt>Inicio actividades</dt><dd>${esc(reg?.data?.activity_start_date||'—')}</dd><dt>Estado</dt><dd>${esc(reg?.data?.current_status||'—')}</dd><dt>Término de giro</dt><dd>${esc(reg?.data?.termination_date||'—')}</dd><dt>Sector</dt><dd>${esc(latest?.data?.economic_sector||'—')}</dd><dt>Actividad principal</dt><dd>${esc(latest?.data?.main_activity||ar[0]?.activity_name||'—')}</dd><dt>Ventas</dt><dd>${esc(latest?.data?.sales_band_code||'—')}</dd><dt>Trabajadores</dt><dd>${latest?.data?.workers_numeric==null?'—':num(latest.data.workers_numeric)}</dd></dl>${ar.length?`<div class="res974-drawer-acts">${ar.map(a=>`<span><code>${esc(a.activity_code)}</code>${esc(a.activity_name)}</span>`).join('')}</div>`:''}`;
    }catch(err){if(box)box.innerHTML=`<p>No fue posible cargar contexto SII: ${esc(err?.message||err)}</p>`;}
  }

  function handleClick(e){
    const econOpen=e.target?.closest?.('[data-res971-open]');
    if(econOpen){
      const card=econOpen.closest('.res971-economy');
      if(card){e.preventDefault();e.stopPropagation();loadEconomyEvidence(card);return;}
    }
    const econRow=e.target?.closest?.('[data-res974-econ-company]');
    if(econRow){
      const box=econRow.closest('[data-res971-evidence]');
      const row=box?.__res974Rows?.[Number(econRow.dataset.res974EconCompany)];
      if(row){e.preventDefault();e.stopPropagation();openEconomyCompany(row);}return;
    }
    const control=e.target?.closest?.('[data-res974-kind]');
    if(control){
      const root=control.closest('[data-res952-root]');
      if(root){e.preventDefault();e.stopPropagation();exactFinding(root,control.dataset.res974Kind,control.dataset.res974Key,control.dataset.res974Term||'',control);}return;
    }
  }

  function handleKey(e){
    if(!['Enter',' '].includes(e.key))return;
    const control=e.target?.closest?.('[data-res974-kind]');
    if(!control)return;
    e.preventDefault();control.click();
  }

  document.addEventListener('click',handleClick,true);
  document.addEventListener('keydown',handleKey,true);

  let timers=[];
  function apply(){
    timers.forEach(clearTimeout);
    timers=[0,80,220,600,1200,2200].map(ms=>setTimeout(upgradePhenomena,ms));
  }
  apply();
  document.addEventListener('atlas:routechange',apply);
  document.addEventListener('atlas:nav-refresh',apply);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-res952-route="phenomena"]'))setTimeout(apply,0);},true);

  window.__ATLAS_RES_ANALYSIS_UPGRADE__={version:VERSION,status:'ready',phenomena:'four-complementary-views',findingDrilldown:'exact-key',economyDrilldown:'secure-res-sii-view',checkedAt:new Date().toISOString()};
})();
