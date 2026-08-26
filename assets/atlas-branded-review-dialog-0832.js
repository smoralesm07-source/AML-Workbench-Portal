'use strict';
/* ATLAS · diálogo propio para gestión de candidatos.
 * Sustituye el prompt nativo del navegador —que muestra el dominio de GitHub Pages—
 * por un modal de producto con encabezado "ATLAS dice:".
 */
(function atlasBrandedReviewDialog0832(){
  if(window.__ATLAS_BRANDED_REVIEW_DIALOG_0832__)return;
  window.__ATLAS_BRANDED_REVIEW_DIALOG_0832__=true;

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const api=()=>window.AtlasUniversoSO0816||window.AtlasUniversoSO0814||window.AtlasUniversoSO0813||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const x=Number(v);return v===null||v===undefined||v===''||!Number.isFinite(x)?null:x};

  function closeDialog(result){
    const root=document.querySelector('.atlas-dialog-scrim');
    if(!root)return;
    const resolve=root.__resolve;
    root.remove();
    if(resolve)resolve(result);
  }

  function promptAtlas(label,initial=''){
    return new Promise(resolve=>{
      const old=document.querySelector('.atlas-dialog-scrim');if(old)old.remove();
      const root=document.createElement('div');
      root.className='atlas-dialog-scrim';
      root.innerHTML=`<section class="atlas-dialog" role="dialog" aria-modal="true" aria-labelledby="atlas-dialog-title"><header><b id="atlas-dialog-title">ATLAS dice:</b></header><main><label for="atlas-dialog-input">${esc(label)}</label><input id="atlas-dialog-input" type="text" maxlength="500" value="${esc(initial)}"></main><footer><button type="button" data-atlas-cancel>Cancelar</button><button type="button" class="primary" data-atlas-ok>Aceptar</button></footer></section>`;
      root.__resolve=resolve;
      document.body.appendChild(root);
      const input=root.querySelector('#atlas-dialog-input');
      const ok=()=>closeDialog(input?.value??'');
      root.querySelector('[data-atlas-ok]')?.addEventListener('click',ok);
      root.querySelector('[data-atlas-cancel]')?.addEventListener('click',()=>closeDialog(null));
      root.addEventListener('click',e=>{if(e.target===root)closeDialog(null)});
      root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeDialog(null)}else if(e.key==='Enter'){e.preventDefault();ok()}});
      requestAnimationFrame(()=>{input?.focus();input?.select()});
    });
  }

  async function manage(state){
    const a=api(), snap=a?.state?.(), row=snap?.sheet, c=db();
    if(!a||!row||!c)return;
    const label=state==='CANDIDATO_SELECCIONADO'?'Fundamento para seleccionar candidato':state==='NO_CANDIDATO'?'Fundamento para marcar no candidato':'Nota de revisión';
    const rationale=await promptAtlas(label,'');
    if(rationale===null)return;
    const reason=state==='NO_CANDIDATO'?'OTRO':null;
    const user=await c.auth.getUser(),uid=user?.data?.user?.id;
    if(!uid)return;
    const tables=a.tables||{};
    const {error}=await c.from(tables.reviews||'aml_uaf_potential_review').insert({
      rut:row.rut,entity_id:row.entity_id||null,user_id:uid,review_state:state,reason_code:reason,
      rationale:String(rationale||'').trim()||null,ivo_at_decision:num(row.ivo_score),materiality_at_decision:num(row.materiality_score),
      sector_at_decision:row.sector||null,evidence_class_at_decision:row.evidence_class||null,
      index_version:'UNIVERSO_SO_ENTITY_EXPLORER_0816',release:document.documentElement.getAttribute('data-atlas-release')||'0.70.5'
    });
    if(error){await promptAtlas(`No fue posible guardar la gestión: ${error.message}`,'');return;}
    document.querySelector('#u816-sheet')?.classList.remove('open');
    document.querySelector('#u816-scrim')?.classList.remove('open');
    await a.open('potenciales');
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-u816-review]');
    if(!b)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    void manage(b.dataset.u816Review);
  },true);
})();
