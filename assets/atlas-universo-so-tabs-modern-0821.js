'use strict';
/* ATLAS AML · Universo SO tabs estables 0.82.5
 * Autoridad única de los tres accesos superiores.
 * Observación restringida exclusivamente a reemplazos completos de la barra:
 * nunca observa mutaciones internas de Universo SO ni las generadas por sí misma.
 */
(function atlasUniversoSOTabsStable0825(){
  if(window.AtlasUniversoSOTabsStable0825)return;

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
    b.dataset.usoStable0825=String(i);
    if(i<2){
      const active=(c.mode==='inscritos'&&b.classList.contains('active'))||(c.mode==='potenciales'&&b.classList.contains('active'));
      b.classList.toggle('active',active);
    }
    const wanted=`<span class="uso-tab-icon">${icons[i]}</span><span class="uso-tab-copy"><b>${c.title}</b><small>${c.subtitle}</small></span><span class="uso-tab-badge${c.muted?' muted':''}">${c.badge}</span>`;
    if(b.innerHTML!==wanted)b.innerHTML=wanted;
    return b;
  }

  function reconcile(){
    const tabs=document.querySelector('.uso81-tabs');
    if(!tabs)return false;
    const current=[...tabs.children].filter(n=>n.tagName==='BUTTON');
    const inscritos=current.find(b=>b.dataset.u816Mode==='inscritos')||current[0]||null;
    const potenciales=current.find(b=>b.dataset.u816Mode==='potenciales')||current.find(b=>b!==inscritos)||null;
    const management=current.find(b=>b.dataset.uso830Candidates==='1')||null;
    const ordered=[canonicalButton(0,inscritos),canonicalButton(1,potenciales),canonicalButton(2,management)];
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

  /*
   * IMPORTANTE: el observer solo reacciona cuando una mutación INSERTA una nueva
   * barra .uso81-tabs (o un contenedor que la incluya). No escucha mutaciones cuyo
   * target esté dentro de .uso81. Así, innerHTML/insertBefore de reconcile() jamás
   * realimentan el observer y no pueden bloquear el hilo principal.
   */
  const observer=new MutationObserver(muts=>{
    const replaced=muts.some(m=>m.type==='childList'&&[...m.addedNodes].some(n=>
      n.nodeType===1&&(n.classList?.contains('uso81-tabs')||n.querySelector?.('.uso81-tabs'))
    ));
    if(replaced)queue();
  });

  function start(){
    if(!document.body)return;
    observer.observe(document.body,{childList:true,subtree:true});
    reconcile();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  /* Los eventos de navegación son una segunda vía determinista, sin polling. */
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-uso830-candidates],[data-u816-mode],#uso830-back'))queue();
  },true);
  window.addEventListener('atlas:universo-so-0816-ready',queue);

  window.AtlasUniversoSOTabsStable0825={version:'0.82.5',reconcile};
  window.AtlasUniversoSOTabsStable0824=window.AtlasUniversoSOTabsStable0825;
  window.AtlasUniversoSOTabsModern0823=window.AtlasUniversoSOTabsStable0825;
  window.AtlasUniversoSOTabsModern0822=window.AtlasUniversoSOTabsStable0825;
})();