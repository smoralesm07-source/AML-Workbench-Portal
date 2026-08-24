'use strict';
/* ATLAS AML 0.53.5 · Digital Identity Intelligence dossier */
(function atlasDigitalIdentityIntelligence0535(){
  const VERSION='DIGITAL-IDENTITY-INTELLIGENCE-0535.1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state=()=>window.__ATLAS_DIGITAL_IDENTITY_0524__||{};
  const intel=s=>s?.derived?.maigret_full?.intelligence||s?.derived?.intelligence||null;
  const compact=v=>String(v??'').replace(/\s+/g,' ').trim();
  function strengthLabel(n){n=Number(n||0);return n>=75?'alta':n>=55?'media':'inicial';}
  function attributeRows(i){
    const rows=Array.isArray(i?.attributes)?i.attributes.slice(0,12):[];
    if(!rows.length)return '<div class="adi-empty">Maigret no extrajo atributos públicos estructurados en esta pasada.</div>';
    return `<div class="adi-attributes">${rows.map(x=>`<div class="adi-attribute ${x.corroborated?'corroborated':''}"><div><span>${esc(x.field||'Dato público')}</span><b>${esc(compact(x.value).slice(0,220))}</b><small>${Number(x.source_count||0)} perfil(es): ${esc((x.profiles||[]).slice(0,4).join(' · '))}</small></div><em title="Fuerza de evidencia técnica, no probabilidad de identidad">evidencia ${strengthLabel(x.evidence_strength)}</em></div>`).join('')}</div>`;
  }
  function linkRows(i){
    const rows=Array.isArray(i?.links)?i.links.slice(0,10):[];
    if(!rows.length)return '<div class="adi-empty">Sin enlaces externos útiles extraídos.</div>';
    return `<div class="adi-links">${rows.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><div><b>${esc(x.host||x.url)}</b><small>${Number(x.source_count||0)} perfil(es) · ${esc((x.profiles||[]).slice(0,3).join(' · '))}</small></div><span>Abrir ↗</span></a>`).join('')}</div>`;
  }
  function aliasRows(i){
    const rows=Array.isArray(i?.alias_candidates)?i.alias_candidates.slice(0,12):[];
    if(!rows.length)return '<div class="adi-empty">Sin nuevos aliases candidatos extraídos.</div>';
    return `<div class="adi-aliases">${rows.map(x=>`<button type="button" data-adi-alias="${esc(x.alias)}"><div><b>@${esc(x.alias)}</b><small>${Number(x.source_count||0)} perfil(es) origen${x.searched_recursively?' · ya explorado recursivamente':' · candidato para nueva búsqueda'}</small></div><span>${x.corroborated?'2+ fuentes':'Explorar'} →</span></button>`).join('')}</div>`;
  }
  function mount(){
    const s=state(),host=document.querySelector('[data-aex-digital-graph-host]');
    if(!host||s.depth!=='deep'||host.dataset.adiMounted==='1')return;
    const i=intel(s);
    if(!i)return;
    host.dataset.adiMounted='1';
    const m=i.summary||{};
    const section=document.createElement('section');
    section.className='adi-wrap';
    section.innerHTML=`<header><div><span>DOSSIER DIGITAL</span><h4>Qué información aporta la identidad digital</h4><p>Atlas prioriza atributos, enlaces y aliases extraídos desde perfiles públicos. La repetición en fuentes independientes refuerza la evidencia técnica, pero no confirma identidad.</p></div><div class="adi-kpis"><span><b>${Number(m.corroborated_attributes||0)}</b><small>atributos 2+ fuentes</small></span><span><b>${Number(m.link_pivots||0)}</b><small>enlaces pivote</small></span><span><b>${Number(m.alias_candidates||0)}</b><small>aliases candidatos</small></span></div></header><div class="adi-priority"><div class="adi-panel"><h5>Atributos públicos relevantes</h5>${attributeRows(i)}</div><div class="adi-panel"><h5>Enlaces para pivotar</h5>${linkRows(i)}</div><div class="adi-panel"><h5>Aliases derivados</h5>${aliasRows(i)}</div></div><footer><b>Lectura metodológica:</b> “evidencia alta/media/inicial” mide riqueza y repetición del dato observado; no es una probabilidad de que dos perfiles pertenezcan a la misma persona.</footer>`;
    host.prepend(section);
    section.querySelectorAll('[data-adi-alias]').forEach(btn=>btn.addEventListener('click',()=>{const alias=btn.dataset.adiAlias;if(alias&&typeof window.__ATLAS_RUN_DIGITAL_IDENTITY__==='function')void window.__ATLAS_RUN_DIGITAL_IDENTITY__(alias,'deep');}));
    window.__ATLAS_DIGITAL_IDENTITY_INTELLIGENCE_0535__={active:true,version:VERSION,summary:m,identityAssertion:false,scoreMutation:false,renderedAt:new Date().toISOString()};
  }
  window.addEventListener('atlas:digital-identity-result',()=>queueMicrotask(mount));
  const obs=new MutationObserver(()=>mount());obs.observe(document.documentElement,{childList:true,subtree:true});mount();
})();
