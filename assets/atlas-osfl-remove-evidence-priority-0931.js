'use strict';
/* ATLAS OSFL 0.93.1 · presentation cleanup
 * Removes requested legacy OSFL presentation blocks without changing governed
 * data, scoring, queries or adjacent analytical modules.
 */
(function atlasOsflRemoveEvidencePriority0931(){
  if(window.AtlasOsflRemoveEvidencePriority0931)return;
  const VERSION='0931.3';
  const TITLE='priorizar con evidencia';
  const ASSOCIATED_COPY=[
    'universo nacional de organizaciones sin fines de lucro',
    'lectura analitica, no conclusion',
    'datos autorizados por rls'
  ];
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const isBox=node=>node&&(node.tagName==='ARTICLE'||node.tagName==='SECTION'||node.tagName==='DIV');
  const copyMatch=node=>{
    const text=norm(node?.textContent);
    return ASSOCIATED_COPY.some(copy=>text.includes(copy));
  };

  function ensureNoFlashStyle(){
    if(document.querySelector('style[data-atlas-osfl-presentation-cleanup="0931"]'))return;
    const style=document.createElement('style');
    style.dataset.atlasOsflPresentationCleanup='0931';
    style.textContent='.v030-osfl .v030-hero,.v030-osfl .atlas-osfl-hero{display:none!important}';
    document.head.appendChild(style);
  }

  function findCard(root,label){
    const ancestors=[];
    let node=label.parentElement;
    while(node&&node!==root){
      if(isBox(node)&&norm(node.textContent).includes(TITLE))ancestors.push(node);
      node=node.parentElement;
    }
    if(!ancestors.length)return null;

    const explicit=ancestors.find(el=>el.tagName==='ARTICLE'||/(^|[-_\s])(card|panel|module|box)([-_\s]|$)/i.test(el.className||''));
    if(explicit)return explicit;

    const complete=ancestors.find(el=>{
      const text=norm(el.textContent);
      return text.includes('completad')&&/\b\d+\s+de\s+\d+\b/.test(text);
    });
    return complete||ancestors[0];
  }

  function removeCard(){
    const root=document.querySelector('.v030-osfl');
    if(!root)return false;
    const labels=[...root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,span,p')];
    const label=labels.find(el=>norm(el.textContent).includes(TITLE));
    if(!label)return false;
    const card=findCard(root,label);
    if(!card)return false;
    const parent=card.parentElement;
    card.remove();
    if(parent&&parent!==root&&parent.children.length===0&&!norm(parent.textContent))parent.remove();
    root.dataset.atlasEvidencePriorityCard='removed';
    return true;
  }

  function removeOverviewHero(){
    const root=document.querySelector('.v030-osfl');
    if(!root)return false;
    let changed=false;
    root.querySelectorAll('.v030-hero,.atlas-osfl-hero').forEach(hero=>{
      hero.remove();
      changed=true;
    });
    if(changed)root.dataset.atlasOverviewHero='removed';
    return changed;
  }

  function removeAssociatedCopy(){
    const root=document.querySelector('.v030-osfl');
    if(!root)return false;
    const scope=root.closest('#content,.v019-content,main')||document.querySelector('#content,.v019-content')||document.body;
    const candidates=[...scope.querySelectorAll('p,small,span,div')]
      .filter(copyMatch)
      .filter(el=>![...el.children].some(copyMatch));
    let changed=false;
    for(const el of candidates){
      if(!el.isConnected)continue;
      const parent=el.parentElement;
      el.remove();
      changed=true;
      let node=parent;
      for(let depth=0;depth<3&&node&&node!==scope&&node!==root;depth++){
        const next=node.parentElement;
        if(!norm(node.textContent)&&node.children.length===0)node.remove();
        else break;
        node=next;
      }
    }
    if(changed)root.dataset.atlasAssociatedCopy='removed';
    return changed;
  }

  function runCleanup(){
    ensureNoFlashStyle();
    removeCard();
    removeOverviewHero();
    removeAssociatedCopy();
  }

  function cleanup(){
    runCleanup();
    requestAnimationFrame(runCleanup);
    setTimeout(runCleanup,80);
    setTimeout(runCleanup,300);
  }

  ensureNoFlashStyle();
  if(typeof v030LoadOsfl==='function'){
    const baseLoad=v030LoadOsfl;
    v030LoadOsfl=async function(){
      const out=await baseLoad.apply(this,arguments);
      cleanup();
      return out;
    };
  }
  if(typeof v030SyncMapAndCharts==='function'){
    const baseSync=v030SyncMapAndCharts;
    v030SyncMapAndCharts=async function(){
      const out=await baseSync.apply(this,arguments);
      cleanup();
      return out;
    };
  }
  window.addEventListener('atlas:nav-refresh',cleanup);
  window.addEventListener('pageshow',cleanup);
  cleanup();
  window.AtlasOsflRemoveEvidencePriority0931={version:VERSION,cleanup,removeCard,removeOverviewHero,removeAssociatedCopy};
})();
