'use strict';
/* ATLAS AML · Universo SO alert drilldown 0.80.2
 * Progressive enhancement only. No MutationObserver and no navigation rewrite.
 */
(function atlasUniversoSOWideAlerts0802(){
  if(window.AtlasUniversoSOWideAlerts0802)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const levelLabel=el=>el.classList.contains('high')?'Prioritaria':el.classList.contains('med')?'Atención':'Contexto';
  const levelMeaning=el=>el.classList.contains('high')
    ?'Señal que justifica revisión prioritaria por la condición factual descrita.'
    :el.classList.contains('med')
      ?'Señal de atención que requiere lectura contextual y contraste con fuentes.'
      :'Antecedente contextual útil para caracterizar a la entidad; no implica irregularidad.';
  function close(){document.querySelector('.uso80-alert-backdrop')?.remove();}
  function open(article){
    if(!article)return;
    const title=article.querySelector('b')?.textContent?.trim()||'Alerta inter-radar';
    const source=article.querySelector('span')?.textContent?.trim()||'Fuente no materializada';
    const body=article.querySelector('p')?.textContent?.trim()||'Sin detalle materializado.';
    const level=levelLabel(article);
    close();
    const wrap=document.createElement('div');
    wrap.className='uso80-alert-backdrop';
    wrap.innerHTML=`<aside class="uso80-alert-sheet" role="dialog" aria-modal="true" aria-label="Detalle de alerta inter-radar">
      <header><div><span>FICHA DE ALERTA · LECTURA INTER-RADAR</span><h2>${esc(title)}</h2></div><button type="button" class="uso80-alert-close" aria-label="Cerrar">×</button></header>
      <div class="uso80-alert-meta"><div><span>Nivel Atlas</span><b>${esc(level)}</b></div><div><span>Fuente</span><b>${esc(source)}</b></div></div>
      <section class="uso80-alert-block"><span>Qué observó Atlas</span><p>${esc(body)}</p></section>
      <section class="uso80-alert-block"><span>Cómo debe leerse</span><p>${esc(levelMeaning(article))}</p></section>
      <section class="uso80-alert-block uso80-alert-rule"><span>Regla metodológica</span><p>Esta ficha conserva la semántica de la evidencia disponible. Prioridad de revisión o fiscalización no equivale a sospecha de LA/FT, culpabilidad ni incumplimiento acreditado. Cuando la identidad proviene de coincidencia nominal, debe validarse antes de atribuir el antecedente a la entidad.</p></section>
    </aside>`;
    document.body.appendChild(wrap);
    wrap.querySelector('.uso80-alert-close')?.addEventListener('click',close);
    wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
    wrap.querySelector('.uso80-alert-close')?.focus();
  }
  document.addEventListener('click',e=>{
    const article=e.target.closest?.('.uso80-findings article');
    if(article){e.preventDefault();open(article);return;}
  },false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.addEventListener('keydown',e=>{
    const article=e.target.closest?.('.uso80-findings article');
    if(article&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(article);}
  });
  document.addEventListener('focusin',e=>{
    const article=e.target.closest?.('.uso80-findings article');
    if(article&&!article.hasAttribute('tabindex')){article.setAttribute('tabindex','0');article.setAttribute('role','button');article.setAttribute('aria-label','Abrir ficha de alerta inter-radar');}
  });
  window.AtlasUniversoSOWideAlerts0802={active:true,version:'0.80.2',openAlert:open,closeAlert:close,policy:'FULL_WIDTH_PROGRESSIVE_ALERT_DRILLDOWN_NO_OBSERVER_NO_NAVIGATION_MUTATION'};
})();
