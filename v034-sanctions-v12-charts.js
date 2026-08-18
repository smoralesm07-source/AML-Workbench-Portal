'use strict';
function v034RenderRegion(){
 const D=v034View({ignoreRegion:true}),years=[];for(let y=2020;y<=new Date().getFullYear();y++)years.push(y);
 const regions=V034_REGIONS.map(([name])=>name),rows=regions.map(region=>({region,cells:years.map(year=>{const subjects=D.subjects.filter(s=>s.region===region),events=subjects.flatMap(s=>s.events).filter(e=>Number(String(e.date).slice(0,4))===year);return {year,n:events.length};})}));
 const visibleRows=rows;const max=Math.max(1,...visibleRows.flatMap(r=>r.cells.map(c=>c.n))),left=210,cw=55,ch=26,top=26,w=left+years.length*cw+8,h=top+visibleRows.length*ch+8;let svg='';
 years.forEach((y,i)=>svg+=`<text x="${left+i*cw+(cw-4)/2}" y="15" class="axis" text-anchor="middle">${y}</text>`);
 visibleRows.forEach((r,ri)=>{const y=top+ri*ch,active=V034.st.region===r.region;svg+=`<text x="0" y="${y+16}" class="axis region ${active?'active':''}" data-region="${v034Esc(r.region)}">${v034Esc(r.region)}</text>`;r.cells.forEach((c,ci)=>{const x=left+ci*cw,t=c.n/max,op=c.n?(.12+.72*t):.04;svg+=`<rect data-region="${v034Esc(r.region)}" x="${x}" y="${y}" width="${cw-4}" height="${ch-4}" rx="5" class="heat ${active?'active':''}" style="--op:${op}"></rect>${c.n?`<text x="${x+(cw-4)/2}" y="${y+15}" class="axis heatv" text-anchor="middle">${c.n}</text>`:''}`;});});
 v034El('sv12-region').innerHTML=`<svg viewBox="0 0 ${w} ${h}">${svg}</svg>`;v034El('sv12-region').querySelectorAll('[data-region]').forEach(x=>x.addEventListener('click',()=>{V034.st.region=V034.st.region===x.dataset.region?'all':x.dataset.region;v034Render();}));
 const covered=D.subjects.filter(s=>s.region!=='Sin región observable').length;v034El('sv12-region-note').innerHTML=`Cobertura territorial observable: <b>${v034Pct(covered/(D.subjects.length||1),0)}</b> de las entidades visibles. La región se usa sólo cuando existe evidencia territorial en los datos disponibles.`;
}
function v034CategoryStats(D){
 const M=new Map();for(const e of D.events){const c=e.category||'Sin categoría';if(!M.has(c))M.set(c,{c,n:0});M.get(c).n++;}return [...M.values()].sort((a,b)=>b.n-a.n);
}
function v034RenderCategories(){
 const D=v034View({ignoreCategory:true}),rows=v034CategoryStats(D).slice(0,8),box=v034El('sv12-category');if(!rows.length){box.innerHTML='<div class="sv12-empty">Sin materias.</div>';return;}
 const w=690,h=rows.length*29+14,lw=265,rw=42,iw=w-lw-rw,max=Math.max(...rows.map(r=>r.n),1);let svg='';
 rows.forEach((r,i)=>{const y=6+i*29,bw=r.n/max*iw;svg+=`<text x="0" y="${y+14}" class="axis">${v034Esc(r.c.slice(0,43))}</text><rect data-cat="${v034Esc(r.c)}" x="${lw}" y="${y+4}" width="${bw}" height="13" rx="6" class="category ${V034.st.category===r.c?'active':''}"></rect><text x="${w-rw+5}" y="${y+14}" class="axis value">${r.n}</text>`;});
 box.innerHTML=`<svg viewBox="0 0 ${w} ${h}">${svg}</svg>`;box.querySelectorAll('[data-cat]').forEach(x=>x.addEventListener('click',()=>{V034.st.category=V034.st.category===x.dataset.cat?'all':x.dataset.cat;v034Render();}));
}
function v034RenderSupervisors(){
 const D=v034View({ignoreSupervisor:true}),M=new Map();for(const e of D.events)M.set(e.regulator,(M.get(e.regulator)||0)+1);const rows=[...M.entries()].sort((a,b)=>b[1]-a[1]),box=v034El('sv12-supervisor');if(!rows.length){box.innerHTML='<div class="sv12-empty">Sin supervisores.</div>';return;}
 const w=690,h=210,pl=48,pb=33,pt=10,pr=15,iw=w-pl-pr,ih=h-pt-pb,max=Math.max(...rows.map(x=>x[1]),1),gap=iw/rows.length,bw=Math.min(72,gap*.58);let svg='';
 rows.forEach(([name,n],i)=>{const x=pl+i*gap+(gap-bw)/2,hh=n/max*ih,y=pt+ih-hh;svg+=`<rect data-sup="${v034Esc(name)}" x="${x}" y="${y}" width="${bw}" height="${hh}" rx="5" class="supervisor ${V034.st.sups.size===1&&V034.st.sups.has(name)?'active':''}"></rect><text x="${x+bw/2}" y="${h-10}" class="axis" text-anchor="middle">${v034Esc(name)}</text>`;});
 box.innerHTML=`<svg viewBox="0 0 ${w} ${h}">${svg}</svg>`;box.querySelectorAll('[data-sup]').forEach(x=>x.addEventListener('click',()=>{const all=[...new Set(V034.data.events.map(e=>e.regulator).filter(Boolean))],s=x.dataset.sup;V034.st.sups=V034.st.sups.size===1&&V034.st.sups.has(s)?new Set(all):new Set([s]);v034Render();}));
}
function v034IerHelp(s=null){
 const generic='<b>IER · Índice de Exposición Relativa</b><br>Prioriza entidades entre 0 y 100. Se recalcula con la evidencia visible y no representa probabilidad de LA/FT.<br><br><b>Factores:</b> recurrencia, severidad, materia LA/FT, convergencia supervisora, recencia, vínculos documentales y señal de brecha.';
 if(!s)return generic;return `${generic}<br><br><b>${v034Esc(s.name)}</b> · ${v034Fmt1(s.ier.score)} (${v034Esc(s.ier.band)})<br>${s.ier.factors.filter(x=>x[1]>0).map(x=>`• ${v034Esc(x[0])}: ${v034Fmt1(x[1])}/${x[2]}`).join('<br>')}`;
}
function v034Tip(e,html){const t=v034El('sv12-tip');t.innerHTML=html;t.classList.add('on');let x=e.clientX+12,y=e.clientY+12;if(x+330>innerWidth)x=e.clientX-330;if(y+210>innerHeight)y=e.clientY-200;t.style.left=`${x}px`;t.style.top=`${y}px`;}
function v034HideTip(){v034El('sv12-tip').classList.remove('on');}
function v034RenderEntities(D){
 const rows=v034FilteredEntities(D),so=rows.filter(s=>s.isSO).length,other=rows.filter(s=>!s.isSO).length,pot=rows.filter(s=>s.potential.yes).length;
 v034El('sv12-liststats').innerHTML=`<span><b>${v034Fmt(rows.length)}</b> entidades</span><span><b>${v034Fmt(so)}</b> SO inscritos</span><span><b>${v034Fmt(other)}</b> otras</span><span><b>${v034Fmt(pot)}</b> Potenciales SO</span>`;
 const box=v034El('sv12-entitylist');if(!rows.length){box.innerHTML='<div class="sv12-empty">No hay entidades que cumplan los filtros.</div>';return;}
 box.innerHTML=`<div class="sv12-row head"><span>Entidad</span><span>Condición</span><span>Sector / supervisor</span><span class="center">Eventos</span><span class="center">UF</span><span class="center ier-help">IER <i>i</i></span><span class="center">Última</span><span>Materia más reciente</span></div>${rows.slice(0,300).map(s=>{const ev=[...s.events].sort((a,b)=>String(b.date).localeCompare(String(a.date))),last=ev[0]||{},uf=ev.reduce((a,e)=>a+(Number(e.amountUF)||0),0);return `<button class="sv12-row" data-key="${v034Esc(s.key)}"><span><b>${v034Esc(s.name)}</b><small>${v034Esc(s.rut||'RUT no publicado')} · ${v034Fmt(s.degree)} vínculos</small></span><span>${v034Badges(s)}</span><span>${v034Esc(s.sector)}<small>${v034Esc(s.supervisors.join(' / ')||'—')}</small></span><span class="center">${s.events.length}</span><span class="center">${uf?v034Fmt(uf):'—'}</span><span class="center ier-cell" data-ier="${v034Esc(s.key)}"><em class="${v034StyleBand(s.ier.score)}">${v034Fmt1(s.ier.score)}</em><i class="meter"><i style="width:${s.ier.score}%"></i></i></span><span class="center">${v034Esc(last.date||'—')}</span><span>${v034Esc(last.category||'Sin categoría')}<small>${last.resolution?`Res. ${v034Esc(last.resolution)}`:''}</small></span></button>`}).join('')}`;
 box.querySelectorAll('.sv12-row[data-key]').forEach(x=>x.addEventListener('click',e=>{if(e.target.closest('[data-ier]'))return;v034OpenDrawer(x.dataset.key);}));
 box.querySelector('.ier-help')?.addEventListener('mousemove',e=>v034Tip(e,v034IerHelp()));box.querySelector('.ier-help')?.addEventListener('mouseleave',v034HideTip);
 box.querySelectorAll('[data-ier]').forEach(x=>{x.addEventListener('mousemove',e=>v034Tip(e,v034IerHelp(V034.data.subjects.find(s=>s.key===x.dataset.ier))));x.addEventListener('mouseleave',v034HideTip);});
}
function v034OpenDrawer(key){
 const s=V034.data.subjects.find(x=>x.key===key);if(!s)return;
 const head=v034El('sv12-drawer-head'),body=v034El('sv12-drawer-body');
 head.innerHTML=`<button class="sv12-close">×</button>${v034Badges(s)} <em class="sv12-ierbadge ${v034StyleBand(s.ier.score)}">IER ${v034Fmt1(s.ier.score)} · ${v034Esc(s.ier.band)} <i>i</i></em><h2>${v034Esc(s.name)}</h2><p>${v034Esc(s.rut||'RUT no publicado')} · ${v034Esc(s.sector)} · ${v034Esc(s.supervisors.join(' / '))}</p>`;
 body.innerHTML=`<div class="sv12-drawer-grid"><div class="sv12-score"><b>${v034Fmt1(s.ier.score)}</b><span>IER / 100</span></div><div class="sv12-status"><b>Lectura de condición</b><p>${s.isSO?'Figura inscrito en UAF y además presenta sanciones en las fuentes capturadas.':s.potential.yes?v034Esc(s.potential.reason):'No figura inscrito en UAF y no reúne evidencia suficiente para marcar Potencial SO.'}</p></div></div>
 <h3>Factores del IER</h3><div class="sv12-factors">${s.ier.factors.map(([l,v,m])=>`<div><span>${v034Esc(l)}</span><i><i style="width:${Math.min(100,100*v/m)}%"></i></i><b>${v034Fmt1(v)}/${m}</b></div>`).join('')}</div>
 <h3>Línea temporal de sanciones</h3><div class="sv12-events">${[...s.events].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(e=>`<article><small>${v034Esc(e.date)} · ${v034Esc(e.regulator)}</small><b>${v034Esc(e.resolution?`Resolución ${e.resolution}`:'Evento sancionatorio')}</b><p>${v034Esc(e.subject||e.category)}</p><span>${v034Esc(e.category)}${e.laft?' · LA/FT directa':''}${e.amountUF?` · ${v034Fmt(e.amountUF)} UF`:''}</span>${e.sourceUrl?`<a href="${v034Esc(e.sourceUrl)}" target="_blank" rel="noopener">Abrir fuente ↗</a>`:''}</article>`).join('')}</div>
 ${s.potential.yes?'<div class="sv12-warning">“Potencial SO” es una marca de screening para revisión y no constituye una determinación jurídica ni una imputación de incumplimiento.</div>':''}`;
 head.querySelector('.sv12-close').addEventListener('click',v034CloseDrawer);head.querySelector('.sv12-ierbadge').addEventListener('mousemove',e=>v034Tip(e,v034IerHelp(s)));head.querySelector('.sv12-ierbadge').addEventListener('mouseleave',v034HideTip);
 v034El('sv12-overlay').classList.add('on');v034El('sv12-drawer').classList.add('on');
}
function v034CloseDrawer(){v034El('sv12-overlay')?.classList.remove('on');v034El('sv12-drawer')?.classList.remove('on');}
function v034RenderMethod(){
 const m=V034.data.meta;v034El('sv12-method').innerHTML=`<div><b>Autoridad de datos.</b> Radar Sanciones gobierna eventos; la conciliación UAF del Workbench gobierna la condición “SO inscrito”. “Potencial SO” es sólo screening y no una determinación jurídica. El IER se recalcula cada vez que cambian los datos.</div><div><b>Actualización.</b> Fuente sanciones: ${v034Esc(m.sourceGenerated||'fecha no disponible')} · último evento ${v034Esc(m.sourceLatest||'—')}. Materialización Workbench: último evento ${v034Esc(m.materializedLatest||'—')} · actualización ${v034Esc(m.materializedUpdated||'—')}.</div><div><b>Degradación explícita.</b> Si Radar Sanciones o la materialización gobernada falla, la vista informa el estado. Si el registro UAF no está disponible, la vista no intenta clasificar SO y vuelve a la sección anterior.</div><div><b>Límite SII.</b> La actividad económica/ACTECO puede aportar screening, pero no acredita por sí sola calidad jurídica de sujeto obligado. En esta versión no existe confirmación automática RUT↔ACTECO.</div>`;
}
async function v034Load(){
 state.view='sanctions';shell('Sanciones','Situación de SO inscritos y otras entidades dentro del universo sancionatorio, con temporalidad, concentración, magnitud y trazabilidad.');
 const root=content();root.innerHTML='<div class="sv12-loading"><b>Radar Sanciones</b><span>Sincronizando eventos, identidad gobernada y registro UAF…</span></div>';
 try{
   const data=await v034LoadData();
   V034={data,st:{period:'all',group:'ALL',sups:new Set(),category:'all',sector:'all',region:'all',query:'',sort:'ier',sectorMetric:'events'}};
   v034Mount();
 }catch(e){
   root.innerHTML=`<div class="sv12-load-error"><b>No fue posible construir la vista sancionatoria v12</b><p>${v034Esc(e?.message||String(e))}</p>${v034LegacyLoadSanctions?'<button id="sv12-legacy">Abrir vista sanciones anterior</button>':''}</div>`;
   v034El('sv12-legacy')?.addEventListener('click',()=>v034LegacyLoadSanctions());
 }
}
if(typeof loadSanctions==='function')loadSanctions=v034Load;
window.AML_SANCTIONS_V12={version:V034_VERSION,reload:v034Load};
