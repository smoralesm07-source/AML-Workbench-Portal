'use strict';
/* ATLAS AML · Gasto Público · Taxonomía visible v4
 * Unifica filtros, resumen de marcas, KPIs y paneles nativos con la taxonomía aprobada.
 * No elimina marcas del Radar Presupuesto Abierto; solo las excluye de la priorización visible de Atlas.
 */
(function atlasPublicSpendVisibleTaxonomyV4(){
  const TAXONOMY={
    PROVIDER_CONCENTRATION:{level:'ALTA',weight:1},
    NEW_TO_SERIES_HIGH_SPEND:{level:'ALTA',weight:1},
    HIGH_SALES_LOW_WORKFORCE:{level:'ALTA',weight:1},
    RECENT_START_HIGH_SALES:{level:'ALTA',weight:1},
    AMOUNT_OUTLIER:{level:'ALTA',weight:1},
    POTENTIAL_FRAGMENTATION:{level:'MEDIA',weight:.5},
    INICIO_RECIENTE_SII:{level:'CONTEXTUAL',weight:.1},
    NUEVO_EN_SERIE:{level:'CONTEXTUAL',weight:.1}
  };
  const ORDER=['PROVIDER_CONCENTRATION','NEW_TO_SERIES_HIGH_SPEND','HIGH_SALES_LOW_WORKFORCE','RECENT_START_HIGH_SALES','AMOUNT_OUTLIER','POTENTIAL_FRAGMENTATION','INICIO_RECIENTE_SII','NUEVO_EN_SERIE'];
  const rank=t=>ORDER.indexOf(t)<0?999:ORDER.indexOf(t);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=t=>typeof window.v037MarkLabel==='function'?window.v037MarkLabel(t):String(t||'').replaceAll('_',' ');

  function annotate(){
    const root=document.querySelector('.v037-spend');if(!root)return;
    root.dataset.atlasVisibleMarkTaxonomy='v4';
    root.querySelectorAll('#v037-mark-chips [data-mark]').forEach(btn=>{
      const t=btn.dataset.mark;if(!t)return;
      const meta=TAXONOMY[t];
      if(!meta){btn.hidden=true;return;}
      btn.hidden=false;
      btn.dataset.markLevel=meta.level;
      if(!btn.querySelector('.atlas-mark-level')){
        const tag=document.createElement('i');tag.className=`atlas-mark-level ${meta.level.toLowerCase()}`;tag.textContent=meta.level;btn.appendChild(tag);
      }
    });
    root.querySelectorAll('#v037-marks [data-mark]').forEach(btn=>{
      const t=btn.dataset.mark,meta=TAXONOMY[t];
      if(!meta){btn.remove();return;}
      btn.dataset.markLevel=meta.level;
      const span=btn.querySelector('span');
      if(span&&!span.querySelector('.atlas-mark-level-inline'))span.insertAdjacentHTML('beforeend',` <i class="atlas-mark-level-inline ${meta.level.toLowerCase()}">${esc(meta.level)}</i>`);
    });
    const note=document.getElementById('v037-marks-note');if(note)note.textContent='8 señales seleccionadas · 5 altas · 1 media · 2 contextuales';
    const state=document.getElementById('v037-mark-state');if(state&&!window.V037?.mark)state.innerHTML='<b>Taxonomía activa:</b> 5 Alta · 1 Media · 2 Contextual. Las contextuales no activan por sí solas un caso prioritario.';
  }

  function install(){
    if(typeof window.v037MarkSummary!=='function'||typeof window.v037RenderAll!=='function'){setTimeout(install,200);return;}
    if(!window.v037MarkSummary.__atlasVisibleTaxonomyV4){
      const baseSummary=window.v037MarkSummary;
      const filtered=function(ctx){
        return (baseSummary(ctx)||[]).filter(r=>TAXONOMY[r.type]).map(r=>({...r,atlas_level:TAXONOMY[r.type].level,atlas_weight:TAXONOMY[r.type].weight})).sort((a,b)=>rank(a.type)-rank(b.type));
      };
      filtered.__atlasVisibleTaxonomyV4=true;window.v037MarkSummary=filtered;
    }
    const current=window.v037RenderAll;
    if(!current.__atlasVisibleTaxonomyV4){
      const wrapped=function(...args){const out=current.apply(this,args);requestAnimationFrame(()=>requestAnimationFrame(annotate));return out;};
      wrapped.__atlasVisibleTaxonomyV4=true;window.v037RenderAll=wrapped;
    }
    if(document.querySelector('.v037-spend')){
      try{window.v037RenderAll();}catch(e){console.warn('ATLAS Gasto Público · rerender taxonomía v4',e);}
      requestAnimationFrame(()=>requestAnimationFrame(annotate));
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="public-spend"],#v037-year-buttons,#v037-region,#v037-reset'))setTimeout(annotate,80);});
  window.ATLAS_PUBLIC_SPEND_VISIBLE_MARK_TAXONOMY_V4={version:'4.0.0',taxonomy:TAXONOMY,visibleSignals:ORDER,contextualCanTrigger:false};
})();
