'use strict';

/* ATLAS AML · Sanciones · Radiografía sancionatoria de Chile 0.96.0
 * Usuario principal: Fiscalización UAF.
 * Universo evaluado: padrón SII + padrón UAF + padrón OSFL, deduplicado por RUT.
 * Fuentes: CMF, UAF, SCJ + acciones de enforcement CGR con semántica separada.
 */
(function atlasSanctionsRadiography0960(){
  if(window.ATLAS_SANCTIONS_CURRENT?.version==='0.96.0') return;
  const VERSION='0.96.0',BUILD='0960',AUTH='SANCTIONS_RADIOGRAPHY_CURRENT_0960';
  const V={
    overview:'aml_v_sanctions_overview_current_v0960',
    events:'aml_v_sanctions_radiography_current_v0960',
    sources:'aml_sanctions_source_snapshot_v0960',
    universe:'aml_v_sanctions_universe_summary_current_v0960'
  };
  const PAGE=1000,MAX=5000;
  const S={events:[],overview:null,sources:[],universe:null,loading:false,error:null,selected:null,filters:{year:'',regulator:'',region:'',condition:'',sector:'',mix:'',scope:'',q:''}};
  const nf=new Intl.NumberFormat('es-CL');
  const clp=new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const fmt=v=>num(v)==null?'—':nf.format(Math.round(num(v)));
  const pct=v=>num(v)==null?'—':`${num(v).toLocaleString('es-CL',{maximumFractionDigits:1})}%`;
  const money=v=>num(v)==null?'—':clp.format(num(v));
  const date=v=>v?String(v).slice(0,10):'—';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();
  const safeUrl=v=>{try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const host=()=>document.querySelector('#content');
  const sourceColor={CMF:'var(--s96-cmf)',UAF:'var(--s96-uaf)',SCJ:'var(--s96-scj)',CGR:'var(--s96-cgr)'};
  const sourceName={CMF:'Comisión para el Mercado Financiero',UAF:'Unidad de Análisis Financiero',SCJ:'Superintendencia de Casinos de Juego',CGR:'Contraloría General de la República'};
  const conditionLabel=v=>({SO_REGISTERED:'SO inscrito',POTENTIAL_SO_CURRENT:'Potencial SO',OTHER_SANCTIONED_ENTITY:'Otra entidad',OTHER_CGR_ENFORCEMENT_ENTITY:'Otra entidad',UNRESOLVED_IDENTITY:'Identidad no conciliada'}[v]||v||'No observado');
  const mixOf=e=>e.is_osfl_observed&&e.is_res_observed?'OSFL + RES':e.is_osfl_observed?'OSFL':e.is_res_observed?'RES':'OTRAS ENTIDADES';
  const entry=()=>window.__ATLAS_ENTITY_ENTRY__||null;

  async function page(table,select='*',order=null,ascending=false){
    const c=db();if(!c)throw new Error('Sesión de datos no disponible');
    const out=[];let from=0;
    for(;;){
      let q=c.from(table).select(select).range(from,Math.min(from+PAGE-1,MAX-1));
      if(order)q=q.order(order,{ascending,nullsFirst:false});
      const r=await q;if(r.error)throw r.error;
      const rows=r.data||[];out.push(...rows);
      if(rows.length<PAGE||out.length>=MAX)break;from+=PAGE;
    }
    return out;
  }
  async function single(table){const c=db();if(!c)throw new Error('Sesión de datos no disponible');const r=await c.from(table).select('*').limit(1);if(r.error)throw r.error;return r.data?.[0]||null;}

  async function loadData(){
    const [overview,events,sources,universe]=await Promise.all([
      single(V.overview),page(V.events,'*','event_date',false),page(V.sources,'*','source_code',true),single(V.universe)
    ]);
    S.overview=overview;S.events=events;S.sources=sources;S.universe=universe;
    const snapshot={version:VERSION,build:BUILD,overview,contracts:V,refreshedAt:new Date().toISOString()};
    window.__ATLAS_SANCTIONS_SIGNALS__={...snapshot,events,entityContext:entityId=>events.filter(e=>e.entity_id===entityId)};
    try{window.dispatchEvent(new CustomEvent('atlas:sanctions-radiography:ready',{detail:snapshot}));}catch{}
  }

  function shell(){return `<div class="san96" data-san96 data-authority="${AUTH}">
    <section class="san96-hero">
      <div class="san96-hero-top"><div><span class="san96-kicker">FISCALIZACIÓN UAF · SANCIONES 0.96</span><h1>Radiografía sancionatoria de Chile</h1><p>Una sola lectura sobre el universo consolidado SII + UAF + OSFL. Integra sanciones CMF, UAF y SCJ, y acciones de enforcement CGR, preservando la diferencia jurídica entre una sanción regulatoria y un reparo, sumario o derivación.</p></div><div class="san96-universe"><span>Universo sometido a evaluación</span><b>${fmt(S.universe?.unified_universe_count)}</b><small>${fmt(S.universe?.sii_registry_count)} SII · ${fmt(S.universe?.uaf_registry_count)} UAF · ${fmt(S.universe?.osfl_registry_count)} OSFL · deduplicado por RUT</small></div></div>
      <div class="san96-source-grid" id="san96Sources"></div>
    </section>
    <section class="san96-command">
      <label>Buscar entidad<input id="san96Q" type="search" autocomplete="off" placeholder="Nombre, RUT, motivo o resolución"></label>
      <label>Año<select id="san96Year"><option value="">Todos</option></select></label>
      <label>Fuente<select id="san96Reg"><option value="">Todas</option></select></label>
      <label>Condición UAF<select id="san96Condition"><option value="">Todas</option><option value="SO_REGISTERED">SO inscrito</option><option value="POTENTIAL_SO_CURRENT">Potencial SO</option><option value="OTHER">Otra / no observada</option></select></label>
      <label>Región<select id="san96Region"><option value="">Todas</option></select></label>
      <label>Universo<select id="san96Scope"><option value="">Todo lo observado</option><option value="unified">Sólo universo SII+UAF+OSFL</option></select></label>
      <button class="san96-clear" id="san96Clear" type="button">Limpiar</button>
    </section>
    <section class="san96-kpis" id="san96Kpis"></section>
    <section class="san96-grid">
      <article class="san96-panel"><div class="san96-panel-head"><div><span>EVOLUCIÓN</span><h3>Sanciones y enforcement por año</h3></div><small>cada color = fuente · clic para filtrar</small></div><div id="san96YearChart"></div></article>
      <article class="san96-panel"><div class="san96-panel-head"><div><span>TERRITORIO</span><h3>Concentración regional</h3></div><small>entidades con región observable</small></div><div id="san96Regions"></div></article>
      <article class="san96-panel"><div class="san96-panel-head"><div><span>SO Y POTENCIALES SO</span><h3>Sectores con presencia sancionatoria</h3></div><small>sector UAF vigente / screening actual</small></div><div id="san96Sectors"></div></article>
      <article class="san96-panel"><div class="san96-panel-head"><div><span>HUELLA SOCIETARIA</span><h3>OSFL y empresas RES</h3></div><small>presencia dentro de entidades observadas</small></div><div id="san96Mix"></div></article>
      <article class="san96-panel wide"><div class="san96-explorer-head"><div class="san96-panel-head" style="margin:0"><div><span>EXPEDIENTES</span><h3>Eventos y entidades</h3></div></div><div class="san96-count" id="san96Count"></div></div><div class="san96-events" id="san96Events"></div></article>
    </section>
    <details class="san96-panel san96-method"><summary>Fuentes, alcance y reglas de interpretación</summary><p><b>Universo:</b> padrón SII + padrón UAF + padrón OSFL, deduplicados por RUT. <b>CMF/UAF/SCJ:</b> registros sancionatorios observados por Radar Sanciones. <b>CGR:</b> reparos, procedimientos disciplinarios y derivaciones se presentan como acciones de enforcement y no se convierten en sanciones finales sin evidencia expresa. <b>Identidad:</b> los eventos no conciliados permanecen visibles. <b>SO y potencial SO:</b> se toman del contrato UAF vigente. <b>OSFL/RES:</b> son atributos de presencia en fuentes, no explicaciones causales. El monitor prioriza revisión fiscalizadora; no constituye por sí solo una conclusión de incumplimiento LA/FT.</p></details>
    <div class="san96-shade" id="san96Shade" hidden></div><aside class="san96-drawer" id="san96Drawer" hidden></aside>
  </div>`;}

  function sourceCards(){
    const rows=['CMF','UAF','SCJ','CGR'].map(code=>{
      const snap=S.sources.find(x=>x.source_code===code)||{};
      const ev=S.events.filter(x=>x.regulator===code);
      const docs=ev.filter(x=>safeUrl(x.document_url)).length;
      const last=ev.reduce((m,x)=>String(x.event_date||'')>m?String(x.event_date):m,'');
      const status=snap.status|| (ev.length?'ACTIVE':'PENDING');
      return `<div class="san96-source" data-src="${code}"><em>${esc(status)}</em><span>${esc(code)} · ${esc(sourceName[code])}</span><b>${fmt(ev.length)} evento(s)</b><small>${fmt(docs)} con documento · último ${esc(date(last))}${code==='CGR'?' · enforcement':''}</small></div>`;
    });
    const el=document.getElementById('san96Sources');if(el)el.innerHTML=rows.join('');
  }

  function filtered(){
    const f=S.filters,q=norm(f.q);
    return S.events.filter(e=>{
      if(f.year&&String(e.event_year)!==f.year)return false;
      if(f.regulator&&e.regulator!==f.regulator)return false;
      if(f.region&&(e.region||'SIN REGIÓN OBSERVADA')!==f.region)return false;
      if(f.scope==='unified'&&!e.in_unified_universe)return false;
      if(f.condition==='SO_REGISTERED'&&!e.is_uaf_registered)return false;
      if(f.condition==='POTENTIAL_SO_CURRENT'&&!e.is_potential_screening)return false;
      if(f.condition==='OTHER'&&(e.is_uaf_registered||e.is_potential_screening))return false;
      if(f.sector&&(e.uaf_sector||'SIN SECTOR UAF')!==f.sector)return false;
      if(f.mix&&mixOf(e)!==f.mix)return false;
      if(q&&!norm([e.canonical_name,e.source_entity_name,e.rut,e.reason,e.resolution_ref,e.event_kind,e.regulator].join(' ')).includes(q))return false;
      return true;
    });
  }

  function groups(D,keyFn){const m=new Map();for(const e of D){const k=keyFn(e);m.set(k,(m.get(k)||0)+1)}return [...m].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value)}
  function distinctEntities(D,pred=()=>true){return new Set(D.filter(pred).map(e=>e.entity_key)).size;}
  function amountLabel(e){if(num(e.amount_uf)!=null)return `${fmt(e.amount_uf)} UF`;if(num(e.amount_clp)!=null)return money(e.amount_clp);return 'Monto no publicado';}

  function renderKpis(D){
    const docs=D.filter(e=>safeUrl(e.document_url)).length;
    const sanc=D.filter(e=>e.sanction_record).length,cgr=D.filter(e=>e.regulator==='CGR').length;
    const el=document.getElementById('san96Kpis');if(!el)return;
    const k=(label,value,detail,cls='')=>`<div class="san96-kpi ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small></div>`;
    el.innerHTML=[
      k('Eventos filtrados',fmt(D.length),`${fmt(distinctEntities(D))} entidades / identidades`,'info'),
      k('Sanciones regulatorias',fmt(sanc),'CMF + UAF + SCJ','good'),
      k('Acciones CGR',fmt(cgr),'enforcement con semántica separada','cgr'),
      k('Dentro universo único',fmt(distinctEntities(D,e=>e.in_unified_universe)),`${fmt(D.filter(e=>e.in_unified_universe).length)} eventos`,'good'),
      k('SO / potenciales',`${fmt(distinctEntities(D,e=>e.is_uaf_registered))} / ${fmt(distinctEntities(D,e=>e.is_potential_screening))}`,'entidades distintas','warn'),
      k('Trazabilidad documental',pct(D.length?100*docs/D.length:0),`${fmt(docs)} eventos con enlace público`,'info')
    ].join('');
  }

  function yearChart(D){
    const el=document.getElementById('san96YearChart');if(!el)return;
    const years=[...new Set(D.map(e=>e.event_year).filter(Boolean))].sort((a,b)=>b-a);
    if(!years.length){el.innerHTML='<div class="san96-empty">Sin eventos para los filtros actuales.</div>';return;}
    const data=years.map(y=>{const rows=D.filter(e=>e.event_year===y);const counts=Object.fromEntries(['CMF','UAF','SCJ','CGR'].map(r=>[r,rows.filter(e=>e.regulator===r).length]));return {y,total:rows.length,counts}});
    const max=Math.max(...data.map(x=>x.total),1);
    el.innerHTML=`<div class="san96-year-chart">${data.map(x=>`<div class="san96-year-row"><span>${x.y}</span><div class="san96-stack" style="width:${Math.max(5,100*x.total/max)}%">${['CMF','UAF','SCJ','CGR'].filter(r=>x.counts[r]).map(r=>`<button type="button" class="${r}" data-year="${x.y}" data-reg="${r}" title="${r}: ${x.counts[r]}" style="width:${100*x.counts[r]/x.total}%"></button>`).join('')}</div><em>${fmt(x.total)}</em></div>`).join('')}</div><div class="san96-legend">${['CMF','UAF','SCJ','CGR'].map(r=>`<span><i style="--c:${sourceColor[r]}"></i>${r}</span>`).join('')}</div>`;
    el.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{S.filters.year=b.dataset.year||'';S.filters.regulator=b.dataset.reg||'';syncControls();render();});
  }

  function bars(elId,rows,onClick,empty='Sin datos observables.',maxRows=12){
    const el=document.getElementById(elId);if(!el)return;const R=rows.slice(0,maxRows);if(!R.length){el.innerHTML=`<div class="san96-empty">${esc(empty)}</div>`;return;}const max=Math.max(...R.map(x=>x.value),1);
    el.innerHTML=`<div class="san96-bars">${R.map(x=>`<button type="button" class="san96-bar" data-key="${esc(x.key)}"><span class="san96-bar-main"><div><b title="${esc(x.key)}">${esc(x.key)}</b><small>${pct(100*x.value/Math.max(1,rows.reduce((a,b)=>a+b.value,0)))}</small></div><span class="san96-track"><i style="width:${Math.max(2,100*x.value/max)}%"></i></span></span><em>${fmt(x.value)}</em></button>`).join('')}</div>`;
    el.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>onClick(b.dataset.key));
  }

  function renderRegions(D){const rows=groups(D.filter(e=>e.region),e=>e.region);bars('san96Regions',rows,k=>{S.filters.region=k;syncControls();render();},'No hay región materializada para este corte.');}
  function renderSectors(D){const rows=groups(D.filter(e=>e.is_uaf_registered||e.is_potential_screening),e=>e.uaf_sector||'SIN SECTOR UAF');bars('san96Sectors',rows,k=>{S.filters.sector=k;render();},'No hay SO o potenciales SO en los filtros actuales.');}

  function renderMix(D){
    const el=document.getElementById('san96Mix');if(!el)return;
    const unique=new Map();for(const e of D){const k=e.entity_key;if(!unique.has(k))unique.set(k,mixOf(e));else if(mixOf(e)==='OSFL + RES')unique.set(k,'OSFL + RES');}
    const order=['OSFL + RES','OSFL','RES','OTRAS ENTIDADES'];const counts=Object.fromEntries(order.map(k=>[k,0]));for(const v of unique.values())counts[v]=(counts[v]||0)+1;
    const total=Math.max(1,[...unique].length),a=100*counts['OSFL + RES']/total,b=a+100*counts.OSFL/total,c=b+100*counts.RES/total;
    const colors={'OSFL + RES':'var(--s96-uaf)','OSFL':'var(--s96-cmf)','RES':'var(--s96-scj)','OTRAS ENTIDADES':'rgba(161,185,211,.22)'};
    el.innerHTML=`<div class="san96-mix"><div class="san96-donut" style="--p1:${a}%;--p2:${b}%;--p3:${c}%"></div><div class="san96-mix-list">${order.map(k=>`<button type="button" class="san96-mix-btn" data-mix="${esc(k)}"><i style="--c:${colors[k]}"></i><span>${esc(k)}</span><b>${fmt(counts[k])}</b></button>`).join('')}</div></div>`;
    el.querySelectorAll('[data-mix]').forEach(b=>b.onclick=()=>{S.filters.mix=S.filters.mix===b.dataset.mix?'':b.dataset.mix||'';render();});
  }

  function badges(e){return `${e.in_unified_universe?'<span class="san96-badge universe">Universo SII+UAF+OSFL</span>':'<span class="san96-badge out">Fuera/no conciliado</span>'}${e.is_uaf_registered?'<span class="san96-badge so">SO</span>':''}${e.is_potential_screening?'<span class="san96-badge potential">Potencial SO</span>':''}${e.is_osfl_observed?'<span class="san96-badge osfl">OSFL</span>':''}${e.is_res_observed?'<span class="san96-badge res">RES</span>':''}`;}

  function renderEvents(D){
    const count=document.getElementById('san96Count');if(count)count.textContent=`${fmt(D.length)} eventos · ${fmt(distinctEntities(D))} entidades/identidades`;
    const el=document.getElementById('san96Events');if(!el)return;
    const rows=[...D].sort((a,b)=>String(b.event_date||'').localeCompare(String(a.event_date||''))).slice(0,160);
    if(!rows.length){el.innerHTML='<div class="san96-empty">No hay eventos que cumplan los filtros.</div>';return;}
    el.innerHTML=rows.map(e=>`<button type="button" class="san96-event" data-event="${esc(e.event_id)}"><span class="date">${esc(date(e.event_date))}</span><span class="src ${esc(e.regulator)}">${esc(e.regulator)}</span><span class="san96-event-main"><b>${esc(e.canonical_name||e.source_entity_name||'Identidad no conciliada')}</b><span>${esc(e.event_kind||'Evento')} · ${esc(e.uaf_sector||conditionLabel(e.current_condition))}</span></span><span class="san96-event-meta"><b>${esc(amountLabel(e))}</b><small>${safeUrl(e.document_url)?'Documento disponible':'Sin enlace materializado'}</small></span><span class="arrow">›</span></button>`).join('');
    el.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>openDrawer(S.events.find(e=>e.event_id===b.dataset.event)));
  }

  function openEntity(id,row){const E=entry();if(E&&typeof E.open==='function')return E.open(id,{entity_id:id,name:row?.canonical_name||'',rut:row?.rut||''});if(typeof window.openEntity==='function')return window.openEntity(id);}
  function closeDrawer(){const s=document.getElementById('san96Shade'),d=document.getElementById('san96Drawer');if(s)s.hidden=true;if(d)d.hidden=true;S.selected=null;}
  function openDrawer(seed){
    if(!seed)return;S.selected=seed;const shade=document.getElementById('san96Shade'),dr=document.getElementById('san96Drawer');if(!shade||!dr)return;
    const ev=[...S.events.filter(x=>x.entity_key===seed.entity_key)].sort((a,b)=>String(b.event_date||'').localeCompare(String(a.event_date||'')));
    const regs=[...new Set(ev.map(x=>x.regulator))];const docs=ev.filter(x=>safeUrl(x.document_url)).length;
    shade.hidden=false;dr.hidden=false;
    dr.innerHTML=`<div class="san96-drawer-head"><div><span class="san96-kicker">EXPEDIENTE SANCIONATORIO</span><h2>${esc(seed.canonical_name||seed.source_entity_name||'Identidad no conciliada')}</h2><p>${esc(seed.rut||seed.entity_id||'Sin RUT conciliado')} · ${esc([seed.commune,seed.region].filter(Boolean).join(' · ')||'territorio no observado')}</p></div><button class="san96-close" type="button" data-close>×</button></div><div style="margin-top:8px">${badges(seed)}</div><div class="san96-drawer-kpis"><div><span>Eventos</span><b>${fmt(ev.length)}</b></div><div><span>Fuentes</span><b>${fmt(regs.length)}</b></div><div><span>Documentos</span><b>${fmt(docs)}</b></div><div><span>Última fecha</span><b>${esc(date(ev[0]?.event_date))}</b></div></div>${seed.entity_id?'<button type="button" class="san96-entity-open" data-open-entity>Abrir Entidad 360 →</button>':''}<div>${ev.map(e=>{const url=safeUrl(e.document_url);return `<article class="san96-dossier-event"><strong>${esc(date(e.event_date))} · ${esc(e.regulator)} · ${esc(e.event_kind||'Evento')}</strong><span>${esc(conditionLabel(e.current_condition))}${e.uaf_sector?` · ${esc(e.uaf_sector)}`:''} · ${esc(amountLabel(e))}</span><p>${esc(e.reason||'Motivo no materializado en la fuente actual')}</p>${e.regulator==='CGR'?'<span class="san96-badge potential">Acción CGR de enforcement · no equivale por sí sola a sanción final</span>':''}${url?`<a class="san96-doc" href="${esc(url)}" target="_blank" rel="noopener">Abrir documento público ↗</a>`:'<span class="san96-doc" style="color:var(--s96-muted)">Documento público aún no materializado</span>'}</article>`}).join('')}</div>`;
    dr.querySelector('[data-close]').onclick=closeDrawer;shade.onclick=closeDrawer;const open=dr.querySelector('[data-open-entity]');if(open)open.onclick=()=>openEntity(seed.entity_id,seed);
  }

  function populateControls(){
    const years=[...new Set(S.events.map(e=>e.event_year).filter(Boolean))].sort((a,b)=>b-a),regs=['CMF','UAF','SCJ','CGR'].filter(r=>S.events.some(e=>e.regulator===r)),regions=[...new Set(S.events.map(e=>e.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const y=document.getElementById('san96Year'),r=document.getElementById('san96Reg'),g=document.getElementById('san96Region');
    if(y)y.innerHTML='<option value="">Todos</option>'+years.map(v=>`<option value="${v}">${v}</option>`).join('');
    if(r)r.innerHTML='<option value="">Todas</option>'+regs.map(v=>`<option value="${v}">${v}</option>`).join('');
    if(g)g.innerHTML='<option value="">Todas</option>'+regions.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  function syncControls(){const pairs=[['san96Year','year'],['san96Reg','regulator'],['san96Condition','condition'],['san96Region','region'],['san96Scope','scope']];for(const [id,k] of pairs){const e=document.getElementById(id);if(e)e.value=S.filters[k]||'';}const q=document.getElementById('san96Q');if(q&&q.value!==S.filters.q)q.value=S.filters.q;}
  function bind(){
    const changes=[['san96Year','year'],['san96Reg','regulator'],['san96Condition','condition'],['san96Region','region'],['san96Scope','scope']];for(const [id,k] of changes){document.getElementById(id)?.addEventListener('change',e=>{S.filters[k]=e.target.value;render();});}
    let timer=null;document.getElementById('san96Q')?.addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{S.filters.q=e.target.value.trim();render();},120);});
    document.getElementById('san96Clear')?.addEventListener('click',()=>{S.filters={year:'',regulator:'',region:'',condition:'',sector:'',mix:'',scope:'',q:''};syncControls();render();});
  }
  function render(){const D=filtered();sourceCards();renderKpis(D);yearChart(D);renderRegions(D);renderSectors(D);renderMix(D);renderEvents(D);}

  async function load(){
    const h=host();if(!h)return;S.loading=true;S.error=null;h.innerHTML='<div class="san96-loading">Construyendo radiografía sancionatoria…</div>';
    try{await loadData();h.innerHTML=shell();populateControls();bind();syncControls();render();S.loading=false;}
    catch(error){S.loading=false;S.error=error;h.innerHTML=`<div class="san96-error"><b>No fue posible abrir la radiografía sancionatoria.</b><br>${esc(error?.message||error)}</div>`;throw error;}
  }

  window.ATLAS_SANCTIONS_CURRENT={version:VERSION,build:BUILD,authority:AUTH,load,reload:load,state:S,contracts:V,methodology:{universe:'SII+UAF+OSFL deduplicado por RUT',regulatorySources:['CMF','UAF','SCJ'],cgr:'ENFORCEMENT_ACTION_SEPARATE_SEMANTICS'}};
})();
