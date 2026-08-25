'use strict';
/* ATLAS AML 0.64.1 · limpieza Radar Integrado + auditoría compacta en topbar */
(function atlasRadarIntegratedCleanup0641(){
  const VERSION='0641.1';
  let raf=0;

  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();

  function removeByHeading(text){
    const wanted=norm(text);
    const nodes=[...document.querySelectorAll('h1,h2,h3,h4,h5,strong,b,span,div')]
      .filter(el=>norm(el.textContent)===wanted);
    nodes.forEach(el=>{
      let target=el;
      for(let i=0;i<6&&target?.parentElement;i++){
        const p=target.parentElement;
        const cls=String(p.className||'');
        if(/section|deck|entries|entry|step|card|block|panel|footer|footnote/i.test(cls)||['SECTION','ARTICLE','FOOTER'].includes(p.tagName)){
          target=p;break;
        }
        target=p;
      }
      if(target&&target!==document.body&&target!==document.documentElement)target.remove();
    });
  }

  function removePointFive(){
    document.querySelectorAll('.v036-entries,.v036-priority-card,.v036-priority-list,.v036-entry-actions,.v036-entry-grid,.v036-entry-head,.v036-entry-shell,.v036-entry-deck,.v036-entry-footer,.v036-sources,.v036-contracts,.v036-footnote,.v036-source-note').forEach(el=>el.remove());
    document.querySelectorAll('[data-v036-step="05"],.v036-step[data-step="05"]').forEach(el=>el.remove());
    removeByHeading('Entrar al análisis');
    removeByHeading('Fuentes y contratos');

    [...document.querySelectorAll('footer,div,p,span')].forEach(el=>{
      const t=norm(el.textContent);
      if(t.startsWith('fuentes y contratos')&&t.length<1400){
        const target=el.closest('footer,.v036-footer,.v036-footnote,.v036-source-note')||el;
        if(target&&target!==document.body)target.remove();
      }
    });
  }

  function findTopbar(){
    const search=document.querySelector('input[placeholder*="Buscar entidad" i],input[placeholder*="RUT" i]');
    if(search){
      let p=search.parentElement;
      for(let i=0;i<5&&p;i++,p=p.parentElement){
        const txt=norm(p.textContent);
        if(txt.includes('salir')||txt.includes('admin')||p.querySelector('button'))return p;
      }
    }
    const logout=[...document.querySelectorAll('button,a')].find(el=>norm(el.textContent)==='salir');
    if(logout){
      let p=logout.parentElement;
      for(let i=0;i<4&&p;i++,p=p.parentElement){if(p.children.length>=2)return p;}
    }
    return document.querySelector('header,.topbar,.app-topbar,.atlas-topbar,.v019-topbar');
  }

  function moveAudit(){
    const audit=document.querySelector('.ash-audit,.a57-data-audit');
    if(!audit)return;
    const bar=findTopbar();
    if(!bar)return;
    audit.dataset.topbarMode='1';

    const search=bar.querySelector('input[placeholder*="Buscar entidad" i],input[placeholder*="RUT" i]');
    const anchor=search?.closest('div')||search;
    if(anchor&&anchor.parentElement===bar){
      if(audit.parentElement!==bar||audit.nextSibling!==anchor)bar.insertBefore(audit,anchor);
    }else if(audit.parentElement!==bar){
      bar.appendChild(audit);
    }
  }

  function apply(){
    raf=0;
    removePointFive();
    moveAudit();
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(apply);}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(schedule,80),{once:true});else setTimeout(schedule,80);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',schedule);
  window.addEventListener('popstate',schedule);
  window.AtlasRadarIntegratedCleanup={version:VERSION,refresh:schedule};
})();
