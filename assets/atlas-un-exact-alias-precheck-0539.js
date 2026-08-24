'use strict';
/* ATLAS AML 0.53.9 · exact UN primary-name/official-alias precheck.
 * Runs before the generic entity OSINT gate. Exact normalized equality against
 * a UN primary name or official alias opens immediately as 100% nominal match.
 * Otherwise the event is handed back to the normal Atlas -> OSINT pipeline.
 */
(function atlasUnExactAliasPrecheck0539(){
  const FN='aml-un-exact-alias-live';
  let bypass=false,active=false;
  const clean=v=>String(v||'').trim().replace(/\s+/g,' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const isEntityMode=()=>document.querySelector('[data-aex-search-mode="entity"]')?.getAttribute('aria-selected')!=='false';
  const input=()=>document.querySelector('#aex-q');
  const button=()=>document.querySelector('#aex-run');
  const host=()=>document.querySelector('.aex-results')||document.querySelector('#content');
  function handoff(){const b=button();if(!b)return;bypass=true;try{b.click();}finally{queueMicrotask(()=>{bypass=false;});}}
  function render(q,row){const h=host();if(!h)return;const matched=row?.matched_name||row?.evidence?.matched_name||q,primary=row?.evidence?.primary_name||row?.related_entity_name||matched,kind=row?.evidence?.exact_name_type==='alias'?'alias oficial':'nombre principal';h.innerHTML=`<section class="agw-card agw-external"><header class="agw-main-head"><div><span class="agw-eyebrow">ONU · COINCIDENCIA NOMINAL EXACTA</span><h3>Coincidencia exacta encontrada</h3><p><b>${esc(q)}</b> coincide exactamente con un ${esc(kind)} de una entrada de la Lista Consolidada ONU. El nombre principal del registro es <b>${esc(primary)}</b>.</p></div><div class="agw-kpis"><span><b>100%</b><small>igualdad nominal</small></span><span><b>ONU</b><small>fuente oficial</small></span></div></header><section class="agw-evidence"><header><h4>Coincidencia exacta para revisión</h4><span>no crea entidad ni altera IPA3</span></header><article class="agw-finding"><div class="agw-finding-top"><span>ONU</span><strong>${esc(primary)}</strong><em>100%</em></div><p>${esc(row?.summary||'Coincidencia exacta en lista consolidada ONU.')}</p><dl><dt>Coincidió por</dt><dd>${esc(kind)} · ${esc(matched)}</dd><dt>Estado</dt><dd>candidato; requiere corroboración</dd></dl><a href="${esc(row?.source_url||'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list')}" target="_blank" rel="noopener noreferrer">Abrir evidencia de origen ↗</a></article></section><div class="agw-rule"><b>Regla de lectura:</b> 100% significa igualdad literal del nombre normalizado contra un nombre o alias oficial ONU. No equivale por sí sola a identidad confirmada.</div></section>`;window.__ATLAS_UN_EXACT_ALIAS_0539__={active:true,lastQuery:q,matched:true,matchedName:matched,primaryName:primary,matchType:kind,checkedAt:new Date().toISOString(),identityPromotion:false,scoreMutation:false};}
  async function check(q){if(active)return;active=true;try{const db=client();if(!db){handoff();return;}const {data,error}=await db.functions.invoke(FN,{body:{name:q}});if(error||!data?.ok||!Array.isArray(data.records)||!data.records.length){handoff();return;}render(q,data.records[0]);}catch(_e){handoff();}finally{active=false;}}
  function intercept(event){if(bypass||!isEntityMode())return;const q=clean(input()?.value||'');if(q.length<3)return;event.preventDefault();event.stopImmediatePropagation();void check(q);}
  document.addEventListener('click',e=>{if(e.target?.closest?.('#aex-run'))intercept(e);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='aex-q')intercept(e);},true);
  window.__ATLAS_UN_EXACT_ALIAS_0539__={active:true,release:'0.53.9',precheck:true,officialAliasExact:true,identityPromotion:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
