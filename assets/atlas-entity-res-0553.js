'use strict';

/* ATLAS AML 0.55.3 · Registro de Empresas y Sociedades en Entidad 360
 *
 * Integra hechos registrales oficiales RES por Entity ID resuelto mediante RUT
 * exacto. No crea identidad por nombre, no infiere socios/accionistas y no
 * modifica IPA3. Las relaciones sólo se muestran cuando existen filas
 * documentales en aml_res_relationship.
 */
(function atlasEntityRes0553(){
  const RELEASE='0.55.3',BUILD='0553';
  const BASE_RENDER=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(!BASE_RENDER){window.__ATLAS_ENTITY_RES__={active:false,reason:'entity-renderer-unavailable'};return;}

  const MASTER='aml_entity_master_v0553';
  const TIMELINE='aml_entity_res_timeline_v0553';
  const RELATIONS='aml_entity_res_relationship_v0553';
  const TTL=5*60*1000,CACHE=new Map(),INFLIGHT=new Map();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=v=>{const n=num(v);return n==null?'—':n.toLocaleString('es-CL',{maximumFractionDigits:0});};
  const money=v=>{const n=num(v);return n==null?'—':'$'+n.toLocaleString('es-CL',{maximumFractionDigits:0});};
  const day=v=>v?String(v).slice(0,10):'—';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};
  const selected=()=>{try{return (typeof state!=='undefined'?state:(window.state||null))?.selectedEntity||null;}catch(_error){return null;}};
  const soft=q=>Promise.resolve(q).then(v=>v,error=>({data:null,error}));

  async function fetchPackage(entityId){
    const client=db();if(!client||!entityId)return null;
    const [master,timeline,relations]=await Promise.all([
      soft(client.from(MASTER).select('*').eq('entity_id',entityId).maybeSingle()),
      soft(client.from(TIMELINE).select('*').eq('entity_id',entityId).order('actuation_date',{ascending:true,nullsFirst:false}).limit(100)),
      soft(client.from(RELATIONS).select('*').eq('entity_id',entityId).order('valid_from',{ascending:false,nullsFirst:false}).limit(100))
    ]);
    return{
      entityId,
      registry:master?.data||null,
      timeline:Array.isArray(timeline?.data)?timeline.data:[],
      relations:Array.isArray(relations?.data)?relations.data:[],
      errors:[master?.error,timeline?.error,relations?.error].filter(Boolean).map(e=>String(e?.message||e)),
      loadedAt:Date.now()
    };
  }
  async function load(entityId){
    const hit=CACHE.get(entityId);if(hit&&Date.now()-hit.loadedAt<TTL)return hit;
    if(INFLIGHT.has(entityId))return INFLIGHT.get(entityId);
    const job=fetchPackage(entityId).then(data=>{if(data)CACHE.set(entityId,data);return data;}).finally(()=>INFLIGHT.delete(entityId));
    INFLIGHT.set(entityId,job);return job;
  }
  function holder(panel,key){
    if(!panel)return null;
    let node=panel.querySelector(`[data-aer-holder="${key}"]`);
    if(!node){node=document.createElement('div');node.dataset.aerHolder=key;node.className='aer-holder';panel.appendChild(node);}
    return node;
  }
  function sourceRibbon(registry){
    const ribbon=document.querySelector('#content .a45-source-ribbon');if(!ribbon||ribbon.querySelector('[data-aer-source="RES"]'))return;
    const button=document.createElement('button');button.type='button';button.className='a45-source res';button.dataset.aerSource='RES';
    button.innerHTML=`<i></i><b>Registro RES</b><span>RESUELTA</span><small>${esc(day(registry.res_cutoff_date))}</small>`;
    button.title='Registro de Empresas y Sociedades · vínculo por RUT exacto';ribbon.appendChild(button);
  }
  function patchCoverage(){
    const reading=document.querySelector('#content .a45-readings > div:first-child');if(!reading||reading.dataset.aerCoverage==='1')return;
    const strong=reading.querySelector('strong');if(!strong)return;
    const text=strong.childNodes[0]?.textContent||'';const current=parseInt(text,10);
    const small=strong.querySelector('small');const den=small?parseInt(String(small.textContent||'').replace(/\D/g,''),10):NaN;
    if(Number.isFinite(current))strong.childNodes[0].textContent=String(current+1);
    if(small&&Number.isFinite(den))small.textContent=`/ ${den+1}`;
    const em=reading.querySelector('em');if(em)em.textContent='cobertura observable · incluye RES';
    reading.dataset.aerCoverage='1';
  }
  function registryMarkup(r){
    return `<section class="aer-card aer-registry">
      <header><div><span class="aer-eyebrow">REGISTRO OFICIAL</span><h3>Registro de Empresas y Sociedades</h3></div><span class="aer-status">RUT exacto</span></header>
      <div class="aer-kpis">
        <div><span>Constitución</span><b>${esc(day(r.res_constitution_date))}</b><small>fecha publicada</small></div>
        <div><span>Capital</span><b>${esc(money(r.res_capital))}</b><small>monto registral</small></div>
        <div><span>Tipo / código</span><b>${esc(r.res_company_code||'—')}</b><small>atributo RES</small></div>
        <div><span>Corte</span><b>${esc(day(r.res_cutoff_date))}</b><small>${esc(r.res_snapshot_status||'—')}</small></div>
      </div>
      <dl class="aer-dl">
        <dt>Razón social RES</dt><dd>${esc(r.res_legal_name||r.name||'—')}</dd>
        <dt>Fecha registro</dt><dd>${esc(day(r.res_registry_date))}</dd>
        <dt>Aprobación SII</dt><dd>${esc(day(r.res_sii_approval_date))}</dd>
        <dt>Domicilio social</dt><dd>${esc([r.res_social_commune,r.res_social_region!=null?'Región '+r.res_social_region:null].filter(Boolean).join(' · ')||'—')}</dd>
        <dt>Domicilio tributario</dt><dd>${esc([r.res_tax_commune,r.res_tax_region!=null?'Región '+r.res_tax_region:null].filter(Boolean).join(' · ')||'—')}</dd>
      </dl>
      <p class="aer-note">Fuente pública RES vía Datos.gob.cl. El vínculo con la identidad ATLAS se materializa sólo por RUT exacto.</p>
    </section>`;
  }
  function timelineMarkup(rows){
    return `<section class="aer-card"><header><div><span class="aer-eyebrow">HISTORIA SOCIETARIA</span><h3>Actuaciones RES</h3></div><span class="aer-count">${fmt(rows.length)}</span></header>
      ${rows.length?`<div class="aer-timeline">${rows.map(x=>`<div><time>${esc(day(x.actuation_date))}</time><i></i><section><b>${esc(x.actuation_type||'Actuación')}</b><span>Registro ${esc(day(x.registry_date))}</span>${x.public_document_url?`<a href="${esc(x.public_document_url)}" target="_blank" rel="noopener noreferrer">Documento público ↗</a>`:''}</section></div>`).join('')}</div>`:'<div class="aer-empty">No existen actuaciones adicionales materializadas para esta identidad. El corte abierto actual aporta la constitución; una ausencia no se interpreta como inexistencia histórica.</div>'}
    </section>`;
  }
  function relationsMarkup(rows){
    return `<section class="aer-card"><header><div><span class="aer-eyebrow">PROPIEDAD Y CONTROL</span><h3>Relaciones societarias documentadas</h3></div><span class="aer-count">${fmt(rows.length)}</span></header>
      ${rows.length?`<div class="aer-relations">${rows.map(x=>`<div><span class="aer-rel-type">${esc(String(x.relationship_type||'RELACIÓN').replaceAll('_',' '))}</span><b>${esc(x.related_name||x.related_entity_id||'Entidad relacionada')}</b><small>${x.related_rut?esc(x.related_rut)+' · ':''}${x.ownership_pct!=null?esc(fmt(x.ownership_pct))+'% · ':''}${esc(x.relationship_status||'INDETERMINADA')}</small><em>confianza ${x.confidence==null?'—':Math.round(Number(x.confidence)*100)+'%'}${x.requires_review?' · requiere revisión':''}</em></div>`).join('')}</div>`:'<div class="aer-empty"><b>Sin relaciones documentales materializadas todavía.</b><span>ATLAS no infiere socios, accionistas, administradores ni beneficiarios finales desde el CSV abierto de constituciones. Este bloque se completará sólo con evidencia documental trazable.</span></div>'}
    </section>`;
  }
  function evidenceMarkup(r,data){
    return `<section class="aer-card aer-evidence"><header><div><span class="aer-eyebrow">PROCEDENCIA</span><h3>Evidencia registral RES</h3></div><span class="aer-status">oficial</span></header><dl class="aer-dl">
      <dt>Recurso</dt><dd>${esc(r.res_resource_name||r.res_resource_id||'—')}</dd>
      <dt>ID recurso</dt><dd><code>${esc(r.res_resource_id||'—')}</code></dd>
      <dt>Corte de datos</dt><dd>${esc(day(r.res_cutoff_date))}</dd>
      <dt>Actualización fuente</dt><dd>${esc(day(r.res_source_updated_at))}</dd>
      <dt>Estado snapshot</dt><dd>${esc(r.res_snapshot_status||'—')}</dd>
      <dt>Actuaciones</dt><dd>${fmt(data.timeline.length)}</dd>
      <dt>Relaciones documentadas</dt><dd>${fmt(data.relations.length)}</dd>
    </dl>${data.errors.length?`<div class="aer-warning">Bloques no disponibles: ${esc(data.errors.join(' · '))}</div>`:''}</section>`;
  }
  function identityBadge(r){
    const identity=document.querySelector('#content .a45-identity');if(!identity||identity.querySelector('[data-aer-badge]'))return;
    const roles=identity.querySelector('.a45-roles');if(!roles)return;
    const badge=document.createElement('span');badge.dataset.aerBadge='1';badge.className='aer-role';badge.textContent='RES · registro societario';badge.title=`Constitución ${day(r.res_constitution_date)} · RUT exacto`;roles.appendChild(badge);
  }
  function paint(pkg,data){
    const root=document.querySelector('#content .a45');if(!root||!data)return;
    const r=data.registry;if(!r?.res_available){
      window.__ATLAS_ENTITY_RES_STATE__={active:true,entityId:pkg?.e?.entity_id||null,resAvailable:false,loadedAt:new Date().toISOString()};
      return;
    }
    identityBadge(r);sourceRibbon(r);patchCoverage();
    const character=holder(root.querySelector('[data-a45-panel="character"]'),'registry');if(character)character.innerHTML=registryMarkup(r);
    const timeline=holder(root.querySelector('[data-a45-panel="timeline"]'),'timeline');if(timeline)timeline.innerHTML=timelineMarkup(data.timeline);
    const network=holder(root.querySelector('[data-a45-panel="network"]'),'relations');if(network)network.innerHTML=relationsMarkup(data.relations);
    const evidence=holder(root.querySelector('[data-a45-panel="evidence"]'),'evidence');if(evidence)evidence.innerHTML=evidenceMarkup(r,data);
    window.__ATLAS_ENTITY_RES_STATE__={active:true,release:RELEASE,build:BUILD,entityId:pkg?.e?.entity_id||null,resAvailable:true,cutoff:r.res_cutoff_date,effectiveSourceCount:r.effective_source_count,actuations:data.timeline.length,relations:data.relations.length,identityMethod:'RUT_EXACTO',scoreMutation:false,renderedAt:new Date().toISOString()};
  }
  function decorate(pkg){const id=pkg?.e?.entity_id;if(!id)return;const hit=CACHE.get(id);if(hit&&Date.now()-hit.loadedAt<TTL){paint(pkg,hit);return;}void load(id).then(data=>{if(selected()===id)paint(pkg,data);});}
  function wrappedRender(pkg,preserve=false){const result=BASE_RENDER(pkg,preserve);try{decorate(pkg);}catch(_error){}return result;}
  try{v0203RenderEntity=wrappedRender;}catch(_error){}window.v0203RenderEntity=wrappedRender;
  window.__ATLAS_ENTITY_RES__={active:true,release:RELEASE,build:BUILD,views:{master:MASTER,timeline:TIMELINE,relations:RELATIONS},load,clear:()=>CACHE.clear(),identityPolicy:'RUT_EXACTO_ONLY',relationshipPolicy:'DOCUMENTED_ONLY',scoreMutation:false,installedAt:new Date().toISOString()};
})();
