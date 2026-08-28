'use strict';

/* ATLAS OSFL Growth Monitor 0.93.4
 * Annual growth over the largest row-level OSFL universe currently observable in Atlas.
 * Main series: reconstructed year-end observable stock from SII activity start / termination dates.
 * This is an observability proxy, not the historical legal stock of Registro Civil.
 */
(function atlasOsflGrowth0934(){
  if(window.__ATLAS_OSFL_GROWTH_0934__) return;
  window.__ATLAS_OSFL_GROWTH_0934__=true;

  const VIEW='aml_v_osfl_growth_yearly_current';
  const nf=new Intl.NumberFormat('es-CL');
  const state={rows:[],geo:'CHILE',period:'15',loaded:false};

  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const fmt=v=>{const x=Number(v);return Number.isFinite(x)?nf.format(Math.round(x)):'—';};
  const pct=(v,d=2)=>{const x=Number(v);return Number.isFinite(x)?`${x.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';};
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const client=()=>window.sb || (typeof sb!=='undefined'?sb:null);

  function shell(){
    return `<article class="osflg-card" data-osflg-root data-osflg-build="0934">
      <header class="osflg-head">
        <div>
          <span class="osflg-kicker">DINÁMICA TEMPORAL · OSFL</span>
          <h3>Crecimiento anual del universo observable</h3>
          <p>Variación interanual del stock reconstruido de OSFL según fecha de inicio de actividades SII. Selecciona una región para compararla con Chile.</p>
        </div>
        <div class="osflg-controls">
          <label>Territorio<select data-osflg-geo><option value="CHILE">Chile · país</option></select></label>
          <label>Ventana<select data-osflg-period><option value="10">10 años</option><option value="15" selected>15 años</option><option value="2000">Desde 2000</option></select></label>
        </div>
      </header>
      <div class="osflg-metrics" data-osflg-metrics><div class="osflg-loading">Cargando serie anual…</div></div>
      <div class="osflg-body">
        <section class="osflg-chart-panel">
          <div class="osflg-chart-head"><div><b data-osflg-chart-title>Chile</b><span>Tasa de crecimiento interanual</span></div><div class="osflg-legend" data-osflg-legend></div></div>
          <div class="osflg-chart" data-osflg-chart><div class="osflg-loading">Preparando gráfico…</div></div>
        </section>
        <aside class="osflg-ranking" data-osflg-ranking><div class="osflg-loading">Leyendo regiones…</div></aside>
      </div>
      <footer class="osflg-method" data-osflg-method></footer>
    </article>`;
  }

  function install(){
    const host=document.querySelector('[data-osfln-root]');
    if(!host) return false;
    if(host.querySelector('[data-osflg-root]')) return true;
    const anchor=host.querySelector('[data-osfln-funnel]');
    if(anchor) anchor.insertAdjacentHTML('afterend',shell());
    else host.insertAdjacentHTML('beforeend',shell());
    bind();
    if(state.loaded) render();
    else void hydrate();
    return true;
  }

  function bind(){
    const geo=document.querySelector('[data-osflg-geo]');
    const period=document.querySelector('[data-osflg-period]');
    if(geo && !geo.dataset.bound){
      geo.dataset.bound='1';
      geo.addEventListener('change',()=>{state.geo=geo.value;render();});
    }
    if(period && !period.dataset.bound){
      period.dataset.bound='1';
      period.value=state.period;
      period.addEventListener('change',()=>{state.period=period.value;render();});
    }
  }

  async function hydrate(){
    const c=client();
    const root=document.querySelector('[data-osflg-root]');
    if(!c){
      if(root) root.querySelector('[data-osflg-chart]').innerHTML='<div class="osflg-error">Cliente de datos no disponible.</div>';
      return;
    }
    try{
      const fields='scope,region,year,stock_year_end,starts,terminations,net_change,growth_pct,observed_universe,valid_start_count,series_eligible_count,regional_series_eligible_count,current_year_starts,current_year,last_complete_year';
      const {data,error}=await c.from(VIEW).select(fields).gte('year',2000).order('year',{ascending:true});
      if(error) throw error;
      state.rows=(data||[]).map(r=>({...r,year:n(r.year),stock_year_end:n(r.stock_year_end),starts:n(r.starts),terminations:n(r.terminations),net_change:n(r.net_change),growth_pct:r.growth_pct==null?null:n(r.growth_pct)}));
      state.loaded=true;
      populateRegions();
      render();
    }catch(err){
      if(root){
        const chart=root.querySelector('[data-osflg-chart]');
        if(chart) chart.innerHTML=`<div class="osflg-error"><b>No fue posible cargar el crecimiento OSFL</b><span>${esc(err?.message||String(err))}</span></div>`;
      }
    }
  }

  function populateRegions(){
    const select=document.querySelector('[data-osflg-geo]');
    if(!select) return;
    const regions=[...new Set(state.rows.filter(r=>r.scope==='REGION'&&r.region).map(r=>r.region))].sort((a,b)=>a.localeCompare(b,'es'));
    select.innerHTML='<option value="CHILE">Chile · país</option>'+regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
    select.value=regions.includes(state.geo)?state.geo:'CHILE';
    if(select.value!==state.geo) state.geo='CHILE';
  }

  function filtered(rows){
    if(!rows.length) return rows;
    const last=Math.max(...rows.map(r=>r.year));
    if(state.period==='2000') return rows.filter(r=>r.year>=2000);
    const years=Math.max(2,n(state.period));
    return rows.filter(r=>r.year>=last-years+1);
  }

  function series(scope,region){
    return state.rows.filter(r=>r.scope===scope && (scope==='CHILE'||r.region===region) && r.growth_pct!=null).sort((a,b)=>a.year-b.year);
  }

  function latestRow(scope,region){
    const rows=series(scope,region);
    return rows.length?rows[rows.length-1]:null;
  }

  function render(){
    const root=document.querySelector('[data-osflg-root]');
    if(!root || !state.loaded || !state.rows.length) return;
    bind();
    const country=filtered(series('CHILE'));
    const selected=state.geo==='CHILE'?country:filtered(series('REGION',state.geo));
    const selectedLatest=state.geo==='CHILE'?latestRow('CHILE'):latestRow('REGION',state.geo);
    const countryLatest=latestRow('CHILE');
    const meta=state.rows[0]||{};
    renderMetrics(root,selectedLatest,countryLatest,meta);
    renderChart(root,selected,country,state.geo);
    renderRanking(root,n(meta.last_complete_year)||countryLatest?.year||0);
    renderMethod(root,meta);
    const title=root.querySelector('[data-osflg-chart-title]');
    if(title) title.textContent=state.geo==='CHILE'?'Chile':state.geo;
    const geo=root.querySelector('[data-osflg-geo]');
    if(geo && geo.value!==state.geo) geo.value=state.geo;
  }

  function renderMetrics(root,row,country,meta){
    const el=root.querySelector('[data-osflg-metrics]');
    if(!el||!row) return;
    const dateCoverage=n(meta.observed_universe)?100*n(meta.valid_start_count)/n(meta.observed_universe):0;
    const delta=row.growth_pct-(country?.growth_pct||0);
    const compare=state.geo==='CHILE'?'último año completo':`${delta>=0?'+':''}${pct(delta,2)} vs Chile`;
    el.innerHTML=`
      <div><span>Tasa ${fmt(row.year)}</span><b>${pct(row.growth_pct,2)}</b><small>${esc(compare)}</small></div>
      <div><span>Stock observable</span><b>${fmt(row.stock_year_end)}</b><small>al cierre de ${fmt(row.year)}</small></div>
      <div><span>Inicios del año</span><b>+${fmt(row.starts)}</b><small>${row.terminations?`${fmt(row.terminations)} términos observados`:'sin términos observados en el corte'}</small></div>
      <div><span>Cobertura fecha</span><b>${pct(dateCoverage,1)}</b><small>${fmt(meta.valid_start_count)} de ${fmt(meta.observed_universe)}</small></div>
      <div class="osflg-ytd"><span>${fmt(meta.current_year)} YTD</span><b>+${fmt(meta.current_year_starts)}</b><small>inicios · fuera de la tasa anual</small></div>`;
  }

  function renderChart(root,main,country,geo){
    const el=root.querySelector('[data-osflg-chart]');
    const legend=root.querySelector('[data-osflg-legend]');
    if(!el||!main.length) return;
    const compare=geo==='CHILE'?[]:country.filter(c=>main.some(m=>m.year===c.year));
    const all=[...main,...compare].filter(r=>Number.isFinite(r.growth_pct));
    const W=760,H=278,L=52,R=18,T=18,B=38;
    const innerW=W-L-R,innerH=H-T-B;
    const years=main.map(r=>r.year);
    const minYear=Math.min(...years),maxYear=Math.max(...years);
    let minVal=Math.min(0,...all.map(r=>r.growth_pct));
    let maxVal=Math.max(1,...all.map(r=>r.growth_pct));
    const pad=Math.max(.35,(maxVal-minVal)*.12);
    minVal=Math.floor((minVal-pad)*2)/2;
    maxVal=Math.ceil((maxVal+pad)*2)/2;
    if(maxVal<=minVal) maxVal=minVal+1;
    const x=year=>L+(maxYear===minYear?innerW/2:(year-minYear)/(maxYear-minYear)*innerW);
    const y=value=>T+(maxVal-value)/(maxVal-minVal)*innerH;
    const path=rows=>rows.map((r,i)=>`${i?'L':'M'}${x(r.year).toFixed(1)},${y(r.growth_pct).toFixed(1)}`).join(' ');
    const ticks=4;
    const grids=Array.from({length:ticks+1},(_,i)=>{
      const value=maxVal-(maxVal-minVal)*i/ticks;
      const yy=y(value);
      return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="osflg-gridline"/><text x="${L-9}" y="${yy+4}" text-anchor="end" class="osflg-axis">${value.toLocaleString('es-CL',{maximumFractionDigits:1})}%</text>`;
    }).join('');
    const labelStep=years.length>18?4:years.length>11?2:1;
    const xlabels=years.map((yr,i)=>(i%labelStep===0||i===years.length-1)?`<text x="${x(yr)}" y="${H-12}" text-anchor="middle" class="osflg-axis">${yr}</text>`:'').join('');
    const zero=(minVal<0&&maxVal>0)?`<line x1="${L}" y1="${y(0)}" x2="${W-R}" y2="${y(0)}" class="osflg-zero"/>`:'';
    const comparePath=compare.length?`<path d="${path(compare)}" class="osflg-line osflg-line-country"/>`:'';
    const mainPath=`<path d="${path(main)}" class="osflg-line osflg-line-main"/>`;
    const points=main.map(r=>`<circle cx="${x(r.year)}" cy="${y(r.growth_pct)}" r="3.7" class="osflg-point"><title>${esc(geo==='CHILE'?'Chile':geo)} · ${r.year}: ${pct(r.growth_pct,2)} · stock ${fmt(r.stock_year_end)} · +${fmt(r.starts)} inicios</title></circle>`).join('');
    const comparePoints=compare.map(r=>`<circle cx="${x(r.year)}" cy="${y(r.growth_pct)}" r="2.4" class="osflg-point-country"><title>Chile · ${r.year}: ${pct(r.growth_pct,2)}</title></circle>`).join('');
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tasa anual de crecimiento de OSFL entre ${minYear} y ${maxYear}">${grids}${zero}${xlabels}${comparePath}${mainPath}${comparePoints}${points}</svg>`;
    if(legend) legend.innerHTML=geo==='CHILE'?'<span class="main">Chile</span>':'<span class="main">Región seleccionada</span><span class="country">Chile</span>';
  }

  function renderRanking(root,year){
    const el=root.querySelector('[data-osflg-ranking]');
    if(!el) return;
    const rows=state.rows.filter(r=>r.scope==='REGION'&&r.year===year&&r.growth_pct!=null).sort((a,b)=>b.growth_pct-a.growth_pct);
    const max=Math.max(1,...rows.map(r=>Math.max(0,r.growth_pct)));
    el.innerHTML=`<div class="osflg-ranking-head"><span>REGIONES · ${fmt(year)}</span><b>¿Dónde crece más?</b><small>Haz clic para comparar con Chile</small></div><div class="osflg-rank-list">${rows.map((r,i)=>`<button type="button" data-osflg-region="${esc(r.region)}" class="${state.geo===r.region?'active':''}"><em>${i+1}</em><span><b>${esc(shortRegion(r.region))}</b><i><u style="width:${Math.max(3,100*r.growth_pct/max)}%"></u></i></span><strong>${pct(r.growth_pct,2)}</strong></button>`).join('')}</div>`;
    el.querySelectorAll('[data-osflg-region]').forEach(btn=>btn.addEventListener('click',()=>{
      state.geo=btn.dataset.osflgRegion;
      const select=root.querySelector('[data-osflg-geo]');if(select)select.value=state.geo;
      render();
    }));
  }

  function shortRegion(region){
    return String(region||'').replace('Libertador Gral. Bernardo O\'Higgins','O’Higgins').replace('Magallanes y de la Antártica Chilena','Magallanes').replace('Aysén del General Carlos Ibáñez del Campo','Aysén').replace('Metropolitana de Santiago','Metropolitana');
  }

  function renderMethod(root,meta){
    const el=root.querySelector('[data-osflg-method]');
    if(!el) return;
    const regionalCoverage=n(meta.series_eligible_count)?100*n(meta.regional_series_eligible_count)/n(meta.series_eligible_count):0;
    el.innerHTML=`<div><b>Cómo leer la tasa</b><span>Stock al 31 de diciembre reconstruido con fecha de inicio de actividades y término SII; crecimiento = (stock año t / stock año t−1 − 1) × 100. El año ${fmt(meta.current_year)} queda fuera por estar incompleto.</span></div><div><b>Alcance territorial</b><span>${fmt(meta.regional_series_eligible_count)} OSFL con fecha y región utilizables (${pct(regionalCoverage,1)} de la serie elegible). La región corresponde a la asignación territorial actual observada por Atlas, no necesariamente a la región histórica en cada año.</span></div><div class="warning"><b>Límite metodológico</b><span>Este gráfico mide crecimiento del universo OSFL observable en Atlas/SII. No debe interpretarse como evolución histórica del padrón jurídico completo del Registro Civil mientras ese padrón siga en modo referencia y no esté cargado fila a fila.</span></div>`;
  }

  const observer=new MutationObserver(()=>install());
  if(document.body) observer.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
