'use strict';
/* ATLAS AML 0.53.6 · Auditoría y salud de fuentes */
(function atlasSourceHealthAudit0536(){
  const VERSION='SOURCE-HEALTH-AUDIT-0536.4',TTL=5*60*1000,FRESHNESS_PIPELINE='SOURCE_FRESHNESS';
  let ops=null,opsAt=0,inflight=null,activeTab='summary',loadState='loading',lastError=null,root=null,resState=null,resAt=0;
  let freshState=null,freshAt=0,freshInflight=null,freshError=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const dt=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return String(v)}};
  const day=v=>{if(!v)return '—';const s=String(v);return /^20\d{2}-\d{2}-\d{2}/.test(s)?s.slice(0,10):dt(v)};
  const status=s=>({healthy:{label:'OPERATIVO',cls:'ok'},watch:{label:'REVISAR',cls:'warn'},degraded:{label:'CAÍDO',cls:'bad'},unknown:{label:'SIN ESTADO',cls:'off'},fresh:{label:'AL DÍA',cls:'ok'},stale:{label:'REZAGADO',cls:'warn'},loading:{label:'CARGANDO',cls:'off'}}[String(s||'').toLowerCase()]||{label:String(s||'SIN ESTADO').toUpperCase(),cls:'off'});
  const dot=s=>`<i class="ash-dot ${status(s).cls}"></i>`;
  const freshness=()=>{
    const governed=Array.isArray(freshState?.detail?.sources)?freshState.detail.sources:[];
    if(governed.length)return governed;
    const legacy=window.AtlasDataAudit?.getState?.()?.detail?.sources;
    return Array.isArray(legacy)?legacy:[];
  };
  const freshnessTone=r=>String(r?.status||'').toUpperCase()==='GREEN'?'healthy':String(r?.status||'').toUpperCase()==='YELLOW'?'watch':String(r?.status||'').toUpperCase()==='RED'?'degraded':'unknown';
  const operationalTone=r=>{const raw=String(r?.data_status||r?.software_status||'').toLowerCase();if(/degraded|down|fail|error|red/.test(raw))return 'degraded';if(/watch|stale|yellow|delay|lag|warn/.test(raw))return 'watch';if(/healthy|fresh|green|ready|current|active|success|ok/.test(raw))return 'healthy';return 'unknown';};

  async function loadFreshness(force=false){
    if(!force&&freshState&&Date.now()-freshAt<TTL)return freshState;
    if(freshInflight)return freshInflight;
    const c=db();if(!c)return null;
    freshInflight=(async()=>{
      const {data,error}=await c.from('aml_sync_state').select('pipeline,status,detail,updated_at,fusion_synced_at').eq('pipeline',FRESHNESS_PIPELINE).maybeSingle();
      if(error)throw error;
      freshState=data||{pipeline:FRESHNESS_PIPELINE,detail:{sources:[]}};
      freshAt=Date.now();freshError=null;
      return freshState;
    })().catch(error=>{
      freshError=error;
      if(!freshState)freshState={pipeline:FRESHNESS_PIPELINE,detail:{sources:[]}};
      return freshState;
    }).finally(()=>{freshInflight=null;updateRoot();});
    return freshInflight;
  }

  async function loadRes(force=false){
    if(!force&&resState&&Date.now()-resAt<TTL)return resState;
    const c=db();if(!c)return null;
    try{
      const {data,error}=await c.from('aml_res_source_snapshot').select('snapshot_id,cutoff_date,source_updated_at,resource_id,resource_name,status,refreshed_at').order('source_updated_at',{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
      if(error)throw error;
      if(!data){resState={available:false,status:'unknown',reason:'Sin snapshot RES materializado'};}
      else{
        const raw=String(data.status||'').toLowerCase();
        const tone=/(ready|success|complete|completed|loaded|active|current|ok)/.test(raw)?'healthy':/(error|fail|invalid|rejected)/.test(raw)?'degraded':'watch';
        resState={available:true,status:tone,label:'Registro de Empresas y Sociedades (RES)',system:'Datos.gob.cl · RES',latest:data.cutoff_date||data.source_updated_at,checked:data.refreshed_at||data.source_updated_at,reason:data.resource_name||`Snapshot ${data.snapshot_id||'RES'}`,rawStatus:data.status||'—'};
      }
    }catch(error){resState={available:false,status:'unknown',reason:`Telemetría RES no disponible: ${String(error?.message||error)}`};}
    resAt=Date.now();updateRoot();return resState;
  }

  async function loadOps(force=false){
    if(!force&&ops&&Date.now()-opsAt<TTL)return ops;if(inflight)return inflight;
    loadState='loading';lastError=null;updateRoot();
    inflight=(async()=>{const c=db();if(!c)throw new Error('Supabase no disponible');
      try{const r=await c.functions.invoke('aml-source-health-monitor',{body:{}});if(!r.error&&r.data?.ok){ops=r.data;opsAt=Date.now();loadState='ready';return ops;}}catch{}
      const {data,error}=await c.from('aml_external_source_health').select('*').eq('enabled',true).order('source_name');if(error)throw error;
      const rows=(data||[]).map(x=>({source_code:x.source_code,source_name:x.source_name,source_class:x.source_class,software_status:x.software_status,data_status:x.data_status,last_source_record_at:x.last_source_record_at,last_successful_ingest_at:x.last_successful_ingest_at,last_check_at:x.last_check_at,metadata:x.metadata||{}}));
      const healthy=rows.filter(x=>x.software_status==='healthy').length,watch=rows.filter(x=>x.software_status==='watch').length,degraded=rows.filter(x=>x.software_status==='degraded').length;
      ops={ok:true,summary:{total:rows.length,healthy,watch,degraded,coverage_effective_pct:rows.length?Math.round((healthy+.5*watch)/rows.length*100):0,critical_down:rows.filter(x=>x?.metadata?.criticality==='high'&&x.software_status==='degraded').length},sources:rows};opsAt=Date.now();loadState='ready';return ops;
    })().catch(err=>{lastError=err;loadState='unavailable';throw err;}).finally(()=>{inflight=null;updateRoot();});return inflight;
  }

  function catalog(){
    let rows=freshness().map(r=>({kind:'freshness',label:r.label||r.source_system||r.source_id||'Fuente',system:r.source_system||'ATLAS',latest:r.latest_record_label||day(r.latest_record_at||r.last_capture_at),checked:dt(r.last_checked_at),tone:freshnessTone(r),state:String(r.status||'SIN ESTADO').toUpperCase(),reason:r.reason||'Sin detalle'}));
    if(!rows.length&&Array.isArray(ops?.sources)&&ops.sources.length){
      rows=ops.sources.map(r=>{const tone=operationalTone(r);return{kind:'operational-fallback',label:r.source_name||r.source_code||'Fuente',system:r.source_class||r?.metadata?.domain||'Integración ATLAS',latest:day(r.last_source_record_at||r.last_successful_ingest_at),checked:dt(r.last_check_at||r?.metadata?.health?.checked_at),tone,state:status(tone).label,reason:r?.metadata?.health?.error||r?.metadata?.impact_if_down||'Telemetría operacional de respaldo'};});
    }
    const seen=new Set();
    rows=rows.filter(r=>{const key=`${String(r.label||'').trim().toLowerCase()}|${String(r.system||'').trim().toLowerCase()}`;if(seen.has(key))return false;seen.add(key);return true;});
    const hasRes=rows.some(r=>/\bRES\b|REGISTRO DE EMPRESAS Y SOCIEDADES/i.test(`${r.label} ${r.system}`));
    if(!hasRes){const r=resState;rows.push({kind:'res',label:'Registro de Empresas y Sociedades (RES)',system:'Datos.gob.cl · RES',latest:r?.available?day(r.latest):'—',checked:r?.available?dt(r.checked):'—',tone:r?.status||'unknown',state:r?.available?status(r.status).label:'SIN ESTADO',reason:r?.reason||'Consultando snapshot oficial'});}
    return rows;
  }
  function catalogRows(){const rows=catalog();if(!rows.length)return '<div class="ash-empty">Sin telemetría de fuentes disponible.</div>';return `<div class="ash-catalog"><div class="ash-catalog-head"><span>Fuente</span><span>Último dato</span><span>Verificación</span><span>Estado</span></div>${rows.map(r=>`<div class="ash-catalog-row"><div class="ash-source-name ${r.kind==='res'?'res':''}">${dot(r.tone)}<div><b>${esc(r.label)}</b><small>${esc(r.system)}</small></div></div><div class="ash-catalog-cell"><b>${esc(r.latest)}</b><small>corte materializado</small></div><div class="ash-catalog-cell"><b>${esc(r.checked)}</b><small title="${esc(r.reason)}">${esc(r.reason)}</small></div><div><span class="ash-state ${status(r.tone).cls}">${esc(r.state)}</span></div></div>`).join('')}</div>`;}

  function opRows(){const rows=ops?.sources||[];if(!rows.length)return `<div class="ash-empty">${loadState==='loading'?'Cargando telemetría operacional…':loadState==='unavailable'?'No fue posible obtener la telemetría operacional.':'Sin telemetría operacional disponible.'}</div>`;return `<div class="ash-oplist">${rows.map(r=>{const h=r.metadata?.health||{},s=status(r.software_status),fallback=r.metadata?.fallback||'—',impact=r.metadata?.impact_if_down||'—',lat=h.latency_ms==null?'—':`${h.latency_ms} ms`;return `<details class="ash-op ${s.cls}"><summary><span>${dot(r.software_status)}<span><b>${esc(r.source_name||r.source_code)}</b><small>${esc(r.source_class||'')}</small></span></span><span><b>${esc(lat)}</b><small>latencia</small></span><span><b>${esc(dt(r.last_check_at||h.checked_at))}</b><small>última prueba</small></span><span class="ash-state ${s.cls}">${esc(s.label)}</span></summary><div class="ash-opdetail"><span><b>Disponibilidad</b>${esc(status(h.availability||r.software_status).label)}</span><span><b>Upstream</b>${esc(status(h.upstream||'unknown').label)}</span><span><b>Dato</b>${esc(status(r.data_status||'unknown').label)}</span><span><b>HTTP</b>${esc(h.http_status||'—')}</span><span class="wide"><b>Fallback</b>${esc(fallback)}</span><span class="wide"><b>Impacto si falla</b>${esc(impact)}</span>${h.error?`<span class="wide badtext"><b>Último error</b>${esc(h.error)}</span>`:''}</div></details>`}).join('')}</div>`;}

  function summaryHtml(){
    const f=catalog(),fs={green:f.filter(x=>x.tone==='healthy').length,yellow:f.filter(x=>x.tone==='watch').length,red:f.filter(x=>x.tone==='degraded').length};
    const o=ops?.summary||{},rows=ops?.sources||[],pending=loadState!=='ready';
    const groups=['chile_institucional','identidad_digital','infraestructura_externa'].map(g=>{const a=rows.filter(x=>x?.metadata?.domain===g),ok=a.filter(x=>x.software_status==='healthy').length,w=a.filter(x=>x.software_status==='watch').length;return{g,total:a.length,coverage:a.length?Math.round((ok+.5*w)/a.length*100):0}});
    const name=g=>({chile_institucional:'Chile institucional',identidad_digital:'Identidad digital',infraestructura_externa:'Infraestructura externa'})[g]||g;
    const coverage=pending?'—':`${Number(o.coverage_effective_pct??0)}%`,operational=pending?(loadState==='loading'?'calculando disponibilidad…':'telemetría no disponible'):`${Number(o.healthy||0)} operativas · ${Number(o.watch||0)} revisar · ${Number(o.degraded||0)} caídas`;
    const resText=resState?.available?`${status(resState.status).label} · corte ${day(resState.latest)}`:'sin telemetría confirmada';
    const impact=pending?(loadState==='loading'?'<b>Consultando fuentes</b><span>La cobertura se mostrará al finalizar la verificación.</span>':'<b>Telemetría no disponible</b><span>Usa “Actualizar” para reintentar.</span>'):(Number(o.critical_down||0)?'<b>⚠ Cobertura reducida</b><span>Hay fuentes críticas caídas; revisa Integraciones.</span>':'<b>✓ Cobertura crítica disponible</b><span>Sin caídas críticas detectadas.</span>');
    return `<div class="ash-summary-grid"><div class="ash-metric"><span>Cobertura operacional</span><b>${coverage}</b><small>${operational}</small></div><div class="ash-metric"><span>Fuentes al día</span><b>${fs.green}/${f.length||0}</b><small>${fs.yellow} revisar · ${fs.red} caídas/rezagadas</small></div><div class="ash-metric"><span>RES</span><b>${resState?.available?status(resState.status).label:'—'}</b><small>${esc(resText)}</small></div></div><div class="ash-domains">${groups.filter(x=>x.total).map(x=>`<div><span>${esc(name(x.g))}</span><b>${x.coverage}%</b><small>${x.total} fuentes</small></div>`).join('')}</div><div class="ash-impact">${impact}</div>`;
  }
  function overallState(){if(loadState!=='ready')return 'off';const o=ops?.summary||{},redFresh=catalog().some(x=>x.tone==='degraded');return Number(o.critical_down||0)>0?'bad':Number(o.degraded||0)>0||redFresh?'warn':'ok';}
  function shellHtml(){const o=ops?.summary||{},overall=overallState(),pending=loadState!=='ready',coverage=pending?'—':`${Number(o.coverage_effective_pct??0)}%`,falls=pending?'verificando':`${Number(o.degraded||0)} caídas`,dotState=overall==='ok'?'healthy':overall==='warn'?'watch':overall==='bad'?'degraded':'loading';return `<button type="button" class="v024-audit-summary ash-main" data-ash-toggle aria-expanded="false"><span class="a57-title">${dot(dotState)}<span><strong>Auditoría y salud de fuentes</strong><small>Estado resumido de frescura y disponibilidad técnica</small></span></span><span class="ash-quick"><b>${coverage}</b><small>cobertura</small><span>${falls}</span></span><span class="a57-chevron">⌄</span></button><div class="v024-audit-detail ash-detail" data-ash-detail hidden><div class="ash-tabs"><button data-ash-tab="summary" class="active">Resumen</button><button data-ash-tab="freshness">Catálogo de fuentes</button><button data-ash-tab="operations">Integraciones</button><button data-ash-refresh>Actualizar</button></div><div data-ash-panel>${summaryHtml()}</div><footer>Frescura y disponibilidad son dimensiones separadas; este control informa salud técnica, no validez analítica.</footer></div>`;}
  function mount(){if(root?.isConnected)return root;const old=document.querySelector('.a57-data-audit:not([data-ash0536])');if(!old)return null;root=document.createElement('section');root.className='v024-audit a57-data-audit ash-audit';root.dataset.ash0536='1';root.innerHTML=shellHtml();old.replaceWith(root);bind(root);updateRoot();return root;}
  function updateRoot(){if(!root?.isConnected)return;const overall=overallState();root.classList.remove('ok','warn','bad','off');root.classList.add(overall);const quick=root.querySelector('.ash-quick'),o=ops?.summary||{},pending=loadState!=='ready';if(quick)quick.innerHTML=`<b>${pending?'—':`${Number(o.coverage_effective_pct??0)}%`}</b><small>cobertura</small><span>${pending?(loadState==='loading'?'verificando':'sin telemetría'):`${Number(o.degraded||0)} caídas`}</span>`;const titleDot=root.querySelector('.a57-title .ash-dot');if(titleDot)titleDot.className=`ash-dot ${status(overall==='ok'?'healthy':overall==='warn'?'watch':overall==='bad'?'degraded':'loading').cls}`;const p=root.querySelector('[data-ash-panel]');if(p)p.innerHTML=activeTab==='freshness'?catalogRows():activeTab==='operations'?opRows():summaryHtml();}
  function bind(rootEl){
    rootEl.querySelector('[data-ash-toggle]')?.addEventListener('click',e=>{const b=e.currentTarget,d=rootEl.querySelector('[data-ash-detail]'),open=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!open));d.hidden=open;});
    rootEl.querySelectorAll('[data-ash-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.ashTab;rootEl.querySelectorAll('[data-ash-tab]').forEach(x=>x.classList.toggle('active',x===b));updateRoot();if(activeTab==='freshness')void loadFreshness(false);}));
    rootEl.querySelector('[data-ash-refresh]')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Actualizando…';try{await Promise.allSettled([loadOps(true),loadFreshness(true),loadRes(true)]);}finally{b.disabled=false;b.textContent='Actualizar';updateRoot();}});
  }
  async function startup(){mount();void loadFreshness(true);void loadRes(true);const waits=[0,400,1000,2000,4000];for(const wait of waits){if(wait)await new Promise(r=>setTimeout(r,wait));try{await loadOps(true);return;}catch{mount();}}updateRoot();}
  const obs=new MutationObserver(()=>{if(root?.isConnected)return;const old=document.querySelector('.a57-data-audit:not([data-ash0536])');if(old)mount();});obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(startup,50),{once:true});else setTimeout(startup,50);
  setInterval(()=>{void loadOps(true).catch(()=>{});void loadFreshness(true);void loadRes(true);},TTL);
  window.AtlasSourceHealthAudit={version:VERSION,refresh:()=>Promise.allSettled([loadOps(true),loadFreshness(true),loadRes(true)]),getOperationalState:()=>ops,getFreshnessState:()=>freshState,getCatalogSources:()=>catalog(),getResState:()=>resState,getLoadState:()=>({state:loadState,error:lastError?.message||null,freshnessError:freshError?.message||null})};
})();
