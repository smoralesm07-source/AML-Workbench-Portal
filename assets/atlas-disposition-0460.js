'use strict';

/* ATLAS AML 0.46.0 · build 0460 · Captura de desenlace del analista
 *
 * Cierra el ciclo de aprendizaje. Hasta 0.45.0 la bitácora registraba qué se
 * miró (SESSION_START, OPEN_ENTITY, SEARCH) pero nunca qué se concluyó, de modo
 * que no existía etiqueta con la cual calibrar el score ni defenderlo.
 *
 * Semántica deliberada:
 * - Una disposición es un juicio analítico trazable. NO es un ROS, NO es una
 *   denuncia y NO es una decisión institucional. La interfaz lo dice explícito.
 * - El registro es de sólo anexado. Rectificar es anexar, nunca sobrescribir:
 *   el historial completo queda visible.
 * - La justificación es obligatoria. Una etiqueta sin razón no calibra nada.
 * - Se guarda el score y las marcas que el analista tenía a la vista, sin lo
 *   cual la etiqueta no sería reproducible.
 *
 * Seguridad: escribe sólo a nombre propio bajo la sesión y RLS existentes.
 * No toca Auth, Entra ni refresh tokens. Sin MutationObserver.
 */
(function atlasAnalystDisposition0460(){
  const RELEASE='0.46.0';
  const BUILD='0460';
  const TABLE='aml_disposition';
  const VIEW='aml_v0460_entity_disposition_current';
  const MIN_RATIONALE=20;
  const CACHE=new Map();
  const TTL=2*60*1000;

  const VERDICTS=[
    ['RELEVANTE','Relevante','Amerita profundizar o escalar.'],
    ['NO_RELEVANTE','No relevante','Revisado y descartado, con razón registrada.'],
    ['REQUIERE_MAS_INFORMACION','Falta información','No decidible con la evidencia disponible.']
  ];
  const VERDICT_LABEL=Object.fromEntries(VERDICTS.map(v=>[v[0],v[1]]));

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function client(){try{return typeof sb!=='undefined'?sb:null;}catch(_e){return null;}}
  function currentEntity(){try{return typeof state!=='undefined'?state.selectedEntity:null;}catch(_e){return null;}}
  function fmtDateTime(v){
    if(!v)return'—';
    try{return new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}
    catch(_e){return String(v);}
  }

  /* ---------------- lectura ---------------- */

  async function loadHistory(entityId){
    const db=client();
    if(!db||!entityId)return{rows:[],error:null};
    const hit=CACHE.get(entityId);
    if(hit&&Date.now()-hit.at<TTL)return hit.value;
    try{
      const {data,error}=await db.from(TABLE)
        .select('disposition_id,entity_id,verdict,rationale,score_at_decision,snapshot_id,created_at')
        .eq('entity_id',entityId)
        .order('created_at',{ascending:false})
        .limit(20);
      if(error)throw error;
      const value={rows:Array.isArray(data)?data:[],error:null};
      CACHE.set(entityId,{at:Date.now(),value});
      return value;
    }catch(error){
      return {rows:[],error:String(error?.message||error)};
    }
  }

  /* ---------------- contexto de decisión ---------------- */

  // Sin esto la etiqueta no es reproducible: no se sabría contra qué evidencia
  // se emitió el juicio ni qué score veía el analista en ese corte.
  function decisionContext(pkg){
    const findings=Array.isArray(pkg?.findings)?pkg.findings:[];
    const scores=findings.map(f=>Number(f?.score_investigate)).filter(Number.isFinite);
    return {
      marks:findings.slice(0,40).map(f=>({
        finding_key:f?.finding_key??null,
        finding_type:f?.finding_type??null,
        score_investigate:Number.isFinite(Number(f?.score_investigate))?Number(f.score_investigate):null
      })),
      score:scores.length?Math.max(...scores):null,
      snapshot:pkg?.e?.snapshot_id??findings.find(f=>f?.snapshot_id)?.snapshot_id??null
    };
  }

  /* ---------------- escritura ---------------- */

  async function submit(entityId,verdict,rationale,context){
    const db=client();
    if(!db)return{ok:false,error:'Cliente de datos no disponible.'};
    const clean=String(rationale??'').trim();
    if(!VERDICT_LABEL[verdict])return{ok:false,error:'Selecciona un desenlace.'};
    if(clean.length<MIN_RATIONALE)
      return{ok:false,error:`La justificación necesita al menos ${MIN_RATIONALE} caracteres (van ${clean.length}).`};

    let userId=null;
    try{userId=(await db.auth.getUser())?.data?.user?.id??null;}catch(_e){}
    if(!userId){try{userId=typeof state!=='undefined'?state.user?.id??null:null;}catch(_e){}}
    if(!userId)return{ok:false,error:'No fue posible identificar la sesión.'};

    try{
      const {error}=await db.from(TABLE).insert({
        entity_id:entityId,
        user_id:userId,
        verdict,
        rationale:clean,
        marks_in_view:context?.marks??[],
        score_at_decision:context?.score??null,
        score_model:'score_investigate/max',
        snapshot_id:context?.snapshot??null,
        release:RELEASE
      });
      if(error)throw error;
      CACHE.delete(entityId);
      try{
        window.audit?.('DISPOSITION',{
          objectType:'entity',objectId:entityId,
          payload:{verdict,rationale_length:clean.length,score_at_decision:context?.score??null,release:RELEASE}
        });
      }catch(_e){}
      return {ok:true,error:null};
    }catch(error){
      return {ok:false,error:String(error?.message||error)};
    }
  }

  /* ---------------- presentación ---------------- */

  function statusChip(rows){
    if(!rows.length)return '<span class="a60-chip pend">Sin desenlace registrado</span>';
    const v=rows[0].verdict;
    const cls=v==='RELEVANTE'?'rel':v==='NO_RELEVANTE'?'no':'inc';
    return `<span class="a60-chip ${cls}">${esc(VERDICT_LABEL[v]||v)}</span>`;
  }

  function historyHtml(rows){
    if(!rows.length)return '';
    const items=rows.map((r,i)=>`<li class="a60-hist-item${i===0?' current':''}">
      <div class="a60-hist-top">
        <strong>${esc(VERDICT_LABEL[r.verdict]||r.verdict)}</strong>
        <span>${esc(fmtDateTime(r.created_at))}</span>
        ${i===0?'<em>vigente</em>':'<em class="sup">superada</em>'}
      </div>
      <p>${esc(r.rationale)}</p>
      <small>Score a la vista: ${r.score_at_decision==null?'—':esc(r.score_at_decision)}${r.snapshot_id?` · corte ${esc(r.snapshot_id)}`:''}</small>
    </li>`).join('');
    return `<div class="a60-hist"><h5>Historial de desenlaces · ${rows.length}</h5><ol>${items}</ol></div>`;
  }

  function formHtml(){
    const opts=VERDICTS.map(([value,label,hint])=>`<label class="a60-opt">
      <input type="radio" name="a60-verdict" value="${esc(value)}" />
      <span><strong>${esc(label)}</strong><small>${esc(hint)}</small></span>
    </label>`).join('');
    return `<form class="a60-form" id="a60-form" novalidate>
      <fieldset class="a60-verdicts"><legend>Desenlace del análisis</legend>${opts}</fieldset>
      <label class="a60-label" for="a60-rationale">Justificación <span>obligatoria, mínimo ${MIN_RATIONALE} caracteres</span></label>
      <textarea id="a60-rationale" rows="3" maxlength="2000"
        placeholder="Qué se revisó, qué evidencia se consideró y por qué se concluye esto."></textarea>
      <div class="a60-actions">
        <button type="submit" class="a60-submit">Registrar desenlace</button>
        <span class="a60-count" id="a60-count">0 caracteres</span>
      </div>
      <p class="a60-flash" id="a60-flash" role="status" aria-live="polite"></p>
    </form>`;
  }

  function card(entityId,value){
    const rows=value?.rows??[];
    const err=value?.error
      ? `<p class="a60-error">No fue posible leer el historial: ${esc(value.error)}</p>` : '';
    return `<section class="a60-card" id="a60-disposition" data-entity="${esc(entityId)}">
      <div class="a60-head">
        <div>
          <h4>Desenlace del analista</h4>
          <p class="a60-sem">Juicio analítico trazable. No constituye ROS, denuncia ni decisión institucional.</p>
        </div>
        ${statusChip(rows)}
      </div>
      ${err}
      ${formHtml()}
      ${historyHtml(rows)}
      <p class="a60-note">El registro es de sólo anexado: rectificar agrega un desenlace nuevo y conserva el anterior.</p>
    </section>`;
  }

  /* ---------------- montaje ---------------- */

  function bind(entityId,context){
    const form=document.querySelector('#a60-form');
    if(!form||form.dataset.bound==='1')return;
    form.dataset.bound='1';
    const area=form.querySelector('#a60-rationale');
    const count=form.querySelector('#a60-count');
    const flash=form.querySelector('#a60-flash');
    const button=form.querySelector('.a60-submit');

    area?.addEventListener('input',()=>{
      const n=area.value.trim().length;
      if(count){
        count.textContent=`${n} caracteres`;
        count.classList.toggle('short',n>0&&n<MIN_RATIONALE);
      }
    });

    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!flash||!button)return;
      const verdict=form.querySelector('input[name="a60-verdict"]:checked')?.value;
      flash.className='a60-flash';
      flash.textContent='Registrando…';
      button.disabled=true;
      const result=await submit(entityId,verdict,area?.value??'',context);
      button.disabled=false;
      if(result.ok){
        flash.className='a60-flash ok';
        flash.textContent='Desenlace registrado.';
        CACHE.delete(entityId);
        const fresh=await loadHistory(entityId);
        decorate(entityId,fresh,context);
      }else{
        flash.className='a60-flash err';
        flash.textContent=result.error;
      }
    });
  }

  function decorate(entityId,value,context){
    if(!entityId||currentEntity()!==entityId)return false;
    const panel=document.querySelector('[data-a45-panel="evidence"]');
    if(!panel)return false;
    panel.querySelector('#a60-disposition')?.remove();
    const anchor=panel.querySelector('.a45-panel-head')||panel;
    anchor.insertAdjacentHTML('afterend',card(entityId,value));
    bind(entityId,context);
    window.__ATLAS_DISPOSITION__={
      active:true,release:RELEASE,build:BUILD,entityId,
      recorded:(value?.rows??[]).length,
      semantic:'ANALYTICAL_DISPOSITION_AUDIT_ONLY_NOT_ROS_NOT_DENUNCIA',
      appendOnly:true,authMutation:false,renderedAt:new Date().toISOString()
    };
    return true;
  }

  async function hydrate(entityId,context){
    if(!entityId)return;
    const value=await loadHistory(entityId);
    for(const delay of [0,240,900,2200])setTimeout(()=>decorate(entityId,value,context),delay);
  }

  const baseRender=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(baseRender){
    const render0460=function(pkg,...args){
      const result=baseRender(pkg,...args);
      const entityId=pkg?.e?.entity_id||currentEntity();
      if(entityId)void hydrate(entityId,decisionContext(pkg));
      return result;
    };
    try{v0203RenderEntity=render0460;}catch(_error){}
    window.v0203RenderEntity=render0460;
  }

  window.AtlasDisposition={
    release:RELEASE,build:BUILD,table:TABLE,view:VIEW,
    loadHistory,submit,decorate,
    semantic:'ANALYTICAL_DISPOSITION_AUDIT_ONLY_NOT_ROS_NOT_DENUNCIA'
  };
})();
