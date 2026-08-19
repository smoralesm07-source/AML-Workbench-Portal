'use strict';

/* ATLAS AML v0.39.0 · visible identity + navigation UX layer
 * Design System v0.40 adds the global dark/light preference without changing
 * technical AML identifiers or radar data contracts.
 */
const ATLAS_VERSION='0.39.0';
const ATLAS_BUILD='0390';
const ATLAS_NAME='ATLAS AML';
const ATLAS_TAGLINE='Plataforma Integrada de Inteligencia y Riesgo';
const ATLAS_NEWS_KEY='atlas-aml:nav-news:v1';
const ATLAS_THEME_KEY='atlas-aml:theme:v1';

const ATLAS_NAV_GROUPS=[
  {label:'Explorar',views:['overview','entities','territory']},
  {label:'Radares',views:['uaf','sanctions','public-spend','osfl']},
  {label:'Análisis',views:['questions']}
];

const ATLAS_NAV_META={
  overview:{label:'Radar integrado',icon:'grid'},
  entities:{label:'Entidades',icon:'entity'},
  territory:{label:'Territorio',icon:'map'},
  uaf:{label:'Supervisión UAF',icon:'shield'},
  sanctions:{label:'Sanciones',icon:'alert'},
  'public-spend':{label:'Gasto público',icon:'flow'},
  osfl:{label:'OSFL',icon:'network'},
  questions:{label:'Preguntas',icon:'question'}
};

function atlasEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* Visible-language contract: ATLAS uses “Entidad 360” and “ID de Entidad”.
 * Only product/UI phrases are normalized. Source evidence, names, legal text,
 * technical identifiers (entity_id), tables and persisted payloads stay literal.
 */
function atlasEntityTerminology(value){
  return String(value??'')
    .replace(/\bPUBLIC\s+ENTITY\b/g,'ENTIDAD PÚBLICA')
    .replace(/\bPublic\s+Entity\b/g,'Entidad pública')
    .replace(/\bpublic\s+entity\b/g,'entidad pública')
    .replace(/\bENTITY\s+ID\b/g,'ID DE ENTIDAD')
    .replace(/\bEntity\s+ID\b/g,'ID de Entidad')
    .replace(/\bentity\s+id\b/g,'ID de Entidad')
    .replace(/\bENTITY\s+360\b/g,'ENTIDAD 360')
    .replace(/\bEntity\s+360\b/g,'Entidad 360')
    .replace(/\bentity\s+360\b/g,'Entidad 360');
}

function atlasHasEntityUiTerm(value){
  return /\b(?:ENTITY|Entity|entity)\s+(?:360|ID)\b|\b(?:PUBLIC ENTITY|Public Entity|public entity)\b/.test(String(value||''));
}
function atlasLocalizeVisibleEntityTerms(root=document.body){
  if(!root)return;
  const skip=new Set(['SCRIPT','STYLE','TEMPLATE','CODE','PRE','KBD','SAMP','BLOCKQUOTE']);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      const parent=node.parentElement;
      if(!parent||skip.has(parent.tagName))return NodeFilter.FILTER_REJECT;
      return atlasHasEntityUiTerm(node.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }
  });
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const next=atlasEntityTerminology(node.nodeValue);
    if(next!==node.nodeValue)node.nodeValue=next;
  }
  for(const el of root.querySelectorAll?.('[aria-label],[title],[placeholder]')||[]){
    for(const attr of ['aria-label','title','placeholder']){
      if(!el.hasAttribute(attr))continue;
      const current=el.getAttribute(attr)||'';
      if(!atlasHasEntityUiTerm(current))continue;
      const next=atlasEntityTerminology(current);
      if(next!==current)el.setAttribute(attr,next);
    }
  }
}

