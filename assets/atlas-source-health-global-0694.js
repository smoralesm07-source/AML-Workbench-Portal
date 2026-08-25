'use strict';
/* ATLAS AML 0.70.5 · Auditoría y salud de fuentes global */
(function atlasGlobalSourceHealth0705(){
  const VERSION='0.70.5';
  let raf=0;
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();

  function authVisible(){
    const auth=document.querySelector('.auth-screen');
    if(!auth)return false;
    const r=auth.getBoundingClientRect?.();
    return !!r&&r.width>0&&r.height>0;
  }

  function topbar(){
    const vw=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    const candidates=[...document.querySelectorAll('header,nav,[role="banner"],.v019-topbar,.topbar,.app-topbar,.app-header,.shell-topbar,.header')]
      .map(el=>({el,r:el.getBoundingClientRect?.(),txt:norm(el.textContent)}))
      .filter(x=>x.r&&x.r.width>=vw*.72&&x.r.height>=34&&x.r.height<=120&&x.r.top<150);
    const exact=candidates.find(x=>x.txt.includes('radar integrado')&&[...x.el.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir'));
    if(exact)return exact.el;
    const withExit=candidates.find(x=>[...x.el.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir'));
    if(withExit)return withExit.el;
    const search=document.querySelector('input[placeholder*="Buscar entidad" i],input[placeholder*="entidad o RUT" i],input[placeholder*="RUT" i]');
    if(search){
      let node=search.parentElement;
      for(let i=0;i<9&&node;i++,node=node.parentElement){
        const r=node.getBoundingClientRect?.();
        if(r&&r.width>=vw*.72&&r.height<=120&&r.top<150)return node;
      }
    }
    return candidates[0]?.el||null;
  }

  function fallbackHost(){
    let h=document.querySelector('[data-atlas-global-audit-fallback="1"]');
    if(!h){h=document.createElement('div');h.dataset.atlasGlobalAuditFallback='1';document.body.appendChild(h);}
    return h;
  }

  function ensureAudit(){
    const audits=[...document.querySelectorAll('.ash-audit,.a57-data-audit')];
    if(audits.length){
      const primary=audits[0];
      audits.slice(1).forEach(el=>{if(el.dataset.atlasAuditSeed)el.remove();});
      return primary;
    }
    const seed=document.createElement('section');
    seed.className='v024-audit a57-data-audit';
    seed.dataset.atlasAuditSeed='0705';
    seed.innerHTML='<button type="button" class="v024-audit-summary"><span class="a57-title"><span><strong>Auditoría y salud de fuentes</strong><small>Inicializando telemetría gobernada</small></span></span></button>';
    document.body.appendChild(seed);
    return seed;
  }

  function place(){
    raf=0;
    if(authVisible())return;
    const audit=ensureAudit();
    if(!audit)return;
    const bar=topbar();
    const host=bar||fallbackHost();
    document.querySelectorAll('[data-audit-host="1"]').forEach(el=>{if(el!==host)delete el.dataset.auditHost;});
    document.querySelectorAll('[data-atlas-global-audit-host]').forEach(el=>{if(el!==host)delete el.dataset.atlasGlobalAuditHost;});
    host.dataset.auditHost='1';
    host.dataset.atlasGlobalAuditHost='0705';
    audit.dataset.topbarMode='1';
    audit.dataset.topbarPlacement='center';
    audit.dataset.globalAudit='0705';
    if(audit.parentElement!==host)host.appendChild(audit);
    const fallback=document.querySelector('[data-atlas-global-audit-fallback="1"]');
    if(bar&&fallback&&fallback!==host)fallback.remove();
    window.__ATLAS_SOURCE_HEALTH_0705__={version:VERSION,host:bar?'topbar':'fallback',ready:true,checkedAt:new Date().toISOString()};
  }

  function schedule(){if(!raf)raf=requestAnimationFrame(place);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(schedule,80),{once:true});else setTimeout(schedule,80);
  ['hashchange','popstate','resize','pageshow','atlas:nav-refresh'].forEach(evt=>window.addEventListener(evt,schedule));
  window.AtlasGlobalSourceHealth={version:VERSION,refresh:schedule};
})();