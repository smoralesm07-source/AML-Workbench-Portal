'use strict';
/* ATLAS AML · Territory UI cleanup
 * Removes deprecated explanatory copy and the complementary-signals card
 * from the Territory view without altering IRG calculations or source data.
 */
(function atlasTerritoryCopyCleanup(){
  const TARGETS=[
    'La Amenaza ahora se explica desde el score CEAD v1 y separa delito base directo, economía criminal/facilitadores y contexto criminógeno. La ficha muestra qué señales dominan, cuáles crecen, cuáles se reiteran y cuánto aportan realmente al indicador.',
    'El resultado surge únicamente de las cuatro dimensiones del IRG. Las señales complementarias se muestran después y tienen aporte directo 0 al índice.',
    'Una sola lógica de cálculo, cuatro dimensiones y evidencia auditable. Se abandona el esquema IPT/Score B como indicador principal del módulo.'
  ];
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
  function clean(root=document){
    root.querySelectorAll?.('.v032-secondary').forEach(el=>el.remove());
    root.querySelectorAll?.('p').forEach(p=>{
      const text=norm(p.textContent);
      if(TARGETS.some(t=>text===norm(t)))p.remove();
    });
  }
  clean();
  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const n of m.addedNodes){
        if(n.nodeType===1)clean(n);
      }
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