let atlasTerminologyObserver=null;
let atlasTerminologyQueued=false;
function atlasQueueTerminology(){
  if(atlasTerminologyQueued)return;
  atlasTerminologyQueued=true;
  queueMicrotask(()=>{
    atlasTerminologyQueued=false;
    atlasLocalizeVisibleEntityTerms(document.body);
  });
}
function atlasStartTerminologyGuard(){
  if(!document.body)return;
  atlasLocalizeVisibleEntityTerms(document.body);
  if(atlasTerminologyObserver)return;
  atlasTerminologyObserver=new MutationObserver(atlasQueueTerminology);
  atlasTerminologyObserver.observe(document.body,{
    childList:true,
    subtree:true,
    characterData:true,
    attributes:true,
    attributeFilter:['aria-label','title','placeholder']
  });
}

function atlasIcon(name){
  const paths={
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    entity:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    shield:'<path d="M12 3 4.5 6v5.2c0 4.7 2.9 8.1 7.5 9.8 4.6-1.7 7.5-5.1 7.5-9.8V6L12 3Z"/><path d="m9 12 2 2 4-5"/>',
    alert:'<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5h.01"/>',
    flow:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.5 7.6l4.3 8M17.5 7.6l-4.3 8"/>',
    network:'<circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m11 6.8-5 9.4M13 6.8l5 9.4M7 18h10"/>',
    question:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9.5a2.5 2.5 0 1 1 3.3 2.4c-.8.3-1.1.8-1.1 1.6v.5M12 17.5h.01"/>'
  };
  return `<span class="atlas-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${paths[name]||paths.grid}</svg></span>`;
}

function atlasReadNews(){
  try{return JSON.parse(localStorage.getItem(ATLAS_NEWS_KEY)||'{}')||{};}catch{return {};}
}
function atlasWriteNews(value){
  try{localStorage.setItem(ATLAS_NEWS_KEY,JSON.stringify(value||{}));}catch{}
}
function atlasNormalizeNews(value){
  if(value==null||value===false||value===0||value==='')return null;
  if(typeof value==='number')return {count:Math.max(1,Math.round(value)),label:'Nuevo'};
  if(typeof value==='string')return {count:1,label:value.slice(0,12)};
  const count=Math.max(1,Math.round(Number(value.count)||1));
  const label=String(value.label||'Nuevo').slice(0,12);
  return {count,label,ts:value.ts||Date.now()};
}
function atlasSetNews(view,value){
  if(!ATLAS_NAV_META[view])return;
  const all=atlasReadNews(),next=atlasNormalizeNews(value);
  if(next)all[view]=next;else delete all[view];
  atlasWriteNews(all);atlasEnhanceNav();
}
function atlasClearNews(view){atlasSetNews(view,null);}

function atlasNewsBadge(view){
  const item=atlasReadNews()[view];
  if(!item)return '';
  const text=item.count>1&&String(item.label).toLowerCase()==='nuevo'?String(item.count):item.label;
  return `<span class="atlas-nav-news" title="Hay novedades sin revisar">${atlasEsc(text)}</span>`;
}

function atlasEnhanceNav(){
  const nav=document.querySelector('.v019-nav');
  if(!nav)return;
  const buttons=new Map([...nav.querySelectorAll('.v019-nav-btn[data-view]')].map(b=>[b.dataset.view,b]));
  nav.querySelectorAll('.v019-nav-label,.atlas-nav-section').forEach(x=>x.remove());

  for(const group of ATLAS_NAV_GROUPS){
    const present=group.views.filter(v=>buttons.has(v));
    if(!present.length)continue;
    const section=document.createElement('span');
    section.className='atlas-nav-section';section.textContent=group.label;nav.appendChild(section);
    for(const view of present){
      const b=buttons.get(view),m=ATLAS_NAV_META[view];
      b.classList.add('atlas-nav-btn');
      b.setAttribute('aria-label',m.label);
      b.innerHTML=`${atlasIcon(m.icon)}<span class="atlas-nav-text">${atlasEsc(m.label)}</span>${atlasNewsBadge(view)}<span class="atlas-nav-chevron" aria-hidden="true">›</span>`;
      nav.appendChild(b);
      if(!b.dataset.atlasSeenBound){
        b.addEventListener('click',()=>atlasClearNews(view));
        b.dataset.atlasSeenBound='1';
      }
    }
  }
  for(const [view,b] of buttons){
    if(ATLAS_NAV_META[view])continue;
    b.classList.add('atlas-nav-btn');nav.appendChild(b);
  }
}

