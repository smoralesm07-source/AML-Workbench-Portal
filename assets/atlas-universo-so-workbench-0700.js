'use strict';
/* ATLAS AML · Navigation recovery 0.70.3
 *
 * Hotfix transversal para Universo SO, Territorio y OSFL.
 *
 * Root cause 0.70.2: esta capa y la autoridad de Gasto Público competían por
 * re-afirmar window.navigate mediante MutationObserver. Esa carrera podía crear
 * una cadena creciente de wrappers y degradar rutas no relacionadas.
 *
 * Política 0.70.3:
 * - NO reescribe window.navigate.
 * - NO usa MutationObserver.
 * - NO modifica datos, RLS, scores ni metodología.
 * - Captura solamente los tres destinos afectados y llama a sus loaders
 *   canónicos de forma directa.
 * - Universo SO mantiene el Workbench visual 0.70 desactivado y usa el core
 *   estable 0.56–0.67.
 */
(function atlasRouteRecovery0703(){
  if(window.AtlasRouteRecovery0703)return;

  const VERSION='0.70.3';
  const SO_VIEW='sujetos-obligados';
  const TERRITORY_VIEW='territory';
  const OSFL_VIEW='osfl';
  const OVERVIEW='aml_uaf_obligated_overview_snapshot';
  const SECTORS='aml_uaf_obligated_sector_snapshot';
  let dispatching=false;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const soCore=()=>window.__ATLAS_OBLIGATED__||null;
  const host=()=>document.querySelector('#content');

  function publish(status,extra={}){
    window.__ATLAS_ROUTE_RECOVERY_0703__={
      active:true,
      version:VERSION,
      passive:true,
      navigateMutation:false,
      mutationObserver:false,
      status,
      territoryLoader:typeof window.v019LoadTerritory==='function'||typeof v019LoadTerritory==='function',
      osflLoader:typeof window.v030LoadOsfl==='function'||typeof v030LoadOsfl==='function',
      obligatedCore:!!soCore(),
      checkedAt:new Date().toISOString(),
      ...extra
    };
    window.__ATLAS_UNIVERSO_SO_0700__={
      active:true,
      workbench:false,
      routeAuthority:false,
      passiveRecovery:true,
      version:VERSION,
      status,
      checkedAt:new Date().toISOString(),
      ...extra
    };
  }

  async function hydrateUniverso(){
    const api=soCore();
    if(!api)throw new Error('El núcleo de Universo SO no está disponible.');
    if(api.state?.overview&&api.state?.sectors)return true;
    const client=db();
    if(!client)throw new Error('La sesión de datos no está disponible.');

    const [ov,sec]=await Promise.all([
      client.from(OVERVIEW).select('payload,refreshed_at').eq('snapshot_key','CURRENT').maybeSingle(),
      client.from(SECTORS).select('*').order('subject_count',{ascending:false})
    ]);
    if(ov.error)throw ov.error;
    if(sec.error)throw sec.error;
    if(!ov.data)throw new Error('El panorama del padrón aún no está materializado en este corte.');

    api.state.overview=ov.data.payload||null;
    api.state.overviewAt=ov.data.refreshed_at||null;
    api.state.sectors=sec.data||[];
    return true;
  }

  async function openUniverso(source='delegated-click'){
    const api=soCore();
    if(!api)throw new Error('Universo SO no terminó de cargar.');
    if(typeof window.shell==='function'){
      window.shell('Universo SO','Padrón de sujetos obligados UAF y universo de potenciales SO, con priorización fiscalizadora, evidencia y límites metodológicos explícitos.');
    }
    const box=host();
    if(box)box.innerHTML='<section class="so-root"><div class="so-loading">Consultando el padrón de sujetos obligados bajo la sesión autorizada…</div></section>';
    await hydrateUniverso();
    api.state.error=null;
    api.state.mode='panorama';
    api.state.dossier=null;
    api.render();
    window.dispatchEvent(new CustomEvent('atlas:nav-refresh'));
    publish('ready',{view:SO_VIEW,source});
    return true;
  }

  async function openTerritory(source='delegated-click'){
    const loader=typeof window.v019LoadTerritory==='function'?window.v019LoadTerritory:(typeof v019LoadTerritory==='function'?v019LoadTerritory:null);
    if(!loader)throw new Error('El loader canónico de Territorio no está disponible.');
    const result=await loader();
    publish('ready',{view:TERRITORY_VIEW,source});
    return result;
  }

  async function openOsfl(source='delegated-click'){
    const loader=typeof window.v030LoadOsfl==='function'?window.v030LoadOsfl:(typeof v030LoadOsfl==='function'?v030LoadOsfl:null);
    if(!loader)throw new Error('El loader canónico de OSFL no está disponible.');
    const result=await loader();
    publish('ready',{view:OSFL_VIEW,source});
    return result;
  }

  async function open(view,source='api'){
    if(dispatching)return false;
    dispatching=true;
    publish('opening',{view,source});
    try{
      if(view===SO_VIEW)return await openUniverso(source);
      if(view===TERRITORY_VIEW)return await openTerritory(source);
      if(view===OSFL_VIEW)return await openOsfl(source);
      return false;
    }catch(error){
      const message=String(error?.message||error);
      if(view===SO_VIEW){
        const api=soCore();
        if(api?.state){api.state.error=message;api.state.mode='panorama';}
        try{api?.render?.();}catch(_e){const box=host();if(box)box.innerHTML='<section class="so-root"><div class="so-error">No fue posible abrir Universo SO.</div></section>';}
      }
      publish('error',{view,source,error:message});
      console.error('[ATLAS route recovery 0.70.3]',view,error);
      return false;
    }finally{
      dispatching=false;
    }
  }

  function viewFromTarget(target){
    if(!target)return '';
    const explicit=target.dataset?.view||target.dataset?.atlasMobileView||'';
    if([SO_VIEW,TERRITORY_VIEW,OSFL_VIEW].includes(explicit))return explicit;
    const text=String(target.textContent||'').trim();
    if(/^Universo SO\b/i.test(text))return SO_VIEW;
    if(/^Territorio\b/i.test(text))return TERRITORY_VIEW;
    if(/^OSFL\b/i.test(text))return OSFL_VIEW;
    return '';
  }

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button');
    const view=viewFromTarget(target);
    if(!view)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void open(view,'capture-click');
  },true);

  window.AtlasRouteRecovery0703={
    open,
    health:()=>window.__ATLAS_ROUTE_RECOVERY_0703__||null,
    policy:'PASSIVE_DELEGATED_NO_NAVIGATE_MUTATION_NO_OBSERVER'
  };

  publish('installed');
})();
