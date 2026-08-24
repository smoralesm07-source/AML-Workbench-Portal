'use strict';

/* ATLAS AML 0.52.0 · Entity Intelligence
 * Capa transversal de enriquecimiento externo para Entity 360.
 * No modifica IPA3 ni transfiere riesgo entre entidades.
 * Lee únicamente snapshots gobernados y salud de fuentes desde Supabase.
 */
(function atlasEntityIntelligence0520(){
  const RELEASE='0.52.0';
  const BUILD='0520';
  const BASE_RENDER=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(!BASE_RENDER){window.__ATLAS_ENTITY_INTELLIGENCE_0520__={active:false,reason:'entity-renderer-unavailable'};return;}
  const ENRICHMENT_TABLE='aml_entity_external_enrichment_snapshot';
  const HEALTH_TABLE='aml_external_source_health';
  const TTL=5*60*1000,CACHE=new Map(),INFLIGHT=new Map();
  const SOURCE_GROUPS=[
    {key:'national',title:'Conectores nacionales',codes:['MERCADO_PUBLICO','INFOLOBBY']},
    {key:'international',title:'Exposición y screening internacional',codes:['ICIJ_OFFSHORE','UN_SANCTIONS','OFAC','EU_SANCTIONS','UK_SANCTIONS','WORLD_BANK','IDB_SANCTIONS']},
    {key:'ondemand',title:'Profundización OSINT bajo demanda',codes:['SPIDERFOOT','MAIGRET']}
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};
  const day=v=>v?String(v).slice(0,10):'—';
  const selected=()=>{try{return (typeof state!=='undefined'?state:(window.state||null))?.selectedEntity||null;}catch(_error){return null;}};
  const soft=q=>Promise.resolve(q).then(v=>v,error=>({data:null,error}));
  function sourceStatus(row){
    if(!row)return {label:'No registrado',cls:'neutral'};
    if(row.integration_mode==='planned'&&!row.enabled)return {label:'Preparado',cls:'neutral'};
    if(row.data_status==='degraded'||row.software_status==='degraded')return {label:'Degradado',cls:'bad'};
    if(row.data_status==='stale'||row.software_status==='watch')return {label:'Vigilar',cls:'warn'};
    if(row.data_status==='fresh'||row.software_status==='healthy')return {label:'Operativo',cls:'ok'};
    return {label:row.enabled?'Sin diagnóstico':'Preparado',cls:'neutral'};
  }
  async function fetchPackage(entity){
    const client=db(),id=entity?.entity_id;if(!client||!id)return null;
    const [enrichment,health]=await Promise.all([
      soft(client.from(ENRICHMENT_TABLE).select('*').eq('entity_id',id).order('refreshed_at',{ascending:false}).limit(100)),
      soft(client.from(HEALTH_TABLE).select('*').order('source_name',{ascending:true}))
    ]);
    return {entityId:id,enrichment:Array.isArray(enrichment?.data)?enrichment.data:[],health:Array.isArray(health?.data)?health.data:[],errors:[enrichment?.error,health?.error].filter(Boolean).map(e=>String(e?.message||e)),loadedAt:Date.now()};
  }
  async function hydrate(pkg){
    const id=pkg?.e?.entity_id;if(!id)return;if(INFLIGHT.has(id))return INFLIGHT.get(id);
    const job=(async()=>{const data=await fetchPackage(pkg.e);if(data)CACHE.set(id,data);if(selected()===id)paint(pkg,data);return data;})().finally(()=>INFLIGHT.delete(id));
    INFLIGHT.set(id,job);return job;
  }
  function packageFor(entity){const hit=CACHE.get(entity?.entity_id);return hit&&Date.now()-hit.loadedAt<TTL?hit:null;}
  function sourceCard(row,signals){
    const status=sourceStatus(row),confirmed=signals.filter(s=>['observed','confirmed_match'].includes(s.signal_status)),possible=signals.filter(s=>s.signal_status==='possible_match');
    const lastSignal=signals[0]?.refreshed_at||null,lastIngest=row?.last_successful_ingest_at||null;
    return `<article class="aei-source-card"><div class="aei-source-head"><div><b>${esc(row?.source_name||signals[0]?.source_code||'Fuente')}</b><small>${esc(row?.source_class||'fuente externa')}</small></div><span class="aei-status ${status.cls}">${esc(status.label)}</span></div><div class="aei-source-metrics"><span><b>${confirmed.length}</b><small>hallazgos</small></span><span><b>${possible.length}</b><small>posibles match</small></span></div><p>${signals.length?esc(signals[0]?.summary||signals[0]?.title||'Existe evidencia materializada para esta entidad.'):'Sin hallazgos materializados para esta entidad.'}</p><footer><span>Último dato: ${esc(day(row?.last_source_record_at||lastSignal))}</span><span>Última ingesta: ${esc(day(lastIngest))}</span></footer></article>`;
  }
  function signalRows(signals){
    if(!signals.length)return '<div class="aei-empty">No existen enriquecimientos externos materializados para esta entidad en el corte actual.</div>';
    return `<div class="aei-findings">${signals.slice(0,12).map(s=>`<div class="aei-finding"><div><span class="aei-source-code">${esc(s.source_code)}</span><b>${esc(s.title||s.signal_type||'Hallazgo externo')}</b></div><p>${esc(s.summary||'Sin resumen adicional.')}</p><dl><dt>Estado</dt><dd>${esc(String(s.signal_status||'—').replaceAll('_',' '))}</dd><dt>Confianza</dt><dd>${s.match_confidence==null?'—':Math.round(Number(s.match_confidence)*100)+'%'}</dd><dt>Jurisdicción</dt><dd>${esc(s.jurisdiction||'—')}</dd><dt>Corte</dt><dd>${esc(day(s.refreshed_at))}</dd></dl></div>`).join('')}</div>`;
  }
  function render(data){
    const healthByCode=new Map((data?.health||[]).map(r=>[r.source_code,r])),bySource=new Map();
    (data?.enrichment||[]).forEach(s=>{if(!bySource.has(s.source_code))bySource.set(s.source_code,[]);bySource.get(s.source_code).push(s);});
    const groups=SOURCE_GROUPS.map(g=>`<section class="aei-group"><header><h4>${esc(g.title)}</h4></header><div class="aei-source-grid">${g.codes.map(code=>sourceCard(healthByCode.get(code),bySource.get(code)||[])).join('')}</div></section>`).join('');
    const signals=data?.enrichment||[];
    return `<section class="aei-card" id="aei-entity-intelligence"><header class="aei-main-head"><div><span class="aei-eyebrow">ENTITY INTELLIGENCE</span><h3>Inteligencia externa de la entidad</h3><p>Enriquecimiento separado del score IPA3. Una coincidencia, relación o sanción externa no transfiere riesgo ni constituye conclusión AML.</p></div><div class="aei-kpis"><span><b>${signals.length}</b><small>registros</small></span><span><b>${new Set(signals.map(s=>s.source_code)).size}</b><small>fuentes con datos</small></span></div></header>${groups}<section class="aei-evidence"><header><h4>Evidencia materializada</h4><span>${esc(ENRICHMENT_TABLE)}</span></header>${signalRows(signals)}</section>${data?.errors?.length?`<div class="aei-error">Bloques no disponibles: ${esc(data.errors.join(' · '))}</div>`:''}</section>`;
  }
  function paint(pkg,data){
    const root=document.querySelector('#content .a45');if(!root)return;const panel=root.querySelector('[data-a45-panel="evidence"]')||root.querySelector('[data-a45-panel="character"]');if(!panel)return;
    let holder=panel.querySelector('[data-aei-holder="entity-intelligence"]');if(!holder){holder=document.createElement('div');holder.dataset.aeiHolder='entity-intelligence';holder.style.marginTop='16px';panel.appendChild(holder);}
    holder.innerHTML=data?render(data):'<section class="aei-card"><div class="aei-loading">Consultando inteligencia externa gobernada…</div></section>';
    window.__ATLAS_ENTITY_INTELLIGENCE_0520__={active:true,release:RELEASE,build:BUILD,entityId:pkg?.e?.entity_id||null,hydrated:!!data,sources:SOURCE_GROUPS.flatMap(g=>g.codes),errors:data?.errors||[],renderedAt:new Date().toISOString()};
  }
  function decorate(pkg){if(!pkg?.e?.entity_id)return;const data=packageFor(pkg.e);paint(pkg,data);if(!data)void hydrate(pkg);}
  function wrappedRender(pkg,preserve=false){const result=BASE_RENDER(pkg,preserve);try{decorate(pkg);}catch(_error){}return result;}
  try{v0203RenderEntity=wrappedRender;}catch(_error){}window.v0203RenderEntity=wrappedRender;
  window.__ATLAS_ENTITY_INTELLIGENCE_0520__={active:true,release:RELEASE,build:BUILD,hydrated:false,cachePolicy:'MEMORY_ONLY',scoreMutation:false,installedAt:new Date().toISOString()};
})();