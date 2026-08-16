'use strict';

/* v0.19.3 consolidation patch: Territory remains a non-UAF analytical lens.
   UAF coverage, IBS and reportability live in Intelligence UAF. */

v0193Pct=function(v,d=1){if(v===null||v===undefined||v==='')return '—';const n=Number(v);return Number.isFinite(n)?`${n>0?'+':''}${n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';};

function v0193TerritoryMap(core,selected){
  const regions=core.regions.filter(r=>v019RegionNorm(r.region)!=='Sin región');
  const maxHigh=Math.max(...regions.map(r=>v019Num(r.high_priority_count)),1);
  const land=`<g class="v0191-map-geography" transform="translate(0 266) scale(1 -1)">${V0191_MAP_PATHS.map(d=>`<path class="v0191-map-land" d="${d}"/>`).join('')}</g>`;
  const andes=Object.entries(V0191_REGION_GEO).map(([name,[lon,lat]])=>{const p=v0191MapPoint(lon+.55,lat);return `${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ');
  const bubbles=Object.entries(V0191_REGION_GEO).map(([name,[lon,lat]])=>{
    const r=regions.find(x=>v019RegionNorm(x.region)===name),p=v0191MapPoint(lon,lat),level=v0191MapLevel(r?.attention_index),radius=6+11*Math.sqrt(v019Num(r?.high_priority_count)/maxHigh),active=name===selected?' active':'';
    return `<g class="v0191-map-hit${active}" tabindex="0" role="button" data-territory-select="${esc(name)}" aria-label="${esc(name)}: IAT ${v019Fmt(r?.attention_index,1)}"><circle class="v0191-map-bubble level${level}${active}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${radius.toFixed(1)}"><title>${esc(v019RegionShort(name))} · IAT ${v019Fmt(r?.attention_index,1)}</title></circle><text class="v0191-map-abbr${level>=4?' light':''}" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${V0191_REGION_ABBR[name]}</text></g>`;
  }).join('');
  return `<div class="v0191-map"><svg viewBox="0 0 820 282" role="img" aria-label="Mapa físico de Chile con atención territorial"><defs><linearGradient id="v0193Ocean" x1="0" x2="1"><stop offset="0" stop-color="#e9f5f7"/><stop offset="1" stop-color="#f9fcfd"/></linearGradient></defs><rect class="v0191-map-bg" fill="url(#v0193Ocean)" x="0" y="0" width="820" height="282" rx="12"/><line class="v0191-ocean-line" x1="24" y1="82" x2="790" y2="82"/><line class="v0191-ocean-line" x1="24" y1="143" x2="790" y2="143"/><line class="v0191-ocean-line" x1="24" y1="204" x2="790" y2="204"/><text class="v0191-map-axis" x="30" y="24">NORTE</text><text class="v0191-map-axis" text-anchor="end" x="785" y="24">SUR</text><text class="v0191-map-axis" x="31" y="39">CORDILLERA · ESTE</text><text class="v0191-map-axis" x="31" y="252">PACÍFICO · OESTE</text>${land}<polyline class="v0191-andes" points="${andes}"/>${bubbles}<g transform="translate(28 268)"><circle class="v0191-map-bubble level3" cx="0" cy="0" r="6"/><text class="v0191-map-axis" x="10" y="3">IAT por color · tamaño = hallazgos con IPA ≥60</text></g></svg></div>`;
}

function v0193TerritoryAlerts(core){
  const rows=core.regions.filter(r=>v019RegionNorm(r.region)!=='Sin región').slice().sort((a,b)=>v019Num(b.attention_index)-v019Num(a.attention_index)).slice(0,8);
  return `<div class="v0193-territory-alerts">${rows.map(r=>{const reg=v019RegionNorm(r.region),p=core.patterns.filter(x=>x.scope_type==='REGION'&&v019RegionNorm(x.scope_label)===reg&&!v0193PatternIsUaf(x)).sort((a,b)=>v019Num(b.strength)-v019Num(a.strength))[0];return `<button type="button" data-territory-select="${esc(reg)}"><span><b>${esc(v019RegionShort(reg))}</b><small>${p?esc(v019Truncate(p.title||p.pattern_type,58)):`${v019Fmt(r.high_priority_count)} hallazgos IPA ≥60`}</small></span><strong>${v019Fmt(r.attention_index,1)}</strong></button>`;}).join('')}</div>`;
}

function v0193TerritoryFindingList(rows){
  if(!rows.length)return '<div class="v019-empty">Sin hallazgos no regulatorios materializados para esta región.</div>';
  return `<div class="v0193-priority-list">${rows.slice(0,7).map(f=>`<article class="v0193-priority-row" data-finding="${esc(f.finding_key)}"><div><span>${esc(v019FindingType(f.finding_type))}</span><b>${esc(v019Truncate(f.title||f.entity_id||'Hallazgo',80))}</b><small>${v019Fmt(f.source_count)} fuentes · ${v019Fmt(f.evidence_count)} evidencias</small></div><div class="v0193-proof"><span><b>${v019Fmt(f.score_investigate,1)}</b> IPA</span></div></article>`).join('')}</div>`;
}

function v0193RenderTerritoryDetail(region,core){
  const box=document.querySelector('#v019-territory-detail');if(!box)return;
  const reg=v019RegionNorm(region),r=core.regions.find(x=>v019RegionNorm(x.region)===reg),econ=v0191EconRegion(core,reg);
  const findings=core.findings.filter(f=>v019RegionNorm(f.region)===reg&&!v0193FindingIsUaf(f)).sort((a,b)=>v019Num(b.score_investigate)-v019Num(a.score_investigate));
  const patterns=core.patterns.filter(p=>p.scope_type==='REGION'&&v019RegionNorm(p.scope_label)===reg&&!v0193PatternIsUaf(p)).sort((a,b)=>v019Num(b.strength)-v019Num(a.strength));
  const maxIPA=findings.length?Math.max(...findings.map(f=>v019Num(f.score_investigate))):0;
  box.innerHTML=`<div class="v0193-territory-detail-head"><div><span>Lectura regional</span><h2>${esc(v019RegionShort(reg))}</h2></div><div class="v0193-flags"><span class="v0193-flag neutral">UAF se analiza en Inteligencia UAF</span></div></div><div class="v0193-territory-kpis"><div><span>IAT</span><b>${v019Fmt(r?.attention_index,1)}</b><small>atención territorial</small></div><div><span>Máximo IPA</span><b>${v019Fmt(maxIPA,1)}</b><small>hallazgo regional</small></div><div><span>Hallazgos IPA ≥60</span><b>${v019Fmt(r?.high_priority_count)}</b><small>prioridad, no incidencia</small></div><div><span>Empresas-año SII 2024</span><b>${econ?v019Fmt(econ):'—'}</b><small>contexto económico</small></div></div><div class="v0193-territory-columns"><section><h3>Hallazgos prioritarios</h3>${v0193TerritoryFindingList(findings)}</section><section><h3>Fenómenos territoriales</h3>${patterns.length?v019PatternList(patterns,6):'<div class="v019-empty">Sin patrones territoriales no regulatorios en este corte.</div>'}</section></div><div class="v019-note"><b>Principio territorial:</b> IAT ordena atención a partir de hallazgos estructurados. El contexto económico ayuda a dimensionar el territorio. La lectura UAF, sus brechas y reportabilidad se mantienen en la sección Inteligencia UAF para evitar duplicaciones.</div>`;
  v019BindCommon(core);
}

v019LoadTerritory=async function(initial=''){
  state.view='territory';shell('Territorio','Mapa de Chile para concentración de hallazgos y fenómenos regionales. La dimensión UAF se mantiene consolidada en Inteligencia UAF.');
  try{
    const core=await v019LoadCore(),selected=initial||v019RegionNorm(core.regions.find(r=>v019RegionNorm(r.region)!=='Sin región')?.region)||'Metropolitana de Santiago';
    v019Content().innerHTML=`<section class="v019-grid"><article class="v019-card v019-full v0191-map-card"><div class="v019-card-head"><div><h2>Chile · atención territorial</h2><p>Mapa físico, IAT y principales hallazgos regionales sin mezclar la dimensión supervisiva UAF.</p></div><span class="hint">clic en región</span></div><div class="v0191-map-layout"><div>${v0193TerritoryMap(core,selected)}</div><aside><h3>Regiones que concentran atención</h3><p>Orden por IAT; se muestra el fenómeno no regulatorio más fuerte cuando existe.</p>${v0193TerritoryAlerts(core)}</aside></div><div class="v019-region-detail v0191-region-detail" id="v019-territory-detail"><div class="v019-loading">Preparando lectura regional…</div></div></article><article class="v019-card v019-full"><div class="v019-card-head"><div><h2>Ranking de atención territorial</h2><p>IAT derivado de hallazgos estructurados. No incorpora IBS ni reportabilidad UAF.</p></div>${v0192HelpIAT()}</div>${v019RegionBars(core.regions,16)}</article></section>`;
    const activate=el=>{const region=el.dataset.territorySelect;document.querySelectorAll('[data-territory-select]').forEach(x=>x.classList.toggle('active',x.dataset.territorySelect===region));v0193RenderTerritoryDetail(region,core);};
    document.querySelectorAll('[data-territory-select]').forEach(el=>{el.addEventListener('click',()=>activate(el));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(el);}});});
    document.querySelectorAll('[data-region]').forEach(el=>el.addEventListener('click',()=>{const region=el.dataset.region;const target=document.querySelector(`[data-territory-select="${CSS.escape(region)}"]`);if(target)activate(target);else v0193RenderTerritoryDetail(region,core);}));
    v0193RenderTerritoryDetail(selected,core);
  }catch(e){v019Content().innerHTML=`<div class="v019-error">${esc(e?.message||String(e))}</div>`;}
};
