'use strict';

/* ATLAS AML · Sanciones · charts + cross-filter hotfix 0.96.2 */
(function atlasSanctionsCharts0962(){
  if (window.__ATLAS_SANCTIONS_CHARTS_0962__) return;
  window.__ATLAS_SANCTIONS_CHARTS_0962__ = true;

  const STYLE_ID='atlas-sanctions-charts-0962-style';
  const SOURCES=['CMF','UAF','SCJ','CGR'];
  const SOURCE_LABEL={CMF:'Comisión para el Mercado Financiero',UAF:'Unidad de Análisis Financiero',SCJ:'Superintendencia de Casinos de Juego',CGR:'Contraloría General de la República'};
  const css=`
  .san96 .san962-chart{display:flex;flex-direction:column;gap:8px;min-width:0}
  .san96 .san962-year-row{display:grid;grid-template-columns:48px minmax(0,1fr) 46px;gap:9px;align-items:center;min-height:24px}
  .san96 .san962-year-label{appearance:none;border:0;background:transparent;color:#dcefff;padding:0;text-align:left;font:inherit;font-size:11px;font-weight:850;cursor:pointer;border-radius:5px}
  .san96 .san962-year-label:hover,.san96 .san962-year-label:focus-visible{color:#fff;outline:1px solid rgba(86,232,208,.48);outline-offset:3px}
  .san96 .san962-year-track{position:relative;height:20px;border-radius:7px;background:#102536;overflow:hidden;min-width:0}
  .san96 .san962-year-total{display:flex!important;height:100%!important;width:var(--san962-total)!important;min-width:4px;border-radius:7px;overflow:hidden;transition:width .18s ease}
  .san96 .san962-year-segment{appearance:none!important;display:block!important;flex:0 0 var(--san962-segment)!important;width:var(--san962-segment)!important;height:100%!important;min-width:3px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;cursor:pointer!important;opacity:.95!important;box-shadow:none!important;transition:filter .14s ease,opacity .14s ease,box-shadow .14s ease}
  .san96 .san962-year-segment[data-source="CMF"]{background:var(--s96-cmf)!important}
  .san96 .san962-year-segment[data-source="UAF"]{background:var(--s96-uaf)!important}
  .san96 .san962-year-segment[data-source="SCJ"]{background:var(--s96-scj)!important}
  .san96 .san962-year-segment[data-source="CGR"]{background:var(--s96-cgr)!important}
  .san96 .san962-year-segment:hover,.san96 .san962-year-segment:focus-visible{filter:brightness(1.2);outline:0;box-shadow:inset 0 0 0 2px rgba(255,255,255,.78)!important}
  .san96 .san962-year-segment.is-selected{box-shadow:inset 0 0 0 2px #fff,0 0 0 1px rgba(255,255,255,.22)!important;opacity:1!important}
  .san96 .san962-year-row.is-year-selected .san962-year-label{color:var(--s96-cmf)}
  .san96 .san962-value{font-size:10px;font-style:normal;color:var(--s96-muted);text-align:right;white-space:nowrap}
  .san96 .san962-legend{display:flex;gap:7px 12px;flex-wrap:wrap;margin-top:3px}
  .san96 .san962-legend-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--s96-muted);padding:3px 5px;border-radius:7px;display:inline-flex;align-items:center;gap:6px;font-size:9px;font-weight:750;cursor:pointer}
  .san96 .san962-legend-btn:hover,.san96 .san962-legend-btn:focus-visible{border-color:var(--s96-border);color:var(--s96-text);outline:0}
  .san96 .san962-legend-btn.is-selected{border-color:rgba(86,232,208,.46);background:rgba(86,232,208,.08);color:var(--s96-text)}
  .san96 .san962-swatch{display:inline-block!important;width:9px!important;height:9px!important;min-width:9px!important;border-radius:50%!important;background:var(--san962-color)!important;box-shadow:none!important}
  .san96 .san962-bars{display:flex;flex-direction:column;gap:5px;min-width:0}
  .san96 .san962-bar{appearance:none;border:1px solid transparent;background:transparent;color:inherit;padding:5px 3px;display:grid;grid-template-columns:minmax(0,1fr) 48px;gap:8px;align-items:center;text-align:left;cursor:pointer;border-radius:8px;min-width:0}
  .san96 .san962-bar:hover,.san96 .san962-bar:focus-visible{background:rgba(255,255,255,.025);border-color:rgba(145,169,189,.18);outline:0}
  .san96 .san962-bar.is-selected{background:rgba(86,232,208,.06);border-color:rgba(86,232,208,.38)}
  .san96 .san962-bar-copy{display:flex;justify-content:space-between;gap:10px;align-items:center;min-width:0}
  .san96 .san962-bar-copy b{font-size:10px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;color:var(--s96-text)}
  .san96 .san962-bar-copy small{font-size:9px;color:var(--s96-muted);white-space:nowrap}
  .san96 .san962-bar-track{display:block;position:relative;height:5px!important;border-radius:999px!important;background:#11293a!important;overflow:hidden;margin-top:4px;min-width:0}
  .san96 .san962-bar-fill{display:block!important;position:absolute!important;inset:0 auto 0 0!important;width:var(--san962-fill)!important;height:100%!important;border-radius:999px!important;min-width:2px!important;box-shadow:none!important;transition:width .18s ease}
  .san96 #san96Regions .san962-bar-fill{background:linear-gradient(90deg,var(--s96-cmf),var(--s96-uaf))!important}
  .san96 #san96Sectors .san962-bar-fill{background:linear-gradient(90deg,var(--s96-scj),var(--s96-uaf))!important}
  .san96 .san962-bar.is-selected .san962-bar-fill{filter:brightness(1.18);box-shadow:0 0 0 1px rgba(255,255,255,.45)!important}
  .san96 .san962-bar-value{font-size:11px;font-style:normal;font-weight:850;text-align:right;white-space:nowrap;color:var(--s96-text)}
  .san96 .san962-more{font-size:9px;color:var(--s96-muted);padding-top:2px}
  .san96 .san962-mix{display:grid;grid-template-columns:132px minmax(0,1fr);gap:20px;align-items:center;padding:10px 6px 4px}
  .san96 .san962-donut{width:104px!important;height:104px!important;border-radius:50%!important;margin:auto;background:conic-gradient(var(--s96-uaf) 0 var(--p1),var(--s96-cmf) var(--p1) var(--p2),var(--s96-scj) var(--p2) var(--p3),rgba(161,185,211,.24) var(--p3) 100%)!important;position:relative!important;box-shadow:none!important}
  .san96 .san962-donut::after{content:"";position:absolute;inset:18px;border-radius:50%;background:var(--s96-panel)!important;border:1px solid var(--s96-border)}
  .san96 .san962-mix-list{display:flex;flex-direction:column;gap:4px;min-width:0}
  .san96 .san962-mix-btn{appearance:none;border:1px solid transparent;background:transparent;color:inherit;display:grid;grid-template-columns:12px minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px;border-radius:8px;text-align:left;cursor:pointer;min-width:0}
  .san96 .san962-mix-btn:hover,.san96 .san962-mix-btn:focus-visible{border-color:rgba(145,169,189,.22);background:rgba(255,255,255,.025);outline:0}
  .san96 .san962-mix-btn.is-selected{border-color:rgba(86,232,208,.38);background:rgba(86,232,208,.06)}
  .san96 .san962-mix-btn span:nth-child(2){font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .san96 .san962-mix-btn b{font-size:11px}
  .san96 .san962-empty{padding:18px 4px;color:var(--s96-muted);font-size:10px}
  @media (max-width:900px){.san96 .san962-mix{grid-template-columns:100px minmax(0,1fr);gap:12px}.san96 .san962-donut{width:86px!important;height:86px!important}.san96 .san962-donut::after{inset:15px}}
  @media (prefers-reduced-motion:reduce){.san96 .san962-year-total,.san96 .san962-bar-fill{transition:none}}
  `;

  function ensureStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s)}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9K]+/g,' ').replace(/\s+/g,' ').trim();
  const nf=new Intl.NumberFormat('es-CL');
  const fmt=v=>nf.format(Math.round(Number(v)||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:1})}%`;
  const mixOf=e=>e.is_osfl_observed&&e.is_res_observed?'OSFL + RES':e.is_osfl_observed?'OSFL':e.is_res_observed?'RES':'OTRAS ENTIDADES';
  const api=()=>window.ATLAS_SANCTIONS_CURRENT||null;
  const state=()=>api()?.state||null;

  function contextRows(skip=[]){
    const S=state();if(!S||!Array.isArray(S.events))return[];const f=S.filters||{},omit=new Set(skip),q=norm(f.q);
    return S.events.filter(e=>{
      if(!omit.has('year')&&f.year&&String(e.event_year)!==String(f.year))return false;
      if(!omit.has('regulator')&&f.regulator&&e.regulator!==f.regulator)return false;
      if(!omit.has('region')&&f.region&&(e.region||'SIN REGIÓN OBSERVADA')!==f.region)return false;
      if(!omit.has('scope')&&f.scope==='unified'&&!e.in_unified_universe)return false;
      if(!omit.has('condition')&&f.condition==='SO_REGISTERED'&&!e.is_uaf_registered)return false;
      if(!omit.has('condition')&&f.condition==='POTENTIAL_SO_CURRENT'&&!e.is_potential_screening)return false;
      if(!omit.has('condition')&&f.condition==='OTHER'&&(e.is_uaf_registered||e.is_potential_screening))return false;
      if(!omit.has('sector')&&f.sector&&(e.uaf_sector||'SIN SECTOR UAF')!==f.sector)return false;
      if(!omit.has('mix')&&f.mix&&mixOf(e)!==f.mix)return false;
      if(!omit.has('q')&&q&&!norm([e.canonical_name,e.source_entity_name,e.rut,e.reason,e.resolution_ref,e.event_kind,e.regulator].join(' ')).includes(q))return false;
      return true;
    });
  }
  function grouped(rows,keyFn){const m=new Map();for(const e of rows){const k=keyFn(e);if(!k)continue;m.set(k,(m.get(k)||0)+1)}return[...m].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value||String(a.key).localeCompare(String(b.key),'es'))}
  function syncControls(){const S=state();if(!S)return;for(const [id,k] of [['san96Year','year'],['san96Reg','regulator'],['san96Region','region'],['san96Condition','condition'],['san96Scope','scope']]){const el=document.getElementById(id);if(el)el.value=S.filters?.[k]||''}}
  function rerender(){syncControls();const trigger=document.getElementById('san96Year')||document.getElementById('san96Reg')||document.getElementById('san96Region');if(trigger){trigger.dispatchEvent(new Event('change',{bubbles:true}));return}const A=api();if(A&&typeof A.reload==='function')A.reload()}
  function setFilter(key,value){const S=state();if(!S)return;S.filters[key]=value;rerender()}

  function renderYear(){
    const el=document.getElementById('san96YearChart'),S=state();if(!el||!S)return;
    const rows=contextRows(['year','regulator']);
    const years=[...new Set(rows.map(e=>Number(e.event_year)).filter(Number.isFinite))].sort((a,b)=>b-a);
    if(!years.length){el.innerHTML='<div data-san962-year-chart class="san962-empty">Sin eventos para los filtros actuales.</div>';return}
    const data=years.map(year=>{const y=rows.filter(e=>Number(e.event_year)===year),counts=Object.fromEntries(SOURCES.map(src=>[src,y.filter(e=>e.regulator===src).length]));return{year,total:y.length,counts}}),max=Math.max(1,...data.map(d=>d.total));
    el.innerHTML=`<div data-san962-year-chart class="san962-chart">${data.map(d=>{const yearSelected=String(S.filters.year||'')===String(d.year);const segs=SOURCES.filter(src=>d.counts[src]>0).map(src=>{const selected=yearSelected&&S.filters.regulator===src;return`<button type="button" class="san962-year-segment${selected?' is-selected':''}" data-san962-year="${d.year}" data-san962-source="${src}" data-source="${src}" aria-pressed="${selected}" aria-label="Filtrar ${d.year}, ${esc(SOURCE_LABEL[src])}: ${fmt(d.counts[src])} eventos" title="${src}: ${fmt(d.counts[src])}" style="--san962-segment:${(100*d.counts[src]/d.total).toFixed(4)}%"></button>`}).join('');return`<div class="san962-year-row${yearSelected?' is-year-selected':''}"><button type="button" class="san962-year-label" data-san962-year-only="${d.year}" aria-pressed="${yearSelected}">${d.year}</button><div class="san962-year-track"><div class="san962-year-total" style="--san962-total:${Math.max(2,100*d.total/max).toFixed(4)}%">${segs}</div></div><em class="san962-value">${fmt(d.total)}</em></div>`}).join('')}<div class="san962-legend">${SOURCES.map(src=>`<button type="button" class="san962-legend-btn${S.filters.regulator===src?' is-selected':''}" data-san962-source-only="${src}" aria-pressed="${S.filters.regulator===src}"><span class="san962-swatch" style="--san962-color:var(--s96-${src.toLowerCase()})"></span>${src}</button>`).join('')}</div></div>`;
    el.querySelectorAll('[data-san962-year-only]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.san962YearOnly||'';setFilter('year',String(S.filters.year||'')===v?'':v)}));
    el.querySelectorAll('[data-san962-source-only]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.san962SourceOnly||'';setFilter('regulator',S.filters.regulator===v?'':v)}));
    el.querySelectorAll('[data-san962-year][data-san962-source]').forEach(b=>b.addEventListener('click',()=>{const year=b.dataset.san962Year||'',src=b.dataset.san962Source||'',same=String(S.filters.year||'')===year&&S.filters.regulator===src;S.filters.year=same?'':year;S.filters.regulator=same?'':src;rerender()}));
  }

  function renderBars(elId,rows,active,onPick,maxRows=12){
    const el=document.getElementById(elId);if(!el)return;const total=Math.max(1,rows.reduce((a,b)=>a+b.value,0)),shown=rows.slice(0,maxRows),max=Math.max(1,...shown.map(r=>r.value));
    if(!shown.length){el.innerHTML='<div data-san962-bars class="san962-empty">Sin datos observables para los filtros actuales.</div>';return}
    el.innerHTML=`<div data-san962-bars class="san962-bars">${shown.map(r=>{const selected=active===r.key;return`<button type="button" class="san962-bar${selected?' is-selected':''}" data-san962-key="${esc(r.key)}" aria-pressed="${selected}" title="Filtrar por ${esc(r.key)}"><span><span class="san962-bar-copy"><b>${esc(r.key)}</b><small>${pct(100*r.value/total)}</small></span><span class="san962-bar-track"><span class="san962-bar-fill" style="--san962-fill:${Math.max(2,100*r.value/max).toFixed(4)}%"></span></span></span><em class="san962-bar-value">${fmt(r.value)}</em></button>`}).join('')}${rows.length>maxRows?`<div class="san962-more">Mostrando ${maxRows} de ${rows.length} categorías · usa los filtros para profundizar.</div>`:''}</div>`;
    el.querySelectorAll('[data-san962-key]').forEach(b=>b.addEventListener('click',()=>onPick(b.dataset.san962Key||'')));
  }
  function renderRegions(){const S=state();if(!S)return;const rows=grouped(contextRows(['region']).filter(e=>e.region),e=>e.region);renderBars('san96Regions',rows,S.filters.region||'',k=>setFilter('region',S.filters.region===k?'':k),12)}
  function renderSectors(){const S=state();if(!S)return;const rows=grouped(contextRows(['sector']).filter(e=>e.is_uaf_registered||e.is_potential_screening),e=>e.uaf_sector||'SIN SECTOR UAF');renderBars('san96Sectors',rows,S.filters.sector||'',k=>setFilter('sector',S.filters.sector===k?'':k),12)}

  function renderMix(){
    const el=document.getElementById('san96Mix'),S=state();if(!el||!S)return;const unique=new Map();
    for(const e of contextRows(['mix'])){const k=e.entity_key||e.entity_id||`${e.regulator||''}:${e.rut||''}:${e.source_entity_name||''}`,next=mixOf(e);if(!unique.has(k)||next==='OSFL + RES')unique.set(k,next)}
    const order=['OSFL + RES','OSFL','RES','OTRAS ENTIDADES'],counts=Object.fromEntries(order.map(k=>[k,0]));for(const v of unique.values())counts[v]=(counts[v]||0)+1;const total=Math.max(1,unique.size),p1=100*counts['OSFL + RES']/total,p2=p1+100*counts.OSFL/total,p3=p2+100*counts.RES/total,colors={'OSFL + RES':'var(--s96-uaf)','OSFL':'var(--s96-cmf)','RES':'var(--s96-scj)','OTRAS ENTIDADES':'rgba(161,185,211,.35)'};
    el.innerHTML=`<div data-san962-mix class="san962-mix"><div class="san962-donut" role="img" aria-label="Distribución OSFL y RES" style="--p1:${p1.toFixed(4)}%;--p2:${p2.toFixed(4)}%;--p3:${p3.toFixed(4)}%"></div><div class="san962-mix-list">${order.map(k=>`<button type="button" class="san962-mix-btn${S.filters.mix===k?' is-selected':''}" data-san962-mix="${esc(k)}" aria-pressed="${S.filters.mix===k}"><span class="san962-swatch" style="--san962-color:${colors[k]}"></span><span>${esc(k)}</span><b>${fmt(counts[k])}</b></button>`).join('')}</div></div>`;
    el.querySelectorAll('[data-san962-mix]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.san962Mix||'';setFilter('mix',S.filters.mix===k?'':k)}));
  }

  function patchSourceCards(){const S=state();if(!S)return;document.querySelectorAll('.san96 [data-src]').forEach(card=>{const src=card.dataset.src||'';card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-pressed',String(S.filters.regulator===src));card.style.cursor='pointer';const activate=()=>setFilter('regulator',S.filters.regulator===src?'':src);card.onclick=activate;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}}})}
  function patch(){ensureStyle();const root=document.querySelector('.san96[data-san96]'),S=state();if(!root||!S||!Array.isArray(S.events)||!S.events.length)return;const markers=['#san96YearChart [data-san962-year-chart]','#san96Regions [data-san962-bars]','#san96Sectors [data-san962-bars]','#san96Mix [data-san962-mix]'];if(markers.every(sel=>root.querySelector(sel))){patchSourceCards();return}renderYear();renderRegions();renderSectors();renderMix();patchSourceCards();root.dataset.sanctionsCharts='0.96.2'}
  let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;try{patch()}catch(err){console.error('[ATLAS sanctions charts 0.96.2]',err)}})}
  ensureStyle();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('atlas:sanctions-radiography:ready',schedule);window.addEventListener('hashchange',schedule);schedule();
})();
