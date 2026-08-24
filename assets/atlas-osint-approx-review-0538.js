'use strict';
/* ATLAS AML 0.53.8 · OSINT approximate-result review gate hardening */
(function atlasOsintApproxReview0538(){
  const RELEASE='0.53.8';
  function prepare(root=document){
    root.querySelectorAll?.('[data-agw-approx-results]').forEach(box=>{
      if(box.dataset.agw0538==='1')return;
      box.dataset.agw0538='1';
      box.hidden=true;
      box.style.removeProperty('display');
    });
    root.querySelectorAll?.('[data-agw-show-approx]').forEach(btn=>{
      if(btn.dataset.agw0538==='1')return;
      btn.dataset.agw0538='1';
      btn.classList.remove('aex-osint-btn');
      btn.classList.add('agw-approx-toggle');
      const parent=btn.parentElement;
      if(parent&&!parent.classList.contains('agw-approx-action')){
        parent.classList.add('agw-approx-action');
        const note=[...parent.children].find(n=>n!==btn);
        if(note){
          const wrap=document.createElement('span');
          wrap.className='agw-approx-action-copy';
          wrap.innerHTML='<b>Coincidencias aproximadas disponibles</b><span>Se mantienen ocultas hasta que decidas revisarlas.</span>';
          note.replaceWith(wrap);
          parent.insertBefore(wrap,btn);
        }
      }
    });
  }
  document.addEventListener('click',event=>{
    const btn=event.target?.closest?.('[data-agw-show-approx]');
    if(!btn)return;
    const host=btn.closest('.agw-card')||document;
    const box=host.querySelector('[data-agw-approx-results]');
    if(!box)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const opening=box.hidden;
    box.hidden=!opening;
    box.style.removeProperty('display');
    btn.setAttribute('aria-expanded',String(opening));
    const count=(btn.textContent.match(/\d+/)||[''])[0];
    btn.textContent=opening?'Ocultar coincidencias aproximadas':`Ver${count?' '+count:''} coincidencias OSINT aproximadas`;
    window.__ATLAS_OSINT_APPROX_REVIEW_0538__={active:true,release:RELEASE,expanded:opening,updatedAt:new Date().toISOString()};
  },true);
  const obs=new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes)if(n.nodeType===1)prepare(n);});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  prepare();
  window.__ATLAS_OSINT_APPROX_REVIEW_0538__={active:true,release:RELEASE,defaultCollapsed:true,explicitReviewRequired:true,installedAt:new Date().toISOString()};
})();