let atlasObservedNav=null;
let atlasNavObserver=null;
let atlasNavRefreshQueued=false;
function atlasNavNeedsRefresh(nav){
  return [...nav.querySelectorAll('.v019-nav-btn[data-view]')].some(b=>{
    if(!ATLAS_NAV_META[b.dataset.view])return false;
    return !b.classList.contains('atlas-nav-btn')||!b.querySelector('.atlas-nav-icon')||!b.querySelector('.atlas-nav-text');
  });
}
function atlasBindNavObserver(){
  const nav=document.querySelector('.v019-nav');
  if(!nav||nav===atlasObservedNav)return;
  atlasNavObserver?.disconnect();
  atlasObservedNav=nav;
  atlasNavObserver=new MutationObserver(()=>{
    if(!atlasNavNeedsRefresh(nav)||atlasNavRefreshQueued)return;
    atlasNavRefreshQueued=true;
    queueMicrotask(()=>{
      atlasNavRefreshQueued=false;
      atlasEnhanceNav();
    });
  });
  atlasNavObserver.observe(nav,{childList:true});
}

function atlasReadTheme(){
  try{
    const saved=localStorage.getItem(ATLAS_THEME_KEY);
    if(saved==='dark'||saved==='light')return saved;
  }catch{}
  const current=document.documentElement.getAttribute('data-atlas-theme');
  return current==='light'?'light':'dark';
}
function atlasThemeSvg(theme){
  return theme==='dark'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.4A8.5 8.5 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z"/></svg>';
}
function atlasEnsureThemeToggle(){
  const host=document.querySelector('.v019-top')||document.querySelector('.topbar')||document.querySelector('.v18-appbar');
  if(!host)return;
  let button=host.querySelector('.atlas-theme-toggle');
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.className='atlas-theme-toggle';
    button.dataset.atlasThemeControl='1';
    const anchor=host.querySelector('.v019-user')||host.querySelector('#v019-logout')||host.querySelector('.status');
    if(anchor&&anchor.parentNode===host)host.insertBefore(button,anchor);else host.appendChild(button);
  }
  const theme=document.documentElement.getAttribute('data-atlas-theme')==='light'?'light':'dark';
  const target=theme==='dark'?'claro':'oscuro';
  button.innerHTML=`<span class="atlas-theme-icon">${atlasThemeSvg(theme)}</span><span class="atlas-theme-label">${theme==='dark'?'Claro':'Oscuro'}</span>`;
  button.title=`Cambiar a tema ${target}`;
  button.setAttribute('aria-label',`Cambiar a tema ${target}`);
  button.setAttribute('aria-pressed',String(theme==='light'));
  if(!button.dataset.atlasThemeBound){
    button.addEventListener('click',()=>atlasSetTheme(themeNow()==='dark'?'light':'dark'));
    button.dataset.atlasThemeBound='1';
  }
}
function themeNow(){return document.documentElement.getAttribute('data-atlas-theme')==='light'?'light':'dark';}
function atlasSetTheme(value,{persist=true,emit=true}={}){
  const next=value==='light'?'light':'dark';
  const prev=themeNow();
  document.documentElement.setAttribute('data-atlas-theme',next);
  document.documentElement.style.colorScheme=next;
  window.__ATLAS_THEME__=next;
  if(persist){try{localStorage.setItem(ATLAS_THEME_KEY,next);}catch{}}
  atlasEnsureThemeToggle();
  if(emit&&prev!==next)window.dispatchEvent(new CustomEvent('atlas:themechange',{detail:{theme:next,previous:prev}}));
  return next;
}

