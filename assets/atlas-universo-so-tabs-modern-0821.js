'use strict';
/* ATLAS AML · Universo SO tabs modernas 0.82.1 */
(function atlasUniversoSOTabsModern0821(){
  const decorate=()=>{
    const tabs=document.querySelector('.uso81-tabs');
    if(!tabs)return;
    const buttons=[...tabs.querySelectorAll(':scope > button')];
    if(buttons.length<2)return;
    const config=[
      {icon:'◉',title:'SO inscritos',subtitle:'nómina UAF',badge:'10.294'},
      {icon:'◎',title:'Potenciales SO',subtitle:'universo completo',badge:'74.087'},
      {icon:'◇',title:'Gestión candidatos',subtitle:'seleccionados · contacto y seguimiento',badge:'—',muted:true}
    ];
    buttons.slice(0,3).forEach((b,i)=>{
      if(b.dataset.usoModern0821==='1')return;
      const c=config[i];if(!c)return;
      b.dataset.usoModern0821='1';
      b.innerHTML=`<span class="uso-tab-icon" aria-hidden="true">${c.icon}</span><span class="uso-tab-copy"><b>${c.title}</b><small>${c.subtitle}</small></span><span class="uso-tab-badge${c.muted?' muted':''}">${c.badge}</span>`;
    });
  };
  const schedule=()=>{setTimeout(decorate,0);setTimeout(decorate,120);setTimeout(decorate,450);};
  document.addEventListener('click',e=>{if(e.target.closest?.('.uso81-tabs,.uso81'))schedule();},true);
  document.addEventListener('change',e=>{if(e.target.closest?.('.uso81'))schedule();},true);
  window.addEventListener('load',schedule);
  schedule();
  window.AtlasUniversoSOTabsModern0821={version:'0.82.1',decorate};
})();