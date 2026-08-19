(function(){
  'use strict';

  const GROUPS=[
    {label:'Explorar',views:['overview','entities','territory']},
    {label:'Radares',views:['sanctions','public-spend','osfl']},
    {label:'Análisis',views:['questions']}
  ];
  const META={
    overview:{label:'Radar integrado',icon:'grid'},
    entities:{label:'Entidades',icon:'entity'},
    territory:{label:'Territorio',icon:'map'},
    sanctions:{label:'Sanciones',icon:'alert'},
    'public-spend':{label:'Gasto público',icon:'flow'},
    osfl:{label:'OSFL',icon:'network'},
    questions:{label:'Preguntas',icon:'question'}
  };
  const PATHS={
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    entity:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    alert:'<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5h.01"/>',
    flow:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.5 7.6l4.3 8M17.5 7.6l-4.3 8"/>',
    network:'<circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m11 6.8-5 9.4M13 6.8l5 9.4M7 18h10"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9.5a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.1.8-1.1 1.6v.5M12 17.5h.01"/>'
  };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function icon(name){return `<span class="atlas-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${PATHS[name]||PATHS.grid}</svg></span>`;}
  function release(){return String(window.AtlasRelease?.version||window.__ATLAS_ACTIVE_VERSION__||document.documentElement.getAttribute('data-atlas-release')||document.documentElement.getAttribute('data-aml-version')||'current');}

  function applyIdentity(){
    try{window.AtlasRelease?.apply?.();}catch{}
    const version=release();
    document.querySelectorAll('.v019-brand').forEach(brand=>{
      const strong=brand.querySelector('strong');
      if(strong&&strong.textContent!=='ATLAS AML')strong.textContent='ATLAS AML';
      const small=brand.querySelector('small');
      if(small){
        const label=`v${version}`;
        if(small.textContent!==label)small.textContent=label;
        small.dataset.activeVersion=version;
        small.setAttribute('aria-label',`Versión ${version}`);
        small.setAttribute('data-runtime-label',label);
      }
    });
  }

  function rebuildButton(button,view){
    const meta=META[view];
    if(!meta)return;
    const news=button.querySelector('.atlas-nav-news')?.outerHTML||'';
    button.classList.add('atlas-nav-btn');
    button.removeAttribute('style');
    button.setAttribute('aria-label',meta.label);
    button.innerHTML=`${icon(meta.icon)}<span class="atlas-nav-text">${esc(meta.label)}</span>${news}<span class="atlas-nav-chevron" aria-hidden="true">›</span>`;
  }

  function normalizeNav(){
    const nav=document.querySelector('.v019-nav');
    if(!nav)return false;
    const buttons=new Map([...nav.querySelectorAll('.v019-nav-btn[data-view]')].map(b=>[b.dataset.view,b]));

    /* Gasto Público may be injected late by the v037 compatibility layer. */
    for(const [view,button] of buttons){
      if(!META[view])continue;
      const malformed=!button.classList.contains('atlas-nav-btn')||!button.querySelector('.atlas-nav-icon')||!button.querySelector('.atlas-nav-text')||button.querySelector('.atlas-nav-text')?.textContent!==META[view].label;
      if(malformed)rebuildButton(button,view);
      button.style.removeProperty('margin-left');
      button.style.removeProperty('padding-left');
      button.querySelectorAll('.v030-nav-dot,[data-legacy-nav-marker]').forEach(el=>el.remove());
    }

    nav.querySelectorAll('.v019-nav-label,.atlas-nav-section').forEach(el=>el.remove());
    for(const group of GROUPS){
      const present=group.views.filter(view=>buttons.has(view));
      if(!present.length)continue;
      const section=document.createElement('span');
      section.className='atlas-nav-section';
      section.textContent=group.label;
      nav.appendChild(section);
      for(const view of present)nav.appendChild(buttons.get(view));
    }
    for(const [view,button] of buttons){
      if(!META[view])nav.appendChild(button);
    }

    applyIdentity();
    window.__ATLAS_NAV_HEALTH__={status:'ready',version:release(),publicSpendAligned:!!nav.querySelector('[data-view="public-spend"].atlas-nav-btn'),checkedAt:new Date().toISOString()};
    return true;
  }

  let queued=false;
  function queueNormalize(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;normalizeNav();});
  }

  let observedNav=null;
  let observer=null;
  function bindObserver(){
    const nav=document.querySelector('.v019-nav');
    if(!nav||nav===observedNav)return;
    observer?.disconnect();
    observedNav=nav;
    observer=new MutationObserver(records=>{
      if(records.some(r=>r.type==='childList'&&r.addedNodes.length))queueNormalize();
    });
    observer.observe(nav,{childList:true});
  }

  function settle(){normalizeNav();bindObserver();}

  if(typeof window.shell==='function'){
    const baseShell=window.shell;
    window.shell=function(...args){
      const result=baseShell(...args);
      queueMicrotask(settle);
      return result;
    };
  }
  if(typeof window.navigate==='function'){
    const baseNavigate=window.navigate;
    window.navigate=async function(...args){
      const result=await baseNavigate(...args);
      settle();
      return result;
    };
  }

  window.addEventListener('atlas:nav-refresh',settle);
  window.addEventListener('atlas:themechange',settle);
  window.AtlasCurrentUI={refresh:settle,version:release};

  settle();
  for(const ms of [0,80,240,600,1200])setTimeout(settle,ms);
})();
