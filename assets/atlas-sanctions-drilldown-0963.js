'use strict';
/* ATLAS AML · Sanciones dynamic drilldown 0.96.3
 * Adds explainable drill-through for findings and replaces the territory renderer
 * with an ATLAS-native, CSP-safe regional ranking. Does not mutate source data.
 */
(function atlasSanctionsDrilldown0963(){
  const VERSION='0.96.3';
  let raf=0,observer=null,updating=false,lastRegionSig='';
  const nf=new Intl.NumberFormat('es-CL');
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:1})}%`;
  const fmt=v=>nf.format(Math.round(Number(v)||0));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=v=>{try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const key=e=>String(e?._entityKey||e?.entity_key||e?.entity_id||e?.rut||e?.source_entity_name||e?.event_id||'');
  const state=()=>window.ATLAS_SANCTIONS_CURRENT?.state||null;
  const date=v=>{const s=String(v||'').slice(0,10),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:(s||'—')};
  const amount=e=>{const uf=Number(e?.amount_uf),clp=Number(e?.amount_clp);if(Number.isFinite(uf))return `${fmt(uf)} UF`;if(Number.isFinite(clp))return `$${fmt(clp)}`;return 'Monto no publicado'};
  const condition=e=>e?.is_uaf_registered?'SO inscrito':e?.is_potential_screening?'Potencial SO':(e?.current_condition||'No observado');

  function currentEvents(){
    const S=state();if(!S)return [];
    const f=S.filters||{},q=norm(f.q);
    return (S.events||[]).filter(e=>{
      if(f.year&&String(e.event_year)!==String(f.year))return false;
      if(f.regulator&&e.regulator!==f.regulator)return false;
      if(f.region&&(e._region||e.region||'')!==f.region)return false;
      if(f.scope==='unified'&&!e.in_unified_universe)return false;
      if(f.condition==='SO_REGISTERED'&&!e.is_uaf_registered)return false;
      if(f.condition==='POTENTIAL_SO_CURRENT'&&!e.is_potential_screening)return false;
      if(f.condition==='OTHER'&&(e.is_uaf_registered||e.is_potential_screening))return false;
      if(f.sector&&(e.uaf_sector||'Sin sector UAF')!==f.sector)return false;
      if(q&&!norm([e.canonical_name,e.source_entity_name,e.rut,e.reason,e.resolution_ref,e.event_kind,e.regulator,e.uaf_sector,e._region,e.region].join(' ')).includes(q))return false;
      return true;
    });
  }
  function groups(D,fn){const m=new Map();for(const e of D){const k=fn(e);if(!k)continue;m.set(k,(m.get(k)||0)+1)}return [...m].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value||String(a.key).localeCompare(String(b.key),'es'));}
  function entityCount(D){return new Set(D.map(key).filter(Boolean)).size;}
  function groupedEntities(D){const m=new Map();for(const e of D){const k=key(e);if(!k)continue;const a=m.get(k)||[];a.push(e);m.set(k,a)}return m;}

  function ensureDrawer(){
    let shade=document.querySelector('.san963-shade'),drawer=document.querySelector('.san963-drawer');
    if(!shade){shade=document.createElement('div');shade.className='san963-shade';shade.hidden=true;document.body.appendChild(shade);}
    if(!drawer){drawer=document.createElement('aside');drawer.className='san963-drawer';drawer.hidden=true;drawer.setAttribute('aria-live','polite');document.body.appendChild(drawer);}
    shade.onclick=closeDrawer;
    return {shade,drawer};
  }
  function closeDrawer(){const {shade,drawer}=ensureDrawer();shade.hidden=true;drawer.hidden=true;drawer.innerHTML='';}
  function openDrawer(title,subtitle,D,context=''){
    const {shade,drawer}=ensureDrawer();
    const rows=[...D].sort((a,b)=>String(b.event_date||'').localeCompare(String(a.event_date||'')));
    const regs=[...new Set(rows.map(e=>e.regulator).filter(Boolean))];
    const docs=rows.filter(e=>safeUrl(e.document_url)).length;
    drawer.innerHTML=`<div class="san963-drawer-head"><div><span class="san963-drawer-kicker">DRILL-DOWN · SANCIONES</span><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><button type="button" class="san963-close" aria-label="Cerrar">×</button></div><div class="san963-drawer-summary"><div><span>Eventos</span><b>${fmt(rows.length)}</b></div><div><span>Entidades</span><b>${fmt(entityCount(rows))}</b></div><div><span>Supervisores</span><b>${fmt(regs.length)}</b></div><div><span>Documentos</span><b>${fmt(docs)}</b></div></div><div class="san963-drawer-list">${rows.length?rows.slice(0,250).map(e=>{const url=safeUrl(e.document_url);return `<article class="san963-event"><div class="san963-event-date">${esc(date(e.event_date))}</div><span class="san963-source ${esc(e.regulator||'')}">${esc(e.regulator||'—')}</span><div class="san963-event-main"><b>${esc(e.canonical_name||e.source_entity_name||'Identidad no conciliada')}</b><small>${esc([e.rut,e._region||e.region,e.uaf_sector||condition(e),e.regulator==='CGR'?'Enforcement':e.event_kind].filter(Boolean).join(' · '))}</small></div><div class="san963-event-side"><b>${esc(amount(e))}</b>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Abrir documento ↗</a>`:''}</div></article>`}).join(''):'<div class="san963-empty">No hay eventos detrás de este hallazgo para el corte actual.</div>'}${rows.length>250?`<div class="san963-empty">Se muestran 250 de ${fmt(rows.length)} eventos. Use los filtros de Sanciones para acotar el universo.</div>`:''}</div>`;
    drawer.querySelector('.san963-close')?.addEventListener('click',closeDrawer);
    shade.hidden=false;drawer.hidden=false;
    drawer.dataset.context=context||'';
  }

  function findingData(kind,D){
    const em=groupedEntities(D);
    if(kind==='recurrent'){
      const recurrent=new Set([...em].filter(([,rows])=>rows.length>1).map(([k])=>k));
      return {title:'Reincidencia observada',subtitle:'Eventos pertenecientes a entidades con más de una sanción/acción en el corte actual.',rows:D.filter(e=>recurrent.has(key(e)))};
    }
    if(kind==='region'){
      const top=groups(D.filter(e=>e._region||e.region),e=>e._region||e.region)[0];
      return {title:top?`Concentración regional · ${top.key}`:'Concentración regional',subtitle:'Sanciones y acciones que explican la principal concentración territorial del corte.',rows:top?D.filter(e=>(e._region||e.region)===top.key):[]};
    }
    if(kind==='supervisor'){
      const top=groups(D,e=>e.regulator)[0];
      return {title:top?`Supervisor dominante · ${top.key}`:'Supervisor dominante',subtitle:'Eventos asociados al supervisor con mayor presencia en el corte actual.',rows:top?D.filter(e=>e.regulator===top.key):[]};
    }
    if(kind==='sector'){
      const base=D.filter(e=>(e.is_uaf_registered||e.is_potential_screening)&&e.uaf_sector),top=groups(base,e=>e.uaf_sector)[0];
      return {title:top?`Sector con mayor exposición · ${top.key}`:'Sector con mayor exposición',subtitle:'Eventos del sector UAF con mayor presencia entre SO y potenciales SO observados.',rows:top?base.filter(e=>e.uaf_sector===top.key):[]};
    }
    if(kind==='multisource'){
      const multi=new Set([...em].filter(([,rows])=>new Set(rows.map(e=>e.regulator)).size>1).map(([k])=>k));
      return {title:'Cruce entre supervisores',subtitle:'Entidades que aparecen en más de una fuente/supervisor y todos los eventos vinculados a ellas.',rows:D.filter(e=>multi.has(key(e)))};
    }
    if(kind==='documents')return {title:'Trazabilidad documental',subtitle:'Eventos del corte con documento público materializado y disponible para revisión.',rows:D.filter(e=>safeUrl(e.document_url))};
    return {title:'Hallazgo',subtitle:'Eventos que explican el hallazgo seleccionado.',rows:[]};
  }

  function decorateFindings(root,D){
    const cards=[...root.querySelectorAll('.san96-findings .san96-finding')];
    const kinds=['recurrent','region','supervisor','sector','multisource','documents'];
    cards.forEach((card,i)=>{
      const kind=kinds[i]||'generic';
      card.dataset.san963Finding=kind;card.setAttribute('role','button');card.setAttribute('tabindex','0');
      if(!card.querySelector('.san963-finding-action')){const a=document.createElement('span');a.className='san963-finding-action';a.textContent='Ver sanciones detrás del hallazgo →';card.appendChild(a);}
      if(!card.dataset.san963Bound){const open=()=>{const x=findingData(kind,currentEvents());openDrawer(x.title,x.subtitle,x.rows,`finding:${kind}`);};card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});card.dataset.san963Bound='1';}
    });
  }

  function applyRegionFilter(region){
    const select=document.getElementById('san96Region');
    if(!select)return;
    select.value=region;select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function renderRegions(root,D){
    const host=root.querySelector('#san96Regions');if(!host)return;
    const observable=D.filter(e=>e._region||e.region),rows=groups(observable,e=>e._region||e.region),top=rows.slice(0,12),total=observable.length;
    const sig=JSON.stringify([rows.map(x=>[x.key,x.value]),state()?.filters||{}]);
    if(sig===lastRegionSig&&host.querySelector('.san963-region-list'))return;lastRegionSig=sig;
    if(!top.length){host.innerHTML='<div class="san96-empty">Sin región observable para el corte actual.</div>';return;}
    const max=Math.max(1,...top.map(x=>x.value));
    host.innerHTML=`<div class="san963-region-list">${top.map((x,i)=>`<div class="san963-region-row" role="button" tabindex="0" data-san963-region="${esc(x.key)}" aria-label="${esc(x.key)}: ${fmt(x.value)} eventos, ${pct(100*x.value/total)}"><span class="san963-region-rank">${i+1}</span><span class="san963-region-name" title="${esc(x.key)}">${esc(x.key)}</span><span class="san963-region-track"><progress class="san963-region-progress" max="${max}" value="${x.value}"></progress></span><span class="san963-region-count">${fmt(x.value)}</span><span class="san963-region-pct">${pct(100*x.value/total)}</span></div>`).join('')}</div><div class="san963-region-foot"><span>Mostrando ${fmt(top.length)} de ${fmt(rows.length)} regiones observadas.</span><b>Clic en una región: ver sanciones y profundizar.</b></div>`;
    host.querySelectorAll('[data-san963-region]').forEach(row=>{
      const open=()=>{const region=row.dataset.san963Region||'',regional=D.filter(e=>(e._region||e.region)===region);openDrawer(`Concentración regional · ${region}`,`${fmt(regional.length)} eventos observados en ${region}. Desde esta vista puede revisar las sanciones que explican la concentración.`,regional,`region:${region}`);};
      row.addEventListener('click',open);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
      row.addEventListener('dblclick',()=>applyRegionFilter(row.dataset.san963Region||''));
    });
  }

  function decorate(){
    const root=document.querySelector('.san96');if(!root)return null;
    updating=true;
    try{const D=currentEvents();renderRegions(root,D);decorateFindings(root,D);root.dataset.sanctionsDrilldown='0963';window.__ATLAS_SANCTIONS_DRILLDOWN__={status:'ready',version:VERSION,events:D.length,regionRows:root.querySelectorAll('.san963-region-row').length,findings:root.querySelectorAll('[data-san963-finding]').length,checkedAt:new Date().toISOString()};return window.__ATLAS_SANCTIONS_DRILLDOWN__;}
    finally{updating=false;}
  }
  function queue(){if(raf||updating)return;raf=requestAnimationFrame(()=>{raf=0;decorate();});}
  function observe(){if(observer)return;const target=document.querySelector('#content')||document.body||document.documentElement;observer=new MutationObserver(records=>{if(updating)return;if(records.some(r=>r.addedNodes.length||r.removedNodes.length||r.type==='characterData'))queue();});observer.observe(target,{subtree:true,childList:true,characterData:true});}
  function boot(){observe();queue();setTimeout(queue,60);setTimeout(queue,220);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('atlas:nav-refresh',queue);window.addEventListener('atlas:routechange',queue);window.addEventListener('atlas:themechange',queue);window.addEventListener('pageshow',queue);window.addEventListener('atlas:sanctions-radiography:ready',queue);
  window.ATLAS_SANCTIONS_DRILLDOWN={version:VERSION,refresh:decorate,openFinding:kind=>{const x=findingData(kind,currentEvents());openDrawer(x.title,x.subtitle,x.rows,`finding:${kind}`);},health:()=>window.__ATLAS_SANCTIONS_DRILLDOWN__||null};
})();
