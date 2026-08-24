'use strict';

/* ATLAS AML · Radar Prensa trazabilidad visible 0526
 * Refuerzo de presentación sobre 0523/0524/0525.
 * Garantiza que ficha PRESS_ONLY y Entity 360 muestren:
 * - enlace verificable a la fuente original;
 * - fenómenos detectados por Monitor de Prensa bajo "Asociado a".
 * No modifica identidad, scoring, RLS ni persistencia.
 */
(function atlasEntityPress0526(){
  const VERSION='ENTITY-PRESS-0526.1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uniq=values=>{const s=new Set();return (values||[]).filter(v=>{const k=String(v||'').trim().toLocaleLowerCase('es-CL');if(!k||s.has(k))return false;s.add(k);return true;});};

  function decorateCard(card){
    const link=card.querySelector('a[href]');
    if(link){
      link.classList.add('aep-source-link','aep-source-link-0526');
      link.textContent='Ver fuente original ↗';
      link.setAttribute('title','Abrir publicación original para corroborar la mención de la entidad');
      link.setAttribute('target','_blank');
      link.setAttribute('rel','noopener noreferrer');
    }
    const tags=card.querySelector('.aep-tags');
    if(tags && tags.querySelector('span') && !tags.querySelector('.aep-associated-label')){
      tags.insertAdjacentHTML('afterbegin','<b class="aep-associated-label">Asociado a</b>');
    }
  }

  function collect(root){
    return [...root.querySelectorAll('.aep-article')].map(card=>{
      decorateCard(card);
      const link=card.querySelector('a[href]');
      return {
        title:card.querySelector('h4')?.textContent?.trim()||'Publicación',
        media:card.querySelector('.aep-article-top b')?.textContent?.trim()||'',
        date:card.querySelector('.aep-article-top span')?.textContent?.trim()||'',
        url:link?.href||'',
        phenomena:[...card.querySelectorAll('.aep-tags span')].map(x=>x.textContent.trim()).filter(Boolean)
      };
    }).filter(x=>x.url);
  }

  function summaryMarkup(items){
    const phenomena=uniq(items.flatMap(x=>x.phenomena)).slice(0,10);
    const sources=items.slice(0,5);
    return `<section class="aep-evidence-summary aep-evidence-summary-0526">
      <div class="aep-evidence-title"><span>TRAZABILIDAD DE PRENSA</span><b>Fuente y contexto verificable</b></div>
      ${phenomena.length?`<div class="aep-associated"><strong>Asociado a</strong><div>${phenomena.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}
      <div class="aep-evidence-links">${sources.map((x,i)=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><span>${i===0?'Última mención':'Mención'}</span><b>${esc(x.title)}</b><small>${esc([x.date,x.media].filter(Boolean).join(' · '))}</small><em>Ver fuente ↗</em></a>`).join('')}</div>
    </section>`;
  }

  function enhance(root){
    if(!root)return;
    const items=collect(root);
    if(!items.length)return;
    let summary=root.querySelector(':scope > .aep-evidence-summary');
    if(summary && !summary.classList.contains('aep-evidence-summary-0526')) summary.remove();
    summary=root.querySelector(':scope > .aep-evidence-summary-0526');
    if(!summary){
      const anchor=root.querySelector(':scope > .aep-warning') || root.querySelector(':scope > .aep-kpis') || root.querySelector(':scope > .aep-dossier-head') || root.querySelector(':scope > header');
      if(anchor) anchor.insertAdjacentHTML('afterend',summaryMarkup(items));
      else root.insertAdjacentHTML('afterbegin',summaryMarkup(items));
    }
    root.dataset.aepEvidence0526='1';
  }

  function scan(){
    document.querySelectorAll('.aep-profile,.aep-dossier').forEach(enhance);
  }

  const observer=new MutationObserver(scan);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(scan,250),true);
  document.addEventListener('input',()=>setTimeout(scan,500),true);
  let tries=0;
  const poll=setInterval(()=>{scan();tries+=1;if(tries>=30)clearInterval(poll);},1000);
  scan();

  window.__ATLAS_ENTITY_PRESS_0526__={active:true,version:VERSION,features:['VISIBLE_PRESS_SOURCE_LINK','VISIBLE_ASSOCIATED_PHENOMENA','ROBUST_RETRY'],scoreMutation:false,identityMutation:false,installedAt:new Date().toISOString()};
})();
