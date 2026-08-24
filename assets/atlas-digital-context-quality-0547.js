'use strict';
/* ATLAS AML 0.54.7 · contextual keywords, adaptive tags and technical coverage quality. */
(function atlasDigitalContextQuality0547(){
  const VERSION='DIGITAL-CONTEXT-QUALITY-0547.1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const currentRoot=()=>String(window.__ATLAS_DIGITAL_IDENTITY_0540__?.query||document.querySelector('#aex-q')?.value||'').trim();
  const words=q=>String(q||'').split(/\s+/).map(x=>x.replace(/[^\p{L}\p{N}._-]/gu,'')).filter(x=>x.length>=3).slice(0,8);
  function infer(){
    const q=currentRoot(),low=norm(q),ctx=window.__ATLAS_DIGITAL_CONTEXT__||{},entity=window.__ATLAS_ENTITY_CONTEXT__||window.__ATLAS_CURRENT_ENTITY__||{};
    const text=norm([ctx?.country,ctx?.region,ctx?.city,ctx?.organization,entity?.country,entity?.nationality,entity?.region,entity?.city,entity?.name].filter(Boolean).join(' '));
    let country=''; if(/\b(chile|chileno|chilena|santiago|valparaiso|concepcion)\b/.test(text))country='cl'; else if(/\b(argentina|argentino|buenos aires)\b/.test(text))country='ar'; else if(/\b(peru|peruano|lima)\b/.test(text))country='pe'; else if(/\b(colombia|colombiano|bogota)\b/.test(text))country='co'; else if(/\b(mexico|mexicano|cdmx)\b/.test(text))country='mx'; else if(/\b(usa|united states|estadounidense)\b/.test(text))country='us';
    const categories=['social']; const all=low+' '+text;
    if(/empresa|company|director|gerente|ceo|sociedad|business|bank|banco|financ/.test(all))categories.push('business','finance');
    if(/github|developer|software|tech|tecnolog|program/.test(all))categories.push('tech','coding');
    if(/prensa|period|news|medio/.test(all))categories.push('news');
    if(categories.length===1)categories.push('business','tech');
    const keywords=[...new Set([...words(q),...words(ctx?.organization),...words(entity?.name),...words(entity?.city),...words(entity?.region)])].filter(x=>x.length>=3).slice(0,10);
    return {country,categories:[...new Set(categories)].slice(0,6),keywords};
  }
  function settings(){const auto=infer(),manual=window.__ATLAS_DIGITAL_CONTEXT_MANUAL__||{};return {country:manual.country??auto.country,categories:Array.isArray(manual.categories)?manual.categories:auto.categories,keywords:Array.isArray(manual.keywords)?manual.keywords:auto.keywords};}
  function installInvoke(){
    const db=(()=>{try{return typeof sb!=='undefined'?sb:window.sb}catch(_e){return window.sb}})();
    if(!db?.functions?.invoke||db.functions.__atlasContext0547)return false;
    const prior=db.functions.invoke.bind(db.functions);
    db.functions.invoke=async(name,opts={})=>{
      if(name!=='aml-digital-identity-deep')return prior(name,opts);
      const c=settings(),body={...(opts?.body||{}),keywords:c.keywords,country:c.country,categories:c.categories};
      const res=await prior(name,{...opts,body});
      if(!res?.error&&res?.data?.ok){window.__ATLAS_DIGITAL_TECH_COVERAGE_0547__={alias:body.username,context:c,technical:res.data.technical_coverage||{},keywordContext:res.data.keyword_context||{},adaptiveContext:res.data.adaptive_context||{},checkedAt:res.data.checked_at||new Date().toISOString()};setTimeout(render,0);}
      return res;
    };
    db.functions.__atlasContext0547=true; return true;
  }
  function render(){
    const root=document.querySelector('.adi-resolver');if(!root)return;
    let box=root.querySelector('.adi-context-quality');if(!box){box=document.createElement('section');box.className='adi-context-quality';root.insertBefore(box,root.querySelector('.adi-dossier')||root.lastElementChild);}
    const c=settings(),t=window.__ATLAS_DIGITAL_TECH_COVERAGE_0547__?.technical||{},k=window.__ATLAS_DIGITAL_TECH_COVERAGE_0547__?.keywordContext||{};
    const q=t.quality_pct==null?'—':`${t.quality_pct}%`;
    box.innerHTML=`<header><div><span>CONTEXTO Y COBERTURA TÉCNICA</span><h4>Búsqueda adaptativa</h4></div><em>${esc(q)} comprobable</em></header><div class="adi-cq-context"><span><b>País</b>${esc(c.country?c.country.toUpperCase():'global / auto')}</span><span><b>Categorías</b>${esc(c.categories.join(' · '))}</span><span><b>Keywords</b>${esc(c.keywords.join(' · ')||'sin contexto adicional')}</span></div><div class="adi-cq-states"><span class="ok"><b>${Number(t.found||0)}</b><small>encontrados</small></span><span><b>${Number(t.negative||0)}</b><small>negativos técnicos</small></span><span class="warn"><b>${Number(t.blocked||0)}</b><small>bloqueados</small></span><span class="warn"><b>${Number(t.indeterminate||0)}</b><small>indeterminados</small></span><span class="bad"><b>${Number(t.error||0)}</b><small>errores</small></span><span><b>${Number(k?.hits?.length||0)}</b><small>hits contextuales</small></span></div><footer>Bloqueado, indeterminado o error técnico <b>no se interpreta como ausencia</b>. País y categorías sólo priorizan cobertura; no restringen definitivamente el universo.</footer>`;
  }
  const css=document.createElement('style');css.textContent=`.adi-context-quality{margin:14px 0;padding:14px;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:16px;background:color-mix(in srgb,currentColor 3%,transparent)}.adi-context-quality header{display:flex;justify-content:space-between;gap:12px;align-items:end}.adi-context-quality header span{font-size:10px;letter-spacing:.12em;opacity:.6}.adi-context-quality h4{margin:3px 0 0}.adi-context-quality header em{font-style:normal;font-weight:800}.adi-cq-context,.adi-cq-states{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.adi-cq-context span,.adi-cq-states span{padding:8px 10px;border-radius:10px;background:color-mix(in srgb,currentColor 5%,transparent);font-size:11px}.adi-cq-context b{display:block;font-size:9px;text-transform:uppercase;opacity:.55;margin-bottom:3px}.adi-cq-states b{font-size:16px;margin-right:5px}.adi-cq-states small{opacity:.7}.adi-cq-states .warn{border:1px solid rgba(230,160,40,.25)}.adi-cq-states .bad{border:1px solid rgba(220,80,80,.25)}.adi-context-quality footer{margin-top:10px;font-size:11px;opacity:.72}`;document.head.appendChild(css);
  let n=0;const timer=setInterval(()=>{if(installInvoke()||++n>40)clearInterval(timer);},100);window.addEventListener('atlas:digital-identity-result',()=>setTimeout(render,100));
  window.__ATLAS_DIGITAL_CONTEXT_QUALITY_0547__={active:true,version:VERSION,adaptiveCountry:true,adaptiveCategories:true,contextKeywords:true,technicalFailureNotNegative:true,installedAt:new Date().toISOString()};
})();