'use strict';
function v034StyleBand(v){return v>=70?'critical':v>=50?'high':v>=30?'medium':'low';}
function v034Badges(s){return s.isSO?'<span class="sv12-badge so">SO inscrito</span>':`<span class="sv12-badge other">Otras entidades</span>${s.potential.yes?'<span class="sv12-badge potential">Potencial SO</span>':''}`;}
function v034PeriodRange(period){
 const end=new Date(),start=new Date('2020-01-01T00:00:00');
 if(period==='24m'){const s=new Date(end);s.setMonth(s.getMonth()-24);return [s,end];}
 if(period==='12m'){const s=new Date(end);s.setMonth(s.getMonth()-12);return [s,end];}
 if(/^\d{4}$/.test(period)){const y=Number(period);return [new Date(`${y}-01-01T00:00:00`),y===end.getFullYear()?end:new Date(`${y}-12-31T23:59:59`)];}
 return [start,end];
}
function v034GroupOk(s,g){return g==='ALL'||(g==='SO'&&s.isSO)||(g==='OTHER'&&!s.isSO)||(g==='POTENTIAL'&&!s.isSO&&s.potential.yes);}
function v034View(opts={}){
 const [a,z]=v034PeriodRange(V034.st.period);
 let events=V034.data.events.filter(e=>{const d=v034Date(e.date);return d&&d>=a&&d<=z;});
 if(!opts.ignoreSupervisor)events=events.filter(e=>V034.st.sups.has(e.regulator));
 if(!opts.ignoreCategory&&V034.st.category!=='all')events=events.filter(e=>e.category===V034.st.category);
 const eventIds=new Set(events.map(e=>e.id)),subjects=[];
 for(const base of V034.data.subjects){
   if(!opts.ignoreGroup&&!v034GroupOk(base,V034.st.group))continue;
   if(!opts.ignoreSector&&V034.st.sector!=='all'&&base.sector!==V034.st.sector)continue;
   if(!opts.ignoreRegion&&V034.st.region!=='all'&&base.region!==V034.st.region)continue;
   const es=base.events.filter(e=>eventIds.has(e.id));if(!es.length)continue;
   subjects.push({...base,events:es});
 }
 const keys=new Set(subjects.map(s=>s.key));
 events=events.filter(e=>{
   const k=e.entityId?`E:${e.entityId}`:e.rut?`R:${e.rut}`:`N:${v034Norm(e.name)}`;return keys.has(k);
 });
 return {subjects,events};
}
function v034FilteredEntities(D){
 const q=v034Norm(V034.st.query);let rows=D.subjects.filter(s=>!q||v034Norm(`${s.name} ${s.rut||''} ${s.sector}`).includes(q));
 const value=s=>V034.st.sort==='events'?s.events.length:V034.st.sort==='uf'?s.events.reduce((a,e)=>a+(Number(e.amountUF)||0),0):V034.st.sort==='recent'?(v034Date(s.latest)?.getTime()||0):V034.st.sort==='links'?s.degree:s.ier.score;
 return rows.sort((a,b)=>value(b)-value(a));
}
function v034SearchCount(){
 const D=v034View(),q=v034Norm(V034.st.query);if(!q)return null;
 return D.subjects.filter(s=>v034Norm(`${s.name} ${s.rut||''} ${s.sector}`).includes(q)).length;
}
function v034Mount(){
 const root=content();
 root.innerHTML=`<div class="sv12" id="sv12-root">
   <div class="sv12-top">
     <div class="sv12-searchrow">
       <div class="sv12-searchintro"><span class="sv12-searchicon"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="5.5"/><path d="M16 16l4.25 4.25"/></svg></span><div><b>Consulta directa de entidad</b><small>Ingresa un RUT o razón social para revisar de inmediato su situación en el universo sancionatorio.</small></div></div>
       <div class="sv12-searchbox"><span>⌕</span><input id="sv12-search" type="search" placeholder="Buscar RUT o entidad… el listado se enfocará automáticamente"></div>
       <div class="sv12-searchresult" id="sv12-searchresult"></div>
     </div>
     <div class="sv12-filters">
       <div class="sv12-filter"><label>Universo</label><div id="sv12-group"><button data-v="ALL">Todas</button><button data-v="SO">SO inscritos</button><button data-v="OTHER">Otras entidades</button><button data-v="POTENTIAL">Potenciales SO</button></div></div>
       <div class="sv12-filter"><label>Período</label><div id="sv12-period"><button data-v="all">2020–2026</button><button data-v="24m">24 meses</button><button data-v="12m">12 meses</button><button data-v="${new Date().getFullYear()}">${new Date().getFullYear()} YTD</button><button data-v="${new Date().getFullYear()-1}">${new Date().getFullYear()-1}</button></div></div>
       <div class="sv12-filter"><label>Supervisor</label><div id="sv12-sups"></div></div>
     </div>
   </div>
   <div class="sv12-context"><span id="sv12-cut"></span><span><i class="so"></i>SO inscritos <i class="other"></i>Otras entidades <i class="potential"></i>Potenciales SO <small>(subconjunto de Otras entidades)</small></span></div>
   <div id="sv12-fresh"></div>
   <section class="sv12-kpis" id="sv12-kpis"></section>
   <section class="sv12-grid-main"><article class="sv12-panel"><header><div><b>Evolución temporal de sanciones</b><small>Frecuencia anual por condición observable.</small></div></header><div id="sv12-time"></div><div class="sv12-note" id="sv12-time-note"></div></article>
   <article class="sv12-panel"><header><div><b>Últimas sanciones · Top 5</b><small>Novedades según período, universo y supervisor activos.</small></div></header><div id="sv12-recent"></div></article></section>
   <section class="sv12-grid-2"><article class="sv12-panel"><header><div><b>Concentración sectorial</b><small>Sectores que concentran eventos; clic para filtrar.</small></div><div class="sv12-seg" id="sv12-sector-metric"><button data-v="events">Eventos</button><button data-v="subjects">Entidades</button><button data-v="uf">UF</button></div></header><div id="sv12-sector"></div><div class="sv12-note" id="sv12-sector-note"></div></article>
   <article class="sv12-panel"><header><div><b>Concentración regional de sanciones</b><small>Años arriba y regiones de norte a sur; clic para filtrar.</small></div></header><div id="sv12-region"></div><div class="sv12-note" id="sv12-region-note"></div></article></section>
   <section class="sv12-grid-2"><article class="sv12-panel"><header><div><b>Materias sancionatorias</b><small>Segundo clic sobre la misma materia elimina el filtro.</small></div></header><div id="sv12-category"></div></article>
   <article class="sv12-panel"><header><div><b>Sanciones por supervisor</b><small>Distribución por autoridad; compatible con selección múltiple.</small></div></header><div id="sv12-supervisor"></div></article></section>
   <div class="sv12-section-title" id="sv12-entities-anchor"><b>Entidades sancionadas</b><small>Condición, sector, recurrencia, magnitud, IER, recencia y materia.</small></div>
   <section class="sv12-panel sv12-list"><div class="sv12-listhead"><select id="sv12-sort"><option value="ier">Prioridad IER</option><option value="events">Más eventos</option><option value="uf">Mayor UF</option><option value="recent">Más reciente</option><option value="links">Más vínculos</option></select><div id="sv12-liststats"></div></div><div id="sv12-entitylist"></div></section>
   <details class="sv12-method"><summary>Metodología, actualización y trazabilidad</summary><div id="sv12-method"></div></details>
 </div><div class="sv12-tip" id="sv12-tip"></div><div class="sv12-overlay" id="sv12-overlay"></div><aside class="sv12-drawer" id="sv12-drawer"><div id="sv12-drawer-head"></div><div id="sv12-drawer-body"></div></aside>`;
 v034Bind();v034Render();
}
function v034ToggleButtons(id,value){
 document.querySelectorAll(`#${id} [data-v]`).forEach(b=>b.classList.toggle('on',b.dataset.v===value));
}
function v034BuildSupervisorButtons(){
 const sups=[...new Set(V034.data.events.map(e=>e.regulator).filter(Boolean))].sort();
 V034.st.sups=new Set(sups);
 v034El('sv12-sups').innerHTML=`<button data-v="ALL">Todos</button>${sups.map(s=>`<button data-v="${v034Esc(s)}">${v034Esc(V034_SUPERVISOR_LABELS[s]||s)}</button>`).join('')}`;
}
function v034Bind(){
 v034BuildSupervisorButtons();
 v034El('sv12-search').addEventListener('input',e=>{V034.st.query=e.target.value;v034RenderEntities(v034View());v034RenderSearch();if(e.target.value.trim())v034El('sv12-entities-anchor').scrollIntoView({behavior:'smooth',block:'start'});});
 v034El('sv12-sort').addEventListener('change',e=>{V034.st.sort=e.target.value;v034RenderEntities(v034View());});
 v034El('sv12-group').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;V034.st.group=b.dataset.v;v034Render();});
 v034El('sv12-period').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;V034.st.period=b.dataset.v;v034Render();});
 v034El('sv12-sups').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;const v=b.dataset.v,all=[...new Set(V034.data.events.map(x=>x.regulator).filter(Boolean))];if(v==='ALL')V034.st.sups=new Set(all);else if(V034.st.sups.size===all.length)V034.st.sups=new Set([v]);else if(V034.st.sups.has(v)){if(V034.st.sups.size>1)V034.st.sups.delete(v);}else V034.st.sups.add(v);v034Render();});
 v034El('sv12-sector-metric').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;V034.st.sectorMetric=b.dataset.v;v034RenderSector();});
 v034El('sv12-overlay').addEventListener('click',v034CloseDrawer);
}
function v034Render(){
 const D=v034View();v034RenderControls();v034RenderFresh();v034RenderKpis(D);v034RenderTime(D);v034RenderRecent();v034RenderSector();v034RenderRegion();v034RenderCategories();v034RenderSupervisors();v034RenderEntities(D);v034RenderSearch();v034RenderMethod();
}
function v034RenderControls(){
 v034ToggleButtons('sv12-group',V034.st.group);v034ToggleButtons('sv12-period',V034.st.period);v034ToggleButtons('sv12-sector-metric',V034.st.sectorMetric);
 const all=[...new Set(V034.data.events.map(e=>e.regulator).filter(Boolean))];
 document.querySelectorAll('#sv12-sups [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v==='ALL'?V034.st.sups.size===all.length:V034.st.sups.has(b.dataset.v)));
 const m=V034.data.meta;v034El('sv12-cut').innerHTML=`<b>Corte sanciones ${v034Esc(m.sourceLatest||m.materializedLatest||'—')}</b> · Workbench ${v034Esc(m.materializedLatest||'—')}`;
}
function v034RenderFresh(){
 const important=V034.data.degraded.filter(x=>!x.startsWith('Potencial SO'));
 if(!important.length){v034El('sv12-fresh').innerHTML='';return;}
 v034El('sv12-fresh').innerHTML=`<details class="sv12-fresh"><summary>Datos parcialmente actualizados · ${important.length} observación${important.length===1?'':'es'}</summary><div>${important.map(x=>`<p>${v034Esc(x)}</p>`).join('')}</div></details>`;
}
function v034RenderSearch(){
 const q=V034.st.query.trim(),box=v034El('sv12-searchresult');
 if(!q){box.innerHTML='';box.classList.remove('zero');return;}
 const n=v034SearchCount();box.classList.toggle('zero',n===0);box.innerHTML=`<span>${v034Fmt(n)} resultado${n===1?'':'s'}</span><small>N° de hallazgos para “${v034Esc(q)}”</small>`;
}
function v034RenderKpis(D){
 const so=D.subjects.filter(s=>s.isSO),other=D.subjects.filter(s=>!s.isSO),pot=other.filter(s=>s.potential.yes),ufEv=D.events.filter(e=>Number(e.amountUF)>0),uf=ufEv.reduce((a,e)=>a+Number(e.amountUF||0),0);
 const cards=[
  ['SO inscritos sancionados',so.length,`${v034Pct(so.length/(V034.data.uafTotal||1),2)} del registro UAF materializado`,'so'],
  ['Otras entidades sancionadas',other.length,`<b>${v034Fmt(pot.length)}</b> marcadas como Potenciales SO`,'other'],
  ['Eventos sancionatorios',D.events.length,`<b>${v034Fmt(D.events.filter(e=>e.laft).length)}</b> con materia LA/FT directa`,'events'],
  ['Magnitud publicada',`${v034Fmt(uf)} UF`,`monto UF disponible en ${v034Pct(ufEv.length/(D.events.length||1),0)} de los eventos visibles`,'uf']
 ];
 v034El('sv12-kpis').innerHTML=cards.map(([l,v,d,c])=>`<article class="${c}"><span>${l}</span><b>${typeof v==='number'?v034Fmt(v):v}</b><small>${d}</small></article>`).join('');
}
function v034Segment(events){
 const r={so:0,potential:0,other:0,ufSo:0,ufPotential:0,ufOther:0};
 for(const e of events){const s=V034.data.subjects.find(x=>x.events.some(y=>y.id===e.id));const uf=Number(e.amountUF)||0;if(s?.isSO){r.so++;r.ufSo+=uf}else if(s?.potential.yes){r.potential++;r.ufPotential+=uf}else{r.other++;r.ufOther+=uf;}}
 return r;
}
function v034RenderTime(D){
 const years=[];for(let y=2020;y<=new Date().getFullYear();y++)years.push(y);
 const data=years.map(y=>{const ev=D.events.filter(e=>Number(String(e.date).slice(0,4))===y),s=v034Segment(ev);return {y,...s,total:ev.length};});
 const max=Math.max(1,...data.map(x=>x.total)),w=720,h=220,pl=36,pb=30,pt=12,pr=12,iw=w-pl-pr,ih=h-pt-pb,gap=iw/data.length,bw=Math.min(48,gap*.62);let svg='';
 for(const f of [.25,.5,.75,1]){const y=pt+ih-f*ih;svg+=`<line x1="${pl}" y1="${y}" x2="${w-pr}" y2="${y}" class="grid"/><text x="${pl-5}" y="${y+3}" class="axis" text-anchor="end">${v034Fmt(max*f)}</text>`;}
 data.forEach((r,i)=>{const x=pl+i*gap+(gap-bw)/2,vals=[r.other,r.potential,r.so],cls=['other','potential','so'];let y=pt+ih;vals.forEach((v,j)=>{const hh=v/max*ih;y-=hh;svg+=`<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(0,hh)}" rx="4" class="${cls[j]}"><title>${r.y} · ${v034Fmt(v)}</title></rect>`});svg+=`<text x="${x+bw/2}" y="${h-9}" class="axis" text-anchor="middle">${r.y}</text>`;});
 v034El('sv12-time').innerHTML=`<svg viewBox="0 0 ${w} ${h}">${svg}</svg>`;
 const total=data.reduce((a,b)=>a+b.total,0),latest=data.filter(x=>x.total).at(-1);v034El('sv12-time-note').innerHTML=latest?`En ${latest.y} se observan <b>${v034Fmt(latest.total)}</b> eventos dentro del filtro actual. Total período: <b>${v034Fmt(total)}</b>.`:'Sin eventos en el período activo.';
}
function v034RecentView(){
 const [a,z]=v034PeriodRange(V034.st.period);
 const subjectKeys=new Set(V034.data.subjects.filter(s=>v034GroupOk(s,V034.st.group)).map(s=>s.key));
 return V034.data.events.filter(e=>{const d=v034Date(e.date);if(!d||d<a||d>z||!V034.st.sups.has(e.regulator))return false;const k=e.entityId?`E:${e.entityId}`:e.rut?`R:${e.rut}`:`N:${v034Norm(e.name)}`;return subjectKeys.has(k);}).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
}
function v034RenderRecent(){
 const rows=v034RecentView(),box=v034El('sv12-recent');if(!rows.length){box.innerHTML='<div class="sv12-empty">Sin novedades con estos filtros.</div>';return;}
 box.innerHTML=rows.map((e,i)=>{const s=V034.data.subjects.find(x=>x.events.some(y=>y.id===e.id));return `<button class="sv12-recent" data-key="${v034Esc(s?.key||'')}"><em>${i+1}</em><span><small>${v034Esc(e.date)} · ${v034Esc(e.regulator)}</small><b>${v034Esc(s?.name||e.name)}</b><span>${v034Esc(e.category)}${e.resolution?` · Res. ${v034Esc(e.resolution)}`:''}</span><i>${s?v034Badges(s):''}</i></span><strong>${e.amountUF?`${v034Fmt(e.amountUF)} UF`:'—'}</strong></button>`}).join('');
 box.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('click',()=>v034OpenDrawer(b.dataset.key)));
}
function v034SectorStats(D){
 const M=new Map();for(const s of D.subjects){const k=s.sector||'Sin sector';if(!M.has(k))M.set(k,{sector:k,subjects:0,events:0,uf:0,so:0,potential:0,other:0});const r=M.get(k);r.subjects++;r.events+=s.events.length;r.uf+=s.events.reduce((a,e)=>a+(Number(e.amountUF)||0),0);if(s.isSO)r.so++;else if(s.potential.yes)r.potential++;else r.other++;}
 return [...M.values()].sort((a,b)=>b.events-a.events);
}
function v034RenderSector(){
 const D=v034View({ignoreSector:true}),rows=v034SectorStats(D),metric=V034.st.sectorMetric,get=r=>metric==='subjects'?r.subjects:metric==='uf'?r.uf:r.events,shown=rows.filter(r=>get(r)>0).sort((a,b)=>get(b)-get(a)).slice(0,10),box=v034El('sv12-sector');
 if(!shown.length){box.innerHTML='<div class="sv12-empty">Sin sectores para mostrar.</div>';return;}
 const w=690,h=shown.length*28+18,lw=245,rw=62,iw=w-lw-rw,max=Math.max(1,...shown.map(get));let svg='';
 shown.forEach((r,i)=>{const y=8+i*28,bw=get(r)/max*iw;svg+=`<text x="0" y="${y+13}" class="axis">${v034Esc(String(r.sector).slice(0,39))}</text><rect data-sector="${v034Esc(r.sector)}" x="${lw}" y="${y+3}" width="${bw}" height="13" rx="6" class="sector ${V034.st.sector===r.sector?'active':''}"/><text x="${w-rw+8}" y="${y+13}" class="axis value">${v034Fmt(get(r))}${metric==='uf'?' UF':''}</text>`;});
 box.innerHTML=`<svg viewBox="0 0 ${w} ${h}">${svg}</svg>`;box.querySelectorAll('[data-sector]').forEach(x=>x.addEventListener('click',()=>{V034.st.sector=V034.st.sector===x.dataset.sector?'all':x.dataset.sector;v034Render();}));
 const total=rows.reduce((a,r)=>a+get(r),0)||1,top3=shown.slice(0,3).reduce((a,r)=>a+get(r),0);v034El('sv12-sector-note').innerHTML=`Los tres primeros sectores explican <b>${v034Pct(top3/total,1)}</b> del ${metric==='events'?'volumen de eventos':metric==='subjects'?'conjunto de entidades':'monto UF publicado'}.`;
}
