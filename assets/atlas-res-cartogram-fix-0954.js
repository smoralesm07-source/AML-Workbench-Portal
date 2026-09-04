'use strict';
/* ATLAS AML · Empresas (RES) · cartogram + economy explorer 0.97.1 */
(function atlasResUtility0971(){
  if(window.__ATLAS_RES_CARTOGRAM_FIX_0954__) return;
  window.__ATLAS_RES_CARTOGRAM_FIX_0954__=true;
  const VERSION='0.97.1';
  const data=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const money=v=>v==null?'—':new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v));
  const growth=(a,b)=>b?((Number(a)/Number(b)-1)*100):0;

  /* ---------------- CARTOGRAMA TERRITORIAL ---------------- */
  function regionPeak(d,code){let best=-Infinity;(d?.regionMonthly?.[code]||[]).forEach(r=>{const g=growth(r[1],r[2]);if(Number.isFinite(g)&&g>best)best=g;});return Number.isFinite(best)?best:0;}
  function metricValue(d,code,metric){const row=(d?.regions||[]).find(r=>Number(r[0])===Number(code));if(!row)return 0;if(metric==='growth')return growth(row[1],row[2]);if(metric==='burst')return regionPeak(d,Number(code));return Number(row[1]||0);}
  function normalize(values,metric){const t=values.map(v=>metric==='volume'?Math.log1p(Math.max(0,v)):Number(v||0));const min=Math.min(...t),max=Math.max(...t),span=Math.max(1e-9,max-min);return t.map(v=>{let n=(v-min)/span;if(metric!=='volume')n=Math.pow(Math.max(0,n),.72);return Math.max(0,Math.min(1,n));});}
  function applyCartogram(){const box=document.querySelector('#res952-chile');if(!box)return false;const nodes=[...box.querySelectorAll('.res952-region-node[data-res952-region]')];if(!nodes.length)return false;const d=data();if(!d)return false;const metric=document.querySelector('#res952-territory-metric')?.value||'volume';const values=nodes.map(n=>metricValue(d,Number(n.dataset.res952Region),metric)),levels=normalize(values,metric);nodes.forEach((node,i)=>{const width=12+levels[i]*78;node.style.setProperty('--res954-bar-width',`${width.toFixed(1)}%`);node.style.setProperty('--level',String((width/100).toFixed(3)));node.dataset.res954Value=String(values[i]);node.dataset.res954Metric=metric;});box.dataset.res954Scale=metric==='volume'?'logarithmic':'normalized';window.__ATLAS_RES_CARTOGRAM__={version:VERSION,status:'ready',metric,scale:box.dataset.res954Scale,observer:'none',checkedAt:new Date().toISOString()};return true;}
  function bindMetric(){const select=document.querySelector('#res952-territory-metric');if(!select||select.dataset.res954Bound==='1')return;select.dataset.res954Bound='1';select.addEventListener('change',()=>requestAnimationFrame(applyCartogram));}

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

  function ensureEconomyStyle(){
    if(document.querySelector('#res971-economy-style'))return;
    const s=document.createElement('style');s.id='res971-economy-style';s.textContent=`
      .res952-root .res971-economy{padding:17px 18px;background:linear-gradient(155deg,var(--r-panel),color-mix(in srgb,var(--r-blue) 5%,var(--r-panel)));overflow:hidden}
      .res952-root .res971-econ-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:11px}.res952-root .res971-econ-head span{display:block;color:var(--r-orange);font-size:8.5px;font-weight:900;letter-spacing:.13em}.res952-root .res971-econ-head h3{margin:4px 0 0;font-size:18px;letter-spacing:-.025em}.res952-root .res971-econ-head em{font-style:normal;color:var(--r-muted);font-size:8.5px;white-space:nowrap}
      .res952-root .res971-econ-kpi{display:flex;align-items:baseline;gap:10px;padding:11px 13px;margin-bottom:10px;border:1px solid color-mix(in srgb,var(--r-blue) 38%,var(--r-line));border-radius:11px;background:color-mix(in srgb,var(--r-blue) 7%,var(--r-panel-2))}.res952-root .res971-econ-kpi b{color:var(--r-blue);font-size:22px;letter-spacing:-.03em}.res952-root .res971-econ-kpi span{color:var(--r-muted);font-size:9px}
      .res952-root .res971-econ-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.res952-root .res971-group-chips{display:flex;gap:5px;flex-wrap:wrap}.res952-root .res971-group-chips button{appearance:none;border:1px solid var(--r-line);border-radius:8px;background:var(--r-panel-2);color:var(--r-muted);padding:6px 8px;font-size:7.6px;font-weight:800;cursor:pointer}.res952-root .res971-group-chips button:hover,.res952-root .res971-group-chips button.active{border-color:color-mix(in srgb,var(--r-blue) 65%,var(--r-line));color:var(--r-text);background:color-mix(in srgb,var(--r-blue) 11%,var(--r-panel-2))}.res952-root .res971-search{display:flex;align-items:center;gap:6px;min-width:235px;border:1px solid var(--r-line);border-radius:8px;background:var(--r-panel-2);padding:0 8px}.res952-root .res971-search span{font-size:8px;color:var(--r-muted)}.res952-root .res971-search input{width:100%;min-width:0;border:0;background:transparent;color:var(--r-text);padding:7px 2px;outline:none;font-size:8.5px}
      .res952-root .res971-econ-grid{display:grid;grid-template-columns:minmax(310px,.9fr) minmax(420px,1.25fr);gap:10px}.res952-root .res971-econ-pane{min-width:0;padding:11px 12px;border:1px solid var(--r-line);border-radius:12px;background:color-mix(in srgb,var(--r-panel-2) 78%,transparent)}.res952-root .res971-econ-pane>header{display:flex;justify-content:space-between;gap:12px;align-items:start;margin-bottom:8px}.res952-root .res971-econ-pane>header b{font-size:10px}.res952-root .res971-econ-pane>header span{font-size:7.5px;color:var(--r-muted)}
      .res952-root .res971-treemap{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:58px;gap:5px;min-height:179px}.res952-root .res971-tile{grid-column:span var(--c);grid-row:span var(--r);appearance:none;position:relative;overflow:hidden;display:grid;align-content:end;gap:2px;min-width:0;padding:9px;border:1px solid color-mix(in srgb,var(--r-blue) 30%,var(--r-line));border-radius:9px;background:linear-gradient(145deg,color-mix(in srgb,var(--r-blue) 19%,var(--r-panel-2)),var(--r-panel-3));color:var(--r-text);text-align:left;cursor:pointer}.res952-root .res971-tile:nth-child(1){background:linear-gradient(145deg,color-mix(in srgb,var(--r-orange) 38%,var(--r-panel-2)),color-mix(in srgb,var(--r-orange) 16%,var(--r-panel-3)));border-color:color-mix(in srgb,var(--r-orange) 55%,var(--r-line))}.res952-root .res971-tile:nth-child(2){background:linear-gradient(145deg,color-mix(in srgb,var(--r-blue) 34%,var(--r-panel-2)),var(--r-panel-3))}.res952-root .res971-tile:hover,.res952-root .res971-tile.active{outline:1px solid color-mix(in srgb,var(--r-orange) 65%,transparent);transform:translateY(-1px)}.res952-root .res971-tile b{font-size:10px;line-height:1.15}.res952-root .res971-tile strong{font-size:15px;letter-spacing:-.025em}.res952-root .res971-tile small{font-size:7px;color:var(--r-muted)}
      .res952-root .res971-activity-head,.res952-root .res971-activity-row{display:grid;grid-template-columns:54px minmax(170px,1.2fr) minmax(115px,.8fr) 64px;gap:8px;align-items:center}.res952-root .res971-activity-head{padding:2px 3px 5px;color:var(--r-muted);font-size:6.8px;text-transform:uppercase;letter-spacing:.05em}.res952-root .res971-activity-head span:last-child{text-align:right}.res952-root .res971-activity-list{display:grid;max-height:300px;overflow:auto}.res952-root .res971-activity-row{appearance:none;width:100%;padding:7px 3px;border:0;border-bottom:1px solid var(--r-line-soft);background:transparent;color:var(--r-text);text-align:left;cursor:pointer}.res952-root .res971-activity-row:hover,.res952-root .res971-activity-row.active{background:color-mix(in srgb,var(--r-blue) 7%,var(--r-panel-2))}.res952-root .res971-activity-row code{font-size:7.5px;color:var(--r-blue);background:var(--r-panel-3);padding:3px 4px;border-radius:5px}.res952-root .res971-activity-row>span{font-size:8.2px;line-height:1.3}.res952-root .res971-act-track{height:7px;border-radius:99px;background:var(--r-panel-3);overflow:hidden}.res952-root .res971-act-track i{display:block;width:var(--w);height:100%;border-radius:99px;background:linear-gradient(90deg,var(--r-blue),var(--r-orange))}.res952-root .res971-activity-row strong{display:grid;text-align:right;font-size:8.5px}.res952-root .res971-activity-row strong small{font-size:6.8px;color:var(--r-muted);font-weight:600}
      .res952-root .res971-selection{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:8px;padding:8px 9px;border:1px solid color-mix(in srgb,var(--r-orange) 26%,var(--r-line));border-radius:9px;background:color-mix(in srgb,var(--r-orange) 5%,var(--r-panel-2))}.res952-root .res971-selection span{display:grid;gap:2px;min-width:0}.res952-root .res971-selection b{font-size:8.8px}.res952-root .res971-selection small{font-size:7.2px;color:var(--r-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.res952-root .res971-selection button{appearance:none;border:1px solid color-mix(in srgb,var(--r-orange) 55%,var(--r-line));border-radius:7px;background:var(--r-orange);color:#17120b;padding:6px 8px;font-size:7.5px;font-weight:900;cursor:pointer;white-space:nowrap}
      .res952-root .res971-econ-note{margin:9px 0 0;padding:8px 9px;border-left:2px solid var(--r-orange);background:color-mix(in srgb,var(--r-orange) 5%,transparent);color:var(--r-muted);font-size:7.8px;line-height:1.45}.res952-root .res971-econ-note b{color:var(--r-text)}
      .res952-root .res971-evidence{margin-top:10px;padding:10px 11px;border:1px solid var(--r-line);border-radius:11px;background:var(--r-panel-2)}.res952-root .res971-evidence[hidden]{display:none}.res952-root .res971-evidence>header{display:flex;justify-content:space-between;gap:10px;align-items:start;margin-bottom:7px}.res952-root .res971-evidence>header b{font-size:9px}.res952-root .res971-evidence>header span{font-size:7px;color:var(--r-muted);text-align:right}.res952-root .res971-evidence-head,.res952-root .res971-evidence-row{display:grid;grid-template-columns:minmax(185px,1.4fr) 84px 62px 92px minmax(90px,.7fr);gap:8px;align-items:center}.res952-root .res971-evidence-head{padding:5px 6px;background:var(--r-panel-3);color:var(--r-muted);font-size:6.6px;text-transform:uppercase}.res952-root .res971-evidence-list{max-height:280px;overflow:auto}.res952-root .res971-evidence-row{padding:7px 6px;border-bottom:1px solid var(--r-line-soft);font-size:7.7px}.res952-root .res971-evidence-row>span:first-child{display:grid;gap:1px}.res952-root .res971-evidence-row b{font-size:8px}.res952-root .res971-evidence-row small{font-size:6.8px;color:var(--r-muted)}.res952-root .res971-evidence-loading{padding:18px;text-align:center;color:var(--r-muted);font-size:8px}
      @media(max-width:1000px){.res952-root .res971-econ-grid{grid-template-columns:1fr}.res952-root .res971-econ-toolbar{align-items:stretch;flex-direction:column}.res952-root .res971-search{min-width:0}.res952-root .res971-treemap{grid-auto-rows:52px}}
      @media(max-width:680px){.res952-root .res971-treemap{grid-template-columns:repeat(6,minmax(0,1fr))}.res952-root .res971-tile{grid-column:span min(var(--c),6)}.res952-root .res971-activity-head{display:none}.res952-root .res971-activity-row{grid-template-columns:50px minmax(0,1fr) 58px}.res952-root .res971-act-track{display:none}.res952-root .res971-evidence-head{display:none}.res952-root .res971-evidence-row{grid-template-columns:1fr 72px}.res952-root .res971-evidence-row>*:nth-child(3),.res952-root .res971-evidence-row>*:nth-child(4),.res952-root .res971-evidence-row>*:nth-child(5){display:none}}
    `;document.head.appendChild(s);
  }

  function classifyActivity(code,name){return GROUP_RULES.find(g=>g.test(code,name))||GROUP_RULES.at(-1);}
  function economyModel(d){
    const activities=(d?.economy?.activities||[]).map(r=>({code:String(r[0]),name:String(r[1]||'Actividad sin nombre'),count:Number(r[2]||0)}));
    activities.forEach(a=>a.group=classifyActivity(a.code,a.name).id);
    const groups=GROUP_RULES.map(g=>({id:g.id,label:g.label,count:activities.filter(a=>a.group===g.id).reduce((s,a)=>s+a.count,0)})).filter(g=>g.count>0).sort((a,b)=>b.count-a.count);
    const total=activities.reduce((s,a)=>s+a.count,0);
    return {activities,groups,total};
  }
  function tileSpan(share,index){if(index===0||share>=30)return [7,2];if(share>=20)return [5,2];if(share>=10)return [4,1];return [3,1];}

  function renderEconomy(card){
    const st=card.__res971;if(!st)return;
    const groupBox=card.querySelector('[data-res971-groups]'),tree=card.querySelector('[data-res971-tree]'),list=card.querySelector('[data-res971-list]'),selection=card.querySelector('[data-res971-selection]'),caption=card.querySelector('[data-res971-caption]');
    const groupLabel=st.group==='all'?'Todos los rubros':st.model.groups.find(g=>g.id===st.group)?.label||'Todos los rubros';
    if(groupBox)groupBox.innerHTML=`<button type="button" data-res971-group="all" class="${st.group==='all'?'active':''}">Todos</button>${st.model.groups.map(g=>`<button type="button" data-res971-group="${esc(g.id)}" class="${st.group===g.id?'active':''}">${esc(g.label)}</button>`).join('')}`;
    if(tree)tree.innerHTML=st.model.groups.map((g,i)=>{const share=st.model.total?g.count/st.model.total*100:0,[c,r]=tileSpan(share,i);return `<button type="button" class="res971-tile ${st.group===g.id?'active':''}" data-res971-group="${esc(g.id)}" style="--c:${c};--r:${r}"><b>${esc(g.label)}</b><strong>${num(g.count)}</strong><small>${pct(share)} de incidencias observadas</small></button>`;}).join('');
    const term=st.search.trim().toLocaleLowerCase('es-CL');
    const rows=st.model.activities.filter(a=>(st.group==='all'||a.group===st.group)&&(!term||`${a.code} ${a.name}`.toLocaleLowerCase('es-CL').includes(term))).sort((a,b)=>b.count-a.count);
    if(!rows.some(a=>a.code===st.selected))st.selected=rows[0]?.code||'';
    const max=Math.max(...rows.map(a=>a.count),1);
    if(caption)caption.textContent=`${groupLabel} · ${rows.length} actividad${rows.length===1?'':'es'}`;
    if(list)list.innerHTML=rows.length?rows.map(a=>{const share=st.model.total?a.count/st.model.total*100:0;return `<button type="button" class="res971-activity-row ${st.selected===a.code?'active':''}" data-res971-activity="${esc(a.code)}"><code>${esc(a.code)}</code><span>${esc(a.name)}</span><span class="res971-act-track"><i style="--w:${(100*a.count/max).toFixed(1)}%"></i></span><strong>${num(a.count)}<small>${pct(share)}</small></strong></button>`;}).join(''):'<div class="res971-evidence-loading">Sin actividades para este filtro.</div>';
    const active=st.model.activities.find(a=>a.code===st.selected);
    if(selection)selection.innerHTML=active?`<span><b>${esc(active.code)} · ${esc(active.name)}</b><small>${esc(classifyActivity(active.code,active.name).label)} · ${num(active.count)} incidencias materializadas</small></span><button type="button" data-res971-open>Ver muestra de sociedades</button>`:'<span><b>Selecciona una actividad</b><small>El drill-down mostrará una muestra operativa de sociedades RES 2026 asociadas.</small></span>';
  }

  function decorateEconomy(){
    const root=document.querySelector('[data-res952-root]'),card=root?.querySelector('.res952-economic'),d=data();if(!card||!d?.economy||card.dataset.res971Economy==='1')return false;
    ensureEconomyStyle();card.dataset.res971Economy='1';card.classList.add('res971-economy');
    const model=economyModel(d);card.__res971={model,group:'all',search:'',selected:model.activities.sort((a,b)=>b.count-a.count)[0]?.code||'',seq:0};
    card.innerHTML=`<header class="res971-econ-head"><div><span>ENRIQUECIMIENTO EXTERNO</span><h3>Rubros de nuevas sociedades constituidas</h3></div><em>${pct(d.economy.ytdCoverage)} cobertura YTD</em></header>
      <div class="res971-econ-kpi"><b>${num(d.economy.ytdMatched)}</b><span>sociedades constituidas en 2026 con al menos una actividad SII materializada</span></div>
      <div class="res971-econ-toolbar"><div class="res971-group-chips" data-res971-groups></div><label class="res971-search"><span>Buscar</span><input type="search" data-res971-search placeholder="código o actividad económica"></label></div>
      <div class="res971-econ-grid"><section class="res971-econ-pane"><header><b>Distribución por rubro</b><span>clic para filtrar actividades</span></header><div class="res971-treemap" data-res971-tree></div></section><section class="res971-econ-pane"><header><b>Actividades económicas observadas</b><span data-res971-caption></span></header><div class="res971-activity-head"><span>Código</span><span>Actividad</span><span>Frecuencia relativa</span><span>Incidencias</span></div><div class="res971-activity-list" data-res971-list></div><div class="res971-selection" data-res971-selection></div></section></div>
      <div class="res971-evidence" data-res971-evidence hidden></div>
      <p class="res971-econ-note"><b>Cómo leerlo:</b> el rubro agrupa las actividades SII materializadas para exploración. Una sociedad puede declarar más de una actividad, por lo que los porcentajes se calculan sobre incidencias de actividad observadas y no representan participaciones exclusivas de sociedades. Cobertura SII parcial (${pct(d.economy.universeCoverage)} del universo RES); no se extrapola a empresas sin dato.</p>`;
    renderEconomy(card);
    card.addEventListener('click',e=>{
      const group=e.target.closest('[data-res971-group]');if(group){card.__res971.group=group.dataset.res971Group||'all';card.__res971.selected='';const ev=card.querySelector('[data-res971-evidence]');if(ev)ev.hidden=true;renderEconomy(card);return;}
      const activity=e.target.closest('[data-res971-activity]');if(activity){card.__res971.selected=activity.dataset.res971Activity||'';const ev=card.querySelector('[data-res971-evidence]');if(ev)ev.hidden=true;renderEconomy(card);return;}
      if(e.target.closest('[data-res971-open]'))loadEconomicEvidence(card);
    });
    card.addEventListener('input',e=>{if(!e.target.matches('[data-res971-search]'))return;card.__res971.search=e.target.value||'';renderEconomy(card);});
    window.__ATLAS_RES_ECONOMY_EXPLORER__={version:VERSION,status:'ready',activities:model.activities.length,rubros:model.groups.length,metric:'activity-incidences',observer:'none',checkedAt:new Date().toISOString()};
    return true;
  }

  async function loadEconomicEvidence(card){
    const st=card.__res971,act=st?.model?.activities?.find(a=>a.code===st.selected),box=card.querySelector('[data-res971-evidence]');if(!act||!box)return;
    const token=++st.seq;box.hidden=false;box.innerHTML=`<div class="res971-evidence-loading">Consultando sociedades RES 2026 asociadas a ${esc(act.code)}…</div>`;
    const client=db();if(!client){box.innerHTML='<div class="res971-evidence-loading">Cliente de datos no disponible en esta sesión.</div>';return;}
    try{
      const ar=await client.from('aml_sii_registry_activity').select('rut').eq('activity_code',act.code).limit(1000);if(token!==st.seq)return;if(ar?.error)throw ar.error;
      const ruts=[...new Set((ar?.data||[]).map(x=>x.rut).filter(Boolean))];const rows=[];
      for(let i=0;i<Math.min(ruts.length,640)&&rows.length<60;i+=80){
        const chunk=ruts.slice(i,i+80);if(!chunk.length)break;
        const rr=await client.from('aml_res_company').select('rut,legal_name,constitution_date,company_code,capital,social_commune,social_region').in('rut',chunk).gte('constitution_date','2026-01-01').lte('constitution_date','2026-07-31').order('constitution_date',{ascending:false}).limit(60-rows.length);if(token!==st.seq)return;if(rr?.error)continue;(rr?.data||[]).forEach(x=>{if(!rows.some(y=>y.rut===x.rut))rows.push(x);});
      }
      rows.sort((a,b)=>String(b.constitution_date||'').localeCompare(String(a.constitution_date||'')));
      box.innerHTML=`<header><b>${esc(act.code)} · ${esc(act.name)}</b><span>${rows.length?`${num(rows.length)} sociedades en muestra operativa`:'sin coincidencias 2026 en la muestra consultada'}</span></header>${rows.length?`<div class="res971-evidence-head"><span>Sociedad</span><span>Constitución</span><span>Tipo</span><span>Capital</span><span>Comuna</span></div><div class="res971-evidence-list">${rows.map(r=>`<div class="res971-evidence-row"><span><b>${esc(r.legal_name||'Sin razón social')}</b><small>${esc(r.rut||'—')}</small></span><time>${esc(String(r.constitution_date||'').slice(0,10))}</time><em>${esc(r.company_code||'—')}</em><strong>${money(r.capital)}</strong><span>${esc(r.social_commune||'—')}</span></div>`).join('')}</div>`:'<div class="res971-evidence-loading">No fue posible individualizar sociedades 2026 dentro del límite operativo de consulta.</div>'}`;
    }catch(err){if(token!==st.seq)return;box.innerHTML=`<div class="res971-evidence-loading">No fue posible cargar la muestra: ${esc(err?.message||err)}</div>`;}
  }

  let timers=[];
  function bounded(){timers.forEach(clearTimeout);timers=[0,80,220,600,1200].map(ms=>setTimeout(()=>{bindMetric();applyCartogram();decorateEconomy();},ms));}
  bounded();
  document.addEventListener('atlas:routechange',bounded);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-res952-route="territory"],[data-res952-route="pulse"]'))setTimeout(bounded,0);},true);
})();
