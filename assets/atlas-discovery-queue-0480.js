'use strict';

/* ATLAS AML 0.48.0 · build 0480 · Cola de descubrimiento
 *
 * Qué resuelve
 * ------------
 * De 28.937 hallazgos, 27.829 (96%) son ENTITY_CONVERGENCE y CONTEXTUAL_ANOMALY.
 * Los guardrails del propio sistema declaran que ninguno de los dos es riesgo:
 * «convergencia = visibilidad, no riesgo» y «anomalía contextual ≠ señal AML».
 * La cola de trabajo estaba compuesta casi enteramente por artefactos de
 * visibilidad, de modo que no era recorrible ni significativa.
 *
 * Esta vista lee aml_v0480_discovery_queue, que filtra por el rol analítico
 * declarado en el catálogo gobernado aml_finding_role.
 *
 * Semántica deliberada
 * --------------------
 * - No se borra ni se oculta nada: los artefactos de visibilidad siguen en el
 *   dossier de cada entidad y en la vista completa de hallazgos. Sólo se sacan
 *   de la cola de priorización, que es distinto.
 * - Tier DISCOVERY entra por mérito propio: señal AML gobernada o patrón
 *   estructural de entidad.
 * - Tier KNOWN_CONTEXT es riesgo real pero ya conocido y autocorrelacionado con
 *   la atención supervisora. El backtest lo demostró: sin historial
 *   sancionatorio la precisión@10 cae a 0%, porque el modelo sólo redescubre
 *   entidades muy supervisadas. Se muestra aparte, nunca arriba.
 *
 * Seguridad: sólo lectura bajo la sesión y RLS existentes. Sin MutationObserver.
 */
