'use strict';
/* ATLAS AML · Universo SO tabs modernas 0.82.3 + Contacto OSINT 0.84 */
(function atlasUniversoSOTabsModern0823(){
  function loadContactLayer(){
    if(!document.querySelector('link[data-atlas-contact-osint-0840]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./assets/atlas-universo-so-contact-osint-0840.css?v=0840-1';l.dataset.atlasContactOsint0840='1';document.head.appendChild(l)}
    if(!document.querySelector('script[data-atlas-contact-osint-0840]')&&!window.AtlasUniversoSOContactOSINT0840){const s=document.createElement('script');s.src='./assets/atlas-universo-so-contact-osint-0840.js?v=0840-1';s.dataset.atlasContactOsint0840='1';document.head.appendChild(s)}
  }
  const icons=[
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M15.8 10.5a2.5 2.5 0 1 0 0-5"/><path d="M3.5 19c.4-3.4 2.1-5.2 5-5.2s4.6 1.8 5 5.2"/><path d="M14.5 14.2c2.8.2 4.4 1.8 4.8 4.8"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3"/><path d="M4.5 19c.4-3.5 2.2-5.4 5.5-5.4 2 0 3.5.7 4.4 2"/><path d="M16.2 15.2h4.3v4.3h-4.3z"/><path d="m17.2 17.3.8.8 1.6-1.7"/></svg>'
  ];
  const config=[
    {title:'SO inscritos',subtitle:'nómina UAF',badge:'10.294'},
    {title:'Potenciales SO',subtitle:'universo completo',badge:'74.087'},
    {title:'Gestión candidatos',subtitle:'seleccionados · contacto y seguimiento',badge:'—',muted:true}
  ];
  function decorate(){
    loadContactLayer();
    const tabs=document.querySelector('.uso81-tabs');
    if(!tabs)return;
    const buttons=[...tabs.children].filter(x=>x.tagName==='BUTTON').slice(0,3);
    buttons.forEach((b,i)=>{
      const c=config[i];if(!c)return;
      const expected=`0823-${i}`;
      if(b.dataset.usoModern0823===expected&&b.querySelector('.uso-tab-icon'))return;
      b.dataset.usoModern0823=expected;
      b.innerHTML=`<span class="uso-tab-icon">${icons[i]}</span><span class="uso-tab-copy"><b>${c.title}</b><small>${c.subtitle}</small></span><span class="uso-tab-badge${c.muted?' muted':''}">${c.badge}</span>`;
    });
  }
  let observer=null;
  function observe(){
    const root=document.querySelector('#content')||document.querySelector('#app')||document.body;
    if(observer||!root)return;
    observer=new MutationObserver(()=>decorate());
    observer.observe(root,{childList:true,subtree:true});
  }
  const schedule=()=>{decorate();setTimeout(decorate,60);setTimeout(decorate,220);setTimeout(decorate,700);};
  document.addEventListener('click',e=>{if(e.target.closest?.('.uso81-tabs,.uso81'))schedule();},true);
  document.addEventListener('change',e=>{if(e.target.closest?.('.uso81'))schedule();},true);
  window.addEventListener('load',()=>{observe();schedule();});
  loadContactLayer();observe();schedule();
  window.AtlasUniversoSOTabsModern0823={version:'0.82.3',contactLayer:'0.84.0',decorate};
})();