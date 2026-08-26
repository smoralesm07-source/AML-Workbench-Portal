'use strict';
/* ATLAS AML · Universo SO alert drilldown 0.80.2
 * Progressive enhancement only. No MutationObserver and no navigation rewrite.
 * 0.80.3 bootstrap: loads management/evidence enhancement without touching the global router.
 */
(function atlasUniversoSOWideAlerts0802(){
  if(window.AtlasUniversoSOWideAlerts0802)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const levelLabel=el=>el.classList.contains('high')?'Prioritaria':el.classList.contains('med')?'Atención':'Contexto';
  const levelMeaning=el=>el.classList.contains('high')?'Señal que justifica revisión prioritaria por la condición factual descrita.':el.classList.contains('med')?'Señal de atención que requiere lectura contextual y contraste con fuentes.':'Antecedente contextual útil para caracterizar a la entidad; no implica irregularidad.';
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
    wrap.innerHTML=`<aside class="uso80-alert-sheet" role="dialog" aria-modal="true" aria-label="Detalle de alerta inter-radar"><header><div><span>FICHA DE ALERTA · LECTURA INTER-RADAR</span><h2>${esc(title)}</h2></div><button type="button" class="uso80-alert-close" aria-label="Cerrar">×</button></header><div class="uso80-alert-meta"><div><span>Nivel Atlas</span><b>${esc(level)}</b></div><div><span>Fuente</span><b>${esc(source)}</b></div></div><section class="uso80-alert-block"><span>Qué observó Atlas</span><p>${esc(body)}</p></section><section class="uso80-alert-block"><span>Cómo debe leerse</span><p>${esc(levelMeaning(article))}</p></section><section class="uso80-alert-block uso80-alert-rule"><span>Regla metodológica</span><p>Esta ficha conserva la semántica de la evidencia disponible. Prioridad de revisión o fiscalización no equivale a sospecha de LA/FT, culpabilidad ni incumplimiento acreditado. Cuando la identidad proviene de coincidencia nominal, debe validarse antes de atribuir el antecedente a la entidad.</p></section></aside>`;
    document.body.appendChild(wrap);
    wrap.querySelector('.uso80-alert-close')?.addEventListener('click',close);
    wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
  }
  document.addEventListener('click',e=>{const a=e.target.closest?.('.uso80-findings article');if(!a)return;open(a);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  window.AtlasUniversoSOWideAlerts0802={active:true,version:'0.80.2',open,close};

  function load0803(){
    if(!document.querySelector('link[data-uso803]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./assets/atlas-universo-so-management-0803.css?v=0803-1';l.dataset.uso803='1';document.head.appendChild(l);}
    if(!window.AtlasUniversoSOManagement0803&&!document.querySelector('script[data-uso803]')){const s=document.createElement('script');s.src='./assets/atlas-universo-so-management-0803.js?v=0803-1';s.dataset.uso803='1';document.body.appendChild(s);}
  }
  load0803();
})();