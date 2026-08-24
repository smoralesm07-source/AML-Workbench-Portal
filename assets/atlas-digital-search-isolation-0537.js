'use strict';
/* ATLAS AML 0.53.9 · isolates Digital Identity and prechecks exact UN aliases. */
(function atlasDigitalSearchIsolation0539(){
  const VERSION='DIGITAL-SEARCH-ISOLATION-0539.1';
  const UN_FN='aml-un-exact-alias-live';
  let entityBypass=false,entityActive=false;
  const mode=()=>String(window.__ATLAS_DIGITAL_IDENTITY_0524__?.mode||'entity');
  const aliasActive=()=>mode()==='alias';
  const currentQuery=()=>String(document.querySelector('#aex-q')?.value||'').trim().replace(/\s+/g,' ');
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const results=()=>document.querySelector('.aex-results')||document.querySelector('#content');

  function runDigital(){const q=currentQuery();if(q.length<2)return;const fn=window.__ATLAS_RUN_DIGITAL_IDENTITY__;if(typeof fn==='function')void fn(q,'quick');}
  document.addEventListener('click',event=>{
    if(!aliasActive())return;
    const target=event.target?.closest?.('#aex-run');if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();runDigital();
  },true);
  document.addEventListener('keydown',event=>{
    if(!aliasActive()||event.key!=='Enter'||event.target?.id!=='aex-q')return;
    event.preventDefault();event.stopImmediatePropagation();runDigital();
  },true);

  function handoffEntity(){const b=document.querySelector('#aex-run');if(!b)return;entityBypass=true;try{b.click();}finally{queueMicrotask(()=>{entityBypass=false;});}}
  function renderUnExact(q,row){
    const h=results();if(!h)return;
    const matched=row?.matched_name||row?.evidence?.matched_name||q;
    const primary=row?.evidence?.primary_name||row?.related_entity_name||matched;
    const kind=row?.evidence?.exact_name_type==='alias'?'alias oficial':'nombre principal';
    h.innerHTML=`<section class="agw-card agw-external"><header class="agw-main-head"><div><span class="agw-eyebrow">ONU · COINCIDENCIA NOMINAL EXACTA</span><h3>Coincidencia exacta encontrada</h3><p><b>${esc(q)}</b> coincide exactamente con un ${esc(kind)} de una entrada de la Lista Consolidada ONU. El nombre principal del registro es <b>${esc(primary)}</b>.</p></div><div class="agw-kpis"><span><b>100%</b><small>igualdad nominal</small></span><span><b>ONU</b><small>fuente oficial</small></span></div></header><section class="agw-evidence"><header><h4>Coincidencia exacta para revisión</h4><span>no crea entidad ni altera IPA3</span></header><article class="agw-finding"><div class="agw-finding-top"><span>ONU</span><strong>${esc(primary)}</strong><em>100%</em></div><p>${esc(row?.summary||'Coincidencia exacta en lista consolidada ONU.')}</p><dl><dt>Coincidió por</dt><dd>${esc(kind)} · ${esc(matched)}</dd><dt>Estado</dt><dd>candidato; requiere corroboración</dd></dl><a href="${esc(row?.source_url||'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list')}" target="_blank" rel="noopener noreferrer">Abrir evidencia de origen ↗</a></article></section><div class="agw-rule"><b>Regla de lectura:</b> 100% significa igualdad literal del nombre normalizado contra un nombre o alias oficial ONU. No equivale por sí sola a identidad confirmada.</div></section>`;
    window.__ATLAS_UN_EXACT_ALIAS_0539__={active:true,lastQuery:q,matched:true,matchedName:matched,primaryName:primary,matchType:kind,checkedAt:new Date().toISOString(),identityPromotion:false,scoreMutation:false};
  }
  async function precheckEntity(q){
    if(entityActive)return;entityActive=true;
    try{
      const db=client();if(!db){handoffEntity();return;}
      const {data,error}=await db.functions.invoke(UN_FN,{body:{name:q}});
      if(error||!data?.ok||!Array.isArray(data.records)||!data.records.length){handoffEntity();return;}
      renderUnExact(q,data.records[0]);
    }catch(_e){handoffEntity();}
    finally{entityActive=false;}
  }
  function interceptEntity(event){
    if(entityBypass||aliasActive())return;
    const q=currentQuery();if(q.length<3)return;
    event.preventDefault();event.stopImmediatePropagation();void precheckEntity(q);
  }
  document.addEventListener('click',event=>{if(event.target?.closest?.('#aex-run'))interceptEntity(event);},true);
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target?.id==='aex-q')interceptEntity(event);},true);

  window.__ATLAS_DIGITAL_SEARCH_ISOLATION_0537__={active:true,version:VERSION,entityOsintIsolation:true,unExactAliasPrecheck:true,identityPromotion:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
