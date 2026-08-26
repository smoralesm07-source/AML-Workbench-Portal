'use strict';

/* ATLAS AML 0.44.9 · Entity 360 / autorización documental SII
 *
 * Semántica deliberada:
 * - La consulta pública SII verifica documentos específicos y puede informar la
 *   fecha de autorización de ese documento.
 * - ATLAS muestra "última autorización documental observada" entre la evidencia
 *   materializada; NO afirma que sea el último timbraje absoluto del contribuyente
 *   cuando la cobertura de documentos es parcial.
 * - Ausencia de observaciones no equivale a ausencia de timbraje.
 * - MISSING_IS_NOT_NO_TIMBRAJE: dato no materializado nunca se interpreta como
 *   inexistencia de timbraje o de documentos autorizados.
 *
 * Seguridad: sólo lectura bajo la sesión/RLS existente. No toca Auth, Entra,
 * refresh tokens ni crea inferencias AML.
 */
(function atlasEntityTaxDocumentAuthorization0449(){
  const RELEASE='0.44.9';
  const BUILD='0449';
  const VIEW='aml_v0449_sii_latest_document_authorization';
  const CACHE=new Map();
  const INFLIGHT=new Map();
  const TTL=5*60*1000;
  const baseRender=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtDate(v){
    if(!v)return'—';
    try{return new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`));}
    catch(_e){return String(v);}
  }
  function ageLabel(v){
    if(!v)return'—';
    const d=new Date(`${String(v).slice(0,10)}T12:00:00`);if(Number.isNaN(d.getTime()))return'—';
    const now=new Date();
    let months=(now.getFullYear()-d.getFullYear())*12+(now.getMonth()-d.getMonth());
    if(now.getDate()<d.getDate())months--;
    months=Math.max(0,months);
    if(months<1){const days=Math.max(0,Math.floor((now-d)/86400000));return `${days} día${days===1?'':'s'}`;}
    if(months<24)return `${months} mes${months===1?'':'es'}`;
    const years=Math.floor(months/12),rem=months%12;
    return `${years} año${years===1?'':'s'}${rem?` · ${rem} mes${rem===1?'':'es'}`:''}`;
  }
  function currentEntity(){return typeof state!=='undefined'?state.selectedEntity:null;}

  async function load(entityId){
    if(!entityId)return{row:null,error:null};
    const hit=CACHE.get(entityId);
    if(hit&&Date.now()-hit.at<TTL)return hit.value;
    if(INFLIGHT.has(entityId))return INFLIGHT.get(entityId);
    const job=(async()=>{
      try{
        const {data,error}=await sb.from(VIEW)
          .select('entity_id,rut,document_type_code,document_type_name,document_number,document_date,authorization_date,authorization_status,observation_kind,source_system,source_url,source_snapshot_id,evidence_id,observed_at,observed_authorized_documents')
          .eq('entity_id',entityId)
          .limit(1);
        if(error)throw error;
        const value={row:Array.isArray(data)?(data[0]||null):(data||null),error:null};
        CACHE.set(entityId,{at:Date.now(),value});
        return value;
      }catch(error){
        const value={row:null,error:String(error?.message||error)};
        CACHE.set(entityId,{at:Date.now(),value});
        return value;
      }
    })().finally(()=>INFLIGHT.delete(entityId));
    INFLIGHT.set(entityId,job);
    return job;
  }

  function card(value){
    const row=value?.row,error=value?.error;
    if(error)return `<article class="a45-card a49-docauth" id="a49-docauth-card">
      <div class="a49-head"><div><span class="a45-eyebrow">SII · AUTORIZACIÓN DOCUMENTAL</span><h3>Última autorización documental observada</h3></div><span class="a49-state gap">NO DISPONIBLE</span></div>
      <div class="a45-gap"><b>Consulta no disponible</b><p>${esc(error)}. La ficha tributaria principal continúa operativa.</p></div>
    </article>`;
    if(!row)return `<article class="a45-card a49-docauth" id="a49-docauth-card">
      <div class="a49-head"><div><span class="a45-eyebrow">SII · AUTORIZACIÓN DOCUMENTAL</span><h3>Última autorización documental observada</h3></div><span class="a49-state neutral">SIN OBSERVACIÓN</span></div>
      <div class="a49-empty"><b>No hay un documento verificado materializado para esta entidad.</b><p>Esto no significa que la entidad no tenga timbrajes o documentos electrónicos autorizados. La consulta pública del SII verifica documentos específicos; ATLAS no inventa un “último timbraje” cuando no existe cobertura completa.</p></div>
    </article>`;
    const doc=[row.document_type_name||row.document_type_code||'Documento tributario',row.document_number?`N° ${row.document_number}`:null].filter(Boolean).join(' · ');
    return `<article class="a45-card a49-docauth" id="a49-docauth-card">
      <div class="a49-head"><div><span class="a45-eyebrow">SII · AUTORIZACIÓN DOCUMENTAL</span><h3>Última autorización documental observada</h3></div><span class="a49-state good">AUTORIZADO</span></div>
      <div class="a49-kpis">
        <div><span>Fecha autorización</span><b>${esc(fmtDate(row.authorization_date))}</b><small>hace ${esc(ageLabel(row.authorization_date))}</small></div>
        <div><span>Documento</span><b>${esc(doc||'—')}</b><small>${row.document_date?`fecha documento ${esc(fmtDate(row.document_date))}`:'fecha del documento no materializada'}</small></div>
        <div><span>Observaciones autorizadas</span><b>${Number(row.observed_authorized_documents||1).toLocaleString('es-CL')}</b><small>documentos verificados disponibles</small></div>
      </div>
      <div class="a49-trace"><span>Fuente <b>${esc(row.source_system||'SII_CVC_VDC')}</b></span><span>Consulta ${esc(fmtDate(String(row.observed_at||'').slice(0,10)))}</span>${row.evidence_id?`<code>${esc(row.evidence_id)}</code>`:''}</div>
      <p class="a45-note"><b>Lectura:</b> corresponde al documento autorizado más reciente entre los documentos efectivamente observados por Radar SII. No equivale necesariamente al último timbraje absoluto del contribuyente.</p>
    </article>`;
  }

  function timelineNotice(value){
    const row=value?.row;if(!row?.authorization_date)return'';
    return `<div class="a49-timeline" id="a49-docauth-timeline"><i></i><div><span>SII · ${esc(fmtDate(row.authorization_date))}</span><b>Autorización documental observada</b><small>${esc(row.document_type_name||row.document_type_code||'Documento')} ${row.document_number?`· N° ${esc(row.document_number)}`:''}</small></div></div>`;
  }

  function decorate(entityId,value){
    if(!entityId||currentEntity()!==entityId)return false;
    const charPanel=document.querySelector('[data-a45-panel="character"]');
    if(charPanel){
      charPanel.querySelector('#a49-docauth-card')?.remove();
      const anchor=charPanel.querySelector('.a45-grid.g12')||charPanel.querySelector('.a45-panel-head');
      if(anchor)anchor.insertAdjacentHTML('afterend',card(value));
    }
    const timeline=document.querySelector('[data-a45-panel="timeline"]');
    if(timeline){
      timeline.querySelector('#a49-docauth-timeline')?.remove();
      const html=timelineNotice(value);
      if(html)(timeline.querySelector('.a45-panel-head')||timeline).insertAdjacentHTML('afterend',html);
    }
    window.__ATLAS_SII_DOCUMENT_AUTHORIZATION__={
      active:true,release:RELEASE,build:BUILD,entityId,hasObservation:!!value?.row,
      semantic:'LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE',
      missingSemantic:'MISSING_IS_NOT_NO_TIMBRAJE',
      authMutation:false,renderedAt:new Date().toISOString()
    };
    return true;
  }

  async function hydrate(entityId){
    if(!entityId)return;
    const value=await load(entityId);
    for(const delay of [0,220,900,2200])setTimeout(()=>decorate(entityId,value),delay);
  }

  if(baseRender){
    const render0449=function(pkg,...args){
      const result=baseRender(pkg,...args);
      const entityId=pkg?.e?.entity_id||currentEntity();
      if(entityId)void hydrate(entityId);
      return result;
    };
    try{v0203RenderEntity=render0449;}catch(_error){}
    window.v0203RenderEntity=render0449;
  }

  window.AtlasSiiDocumentAuthorization={
    release:RELEASE,build:BUILD,view:VIEW,load,decorate,
    semantic:'LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE',
    missingSemantic:'MISSING_IS_NOT_NO_TIMBRAJE'
  };
})();
