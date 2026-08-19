'use strict';

/* ATLAS AML · access-screen AIE identity layer
 * Hotfix: branding is idempotent and only watches top-level #app replacements.
 * This avoids the MutationObserver feedback loop that could freeze the login page.
 */
(function(){
  const LOGO='./assets/aie-logo-auth.png';
  let queued=false;

  function applyAuthBrand(){
    const card=document.querySelector('.auth-card');
    if(!card)return;

    const mark=card.querySelector('.brand-mark');
    if(mark){
      if((mark.textContent||'').trim()!=='ATLAS')mark.textContent='ATLAS';
      if(!mark.classList.contains('atlas-auth-topmark'))mark.classList.add('atlas-auth-topmark');
    }

    const title=card.querySelector('h1');
    const isLogin=!!card.querySelector('#login') || /AML Analytical Workbench/i.test(title?.textContent||'');
    if(!isLogin)return;

    if(!card.querySelector('.atlas-auth-identity')){
      const identity=document.createElement('div');
      identity.className='atlas-auth-identity';
      identity.innerHTML=`<img class="atlas-auth-aie-logo" src="${LOGO}" alt="AIE"><div class="atlas-auth-system-name">ATLAS AML</div>`;
      if(title)title.replaceWith(identity);
      else{
        const eyebrow=card.querySelector('.eyebrow');
        eyebrow?.insertAdjacentElement('afterend',identity);
      }
    }

    const eyebrow=card.querySelector('.eyebrow');
    if(eyebrow && eyebrow.textContent!=='Acceso controlado')eyebrow.textContent='Acceso controlado';
  }

  function queueApply(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;applyAuthBrand();});
  }

  const root=document.querySelector('#app');
  if(root){
    const observer=new MutationObserver(records=>{
      if(records.some(r=>r.type==='childList' && (r.addedNodes.length||r.removedNodes.length)))queueApply();
    });
    /* app.js replaces #app contents when auth state changes. Watching only the
       root's direct children prevents branding edits inside the card from
       recursively retriggering the observer. */
    observer.observe(root,{childList:true,subtree:false});
  }

  applyAuthBrand();
  for(const ms of [0,80,180,400,900,1800,3500])setTimeout(applyAuthBrand,ms);
})();
