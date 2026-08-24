'use strict';

/* ATLAS AML · Radar Prensa evidencia visible 0525
 * Mejora aditiva sobre 0523/0524:
 * - Expone enlaces verificables de las publicaciones directamente en ficha y Entity 360.
 * - Hace explícitos los fenómenos detectados por Monitor de Prensa bajo la etiqueta "Asociado a".
 * - No modifica identidad, scoring, RLS ni persistencia.
 */
(function atlasEntityPress0525(){
  const VERSION='ENTITY-PRESS-0525.1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function uniq(values){
    const seen=new Set();
    return values.filter(v=>{const k=String(v||'').trim().toLocaleLowerCase('es-CL');if(!k||seen.has(k))return false;seen.add(k);return true;});
  }

  function articleEvidence(root){
    return [...root.querySelectorAll('.aep-article')].map(card=>{
      const link=card.querySelector('a[href]');
      const title=card.querySelector('h4')?.textContent?.trim()||'Publicación';
      const media=card.querySelector('.aep-article-top b')?.textContent?.trim()||'';
      const date=card.querySelector('.aep-article-top span')?.textContent?.trim()||'';
      const phenomena=[...card.querySelectorAll('.aep-tags span')].map(x=>x.textContent.trim()).filter(Boolean);
      return {title,media,date,url:link?.href||'',phenomena,card};
    }).filter(x=>x.url);
  }

  function decorateArticle(card){
    if(card.dataset.aep0525==='1')return;
    card.dataset.aep0525='1';
    const tags=card.querySelector('.aep-tags');
    if(tags&&tags.children.length&&!tags.querySelector('.aep-associated-label')){
      tags.insertAdjacentHTML('afterbegin','<b class="aep-associated-label">Asociado a</b>');
    }
    const link=card.querySelector('a[href]');
    if(link){
      link.classList.add('aep-source-link');
      link.textContent='Ver fuente original ↗';
      link.setAttribute('title','Abrir la publicación original para corroborar la mención');
    }
  }

  function buildSummary(root,items){
    if(root.querySelector(':scope > .aep-evidence-summary'))return;
    if(!items.length)return;
    const phenomena=uniq(items.flatMap(x=>x.phenomena)).slice(0,8);
    const links=items.slice(0,3).map((x,i)=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" title="Abrir fuente original"><span>${i===0?'Última mención':'Mención'}</span><b>${esc(x.title)}</b><small>${esc([x.date,x.media].filter(Boolean).join(' · '))}</small><em>Abrir ↗</em></a>`).join('');
    const phenomenaHtml=phenomena.length?`<div class="aep-associated"><strong>Asociado a</strong><div>${phenomena.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:'';
    const html=`<section class="aep-evidence-summary"><div class="aep-evidence-title"><span>TRAZABILIDAD DE PRENSA</span><b>Fuente y contexto verificable</b></div>${phenomenaHtml}<div class="aep-evidence-links">${links}</div></section>`;
    const warning=root.querySelector(':scope > .aep-warning');
    const kpis=root.querySelector(':scope > .aep-kpis');
    const anchor=warning||kpis||root.querySelector(':scope > header,:scope > .aep-dossier-head');
    if(anchor)anchor.insertAdjacentHTML('afterend',html); else root.insertAdjacentHTML('afterbegin',html);
  }

  function enhance(root){
    if(!root||root.dataset.aepEvidence0525==='1')return;
    const items=articleEvidence(root);
    root.querySelectorAll('.aep-article').forEach(decorateArticle);
    if(!items.length)return;
    buildSummary(root,items);
    root.dataset.aepEvidence0525='1';
  }

  function scan(){
    document.querySelectorAll('.aep-profile,.aep-dossier').forEach(enhance);
  }

  const observer=new MutationObserver(()=>scan());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  scan();

  window.__ATLAS_ENTITY_PRESS_0525__={active:true,version:VERSION,features:['PRESS_SOURCE_LINKS_IN_PROFILE_AND_360','EXPLICIT_ASSOCIATED_PHENOMENA'],scoreMutation:false,identityMutation:false,installedAt:new Date().toISOString()};
})();
