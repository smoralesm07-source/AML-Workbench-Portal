'use strict';
/* ATLAS AML · Gasto Público route resilience 0575
 * Production-safe route authority for compiled runtime deployments.
 * Never fetches source fragments that Pages deliberately does not publish.
 * If the legacy v037 loader fails to leave a mounted host, reconstructs a stable
 * .v037-spend host and restores Audit/Guided surfaces so the section cannot stay blank.
 */
(function(){
  const VIEW='public-spend';
  const AUDIT_ID='atlas-mp-audit-0550';
  const GUIDED_ID='atlas-public-spend-guided-0570';
  const STATUS_ID='atlas-public-spend-route-status-0575';
  const TITLE='Gasto Público';
  const SUBTITLE='Flujos, proveedores privados y marcas explicables desde Presupuesto Abierto, conectados a identidad gobernada del Workbench.';
  let savedAudit=null;
  let savedGuided=null;
  let lastHost=null;
  let scheduled=false;
  let refreshing=false;
  let opening=false;

  const isMobile=()=>window.matchMedia?window.matchMedia('(max-width: 768px)').matches:window.innerWidth<=768;
  const diag=()=>window.__ATLAS_PUBLIC_SPEND_AUDIT_0550__||null;

  function rememberNode(node){
    if(!node||node.nodeType!==1)return;
    if(node.id===AUDIT_ID)savedAudit=node;
    if(node.id===GUIDED_ID)savedGuided=node;
    const a=node.querySelector?.('#'+AUDIT_ID);
    const g=node.querySelector?.('#'+GUIDED_ID);
    if(a)savedAudit=a;
    if(g)savedGuided=g;
  }

  function rememberCurrent(){
    const a=document.getElementById(AUDIT_ID);
    const g=document.getElementById(GUIDED_ID);
    if(a)savedAudit=a;
    if(g)savedGuided=g;
  }

  function publish(status,extra={}){
    window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__={
      status,
      version:'0575.0',
      view:VIEW,
      mobile:isMobile(),
      loaderReady:typeof window.__AML_PUBLIC_SPEND__?.load==='function',
      hostConnected:!!document.querySelector('.v037-spend'),
      contentConnected:!!document.querySelector('#content'),
      auditConnected:!!document.getElementById(AUDIT_ID),
      guidedConnected:!!document.getElementById(GUIDED_ID),
      preservedAudit:!!savedAudit,
      preservedGuided:!!savedGuided,
      deploymentContract:'COMPILED_BUNDLES_ONLY_NO_SOURCE_FETCH',
      checkedAt:new Date().toISOString(),
      ...extra
    };
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;ensureMounted();});
  }

  function refreshAudit(){
    const api=diag();
    if(refreshing||typeof api?.refresh!=='function')return;
    refreshing=true;
    Promise.resolve(api.refresh()).catch(()=>{}).finally(()=>{
      refreshing=false;
      schedule();
    });
  }

  function ensureShell(){
    let content=document.querySelector('#content');
    if(content)return content;
    if(typeof window.shell==='function'){
      try{window.shell(TITLE,SUBTITLE);}catch(error){publish('shell-error',{error:String(error?.message||error||'UNKNOWN')});}
    }
    return document.querySelector('#content');
  }

  function createStableHost(reason='route-recovery'){
    const content=ensureShell();
    if(!content){
      publish('content-host-missing',{reason});
      return null;
    }
    let host=content.querySelector('.v037-spend');
    if(!host){
      content.innerHTML=`<section class="v037-spend mpa-strategic-host" data-atlas-public-spend-recovery="0575"><div id="${STATUS_ID}" class="v037-loading">Preparando Gasto Público…</div></section>`;
      host=content.querySelector('.v037-spend');
    }
    if(host)host.classList.add('mpa-strategic-host');
    publish('stable-host-ready',{reason,recovered:true});
    return host;
  }

  function restoreSurfaces(host){
    if(!host)return false;
    let restored=false;
    if(!document.getElementById(AUDIT_ID)&&savedAudit){host.prepend(savedAudit);restored=true;}
    if(!document.getElementById(GUIDED_ID)&&savedGuided){host.prepend(savedGuided);restored=true;}
    rememberCurrent();
    const audit=document.getElementById(AUDIT_ID);
    const guided=document.getElementById(GUIDED_ID);
    if(audit&&guided)audit.style.display='none';
    const status=document.getElementById(STATUS_ID);
    if(status&&(guided||audit))status.remove();
    return restored;
  }

  function ensureMounted(){
    rememberCurrent();
    let host=document.querySelector('.v037-spend');
    if(!host){
      lastHost=null;
      publish('waiting-host');
      return false;
    }
    const hostChanged=host!==lastHost;
    lastHost=host;
    host.classList.add('mpa-strategic-host');
    const restored=restoreSurfaces(host);
    const audit=document.getElementById(AUDIT_ID);
    const guided=document.getElementById(GUIDED_ID);
    if((hostChanged||restored||!audit)&&diag())refreshAudit();
    publish(guided?'ready':audit?'audit-ready':'mounting',{hostChanged,restored});
    return true;
  }

  function recoverVisibleSurface(reason,error=null){
    rememberCurrent();
    const host=createStableHost(reason);
    if(!host)return false;
    restoreSurfaces(host);
    const status=document.getElementById(STATUS_ID);
    if(status){
      status.innerHTML=error
        ? `<b>Recuperando la vista de Gasto Público.</b><br><small>${String(error?.message||error||'El cargador principal no dejó un host utilizable.')}</small>`
        : '<b>Preparando Gasto Público…</b><br><small>Cargando la capa analítica gobernada.</small>';
    }
    refreshAudit();
    window.dispatchEvent(new CustomEvent('atlas:public-spend-mounted',{detail:{reason,version:'0575.0'}}));
    setTimeout(schedule,40);
    setTimeout(schedule,180);
    setTimeout(schedule,600);
    setTimeout(schedule,1500);
    return true;
  }

  async function openPublicSpend(){
    if(opening)return false;
    opening=true;
    rememberCurrent();
    window.AtlasMobileNav?.close?.();
    publish('opening');
    let loaderError=null;
    try{
      const loader=window.__AML_PUBLIC_SPEND__?.load;
      if(typeof loader==='function'){
        try{await loader();}catch(error){loaderError=error;publish('legacy-loader-error',{error:String(error?.message||error||'UNKNOWN')});}
      }else{
        publish('compiled-loader-missing');
      }

      if(!document.querySelector('.v037-spend'))recoverVisibleSurface(loaderError?'loader-error-recovery':'missing-host-recovery',loaderError);
      else{
        ensureMounted();
        if(loaderError)recoverVisibleSurface('loader-error-host-preserved',loaderError);
      }

      setTimeout(schedule,60);
      setTimeout(schedule,260);
      setTimeout(schedule,800);
      publish(document.querySelector('.v037-spend')?'opened':'open-incomplete',{
        routeAuthority:'PUBLIC_SPEND_0575_COMPILED_SAFE',
        loaderError:loaderError?String(loaderError?.message||loaderError):null
      });
      return !!document.querySelector('.v037-spend');
    }finally{
      opening=false;
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPublicSpend().catch(error=>{
      publish('route-error',{error:String(error?.message||error||'UNKNOWN')});
      recoverVisibleSurface('route-error-recovery',error);
    });
  },true);

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.removedNodes||[])rememberNode(node);
      for(const node of record.addedNodes||[])rememberNode(node);
    }
    schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('pageshow',schedule);
  window.addEventListener('atlas:nav-refresh',schedule);
  window.addEventListener('atlas:public-spend-mounted',schedule);
  window.addEventListener('resize',schedule,{passive:true});
  window.AtlasPublicSpendMobile0573={ensure:ensureMounted,open:openPublicSpend,recover:recoverVisibleSurface,health:()=>window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__||null};
  window.AtlasPublicSpendRoute0573=window.AtlasPublicSpendMobile0573;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  for(const ms of [80,260,700,1500])setTimeout(schedule,ms);
})();
