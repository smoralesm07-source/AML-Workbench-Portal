'use strict';
/* ATLAS AML 0.64.1 · limpieza Radar Integrado + auditoría compacta en topbar */
(function atlasRadarIntegratedCleanup0641(){
  const VERSION='0641.3';
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

  function findMenuRow(input){
    if(!input)return null;
    let node=input.parentElement;
    let fallback=null;
    for(let i=0;i<9&&node;i++,node=node.parentElement){
      const text=norm(node.textContent);
      const hasSearch=node.contains(input);
      const hasTitle=text.includes('radar integrado');
      const hasExit=[...node.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir');
      if(hasSearch&&hasTitle&&hasExit)return node;
      if(!fallback&&hasSearch&&hasExit)fallback=node;
    }
    return fallback;
  }

  function moveAudit(){
    const audit=document.querySelector('.ash-audit,.a57-data-audit');
    const input=searchInput();
    if(!audit||!input)return;
    const menu=findMenuRow(input);
    if(!menu)return;

    audit.dataset.topbarMode='1';
    audit.dataset.topbarPlacement='center';
    menu.dataset.auditHost='1';
    if(audit.parentElement!==menu)menu.appendChild(audit);
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