function atlasApplyBrand(){
  window.__AML_ACTIVE_VERSION__=ATLAS_VERSION;
  window.__AML_BUILD__=ATLAS_BUILD;
  window.__ATLAS_ACTIVE_VERSION__=ATLAS_VERSION;
  document.documentElement.setAttribute('data-aml-version',ATLAS_VERSION);
  document.documentElement.setAttribute('data-aml-build',ATLAS_BUILD);
  document.documentElement.setAttribute('data-product','atlas-aml');
  document.title=`${ATLAS_NAME} · v${ATLAS_VERSION}`;
  const meta=document.querySelector('meta[name="application-name"]');if(meta)meta.content=`${ATLAS_NAME} · ${ATLAS_TAGLINE}`;

  document.querySelectorAll('.v019-brand').forEach(brand=>{
    const mark=brand.querySelector('.mark');if(mark)mark.textContent='A';
    const strong=brand.querySelector('strong');if(strong)strong.textContent=ATLAS_NAME;
    const small=brand.querySelector('small');if(small){small.textContent=ATLAS_TAGLINE;small.dataset.activeVersion=ATLAS_VERSION;}
  });
  document.querySelectorAll('.brand-copy strong,.v18-brand strong').forEach(x=>x.textContent=ATLAS_NAME);
  document.querySelectorAll('.brand-copy span,.v18-brand span:not(.v18-secure-dot)').forEach(x=>{if(!x.closest('.v18-session'))x.textContent=ATLAS_TAGLINE;});
  document.querySelectorAll('.topbar .eyebrow,.v18-pagehead .eyebrow').forEach(x=>x.textContent=`${ATLAS_NAME} · v${ATLAS_VERSION}`);
  document.querySelectorAll('.auth-card .brand-mark').forEach(x=>x.textContent='ATLAS');
  document.querySelectorAll('.auth-card .eyebrow').forEach(x=>{if(/workbench/i.test(x.textContent||''))x.textContent=ATLAS_TAGLINE;});
  atlasSetTheme(atlasReadTheme(),{persist:false,emit:false});
  atlasEnhanceNav();
  atlasBindNavObserver();
  atlasEnsureThemeToggle();
  atlasQueueTerminology();
}

window.AtlasNavNews={set:atlasSetNews,clear:atlasClearNews,all:atlasReadNews,markSeen:atlasClearNews};
window.AtlasTheme={
  get:themeNow,
  set:(theme)=>atlasSetTheme(theme),
  toggle:()=>atlasSetTheme(themeNow()==='dark'?'light':'dark')
};
window.AtlasTerminology={
  language:'es',
  entity360:'Entidad 360',
  entityId:'ID de Entidad',
  translate:atlasEntityTerminology,
  apply:()=>atlasLocalizeVisibleEntityTerms(document.body)
};
window.addEventListener('atlas:nav-news',e=>{
  const d=e.detail||{};if(d.view)atlasSetNews(d.view,d);
});

if(typeof window.shell==='function'){
  const baseShell=window.shell;
  window.shell=function(...args){const r=baseShell(...args);queueMicrotask(atlasApplyBrand);return r;};
}
if(typeof window.navigate==='function'){
  const baseNavigate=window.navigate;
  window.navigate=async function(view,...args){const r=await baseNavigate(view,...args);atlasApplyBrand();return r;};
}

const atlasRoot=document.querySelector('#app');
if(atlasRoot){
  const atlasObserver=new MutationObserver(()=>queueMicrotask(atlasApplyBrand));
  atlasObserver.observe(atlasRoot,{childList:true});
}
atlasStartTerminologyGuard();
atlasApplyBrand();
for(const ms of [0,120,320,700,1300,2500,5000])setTimeout(atlasApplyBrand,ms);
