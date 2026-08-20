'use strict';
/* ATLAS AML · Gasto Público · Taxonomía de marcas v3
 * Alta=1.00 · Media=0.50 · Contextual=0.10.
 * Las contextuales no generan por sí solas prioridad de revisión.
 * Las marcas descartadas permanecen disponibles en el radar fuente, pero no participan
 * del Índice de Atención, ranking ni grafo de casos llamativos de Atlas.
 */
(function atlasPublicSpendMarkTaxonomyV3(){
  const TAXONOMY={
    PROVIDER_CONCENTRATION:{level:'ALTA',weight:1,family:'RELACION_ESTADO'},
    NEW_TO_SERIES_HIGH_SPEND:{level:'ALTA',weight:1,family:'RELACION_ESTADO'},
    HIGH_SALES_LOW_WORKFORCE:{level:'ALTA',weight:1,family:'CAPACIDAD_ECONOMICA'},
    RECENT_START_HIGH_SALES:{level:'ALTA',weight:1,family:'CAPACIDAD_ECONOMICA'},
    AMOUNT_OUTLIER:{level:'ALTA',weight:1,family:'RELACION_ESTADO'},
    POTENTIAL_FRAGMENTATION:{level:'MEDIA',weight:.5,family:'RELACION_ESTADO'},
    INICIO_RECIENTE_SII:{level:'CONTEXTUAL',weight:.1,family:'CICLO_VIDA'},
    NUEVO_EN_SERIE:{level:'CONTEXTUAL',weight:.1,family:'CICLO_VIDA'}
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const clamp=v=>Math.max(0,Math.min(100,n(v)));
  const money=v=>typeof window.v037Money==='function'?window.v037Money(v):'$'+Math.round(n(v)).toLocaleString('es-CL');
  const label=t=>typeof window.v037MarkLabel==='function'?window.v037MarkLabel(t):String(t||'Marca').replaceAll('_',' ');
  const short=(s,l=34)=>String(s||'').length>l?String(s).slice(0,l-1)+'…':String(s||'');
  const ctx=()=>{try{return typeof window.v037BaseContext==='function'?window.v037BaseContext():null;}catch{return null;}};
  const years=()=>{try{return [...window.v037YearSet?.()||[]].map(Number).filter(Number.isFinite).sort((a,b)=>a-b);}catch{return[];}};
  function allMarks(p){try{return typeof window.v037Marks==='function'?window.v037Marks(p)||[]:[];}catch{return[];}}
  function selectedMarks(p){return allMarks(p).filter(m=>TAXONOMY[m.signal_type]).map(m=>({...m,...TAXONOMY[m.signal_type]}));}
  function triggerMarks(p){return selectedMarks(p).filter(m=>m.level==='ALTA'||m.level==='MEDIA');}
  function pctRank(rows,key){const vals=rows.map(r=>n(r[key])).sort((a,b)=>a-b);for(const r of rows){const v=n(r[key]);let i=0;for(let j=0;j<vals.length;j++)if(vals[j]<=v)i=j;r[key+'Pct']=vals.length<=1?50:100*i/(vals.length-1);}return rows;}
  function serviceSignals(c){
    if(!c)return[];const ys=years(),rows=[];
    for(const s of c.sRows||[]){
      const sid=String(s.organization_id),flows=c.sFs?.get(sid)||[];if(!flows.length)continue;
      let markedAmount=0,severityRaw=0,topShare=0;const types=new Map(),families=new Set(),markedProviders=new Set();let hasTrigger=false;
      for(const f of flows){
        const p=c.providers?.get(String(f.provider_id))||{provider_id:f.provider_id,provider_name:f.provider_name,rut:f.rut};
        const ms=selectedMarks(p),triggers=ms.filter(m=>m.level!=='CONTEXTUAL');
        if(triggers.length){hasTrigger=true;markedAmount+=n(f._a);markedProviders.add(String(f.provider_id));topShare=Math.max(topShare,n(f._a)/Math.max(1,n(s.current_amount)));}
        const uniq=new Map();for(const m of ms){if(!uniq.has(m.signal_type))uniq.set(m.signal_type,m);types.set(m.signal_type,(types.get(m.signal_type)||0)+1);families.add(m.family);}
        severityRaw+=[...uniq.values()].reduce((a,m)=>a+n(m.weight),0);
      }
      const markedRatio=markedAmount/Math.max(1,n(s.current_amount));
      const familyConvergence=Math.min(1,families.size/3);
      const ymap=new Map((s.yearly||[]).map(x=>[Number(x.year),n(x.amount_clp)])),cur=ys.at(-1),prev=ys.at(-2);let growth=0;if(cur&&prev&&ymap.get(prev)>0)growth=ymap.get(cur)/ymap.get(prev)-1;
      rows.push({service:s,flows,severityRaw,markedAmount,markedRatio,markedProviders:markedProviders.size,types,families,familyConvergence,concentration:topShare,growth,amount:n(s.current_amount),hasTrigger});
    }
    pctRank(rows,'severityRaw');pctRank(rows,'growth');
    for(const r of rows){
      const pressure=.70*r.severityRawPct+.30*100*r.familyConvergence;
      r.pressure=pressure;
      r.score=r.hasTrigger?clamp(.35*pressure+.25*100*r.markedRatio+.20*100*r.concentration+.10*Math.max(0,r.growthPct)+.10*100*r.familyConvergence):0;
      r.band=r.score>=75?'Prioridad muy alta':r.score>=60?'Prioridad alta':r.score>=45?'Prioridad media':'Prioridad acotada';
    }
    return rows.filter(r=>r.hasTrigger).sort((a,b)=>b.score-a.score||b.markedAmount-a.markedAmount);
  }
  function topMarks(r,max=3){return [...r.types.keys()].filter(t=>TAXONOMY[t]).sort((a,b)=>TAXONOMY[b].weight-TAXONOMY[a].weight||(r.types.get(b)||0)-(r.types.get(a)||0)).slice(0,max);}
  function markChips(r,max=3){return topMarks(r,max).map(t=>`<span class="atlas-spend-tax-chip ${TAXONOMY[t].level.toLowerCase()}">${esc(label(t))}<i>${TAXONOMY[t].level}</i></span>`).join('');}
  function renderCommand(c,rows){
    const box=document.getElementById('atlas-v2-spend-command');if(!box)return;
    const top=rows.slice(0,8),markedAmount=rows.reduce((a,r)=>a+r.markedAmount,0),activeTypes=new Set(rows.flatMap(r=>[...r.types.keys()].filter(t=>TAXONOMY[t]))),first=top[0],growing=[...rows].filter(r=>r.growth>0).sort((a,b)=>b.growth-a.growth)[0];
    box.innerHTML=`<div class="atlas-spend-command-head"><div><span>LECTURA PRIORITARIA · RADAR PRESUPUESTO ABIERTO</span><h2>¿Dónde están pasando cosas?</h2><p>Prioriza servicios únicamente con señales Alta o Media. Las señales Contextuales enriquecen la lectura, pero no generan por sí solas un caso prioritario.</p></div><details><summary>Ayuda metodológica</summary><p><b>Taxonomía activa:</b> Alta = 1,00; Media = 0,50; Contextual = 0,10. <b>Altas:</b> Concentración proveedor, Nuevo + gasto alto, Ventas altas / baja dotación, Inicio reciente + ventas altas y Monto atípico. <b>Media:</b> Posible fragmentación. <b>Contextuales:</b> Inicio reciente SII y Nuevo en serie.</p><p>Las demás marcas del radar quedan fuera de esta priorización. El Índice de Atención mantiene 35% presión de marcas, 25% flujo bajo señal, 20% concentración, 10% cambio de escala y 10% convergencia. La presión de marcas combina 70% severidad ponderada y 30% convergencia de familias.</p></details></div>
      <div class="atlas-spend-pulse"><article><span>Servicios priorizables</span><b>${rows.length}</b><small>requieren ≥1 señal Alta o Media</small></article><article><span>Flujo bajo señal</span><b>${money(markedAmount)}</b><small>solo proveedores con Alta/Media</small></article><article><span>Señales activas</span><b>${activeTypes.size}</b><small>de 8 señales seleccionadas</small></article><article><span>Mayor atención</span><b>${first?first.score.toLocaleString('es-CL',{maximumFractionDigits:1}):'—'}</b><small>${esc(first?.service?.organization_name||'sin caso')}</small></article></div>
      <div class="atlas-spend-priority-grid"><div class="atlas-spend-priority-list"><header><div><span>TOP SERVICIOS</span><h3>Revisar primero</h3></div><small>solo convergencia Alta/Media</small></header>${top.map((r,i)=>`<button data-atlas-service="${esc(r.service.organization_id)}"><em>${i+1}</em><div><b>${esc(short(r.service.organization_name,42))}</b><small>${r.markedProviders} proveedores bajo señal · ${Math.round(r.markedRatio*100)}% del flujo</small><div class="atlas-spend-tax-chips">${markChips(r)}</div></div><strong>${r.score.toLocaleString('es-CL',{maximumFractionDigits:1})}<small>${esc(r.band)}</small></strong></button>`).join('')||'<p class="atlas-spend-empty">Sin servicios con señales Alta o Media para el foco actual.</p>'}</div><div class="atlas-spend-auto-read"><header><span>LECTURA AUTOMÁTICA</span><h3>Qué explica la atención</h3></header><article><span>Convergencia dominante</span><b>${first?esc(topMarks(first,2).map(label).join(' + ')):'—'}</b><small>${first?`${first.markedProviders} proveedores bajo señal · presión ponderada ${first.pressure.toLocaleString('es-CL',{maximumFractionDigits:1})}/100`:''}</small></article><article><span>Mayor cambio de escala</span><b>${esc(growing?.service?.organization_name||'—')}</b><small>${growing?`${growing.growth>=0?'+':''}${(100*growing.growth).toLocaleString('es-CL',{maximumFractionDigits:1})}% entre los dos últimos años seleccionados`:''}</small></article><article><span>Regla de lectura</span><b>Alta/Media activan · Contextual explica</b><small>Una señal contextual aislada no incorpora al servicio al ranking ni al grafo de casos llamativos.</small></article></div></div>`;
    box.querySelectorAll('[data-atlas-service]').forEach(b=>b.onclick=()=>window.v037Focus?.('service',b.dataset.atlasService));
  }
  function renderFlow(c,rows){
    const box=document.getElementById('v037-flow');if(!box)return;const sr=rows.slice(0,5),sids=new Set(sr.map(r=>String(r.service.organization_id)));let flows=(c.fs||[]).filter(f=>sids.has(String(f.organization_id))).filter(f=>{const p=c.providers?.get(String(f.provider_id))||{provider_id:f.provider_id,provider_name:f.provider_name,rut:f.rut};return triggerMarks(p).length>0;}).sort((a,b)=>b._a-a._a).slice(0,22);
    const pAmount=new Map();for(const f of flows)pAmount.set(String(f.provider_id),(pAmount.get(String(f.provider_id))||0)+n(f._a));const providers=[...pAmount].sort((a,b)=>b[1]-a[1]).slice(0,9).map(([id,a])=>({id,a,p:c.providers?.get(id)||{provider_id:id,provider_name:flows.find(f=>String(f.provider_id)===id)?.provider_name||id}}));const pids=new Set(providers.map(x=>x.id));flows=flows.filter(f=>pids.has(String(f.provider_id)));if(!flows.length){box.innerHTML='<div class="v037-empty">No hay relaciones con señales Alta o Media para el foco actual.</div>';return;}
    const W=980,H=Math.max(360,Math.max(sr.length,providers.length)*44+70),sx=190,px=790,sy=(H-70)/Math.max(sr.length,1),py=(H-70)/Math.max(providers.length,1),sp=new Map(),pp=new Map();sr.forEach((r,i)=>sp.set(String(r.service.organization_id),45+i*sy));providers.forEach((x,i)=>pp.set(x.id,45+i*py));const max=Math.max(...flows.map(f=>n(f._a)),1),total=flows.reduce((a,f)=>a+n(f._a),0);let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Flujos priorizados con señales Alta o Media">`;
    for(const f of flows){const y1=sp.get(String(f.organization_id)),y2=pp.get(String(f.provider_id));if(y1==null||y2==null)continue;const w=1.5+11*Math.sqrt(n(f._a)/max);svg+=`<path d="M${sx},${y1} C${sx+180},${y1} ${px-180},${y2} ${px},${y2}" class="atlas-spend-signal-edge" stroke-width="${w.toFixed(2)}"><title>${esc(f.organization_name)} → ${esc(f.provider_name)} · ${money(f._a)}</title></path>`;}
    for(const r of sr){const y=sp.get(String(r.service.organization_id));svg+=`<g class="atlas-spend-node" data-atlas-service="${esc(r.service.organization_id)}"><rect x="8" y="${y-16}" width="${sx-18}" height="32" rx="9"/><text x="17" y="${y+4}">${esc(short(r.service.organization_name,24))}</text><title>Índice ${r.score.toFixed(1)} · ${topMarks(r).map(label).join(' · ')}</title></g>`;}
    for(const x of providers){const y=pp.get(x.id),ms=triggerMarks(x.p),txt=[...new Set(ms.map(m=>label(m.signal_type)))].slice(0,2).join(' · ');svg+=`<g class="atlas-spend-node provider" data-atlas-provider="${esc(x.id)}"><rect x="${px+8}" y="${y-16}" width="${W-px-16}" height="32" rx="9"/><text x="${px+17}" y="${y+4}">${esc(short(x.p.provider_name,22))}</text><title>${esc(txt)} · ${money(x.a)}</title></g>`;}
    svg+=`<g class="atlas-spend-center"><circle cx="490" cy="${H/2}" r="54"/><text x="490" y="${H/2-7}" text-anchor="middle">ALTA / MEDIA</text><text x="490" y="${H/2+17}" text-anchor="middle">${esc(money(total))}</text></g></svg>`;box.innerHTML=svg;box.querySelectorAll('[data-atlas-service]').forEach(n=>n.onclick=()=>window.v037Focus?.('service',n.dataset.atlasService));box.querySelectorAll('[data-atlas-provider]').forEach(n=>n.onclick=()=>window.v037Focus?.('provider',n.dataset.atlasProvider));const card=box.closest('.v037-card'),h=card?.querySelector('.v037-head h2'),p=card?.querySelector('.v037-head p'),tag=card?.querySelector('.v037-head>span');if(h)h.textContent='Flujo bajo señal · Alta / Media';if(p)p.textContent='Exclusivamente relaciones con proveedores que presentan al menos una señal Alta o Media. Las contextuales no activan el grafo.';if(tag)tag.textContent='solo casos priorizables';
  }
  function renderRank(rows){const box=document.getElementById('v037-rank');if(!box)return;const top=rows.slice(0,10);box.innerHTML=top.map((r,i)=>`<button class="v037-bar atlas-priority-rank" data-atlas-service="${esc(r.service.organization_id)}"><span>${i+1}. ${esc(short(r.service.organization_name,36))}</span><progress max="100" value="${clamp(r.score)}"></progress><strong>${r.score.toLocaleString('es-CL',{maximumFractionDigits:1})}</strong><small>${esc(topMarks(r,2).map(label).join(' · ')||r.band)}</small></button>`).join('')||'<div class="v037-empty">Sin servicios priorizables.</div>';box.querySelectorAll('[data-atlas-service]').forEach(b=>b.onclick=()=>window.v037Focus?.('service',b.dataset.atlasService));const note=document.getElementById('v037-rank-note');if(note)note.textContent='taxonomía Alta / Media · top 10';}
  function decorate(){if(!document.querySelector('.v037-spend'))return;const c=ctx();if(!c)return;const rows=serviceSignals(c);renderCommand(c,rows);renderFlow(c,rows);renderRank(rows);document.querySelector('.v037-spend')?.setAttribute('data-atlas-mark-taxonomy','v3');}
  function install(){const fn=window.v037RenderAll;if(typeof fn!=='function'){setTimeout(install,250);return;}if(fn.__atlasSpendTaxonomyV3){decorate();return;}const wrapped=function(...args){const out=fn.apply(this,args);requestAnimationFrame(()=>requestAnimationFrame(decorate));return out;};wrapped.__atlasSpendTaxonomyV3=true;window.v037RenderAll=wrapped;requestAnimationFrame(()=>requestAnimationFrame(decorate));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
  window.ATLAS_PUBLIC_SPEND_MARK_TAXONOMY_V3={version:'3.0.0',taxonomy:TAXONOMY,contextualCanTrigger:false,excluded:['YEAR_END_SPIKE','SALES_BAND_JUMP','WORKFORCE_DROP_STABLE_SALES','MAIN_ACTIVITY_CHANGE','REGION_CHANGE','ACTIVITY_BREADTH','REACTIVATION_PATTERN','HIGH_SALES_NEGATIVE_EQUITY','PAYMENT_DELAY_OUTLIER']};
})();
