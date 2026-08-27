'use strict';
/* ATLAS OSFL 0.93.2 · presentation cleanup + territorial universe summary
 * Removes requested legacy OSFL presentation blocks and restores a compact,
 * governed universe profile below the territory map. No scoring semantics change.
 */
(function atlasOsflRemoveEvidencePriority0931(){
  if(window.AtlasOsflRemoveEvidencePriority0931)return;
  const VERSION='0932.0';
  const TITLE='priorizar con evidencia';
  const ENTITY_VIEW='aml_osfl_entity_runtime_snapshot';
  const BRIDGE_VIEW='aml_v_osfl_law19913_bridge_current';
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
  const pctLabel=(v,total)=>{const p=pct(v,total);return p===null?'cobertura no disponible':`${p.toLocaleString('es-CL',{maximumFractionDigits:1})}% del universo`;};

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
    if(document.querySelector('style[data-atlas-osfl-map-summary="0932"]'))return;
    const style=document.createElement('style');
    style.dataset.atlasOsflMapSummary='0932';
    style.textContent=`
      .v030-map-card .atlas-osfl-map-summary{margin-top:14px;padding-top:15px;border-top:1px solid rgba(151,177,201,.28)}
      .atlas-osfl-map-summary-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:11px}
      .atlas-osfl-map-summary-head>div{display:grid;gap:3px}
      .atlas-osfl-map-summary-head span{font-size:10px;letter-spacing:.14em;font-weight:800;color:#76cfff;text-transform:uppercase}
      .atlas-osfl-map-summary-head b{font-size:15px;color:#edf5ff}
      .atlas-osfl-map-summary-head small{font-size:11px;color:#899db2;line-height:1.35}
      .atlas-osfl-map-scope{padding:6px 9px;border:1px solid #29445e;border-radius:999px;background:#0d1c2b;color:#9eb1c5!important;letter-spacing:.02em!important;text-transform:none!important;white-space:nowrap}
      .atlas-osfl-map-kpis{display:grid;grid-template-columns:1.25fr repeat(4,minmax(0,1fr));gap:9px}
      .atlas-osfl-map-kpi{min-width:0;min-height:112px;padding:12px 13px;border:1px solid #203a52;border-radius:11px;background:#0d1d2d;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
      .atlas-osfl-map-kpi.total{background:linear-gradient(135deg,#102b43 0%,#0d1d2d 72%);border-color:#2a5879}
      .atlas-osfl-map-kpi.potential{background:linear-gradient(135deg,#211d3a 0%,#111d2d 78%);border-color:#544c83}
      .atlas-osfl-map-kpi.direct{border-color:#2a5879}
      .atlas-osfl-map-kpi>span{font-size:9px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:#91a5b9}
      .atlas-osfl-map-kpi>b{font-size:27px;line-height:1;color:#eef6ff;margin:7px 0 4px}
      .atlas-osfl-map-kpi.total>b{color:#69c7ff;font-size:31px}
      .atlas-osfl-map-kpi.potential>b{color:#b4a0ff}
      .atlas-osfl-map-kpi.direct>b{color:#70cffd}
      .atlas-osfl-map-kpi>small{font-size:10px;line-height:1.35;color:#8398ad;min-height:27px}
      .atlas-osfl-map-kpi progress{width:100%;height:5px;margin-top:9px;border:0;border-radius:999px;overflow:hidden;background:#182d40}
      .atlas-osfl-map-kpi progress::-webkit-progress-bar{background:#182d40;border-radius:999px}
      .atlas-osfl-map-kpi progress::-webkit-progress-value{background:#60bfee;border-radius:999px}
      .atlas-osfl-map-kpi progress::-moz-progress-bar{background:#60bfee;border-radius:999px}
      .atlas-osfl-map-kpi.potential progress::-webkit-progress-value{background:#9c87f4}
      .atlas-osfl-map-kpi.potential progress::-moz-progress-bar{background:#9c87f4}
      .atlas-osfl-map-summary-rule{margin-top:9px;padding:8px 10px;border-radius:8px;background:#0b1926;color:#8296aa;font-size:10px;line-height:1.4}
      .atlas-osfl-map-summary-rule b{color:#a9bed2}
      @media(max-width:980px){.atlas-osfl-map-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.atlas-osfl-map-kpi.total{grid-column:1/-1}.atlas-osfl-map-summary-head{align-items:flex-start}}
      @media(max-width:600px){.atlas-osfl-map-kpis{grid-template-columns:1fr}.atlas-osfl-map-kpi.total{grid-column:auto}.atlas-osfl-map-summary-head{display:grid}.atlas-osfl-map-scope{justify-self:start}}
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
    document.querySelectorAll('.atlas-osfl-hero,.v030-hero.atlas-osfl-hero,[data-atlas-osfl-build].atlas-osfl-hero').forEach(hero=>{
      hero.remove();
      changed=true;
    });
    const root=document.querySelector('.v030-osfl');
    if(changed&&root)root.dataset.atlasOverviewHero='removed';
    return changed;
  }

  function removeAssociatedCopy(){
    const root=document.querySelector('.v030-osfl');
    if(!root&&!document.querySelector('.atlas-osfl-national,[data-v092-decision]'))return false;
    const scope=document.querySelector('#content,.v019-content,main')||document.body;
    const candidates=[...scope.querySelectorAll('p,small,span,div')]
      .filter(copyMatch)
      .filter(el=>![...el.children].some(copyMatch));
    let changed=false;
    for(const el of candidates){
      if(!el.isConnected)continue;
      const parent=el.parentElement;
      el.remove();
      changed=true;
      let node=parent;
      for(let depth=0;depth<3&&node&&node!==scope&&node!==root;depth++){
        const next=node.parentElement;
        if(!norm(node.textContent)&&node.children.length===0)node.remove();
        else break;
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
  function scoped(q){
    const region=currentRegion();
    return region?q.eq('region',region):q;
  }
  async function countEntity(mutator){
    let q=sb.from(ENTITY_VIEW).select('entity_id',{count:'exact',head:true});
    q=scoped(q);
    if(mutator)q=mutator(q);
    const res=await q;
    if(res.error)throw res.error;
    return Number(res.count||0);
  }
  async function countBridge(kind){
    let q=sb.from(BRIDGE_VIEW).select('entity_id',{count:'exact',head:true}).eq('bridge_class',kind);
    q=scoped(q);
    const res=await q;
    if(res.error)throw res.error;
    return Number(res.count||0);
  }
  async function loadMapSummary(force=false){
    const key=currentRegion()||'__ALL__';
    if(!force&&MAP_SUMMARY_CACHE.has(key))return MAP_SUMMARY_CACHE.get(key);
    const settled=await Promise.allSettled([
      countEntity(),
      countEntity(q=>q.not('rut','is',null).neq('rut','')),
      countEntity(q=>q.not('activity_start_date','is',null)),
      countBridge('POTENTIAL_SUBJECT'),
      countEntity(q=>q.eq('is_uaf_observed',true))
    ]);
    const val=i=>settled[i].status==='fulfilled'?settled[i].value:null;
    const data={total:val(0),rut:val(1),started:val(2),potential:val(3),direct:val(4),scope:scopeLabel()};
    MAP_SUMMARY_CACHE.set(key,data);
    return data;
  }

  function summarySkeleton(){
    return `<section class="atlas-osfl-map-summary" data-osfl-map-summary data-status="loading">
      <div class="atlas-osfl-map-summary-head"><div><span>UNIVERSO E IDENTIFICACIÓN</span><b>Radiografía del universo OSFL</b><small>Identidad tributaria, trazabilidad SII y vínculo con el perímetro de la Ley 19.913.</small></div><span class="atlas-osfl-map-scope" data-osfl-map-scope>${scopeLabel()}</span></div>
      <div class="atlas-osfl-map-kpis">
        <div class="atlas-osfl-map-kpi total"><span>OSFL detectadas</span><b>—</b><small>calculando universo observable…</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi"><span>Con RUT</span><b>—</b><small>identidad tributaria disponible</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi"><span>Inicio de actividades</span><b>—</b><small>fecha de inicio SII disponible</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi potential"><span>Potenciales SO</span><b>—</b><small>compatibilidad funcional · no implica obligación</small><progress max="100" value="0"></progress></div>
        <div class="atlas-osfl-map-kpi direct"><span>SO UAF</span><b>—</b><small>cruce registral exacto por identidad</small><progress max="100" value="0"></progress></div>
      </div>
      <div class="atlas-osfl-map-summary-rule"><b>Lectura:</b> “potencial SO” identifica compatibilidad con actividades reguladas y sirve para revisión; solo el cruce exacto UAF se presenta como sujeto obligado registrado.</div>
    </section>`;
  }

  function kpi(label,value,total,detail,kind=''){
    const p=pct(value,total);
    return `<div class="atlas-osfl-map-kpi ${kind}"><span>${label}</span><b>${fmt(value)}</b><small>${detail}</small><progress max="100" value="${p===null?0:p.toFixed(2)}"></progress></div>`;
  }
  function renderMapSummary(data){
    const root=document.querySelector('[data-osfl-map-summary]');
    if(!root)return false;
    const total=data.total;
    root.dataset.status='ready';
    root.innerHTML=`
      <div class="atlas-osfl-map-summary-head"><div><span>UNIVERSO E IDENTIFICACIÓN</span><b>Radiografía del universo OSFL</b><small>Identidad tributaria, trazabilidad SII y vínculo con el perímetro de la Ley 19.913.</small></div><span class="atlas-osfl-map-scope">${data.scope||scopeLabel()}</span></div>
      <div class="atlas-osfl-map-kpis">
        ${kpi('OSFL detectadas',total,total,total===null?'universo no disponible':`${data.scope||scopeLabel()} · universo observable por Atlas`,'total')}
        ${kpi('Con RUT',data.rut,total,pctLabel(data.rut,total)+' · identidad tributaria disponible')}
        ${kpi('Inicio de actividades',data.started,total,pctLabel(data.started,total)+' · fecha SII disponible')}
        ${kpi('Potenciales SO',data.potential,total,pctLabel(data.potential,total)+' · compatibilidad funcional','potential')}
        ${kpi('SO UAF',data.direct,total,pctLabel(data.direct,total)+' · cruce registral exacto','direct')}
      </div>
      <div class="atlas-osfl-map-summary-rule"><b>Lectura:</b> “potencial SO” identifica compatibilidad con actividades reguladas y sirve para revisión; solo el cruce exacto UAF se presenta como sujeto obligado registrado.</div>`;
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
  function scheduleMapHydration(){
    clearTimeout(hydrateTimer);
    hydrateTimer=setTimeout(()=>void hydrateMapSummary(),60);
    setTimeout(()=>void hydrateMapSummary(),260);
  }
  function injectSummaryIntoRenderedMap(){
    const card=document.querySelector('.v030-map-card');
    if(!card||card.querySelector('[data-osfl-map-summary]'))return false;
    const note=card.querySelector('.v030-map-note');
    if(!note)return false;
    note.insertAdjacentHTML('beforebegin',summarySkeleton());
    scheduleMapHydration();
    return true;
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
      scheduleMapHydration();
      return html;
    };
    mapPatched=true;
    injectSummaryIntoRenderedMap();
    return true;
  }

  function runCleanup(){
    ensureNoFlashStyle();
    ensureMapSummaryStyle();
    removeCard();
    removeOverviewHero();
    removeAssociatedCopy();
    installMapSummaryPatch();
    injectSummaryIntoRenderedMap();
  }

  let queued=false;
  function queueCleanup(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      runCleanup();
    });
  }

  function cleanup(){
    runCleanup();
    requestAnimationFrame(runCleanup);
    setTimeout(runCleanup,80);
    setTimeout(runCleanup,300);
    setTimeout(runCleanup,900);
  }

  function observeReinsertion(){
    const target=document.querySelector('#app')||document.body||document.documentElement;
    if(!target||window.__ATLAS_OSFL_PRESENTATION_OBSERVER_0931__)return;
    window.__ATLAS_OSFL_PRESENTATION_OBSERVER_0931__=new MutationObserver(queueCleanup);
    window.__ATLAS_OSFL_PRESENTATION_OBSERVER_0931__.observe(target,{childList:true,subtree:true});
  }

  ensureNoFlashStyle();
  ensureMapSummaryStyle();
  installMapSummaryPatch();
  if(typeof v030LoadOsfl==='function'){
    const baseLoad=v030LoadOsfl;
    v030LoadOsfl=async function(){
      const out=await baseLoad.apply(this,arguments);
      cleanup();
      scheduleMapHydration();
      return out;
    };
  }
  if(typeof v030SyncMapAndCharts==='function'){
    const baseSync=v030SyncMapAndCharts;
    v030SyncMapAndCharts=async function(){
      const out=await baseSync.apply(this,arguments);
      cleanup();
      scheduleMapHydration();
      return out;
    };
  }
  window.addEventListener('atlas:nav-refresh',()=>{cleanup();scheduleMapHydration();});
  window.addEventListener('pageshow',()=>{cleanup();scheduleMapHydration();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observeReinsertion();cleanup();scheduleMapHydration();},{once:true});
  else observeReinsertion();
  cleanup();
  setTimeout(()=>{installMapSummaryPatch();injectSummaryIntoRenderedMap();scheduleMapHydration();},1200);
  window.AtlasOsflRemoveEvidencePriority0931={version:VERSION,cleanup,removeCard,removeOverviewHero,removeAssociatedCopy,installMapSummaryPatch,hydrateMapSummary};
})();
