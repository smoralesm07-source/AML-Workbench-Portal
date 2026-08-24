'use strict';
/* ATLAS AML 0.53.6 · Auditoría y salud de fuentes */
(function atlasSourceHealthAudit0536(){
  const VERSION='SOURCE-HEALTH-AUDIT-0536.2',TTL=5*60*1000;
  let ops=null,opsAt=0,inflight=null,activeTab='summary',loadState='loading',lastError=null,root=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch{return window.sb||null;}};
  const dt=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}catch{return String(v)}};
  const status=s=>({healthy:{label:'OPERATIVO',cls:'ok'},watch:{label:'DEGRADADO',cls:'warn'},degraded:{label:'CAÍDO',cls:'bad'},unknown:{label:'SIN ESTADO',cls:'off'},fresh:{label:'AL DÍA',cls:'ok'},stale:{label:'REZAGADO',cls:'warn'},loading:{label:'CARGANDO',cls:'off'}}[String(s||'').toLowerCase()]||{label:String(s||'SIN ESTADO').toUpperCase(),cls:'off'});
  const dot=s=>`<i class="ash-dot ${status(s).cls}"></i>`;
  function freshness(){return window.AtlasDataAudit?.getState?.()?.detail?.sources||[];}
  async function loadOps(force=false){
    if(!force&&ops&&Date.now()-opsAt<TTL)return ops;
    if(inflight)return inflight;
    loadState='loading';lastError=null;updateRoot();
    inflight=(async()=>{
      const c=db();
      if(!c)throw new Error('Supabase no disponible');
      try{
        const r=await c.functions.invoke('aml-source-health-monitor',{body:{}});
        if(!r.error&&r.data?.ok){ops=r.data;opsAt=Date.now();loadState='ready';return ops;}
      }catch{}
      const {data,error}=await c.from('aml_external_source_health').select('*').eq('enabled',true).order('source_name');
      if(error)throw error;
      const rows=(data||[]).map(x=>({source_code:x.source_code,source_name:x.source_name,source_class:x.source_class,software_status:x.software_status,data_status:x.data_status,last_source_record_at:x.last_source_record_at,last_successful_ingest_at:x.last_successful_ingest_at,last_check_at:x.last_check_at,metadata:x.metadata||{}}));
      const healthy=rows.filter(x=>x.software_status==='healthy').length,watch=rows.filter(x=>x.software_status==='watch').length,degraded=rows.filter(x=>x.software_status==='degraded').length;
      ops={ok:true,summary:{total:rows.length,healthy,watch,degraded,coverage_effective_pct:rows.length?Math.round((healthy+.5*watch)/rows.length*100):0,critical_down:rows.filter(x=>x?.metadata?.criticality==='high'&&x.software_status==='degraded').length},sources:rows};
      opsAt=Date.now();loadState='ready';return ops;
    })().catch(err=>{lastError=err;loadState='unavailable';throw err;}).finally(()=>{inflight=null;updateRoot();});
    return inflight;
  }
  function freshnessRows(){const rows=freshness();if(!rows.length)return '<div class="ash-empty">Sin telemetría de frescura disponible.</div>';return `<div class="ash-table"><div class="ash-head"><span>Fuente</span><span>Último dato</span><span>Verificación</span><span>Estado</span></div>${rows.map(r=>`<div class="ash-row"><div>${dot(String(r.status||'').toLowerCase()==='green'?'healthy':String(r.status||'').toLowerCase()==='yellow'?'watch':'degraded')}<b>${esc(r.label||r.source_system||r.source_id)}</b><small>${esc(r.source_system||'')}</small></div><div><b>${esc(r.latest_record_label||dt(r.latest_record_at||r.last_capture_at))}</b><small>corte materializado</small></div><div><b>${esc(dt(r.last_checked_at))}</b><small>${esc(r.reason||'')}</small></div><div><span class="ash-state ${String(r.status||'').toLowerCase()==='green'?'ok':String(r.status||'').toLowerCase()==='yellow'?'warn':'bad'}">${esc(String(r.status||'SIN ESTADO'))}</span></div></div>`).join('')}</div>`;}
  function opRows(){const rows=ops?.sources||[];if(!rows.length)return `<div class="ash-empty">${loadState==='loading'?'Cargando telemetría operacional…':loadState==='unavailable'?'No fue posible obtener la telemetría operacional.':'Sin telemetría operacional disponible.'}</div>`;return `<div class="ash-oplist">${rows.map(r=>{const h=r.metadata?.health||{},s=status(r.software_status),fallback=r.metadata?.fallback||'—',impact=r.metadata?.impact_if_down||'—',lat=h.latency_ms==null?'—':`${h.latency_ms} ms`;return `<details class="ash-op ${s.cls}"><summary><span>${dot(r.software_status)}<b>${esc(r.source_name||r.source_code)}</b><small>${esc(r.source_class||'')}</small></span><span><b>${esc(lat)}</b><small>latencia</small></span><span><b>${esc(dt(r.last_check_at||h.checked_at))}</b><small>última prueba</small></span><span class="ash-state ${s.cls}">${esc(s.label)}</span></summary><div class="ash-opdetail"><span><b>Disponibilidad</b>${esc(status(h.availability||r.software_status).label)}</span><span><b>Upstream</b>${esc(status(h.upstream||'unknown').label)}</span><span><b>Dato</b>${esc(status(r.data_status||'unknown').label)}</span><span><b>HTTP</b>${esc(h.http_status||'—')}</span><span class="wide"><b>Fallback</b>${esc(fallback)}</span><span class="wide"><b>Impacto si falla</b>${esc(impact)}</span>${h.error?`<span class="wide badtext"><b>Último error</b>${esc(h.error)}</span>`:''}</div></details>`}).join('')}</div>`;}
  function summaryHtml(){
    const f=freshness(),fs={green:f.filter(x=>String(x.status).toUpperCase()==='GREEN').length,yellow:f.filter(x=>String(x.status).toUpperCase()==='YELLOW').length,red:f.filter(x=>String(x.status).toUpperCase()==='RED').length};
    const o=ops?.summary||{},rows=ops?.sources||[];
    const pending=loadState!=='ready';
    const groups=['chile_institucional','identidad_digital','infraestructura_externa'].map(g=>{const a=rows.filter(x=>x?.metadata?.domain===g),ok=a.filter(x=>x.software_status==='healthy').length,w=a.filter(x=>x.software_status==='watch').length;return{g,total:a.length,coverage:a.length?Math.round((ok+.5*w)/a.length*100):0}});
    const name=g=>({chile_institucional:'Chile institucional',identidad_digital:'Identidad digital',infraestructura_externa:'Infraestructura externa'})[g]||g;
    const coverage=pending?'—':`${Number(o.coverage_effective_pct??0)}%`;
    const operational=pending?(loadState==='loading'?'calculando disponibilidad…':'telemetría no disponible'):`${Number(o.healthy||0)} operativas · ${Number(o.watch||0)} degradadas · ${Number(o.degraded||0)} caídas`;
    const critical=pending?'—':Number(o.critical_down||0);
    const impact=pending?(loadState==='loading'?'<b>Consultando fuentes</b><span>La cobertura se mostrará cuando finalice la verificación operacional.</span>':'<b>Telemetría no disponible</b><span>No se informa 0% porque la cobertura aún no pudo verificarse. Usa “Actualizar ahora” para reintentar.</span>'):(Number(o.critical_down||0)?'<b>⚠ Cobertura reducida</b><span>Hay una o más fuentes críticas caídas. Revisa “Salud de integraciones” para ver impacto y fallback.</span>':'<b>✓ Cobertura crítica disponible</b><span>No se observan caídas críticas en las integraciones activas.</span>');
    return `<div class="ash-summary-grid"><div class="ash-metric"><span>Cobertura operacional efectiva</span><b>${coverage}</b><small>${operational}</small></div><div class="ash-metric"><span>Frescura de datos</span><b>${fs.green}/${f.length||0}</b><small>${fs.yellow} revisar · ${fs.red} sin actualización</small></div><div class="ash-metric"><span>Fuentes críticas caídas</span><b>${critical}</b><small>${pending?(loadState==='loading'?'verificando…':'sin verificación'):(Number(o.critical_down||0)?'requiere atención':'sin impacto crítico detectado')}</small></div></div><div class="ash-domains">${groups.filter(x=>x.total).map(x=>`<div><span>${esc(name(x.g))}</span><b>${x.coverage}%</b><small>${x.total} fuentes activas</small></div>`).join('')}</div><div class="ash-impact">${impact}</div>`;
  }
  function overallState(){if(loadState!=='ready')return 'off';const o=ops?.summary||{},f=freshness(),redFresh=f.some(x=>String(x.status).toUpperCase()==='RED');return Number(o.critical_down||0)>0?'bad':Number(o.degraded||0)>0||redFresh?'warn':'ok';}
  function shellHtml(){
    const o=ops?.summary||{},overall=overallState(),pending=loadState!=='ready',coverage=pending?'—':`${Number(o.coverage_effective_pct??0)}%`,falls=pending?'verificando':`${Number(o.degraded||0)} caídas`,dotState=overall==='ok'?'healthy':overall==='warn'?'watch':overall==='bad'?'degraded':'loading';
    return `<button type="button" class="v024-audit-summary ash-main" data-ash-toggle aria-expanded="false"><span class="a57-title">${dot(dotState)}<span><strong>Auditoría y salud de fuentes</strong><small>Frescura de datos + disponibilidad operacional + upstream + fallback</small></span></span><span class="ash-quick"><b>${coverage}</b><small>cobertura</small><span>${falls}</span></span><span class="a57-chevron">⌄</span></button><div class="v024-audit-detail ash-detail" data-ash-detail hidden><div class="ash-tabs"><button data-ash-tab="summary" class="active">Resumen</button><button data-ash-tab="freshness">Frescura de datos</button><button data-ash-tab="operations">Salud de integraciones</button><button data-ash-refresh>Actualizar ahora</button></div><div data-ash-panel>${summaryHtml()}</div><footer>Disponibilidad técnica y frescura son dimensiones separadas. Un estado operativo no implica identidad confirmada ni calidad analítica suficiente.</footer></div>`;
  }
  function mount(){
    if(root?.isConnected)return root;
    const old=document.querySelector('.a57-data-audit:not([data-ash0536])');
    if(!old)return null;
    root=document.createElement('section');root.className='v024-audit a57-data-audit ash-audit';root.dataset.ash0536='1';root.innerHTML=shellHtml();old.replaceWith(root);bind(root);updateRoot();return root;
  }
  function updateRoot(){
    if(!root?.isConnected)return;
    const overall=overallState();root.classList.remove('ok','warn','bad','off');root.classList.add(overall);
    const quick=root.querySelector('.ash-quick'),o=ops?.summary||{},pending=loadState!=='ready';
    if(quick)quick.innerHTML=`<b>${pending?'—':`${Number(o.coverage_effective_pct??0)}%`}</b><small>cobertura</small><span>${pending?(loadState==='loading'?'verificando':'sin telemetría'):`${Number(o.degraded||0)} caídas`}</span>`;
    const titleDot=root.querySelector('.a57-title .ash-dot');if(titleDot)titleDot.className=`ash-dot ${status(overall==='ok'?'healthy':overall==='warn'?'watch':overall==='bad'?'degraded':'loading').cls}`;
    const p=root.querySelector('[data-ash-panel]');if(p)p.innerHTML=activeTab==='freshness'?freshnessRows():activeTab==='operations'?opRows():summaryHtml();
  }
  function bind(rootEl){
    rootEl.querySelector('[data-ash-toggle]')?.addEventListener('click',e=>{const b=e.currentTarget,d=rootEl.querySelector('[data-ash-detail]'),open=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!open));d.hidden=open;});
    rootEl.querySelectorAll('[data-ash-tab]').forEach(b=>b.addEventListener('click',()=>{activeTab=b.dataset.ashTab;rootEl.querySelectorAll('[data-ash-tab]').forEach(x=>x.classList.toggle('active',x===b));updateRoot();}));
    rootEl.querySelector('[data-ash-refresh]')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Actualizando…';try{await loadOps(true);}catch{}finally{b.disabled=false;b.textContent='Actualizar ahora';updateRoot();}});
  }
  async function startup(){
    mount();
    const waits=[0,400,1000,2000,4000];
    for(const wait of waits){if(wait)await new Promise(r=>setTimeout(r,wait));try{await loadOps(true);return;}catch{mount();}}
    updateRoot();
  }
  const obs=new MutationObserver(()=>{if(root?.isConnected)return;const old=document.querySelector('.a57-data-audit:not([data-ash0536])');if(old)mount();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(startup,50),{once:true});else setTimeout(startup,50);
  setInterval(()=>void loadOps(true).catch(()=>{}).finally(updateRoot),TTL);
  window.AtlasSourceHealthAudit={version:VERSION,refresh:()=>loadOps(true),getOperationalState:()=>ops,getLoadState:()=>({state:loadState,error:lastError?.message||null})};
})();