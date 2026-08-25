'use strict';
/* ATLAS AML 0.69.4 · Auditoría y salud de fuentes global */
(function atlasGlobalSourceHealth0694(){
  const VERSION='0694.1';
  let raf=0,host=null;
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();

  function authVisible(){
    const auth=document.querySelector('.auth-screen');
    if(!auth)return false;
    const r=auth.getBoundingClientRect?.();
    return !!r&&r.width>0&&r.height>0;
  }

  function findTopbar(){
    const vw=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    const search=document.querySelector('input[placeholder*="Buscar entidad" i],input[placeholder*="entidad o RUT" i],input[placeholder*="RUT" i]');
    if(search){
      let node=search.parentElement,best=null;
      for(let i=0;i<10&&node;i++,node=node.parentElement){
        const r=node.getBoundingClientRect?.();
        if(!r)continue;
        const hasExit=[...node.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir');
        if(r.width>=vw*.80&&r.height<=110){best=node;if(hasExit)break;}
      }
      if(best)return best;
    }
    const candidates=[...document.querySelectorAll('header,nav,[role="banner"],.topbar,.app-topbar,.app-header,.shell-topbar,.header')];
    const ranked=candidates.map(el=>({el,r:el.getBoundingClientRect?.(),txt:norm(el.textContent)})).filter(x=>x.r&&x.r.width>=vw*.72&&x.r.height>=32&&x.r.height<=120&&x.r.top<140);
    const withExit=ranked.find(x=>[...x.el.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir'));
    return (withExit||ranked[0])?.el||null;
  }

  function fallbackHost(){
    let h=document.querySelector('[data-atlas-global-audit-fallback="1"]');
    if(!h){h=document.createElement('div');h.dataset.atlasGlobalAuditFallback='1';document.body.appendChild(h);}
    return h;
  }

  function ensureSeed(){
    if(document.querySelector('.ash-audit,.a57-data-audit'))return;
    const seed=document.createElement('section');
    seed.className='v024-audit a57-data-audit';
    seed.dataset.atlasAuditSeed='0694';
    seed.innerHTML='<button type="button" class="v024-audit-summary"><span class="a57-title"><span><strong>Auditoría y salud de fuentes</strong><small>Inicializando telemetría gobernada</small></span></span></button>';
    document.body.appendChild(seed);
  }

  function place(){
    raf=0;
    if(authVisible()){
      document.querySelector('[data-atlas-global-audit-fallback="1"]')?.remove();
      return;
    }
    ensureSeed();
    const audit=document.querySelector('.ash-audit,.a57-data-audit');
    if(!audit)return;
    const top=findTopbar();
    host=top||fallbackHost();
    document.querySelectorAll('[data-audit-host="1"]').forEach(el=>{if(el!==host)delete el.dataset.auditHost;});
    host.dataset.auditHost='1';
    host.dataset.atlasGlobalAuditHost='0694';
    audit.dataset.topbarMode='1';
    audit.dataset.topbarPlacement='center';
    audit.dataset.globalAudit='0694';
    if(audit.parentElement!==host)host.appendChild(audit);
    const fallback=document.querySelector('[data-atlas-global-audit-fallback="1"]');
    if(top&&fallback&&fallback!==host)fallback.remove();
  }

  function schedule(){if(!raf)raf=requestAnimationFrame(place);}
  const obs=new MutationObserver(schedule);
  obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(schedule,120),{once:true});else setTimeout(schedule,120);
  ['hashchange','popstate','resize','atlas:nav-refresh'].forEach(evt=>window.addEventListener(evt,schedule));
  window.AtlasGlobalSourceHealth={version:VERSION,refresh:schedule};
})();
