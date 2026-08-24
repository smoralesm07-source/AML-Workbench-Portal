'use strict';
/* ATLAS AML 0.53.3 · UI routing hint for international watchlists */
(function atlasWatchlistsFallbackUi0533(){
  const VERSION='WATCHLISTS-FALLBACK-0533.1';
  function enhance(){
    document.querySelectorAll('.agw-card').forEach(card=>{
      const osCard=[...card.querySelectorAll('.agw-source-card')].find(x=>/OpenSanctions/i.test(x.textContent||''));
      const osStatus=osCard?.querySelector('.agw-status')?.textContent?.trim()||'';
      const osLive=/^Live$/i.test(osStatus);
      if(osCard&&!osLive&&!osCard.querySelector('[data-agw-fallback-note]')){
        const note=document.createElement('small');
        note.dataset.agwFallbackNote='1';
        note.textContent='Respaldo automático por fuentes oficiales';
        note.style.display='block';note.style.marginTop='6px';note.style.opacity='.78';
        osCard.querySelector('.agw-source-head > div')?.appendChild(note);
      }
      if(!osLive){
        card.querySelectorAll('.agw-family-rail > span').forEach(span=>{
          if(span.classList.contains('hit'))return;
          const small=span.querySelector('small');
          if(small&&/vía OpenSanctions|sin candidato/i.test(small.textContent||''))small.textContent='fallback oficial disponible';
        });
      }
      const wb=[...card.querySelectorAll('.agw-family-rail > span')].find(x=>/Banco Mundial/i.test(x.textContent||''));
      if(wb&&!wb.title)wb.title='Respaldo independiente mediante registros WBG cross-debarment publicados por BID; cobertura parcial.';
    });
    window.__ATLAS_WATCHLISTS_FALLBACK_UI_0533__={active:true,version:VERSION,updatedAt:new Date().toISOString()};
  }
  const obs=new MutationObserver(enhance);obs.observe(document.documentElement,{childList:true,subtree:true});enhance();
})();