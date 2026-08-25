'use strict';
(function atlasUniversoSO0620(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0620__={active:false,reason:'obligated-core-unavailable'};return;}
  const OBL='aml_v_uaf_reporting_obligation_0620';
  const BEH='aml_v_uaf_entity_reporting_behavior_0620';
  const INT='aml_v_uaf_reporting_integrity_0620';
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const esc=core.esc,fmt=core.fmt,day=core.day;
  let integrity=null;

  const yes=v=>v===true?'Sí':v===false?'No':'—';
  const pct=v=>v==null?'—':`${fmt(Number(v)*100,0)}%`;

  async function getIntegrity(){
    if(integrity)return integrity;
    const client=db();if(!client)return null;
    const {data,error}=await client.from(INT).select('*').maybeSingle();
    if(error)return null;
    integrity=data||null;return integrity;
  }

  async function patchPanorama(){
    const root=document.querySelector('.so-root');
    if(!root||core.state?.mode!=='panorama'||root.querySelector('.uso62-reporting-integrity'))return;
    const x=await getIntegrity();if(!x||!document.contains(root))return;
    const anchor=root.querySelector('.uso61-truth')||root.querySelector('.so-modes');
    if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',`<section class="uso60-card uso62-reporting-integrity">
      <h2>Cobertura de reglas de reportabilidad</h2>
      <p>La taxonomía se resuelve por correspondencia exacta o alias gobernado. No se fuerza una regla cuando la equivalencia no está acreditada.</p>
      <div class="uso60-sourcegrid">
        <div class="uso60-source ok"><i></i><b>${fmt(x.mapped_reporting_rule)}</b><small>SO con regla ROS/ROE mapeada</small></div>
        <div class="uso60-source ok"><i></i><b>${fmt(x.mapped_by_governed_alias)}</b><small>Resueltos mediante alias gobernado</small></div>
        <div class="uso60-source ${Number(x.pending_reporting_rule)?'gap':'ok'}"><i></i><b>${fmt(x.pending_reporting_rule)}</b><small>SO pendientes de regla sectorial acreditada</small></div>
        <div class="uso60-source ${Number(x.behavior_entities)?'ok':'gap'}"><i></i><b>${fmt(x.behavior_entities)}</b><small>SO con comportamiento ROS/ROE materializado</small></div>
      </div>
      <details class="uso60-method"><summary>Contrato metodológico</summary><p>La ausencia de observaciones de comportamiento no se interpreta como cero reportes. Hasta cargar una fuente por RUT, el estado es <b>no materializado</b>.</p></details>
    </section>`);
  }

  function lens(o,b){
    const mapped=o?.reporting_rule_mapped===true;
    const observed=b?.behavior_source_state==='OBSERVED';
    return `<section class="uso60-lens uso62-reporting">
      <h3>Reportabilidad UAF · obligación y comportamiento</h3>
      <p>Separa lo que la entidad <b>debe reportar</b> de lo que Atlas <b>observa efectivamente</b>. Nunca se imputa incumplimiento desde una brecha de datos.</p>
      <div class="uso60-dual">
        <div>
          <h4>Obligación normativa</h4>
          <div class="uso60-facts">
            <div class="uso60-fact"><span>ROS requerido</span><b>${esc(yes(o?.ros_required))}</b></div>
            <div class="uso60-fact"><span>ROE requerido</span><b>${esc(yes(o?.roe_required))}</b></div>
            <div class="uso60-fact"><span>Frecuencia ROE</span><b>${esc(o?.roe_frequency||'—')}</b></div>
            <div class="uso60-fact"><span>Umbral ROE USD</span><b>${o?.roe_threshold_usd==null?'—':esc(fmt(o.roe_threshold_usd))}</b></div>
            <div class="uso60-fact"><span>Regla</span><b>${mapped?'Mapeada':'Pendiente'}</b></div>
            <div class="uso60-fact"><span>Método</span><b>${esc(o?.rule_match_method||'—')}</b></div>
          </div>
        </div>
        <div>
          <h4>Comportamiento observado</h4>
          ${observed?`<div class="uso60-facts">
            <div class="uso60-fact"><span>ROS últimos 12 meses</span><b>${fmt(b.ros_12m)}</b></div>
            <div class="uso60-fact"><span>ROE últimos 12 meses</span><b>${fmt(b.roe_12m)}</b></div>
            <div class="uso60-fact"><span>Operaciones ROE 12m</span><b>${fmt(b.roe_operations_12m)}</b></div>
            <div class="uso60-fact"><span>Percentil ROS sector</span><b>${pct(b.ros_12m_sector_percentile)}</b></div>
            <div class="uso60-fact"><span>Percentil ROE sector</span><b>${pct(b.roe_12m_sector_percentile)}</b></div>
            <div class="uso60-fact"><span>Último período</span><b>${esc(day(b.last_period_end))}</b></div>
          </div>`:`<div class="uso60-source gap"><i></i><b>No materializado</b><small>Atlas aún no dispone de una fuente ROS/ROE por RUT cargada en esta capa. Esto no significa cero reportes.</small></div>`}
        </div>
      </div>
      <details class="uso60-method"><summary>Cómo leer esta lente</summary><p>Las comparaciones contra pares sólo aparecen cuando existe una observación real por entidad. Una regla sectorial mapeada no prueba conducta; una fuente de comportamiento ausente no prueba incumplimiento.</p></details>
    </section>`;
  }

  async function patchDossier(){
    const host=document.querySelector('#so-dossier');
    const rut=core.state?.dossier?.rut;
    if(!host||!rut||host.querySelector('.uso62-reporting'))return;
    const client=db();if(!client)return;
    const [{data:o,error:eo},{data:b,error:eb}]=await Promise.all([
      client.from(OBL).select('*').eq('rut',rut).maybeSingle(),
      client.from(BEH).select('*').eq('rut',rut).maybeSingle()
    ]);
    if(eo||eb||!document.contains(host))return;
    host.querySelector('.uso61-reporting')?.remove();
    const target=host.querySelector('.uso60-dossier360')||host;
    target.insertAdjacentHTML('beforeend',lens(o||null,b||null));
  }

  async function patch(){try{await patchPanorama();await patchDossier();}catch(_e){}}
  const obs=new MutationObserver(()=>patch());
  const start=()=>{const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});patch();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0620__={active:true,version:'0.62.0',views:[OBL,BEH,INT],zeroIsNotMissing:true};
})();
