'use strict';
/* ATLAS AML · Universo SO · Route authority 0.70.2
 *
 * Corrige una condición de carrera de navegación: el botón Universo SO puede
 * ser reconstruido por capas posteriores del shell y perder el listener que
 * originalmente instaló atlas-obligated-subjects-0560.js. Esta autoridad usa
 * captura delegada y re-afirma window.navigate, siguiendo el mismo patrón de
 * navegación robusta utilizado por otras superficies Atlas.
 *
 * El Workbench visual 0.70 permanece desactivado. La autoridad de contenido
 * sigue siendo el módulo estable 0.56–0.67; este archivo sólo garantiza que la
 * ruta abra y, si es necesario, materializa el panorama usando las mismas
 * vistas que utiliza el core.
 */
(function atlasUniversoSORoute0702(){
  if(window.AtlasUniversoSORoute0702)return;

  const VIEW='sujetos-obligados';
  const OVERVIEW='aml_uaf_obligated_overview_snapshot';
  const SECTORS='aml_uaf_obligated_sector_snapshot';
  const VERSION='USO-ROUTE-0702.1';
  let delegatedNavigate=null,dispatching=false,active=false,recoveryTimer=null;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const core=()=>window.__ATLAS_OBLIGATED__||null;
  const host=()=>document.querySelector('#content');

  function publish(status,extra={}){
    window.__ATLAS_UNIVERSO_SO_0700__={
      active:true,
      workbench:false,
      routeAuthority:true,
      version:'0.70.2',
      authority:VERSION,
      status,
      routeActive:active,
      coreAvailable:!!core(),
      navigateWrapped:!!window.navigate?.__atlasUniversoSOAuthority,
      checkedAt:new Date().toISOString(),
      ...extra
    };
  }

  async function hydrate(){
    const api=core();
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

  async function open(source='navigate'){
    if(dispatching)return false;
    dispatching=true;active=true;publish('opening',{source});
    try{
      const api=core();
      if(!api)throw new Error('Universo SO no terminó de cargar.');

      if(typeof window.shell==='function'){
        window.shell('Universo SO','Padrón de sujetos obligados UAF y universo de potenciales SO, con priorización fiscalizadora, evidencia y límites metodológicos explícitos.');
      }
      const box=host();
      if(box)box.innerHTML='<section class="so-root"><div class="so-loading">Consultando el padrón de sujetos obligados bajo la sesión autorizada…</div></section>';

      await hydrate();
      api.state.error=null;
      api.state.mode='panorama';
      api.state.dossier=null;
      api.render();
      window.dispatchEvent(new CustomEvent('atlas:nav-refresh'));
      publish('ready',{source,subjects:api.state?.overview?.registry?.subjects||null});
      return true;
    }catch(error){
      const api=core();
      if(api?.state){api.state.error=String(error?.message||error);api.state.mode='panorama';}
      try{api?.render?.();}catch(_e){
        const box=host();if(box)box.innerHTML='<section class="so-root"><div class="so-error">No fue posible abrir Universo SO.</div></section>';
      }
      publish('error',{source,error:String(error?.message||error)});
      return false;
    }finally{dispatching=false;}
  }

  function install(source='install'){
    const current=window.navigate;
    if(typeof current!=='function'){publish('navigate-missing',{source});return false;}
    if(current.__atlasUniversoSOAuthority){publish('authority-confirmed',{source});return true;}
    delegatedNavigate=current;
    const wrapper=function(view,...args){
      if(view===VIEW)return open('window.navigate');
      active=false;
      return delegatedNavigate.call(this,view,...args);
    };
    Object.defineProperty(wrapper,'__atlasUniversoSOAuthority',{value:true});
    window.navigate=wrapper;
    publish('authority-installed',{source});
    return true;
  }

  function isUniversoTarget(event){
    const target=event.target?.closest?.('[data-view],[data-atlas-mobile-view],button');
    if(!target)return false;
    if(target.dataset?.view===VIEW||target.dataset?.atlasMobileView===VIEW)return true;
    return target.matches?.('.v019-nav-btn,.nav-btn')&&String(target.textContent||'').trim().startsWith('Universo SO');
  }

  document.addEventListener('click',event=>{
    const any=event.target?.closest?.('[data-view],[data-atlas-mobile-view]');
    if(!isUniversoTarget(event)){if(any)active=false;return;}
    event.preventDefault();
    event.stopImmediatePropagation();
    void open('capture-click');
  },true);

  function scheduleRecovery(source='mutation'){
    clearTimeout(recoveryTimer);
    recoveryTimer=setTimeout(()=>{
      if(!active)return;
      if(!document.querySelector('.so-root'))void open(source);
    },120);
  }

  const observer=new MutationObserver(()=>{
    if(!window.navigate?.__atlasUniversoSOAuthority)install('mutation-reassert');
    if(active)scheduleRecovery('dom-recovery');
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('pageshow',()=>install('pageshow'));
  window.addEventListener('atlas:nav-refresh',()=>install('nav-refresh'));

  window.AtlasUniversoSORoute0702={open,install,health:()=>window.__ATLAS_UNIVERSO_SO_0700__||null};
  publish('booting');
  install('initial');
  for(const ms of [0,50,250,900,2200])setTimeout(()=>install(`deferred-${ms}`),ms);
})();
