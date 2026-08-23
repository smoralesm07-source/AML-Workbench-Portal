'use strict';

/* ATLAS AML 0.47.0 · build 0470 · Cola de validación de identidad
 *
 * Qué resuelve
 * ------------
 * El pipeline de identidad resuelve 400 sanciones por calce exacto de nombre con
 * confianza 0,95–0,98, pero el guardrail NO_PROMOVER_IDENTIDAD_SOLO_POR_NOMBRE
 * impide promoverlas a identidad firme automáticamente — y con razón. El efecto
 * secundario era que el portal no las mostraba en absoluto: 232 de ellas tienen
 * vínculo LA/FT directo, o sea el 70% de los eventos más relevantes del sistema,
 * invisibles para el analista.
 *
 * Esta vista las pone en una cola de trabajo para que una persona las resuelva.
 *
 * Semántica deliberada
 * --------------------
 * - Confirmar NO reescribe aml_sanctions.entity_id ni identity_status. Registra
 *   el juicio del analista como evidencia trazable; la promoción a identidad
 *   firme corresponde a un paso gobernado del pipeline. La interfaz lo declara.
 * - Confianza y método describen el algoritmo de calce, no riesgo AML.
 * - El registro es de sólo anexado: rectificar es anexar.
 *
 * Seguridad: lectura y escritura bajo la sesión y RLS existentes, sólo a nombre
 * propio. No toca Auth, Entra ni refresh tokens. Sin MutationObserver.
 */
