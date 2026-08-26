'use strict';
/* ATLAS AML · Universo SO tabs estables 0.82.4
 * Autoridad única de los tres accesos superiores. Reconciliación sin timers,
 * sin dependencia del orden de carga entre Universo SO y Gestión candidatos.
 */
(function atlasUniversoSOTabsStable0824(){
  if(window.AtlasUniversoSOTabsStable0824)return;

  const icons=[
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M15.8 10.5a2.5 2.5 0 1 0 0-5"/><path d="M3.5 19c.4-3.4 2.1-5.2 5-5.2s4.6 1.8 5 5.2"/><path d="M14.5 14.2c2.8.2 4.4 1.8 4.8 4.8"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3"/><path d="M4.5 19c.4-3.5 2.2-5.4 5.5-5.4 2 0 3.5.7 4.4 2"/><path d="M16.2 15.2h4.3v4.3h-4.3z"/><path d="m17.2 17.3.8.8 1.6-1.7"/></svg>'
  ];
  const config=[
    {title:'SO inscritos',subtitle:'nómina UAF',badge:'10.294',mode:'inscritos'},
    {title:'Potenciales SO',subtitle:'universo completo',badge:'74.087',mode:'potenciales'},
    {title:'Gestión candidatos',subtitle:'contacto OSINT · seguimiento',badge:'—',management:true,muted:true}
  ];

  function canonicalButton(i,existing){
    const c=config[i];
    let b=existing;
    if(!b){b=document.createElement('button');b.type='button'}
    if(c.mode){
      b.dataset.u816Mode=c.mode;
      delete b.dataset.uso830Candidates;
      b.classList.remove('uso820-management-tab');
    }else{
      delete b.dataset.u816Mode;
      b.dataset.uso830Candidates='1';
      b.classList.add('uso820-management-tab');
    }
    b.dataset.usoStable0824=String(i);
    const active=i<2 && ((c.mode==='inscritos'&&existing?.classList.contains('active'))||(c.mode==='potenciales'&&existing?.classList.contains('active')));
    if(i<2)b.classList.toggle('active',!!active);
    const wanted=`<span class="uso-tab-icon">${icons[i]}</span><span class="uso-tab-copy"><b>${c.title}</b><small>${c.subtitle}</small></span><span class="uso-tab-badge${c.muted?' muted':''}">${c.badge}</span>`;
    if(b.innerHTML!==wanted)b.innerHTML=wanted;
    return b;
  }

  function reconcile(){
    const tabs=document.querySelector('.uso81-tabs');
    if(!tabs)return false;
    const current=[...tabs.children].filter(n=>n.tagName==='BUTTON');
    const byMode={
      inscritos:current.find(b=>b.dataset.u816Mode==='inscritos'),
      potenciales:current.find(b=>b.dataset.u816Mode==='potenciales'),
      management:current.find(b=>b.dataset.uso830Candidates==='1')
    };
    const ordered=[
      canonicalButton(0,byMode.inscritos||current[0]),
      canonicalButton(1,byMode.potenciales||current.find(b=>b!==byMode.inscritos&&b!==current[0])||current[1]),
      canonicalButton(2,byMode.management)
    ];
    let changed=false;
    ordered.forEach((b,i)=>{
      if(tabs.children[i]!==b){tabs.insertBefore(b,tabs.children[i]||null);changed=true}
    });
    [...tabs.children].forEach(n=>{if(n.tagName==='BUTTON'&&!ordered.includes(n)){n.remove();changed=true}});
    return changed;
  }

  let queued=false;
  function queue(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;reconcile()});
  }

  const observer=new MutationObserver(muts=>{
    if(muts.some(m=>m.type==='childList'&&(m.target?.classList?.contains('uso81-tabs')||m.target?.closest?.('.uso81')||[...m.addedNodes].some(n=>n.nodeType===1&&(n.classList?.contains('uso81-tabs')||n.querySelector?.('.uso81-tabs'))))))queue();
  });
  function start(){
    if(!document.body)return;
    observer.observe(document.body,{childList:true,subtree:true});
    reconcile();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  document.addEventListener('click',e=>{if(e.target.closest?.('.uso81,[data-uso830-candidates],[data-u816-mode]'))queue()},true);

  window.AtlasUniversoSOTabsStable0824={version:'0.82.4',reconcile};
  window.AtlasUniversoSOTabsModern0823=window.AtlasUniversoSOTabsStable0824;
  window.AtlasUniversoSOTabsModern0822=window.AtlasUniversoSOTabsStable0824;
})();