(function atlasDiscoveryQueue0480(){
  const RELEASE='0.48.0';
  const BUILD='0480';
  const QUEUE='aml_v0480_discovery_queue';
  const ROLES='aml_finding_role';

  const STATE={tier:'DISCOVERY',rows:[],roles:[],loaded:false,error:null};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v)||0;
  const fmt=v=>new Intl.NumberFormat('es-CL').format(n(v));

  function client(){try{return typeof sb!=='undefined'?sb:null;}catch(_e){return null;}}
  function host(){try{return typeof content==='function'?content():document.querySelector('#content');}
    catch(_e){return document.querySelector('#content');}}

  async function load(){
    const db=client();
    if(!db){STATE.error='Cliente de datos no disponible.';STATE.loaded=true;return;}
    try{
      const [q,r]=await Promise.all([
        db.from(QUEUE).select('entity_id,name,rut,region,entity_type,is_uaf_observed,is_sanctioned,'
          +'source_count,tier,governed_signals,governed_top_score,structural_patterns,'
          +'structural_top_strength,sanction_recurrence_patterns,prudential_findings,'
          +'visibility_findings,disposition_verdict,pending')
          .order('tier',{ascending:true})
          .order('governed_signals',{ascending:false})
          .order('structural_top_strength',{ascending:false,nullsFirst:false})
          .limit(500),
        db.from(ROLES).select('finding_type,role,in_discovery_queue,rationale')
      ]);
      if(q.error)throw q.error;
      STATE.rows=Array.isArray(q.data)?q.data:[];
      STATE.roles=(!r.error&&Array.isArray(r.data))?r.data:[];
      STATE.error=null;
    }catch(error){
      STATE.error=String(error?.message||error);
      STATE.rows=[];
    }
    STATE.loaded=true;
  }

  function counts(){
    const d=STATE.rows.filter(x=>x.tier==='DISCOVERY');
    const k=STATE.rows.filter(x=>x.tier==='KNOWN_CONTEXT');
    return {
      discovery:d.length,known:k.length,
      pendingDiscovery:d.filter(x=>x.pending).length,
      hidden:STATE.rows.reduce((a,x)=>a+n(x.visibility_findings),0)
    };
  }

  function reasons(r){
    const out=[];
    if(n(r.governed_signals))
      out.push(`<span class="a80-why sig">${fmt(r.governed_signals)} señal${n(r.governed_signals)===1?'':'es'} AML gobernada${n(r.governed_signals)===1?'':'s'}</span>`);
    if(n(r.structural_patterns))
      out.push(`<span class="a80-why str">Hub topológico${r.structural_top_strength?` · fuerza ${esc(r.structural_top_strength)}`:''}</span>`);
    if(n(r.sanction_recurrence_patterns))
      out.push(`<span class="a80-why ctx">Recurrencia sancionatoria</span>`);
    if(n(r.prudential_findings))
      out.push(`<span class="a80-why ctx">${fmt(r.prudential_findings)} sanción${n(r.prudential_findings)===1?'':'es'} prudencial${n(r.prudential_findings)===1?'':'es'}</span>`);
    return out.join('');
  }

  function rowHtml(r){
    return `<article class="a80-row${r.pending?'':' resolved'}">
      <div class="a80-main">
        <div class="a80-id">
          <strong>${esc(r.name||r.entity_id||'—')}</strong>
          <small>${esc(r.rut||'RUT no disponible')}${r.region?` · ${esc(r.region)}`:''}</small>
        </div>
        <div class="a80-why-wrap">${reasons(r)}</div>
      </div>
      <div class="a80-side">
        <div class="a80-flags">
          ${r.is_uaf_observed?'<span class="a80-tag uaf">UAF</span>':''}
          ${r.is_sanctioned?'<span class="a80-tag sanc">Sancionada</span>':''}
          ${r.pending?'<span class="a80-tag pend">Sin desenlace</span>'
            :`<span class="a80-tag done">${esc(r.disposition_verdict||'Resuelta')}</span>`}
        </div>
        ${n(r.visibility_findings)?`<small class="a80-hidden">${fmt(r.visibility_findings)} hallazgos de visibilidad, fuera de la cola</small>`:''}
        <button type="button" class="a80-open" data-entity="${esc(r.entity_id)}">Abrir dossier</button>
      </div>
    </article>`;
  }

  function rolesHtml(){
    if(!STATE.roles.length)return '';
    const order={DISCOVERY:0,KNOWN_CONTEXT:1,SOURCE_CONTEXT:2,SECTOR_CONTEXT:3,VISIBILITY:4};
    const rows=[...STATE.roles].sort((a,b)=>(order[a.role]??9)-(order[b.role]??9))
      .map(r=>`<tr>
        <td class="mono">${esc(r.finding_type)}</td>
        <td><span class="a80-role ${esc(String(r.role).toLowerCase())}">${esc(r.role)}</span></td>
        <td>${r.in_discovery_queue?'Sí':'No'}</td>
        <td class="a80-rat">${esc(r.rationale)}</td>
      </tr>`).join('');
    return `<details class="a80-roles">
      <summary>Catálogo de roles · por qué cada tipo entra o no a la cola</summary>
      <div class="a80-table-wrap"><table>
        <thead><tr><th>Tipo de hallazgo</th><th>Rol</th><th>En cola</th><th>Razón</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="a80-roles-note">El catálogo vive en <code>aml_finding_role</code> y es editable: cambiar la doctrina es un <code>UPDATE</code>, no un redespliegue.</p>
    </details>`;
  }

  function render(){
    const el=host();
    if(!el)return;
    if(!STATE.loaded){el.innerHTML='<div class="loading">Cargando cola de descubrimiento…</div>';return;}
    if(STATE.error){
      el.innerHTML=`<div class="flash error"><b>No fue posible abrir la cola.</b><br>${esc(STATE.error)}</div>`;
      return;
    }
    const c=counts();
    const rows=STATE.rows.filter(r=>r.tier===STATE.tier);

    el.innerHTML=`<section class="a80-wrap">
      <div class="a80-intro">
        <p><strong>Qué cambió.</strong> La cola dejó de mostrar los ${fmt(c.hidden)} hallazgos de visibilidad asociados a estas entidades. No se borró nada: siguen en el dossier de cada entidad y en la vista completa de hallazgos. Lo que se retiró es su participación en la <em>priorización</em>, que es distinto.</p>
        <p class="a80-why-note">De los 28.937 hallazgos del sistema, 27.829 son <code>ENTITY_CONVERGENCE</code> y <code>CONTEXTUAL_ANOMALY</code>. Los guardrails declarados dicen que ninguno de los dos es riesgo: «convergencia = visibilidad, no riesgo» y «anomalía contextual ≠ señal AML».</p>
      </div>

      <div class="a80-tiers">
        <button type="button" class="a80-tier${STATE.tier==='DISCOVERY'?' on':''}" data-tier="DISCOVERY">
          <b>${fmt(c.discovery)}</b><span>Descubrimiento</span>
          <small>Señal AML gobernada o patrón estructural</small>
        </button>
        <button type="button" class="a80-tier${STATE.tier==='KNOWN_CONTEXT'?' on':''}" data-tier="KNOWN_CONTEXT">
          <b>${fmt(c.known)}</b><span>Contexto conocido</span>
          <small>Riesgo real, ya conocido y autocorrelacionado</small>
        </button>
      </div>

      ${STATE.tier==='KNOWN_CONTEXT'?`<div class="a80-caution">
        <strong>Por qué esto no encabeza la cola.</strong> El backtest de la metodología midió precisión@10 del 30% con historial sancionatorio y <strong>0% sin él</strong>: todo el poder predictivo venía de «ya fue sancionado», que es autocorrelación de atención supervisora. El modelo redescubre que a las entidades muy supervisadas se las sanciona seguido. Es contexto de riesgo conocido, no descubrimiento.
      </div>`:''}

      ${rows.length
        ? `<div class="a80-list">${rows.map(rowHtml).join('')}</div>`
        : `<div class="empty"><strong>Sin entidades en este tramo</strong>Cambia de tramo para ver el resto.</div>`}

      ${STATE.tier==='DISCOVERY'?`<div class="a80-gap">
        <strong>Una cola de ${fmt(c.discovery)} entidades es el resultado honesto, no un filtro mal calibrado.</strong>
        <p>El sistema produce pocas señales de descubrimiento porque le faltan las fuentes que las generan: no hay screening de listas designadas (GAFI R.6/R.7), ni personas expuestas políticamente (R.12), ni beneficiario final (R.24/25). Mientras esas capas no existan, el catálogo seguirá dominado por convergencia y contexto.</p>
      </div>`:''}

      ${rolesHtml()}
    </section>`;
    bind();
  }

  function bind(){
    const el=host();
    if(!el)return;
    el.querySelectorAll('[data-tier]').forEach(b=>b.addEventListener('click',()=>{
      STATE.tier=b.dataset.tier;render();
    }));
    el.querySelectorAll('[data-entity]').forEach(b=>b.addEventListener('click',()=>{
      try{
        if(typeof window.openEntity==='function')window.openEntity(b.dataset.entity);
        else window.navigate?.('entities');
      }catch(_e){}
    }));
  }

  async function loadDiscovery(){
    try{if(typeof state!=='undefined')state.view='discovery';}catch(_e){}
    try{
      if(typeof shell==='function')
        shell('Descubrimiento','Entidades que entran por señal AML gobernada o patrón estructural, separadas del contexto conocido.');
    }catch(_e){}
    STATE.loaded=false;
    render();
    await load();
    render();
    const c=counts();
    window.__ATLAS_DISCOVERY_QUEUE__={
      active:true,release:RELEASE,build:BUILD,view:QUEUE,
      discovery:c.discovery,known:c.known,visibilityExcluded:c.hidden,
      semantic:'VISIBILITY_ARTIFACTS_EXCLUDED_FROM_PRIORITISATION_NOT_DELETED',
      loadedAt:new Date().toISOString()
    };
    try{window.audit?.('VIEW_DISCOVERY_QUEUE',{objectType:'queue',objectId:QUEUE,
      payload:{discovery:c.discovery,known:c.known,release:RELEASE}});}catch(_e){}
  }

  const priorNavigate=(typeof window.navigate==='function')?window.navigate:null;
  const discoveryAwareNavigate=async function(view,...rest){
    if(view==='discovery')return loadDiscovery();
    if(priorNavigate)return priorNavigate.call(this,view,...rest);
    return undefined;
  };
  try{navigate=discoveryAwareNavigate;}catch(_error){}
  window.navigate=discoveryAwareNavigate;

  window.loadDiscovery=loadDiscovery;

  function announce(){try{window.dispatchEvent(new Event('atlas:nav-refresh'));}catch(_e){}}
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',()=>setTimeout(announce,0),{once:true});
  else setTimeout(announce,0);
  for(const delay of [300,1200])setTimeout(announce,delay);

  window.AtlasDiscoveryQueue={
    release:RELEASE,build:BUILD,view:QUEUE,roles:ROLES,load,render,state:STATE,
    semantic:'VISIBILITY_ARTIFACTS_EXCLUDED_FROM_PRIORITISATION_NOT_DELETED'
  };
})();