(function atlasValidationQueue0470(){
  const RELEASE='0.47.0';
  const BUILD='0470';
  const QUEUE='aml_v0470_identity_validation_queue';
  const TABLE='aml_sanction_identity_validation';
  const MIN_RATIONALE=20;
  const PAGE=60;

  const VERDICTS=[
    ['CONFIRMADA','Confirmar','La sanción corresponde a esta entidad.'],
    ['RECHAZADA','Rechazar','El calce por nombre es incorrecto.'],
    ['INSUFICIENTE','Sin evidencia','No es decidible con lo disponible.']
  ];
  const VERDICT_LABEL=Object.fromEntries(VERDICTS.map(v=>[v[0],v[1]]));

  const STATE={filter:'pending',rows:[],loaded:false,error:null,open:null};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number.isFinite(Number(v))?Number(v):null;

  function client(){try{return typeof sb!=='undefined'?sb:null;}catch(_e){return null;}}
  function host(){try{return typeof content==='function'?content():document.querySelector('#content');}
    catch(_e){return document.querySelector('#content');}}
  function fmtDate(v){
    if(!v)return'—';
    try{return new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric'})
      .format(new Date(`${String(v).slice(0,10)}T12:00:00`));}catch(_e){return String(v);}
  }
  function pct(v){const n=num(v);return n===null?'—':`${Math.round(n*100)}%`;}

  /* ---------------- datos ---------------- */

  async function load(){
    const db=client();
    if(!db){STATE.error='Cliente de datos no disponible.';STATE.loaded=true;return;}
    try{
      const {data,error}=await db.from(QUEUE)
        .select('sanction_id,event_date,regulator,sanctioned_name,subject,laft_direct,'
               +'resolution_method,confidence,candidate_entity_id,candidate_rut,'
               +'candidate_entity_name,candidate_region,candidate_is_uaf_observed,'
               +'validation_verdict,validation_rationale,validated_at,pending')
        .order('pending',{ascending:false})
        .order('laft_direct',{ascending:false})
        .order('confidence',{ascending:false})
        .limit(600);
      if(error)throw error;
      STATE.rows=Array.isArray(data)?data:[];
      STATE.error=null;
    }catch(error){
      STATE.error=String(error?.message||error);
      STATE.rows=[];
    }
    STATE.loaded=true;
  }

  async function submit(row,verdict,rationale){
    const db=client();
    if(!db)return{ok:false,error:'Cliente de datos no disponible.'};
    const clean=String(rationale??'').trim();
    if(!VERDICT_LABEL[verdict])return{ok:false,error:'Selecciona un veredicto.'};
    if(clean.length<MIN_RATIONALE)
      return{ok:false,error:`La justificación necesita al menos ${MIN_RATIONALE} caracteres (van ${clean.length}).`};

    let userId=null;
    try{userId=(await db.auth.getUser())?.data?.user?.id??null;}catch(_e){}
    if(!userId){try{userId=typeof state!=='undefined'?state.user?.id??null:null;}catch(_e){}}
    if(!userId)return{ok:false,error:'No fue posible identificar la sesión.'};

    try{
      const {error}=await db.from(TABLE).insert({
        sanction_id:row.sanction_id,
        candidate_entity_id:row.candidate_entity_id,
        user_id:userId,
        verdict,
        rationale:clean,
        method_at_decision:row.resolution_method??null,
        confidence_at_decision:num(row.confidence),
        laft_direct_at_decision:!!row.laft_direct,
        release:RELEASE
      });
      if(error)throw error;
      try{
        window.audit?.('IDENTITY_VALIDATION',{
          objectType:'sanction',objectId:row.sanction_id,
          payload:{verdict,candidate_entity_id:row.candidate_entity_id,
                   confidence:num(row.confidence),laft_direct:!!row.laft_direct,release:RELEASE}
        });
      }catch(_e){}
      return{ok:true,error:null};
    }catch(error){
      return{ok:false,error:String(error?.message||error)};
    }
  }

  /* ---------------- presentación ---------------- */

  function counts(){
    const all=STATE.rows;
    return {
      all:all.length,
      pending:all.filter(r=>r.pending).length,
      laft:all.filter(r=>r.pending&&r.laft_direct).length,
      done:all.filter(r=>!r.pending).length
    };
  }

  function visible(){
    if(STATE.filter==='laft')return STATE.rows.filter(r=>r.pending&&r.laft_direct);
    if(STATE.filter==='done')return STATE.rows.filter(r=>!r.pending);
    if(STATE.filter==='all')return STATE.rows;
    return STATE.rows.filter(r=>r.pending);
  }

  function verdictChip(r){
    if(r.pending)return '<span class="a70-chip pend">Pendiente</span>';
    const cls=r.validation_verdict==='CONFIRMADA'?'ok'
      :r.validation_verdict==='RECHAZADA'?'no':'inc';
    return `<span class="a70-chip ${cls}">${esc(VERDICT_LABEL[r.validation_verdict]||r.validation_verdict)}</span>`;
  }

  function formHtml(id){
    const opts=VERDICTS.map(([value,label,hint])=>`<label class="a70-opt">
      <input type="radio" name="a70-v-${esc(id)}" value="${esc(value)}" />
      <span><strong>${esc(label)}</strong><small>${esc(hint)}</small></span>
    </label>`).join('');
    return `<form class="a70-form" data-form="${esc(id)}" novalidate>
      <fieldset class="a70-verdicts"><legend>¿La sanción corresponde a la entidad candidata?</legend>${opts}</fieldset>
      <textarea rows="2" maxlength="2000" data-rationale
        placeholder="Qué se verificó para confirmar o descartar el calce (RUT, razón social, registro UAF, resolución)."></textarea>
      <div class="a70-actions">
        <button type="submit" class="a70-submit">Registrar validación</button>
        <span class="a70-count" data-count>0 caracteres</span>
        <span class="a70-flash" data-flash role="status" aria-live="polite"></span>
      </div>
    </form>`;
  }

  function rowHtml(r){
    const id=r.sanction_id;
    const open=STATE.open===id;
    return `<article class="a70-row${open?' open':''}${r.pending?'':' resolved'}" data-row="${esc(id)}">
      <button type="button" class="a70-summary" data-toggle="${esc(id)}" aria-expanded="${open?'true':'false'}">
        <span class="a70-flags">
          ${r.laft_direct?'<span class="a70-tag laft">LA/FT directo</span>':''}
          ${verdictChip(r)}
        </span>
        <span class="a70-names">
          <strong>${esc(r.sanctioned_name||'Sin nombre en la fuente')}</strong>
          <small>${esc(r.regulator||'—')} · ${esc(fmtDate(r.event_date))}</small>
        </span>
        <span class="a70-arrow" aria-hidden="true">→</span>
        <span class="a70-names">
          <strong>${esc(r.candidate_entity_name||r.candidate_entity_id||'—')}</strong>
          <small>${esc(r.candidate_rut||'RUT no disponible')}${r.candidate_region?` · ${esc(r.candidate_region)}`:''}</small>
        </span>
        <span class="a70-conf">
          <b>${esc(pct(r.confidence))}</b>
          <small>${esc((r.resolution_method||'').replace(/_/g,' ').toLowerCase())}</small>
        </span>
      </button>
      ${open?`<div class="a70-detail">
        <div class="a70-facts">
          <div><span>Materia</span><p>${esc(r.subject||'—')}</p></div>
          <div><span>Entidad candidata</span><p class="mono">${esc(r.candidate_entity_id||'—')}
            ${r.candidate_is_uaf_observed?' · observada en corte UAF':''}</p></div>
        </div>
        ${r.pending?formHtml(id):`<div class="a70-done">
          <strong>${esc(VERDICT_LABEL[r.validation_verdict]||r.validation_verdict)}</strong>
          <p>${esc(r.validation_rationale||'')}</p>
          <small>${esc(fmtDate(r.validated_at))}</small>
        </div>`}
        ${r.candidate_entity_id?`<button type="button" class="a70-open360" data-entity="${esc(r.candidate_entity_id)}">Abrir Entity 360 de la candidata</button>`:''}
      </div>`:''}
    </article>`;
  }

  function render(){
    const el=host();
    if(!el)return;
    if(!STATE.loaded){el.innerHTML='<div class="loading">Cargando cola de validación…</div>';return;}
    if(STATE.error){
      el.innerHTML=`<div class="flash error"><b>No fue posible abrir la cola.</b><br>${esc(STATE.error)}</div>`;
      return;
    }
    const c=counts();
    const rows=visible();
    const chips=[
      ['pending',`Pendientes · ${c.pending}`],
      ['laft',`Con LA/FT directo · ${c.laft}`],
      ['done',`Resueltas · ${c.done}`],
      ['all',`Todas · ${c.all}`]
    ].map(([k,label])=>`<button type="button" class="a70-filter${STATE.filter===k?' on':''}" data-filter="${k}">${esc(label)}</button>`).join('');

    el.innerHTML=`<section class="a70-wrap">
      <div class="a70-intro">
        <p><strong>Qué es esta cola.</strong> El pipeline de identidad resolvió estas sanciones por calce exacto de nombre. El guardrail del sistema impide promoverlas a identidad firme de forma automática, de modo que esperan el juicio de una persona.</p>
        <p class="a70-warn">Confirmar aquí <strong>no</strong> reescribe la identidad en <code>aml_sanctions</code>. Queda registrado como evidencia trazable para un paso gobernado posterior. Confianza y método describen el algoritmo de calce, no riesgo AML.</p>
      </div>
      <div class="a70-filters">${chips}</div>
      ${rows.length
        ? `<div class="a70-list">${rows.slice(0,PAGE).map(rowHtml).join('')}</div>
           ${rows.length>PAGE?`<p class="a70-more">Mostrando ${PAGE} de ${rows.length}. Resuelve las visibles para que aparezcan las siguientes.</p>`:''}`
        : `<div class="empty"><strong>Nada pendiente en este filtro</strong>Cambia de filtro para ver el resto de la cola.</div>`}
    </section>`;
    bind();
  }

  function bind(){
    const el=host();
    if(!el)return;

    el.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
      STATE.filter=b.dataset.filter;STATE.open=null;render();
    }));

    el.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.toggle;
      STATE.open=STATE.open===id?null:id;
      render();
    }));

    el.querySelectorAll('[data-entity]').forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.entity;
      try{
        if(typeof window.openEntity==='function')window.openEntity(id);
        else window.navigate?.('entities');
      }catch(_e){}
    }));

    el.querySelectorAll('.a70-form').forEach(form=>{
      const area=form.querySelector('[data-rationale]');
      const count=form.querySelector('[data-count]');
      const flash=form.querySelector('[data-flash]');
      const button=form.querySelector('.a70-submit');
      const id=form.dataset.form;
      const row=STATE.rows.find(r=>r.sanction_id===id);

      area?.addEventListener('input',()=>{
        const n=area.value.trim().length;
        if(count){
          count.textContent=`${n} caracteres`;
          count.classList.toggle('short',n>0&&n<MIN_RATIONALE);
        }
      });

      form.addEventListener('submit',async event=>{
        event.preventDefault();
        if(!row||!flash||!button)return;
        const verdict=form.querySelector('input[type="radio"]:checked')?.value;
        flash.className='a70-flash';
        flash.textContent='Registrando…';
        button.disabled=true;
        const result=await submit(row,verdict,area?.value??'');
        button.disabled=false;
        if(result.ok){
          // Reflejo local inmediato; la próxima carga lo confirma desde la base.
          row.pending=false;
          row.validation_verdict=verdict;
          row.validation_rationale=String(area?.value??'').trim();
          row.validated_at=new Date().toISOString();
          STATE.open=null;
          render();
        }else{
          flash.className='a70-flash err';
          flash.textContent=result.error;
        }
      });
    });
  }

  /* ---------------- ruta ---------------- */

  async function loadValidation(){
    try{if(typeof state!=='undefined')state.view='validation';}catch(_e){}
    try{
      if(typeof shell==='function')
        shell('Validación de identidad','Sanciones con entidad candidata por calce de nombre, a la espera de juicio humano.');
    }catch(_e){}
    STATE.loaded=false;
    render();
    await load();
    render();
    window.__ATLAS_VALIDATION_QUEUE__={
      active:true,release:RELEASE,build:BUILD,view:QUEUE,
      rows:STATE.rows.length,pending:counts().pending,
      semantic:'CANDIDATE_IDENTITY_STAYS_CANDIDATE_CONFIRMATION_IS_EVIDENCE_NOT_PROMOTION',
      loadedAt:new Date().toISOString()
    };
    try{window.audit?.('VIEW_VALIDATION_QUEUE',{objectType:'queue',objectId:QUEUE,
      payload:{pending:counts().pending,release:RELEASE}});}catch(_e){}
  }

  const priorNavigate=(typeof window.navigate==='function')?window.navigate:null;
  const validationAwareNavigate=async function(view,...rest){
    if(view==='validation')return loadValidation();
    if(priorNavigate)return priorNavigate.call(this,view,...rest);
    return undefined;
  };
  try{navigate=validationAwareNavigate;}catch(_error){}
  window.navigate=validationAwareNavigate;

  window.loadValidation=loadValidation;

  // La barra ya se normalizó cuando corrió el runtime compilado, que aún no
  // veía este módulo. Se pide una renormalización para que aparezca el botón.
  function announce(){try{window.dispatchEvent(new Event('atlas:nav-refresh'));}catch(_e){}}
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',()=>setTimeout(announce,0),{once:true});
  else setTimeout(announce,0);
  for(const delay of [300,1200])setTimeout(announce,delay);

  window.AtlasValidationQueue={
    release:RELEASE,build:BUILD,view:QUEUE,table:TABLE,
    load,render,submit,state:STATE,
    semantic:'CANDIDATE_IDENTITY_STAYS_CANDIDATE_CONFIRMATION_IS_EVIDENCE_NOT_PROMOTION'
  };
})();
