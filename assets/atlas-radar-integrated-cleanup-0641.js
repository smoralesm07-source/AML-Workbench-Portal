'use strict';
/* ATLAS AML 0.64.1 · limpieza Radar Integrado + auditoría compacta en topbar */
(function atlasRadarIntegratedCleanup0641(){
  const VERSION='0641.4';
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

  function findFullMenuRow(input){
    if(!input)return null;
    const vw=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    let node=input.parentElement,best=null;
    for(let i=0;i<10&&node;i++,node=node.parentElement){
      const r=node.getBoundingClientRect?.();
      if(!r)continue;
      const hasSearch=node.contains(input);
      const hasExit=[...node.querySelectorAll('button,a')].some(el=>norm(el.textContent)==='salir');
      const txt=norm(node.textContent);
      const hasRadar=txt.includes('radar integrado');
      if(hasSearch&&r.width>=vw*.80&&r.height<=110){
        best=node;
        if(hasExit||hasRadar)break;
      }
    }
    if(best)return best;
    let title=[...document.querySelectorAll('div,span,b,strong,h1,h2,h3')].find(el=>norm(el.textContent)==='radar integrado');
    if(title){
      let p=title.parentElement;
      for(let i=0;i<8&&p;i++,p=p.parentElement){
        const r=p.getBoundingClientRect?.();
        if(r&&r.width>=vw*.80&&r.height<=110&&p.contains(input))return p;
      }
    }
    return null;
  }

  function moveAudit(){
    const audit=document.querySelector('.ash-audit,.a57-data-audit');
    const input=searchInput();
    if(!audit||!input)return;
    const menu=findFullMenuRow(input);
    if(!menu)return;
    audit.dataset.topbarMode='1';
    audit.dataset.topbarPlacement='center';
    document.querySelectorAll('[data-audit-host="1"]').forEach(el=>{if(el!==menu)delete el.dataset.auditHost;});
    menu.dataset.auditHost='1';
    if(audit.parentElement!==menu)menu.appendChild(audit);
  }

  function apply(){raf=0;removePointFive();moveAudit();}
  function schedule(){if(!raf)raf=requestAnimationFrame(apply);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(schedule,80),{once:true});else setTimeout(schedule,80);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('hashchange',schedule);
  window.addEventListener('popstate',schedule);
  window.AtlasRadarIntegratedCleanup={version:VERSION,refresh:schedule};
})();