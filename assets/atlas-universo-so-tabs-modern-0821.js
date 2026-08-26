'use strict';
/* ATLAS AML · Universo SO tabs estables 0.82.7
 * Sin observers, polling ni timers. Decora una vez al terminar cada apertura
 * canónica de Universo SO y conserva Gestión candidatos siempre disponible.
 */
(function atlasUniversoSOTabsStable0827(){
  if(window.AtlasUniversoSOTabsStable0827)return;
  const icons=[
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M15.8 10.5a2.5 2.5 0 1 0 0-5"/><path d="M3.5 19c.4-3.4 2.1-5.2 5-5.2s4.6 1.8 5 5.2"/><path d="M14.5 14.2c2.8.2 4.4 1.8 4.8 4.8"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3"/><path d="M4.5 19c.4-3.5 2.2-5.4 5.5-5.4 2 0 3.5.7 4.4 2"/><path d="M16.2 15.2h4.3v4.3h-4.3z"/><path d="m17.2 17.3.8.8 1.6-1.7"/></svg>'
  ];
  const cfg=[
    ['SO inscritos','nómina UAF','10.294'],
    ['Potenciales SO','universo completo','74.087'],
    ['Gestión candidatos','contacto OSINT · seguimiento','—']
  ];
  function decorate(){
    const tabs=document.querySelector('.uso81-tabs');if(!tabs)return false;
    let buttons=[...tabs.children].filter(x=>x.tagName==='BUTTON');
    if(!buttons.find(b=>b.dataset.uso830Candidates==='1')){
      const b=document.createElement('button');b.type='button';b.dataset.uso830Candidates='1';b.className='uso820-management-tab';tabs.appendChild(b);buttons=[...tabs.children].filter(x=>x.tagName==='BUTTON');
    }
    buttons.slice(0,3).forEach((b,i)=>{
      const [title,sub,badge]=cfg[i];
      if(i===2){b.dataset.uso830Candidates='1';b.classList.add('uso820-management-tab')}
      b.innerHTML=`<span class="uso-tab-icon">${icons[i]}</span><span class="uso-tab-copy"><b>${title}</b><small>${sub}</small></span><span class="uso-tab-badge${i===2?' muted':''}">${badge}</span>`;
    });
    return true;
  }
  function patch(){
    const api=window.AtlasUniversoSO0816;if(!api||api.__tabs0827||typeof api.open!=='function')return false;
    const original=api.open.bind(api);
    api.open=async function(){const out=await original(...arguments);decorate();return out};
    api.__tabs0827=true;decorate();return true;
  }
  window.addEventListener('atlas:universo-so-0816-ready',patch,{once:true});
  patch();
  const api={version:'0.82.7',mode:'POST_RENDER_SINGLE_PASS',decorate,patch};
  window.AtlasUniversoSOTabsStable0827=api;window.AtlasUniversoSOTabsStable0826=api;window.AtlasUniversoSOTabsModern0823=api;
})();
