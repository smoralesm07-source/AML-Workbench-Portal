(function(){
  'use strict';

  const THEME_KEY='atlas-aml:theme:v1';
  const NEWS_KEY='atlas-aml:nav-news:v1';
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

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const release=()=>String(window.AtlasRelease?.version||window.__ATLAS_ACTIVE_VERSION__||document.documentElement.getAttribute('data-atlas-release')||document.documentElement.getAttribute('data-aml-version')||'current');
  const icon=name=>`<span class="atlas-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${PATHS[name]||PATHS.grid}</svg></span>`;

  function readNews(){try{return JSON.parse(localStorage.getItem(NEWS_KEY)||'{}')||{};}catch{return {};}}
  function writeNews(value){try{localStorage.setItem(NEWS_KEY,JSON.stringify(value||{}));}catch{}}
  function normalizeNews(value){
    if(value==null||value===false||value===0||value==='')return null;
    if(typeof value==='number')return {count:Math.max(1,Math.round(value)),label:'Nuevo',ts:Date.now()};
    if(typeof value==='string')return {count:1,label:value.slice(0,12),ts:Date.now()};
    return {count:Math.max(1,Math.round(Number(value.count)||1)),label:String(value.label||'Nuevo').slice(0,12),ts:value.ts||Date.now()};
  }
  function setNews(view,value){
    if(!META[view])return;
    const all=readNews(),next=normalizeNews(value);
    if(next)all[view]=next;else delete all[view];
    writeNews(all);settle();
  }
  function newsBadge(view){
    const item=readNews()[view];if(!item)return '';
    const text=item.count>1&&String(item.label).toLowerCase()==='nuevo'?String(item.count):item.label;
    return `<span class="atlas-nav-news" title="Hay novedades sin revisar">${esc(text)}</span>`;
  }

  function applyIdentity(){
    try{window.AtlasRelease?.apply?.();}catch{}
    const version=release();
    document.querySelectorAll('.v019-brand').forEach(brand=>{
      const strong=brand.querySelector('strong');if(strong&&strong.textContent!=='ATLAS AML')strong.textContent='ATLAS AML';
      const small=brand.querySelector('small');if(small){
        const label=`v${version}`;
        if(small.textContent!==label)small.textContent=label;
        small.dataset.activeVersion=version;
        small.setAttribute('aria-label',`Versión ${version}`);
        small.setAttribute('data-runtime-label',label);
      }
    });
    document.querySelectorAll('.topbar .eyebrow,.v18-pagehead .eyebrow').forEach(el=>{
      const label=`ATLAS AML · v${version}`;if(el.textContent!==label)el.textContent=label;
    });
  }

  function themeNow(){return document.documentElement.getAttribute('data-atlas-theme')==='light'?'light':'dark';}
  function themeSvg(theme){return theme==='dark'
    ?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    :'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8.5 8.5 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z"/></svg>';}
  function setTheme(value,{persist=true,emit=true}={}){
    const next=value==='light'?'light':'dark',prev=themeNow();
    document.documentElement.setAttribute('data-atlas-theme',next);
    document.documentElement.style.colorScheme=next;
    window.__ATLAS_THEME__=next;
    if(persist){try{localStorage.setItem(THEME_KEY,next);}catch{}}
    ensureThemeToggle();
    if(emit&&prev!==next)window.dispatchEvent(new CustomEvent('atlas:themechange',{detail:{theme:next,previous:prev}}));
    return next;
  }
  function ensureThemeToggle(){
    const host=document.querySelector('.v019-top')||document.querySelector('.topbar')||document.querySelector('.v18-appbar');
    if(!host)return;
    let button=host.querySelector('.atlas-theme-toggle');
    if(!button){
      button=document.createElement('button');button.type='button';button.className='atlas-theme-toggle';button.dataset.atlasThemeControl='1';
      const anchor=host.querySelector('.v019-user')||host.querySelector('#v019-logout')||host.querySelector('.status');
      if(anchor&&anchor.parentNode===host)host.insertBefore(button,anchor);else host.appendChild(button);
    }
    const theme=themeNow(),target=theme==='dark'?'claro':'oscuro';
    button.innerHTML=`<span class="atlas-theme-icon">${themeSvg(theme)}</span><span class="atlas-theme-label">${theme==='dark'?'Claro':'Oscuro'}</span>`;
    button.title=`Cambiar a tema ${target}`;button.setAttribute('aria-label',`Cambiar a tema ${target}`);button.setAttribute('aria-pressed',String(theme==='light'));
    if(!button.dataset.atlasThemeBound){button.addEventListener('click',()=>setTheme(themeNow()==='dark'?'light':'dark'));button.dataset.atlasThemeBound='1';}
  }

  function ensurePublicSpend(nav){
    if(nav.querySelector('[data-view="public-spend"]'))return;
    if(!window.__AML_PUBLIC_SPEND__?.load&&typeof window.v037Load!=='function')return;
    const button=document.createElement('button');button.type='button';button.className='v019-nav-btn';button.dataset.view='public-spend';button.textContent='Gasto público';
    button.addEventListener('click',()=>window.navigate?.('public-spend'));
    nav.appendChild(button);
  }
  function rebuildButton(button,view){
    const meta=META[view];if(!meta)return;
    button.classList.add('atlas-nav-btn');button.removeAttribute('style');button.setAttribute('aria-label',meta.label);
    button.innerHTML=`${icon(meta.icon)}<span class="atlas-nav-text">${esc(meta.label)}</span>${newsBadge(view)}<span class="atlas-nav-chevron" aria-hidden="true">›</span>`;
    if(!button.dataset.atlasSeenBound){button.addEventListener('click',()=>setNews(view,null));button.dataset.atlasSeenBound='1';}
  }
  function normalizeNav(){
    const nav=document.querySelector('.v019-nav');if(!nav)return false;
    nav.querySelectorAll('[data-view="uaf"]').forEach(el=>el.remove());
    ensurePublicSpend(nav);
    const buttons=new Map([...nav.querySelectorAll('.v019-nav-btn[data-view]')].map(b=>[b.dataset.view,b]));
    for(const [view,button] of buttons){
      if(!META[view])continue;
      const malformed=!button.classList.contains('atlas-nav-btn')||!button.querySelector('.atlas-nav-icon')||!button.querySelector('.atlas-nav-text')||button.querySelector('.atlas-nav-text')?.textContent!==META[view].label;
      if(malformed)rebuildButton(button,view);else{
        const oldBadge=button.querySelector('.atlas-nav-news');const wanted=newsBadge(view);
        if(!wanted&&oldBadge)oldBadge.remove();else if(wanted&&!oldBadge){const chevron=button.querySelector('.atlas-nav-chevron');chevron?.insertAdjacentHTML('beforebegin',wanted);}
      }
      button.style.removeProperty('margin-left');button.style.removeProperty('padding-left');
      button.querySelectorAll('.v030-nav-dot,[data-legacy-nav-marker]').forEach(el=>el.remove());
    }
    nav.querySelectorAll('.v019-nav-label,.atlas-nav-section').forEach(el=>el.remove());
    for(const group of GROUPS){
      const present=group.views.filter(view=>buttons.has(view));if(!present.length)continue;
      const section=document.createElement('span');section.className='atlas-nav-section';section.textContent=group.label;nav.appendChild(section);
      for(const view of present)nav.appendChild(buttons.get(view));
    }
    for(const [view,button] of buttons)if(!META[view])nav.appendChild(button);
    applyIdentity();ensureThemeToggle();
    window.__ATLAS_NAV_HEALTH__={status:'ready',version:release(),publicSpendAligned:!!nav.querySelector('[data-view="public-spend"].atlas-nav-btn'),checkedAt:new Date().toISOString()};
    return true;
  }

  function translate(value){return String(value??'')
    .replace(/\bPUBLIC\s+ENTITY\b/g,'ENTIDAD PÚBLICA').replace(/\bPublic\s+Entity\b/g,'Entidad pública').replace(/\bpublic\s+entity\b/g,'entidad pública')
    .replace(/\bENTITY\s+ID\b/g,'ID DE ENTIDAD').replace(/\bEntity\s+ID\b/g,'ID de Entidad').replace(/\bentity\s+id\b/g,'ID de Entidad')
    .replace(/\bENTITY\s+360\b/g,'ENTIDAD 360').replace(/\bEntity\s+360\b/g,'Entidad 360').replace(/\bentity\s+360\b/g,'Entidad 360');}
  function localize(root){
    if(!root)return;const skip=new Set(['SCRIPT','STYLE','TEMPLATE','CODE','PRE','KBD','SAMP']);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p||skip.has(p.tagName))return NodeFilter.FILTER_REJECT;return /\b(?:ENTITY|Entity|entity)\s+(?:360|ID)\b|\b(?:PUBLIC ENTITY|Public Entity|public entity)\b/.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const next=translate(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}
  }

  let queued=false,observedNav=null,navObserver=null,bodyObserver=null;
  function queueSettle(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;settle();});}
  function bindObservers(){
    const nav=document.querySelector('.v019-nav');
    if(nav&&nav!==observedNav){navObserver?.disconnect();observedNav=nav;navObserver=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))queueSettle();});navObserver.observe(nav,{childList:true});}
    if(document.body&&!bodyObserver){bodyObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)localize(node);});bodyObserver.observe(document.body,{childList:true,subtree:true});}
  }
  function settle(){normalizeNav();applyIdentity();ensureThemeToggle();localize(document.body);bindObservers();}

  if(typeof window.shell==='function'){const baseShell=window.shell;window.shell=function(...args){const result=baseShell(...args);queueMicrotask(settle);return result;};}
  if(typeof window.navigate==='function'){const baseNavigate=window.navigate;window.navigate=async function(...args){const result=await baseNavigate(...args);settle();return result;};}

  window.addEventListener('atlas:nav-refresh',settle);
  window.addEventListener('atlas:themechange',settle);
  window.addEventListener('atlas:nav-news',e=>{const d=e.detail||{};if(d.view)setNews(d.view,d);});
  window.AtlasCurrentUI={refresh:settle,version:release};
  window.AtlasTheme={get:themeNow,set:value=>setTheme(value),toggle:()=>setTheme(themeNow()==='dark'?'light':'dark')};
  window.AtlasNavNews={set:setNews,clear:view=>setNews(view,null),all:readNews,markSeen:view=>setNews(view,null)};
  window.AtlasTerminology={language:'es',entity360:'Entidad 360',entityId:'ID de Entidad',translate,apply:()=>localize(document.body)};

  setTheme(themeNow(),{persist:false,emit:false});settle();
  for(const ms of [0,80,240,600,1200])setTimeout(settle,ms);
})();
