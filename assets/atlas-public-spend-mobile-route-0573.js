'use strict';
/* ATLAS AML · Gasto Público route resilience 0573.2
 * Conserva los nodos audit/guided al cambiar de vista y fuerza la ruta oficial v037
 * desde navegación desktop y móvil. No modifica datos, scores ni semántica analítica.
 */
(function(){
  const VIEW='public-spend';
  const AUDIT_ID='atlas-mp-audit-0550';
  const GUIDED_ID='atlas-public-spend-guided-0570';
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
      version:'0573.2',
      view:VIEW,
      mobile:isMobile(),
      hostConnected:!!document.querySelector('.v037-spend'),
      auditConnected:!!document.getElementById(AUDIT_ID),
      guidedConnected:!!document.getElementById(GUIDED_ID),
      preservedAudit:!!savedAudit,
      preservedGuided:!!savedGuided,
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

  function ensureMounted(){
    rememberCurrent();
    const host=document.querySelector('.v037-spend');
    if(!host){
      lastHost=null;
      publish('waiting-host');
      return false;
    }

    const hostChanged=host!==lastHost;
    lastHost=host;
    host.classList.add('mpa-strategic-host');
    let restored=false;

    if(!document.getElementById(AUDIT_ID)&&savedAudit){
      host.prepend(savedAudit);
      restored=true;
    }
    if(!document.getElementById(GUIDED_ID)&&savedGuided){
      host.prepend(savedGuided);
      restored=true;
    }

    rememberCurrent();
    const audit=document.getElementById(AUDIT_ID);
    const guided=document.getElementById(GUIDED_ID);
    if(audit&&guided)audit.style.display='none';

    if((hostChanged||restored||!audit)&&diag())refreshAudit();
    publish(guided?'ready':audit?'audit-ready':'mounting',{hostChanged,restored});
    return !!(guided||audit||host);
  }

  async function openPublicSpend(){
    if(opening)return false;
    const loader=window.__AML_PUBLIC_SPEND__?.load;
    if(typeof loader!=='function'){
      publish('route-loader-missing');
      return false;
    }
    opening=true;
    rememberCurrent();
    window.AtlasMobileNav?.close?.();
    publish('opening');
    try{
      await loader();
      ensureMounted();
      setTimeout(schedule,60);
      setTimeout(schedule,260);
      setTimeout(schedule,800);
      publish('opened',{routeAuthority:'DIRECT_PUBLIC_SPEND_LOADER'});
      return true;
    }catch(error){
      publish('route-error',{error:String(error?.message||error||'UNKNOWN')});
      throw error;
    }finally{
      opening=false;
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!button)return;
    const loader=window.__AML_PUBLIC_SPEND__?.load;
    if(typeof loader!=='function')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPublicSpend().catch(error=>{
      publish('route-error',{error:String(error?.message||error||'UNKNOWN')});
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
  window.addEventListener('resize',schedule,{passive:true});
  window.AtlasPublicSpendMobile0573={ensure:ensureMounted,open:openPublicSpend,health:()=>window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__||null};
  window.AtlasPublicSpendRoute0573=window.AtlasPublicSpendMobile0573;

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  for(const ms of [80,260,700,1500])setTimeout(schedule,ms);
})();
