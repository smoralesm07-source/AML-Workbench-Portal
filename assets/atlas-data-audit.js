(function atlasDataAuditV0457(){
  'use strict';
  const PIPELINE='SOURCE_FRESHNESS';
  const TTL=5*60*1000;
  let cache=null;
  let cacheAt=0;
  let inflight=null;
  let retries=0;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusMeta=status=>({
    GREEN:{cls:'green',label:'AL DÍA'},
    YELLOW:{cls:'yellow',label:'REVISAR'},
    RED:{cls:'red',label:'SIN ACTUALIZACIÓN'}
  })[String(status||'').toUpperCase()]||{cls:'info',label:'SIN ESTADO'};
  const dot=(status,title='')=>{const m=statusMeta(status);return `<span class="a57-light ${m.cls}"${title?` title="${esc(title)}"`:''}></span>`;};

  function dt(v,withTime=false){
    if(!v)return '—';
    const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);
    try{return new Intl.DateTimeFormat('es-CL',withTime?{timeZone:'America/Santiago',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}:{timeZone:'America/Santiago',day:'2-digit',month:'short',year:'numeric'}).format(d);}
    catch{return String(v);}
  }
  function recordDate(row){
    const label=String(row?.latest_record_label||'').trim();
    if(/^20\d{2}-\d{2}$/.test(label)){
      const [y,m]=label.split('-').map(Number);
      try{return new Intl.DateTimeFormat('es-CL',{month:'short',year:'numeric',timeZone:'America/Santiago'}).format(new Date(Date.UTC(y,m-1,15)));}catch{}
    }
    if(/^20\d{2}-\d{2}-\d{2}$/.test(label))return dt(`${label}T12:00:00Z`);
    return dt(row?.latest_record_at||row?.last_capture_at);
  }
  function cadence(minutes){
    const n=Number(minutes)||0;
    if(n>=43200)return 'mensual';
    if(n>=10080)return 'semanal';
    if(n>=1440)return n===1440?'diaria':`${Math.round(n/1440)} días`;
    if(n>=60)return `cada ${Math.round(n/60)} h`;
    return n?`cada ${n} min`:'—';
  }
  function safeSources(row){return Array.isArray(row?.detail?.sources)?row.detail.sources:[];}
  function counts(sources){return sources.reduce((a,r)=>{const s=String(r.status||'').toUpperCase();if(s in a)a[s]++;return a;},{GREEN:0,YELLOW:0,RED:0});}
  function overall(sources){return sources.some(r=>r.status==='RED')?'RED':sources.some(r=>r.status==='YELLOW')?'YELLOW':'GREEN';}

  function loadingHtml(message='Consultando estado de fuentes…'){
    return `<section class="v024-audit a57-data-audit">
      <button type="button" class="v024-audit-summary" data-v024-audit-toggle aria-expanded="false">
        <span class="a57-title">${dot('INFO')}<span><strong>Auditoría de datos</strong><small>${esc(message)}</small></span></span>
        <span class="a57-summary-counts"><span class="a57-count">telemetría gobernada</span></span><span class="a57-chevron">⌄</span>
      </button><div class="v024-audit-detail" data-v024-audit-detail hidden><div class="a57-error">${esc(message)}</div></div>
    </section>`;
  }

  function auditHtml(state){
    const sources=safeSources(state);
    if(!sources.length)return loadingHtml(state?.error?'No fue posible leer la telemetría central.':'Esperando primera publicación del monitor central de frescura.');
    const c=counts(sources),ov=overall(sources),generated=state?.detail?.generated_at||state?.fusion_synced_at||state?.updated_at;
    const ovm=statusMeta(ov);
    return `<section class="v024-audit a57-data-audit ${ovm.cls}">
      <button type="button" class="v024-audit-summary" data-v024-audit-toggle aria-expanded="false">
        <span class="a57-title">${dot(ov)}<span><strong>Auditoría de datos</strong><small>Fuente, último dato disponible y verificación automática</small></span></span>
        <span class="a57-summary-counts">
          <span class="a57-count">${dot('GREEN')} ${c.GREEN} al día</span>
          <span class="a57-count">${dot('YELLOW')} ${c.YELLOW} revisar</span>
          <span class="a57-count">${dot('RED')} ${c.RED} sin actualización</span>
        </span><span class="a57-chevron">⌄</span>
      </button>
      <div class="v024-audit-detail" data-v024-audit-detail hidden>
        <div class="a57-audit-head"><span>Fuente consumida</span><span>Último registro disponible</span><span>Última verificación</span><span>Estado</span></div>
        ${sources.map(row=>{
          const m=statusMeta(row.status),reason=row.reason||'Sin detalle',repo=row?.detail?.repository||row.source_system||'—';
          return `<div class="a57-source-row" data-source-id="${esc(row.source_id||'')}">
            <div class="a57-source">${dot(row.status,reason)}<div class="a57-source-text"><b>${esc(row.label||row.source_system||row.source_id||'Fuente')}</b><small>${esc(row.source_system||repo)}</small></div></div>
            <div class="a57-cell"><b>${esc(recordDate(row))}</b><small>dato/corte más reciente materializado</small></div>
            <div class="a57-cell"><b>${esc(dt(row.last_checked_at,true))}</b><small>${esc(cadence(row.cadence_minutes))}</small></div>
            <div class="a57-cell"><span class="a57-state">${dot(row.status)}${esc(m.label)}</span><span class="a57-reason">${esc(reason)}</span></div>
          </div>`;
        }).join('')}
        <div class="a57-legend"><span>${dot('GREEN')} Verde: fuente revisada dentro de SLA y corte vigente.</span><span>${dot('YELLOW')} Amarillo: rezago o verificación atrasada.</span><span>${dot('RED')} Rojo: sin captura válida o sin actualización dentro del máximo permitido.</span><span class="a57-generated">Monitor: ${esc(dt(generated,true))}</span></div>
      </div>
    </section>`;
  }

  function bind(root=document){
    const button=root.querySelector?.('[data-v024-audit-toggle]');
    const detail=root.querySelector?.('[data-v024-audit-detail]');
    if(!button||!detail||button.dataset.a57Bound)return;
    button.dataset.a57Bound='1';
    button.addEventListener('click',()=>{
      const open=button.getAttribute('aria-expanded')==='true';
      button.setAttribute('aria-expanded',String(!open));detail.hidden=open;
    });
  }
  function decorate(){
    const old=document.querySelector('.v024-audit');
    if(!old)return false;
    const holder=document.createElement('div');holder.innerHTML=auditHtml(cache);const next=holder.firstElementChild;
    if(!next)return false;
    const wasOpen=old.querySelector('[data-v024-audit-toggle]')?.getAttribute('aria-expanded')==='true';
    old.replaceWith(next);
    const b=next.querySelector('[data-v024-audit-toggle]'),d=next.querySelector('[data-v024-audit-detail]');
    if(wasOpen&&b&&d){b.setAttribute('aria-expanded','true');d.hidden=false;}
    bind(next);return true;
  }
  function scheduleDecorate(){for(const delay of [0,180,700,1800])setTimeout(decorate,delay);}

  async function load(force=false){
    if(!force&&cache&&Date.now()-cacheAt<TTL)return cache;
    if(inflight)return inflight;
    inflight=(async()=>{
      try{
        if(typeof sb==='undefined'||!sb?.from)throw new Error('Sesión de datos aún no disponible');
        const {data,error}=await sb.from('aml_sync_state').select('pipeline,status,detail,updated_at,fusion_synced_at').eq('pipeline',PIPELINE).maybeSingle();
        if(error)throw error;
        cache=data||{detail:{sources:[]}};cacheAt=Date.now();retries=0;
      }catch(error){
        cache={error:String(error?.message||error),detail:{sources:[]}};cacheAt=Date.now();
      }finally{inflight=null;}
      scheduleDecorate();return cache;
    })();
    return inflight;
  }

  const legacyAudit=typeof v024AuditHtml==='function'?v024AuditHtml:null;
  const currentAudit=function(){return cache?auditHtml(cache):(legacyAudit?loadingHtml('Actualizando estado de todas las fuentes…'):loadingHtml());};
  try{v024AuditHtml=currentAudit;}catch(_e){}window.v024AuditHtml=currentAudit;

  const baseOverview=typeof v019LoadOverview==='function'?v019LoadOverview:null;
  if(baseOverview){
    const wrapped=async function(...args){const result=await baseOverview(...args);scheduleDecorate();void load();return result;};
    try{v019LoadOverview=wrapped;}catch(_e){}window.v019LoadOverview=wrapped;
    try{loadOverview=wrapped;}catch(_e){}window.loadOverview=wrapped;
  }

  function startup(){
    void load().then(()=>{if(!safeSources(cache).length&&retries<15){retries++;setTimeout(()=>{cache=null;cacheAt=0;startup();},2000);}});
    scheduleDecorate();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(startup,500),{once:true});else setTimeout(startup,500);
  setInterval(()=>void load(true),TTL);
  window.addEventListener('atlas:nav-refresh',scheduleDecorate);
  window.AtlasDataAudit={refresh:()=>load(true),render:auditHtml,getState:()=>cache,pipeline:PIPELINE,version:'0457'};
})();
