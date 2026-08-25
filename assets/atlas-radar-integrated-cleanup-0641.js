'use strict';
/* ATLAS AML 0.64.1 · limpieza Radar Integrado + auditoría compacta en topbar */
(function atlasRadarIntegratedCleanup0641(){
  const VERSION='0641.2';
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

  function searchInput(){
    return document.querySelector('input[placeholder*="Buscar entidad" i],input[placeholder*="entidad o RUT" i],input[placeholder*="RUT" i]');
  }

  function searchWrapper(input){
    if(!input)return null;
    let node=input;
    for(let i=0;i<4&&node.parentElement;i++){
      const p=node.parentElement;
      const r=p.getBoundingClientRect?.();
      const inputRect=input.getBoundingClientRect?.();
      const cls=String(p.className||'');
      if(/search/i.test(cls))return p;
      if(r&&inputRect&&r.width>=inputRect.width&&r.width<=inputRect.width+90&&r.height<=Math.max(48,inputRect.height+18))return p;
      node=p;
    }
    return input.parentElement||input;
  }

  function findTopbar(){
    const input=searchInput();
    if(input){
      let p=input.parentElement;
      for(let i=0;i<7&&p;i++,p=p.parentElement){
        const txt=norm(p.textContent);
        const hasSearch=p.contains(input);
        const hasSession=txt.includes('salir')||txt.includes('admin')||[...p.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir');
        if(hasSearch&&hasSession)return p;
      }
    }
    const logout=[...document.querySelectorAll('button,a')].find(el=>norm(el.textContent)==='salir');
    if(logout){
      let p=logout.parentElement;
      for(let i=0;i<5&&p;i++,p=p.parentElement){if(p.children.length>=2)return p;}
    }
    return document.querySelector('header,.topbar,.app-topbar,.atlas-topbar,.v019-topbar');
  }

  function moveAudit(){
    const audit=document.querySelector('.ash-audit,.a57-data-audit');
    if(!audit)return;
    const input=searchInput();
    const wrapper=searchWrapper(input);
    const bar=findTopbar();
    if(!bar)return;
    audit.dataset.topbarMode='1';

    if(wrapper?.parentElement){
      const parent=wrapper.parentElement;
      audit.dataset.topbarPlacement='before-search';
      if(audit.parentElement!==parent||audit.nextSibling!==wrapper)parent.insertBefore(audit,wrapper);
      return;
    }

    if(audit.parentElement!==bar)bar.appendChild(audit);
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
