'use strict';

/* ATLAS AML 0.52.9 · Global Watchlists for Entity 360
 * - ICIJ Offshore Leaks via official reconciliation API.
 * - OpenSanctions via /match/default when an authorised API key exists server-side.
 * - OpenSanctions acts as the aggregation layer for sanctions, PEP/watchlists and debarment.
 * - Every name-based result remains a candidate for analyst review; this module never
 *   promotes canonical identity, mutates IPA3, or transfers risk.
 */
(function atlasEntityGlobalWatchlists0529(){
  const RELEASE='0.52.9',BUILD='0529',LIVE_FUNCTION='aml-entity-global-watchlists-live';
  const BASE_RENDER=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(!BASE_RENDER){window.__ATLAS_ENTITY_GLOBAL_WATCHLISTS_0529__={active:false,reason:'entity-renderer-unavailable'};return;}
  const TTL=5*60*1000,CACHE=new Map(),INFLIGHT=new Map();
  const FAMILIES=[
    ['UN_SANCTIONS','ONU'],['OFAC','OFAC'],['EU_SANCTIONS','UE'],['UK_SANCTIONS','UK'],
    ['WORLD_BANK','Banco Mundial'],['IDB_SANCTIONS','BID']
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=v=>v?String(v).slice(0,10):'—';
  const pct=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100)+'%':'—';};
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const selected=()=>{try{return (typeof state!=='undefined'?state:(window.state||null))?.selectedEntity||null;}catch(_e){return null;}};
  function packageFor(entity){const hit=CACHE.get(entity?.entity_id);return hit&&Date.now()-hit.loadedAt<TTL?hit:null;}
  function status(source){
    const s=String(source?.status||'unknown');
    if(s==='fresh'||s==='computed')return {label:'Live',cls:'ok'};
    if(s==='credential_missing')return {label:'Requiere credencial',cls:'warn'};
    if(s==='degraded')return {label:'Degradado',cls:'bad'};
    if(s==='no_name'||s==='no_identity')return {label:'Sin identidad suficiente',cls:'neutral'};
    return {label:'No materializado',cls:'neutral'};
  }
  function flatten(payload){
    const sources=payload?.sources||{},rows=[];
    Object.entries(sources).forEach(([code,source])=>{
      (Array.isArray(source?.records)?source.records:[]).forEach((r,i)=>rows.push({...r,source_code:r.source_code||code,source_record_id:r.source_record_id||`${code}:${i}`,checked_at:source?.checked_at||null}));
    });
    const seen=new Set();
    return rows.filter(r=>{const k=[r.source_code,r.source_record_id].join('|');if(seen.has(k))return false;seen.add(k);return true;});
  }
  async function fetchPackage(entity){
    const client=db();if(!client||!entity?.entity_id)return null;
    try{
      const {data,error}=await client.functions.invoke(LIVE_FUNCTION,{body:{name:entity?.name||'',rut:entity?.rut||'',entity_type:entity?.entity_type||''}});
      if(error)throw error;
      return {entityId:entity.entity_id,payload:data?.ok?data:null,records:flatten(data),error:data?.ok?null:(data?.error||'Respuesta global no válida'),loadedAt:Date.now()};
    }catch(error){return {entityId:entity.entity_id,payload:null,records:[],error:String(error?.message||error),loadedAt:Date.now()};}
  }
  async function hydrate(pkg){
    const id=pkg?.e?.entity_id;if(!id)return;
    if(INFLIGHT.has(id))return INFLIGHT.get(id);
    const job=(async()=>{const data=await fetchPackage(pkg.e);if(data)CACHE.set(id,data);if(selected()===id)paint(pkg,data);return data;})().finally(()=>INFLIGHT.delete(id));
    INFLIGHT.set(id,job);return job;
  }
  function sourceCard(code,title,source,records,copy){
    const st=status(source),confirmed=records.filter(r=>r.signal_status==='confirmed_match').length,possible=records.filter(r=>r.signal_status==='possible_match').length;
    const checked=source?.checked_at||records[0]?.checked_at||null;
    return `<article class="agw-source-card"><div class="agw-source-head"><div><b>${esc(title)}</b><small>${esc(copy)}</small></div><span class="agw-status ${st.cls}">${esc(st.label)}</span></div><div class="agw-source-metrics"><span><b>${possible}</b><small>candidatos</small></span><span><b>${confirmed}</b><small>confirmados por dato fuerte</small></span></div><footer><span>Consulta: ${esc(day(checked))}</span></footer></article>`;
  }
  function familyRail(payload,records){
    const os=payload?.sources?.OPENSANCTIONS||null;
    return `<div class="agw-family-rail">${FAMILIES.map(([code,label])=>{const n=records.filter(r=>r.source_code===code).length;const ready=os?.status==='fresh';return `<span class="${n?'hit':ready?'ready':'pending'}"><i></i><b>${esc(label)}</b><small>${n?`${n} candidato(s)`:ready?'sin candidato':'vía OpenSanctions'}</small></span>`;}).join('')}</div>`;
  }
  function evidenceRows(records){
    if(!records.length)return '<div class="agw-empty">No hay candidatos internacionales materializados para esta entidad en la consulta actual.</div>';
    return `<div class="agw-findings">${records.slice(0,18).map(r=>{const e=r.evidence||{};const source=r.source_code==='ICIJ_OFFSHORE'?'ICIJ Offshore Leaks':r.source_code;const tags=[...(Array.isArray(e.topics)?e.topics:[]),...(Array.isArray(e.datasets)?e.datasets:[])].slice(0,6);return `<article class="agw-finding"><div class="agw-finding-top"><span>${esc(source)}</span><strong>${esc(r.title||'Candidato internacional')}</strong><em>${r.match_confidence==null?'—':pct(r.match_confidence)}</em></div><p>${esc(r.summary||'Sin resumen adicional.')}</p>${tags.length?`<div class="agw-tags">${tags.map(t=>`<i>${esc(t)}</i>`).join('')}</div>`:''}<dl><dt>Estado</dt><dd>${esc(String(r.signal_status||'possible_match').replaceAll('_',' '))}</dd><dt>Método</dt><dd>${esc(r.match_method||'—')}</dd><dt>Regla identidad</dt><dd>candidato; requiere revisión</dd></dl>${r.source_url?`<a href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">Abrir evidencia de origen ↗</a>`:''}</article>`;}).join('')}</div>`;
  }
  function render(data){
    const payload=data?.payload||{},sources=payload?.sources||{},records=data?.records||[];
    const icijRecords=records.filter(r=>r.source_code==='ICIJ_OFFSHORE');
    const osRecords=records.filter(r=>r.source_code!=='ICIJ_OFFSHORE');
    const os=sources.OPENSANCTIONS||null;
    const keyMissing=os?.status==='credential_missing';
    return `<section class="agw-card" id="agw-global-watchlists"><header class="agw-main-head"><div><span class="agw-eyebrow">OSINT · LISTAS INTERNACIONALES</span><h3>Screening y exposición internacional</h3><p>ICIJ se consulta mediante su API oficial de reconciliación. OpenSanctions concentra listas de sanciones, PEP/watchlists y debarment; sus resultados se tratan como candidatos y no como identidad confirmada.</p></div><div class="agw-kpis"><span><b>${records.length}</b><small>candidatos</small></span><span><b>${new Set(records.map(r=>r.source_code)).size}</b><small>familias con hallazgo</small></span></div></header><div class="agw-grid">${sourceCard('ICIJ_OFFSHORE','ICIJ Offshore Leaks',sources.ICIJ_OFFSHORE,icijRecords,'Exposición offshore · reconciliación oficial')}${sourceCard('OPENSANCTIONS','OpenSanctions',os,osRecords,'Sanciones · PEP · watchlists · debarment')}</div>${familyRail(payload,records)}${keyMissing?'<div class="agw-license-note"><b>OpenSanctions listo, no activado.</b><span>El backend ya usa /match/default y espera una credencial OPENSANCTIONS_API_KEY autorizada. No se incrusta ni redistribuye el dataset sin validar su licencia aplicable.</span></div>':''}<section class="agw-evidence"><header><h4>Candidatos para revisión</h4><span>no promueven identidad ni alteran IPA3</span></header>${evidenceRows(records)}</section><div class="agw-rule"><b>Regla de lectura:</b> aparecer en una lista, dataset investigativo o resultado aproximado es una señal de exposición que debe verificarse con atributos adicionales; no implica por sí sola ilicitud, sanción vigente ni identidad canónica.</div>${data?.error?`<div class="agw-error">Conector no disponible: ${esc(data.error)}</div>`:''}</section>`;
  }
  function suppressLegacyInternationalPlaceholder(root){
    root.querySelectorAll('.aei-group').forEach(g=>{const h=g.querySelector('h4')?.textContent||'';if(h.includes('Exposición y screening internacional'))g.style.display='none';});
  }
  function paint(pkg,data){
    const root=document.querySelector('#content .a45');if(!root)return;
    suppressLegacyInternationalPlaceholder(root);
    const panel=root.querySelector('[data-a45-panel="evidence"]')||root.querySelector('[data-a45-panel="character"]');if(!panel)return;
    let holder=panel.querySelector('[data-agw-holder="global-watchlists"]');
    if(!holder){holder=document.createElement('div');holder.dataset.agwHolder='global-watchlists';holder.style.marginTop='16px';panel.appendChild(holder);}
    holder.innerHTML=data?render(data):'<section class="agw-card"><div class="agw-loading">Consultando listas internacionales y exposición offshore…</div></section>';
    window.__ATLAS_ENTITY_GLOBAL_WATCHLISTS_0529__={active:true,release:RELEASE,build:BUILD,entityId:pkg?.e?.entity_id||null,hydrated:!!data,scoreMutation:false,identityPromotion:false,riskTransfer:false,sources:['ICIJ_OFFSHORE','OPENSANCTIONS',...FAMILIES.map(x=>x[0])],errors:data?.error?[data.error]:[],renderedAt:new Date().toISOString()};
  }
  function decorate(pkg){if(!pkg?.e?.entity_id)return;const data=packageFor(pkg.e);paint(pkg,data);if(!data)void hydrate(pkg);}
  function wrappedRender(pkg,preserve=false){const result=BASE_RENDER(pkg,preserve);try{decorate(pkg);}catch(_e){}return result;}
  try{v0203RenderEntity=wrappedRender;}catch(_e){}window.v0203RenderEntity=wrappedRender;
  window.__ATLAS_ENTITY_GLOBAL_WATCHLISTS_0529__={active:true,release:RELEASE,build:BUILD,hydrated:false,scoreMutation:false,identityPromotion:false,installedAt:new Date().toISOString()};
})();