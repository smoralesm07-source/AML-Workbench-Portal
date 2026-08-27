'use strict';
/* ATLAS OSFL 0.93.3 · legal universe / observable territory correction
 * Keeps the legal national universe separate from the Atlas-observable subset.
 * Regional legal counts are used only when the Registro Civil master is fully loaded.
 */
(function atlasOsflRemoveEvidencePriority0931(){
  if(window.AtlasOsflRemoveEvidencePriority0931?.version==='0933.0')return;
  const VERSION='0933.0';
  const TITLE='priorizar con evidencia';
  const ENTITY_VIEW='aml_osfl_entity_runtime_snapshot';
  const BRIDGE_VIEW='aml_v_osfl_law19913_bridge_current';
  const NATIONAL_VIEW='aml_v_osfl_national_monitor_current';
  const NATIONAL_REGION_VIEW='aml_v_osfl_national_region_current';
  const ASSOCIATED_COPY=[
    'universo nacional de organizaciones sin fines de lucro',
    'lectura analitica, no conclusion',
    'datos autorizados por rls'
  ];
  const nf=new Intl.NumberFormat('es-CL');
  const MAP_SUMMARY_CACHE=new Map();
  let mapPatched=false;
  let hydrateTimer=0;

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const isBox=node=>node&&(node.tagName==='ARTICLE'||node.tagName==='SECTION'||node.tagName==='DIV');
  const copyMatch=node=>{
    const text=norm(node?.textContent);
    return ASSOCIATED_COPY.some(copy=>text.includes(copy));
  };
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=v=>{const n=num(v);return n===null?'—':nf.format(n);};
  const pct=(v,total)=>{const n=num(v),t=num(total);return n===null||!t?null:Math.max(0,Math.min(100,100*n/t));};
  const pctLabel=(v,total)=>{const p=pct(v,total);return p===null?'cobertura no disponible':`${p.toLocaleString('es-CL',{maximumFractionDigits:1})}%`;};
  const dateCL=v=>{
    if(!v)return '—';
    const d=new Date(`${String(v).slice(0,10)}T12:00:00`);
    return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('es-CL');
  };

  function ensureNoFlashStyle(){
    let style=document.querySelector('style[data-atlas-osfl-presentation-cleanup="0931"]');
    if(!style){
      style=document.createElement('style');
      style.dataset.atlasOsflPresentationCleanup='0931';
      document.head.appendChild(style);
    }
    style.textContent=[
      '.atlas-osfl-hero{display:none!important}',
      '.v030-hero.atlas-osfl-hero{display:none!important}',
      '[data-atlas-osfl-build].atlas-osfl-hero{display:none!important}'
    ].join('');
  }

  function ensureMapSummaryStyle(){
    let style=document.querySelector('style[data-atlas-osfl-map-summary="0933"]');
    if(style)return;
    style=document.createElement('style');
    style.dataset.atlasOsflMapSummary='0933';
    style.textContent=`
      .v030-map-card .atlas-osfl-map-summary{margin-top:14px;padding-top:15px;border-top:1px solid rgba(151,177,201,.28)}
      .atlas-osfl-map-summary-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:11px}
      .atlas-osfl-map-summary-head>div{display:grid;gap:3px}
      .atlas-osfl-map-summary-head span{font-size:10px;letter-spacing:.14em;font-weight:800;color:#76cfff;text-transform:uppercase}
      .atlas-osfl-map-summary-head b{font-size:15px;color:#edf5ff}
      .atlas-osfl-map-summary-head small{font-size:11px;color:#899db2;line-height:1.35}
      .atlas-osfl-map-scope{padding:6px 9px;border:1px solid #29445e;border-radius:999px;background:#0d1c2b;color:#9eb1c5!important;letter-spacing:.02em!important;text-transform:none!important;white-space:nowrap}
      .atlas-osfl-map-kpis{display:grid;grid-template-columns:1.28fr 1.12fr repeat(4,minmax(0,1fr));gap:9px}
      .atlas-osfl-map-kpi{min-width:0;min-height:112px;padding:12px 13px;border:1px solid #203a52;border-radius:11px;background:#0d1d2d;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
      .atlas-osfl-map-kpi.legal{background:linear-gradient(135deg,#12324b 0%,#0d1d2d 72%);border-color:#34719a}
      .atlas-osfl-map-kpi.observed{background:linear-gradient(135deg,#123229 0%,#0d1d2d 76%);border-color:#2f6a58}
      .atlas-osfl-map-kpi.potential{background:linear-gradient(135deg,#211d3a 0%,#111d2d 78%);border-color:#544c83}
      .atlas-osfl-map-kpi.direct{border-color:#2a5879}
      .atlas-osfl-map-kpi>span{font-size:9px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:#91a5b9}
      .atlas-osfl-map-kpi>b{font-size:27px;line-height:1;color:#eef6ff;margin:7px 0 4px}
      .atlas-osfl-map-kpi.legal>b{color:#69c7ff;font-size:31px}
      .atlas-osfl-map-kpi.observed>b{color:#7bd2a7;font-size:29px}
      .atlas-osfl-map-kpi.potential>b{color:#b4a0ff}
      .atlas-osfl-map-kpi.direct>b{color:#70cffd}
      .atlas-osfl-map-kpi>small{font-size:10px;line-height:1.35;color:#8398ad;min-height:27px}
      .atlas-osfl-map-kpi progress{width:100%;height:5px;margin-top:9px;border:0;border-radius:999px;overflow:hidden;background:#182d40}
      .atlas-osfl-map-kpi progress::-webkit-progress-bar{background:#182d40;border-radius:999px}
      .atlas-osfl-map-kpi progress::-webkit-progress-value{background:#60bfee;border-radius:999px}
      .atlas-osfl-map-kpi progress::-moz-progress-bar{background:#60bfee;border-radius:999px}
      .atlas-osfl-map-kpi.observed progress::-webkit-progress-value{background:#69c99b}
      .atlas-osfl-map-kpi.observed progress::-moz-progress-bar{background:#69c99b}
      .atlas-osfl-map-kpi.potential progress::-webkit-progress-value{background:#9c87f4}
      .atlas-osfl-map-kpi.potential progress::-moz-progress-bar{background:#9c87f4}
      .atlas-osfl-map-summary-rule{margin-top:9px;padding:9px 10px;border-radius:8px;background:#0b1926;color:#8296aa;font-size:10px;line-height:1.45}
      .atlas-osfl-map-summary-rule b{color:#a9bed2}
      .atlas-osfl-map-summary-rule strong{color:#e3edf7}
      @media(max-width:1200px){.atlas-osfl-map-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:760px){.atlas-osfl-map-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.atlas-osfl-map-summary-head{align-items:flex-start}}
      @media(max-width:600px){.atlas-osfl-map-kpis{grid-template-columns:1fr}.atlas-osfl-map-summary-head{display:grid}.atlas-osfl-map-scope{justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  function findCard(root,label){
    const ancestors=[];
    let node=label.parentElement;
    while(node&&node!==root){
      if(isBox(node)&&norm(node.textContent).includes(TITLE))ancestors.push(node);
      node=node.parentElement;
    }
    if(!ancestors.length)return null;
    const explicit=ancestors.find(el=>el.tagName==='ARTICLE'||/(^|[-_\s])(card|panel|module|box)([-_\s]|$)/i.test(el.className||''));
    if(explicit)return explicit;
    const complete=ancestors.find(el=>{
      const text=norm(el.textContent);
      return text.includes('completad')&&/\b\d+\s+de\s+\d+\b/.test(text);
    });
    return complete||ancestors[0];
  }

  function removeCard(){
    const root=document.querySelector('.v030-osfl')||document;
    const labels=[...root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,span,p')];
    const label=labels.find(el=>norm(el.textContent).includes(TITLE));
    if(!label)return false;
    const boundary=document.querySelector('.v030-osfl')||document.body;
    const card=findCard(boundary,label);
    if(!card)return false;
    const parent=card.parentElement;
    card.remove();
    if(parent&&parent!==boundary&&parent.children.length===0&&!norm(parent.textContent))parent.remove();
    if(boundary.dataset)boundary.dataset.atlasEvidencePriorityCard='removed';
    return true;
  }

  function removeOverviewHero(){
    let changed=false;
    document.querySelectorAll('.atlas-osfl-hero,.v030-hero.atlas-osfl-hero,[data-atlas-osfl-build].atlas-osfl-hero').forEach(hero=>{hero.remove();changed=true;});
    const root=document.querySelector('.v030-osfl');
    if(changed&&root)root.dataset.atlasOverviewHero='removed';
    return changed;
  }

  function removeAssociatedCopy(){
    const root=document.querySelector('.v030-osfl');
    if(!root&&!document.querySelector('.atlas-osfl-national,[data-v092-decision]'))return false;
    const scope=document.querySelector('#content,.v019-content,main')||document.body;
    const candidates=[...scope.querySelectorAll('p,small,span,div')].filter(copyMatch).filter(el=>![...el.children].some(copyMatch));
    let changed=false;
    for(const el of candidates){
      if(!el.isConnected)continue;
      const parent=el.parentElement;
      el.remove();changed=true;
      let node=parent;
      for(let depth=0;depth<3&&node&&node!==scope&&node!==root;depth++){
        const next=node.parentElement;
        if(!norm(node.textContent)&&node.children.length===0)node.remove();else break;
        node=next;
      }
    }
    if(changed&&root)root.dataset.atlasAssociatedCopy='removed';
    return changed;
  }

  function currentRegion(){
    try{return typeof V030_STATE!=='undefined'?String(V030_STATE.region||''):'';}catch(_){return '';}
  }
  function scopeLabel(){
    const region=currentRegion();
    if(!region)return 'Todo Chile';
    try{return typeof v030RegionShort==='function'?v030RegionShort(region):region;}catch(_){return region;}
  }
  function scoped(q){const region=currentRegion();return region?q.eq('region',region):q;}

  async function countEntity(mutator){
    let q=sb.from(ENTITY_VIEW).select('entity_id',{count:'exact',head:true});
    q=scoped(q);if(mutator)q=mutator(q);
    const res=await q;if(res.error)throw res.error;
    return Number(res.count||0);
  }
  async function countBridge(kind){
    let q=sb.from(BRIDGE_VIEW).select('entity_id',{count:'exact',head:true}).eq('bridge_class',kind);
    q=scoped(q);const res=await q;if(res.error)throw res.error;
    return Number(res.count||0);
  }
  async function loadNational(){
    const {data,error}=await sb.from(NATIONAL_VIEW)
      .select('legal_universe_count,official_active_total,atlas_observed,loaded_active,ingestion_status,legal_snapshot_date,atlas_legal_coverage_pct')
      .limit(1).maybeSingle();
    if(error)throw error;
    return data||{};
  }
  async function loadRegionStatus(region){
    if(!region)return null;
    const {data,error}=await sb.from(NATIONAL_REGION_VIEW)
      .select('region,legal_loaded,atlas_observed,legal_distribution_available,distribution_basis,map_primary_count')
      .eq('region',region).maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function loadMapSummary(force=false){
    const region=currentRegion();
    const key=region||'__ALL__';
    if(!force&&MAP_SUMMARY_CACHE.has(key))return MAP_SUMMARY_CACHE.get(key);
    const settled=await Promise.allSettled([
      loadNational(),
      loadRegionStatus(region),
      countEntity(),
      countEntity(q=>q.not('rut','is',null).neq('rut','')),
      countEntity(q=>q.not('activity_start_date','is',null)),
      countBridge('POTENTIAL_SUBJECT'),
      countEntity(q=>q.eq('is_uaf_observed',true))
    ]);
    const val=(i,fallback=null)=>settled[i].status==='fulfilled'?(settled[i].value??fallback):fallback;
    const national=val(0,{})||{};
    const regionStatus=val(1,null);
    const legalNational=num(national.legal_universe_count)??num(national.official_active_total);
    const legalRegional=regionStatus?.legal_distribution_available?num(regionStatus.legal_loaded):null;
    const observed=val(2,0);
    const data={
      scope:scopeLabel(),region,
      legalNational,legalRegional,
      legalShown:region&&legalRegional!==null?legalRegional:legalNational,
      legalLabel:region&&legalRegional!==null?'Universo jurídico región':'Universo jurídico Chile',
      observed,rut:val(3,0),started:val(4,0),potential:val(5,0),direct:val(6,0),
      ingestionStatus:String(national.ingestion_status||'UNKNOWN'),
      legalSnapshotDate:national.legal_snapshot_date||null,
      legalDistributionAvailable:Boolean(regionStatus?.legal_distribution_available),
      distributionBasis:regionStatus?.distribution_basis||'ATLAS_OBSERVED_ONLY'
    };
    MAP_SUMMARY_CACHE.set(key,data);
    return data;
  }

  function summarySkeleton(){
    return `<section class="atlas-osfl-map-summary" data-osfl-map-summary data-status="loading">
      <div class="atlas-osfl-map-summary-head"><div><span>UNIVERSO Y COBERTURA</span><b>Radiografía del universo OSFL</b><small>Separando universo jurídico, cobertura Atlas e indicadores analíticos.</small></div><span class="atlas-osfl-map-scope">${scopeLabel()}</span></div>
      <div class="atlas-osfl-map-kpis">
        <div class="atlas-osfl-map-kpi legal"><span>Universo jurídico Chile</span><b>—</b><small>consultando referencia oficial…</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi observed"><span>Observables Atlas</span><b>—</b><small>calculando cobertura…</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi"><span>Con RUT</span><b>—</b><small>identidad tributaria disponible</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi"><span>Inicio de actividades</span><b>—</b><small>fecha SII disponible</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi potential"><span>Potenciales SO</span><b>—</b><small>compatibilidad funcional</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi direct"><span>SO UAF</span><b>—</b><small>cruce registral exacto</small><progress max="100" value="0"></progress></div>
      </div>
      <div class="atlas-osfl-map-summary-rule"><b>Base territorial:</b> verificando disponibilidad del padrón jurídico regional…</div>
    </section>`;
  }

  function kpi(label,value,total,detail,kind=''){
    const p=pct(value,total);
    return `<div class="atlas-osfl-map-kpi ${kind}"><span>${label}</span><b>${fmt(value)}</b><small>${detail}</small><progress max="100" value="${p===null?0:p.toFixed(2)}"></progress></div>`;
  }

  function decorateMap(data){
    const card=document.querySelector('.v030-map-card');
    if(!card)return;
    const title=card.querySelector('.v030-card-head h3');
    const desc=card.querySelector('.v030-card-head p');
    const complete=data.ingestionStatus==='COMPLETE'&&data.legalDistributionAvailable;
    if(title)title.textContent=complete?'Distribución jurídica OSFL en Chile':'Distribución territorial · cobertura Atlas';
    if(desc){
      desc.textContent=complete
        ?'Los valores regionales corresponden al padrón jurídico vigente cargado en Atlas. Selecciona una región para filtrar el análisis.'
        :`Los valores regionales muestran OSFL individualizadas por Atlas. Universo jurídico nacional: ${fmt(data.legalNational)}; el desglose jurídico regional fila a fila sigue pendiente.`;
    }
    card.dataset.osflTerritoryBasis=complete?'LEGAL_MASTER_COMPLETE':'ATLAS_OBSERVED_ONLY';
  }

  function renderMapSummary(data){
    const root=document.querySelector('[data-osfl-map-summary]');if(!root)return false;
    const observedDenom=data.observed||null;
    const nationalScope=!data.region;
    const observedDetail=nationalScope
      ?`${pctLabel(data.observed,data.legalNational)} del universo jurídico nacional`
      :data.legalRegional!==null?`${pctLabel(data.observed,data.legalRegional)} del padrón jurídico regional`:'subconjunto Atlas en la región · denominador jurídico regional pendiente';
    const legalDetail=data.region&&data.legalRegional===null
      ?`referencia nacional · vigentes · corte ${dateCL(data.legalSnapshotDate)}`
      :`vigentes · corte ${dateCL(data.legalSnapshotDate)}`;
    const basis=data.ingestionStatus==='COMPLETE'&&data.legalDistributionAvailable
      ?'<strong>LEGAL_MASTER_COMPLETE</strong> · el mapa usa conteos jurídicos exactos por región.'
      :`<strong>ATLAS_OBSERVED_ONLY</strong> · las regiones no se extrapolan. El mapa muestra cobertura observable; el maestro Registro Civil permanece ${data.ingestionStatus}.`;
    root.dataset.status='ready';
    root.innerHTML=`
      <div class="atlas-osfl-map-summary-head"><div><span>UNIVERSO Y COBERTURA</span><b>Radiografía del universo OSFL</b><small>Universo jurídico, observabilidad e indicadores se presentan como capas distintas.</small></div><span class="atlas-osfl-map-scope">${data.scope}</span></div>
      <div class="atlas-osfl-map-kpis">
        ${kpi(data.legalLabel,data.legalShown,data.legalShown,legalDetail,'legal')}
        ${kpi('Observables Atlas',data.observed,nationalScope?data.legalNational:data.legalRegional,observedDetail,'observed')}
        ${kpi('Con RUT',data.rut,observedDenom,`${pctLabel(data.rut,observedDenom)} de observables · identidad tributaria`)}
        ${kpi('Inicio de actividades',data.started,observedDenom,`${pctLabel(data.started,observedDenom)} de observables · fecha SII`)}
        ${kpi('Potenciales SO',data.potential,observedDenom,`${pctLabel(data.potential,observedDenom)} de observables · compatibilidad funcional`,'potential')}
        ${kpi('SO UAF',data.direct,observedDenom,`${pctLabel(data.direct,observedDenom)} de observables · cruce exacto`,'direct')}
      </div>
      <div class="atlas-osfl-map-summary-rule"><b>Base territorial:</b> ${basis} <b>Regla:</b> ausencia del padrón regional no se interpreta como menor universo ni se reemplaza con estimaciones.</div>`;
    decorateMap(data);
    return true;
  }

  async function hydrateMapSummary(force=false){
    if(!document.querySelector('[data-osfl-map-summary]'))return;
    try{renderMapSummary(await loadMapSummary(force));}
    catch(err){
      const root=document.querySelector('[data-osfl-map-summary]');
      if(root){root.dataset.status='error';const small=root.querySelector('.atlas-osfl-map-summary-head small');if(small)small.textContent='No fue posible actualizar la radiografía para este corte.';}
      console.warn('[ATLAS OSFL] map summary:',err);
    }
  }
  function scheduleMapHydration(force=false){
    clearTimeout(hydrateTimer);
    hydrateTimer=setTimeout(()=>void hydrateMapSummary(force),60);
    setTimeout(()=>void hydrateMapSummary(force),260);
  }
  function injectSummaryIntoRenderedMap(){
    const card=document.querySelector('.v030-map-card');
    if(!card||card.querySelector('[data-osfl-map-summary]'))return false;
    const note=card.querySelector('.v030-map-note');if(!note)return false;
    note.insertAdjacentHTML('beforebegin',summarySkeleton());
    scheduleMapHydration();return true;
  }
  function installMapSummaryPatch(){
    ensureMapSummaryStyle();
    if(mapPatched||typeof v030Map!=='function')return false;
    const baseMap=v030Map;
    v030Map=function(){
      let html=baseMap.apply(this,arguments);
      if(typeof html!=='string')return html;
      if(!html.includes('data-osfl-map-summary')){
        const marker='<div class="v030-map-note">';
        html=html.includes(marker)?html.replace(marker,summarySkeleton()+marker):html;
      }
      scheduleMapHydration(true);return html;
    };
    mapPatched=true;injectSummaryIntoRenderedMap();return true;
  }

  function runCleanup(){
    ensureNoFlashStyle();ensureMapSummaryStyle();removeCard();removeOverviewHero();removeAssociatedCopy();installMapSummaryPatch();injectSummaryIntoRenderedMap();
  }
  let queued=false;
  function queueCleanup(){
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;runCleanup();});
  }
  function cleanup(){
    runCleanup();requestAnimationFrame(runCleanup);setTimeout(runCleanup,80);setTimeout(runCleanup,300);setTimeout(runCleanup,900);
  }
  function observeReinsertion(){
    const target=document.querySelector('#app')||document.body||document.documentElement;
    if(!target||window.__ATLAS_OSFL_PRESENTATION_OBSERVER_0931__)return;
    window.__ATLAS_OSFL_PRESENTATION_OBSERVER_0931__=new MutationObserver(queueCleanup);
    window.__ATLAS_OSFL_PRESENTATION_OBSERVER_0931__.observe(target,{childList:true,subtree:true});
  }

  ensureNoFlashStyle();ensureMapSummaryStyle();installMapSummaryPatch();
  if(typeof v030LoadOsfl==='function'){
    const baseLoad=v030LoadOsfl;
    v030LoadOsfl=async function(){const out=await baseLoad.apply(this,arguments);MAP_SUMMARY_CACHE.clear();cleanup();scheduleMapHydration(true);return out;};
  }
  if(typeof v030SyncMapAndCharts==='function'){
    const baseSync=v030SyncMapAndCharts;
    v030SyncMapAndCharts=async function(){const out=await baseSync.apply(this,arguments);MAP_SUMMARY_CACHE.delete(currentRegion()||'__ALL__');cleanup();scheduleMapHydration(true);return out;};
  }
  window.addEventListener('atlas:nav-refresh',()=>{cleanup();scheduleMapHydration(true);});
  window.addEventListener('pageshow',()=>{cleanup();scheduleMapHydration(true);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observeReinsertion();cleanup();scheduleMapHydration(true);},{once:true});
  else observeReinsertion();
  cleanup();
  setTimeout(()=>{installMapSummaryPatch();injectSummaryIntoRenderedMap();scheduleMapHydration(true);},1200);
  window.AtlasOsflRemoveEvidencePriority0931={version:VERSION,cleanup,removeCard,removeOverviewHero,removeAssociatedCopy,installMapSummaryPatch,hydrateMapSummary};
})();
