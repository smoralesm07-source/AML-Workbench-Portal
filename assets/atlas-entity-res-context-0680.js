'use strict';

/* ATLAS AML 0.68 · Contexto societario RES multifuente
 *
 * Alcance deliberadamente descriptivo:
 * - línea de tiempo factual RES + SII + UAF + Mercado Público;
 * - contexto cruzado por RUT exacto;
 * - red societaria exclusivamente documentada;
 * - accesos rápidos por cobertura/fuente, sin score ni inferencia AML.
 *
 * Fuera de este módulo: beneficiario final probabilístico, complejidad
 * societaria, vida corta, intensidad temprana, ratios capital/magnitud y
 * patrones alrededor de eventos. Esas hipótesis quedan para un demo separado.
 */
(function atlasEntityResContext0680(){
  const RELEASE='0.68.0',BUILD='0680';
  const MASTER='aml_entity_master_v0650';
  const LIFECYCLE='aml_entity_lifecycle_v0680';
  const RELATIONS='aml_entity_res_relationship_v0553';
  const MP='aml_entity_mp_summary_v0680';
  const POTENTIAL='aml_uaf_potential_registry_snapshot_v0650';
  const UAF='aml_uaf_obligated_subject_snapshot';
  const DISCOVERY_RPC='aml_entity_res_discovery_v0680';
  const TTL=5*60*1000,CACHE=new Map(),INFLIGHT=new Map();
  const ENTRY=window.__ATLAS_ENTITY_ENTRY__||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=v=>{const n=num(v);return n==null?'—':n.toLocaleString('es-CL',{maximumFractionDigits:0});};
  const money=v=>{const n=num(v);return n==null?'—':'$'+n.toLocaleString('es-CL',{maximumFractionDigits:0});};
  const day=v=>v?String(v).slice(0,10):'—';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const appState=()=>{try{return typeof state!=='undefined'?state:(window.state||null);}catch(_e){return window.state||null;}};
  const selected=()=>appState()?.selectedEntity||null;
  const soft=q=>Promise.resolve(q).then(v=>v,error=>({data:null,error}));
  const REGIONS={1:'Tarapacá',2:'Antofagasta',3:'Atacama',4:'Coquimbo',5:'Valparaíso',6:"O'Higgins",7:'Maule',8:'Biobío',9:'La Araucanía',10:'Los Lagos',11:'Aysén',12:'Magallanes',13:'Metropolitana de Santiago',14:'Los Ríos',15:'Arica y Parinacota',16:'Ñuble'};
  const PRESETS=[
    ['RES_SII','RES + SII','Entidades presentes por RUT exacto en ambas fuentes.'],
    ['RES_UAF','RES + UAF','Entidades RES observadas en el padrón UAF.'],
    ['RES_MP','RES + Mercado Público','Entidades RES con órdenes de compra 2023–2026.'],
    ['RES_POTENTIAL_SO','Potencial SO + RES','Screening vigente no observado en UAF y con identidad RES.'],
    ['RES_RELATIONS','Relaciones documentadas','Entidades con relaciones societarias respaldadas por evidencia.']
  ];

  function regionName(v){
    const raw=String(v??'').trim();
    const m=raw.match(/(?:Región\s*)?(\d{1,2})$/i);
    if(m&&REGIONS[Number(m[1])])return REGIONS[Number(m[1])];
    return raw||'sin región materializada';
  }
  function siiStatus(v){
    const x=String(v||'').toUpperCase();
    if(x==='ACTIVE_AS_PUBLISHED')return'Activo según publicación SII';
    if(x==='TERMINATED_AS_PUBLISHED')return'Término de giro publicado';
    return v||'Sin estado SII materializado';
  }
  function sourceLabel(v){return({RES:'RES',SII:'SII',UAF:'UAF',MERCADO_PUBLICO:'Mercado Público'})[String(v||'').toUpperCase()]||v||'Fuente';}

  function ensureStyles(){
    if(document.querySelector('#res68-style'))return;
    const st=document.createElement('style');st.id='res68-style';
    st.textContent=`
      .res68-card{margin:14px 0;padding:16px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:16px;background:color-mix(in srgb,currentColor 3%,transparent)}
      .res68-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:13px}.res68-head span{font-size:10px;font-weight:800;letter-spacing:.12em;opacity:.62}.res68-head h3{font-size:17px;margin:3px 0 0}.res68-head em{font-style:normal;font-size:11px;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,#f59e0b 15%,transparent);border:1px solid color-mix(in srgb,#f59e0b 38%,transparent)}
      .res68-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.res68-fact{padding:11px;border-radius:12px;border:1px solid color-mix(in srgb,currentColor 10%,transparent);min-height:94px}.res68-fact>span{display:block;font-size:10px;font-weight:800;letter-spacing:.08em;opacity:.58;text-transform:uppercase}.res68-fact>b{display:block;margin:5px 0;font-size:14px}.res68-fact small{display:block;line-height:1.35;opacity:.72}.res68-fact i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:currentColor;opacity:.45}
      .res68-badges{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.res68-badge{font-size:11px;padding:5px 8px;border-radius:999px;border:1px solid color-mix(in srgb,currentColor 13%,transparent);opacity:.76}.res68-badge.on{opacity:1;background:color-mix(in srgb,#f59e0b 10%,transparent)}
      .res68-note{margin:11px 0 0;font-size:11px;line-height:1.45;opacity:.66}.res68-note strong{opacity:1}
      .res68-life{display:grid;gap:0}.res68-event{display:grid;grid-template-columns:95px 18px 1fr;gap:8px;min-height:62px}.res68-event time{font-size:11px;font-variant-numeric:tabular-nums;padding-top:4px;opacity:.68}.res68-rail{position:relative}.res68-rail:before{content:'';position:absolute;left:8px;top:0;bottom:0;width:1px;background:color-mix(in srgb,currentColor 18%,transparent)}.res68-rail i{position:absolute;top:7px;left:4px;width:9px;height:9px;border-radius:50%;background:var(--res68-source,#f59e0b);box-shadow:0 0 0 3px color-mix(in srgb,var(--res68-source,#f59e0b) 15%,transparent)}
      .res68-event section{padding-bottom:13px}.res68-event section>b{display:block;font-size:13px}.res68-event section span{display:block;font-size:11px;opacity:.67;margin-top:3px}.res68-event section a{font-size:11px;display:inline-block;margin-top:4px}.res68-src-RES{--res68-source:#f59e0b}.res68-src-SII{--res68-source:#3b82f6}.res68-src-UAF{--res68-source:#8b5cf6}.res68-src-MERCADO_PUBLICO{--res68-source:#10b981}
      .res68-network-center{padding:12px;border-radius:13px;border:1px solid color-mix(in srgb,#f59e0b 36%,transparent);background:color-mix(in srgb,#f59e0b 8%,transparent);font-weight:800;text-align:center}.res68-network{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.res68-node{position:relative;padding:11px 12px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:12px}.res68-node>span{font-size:9px;letter-spacing:.08em;font-weight:800;opacity:.6}.res68-node>b{display:block;font-size:13px;margin:4px 0}.res68-node small,.res68-node em{display:block;font-size:10px;opacity:.66;font-style:normal}.res68-empty{padding:14px;border-radius:12px;background:color-mix(in srgb,currentColor 4%,transparent);font-size:12px;line-height:1.45;opacity:.72}
      #res68-discovery{margin:0 0 14px}.res68-preset-row{display:flex;gap:7px;flex-wrap:wrap}.res68-preset{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:999px;background:transparent;color:inherit;padding:7px 10px;font:inherit;font-size:11px;cursor:pointer}.res68-preset:hover,.res68-preset.on{border-color:color-mix(in srgb,#f59e0b 55%,transparent);background:color-mix(in srgb,#f59e0b 10%,transparent)}
      .res68-discovery-results{margin-top:10px;display:grid;gap:7px}.res68-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid color-mix(in srgb,currentColor 10%,transparent);border-radius:12px}.res68-result b{display:block;font-size:13px}.res68-result span{display:block;font-size:10px;opacity:.67;margin-top:3px}.res68-result small{display:block;font-size:10px;opacity:.62;margin-top:3px}.res68-open{border:1px solid color-mix(in srgb,#f59e0b 45%,transparent);background:color-mix(in srgb,#f59e0b 10%,transparent);color:inherit;border-radius:9px;padding:7px 9px;cursor:pointer;font-size:11px}.res68-loading{padding:12px;font-size:12px;opacity:.65}
      @media(max-width:900px){.res68-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.res68-network{grid-template-columns:1fr}}
      @media(max-width:560px){.res68-grid{grid-template-columns:1fr}.res68-event{grid-template-columns:78px 16px 1fr}.res68-result{grid-template-columns:1fr}.res68-open{justify-self:start}}
    `;
    document.head.appendChild(st);
  }

  async function fetchPackage(entityId){
    const client=db();if(!client||!entityId)return null;
    const master=await soft(client.from(MASTER).select('*').eq('entity_id',entityId).maybeSingle());
    const r=master?.data||null;
    if(!r||!r.res_available)return{entityId,registry:r,lifecycle:[],relations:[],mp:null,potential:null,uaf:null,errors:[master?.error].filter(Boolean),loadedAt:Date.now()};
    const [life,rels,mp,potential,uaf]=await Promise.all([
      soft(client.from(LIFECYCLE).select('*').eq('entity_id',entityId).order('event_date',{ascending:true,nullsFirst:false}).limit(100)),
      soft(client.from(RELATIONS).select('*').eq('entity_id',entityId).order('valid_from',{ascending:false,nullsFirst:false}).limit(100)),
      r.rut_key?soft(client.from(MP).select('*').eq('rut_key',r.rut_key).maybeSingle()):Promise.resolve({data:null,error:null}),
      r.rut?soft(client.from(POTENTIAL).select('rut,uaf_sectors,activity_codes,qualification_tier,evidence_count,semantics,refreshed_at').eq('rut',r.rut).maybeSingle()):Promise.resolve({data:null,error:null}),
      r.rut?soft(client.from(UAF).select('rut,uaf_sector,uaf_sector_canonical,registry_observed_at,registry_source_ref,refreshed_at').eq('rut',r.rut).maybeSingle()):Promise.resolve({data:null,error:null})
    ]);
    return{
      entityId,registry:r,
      lifecycle:Array.isArray(life?.data)?life.data:[],
      relations:Array.isArray(rels?.data)?rels.data:[],
      mp:mp?.data||null,potential:potential?.data||null,uaf:uaf?.data||null,
      errors:[master?.error,life?.error,rels?.error,mp?.error,potential?.error,uaf?.error].filter(Boolean).map(e=>String(e?.message||e)),
      loadedAt:Date.now()
    };
  }
  async function load(entityId){
    const hit=CACHE.get(entityId);if(hit&&Date.now()-hit.loadedAt<TTL)return hit;
    if(INFLIGHT.has(entityId))return INFLIGHT.get(entityId);
    const job=fetchPackage(entityId).then(v=>{if(v)CACHE.set(entityId,v);return v;}).finally(()=>INFLIGHT.delete(entityId));
    INFLIGHT.set(entityId,job);return job;
  }
  function holder(panel,key){
    if(!panel)return null;
    let n=panel.querySelector(`[data-res68-holder="${key}"]`);
    if(!n){n=document.createElement('div');n.dataset.res68Holder=key;panel.appendChild(n);}
    return n;
  }
  function hideLegacy(){
    const t=document.querySelector('[data-aer-holder="timeline"]');if(t)t.hidden=true;
    const r=document.querySelector('[data-aer-holder="relations"]');if(r)r.hidden=true;
  }
  function contextMarkup(d){
    const r=d.registry,mp=d.mp,p=d.potential,u=d.uaf;
    const uafSeen=!!u||!!r.is_uaf_observed;
    const src=[['RES',!!r.res_available],['SII',!!r.sii_registry_available],['UAF',uafSeen],['Mercado Público',!!mp],['Screening potencial SO',!!p],['Relaciones documentadas',d.relations.length>0]];
    const pSectors=Array.isArray(p?.uaf_sectors)?p.uaf_sectors.join(' · '):'';
    return `<section class="res68-card"><div class="res68-head"><div><span>CONTEXTO CRUZADO</span><h3>RES · SII · UAF · Mercado Público</h3></div><em>RUT exacto</em></div>
      <div class="res68-grid">
        <div class="res68-fact"><span>RES</span><b>${esc(r.res_company_code||'Sociedad registrada')}</b><small>Constitución ${esc(day(r.res_constitution_date))}<br>${esc(r.res_social_commune||r.res_tax_commune||'territorio no materializado')}</small></div>
        <div class="res68-fact"><span>SII</span><b>${esc(siiStatus(r.sii_current_status))}</b><small>Inicio ${esc(day(r.sii_activity_start_date))}${r.sii_termination_date?`<br>Término publicado ${esc(day(r.sii_termination_date))}`:''}</small></div>
        <div class="res68-fact"><span>UAF</span><b>${uafSeen?'Presente en padrón':'No observado en padrón'}</b><small>${u?esc(u.uaf_sector_canonical||u.uaf_sector||'sector no materializado'):(p?`Screening potencial SO${pSectors?' · '+esc(pSectors):''}`:'sin coincidencia exacta en el corte consultado')}</small></div>
        <div class="res68-fact"><span>Mercado Público</span><b>${mp?`${fmt(mp.order_count)} órdenes`:'Sin órdenes materializadas'}</b><small>${mp?`${money(mp.total_clp)} · ${fmt(mp.buyer_count)} compradores<br>primera ${day(mp.first_order_date)}`:'ventana 2023–2026'}</small></div>
      </div>
      <div class="res68-badges">${src.map(x=>`<span class="res68-badge ${x[1]?'on':''}">${esc(x[0])}${x[1]?' ✓':''}</span>`).join('')}</div>
      <p class="res68-note"><strong>Lectura:</strong> son coincidencias de fuentes y hechos registrales. No modifican IPA3, no constituyen probabilidad de LA/FT y “potencial SO” no equivale a incumplimiento.</p></section>`;
  }
  function lifecycleMarkup(rows){
    const list=[...rows].filter(x=>x.event_date).sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date))).slice(-60);
    return `<section class="res68-card"><div class="res68-head"><div><span>HISTORIA DE ENTIDAD</span><h3>Línea de tiempo societaria y operativa</h3></div><em>${fmt(list.length)} eventos</em></div>
      ${list.length?`<div class="res68-life">${list.map(x=>`<div class="res68-event res68-src-${esc(String(x.source_system||'').toUpperCase())}"><time>${esc(day(x.event_date))}</time><div class="res68-rail"><i></i></div><section><b>${esc(x.event_label||x.event_type||'Evento')}</b><span>${esc(sourceLabel(x.source_system))}${x.source_detail?' · '+esc(x.source_detail):''}</span>${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener noreferrer">Evidencia pública ↗</a>`:''}</section></div>`).join('')}</div>`:'<div class="res68-empty">No hay eventos multifuente adicionales materializados para esta entidad en el corte actual.</div>'}
      <p class="res68-note">El término de giro, cuando existe, se muestra sólo como hecho publicado por SII. ATLAS no deriva aquí duración anómala ni patrones de vida societaria.</p></section>`;
  }
  function networkMarkup(d){
    const rows=d.relations||[],r=d.registry;
    return `<section class="res68-card"><div class="res68-head"><div><span>RED SOCIETARIA</span><h3>Relaciones documentadas</h3></div><em>evidencia obligatoria</em></div>
      <div class="res68-network-center">${esc(r.res_legal_name||r.name||r.rut||d.entityId)}</div>
      ${rows.length?`<div class="res68-network">${rows.map(x=>`<div class="res68-node"><span>${esc(String(x.relationship_type||'RELACIÓN').replaceAll('_',' '))}</span><b>${esc(x.related_name||x.related_entity_id||'Entidad relacionada')}</b><small>${x.related_rut?esc(x.related_rut)+' · ':''}${x.ownership_pct!=null?fmt(x.ownership_pct)+'% · ':''}${esc(x.relationship_status||'estado no determinado')}</small><em>confianza documental ${x.confidence==null?'—':Math.round(Number(x.confidence)*100)+'%'}${x.requires_review?' · requiere revisión':''}</em>${x.source_document_url?`<a href="${esc(x.source_document_url)}" target="_blank" rel="noopener noreferrer">Documento ↗</a>`:''}</div>`).join('')}</div>`:'<div class="res68-empty">Sin relaciones societarias documentadas materializadas. ATLAS no completa esta red por similitud de nombres ni presume socios, accionistas o beneficiarios finales.</div>'}
    </section>`;
  }
  function evidenceMarkup(d){
    const r=d.registry;
    return `<section class="res68-card"><div class="res68-head"><div><span>TRAZABILIDAD</span><h3>Contrato de lectura RES 0.68</h3></div><em>descriptivo</em></div><div class="res68-grid">
      <div class="res68-fact"><span>Identidad</span><b>RUT exacto</b><small>${esc(r.rut||'—')}</small></div>
      <div class="res68-fact"><span>Corte RES</span><b>${esc(day(r.res_cutoff_date))}</b><small>${esc(r.res_snapshot_status||'—')}</small></div>
      <div class="res68-fact"><span>Relaciones</span><b>${fmt(d.relations.length)}</b><small>documentadas solamente</small></div>
      <div class="res68-fact"><span>Errores de fuente</span><b>${fmt(d.errors.length)}</b><small>${d.errors.length?esc(d.errors.join(' · ')):'sin errores en esta lectura'}</small></div>
    </div></section>`;
  }
  function paint(pkg,d){
    if(!d?.registry?.res_available)return;
    ensureStyles();hideLegacy();setTimeout(hideLegacy,80);setTimeout(hideLegacy,260);
    const root=document.querySelector('#content .a45');if(!root)return;
    const character=holder(root.querySelector('[data-a45-panel="character"]'),'context');if(character)character.innerHTML=contextMarkup(d);
    const timeline=holder(root.querySelector('[data-a45-panel="timeline"]'),'lifecycle');if(timeline)timeline.innerHTML=lifecycleMarkup(d.lifecycle);
    const network=holder(root.querySelector('[data-a45-panel="network"]'),'network');if(network)network.innerHTML=networkMarkup(d);
    const evidence=holder(root.querySelector('[data-a45-panel="evidence"]'),'method');if(evidence)evidence.innerHTML=evidenceMarkup(d);
    window.__ATLAS_ENTITY_RES_CONTEXT_STATE__={active:true,entityId:pkg?.e?.entity_id||d.entityId,lifecycle:d.lifecycle.length,relations:d.relations.length,hasMP:!!d.mp,potentialSO:!!d.potential,uafObserved:!!d.uaf,scoreMutation:false,renderedAt:new Date().toISOString()};
  }
  function decorate(pkg){
    const id=pkg?.e?.entity_id;if(!id)return;
    const hit=CACHE.get(id);if(hit&&Date.now()-hit.loadedAt<TTL){paint(pkg,hit);return;}
    void load(id).then(d=>{if(selected()===id)paint(pkg,d);});
  }

  let rendererInstalled=false;
  function installRenderer(){
    if(rendererInstalled||window.__ATLAS_RES68_RENDERER__)return true;
    const base=window.v0203RenderEntity;if(typeof base!=='function')return false;
    function wrapped(pkg,preserve=false){const out=base(pkg,preserve);try{decorate(pkg);}catch(_e){}return out;}
    try{v0203RenderEntity=wrapped;}catch(_e){}window.v0203RenderEntity=wrapped;
    window.__ATLAS_RES68_RENDERER__={base,wrapped};rendererInstalled=true;return true;
  }

  function discoveryShell(){
    return `<section id="res68-discovery" class="res68-card"><div class="res68-head"><div><span>EXPLORACIÓN RES</span><h3>Accesos rápidos por cobertura de fuentes</h3></div><em>sin scoring</em></div>
      <div class="res68-preset-row">${PRESETS.map(p=>`<button type="button" class="res68-preset" data-res68-preset="${esc(p[0])}" title="${esc(p[2])}">${esc(p[1])}</button>`).join('')}</div>
      <p class="res68-note">La grilla de Entidades permanece sin una investigación preseleccionada. Estos botones sólo ejecutan una consulta cuando el analista los pulsa.</p><div class="res68-discovery-results" data-res68-results></div></section>`;
  }
  function resultMarkup(row){
    const meta=[row.rut,row.res_company_code,row.commune,regionName(row.region)].filter(Boolean).join(' · ');
    const stateBits=[siiStatus(row.sii_current_status),row.uaf_state==='OBSERVADO_UAF'?'UAF observado':(row.potential_so_current?'Potencial SO · no observado UAF':''),row.mp_order_count?`${fmt(row.mp_order_count)} órdenes · ${money(row.mp_total_clp)}`:''].filter(Boolean).join(' · ');
    return `<div class="res68-result"><div><b>${esc(row.name||row.entity_id)}</b><span>${esc(meta)}</span><small>${esc(row.preset_reason||stateBits)}${stateBits?' · '+esc(stateBits):''}</small></div><button type="button" class="res68-open" data-res68-open="${esc(row.entity_id)}">Abrir expediente</button></div>`;
  }
  async function runPreset(code,button){
    const client=db(),box=document.querySelector('[data-res68-results]');if(!client||!box)return;
    document.querySelectorAll('.res68-preset').forEach(b=>b.classList.toggle('on',b===button));
    box.innerHTML='<div class="res68-loading">Consultando fuentes por RUT exacto…</div>';
    const {data,error}=await soft(client.rpc(DISCOVERY_RPC,{p_preset:code,p_limit:25,p_offset:0}));
    if(error){box.innerHTML=`<div class="res68-empty">Consulta no disponible: ${esc(error.message||error)}</div>`;return;}
    const rows=Array.isArray(data)?data:[];
    box.innerHTML=rows.length?rows.map(resultMarkup).join(''):'<div class="res68-empty">No hay entidades materializadas para este acceso rápido en el corte actual.</div>';
    box.querySelectorAll('[data-res68-open]').forEach(b=>b.addEventListener('click',()=>openEntity(b.dataset.res68Open)));
  }
  function openEntity(id){
    if(!id)return;
    if(ENTRY?.explorer?.open)return void ENTRY.explorer.open(id);
    if(typeof ENTRY?.open==='function')return void ENTRY.open(id);
    try{if(typeof v0203OpenEntity==='function')return void v0203OpenEntity(id);}catch(_e){}
  }
  function entitiesHome(){const s=appState();return !!s&&s.view==='entities'&&!s.selectedEntity;}
  function injectDiscovery(){
    if(!entitiesHome())return;
    const content=document.querySelector('#content');if(!content||content.querySelector('#res68-discovery'))return;
    ensureStyles();content.insertAdjacentHTML('afterbegin',discoveryShell());
    content.querySelectorAll('[data-res68-preset]').forEach(b=>b.addEventListener('click',()=>void runPreset(b.dataset.res68Preset,b)));
  }
  function installEntryHook(){
    if(!ENTRY||ENTRY.__res68Hook)return;
    const base=ENTRY.load;if(typeof base!=='function')return;
    ENTRY.load=async function res68EntityLoad(...args){const out=await base.apply(this,args);setTimeout(injectDiscovery,0);return out;};
    Object.defineProperty(ENTRY,'__res68Hook',{value:true,enumerable:false});
  }

  ensureStyles();installEntryHook();injectDiscovery();
  if(!installRenderer()){let n=0;const timer=setInterval(()=>{n+=1;if(installRenderer()||n>=60)clearInterval(timer);},250);}
  window.__ATLAS_ENTITY_RES_CONTEXT__={active:true,release:RELEASE,build:BUILD,views:{master:MASTER,lifecycle:LIFECYCLE,relations:RELATIONS,mp:MP},discoveryRpc:DISCOVERY_RPC,identityPolicy:'RUT_EXACTO_ONLY',relationshipPolicy:'DOCUMENTED_ONLY',potentialSemantics:'SCREENING_NOT_LEGAL_BREACH',scoreMutation:false,deferredAnalytics:['RECENT_INTENSITY','SHORT_LIVED','EVENT_WINDOW_CHANGES','CAPITAL_MAGNITUDE_RATIO','TERRITORIAL_CLUSTERS','PROBABILISTIC_BENEFICIAL_OWNER','SOCIETARY_COMPLEXITY'],load,clear:()=>CACHE.clear(),installedAt:new Date().toISOString()};
})();
