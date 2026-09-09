'use strict';
/* ATLAS · Territorio · Inteligencia Territorial 1.0.0 */
(function atlasTerritoryIntelligence1010(){
  const VERSION='1.0.0';
  const FALLBACK_CEAD='https://raw.githubusercontent.com/smoralesm07-source/Radar_delictual/radar-data/data/processed/cead_geographic_score_v1.json';
  const state={bridge:null,dataSource:'Supabase · obs_territory',territory:null,press:null,subjects:null,historyToken:0,pressToken:0,subjectToken:0};
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const fmt=(v,d=0)=>Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const scoreBand=v=>!Number.isFinite(Number(v))?'Sin cálculo':Number(v)>=80?'Muy alto':Number(v)>=60?'Alto':Number(v)>=40?'Medio':Number(v)>=20?'Bajo':'Muy bajo';
  const scoreColor=v=>!Number.isFinite(Number(v))?'#26384b':Number(v)>=80?'#f04f4f':Number(v)>=60?'#f47b35':Number(v)>=40?'#f4bc57':Number(v)>=20?'#6fd6e5':'#4f9ed8';
  const currentValue=r=>{
    const key=q('#atiLayer')?.value||'score';
    return key==='score'?Number(r?.score):Number(r?.layers?.[key]?.score);
  };
  const layerLabel=key=>({score:'Índice de Riesgo Geográfico (IGR)',predicate_direct:'Delito base directo',criminal_economy:'Economía criminal',criminogenic_context:'Contexto criminógeno'}[key]||'IGR');

  function ensureBridge(){
    try{if(window.parent?.AtlasTerritoryIntelligenceBridge)return Promise.resolve(window.parent.AtlasTerritoryIntelligenceBridge);}catch(_e){}
    return new Promise((resolve,reject)=>{
      let pw,pd;try{pw=window.parent;pd=pw.document;}catch(_e){reject(new Error('No fue posible acceder a la sesión principal de ATLAS.'));return;}
      if(pw===window){reject(new Error('Territorio debe abrirse desde ATLAS para consultar Supabase.'));return;}
      const done=()=>pw.AtlasTerritoryIntelligenceBridge?resolve(pw.AtlasTerritoryIntelligenceBridge):reject(new Error('El puente territorial no quedó disponible.'));
      const old=pd.querySelector('script[data-atlas-territory-intelligence-bridge]');
      if(old){if(pw.AtlasTerritoryIntelligenceBridge){done();return;}old.addEventListener('load',done,{once:true});old.addEventListener('error',()=>reject(new Error('No se pudo cargar el puente territorial.')),{once:true});return;}
      const s=pd.createElement('script');s.src='./assets/atlas-territory-intelligence-bridge-1010.js?v=1010-1';s.dataset.atlasTerritoryIntelligenceBridge='1';s.addEventListener('load',done,{once:true});s.addEventListener('error',()=>reject(new Error('No se pudo cargar el puente territorial.')),{once:true});pd.body.appendChild(s);
    });
  }

  function adaptFallback(raw){
    return (Array.isArray(raw)?raw:[]).map(r=>({
      territory_id:r.territory_id||`CL-${r.commune_code||''}`,region_code:String(r.region_code||''),region_name:String(r.region_name||''),commune_code:String(r.commune_code||'').padStart(5,'0'),commune_name:String(r.commune_name||''),year:Number(r.year||2025),period:String(r.period||r.year||2025),score:Number(r.score),igr_score:Number(r.score),level:String(r.level||scoreBand(r.score)),confidence:Number(r.confidence),layer_weights:r.layer_weights||{},layers:r.layers||{},interpretation:String(r.interpretation||''),score_version:String(r.score_version||'1.0.0'),ctx_entities:0,ctx_uaf_observed:0,ctx_findings:0,snapshot_id:'RADAR-DELCTUAL-FALLBACK',refreshed_at:null
    })).filter(r=>r.commune_name&&Number.isFinite(r.score));
  }

  function geoName(properties){for(const key of ['COMUNA','Comuna','comuna','NOM_COMUNA','NOM_COM','NAME_3','name','Nombre'])if(properties?.[key])return String(properties[key]);return ''}
  function rowForName(name){const n=normalize(name);return rows.find(r=>normalize(r.commune_name)===n)||null}
  function featureForRow(row){if(!geolayer||!row)return null;let out=null;geolayer.eachLayer(l=>{if(!out&&normalize(geoName(l.feature?.properties))===normalize(row.commune_name))out=l;});return out}
  function featureStyle(feature){
    const r=rowForName(geoName(feature.properties)),v=currentValue(r),active=selected&&r&&String(selected.commune_code)===String(r.commune_code);
    const reg=q('#atiRegion')?.value||'ALL',term=normalize(q('#atiSearch')?.value||'');
    const visible=(!term||normalize(r?.commune_name).includes(term))&&(reg==='ALL'||r?.region_name===reg);
    return {color:active?'#f6fbff':'#263f58',weight:active?2.1:.55,fillColor:scoreColor(v),fillOpacity:visible?(Number.isFinite(v)?.88:.08):.035,opacity:visible?1:.12};
  }
  function tooltipHtml(r,name){
    if(!r)return `<div class="ati-map-tooltip"><b>${safe(name)}</b>Sin cálculo</div>`;
    return `<div class="ati-map-tooltip"><b>${safe(r.commune_name)}</b><span>${fmt(currentValue(r),1)} · ${safe(scoreBand(currentValue(r)))}</span><br><small>${safe(r.region_name)}</small></div>`;
  }
  function bindFeature(feature,layer){
    const name=geoName(feature.properties),r=rowForName(name);layer.bindTooltip(tooltipHtml(r,name),{sticky:true,direction:'top',opacity:1});
    layer.on({mouseover:e=>e.target.setStyle({weight:1.5,color:'#f4f8fc',fillOpacity:.98}),mouseout:e=>geolayer?.resetStyle(e.target),click:e=>{if(!r)return;selectRow(r,{zoom:false});map.fitBounds(e.target.getBounds(),{padding:[34,34],maxZoom:8});}});
  }
  function refreshMap(){if(!geolayer)return;geolayer.setStyle(featureStyle);geolayer.eachLayer(l=>{const name=geoName(l.feature?.properties),r=rowForName(name);l.setTooltipContent(tooltipHtml(r,name));});}

  function fillFilters(){
    const years=[...new Set(rows.map(r=>r.year).filter(Boolean))].sort((a,b)=>b-a);q('#atiYear').innerHTML=years.map(y=>`<option>${y}</option>`).join('')||'<option>2025</option>';
    const regions=[...new Set(rows.map(r=>r.region_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));q('#atiRegion').innerHTML='<option value="ALL">Todas las regiones</option>'+regions.map(r=>`<option>${safe(r)}</option>`).join('');
  }
  function sortedByScore(){return [...rows].filter(r=>Number.isFinite(Number(r.score))).sort((a,b)=>Number(b.score)-Number(a.score))}
  function rankingFor(r){const list=sortedByScore(),rank=list.findIndex(x=>String(x.commune_code)===String(r.commune_code))+1;const percentile=list.length>1?Math.round(100*(1-(rank-1)/(list.length-1))):100;return {rank,total:list.length,percentile};}
  function componentMeta(){return [
    ['predicate_direct','Delito base directo',55,'#f04f4f','◈'],
    ['criminal_economy','Economía criminal',35,'#f47b35','◉'],
    ['criminogenic_context','Contexto criminógeno',10,'#6fd6e5','⌘']
  ];}

  function renderSummary(){
    if(!selected)return;const r=selected,{rank,total,percentile}=rankingFor(r);
    q('#atiCommuneTitle').textContent=r.commune_name;q('#atiCommuneRegion').textContent=r.region_name;
    q('#atiKpis').innerHTML=`
      <div class="ati-kpi primary"><div><span class="ati-kpi-value">${fmt(r.score,1)}</span><span class="ati-band">${safe(r.level||scoreBand(r.score))}</span></div><span class="ati-kpi-label">Índice de Riesgo Geográfico (IGR)</span><span class="ati-kpi-meta">Versión ${safe(r.score_version||'1.0.0')}</span></div>
      <div class="ati-kpi"><span class="ati-kpi-value">${fmt(r.confidence,0)}%</span><span class="ati-kpi-label">Confianza del índice</span><span class="ati-kpi-meta">calidad y cobertura de evidencia</span></div>
      <div class="ati-kpi"><span class="ati-kpi-value">${rank} / ${total}</span><span class="ati-kpi-label">Ranking nacional</span><span class="ati-kpi-meta">orden relativo por IGR</span></div>
      <div class="ati-kpi"><span class="ati-kpi-value">P${percentile}</span><span class="ati-kpi-label">Percentil nacional</span><span class="ati-kpi-meta">posición comparativa</span></div>`;
    q('#atiComponents').innerHTML=componentMeta().map(([key,label,weight,color,icon])=>{
      const score=Number(r.layers?.[key]?.score);return `<div class="ati-component"><div class="ati-component-name"><span class="ati-component-icon">${icon}</span><span>${safe(label)} <small>(${weight}%)</small></span></div><div class="ati-bar"><i style="width:${Math.max(0,Math.min(100,score||0))}%;background:${color}"></i></div><strong>${fmt(score,1)}</strong></div>`;
    }).join('');
    const driverRows=[];for(const [key,label] of componentMeta().map(x=>[x[0],x[1]])){for(const c of r.layers?.[key]?.components||[])driverRows.push({label:c.label,score:Number(c.score),trend:Number(c.trend),layer:label});}
    driverRows.sort((a,b)=>(b.score||0)-(a.score||0));
    q('#atiDriverBrief').innerHTML=`<h3>Principales drivers observados</h3>${driverRows.slice(0,4).map(d=>`<div class="ati-driver-row"><span title="${safe(d.layer)}">${safe(d.label)}</span><strong>${fmt(d.score,1)}</strong></div>`).join('')||'<div class="ati-empty">Sin drivers desagregados.</div>'}`;
    const topTrend=[...driverRows].filter(x=>Number.isFinite(x.trend)).sort((a,b)=>b.trend-a.trend).slice(0,4);
    q('#atiDynamicBrief').innerHTML=`<h3>Mayor dinámica reciente</h3>${topTrend.map(d=>`<div class="ati-driver-row"><span>${safe(d.label)}</span><strong>${fmt(d.trend,1)}</strong></div>`).join('')||'<div class="ati-empty">Sin tendencia comparable.</div>'}`;
    const fresh=r.refreshed_at?new Date(r.refreshed_at).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}):'corte 2025';q('#atiFreshness').innerHTML=`<span class="ati-live-dot"></span><span>${safe(state.dataSource)} · ${safe(fresh)}</span>`;
  }

  function renderPeers(){
    if(!selected)return;const candidates=rows.filter(r=>r.region_name===selected.region_name&&Number.isFinite(r.score)).sort((a,b)=>Number(b.score)-Number(a.score));
    const chosen=[selected,...candidates.filter(r=>r.commune_code!==selected.commune_code).slice(0,4)];
    q('#atiPeers').innerHTML=chosen.map(r=>`<div class="ati-peer ${r.commune_code===selected.commune_code?'selected':''}" data-code="${safe(r.commune_code)}"><span class="ati-peer-name">${safe(r.commune_name)}</span><div class="ati-bar"><i style="width:${Math.max(3,Math.min(100,Number(r.score)||0))}%;background:${scoreColor(r.score)}"></i></div><strong>${fmt(r.score,1)}</strong></div>`).join('');
    qa('.ati-peer').forEach(el=>el.addEventListener('click',()=>{const r=rows.find(x=>String(x.commune_code)===el.dataset.code);if(r)selectRow(r,{zoom:true});}));
  }

  function trendSvg(data){
    const clean=(data||[]).filter(d=>Number.isFinite(Number(d.score)));if(!clean.length)return '<div class="ati-empty">Sin serie histórica comparable.</div>';
    const W=330,H=145,p={l:28,r:10,t:17,b:23},min=0,max=100,x=i=>p.l+i*((W-p.l-p.r)/Math.max(1,clean.length-1)),y=v=>p.t+(max-v)/(max-min)*(H-p.t-p.b);
    const pts=clean.map((d,i)=>`${x(i)},${y(Number(d.score))}`).join(' '),area=`${p.l},${H-p.b} ${pts} ${x(clean.length-1)},${H-p.b}`;
    return `<div class="ati-trend-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución IGR 2020 a 2025"><defs><linearGradient id="atiTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f47b35" stop-opacity=".48"/><stop offset="1" stop-color="#f47b35" stop-opacity="0"/></linearGradient></defs>${[0,25,50,75,100].map(v=>`<line x1="${p.l}" y1="${y(v)}" x2="${W-p.r}" y2="${y(v)}" class="ati-gridline"/><text x="2" y="${y(v)+3}" class="ati-chart-label">${v}</text>`).join('')}<polygon points="${area}" class="ati-trend-area"/><polyline points="${pts}" class="ati-trend-line"/>${clean.map((d,i)=>`<circle cx="${x(i)}" cy="${y(Number(d.score))}" r="3.7" class="ati-trend-dot"/><text x="${x(i)}" y="${H-7}" text-anchor="middle" class="ati-chart-label">${d.year}</text>`).join('')}</svg></div>`;
  }
  async function renderHistory(){
    const token=++state.historyToken;q('#atiTrend').innerHTML='<div class="ati-loading">Preparando serie CEAD 2020–2025…</div>';
    try{
      const h=await loadHistoricalData();if(token!==state.historyToken||!selected)return;const code=String(selected.commune_code||'').padStart(5,'0');const annual=h.scores?.get(code)||[];q('#atiTrend').innerHTML=trendSvg(annual);
    }catch(e){if(token!==state.historyToken)return;q('#atiTrend').innerHTML=`<div class="ati-empty">Serie histórica no disponible en este momento.<br>${safe(e?.message||'')}</div>`;}
  }

  function mediaMark(name){const n=normalize(name);if(n.includes('BIOBIO'))return 'BB';if(n.includes('TERCERA'))return 'LT';if(n.includes('EMOL'))return 'emol';if(n.includes('DF')||n.includes('DIARIO FINANCIERO'))return 'DF';if(n.includes('MOSTRADOR'))return 'EM';return String(name||'MEDIO').replace(/[^A-Za-z0-9]/g,'').slice(0,5)||'NEWS';}
  async function renderContextAndPress(){
    if(!selected)return;const r=selected,subjectToken=++state.subjectToken,pressToken=++state.pressToken;
    q('#atiContext').innerHTML=`<div class="ati-context-kpi"><b>${fmt(r.ctx_entities)}</b><span>Entidades observadas</span></div><div class="ati-context-kpi"><b>…</b><span>Sujetos UAF</span></div><div class="ati-context-kpi"><b>${fmt(r.ctx_findings)}</b><span>Hallazgos en fuentes</span></div><div class="ati-context-kpi"><b>…</b><span>Noticias geolocalizadas</span></div>`;
    q('#atiNews').innerHTML='<div class="ati-loading">Consultando prensa territorial…</div>';
    try{
      const [subjectsResult,pressResult]=await Promise.allSettled([state.bridge?.subjects(r.commune_name),state.bridge?.pressFor({commune:r.commune_name,region:r.region_name,limit:20})]);
      if(subjectToken!==state.subjectToken||pressToken!==state.pressToken)return;
      state.subjects=subjectsResult.status==='fulfilled'?subjectsResult.value:null;state.press=pressResult.status==='fulfilled'?pressResult.value:null;
      const subjectCount=state.subjects?.total??r.ctx_uaf_observed??0,articles=state.press?.articles||[];
      q('#atiContext').innerHTML=`<div class="ati-context-kpi"><b>${fmt(r.ctx_entities)}</b><span>Entidades observadas</span><em>Atlas</em></div><div class="ati-context-kpi"><b>${fmt(subjectCount)}</b><span>Sujetos UAF</span><em>cobertura registral</em></div><div class="ati-context-kpi"><b>${fmt(r.ctx_findings)}</b><span>Hallazgos en fuentes</span><em>contexto, no score</em></div><div class="ati-context-kpi"><b>${fmt(articles.length)}</b><span>Noticias geolocalizadas</span><em>${safe(state.press?.matchLevel==='COMMUNE'?'comuna':state.press?.matchLevel==='REGION'?'región':'sin coincidencias')}</em></div>`;
      q('#atiNews').innerHTML=articles.length?articles.slice(0,3).map(a=>`<a class="ati-news" href="${safe(a.url||'#')}" ${a.url?'target="_blank" rel="noopener noreferrer"':''}><span class="ati-media">${safe(mediaMark(a.media))}</span><span><span class="ati-news-date">${safe(a.date||'s/f')} · ${safe(a.media)}</span><span class="ati-news-title">${safe(a.title)}</span></span></a>`).join(''):`<div class="ati-empty">Sin noticias con georreferencia para ${safe(r.commune_name)} o ${safe(r.region_name)} en el corte disponible del Monitor de Prensa.</div>`;
    }catch(e){q('#atiNews').innerHTML='<div class="ati-empty">La capa de prensa no está disponible. El IGR no se ve afectado.</div>';}
  }

  function selectRow(r,{zoom=false}={}){
    if(!r)return;selected=r;q('#atiSearch').value=r.commune_name;renderSummary();renderPeers();refreshMap();renderHistory();renderContextAndPress();
    if(zoom){const f=featureForRow(r);if(f)map.fitBounds(f.getBounds(),{padding:[35,35],maxZoom:8});}
  }
  function applyRegion(){
    refreshMap();const reg=q('#atiRegion').value;if(reg==='ALL'){map.fitBounds(geolayer.getBounds(),{padding:[8,8]});return;}let bounds=null;geolayer.eachLayer(l=>{const r=rowForName(geoName(l.feature?.properties));if(r?.region_name===reg)bounds=bounds?bounds.extend(l.getBounds()):l.getBounds();});if(bounds)map.fitBounds(bounds,{padding:[20,20],maxZoom:7});
  }
  function searchSelect(){const term=normalize(q('#atiSearch').value);if(!term){refreshMap();return;}const exact=rows.find(r=>normalize(r.commune_name)===term)||rows.find(r=>normalize(r.commune_name).includes(term));if(exact)selectRow(exact,{zoom:true});else refreshMap();}

  function openMethod(){q('#atiMethodPop').classList.add('open');q('#atiMethodPop').setAttribute('aria-hidden','false')}
  function closeMethod(){q('#atiMethodPop').classList.remove('open');q('#atiMethodPop').setAttribute('aria-hidden','true')}
  function installEvents(){
    q('#atiLayer').addEventListener('change',()=>{refreshMap();q('#atiMapMetric').textContent=layerLabel(q('#atiLayer').value);});
    q('#atiRegion').addEventListener('change',applyRegion);
    q('#atiSearch').addEventListener('input',()=>refreshMap());q('#atiSearch').addEventListener('keydown',e=>{if(e.key==='Enter')searchSelect()});q('#atiSearch').addEventListener('change',searchSelect);
    q('#atiMethodBtn').addEventListener('click',openMethod);q('#atiMethodClose').addEventListener('click',closeMethod);q('#atiMethodPop').addEventListener('click',e=>{if(e.target===q('#atiMethodPop'))closeMethod()});
  }

  async function init(){
    try{
      if(!window.L)throw new Error('Leaflet no está disponible.');
      try{state.bridge=await ensureBridge();state.territory=await state.bridge.all();rows=state.territory.rows;state.dataSource='Supabase · obs_territory';}
      catch(primaryError){const fallback=await fetch(FALLBACK_CEAD,{cache:'no-store'}).then(r=>{if(!r.ok)throw primaryError;return r.json()});rows=adaptFallback(fallback);state.dataSource='Radar Delictual · respaldo';}
      if(!rows.length)throw new Error('No existen comunas calculadas en el corte territorial.');
      fillFilters();
      try{L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:11,opacity:.72,attribution:''}).addTo(map);}catch(_e){}
      const geo=await fetch(GEOJSON,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(`GeoJSON HTTP ${r.status}`);return r.json()});
      geolayer=L.geoJSON(geo,{style:featureStyle,onEachFeature:bindFeature}).addTo(map);map.fitBounds(geolayer.getBounds(),{padding:[8,8]});
      selected=sortedByScore()[0]||rows[0];installEvents();selectRow(selected,{zoom:false});q('#atiMapMetric').textContent=layerLabel('score');
      window.AtlasTerritoryIntelligence1010={active:true,version:VERSION,state,selectByCommune:value=>{const r=rows.find(x=>normalize(x.commune_name)===normalize(value));if(r)selectRow(r,{zoom:true});return r||null;},rows:()=>rows};
      window.dispatchEvent(new CustomEvent('atlas:territory-intelligence-ready',{detail:{version:VERSION,communes:rows.length,source:state.dataSource}}));
    }catch(e){q('#atiWorkspace').innerHTML=`<div class="ati-error"><b>No fue posible iniciar Inteligencia Territorial.</b><br>${safe(e?.message||e)}</div>`;}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();