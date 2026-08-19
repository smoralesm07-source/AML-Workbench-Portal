'use strict';

/* ATLAS AML · access-screen AIE identity layer */
(function(){
  const LOGO='./assets/aie-logo-auth.png';

  function applyAuthBrand(){
    const card=document.querySelector('.auth-card');
    if(!card)return;

    const mark=card.querySelector('.brand-mark');
    if(mark){
      mark.textContent='ATLAS';
      mark.classList.add('atlas-auth-topmark');
    }

    const title=card.querySelector('h1');
    const isLogin=!!card.querySelector('#login') || /AML Analytical Workbench/i.test(title?.textContent||'');
    if(!isLogin)return;

    if(!card.querySelector('.atlas-auth-identity')){
      const identity=document.createElement('div');
      identity.className='atlas-auth-identity';
      identity.innerHTML=`<img class="atlas-auth-aie-logo" src="${LOGO}" alt="AIE"><div class="atlas-auth-system-name">ATLAS AML</div>`;
      title?.replaceWith(identity);
    }

    const eyebrow=card.querySelector('.eyebrow');
    if(eyebrow)eyebrow.textContent='Acceso controlado';
  }

  const root=document.querySelector('#app');
  if(root){
    const observer=new MutationObserver(()=>queueMicrotask(applyAuthBrand));
    observer.observe(root,{childList:true,subtree:true});
  }
  applyAuthBrand();
  for(const ms of [0,80,180,400,900,1800])setTimeout(applyAuthBrand,ms);
})();
