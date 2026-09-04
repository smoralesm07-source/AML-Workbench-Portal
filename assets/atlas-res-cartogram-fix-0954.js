'use strict';
/* ATLAS AML · Empresas (RES) · cartogram + economy explorer 0.97.2 */
(function atlasResUtility0972(){
  if(window.__ATLAS_RES_CARTOGRAM_FIX_0954__) return;
  window.__ATLAS_RES_CARTOGRAM_FIX_0954__=true;

  const VERSION='0.97.2';
  const data=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const money=v=>v==null?'—':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v));
  const growth=(a,b)=>b?((Number(a)/Number(b)-1)*100):0;

  /* ---------------- CARTOGRAMA TERRITORIAL ---------------- */
  function regionPeak(d,code){
    let best=-Infinity;
    (d?.regionMonthly?.[code]||[]).forEach(r=>{
      const g=growth(r[1],r[2]);
      if(Number.isFinite(g)&&g>best)best=g;
    });
    return Number.isFinite(best)?best:0;
  }
  function metricValue(d,code,metric){
    const row=(d?.regions||[]).find(r=>Number(r[0])===Number(code));
    if(!row)return 0;
    if(metric==='growth')return growth(row[1],row[2]);
    if(metric==='burst')return regionPeak(d,Number(code));
    return Number(row[1]||0);
  }
  function normalize(values,metric){
    const transformed=values.map(v=>metric==='volume'?Math.log1p(Math.max(0,v)):Number(v||0));
    const min=Math.min(...transformed),max=Math.max(...transformed),span=Math.max(1e-9,max-min);
    return transformed.map(v=>{
      let n=(v-min)/span;
      if(metric!=='volume')n=Math.pow(Math.max(0,n),.72);
      return Math.max(0,Math.min(1,n));
    });
  }
  function applyCartogram(){
    const box=document.querySelector('#res952-chile');
    if(!box)return false;
    const nodes=[...box.querySelectorAll('.res952-region-node[data-res952-region]')];
    if(!nodes.length)return false;
    const d=data();
    if(!d)return false;
    const metric=document.querySelector('#res952-territory-metric')?.value||'volume';
    const values=nodes.map(n=>metricValue(d,Number(n.dataset.res952Region),metric));
    const levels=normalize(values,metric);
    nodes.forEach((node,i)=>{
      const bucket=Math.max(0,Math.min(8,Math.round(levels[i]*8)));
      node.dataset.res954Level=String(bucket);
      node.dataset.res954Value=String(values[i]);
      node.dataset.res954Metric=metric;
    });
    box.dataset.res954Scale=metric==='volume'?'logarithmic':'normalized';
    window.__ATLAS_RES_CARTOGRAM__={version:VERSION,status:'ready',metric,scale:box.dataset.res954Scale,render:'csp-safe-levels',observer:'none',checkedAt:new Date().toISOString()};
    return true;
  }
  function bindMetric(){
    const select=document.querySelector('#res952-territory-metric');
    if(!select||select.dataset.res954Bound==='1')return;
    select.dataset.res954Bound='1';
    select.addEventListener('change',()=>requestAnimationFrame(applyCartogram));
  }

  /* ---------------- EXPLORADOR ECONÓMICO ---------------- */
  const GROUP_RULES=[
    {id:'realestate',label:'Actividades inmobiliarias',test:(c,n)=>/^68/.test(c)||/inmobiliar/i.test(n)},
    {id:'jewelry',label:'Joyería y relojería',test:(c,n)=>c==='477394'||/joyer|bisuter|relojer/i.test(n)},
    {id:'vehicletrade',label:'Comercio de vehículos',test:(c,n)=>/^45/.test(c)||/compraventa.*veh|venta.*veh/i.test(n)},
    {id:'vehiclerental',label:'Alquiler de vehículos',test:(c,n)=>/^77/.test(c)&&/veh/i.test(n)},
    {id:'finance',label:'Servicios financieros auxiliares',test:(c,n)=>/^66/.test(c)||/fondos de inversión|cambio|divisa/i.test(n)},
    {id:'sports',label:'Deportes',test:(c,n)=>/^93/.test(c)||/fútbol|deport/i.test(n)},
    {id:'other',label:'Otros rubros',test:()=>true}
  ];

  function classifyActivity(code,name){return GROUP_RULES.find(g=>g.test(code,name))||GROUP_RULES.at(-1);}
  function economyModel(d){
    const activities=(d?.economy?.activities||[]).map(r=>({code:String(r[0]),name:String(r[1]||'Actividad sin nombre'),count:Number(r[2]||0)}));
    activities.forEach(a=>a.group=classifyActivity(a.code,a.name).id);
    const groups=GROUP_RULES.map(g=>({id:g.id,label:g.label,count:activities.filter(a=>a.group===g.id).reduce((s,a)=>s+a.count,0)})).filter(g=>g.count>0).sort((a,b)=>b.count-a.count);
    const total=activities.reduce((s,a)=>s+a.count,0);
    return {activities,groups,total};
  }
  function tileClass(share,index){
    if(index===0||share>=30)return 'res971-tile--xl';
    if(share>=20)return 'res971-tile--lg';
    if(share>=10)return 'res971-tile--md';
    return 'res971-tile--sm';
  }
  function barLevel(value,max){
    if(!max||value<=0)return 1;
    return Math.max(1,Math.min(10,Math.ceil((value/max)*10)));
  }

  function renderEconomy(card){
    const st=card.__res971;if(!st)return;
    const groupBox=card.querySelector('[data-res971-groups]');
    const tree=card.querySelector('[data-res971-tree]');
    const list=card.querySelector('[data-res971-list]');
    const selection=card.querySelector('[data-res971-selection]');
    const caption=card.querySelector('[data-res971-caption]');
    const groupLabel=st.group==='all'?'Todos los rubros':st.model.groups.find(g=>g.id===st.group)?.label||'Todos los rubros';

    if(groupBox){
      groupBox.innerHTML=`<button type="button" data-res971-group="all" class="${st.group==='all'?'active':''}">Todos</button>${st.model.groups.map(g=>`<button type="button" data-res971-group="${esc(g.id)}" class="${st.group===g.id?'active':''}">${esc(g.label)}</button>`).join('')}`;
    }
    if(tree){
      tree.innerHTML=st.model.groups.map((g,i)=>{
        const share=st.model.total?g.count/st.model.total*100:0;
        return `<button type="button" class="res971-tile ${tileClass(share,i)} ${st.group===g.id?'active':''}" data-res971-group="${esc(g.id)}" aria-pressed="${st.group===g.id?'true':'false'}"><b>${esc(g.label)}</b><strong>${num(g.count)}</strong><small>${pct(share)} de incidencias observadas</small></button>`;
      }).join('');
    }

    const term=st.search.trim().toLocaleLowerCase('es-CL');
    const rows=st.model.activities.filter(a=>(st.group==='all'||a.group===st.group)&&(!term||`${a.code} ${a.name}`.toLocaleLowerCase('es-CL').includes(term))).sort((a,b)=>b.count-a.count);
    if(!rows.some(a=>a.code===st.selected))st.selected=rows[0]?.code||'';
    const max=Math.max(...rows.map(a=>a.count),1);
    if(caption)caption.textContent=`${groupLabel} · ${rows.length} actividad${rows.length===1?'':'es'}`;
    if(list){
      list.innerHTML=rows.length?rows.map(a=>{
        const share=st.model.total?a.count/st.model.total*100:0;
        return `<button type="button" class="res971-activity-row ${st.selected===a.code?'active':''}" data-res971-activity="${esc(a.code)}" data-res971-bar="${barLevel(a.count,max)}" aria-pressed="${st.selected===a.code?'true':'false'}"><code>${esc(a.code)}</code><span>${esc(a.name)}</span><span class="res971-act-track" aria-hidden="true"><i></i></span><strong>${num(a.count)}<small>${pct(share)}</small></strong></button>`;
      }).join(''):'<div class="res971-evidence-loading">Sin actividades para este filtro.</div>';
    }

    const active=st.model.activities.find(a=>a.code===st.selected);
    if(selection){
      selection.innerHTML=active?`<span><b>${esc(active.code)} · ${esc(active.name)}</b><small>${esc(classifyActivity(active.code,active.name).label)} · ${num(active.count)} incidencias materializadas</small></span><button type="button" data-res971-open>Ver muestra de sociedades</button>`:'<span><b>Selecciona una actividad</b><small>El drill-down mostrará una muestra operativa de sociedades RES 2026 asociadas.</small></span>';
    }
  }

  function decorateEconomy(){
    const root=document.querySelector('[data-res952-root],.res952-root');
    if(root&&!root.classList.contains('res952-root'))root.classList.add('res952-root');
    const card=root?.querySelector('.res952-economic');
    const d=data();
    if(!card||!d?.economy||card.dataset.res971Economy==='1')return false;

    card.dataset.res971Economy='1';
    card.classList.add('res971-economy');
    const model=economyModel(d);
    const initial=[...model.activities].sort((a,b)=>b.count-a.count)[0]?.code||'';
    card.__res971={model,group:'all',search:'',selected:initial,seq:0};
    card.innerHTML=`<header class="res971-econ-head"><div><span>ENRIQUECIMIENTO EXTERNO</span><h3>Rubros de nuevas sociedades constituidas</h3></div><em>${pct(d.economy.ytdCoverage)} cobertura YTD</em></header>
      <div class="res971-econ-kpi"><b>${num(d.economy.ytdMatched)}</b><span>sociedades constituidas en 2026 con al menos una actividad SII materializada</span></div>
      <div class="res971-econ-toolbar"><div class="res971-group-chips" data-res971-groups></div><label class="res971-search"><span>Buscar</span><input type="search" data-res971-search placeholder="código o actividad económica" autocomplete="off"></label></div>
      <div class="res971-econ-grid"><section class="res971-econ-pane"><header><b>Distribución por rubro</b><span>Selecciona un bloque para filtrar</span></header><div class="res971-treemap" data-res971-tree></div></section><section class="res971-econ-pane"><header><b>Actividades económicas observadas</b><span data-res971-caption></span></header><div class="res971-activity-head"><span>Código</span><span>Actividad</span><span>Frecuencia relativa</span><span>Incidencias</span></div><div class="res971-activity-list" data-res971-list></div><div class="res971-selection" data-res971-selection></div></section></div>
      <div class="res971-evidence" data-res971-evidence hidden></div>
      <p class="res971-econ-note"><b>Cómo leerlo:</b> el rubro agrupa las actividades SII materializadas para exploración. Una sociedad puede declarar más de una actividad, por lo que los porcentajes se calculan sobre incidencias de actividad observadas y no representan participaciones exclusivas de sociedades. Cobertura SII parcial (${pct(d.economy.universeCoverage)} del universo RES); no se extrapola a empresas sin dato.</p>`;

    renderEconomy(card);
    card.addEventListener('click',e=>{
      const group=e.target.closest('[data-res971-group]');
      if(group){
        card.__res971.group=group.dataset.res971Group||'all';
        card.__res971.selected='';
        const ev=card.querySelector('[data-res971-evidence]');if(ev)ev.hidden=true;
        renderEconomy(card);return;
      }
      const activity=e.target.closest('[data-res971-activity]');
      if(activity){
        card.__res971.selected=activity.dataset.res971Activity||'';
        const ev=card.querySelector('[data-res971-evidence]');if(ev)ev.hidden=true;
        renderEconomy(card);return;
      }
      if(e.target.closest('[data-res971-open]'))loadEconomicEvidence(card);
    });
    card.addEventListener('input',e=>{
      if(!e.target.matches('[data-res971-search]'))return;
      card.__res971.search=e.target.value||'';
      renderEconomy(card);
    });

    window.__ATLAS_RES_ECONOMY_EXPLORER__={version:VERSION,status:'ready',activities:model.activities.length,rubros:model.groups.length,metric:'activity-incidences',render:'external-css-csp-safe',observer:'none',checkedAt:new Date().toISOString()};
    return true;
  }

  async function loadEconomicEvidence(card){
    const st=card.__res971;
    const act=st?.model?.activities?.find(a=>a.code===st.selected);
    const box=card.querySelector('[data-res971-evidence]');
    if(!act||!box)return;
    const token=++st.seq;
    box.hidden=false;
    box.innerHTML=`<div class="res971-evidence-loading">Consultando sociedades RES 2026 asociadas a ${esc(act.code)}…</div>`;
    const client=db();
    if(!client){box.innerHTML='<div class="res971-evidence-loading">Cliente de datos no disponible en esta sesión.</div>';return;}
    try{
      const ar=await client.from('aml_sii_registry_activity').select('rut').eq('activity_code',act.code).limit(1000);
      if(token!==st.seq)return;
      if(ar?.error)throw ar.error;
      const ruts=[...new Set((ar?.data||[]).map(x=>x.rut).filter(Boolean))];
      const rows=[];
      for(let i=0;i<Math.min(ruts.length,640)&&rows.length<60;i+=80){
        const chunk=ruts.slice(i,i+80);if(!chunk.length)break;
        const rr=await client.from('aml_res_company').select('rut,legal_name,constitution_date,company_code,capital,social_commune,social_region').in('rut',chunk).gte('constitution_date','2026-01-01').lte('constitution_date','2026-07-31').order('constitution_date',{ascending:false}).limit(60-rows.length);
        if(token!==st.seq)return;
        if(rr?.error)continue;
        (rr?.data||[]).forEach(x=>{if(!rows.some(y=>y.rut===x.rut))rows.push(x);});
      }
      rows.sort((a,b)=>String(b.constitution_date||'').localeCompare(String(a.constitution_date||'')));
      box.innerHTML=`<header><b>${esc(act.code)} · ${esc(act.name)}</b><span>${rows.length?`${num(rows.length)} sociedades en muestra operativa`:'sin coincidencias 2026 en la muestra consultada'}</span></header>${rows.length?`<div class="res971-evidence-head"><span>Sociedad</span><span>Constitución</span><span>Tipo</span><span>Capital</span><span>Comuna</span></div><div class="res971-evidence-list">${rows.map(r=>`<div class="res971-evidence-row"><span><b>${esc(r.legal_name||'Sin razón social')}</b><small>${esc(r.rut||'—')}</small></span><time>${esc(String(r.constitution_date||'').slice(0,10))}</time><em>${esc(r.company_code||'—')}</em><strong>${money(r.capital)}</strong><span>${esc(r.social_commune||'—')}</span></div>`).join('')}</div>`:'<div class="res971-evidence-loading">No fue posible individualizar sociedades 2026 dentro del límite operativo de consulta.</div>'}`;
    }catch(err){
      if(token!==st.seq)return;
      box.innerHTML=`<div class="res971-evidence-loading">No fue posible cargar la muestra: ${esc(err?.message||err)}</div>`;
    }
  }

  let timers=[];
  function bounded(){
    timers.forEach(clearTimeout);
    timers=[0,80,220,600,1200].map(ms=>setTimeout(()=>{bindMetric();applyCartogram();decorateEconomy();},ms));
  }
  bounded();
  document.addEventListener('atlas:routechange',bounded);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-res952-route="territory"],[data-res952-route="pulse"]'))setTimeout(bounded,0);
  },true);
})();
