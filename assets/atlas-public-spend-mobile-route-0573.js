'use strict';
/* ATLAS AML · Gasto Público route resilience 0574
 * Self-healing route: garantiza que el módulo base v037 (JS + CSS) esté cargado
 * antes de abrir Gasto Público, tanto en desktop como móvil. No modifica datos,
 * scores ni semántica analítica.
 */
(function(){
  const VIEW='public-spend';
  const AUDIT_ID='atlas-mp-audit-0550';
  const GUIDED_ID='atlas-public-spend-guided-0570';
  const BASE_JS='./v037-public-spend.js?v=0574-1';
  const BASE_CSS='./v037-public-spend.css?v=0574-1';
  let savedAudit=null;
  let savedGuided=null;
  let lastHost=null;
  let scheduled=false;
  let refreshing=false;
  let opening=false;
  let baseLoading=null;

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
      version:'0574.0',
      view:VIEW,
      mobile:isMobile(),
      loaderReady:typeof window.__AML_PUBLIC_SPEND__?.load==='function',
      hostConnected:!!document.querySelector('.v037-spend'),
      auditConnected:!!document.getElementById(AUDIT_ID),
      guidedConnected:!!document.getElementById(GUIDED_ID),
      preservedAudit:!!savedAudit,
      preservedGuided:!!savedGuided,
      checkedAt:new Date().toISOString(),
      ...extra
    };
  }

  function ensureBaseCss(){
    if(document.querySelector('link[data-atlas-public-spend-base="1"]')||[...document.styleSheets].some(s=>String(s.href||'').includes('v037-public-spend.css')))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=BASE_CSS;
    link.dataset.atlasPublicSpendBase='1';
    document.head.appendChild(link);
  }

  function ensureBaseLoader(){
    ensureBaseCss();
    if(typeof window.__AML_PUBLIC_SPEND__?.load==='function')return Promise.resolve(window.__AML_PUBLIC_SPEND__.load);
    if(baseLoading)return baseLoading;
    publish('loading-base-module');
    baseLoading=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>String(s.src||'').includes('v037-public-spend.js'));
      const finish=()=>{
        const loader=window.__AML_PUBLIC_SPEND__?.load;
        if(typeof loader==='function')resolve(loader);
        else reject(new Error('El módulo base de Gasto Público cargó, pero no publicó su loader.'));
      };
      if(existing){
        if(typeof window.__AML_PUBLIC_SPEND__?.load==='function'){finish();return;}
        existing.addEventListener('load',finish,{once:true});
        existing.addEventListener('error',()=>reject(new Error('No fue posible cargar v037-public-spend.js.')),{once:true});
        setTimeout(()=>{
          if(typeof window.__AML_PUBLIC_SPEND__?.load==='function')finish();
          else reject(new Error('Tiempo de espera agotado cargando Gasto Público.'));
        },7000);
        return;
      }
      const script=document.createElement('script');
      script.src=BASE_JS;
      script.async=false;
      script.dataset.atlasPublicSpendBase='1';
      script.onload=finish;
      script.onerror=()=>reject(new Error('No fue posible cargar v037-public-spend.js.'));
      document.head.appendChild(script);
    }).finally(()=>{baseLoading=null;});
    return baseLoading;
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
    publish(guided?'ready':audit?'audit-ready':'ready-base',{hostChanged,restored});
    return true;
  }

  async function openPublicSpend(){
    if(opening)return false;
    opening=true;
    rememberCurrent();
    window.AtlasMobileNav?.close?.();
    publish('opening');
    try{
      const loader=await ensureBaseLoader();
      await loader();
      ensureMounted();
      setTimeout(schedule,60);
      setTimeout(schedule,260);
      setTimeout(schedule,800);
      publish('opened',{routeAuthority:'SELF_HEALING_DIRECT_PUBLIC_SPEND_LOADER'});
      return true;
    }catch(error){
      const message=String(error?.message||error||'UNKNOWN');
      publish('route-error',{error:message});
      const content=document.querySelector('#content');
      if(content)content.innerHTML=`<div class="v037-error"><b>No fue posible abrir Gasto Público.</b><br>${message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}<br><small>ATLAS intentó recuperar automáticamente el módulo base.</small></div>`;
      throw error;
    }finally{
      opening=false;
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-view="public-spend"],[data-atlas-mobile-view="public-spend"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPublicSpend().catch(()=>{});
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
  window.AtlasPublicSpendMobile0573={ensure:ensureMounted,open:openPublicSpend,loadBase:ensureBaseLoader,health:()=>window.__ATLAS_PUBLIC_SPEND_MOBILE_0573__||null};
  window.AtlasPublicSpendRoute0573=window.AtlasPublicSpendMobile0573;

  ensureBaseCss();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  for(const ms of [80,260,700,1500])setTimeout(schedule,ms);
})();
