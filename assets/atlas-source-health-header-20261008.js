/* ATLAS · Salud de fuentes en cabecera · controlador independiente 2026-10-08 */
(function(){
  'use strict';
  if(window.AtlasHeaderHealthV2)return;
  const TTL=5*60*1000;
  const IDS={UAF:'UAF_SECTOR_PROFILE',SII_BULK:'SII_ENTITY_YEAR',OSFL:'OSFL_PROFILE',SANCIONES:'SANCTION_IDENTITY'};
  let sources=[],checkedAt=null,refreshAt=0,loading=null,panelOpen=false,observer=null;
  const qs=(root,selector)=>root?.querySelector(selector)||null;
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const formatDate=v=>{
    if(!v)return 'No informada';
    const d=new Date(v);
    return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d):String(v).slice(0,24);
  };
  const formatCut=v=>{if(!v)return 'No informado';const str=String(v);return /^20\d\d-\d\d($|\D)/.test(str)?str.slice(0,19):str;};
  const labelStatus=s=>s==='red'?'Incidencia':s==='yellow'?'Atención':s==='green'?'Operativa':'Sin verificar';
  const toneStatus=s=>String(s||'').toUpperCase()==='RED'?'red':String(s||'').toUpperCase()==='YELLOW'?'yellow':String(s||'').toUpperCase()==='GREEN'?'green':'unknown';
  function readyHeader(){
    const top=document.querySelector('.v019-top,.topbar,.v18-appbar,[data-atlas-account-header]');
    if(!top||!top.getClientRects().length)return null;
    const auth=document.querySelector('.auth-screen');
    if(auth&&auth.getClientRects().length&&getComputedStyle(auth).display!=='none')return null;
    return top;
  }
  function create(tag,cls,textContent){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(textContent!=null)node.textContent=String(textContent);
    return node;
  }
  function button(){
    let root=document.getElementById('atlas-hh-root');
    if(root?.isConnected)return root;
    const top=readyHeader();
    if(!top)return null;
    root=create('div','atlas-hh-root');root.id='atlas-hh-root';
    const trigger=create('button','atlas-hh-trigger');trigger.type='button';
    trigger.setAttribute('aria-label','Salud de las fuentes · abrir ficha');
    trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
    trigger.append(create('span','atlas-hh-light'),create('span','atlas-hh-label','Fuentes'),create('span','atlas-hh-chevron','⌄'));
    trigger.addEventListener('click',()=>{panelOpen=!panelOpen;render();if(panelOpen)void refresh(false)});
    root.appendChild(trigger);
    const anchor=qs(top,'.atlas-theme-toggle')||qs(top,'.v019-user')||qs(top,'.user-email')||qs(top,'#v019-logout')||qs(top,'#logout');
    if(anchor?.parentElement===top)top.insertBefore(root,anchor);else top.appendChild(root);
    document.documentElement.classList.add('atlas-hh-active');
    render();
    return root;
  }
  function mount(){
    if(!document.body)return;
    const top=readyHeader();
    if(!top)return;
    const root=document.getElementById('atlas-hh-root');
    if(root?.isConnected&&root.parentElement===top)return;
    if(root)root.remove();
    button();
  }
  function overall(){
    if(!sources.length)return 'unknown';
    if(sources.some(x=>x.status==='red'))return 'red';
    if(sources.some(x=>x.status==='yellow'))return 'yellow';
    if(sources.some(x=>x.status==='unknown'))return 'unknown';
    if(checkedAt&&Date.now()-new Date(checkedAt).getTime()>36*3600000)return 'yellow';
    return 'green';
  }
  function cell(box,label,value){
    const node=create('div','atlas-hh-fact');
    node.append(create('span','atlas-hh-fact-label',label),create('strong','atlas-hh-fact-value',value));
    box.appendChild(node);
  }
  function render(){
    const root=document.getElementById('atlas-hh-root');
    if(!root)return;
    const state=overall();
    root.dataset.state=state;
    const trigger=qs(root,'button');
    if(trigger)trigger.setAttribute('aria-expanded',String(panelOpen));
    let panel=document.getElementById('atlas-hh-panel');
    if(!panelOpen){if(panel)panel.remove();return}
    if(!panel){panel=create('section','atlas-hh-panel');panel.id='atlas-hh-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Salud de las fuentes');document.body.appendChild(panel)}
    panel.replaceChildren();
    const heading=create('div','atlas-hh-heading');
    const titles=create('div','atlas-hh-heading-titles');
    titles.append(create('strong',null,'Salud de las fuentes'),create('small',null,checkedAt?'Telemetría: '+formatDate(checkedAt):'Aún sin telemetría confirmada'));
    const refreshBtn=create('button','atlas-hh-refresh',loading?'Verificando…':'Actualizar');
    refreshBtn.type='button';refreshBtn.disabled=!!loading;refreshBtn.addEventListener('click',()=>void refresh(true));
    const closeBtn=create('button','atlas-hh-close','×');closeBtn.type='button';closeBtn.setAttribute('aria-label','Cerrar ficha');
    closeBtn.addEventListener('click',()=>{panelOpen=false;render()});
    heading.append(titles,refreshBtn,closeBtn);panel.appendChild(heading);
    const counts={red:0,yellow:0,green:0,unknown:0};
    sources.forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
    panel.append(create('p','atlas-hh-summary',sources.length?String(sources.length)+' fuentes · '+counts.green+' operativas · '+counts.yellow+' en atención · '+counts.red+' con incidencia · '+counts.unknown+' sin verificar':'Cargando fuentes disponibles. Un estado sin verificar no significa caída.'));
    const list=create('div','atlas-hh-list');
    for(const r of sources){
      const item=create('details','atlas-hh-item');item.dataset.status=r.status;
      const title=create('summary','atlas-hh-item-title');
      const left=create('span','atlas-hh-item-name');
      left.append(create('i','atlas-hh-item-dot'),create('span',null,r.name));
      title.append(left,create('span','atlas-hh-state',labelStatus(r.status)),create('span','atlas-hh-arrow','⌄'));
      const brief=create('div','atlas-hh-dates');
      cell(brief,'Última carga en Atlas',formatDate(r.loaded));
      cell(brief,'Última captura',formatDate(r.capture));
      cell(brief,'Último dato',formatCut(r.latest));
      cell(brief,'Última verificación',formatDate(r.checked));
      const note=create('p','atlas-hh-note',r.reason||'Sin observaciones');
      const evidence=create('p','atlas-hh-evidence',r.evidence||'Fecha de carga no disponible. No se equipara verificación con ingesta.');
      item.append(title,brief,note,evidence);
      list.appendChild(item);
    }
    panel.appendChild(list);
    const foot=create('p','atlas-hh-foot','Las fechas de captura, dato y carga corresponden a procesos diferentes; una prueba de conexión no acredita ingesta.');
    panel.appendChild(foot);
    positionPanel();
  }
  function positionPanel(){
    const panel=document.getElementById('atlas-hh-panel'),root=document.getElementById('atlas-hh-root');
    if(!panel||!root)return;
    const rect=root.getBoundingClientRect();
    const width=Math.min(560,Math.max(280,window.innerWidth-24));
    const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left));
    panel.style.left=left+'px';panel.style.top=Math.min(window.innerHeight-90,rect.bottom+8)+'px';
    panel.style.width=width+'px';
  }
  function parseFreshness(rows,operations,material,snapshot){
    const byCode=new Map((operations||[]).map(r=>[String(r.source_code||'').toUpperCase(),r]));
    const result=[];
    for(const r of rows||[]){
      const id=String(r.source_id||'').toUpperCase();
      const op=byCode.get(id);
      const pipe=material[IDS[id]]||null;
      const confirmed=pipe&&/SUCCESS|COMPLETED/i.test(String(pipe.status||''))?
        (pipe.fusion_synced_at||pipe.sii_synced_at||pipe.updated_at):null;
      const staleCheck=r.last_checked_at&&Date.now()-new Date(r.last_checked_at).getTime()>48*3600000;
      let status=toneStatus(r.status);
      if(staleCheck&&status==='green')status='yellow';
      result.push({
        code:id,name:r.label||r.source_system||id,
        status,latest:r.latest_record_label||r.latest_record_at||null,capture:r.last_capture_at||null,
        checked:r.last_checked_at||null,loaded:confirmed,
        reason:staleCheck?'Última verificación fuera de 48 horas. '+(r.reason||''):r.reason||'',
        evidence:confirmed?'Materialización verificada en Atlas: '+IDS[id]:'Carga en Atlas no acreditada para esta fuente; última captura disponible',
      });
      if(op)byCode.delete(id);
    }
    for(const r of byCode.values()){
      const raw=String(r.software_status||'').toLowerCase();
      let status=raw==='degraded'?'red':raw==='watch'?'yellow':raw==='healthy'?'green':'unknown';
      if(status==='green'&&r.last_check_at&&Date.now()-new Date(r.last_check_at).getTime()>48*3600000)status='yellow';
      const snap=String(r.source_code||'').toUpperCase()==='RES'?snapshot:null;
      result.push({
        code:r.source_code,name:r.source_name||r.source_code,status,
        loaded:snap&&/ready|complete|active|success/i.test(String(snap.status||''))?snap.refreshed_at:null,
        capture:null,latest:snap?.cutoff_date||r.last_source_record_at||null,
        checked:r.last_check_at||null,
        reason:'Estado técnico del conector'+(r.last_check_at?' · sin prueba de ingesta general':''),
        evidence:snap?'Snapshot RES materializado; fecha refreshed_at.':'El último control técnico no prueba una carga nueva en Atlas.',
      });
    }
    return result.sort((a,b)=>({red:0,yellow:1,unknown:2,green:3}[a.status])-({red:0,yellow:1,unknown:2,green:3}[b.status])||a.name.localeCompare(b.name,'es'));
  }
  function cached(){
    const api=window.AtlasSourceHealthAudit;
    const f=api?.getFreshnessState?.();
    if(!f?.detail?.sources?.length)return null;
    const ops=api.getOperationalState?.()?.sources||[];
    const mat=window.AtlasGlobalSourceHealth?.getMaterializationState?.()||{};
    return {sources:parseFreshness(f.detail.sources,ops,mat,null),at:f.updated_at||null};
  }
  async function refresh(force){
    if(loading)return loading;
    if(!force&&sources.length&&Date.now()-refreshAt<TTL){render();return}
    const c=db();
    if(!c){const store=cached();if(store){sources=store.sources;checkedAt=store.at;render()}return}
    loading=(async()=>{
      const [f,mat,op,res]=await Promise.allSettled([
        c.from('aml_sync_state').select('detail,updated_at').eq('pipeline','SOURCE_FRESHNESS').maybeSingle(),
        c.from('aml_sync_state').select('pipeline,status,updated_at,fusion_synced_at,sii_synced_at').in('pipeline',Object.values(IDS)),
        c.from('aml_external_source_health').select('source_code,source_name,software_status,last_source_record_at,last_check_at').eq('enabled',true).limit(100),
        c.from('aml_res_source_snapshot').select('cutoff_date,refreshed_at,status').order('refreshed_at',{ascending:false}).limit(1).maybeSingle()
      ]);
      const val=x=>x.status==='fulfilled'&&!x.value.error?x.value.data:null;
      const fresh=val(f), material=Object.fromEntries((val(mat)||[]).map(r=>[r.pipeline,r]));
      const ops=val(op)||[],snapshot=val(res);
      if(fresh?.detail?.sources?.length||ops.length){
        sources=parseFreshness(fresh?.detail?.sources||[],ops,material,snapshot);checkedAt=fresh?.updated_at||new Date().toISOString();refreshAt=Date.now();
      }else{
        const old=cached();
        if(old){sources=old.sources;checkedAt=old.at;refreshAt=Date.now()}
      }
    })().catch(()=>{const old=cached();if(old){sources=old.sources;checkedAt=old.at}}).finally(()=>{loading=null;render()});
    render();
    return loading;
  }
  function schedule(){
    requestAnimationFrame(()=>{const root=button();if(root&&!sources.length)void refresh(false)});
  }
  window.addEventListener('resize',()=>{mount();if(panelOpen)positionPanel()});
  for(const event of ['pageshow','atlas:runtime-ready','atlas:nav-refresh','atlas:navigate','atlas:routechange','atlas:themechange'])
    window.addEventListener(event,schedule);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panelOpen){panelOpen=false;render()}});
  document.addEventListener('click',e=>{
    if(!panelOpen)return;
    const root=document.getElementById('atlas-hh-root'),panel=document.getElementById('atlas-hh-panel');
    if(root?.contains(e.target)||panel?.contains(e.target))return;
    panelOpen=false;render();
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  for(const delay of [250,900,2300,4500])setTimeout(schedule,delay);
  setInterval(()=>{if(!document.getElementById('atlas-hh-root')?.isConnected)mount();else if(sources.length&&Date.now()-refreshAt>TTL)void refresh(false)},15000);
  window.AtlasHeaderHealthV2={mount,schedule,refresh:()=>refresh(true),getState:()=>({sources,checkedAt,overall:overall()})};
})();