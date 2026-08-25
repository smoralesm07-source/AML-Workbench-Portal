'use strict';
/* ATLAS AML · Universo SO · Workbench canónico 0.70.5 */
(function atlasUniversoSO0705(){
  const VERSION='0.70.5';
  const SO_VIEW='sujetos-obligados';
  const TERRITORY_VIEW='territory';
  const OSFL_VIEW='osfl';
  const OVERVIEW='aml_uaf_obligated_overview_snapshot';
  const SECTORS='aml_uaf_obligated_sector_snapshot';
  const CURRENT_UNIVERSE='aml_v_uaf_universe_current_v0671';
  const CURRENT_POTENTIAL_SECTORS='aml_v_uaf_potential_sector_current_v0671';
  let dispatching=false;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const core=()=>window.__ATLAS_OBLIGATED__||null;
  const host=()=>document.querySelector('#content');
  const fmt=n=>Number(n||0).toLocaleString('es-CL');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function loadCss(href,key){if(document.querySelector(`link[data-atlas-${key}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset[`atlas${key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}`]='1';document.head.appendChild(l);}
  function loadScript(src,key,onload){const selector=`script[data-atlas-${key}]`,existing=document.querySelector(selector);if(existing){if(onload)onload();return existing;}const s=document.createElement('script');s.src=src;s.dataset[`atlas${key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}`]='1';if(onload)s.addEventListener('load',onload,{once:true});document.head.appendChild(s);return s;}
  function bootstrapOperational(){loadCss('./assets/atlas-public-spend-v2.css?v=gp2-2','gp2-css');const ready=()=>loadScript('./assets/atlas-operational-recovery-0704.js?v=0705-1','op-0705');if(window.AtlasPublicSpendV2)ready();else loadScript('./assets/atlas-public-spend-v2.js?v=gp2-2','gp2-js',ready);}

  function publish(status,extra={}){
    window.__ATLAS_ROUTE_RECOVERY_0703__={active:true,version:VERSION,passive:false,navigateMutation:false,mutationObserver:false,status,obligatedCore:!!core(),checkedAt:new Date().toISOString(),...extra};
    window.__ATLAS_UNIVERSO_SO_0700__={active:true,workbench:true,routeAuthority:true,canonical:true,passiveRecovery:false,version:VERSION,status,checkedAt:new Date().toISOString(),...extra};
  }

  async function hydrateUniverso(){
    const api=core(),client=db();
    if(!api)throw new Error('El núcleo de Universo SO no está disponible.');
    if(!client)throw new Error('La sesión de datos no está disponible.');
    const [ov,sec,current,currentSectors]=await Promise.all([
      client.from(OVERVIEW).select('payload,refreshed_at').eq('snapshot_key','CURRENT').maybeSingle(),
      client.from(SECTORS).select('*').order('subject_count',{ascending:false}),
      client.from(CURRENT_UNIVERSE).select('*').maybeSingle(),
      client.from(CURRENT_POTENTIAL_SECTORS).select('*').order('potential_ruts',{ascending:false}).order('sector',{ascending:true})
    ]);
    for(const r of [ov,sec,current,currentSectors])if(r.error)throw r.error;
    if(!ov.data)throw new Error('El panorama del padrón aún no está materializado.');
    if(!current.data)throw new Error('El universo potencial vigente aún no está materializado.');
    api.state.overview=ov.data.payload||{};api.state.overviewAt=ov.data.refreshed_at||null;api.state.sectors=sec.data||[];
    const row=current.data,potentialSectors=currentSectors.data||[];
    api.state.overview.registry=api.state.overview.registry||{};api.state.overview.registry.subjects=Number(row.obligated_ruts||0);
    api.state.overview.potential=api.state.overview.potential||{};
    api.state.overview.potential.universe={...(api.state.overview.potential.universe||{}),candidates:Number(row.potential_ruts||0),actionable:Number(row.potential_ruts||0),res_overlap:Number(row.potential_res_overlap_ruts||0),sectors:potentialSectors.length,definition:'ACTECO_CANDIDATE_USE_SI_ACTIVE_SII_NOT_UAF_RUT_EXACT',sii_cutoff:row.sii_cutoff||null,refreshed_at:row.refreshed_at||null};
    api.state.overview.potential.sectors=potentialSectors.map(r=>({sector:r.sector,candidates:Number(r.potential_ruts||0),actionable:Number(r.potential_ruts||0),res_overlap:Number(r.res_overlap_ruts||0)}));
    window.__ATLAS_UNIVERSO_CURRENT_0705__={obligatedRuts:Number(row.obligated_ruts||0),potentialRuts:Number(row.potential_ruts||0),resOverlap:Number(row.potential_res_overlap_ruts||0),siiCutoff:row.sii_cutoff||null,sectorCount:potentialSectors.length,refreshedAt:row.refreshed_at||null};
    return api.state;
  }

  function renderWorkbench(){
    const api=core(),box=host();if(!api||!box)return false;
    const o=api.state.overview||{},reg=o.registry||{},pot=o.potential||{},uni=pot.universe||{},sectors=(api.state.sectors||[]),psectors=pot.sectors||[];
    const obligated=Number(reg.subjects||0),potential=Number(uni.candidates||0),overlap=Number(uni.res_overlap||0),sectorCount=Number(uni.sectors||psectors.length||sectors.length||0);
    const active=sectors.reduce((a,r)=>a+Number(r.active_count||r.subject_count||0),0);
    const top=sectors.slice(0,10),max=Math.max(1,...top.map(r=>Number(r.subject_count||r.active_count||0)));
    const ptop=psectors.slice(0,10),pmax=Math.max(1,...ptop.map(r=>Number(r.candidates||0)));
    const cutoff=uni.sii_cutoff||'sin corte informado';
    box.innerHTML=`<section class="uso70-workbench" data-atlas-universo-workbench="0705">
      <div class="uso70-command">
        <article class="uso70-kpi coverage"><span>SO UAF vigentes</span><b>${fmt(obligated)}</b><small>Padrón exacto por RUT</small></article>
        <article class="uso70-kpi"><span>Registros sectoriales</span><b>${fmt(active)}</b><small>Base operativa consolidada</small></article>
        <article class="uso70-kpi potential"><span>Potenciales SO</span><b>${fmt(potential)}</b><small>Activos SII no presentes en UAF</small></article>
        <article class="uso70-kpi priority"><span>Coincidencia RES</span><b>${fmt(overlap)}</b><small>Evidencia complementaria</small></article>
        <article class="uso70-kpi"><span>Sectores caracterizados</span><b>${fmt(sectorCount)}</b><small>Corte SII ${esc(cutoff)}</small></article>
      </div>
      <div class="uso70-layout">
        <div class="uso70-col">
          <article class="uso70-panel"><header><div><h2>Universo regulado</h2><p>Distribución vigente de sujetos obligados por sector.</p></div><span class="uso70-meta">${fmt(obligated)} RUT</span></header><div class="uso70-body"><div class="uso70-bars">${top.map(r=>{const n=Number(r.subject_count||r.active_count||0);return `<div class="uso70-bar"><span class="lab" title="${esc(r.sector||r.name||'Sector')}">${esc(r.sector||r.name||'Sector')}</span><span class="track"><span class="fill" style="width:${Math.max(2,n/max*100)}%"></span></span><span class="val">${fmt(n)}</span></div>`}).join('')||'<div class="uso70-empty">Sin distribución sectorial disponible.</div>'}</div></div></article>
          <article class="uso70-panel"><header><div><h3>Criterio de pertenencia</h3><p>La condición de SO se determina por presencia exacta de RUT en el padrón UAF vigente.</p></div></header><div class="uso70-body"><div class="uso70-concepts"><div class="uso70-concept"><strong>SO confirmado</strong><span>RUT presente en padrón UAF.</span></div><div class="uso70-concept"><strong>Potencial SO</strong><span>Actividad económica compatible, activo en SII y no presente en padrón UAF.</span></div></div></div></article>
        </div>
        <div class="uso70-col">
          <article class="uso70-panel"><header><div><h2>Potenciales sujetos obligados</h2><p>Priorización exploratoria; no equivale a afirmar incumplimiento.</p></div><span class="uso70-meta">${fmt(potential)} candidatos</span></header><div class="uso70-body"><div class="uso70-potential-head"><div class="uso70-stage total"><span>Universo candidato</span><b>${fmt(potential)}</b><small>ACTECO compatible + activo SII</small></div><div class="uso70-stage"><span>Con evidencia RES</span><b>${fmt(overlap)}</b><small>Coincidencia complementaria</small></div><div class="uso70-stage"><span>Sectores</span><b>${fmt(sectorCount)}</b><small>Cobertura vigente</small></div><div class="uso70-stage"><span>Corte SII</span><b>${esc(cutoff)}</b><small>Último corte materializado</small></div></div><div class="uso70-bars" style="margin-top:12px">${ptop.map(r=>{const n=Number(r.candidates||0);return `<div class="uso70-bar"><span class="lab" title="${esc(r.sector||'Sector')}">${esc(r.sector||'Sector')}</span><span class="track"><span class="fill prio" style="width:${Math.max(2,n/pmax*100)}%"></span></span><span class="val">${fmt(n)}</span></div>`}).join('')||'<div class="uso70-empty">Sin candidatos sectoriales disponibles.</div>'}</div><div class="uso70-potential-rule"><b>Regla vigente:</b> ACTECO candidato + USE_SI + contribuyente activo SII + ausencia exacta en padrón UAF.</div></div></article>
        </div>
        <div class="uso70-col">
          <article class="uso70-panel"><header><div><h3>Lectura fiscalizadora</h3><p>Qué revisar primero sin inflar señales ni duplicar marcas.</p></div></header><div class="uso70-body"><div class="uso70-taxonomy"><div class="uso70-family reg"><strong>Registro</strong><div class="uso70-level prio"><b>Prioridad</b><ul><li>Potencial con actividad vigente.</li><li>Ausencia exacta en padrón UAF.</li></ul></div></div><div class="uso70-family sup"><strong>Supervisión</strong><div class="uso70-level attn"><b>Atención</b><ul><li>Evidencia sancionatoria o supervisora.</li><li>Hallazgos consistentes entre fuentes.</li></ul></div></div><div class="uso70-family cap"><strong>Capacidad</strong><div class="uso70-level ctx"><b>Contexto</b><ul><li>Tamaño, territorio y actividad.</li><li>No eleva prioridad por sí solo.</li></ul></div></div><div class="uso70-family obs"><strong>Observabilidad</strong><div class="uso70-level ctx"><b>Calidad</b><ul><li>Frescura y cobertura de fuentes.</li><li>Explicitar faltantes.</li></ul></div></div></div></div></article>
          <article class="uso70-panel"><header><div><h3>Ayuda metodológica</h3><p>Definiciones operativas del módulo.</p></div></header><div class="uso70-body"><div class="uso70-method"><div class="uso70-note"><strong>Padrón UAF</strong><p>Fuente autoritativa para identificar SO confirmados.</p></div><div class="uso70-note"><strong>SII</strong><p>Caracteriza actividad y vigencia; no reemplaza al padrón UAF.</p></div><div class="uso70-note"><strong>RES</strong><p>Evidencia complementaria para priorización, no criterio constitutivo.</p></div><div class="uso70-note"><strong>Potencial</strong><p>Candidato a revisión; no una conclusión de incumplimiento.</p></div><div class="uso70-note"><strong>Frescura</strong><p>El módulo recarga las vistas CURRENT en cada apertura.</p></div></div></div></article>
        </div>
      </div>
    </section>`;
    window.dispatchEvent(new CustomEvent('atlas:nav-refresh'));
    window.AtlasGlobalSourceHealth?.refresh?.();
    return true;
  }

  async function openUniverso(source='delegated-click'){
    if(typeof window.shell==='function')window.shell('Universo SO','Padrón UAF y universo potencial con priorización fiscalizadora, evidencia y límites metodológicos explícitos.');
    const box=host();if(box)box.innerHTML='<section class="so-root"><div class="so-loading">Actualizando Universo SO desde las vistas vigentes…</div></section>';
    await hydrateUniverso();renderWorkbench();publish('ready',{view:SO_VIEW,source,current:window.__ATLAS_UNIVERSO_CURRENT_0705__||null});return true;
  }
  async function openTerritory(source='delegated-click'){const loader=typeof window.v019LoadTerritory==='function'?window.v019LoadTerritory:(typeof v019LoadTerritory==='function'?v019LoadTerritory:null);if(!loader)throw new Error('Loader Territorio no disponible');const r=await loader();publish('ready',{view:TERRITORY_VIEW,source});return r;}
  async function openOsfl(source='delegated-click'){const loader=typeof window.v030LoadOsfl==='function'?window.v030LoadOsfl:(typeof v030LoadOsfl==='function'?v030LoadOsfl:null);if(!loader)throw new Error('Loader OSFL no disponible');const r=await loader();publish('ready',{view:OSFL_VIEW,source});return r;}
  async function open(view,source='api'){if(dispatching)return false;dispatching=true;publish('opening',{view,source});try{if(view===SO_VIEW)return await openUniverso(source);if(view===TERRITORY_VIEW)return await openTerritory(source);if(view===OSFL_VIEW)return await openOsfl(source);return false;}catch(error){publish('error',{view,source,error:String(error?.message||error)});const box=host();if(view===SO_VIEW&&box)box.innerHTML=`<section class="so-root"><div class="so-error">No fue posible abrir Universo SO: ${esc(error?.message||error)}</div></section>`;return false;}finally{dispatching=false;}}
  function viewFromTarget(target){if(!target)return '';const explicit=target.dataset?.view||target.dataset?.atlasMobileView||'';if([SO_VIEW,TERRITORY_VIEW,OSFL_VIEW].includes(explicit))return explicit;const text=String(target.textContent||'').trim();if(/^Universo SO\b/i.test(text))return SO_VIEW;if(/^Territorio\b/i.test(text))return TERRITORY_VIEW;if(/^OSFL\b/i.test(text))return OSFL_VIEW;return '';}
  document.addEventListener('click',event=>{const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button');const view=viewFromTarget(target);if(!view)return;event.preventDefault();event.stopImmediatePropagation();void open(view,'capture-click');},true);
  window.AtlasRouteRecovery0703={open,health:()=>window.__ATLAS_ROUTE_RECOVERY_0703__||null,hydrateUniverso,renderWorkbench,policy:'CANONICAL_UNIVERSO_WORKBENCH_0705'};
  window.AtlasUniversoSO0705={open:()=>openUniverso('api'),hydrate:hydrateUniverso,render:renderWorkbench,version:VERSION};
  bootstrapOperational();publish('installed');
})();