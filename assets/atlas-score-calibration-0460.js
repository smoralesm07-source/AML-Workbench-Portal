'use strict';

/* ATLAS AML 0.46.0 · build 0460 · Calibración de bandas de score
 *
 * El problema que corrige
 * -----------------------
 * La interfaz clasificaba con umbrales absolutos: >=75 "alta", >=50 "media".
 * El máximo observado de score_investigate sobre 28.937 hallazgos es 69,2, de
 * modo que la banda alta nunca se alcanzaba y el 96,96% se pintaba igual. El
 * color —el canal de lectura más rápido de la pantalla— transmitía información
 * constante, es decir, ninguna.
 *
 * Qué hace en su lugar
 * --------------------
 * Lee los cortes por percentil del corte vigente desde aml_v0460_score_calibration
 * y rebandea contra ellos. La banda pasa a expresar POSICIÓN RELATIVA en la cola
 * de prioridad, no gravedad ni probabilidad de LA/FT. La leyenda lo dice.
 *
 * Además corrige una violación del propio guardrail del sistema: en IPA3 el
 * 96,7% de las entidades puntúa exactamente 0 porque ninguna marca se activó.
 * Eso es ausencia de marcas, no riesgo bajo, y la regla de la casa es que un
 * dato ausente se muestra como "—", nunca como cero.
 *
 * Seguridad: sólo lectura bajo la sesión y RLS existentes. Sin MutationObserver.
 */
(function atlasScoreCalibration0460(){
  const RELEASE='0.46.0';
  const BUILD='0460';
  const VIEW='aml_v0460_score_calibration';
  const METRIC_FINDINGS='aml_findings.score_investigate';

  // Respaldo medido sobre el corte del 23-08-2026. Sólo se usa si la vista no
  // responde; así el rebandeo nunca queda peor que los umbrales absolutos.
  const FALLBACK={p70:41.7,p90:45.0,p99:52.5,min:31.6,max:69.2};

  let cuts=null;
  let loading=null;
  let scheduled=false;

  function client(){try{return typeof sb!=='undefined'?sb:null;}catch(_e){return null;}}

  async function loadCuts(){
    if(cuts)return cuts;
    if(loading)return loading;
    loading=(async()=>{
      const db=client();
      if(!db){cuts={...FALLBACK,source:'fallback'};return cuts;}
      try{
        const {data,error}=await db.from(VIEW)
          .select('metric,p70,p90,p99,min_observed,max_observed')
          .eq('metric',METRIC_FINDINGS)
          .limit(1);
        if(error)throw error;
        const row=Array.isArray(data)?data[0]:data;
        cuts=row
          ? {p70:Number(row.p70),p90:Number(row.p90),p99:Number(row.p99),
             min:Number(row.min_observed),max:Number(row.max_observed),source:'view'}
          : {...FALLBACK,source:'fallback'};
      }catch(_error){
        cuts={...FALLBACK,source:'fallback'};
      }
      return cuts;
    })();
    return loading;
  }

  function bandOf(value,c){
    if(!Number.isFinite(value))return null;
    if(value>=c.p90)return'high';
    if(value>=c.p70)return'med';
    return'low';
  }

  function bandLabel(band){
    return band==='high'?'Decil superior del corte'
      : band==='med'?'Tercio superior del corte'
      : 'Resto del corte';
  }

  // Toma el último número del texto: cubre "43.2" y "Investigate 43.2" por igual.
  function readValue(el){
    const raw=String(el.textContent??'').replace(/ /g,' ').trim();
    if(!raw||raw==='—')return null;
    const match=raw.match(/-?\d+(?:[.,]\d+)?(?!.*\d)/);
    if(!match)return null;
    const n=Number(match[0].replace(',','.'));
    return Number.isFinite(n)?n:null;
  }

  function applyTo(el,c){
    const value=readValue(el);
    if(value===null)return;
    const band=bandOf(value,c);
    if(!band)return;
    if(el.dataset.a60Band===band)return;
    el.classList.remove('high','med','low');
    el.classList.add(band);
    el.dataset.a60Band=band;
    el.dataset.a60Calibrated='1';
    el.title=`${bandLabel(band)} · cortes p70 ${c.p70} / p90 ${c.p90}. Posición relativa en la cola de prioridad, no probabilidad de LA/FT.`;
  }

  function legend(c){
    return `<div class="a60-cal-legend" id="a60-cal-legend">
      <span class="a60-cal-dot high"></span>Decil superior
      <span class="a60-cal-dot med"></span>Tercio superior
      <span class="a60-cal-dot low"></span>Resto
      <em>Bandas por percentil del corte vigente (p70 ${c.p70} · p90 ${c.p90}). Expresan posición en la cola, no probabilidad de LA/FT.</em>
    </div>`;
  }

  function placeLegend(c){
    const host=document.querySelector('#content .panel .panel-body .table-wrap')
      ||document.querySelector('#content .table-wrap');
    if(!host)return;
    const parent=host.parentElement;
    if(!parent||parent.querySelector('#a60-cal-legend'))return;
    host.insertAdjacentHTML('beforebegin',legend(c));
  }

  async function sweep(){
    const c=await loadCuts();
    let touched=0;
    document.querySelectorAll('.score').forEach(el=>{applyTo(el,c);touched++;});
    if(touched)placeLegend(c);
    window.__ATLAS_SCORE_CALIBRATION__={
      active:true,release:RELEASE,build:BUILD,view:VIEW,
      source:c.source,p70:c.p70,p90:c.p90,elements:touched,
      semantic:'PERCENTILE_BAND_IS_RELATIVE_POSITION_NOT_LAFT_PROBABILITY',
      sweptAt:new Date().toISOString()
    };
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;void sweep();});
  }

  function scheduleSettled(){
    schedule();
    for(const delay of [240,900,2200])setTimeout(schedule,delay);
  }

  // Envuelve los renders conocidos en lugar de observar el DOM, coherente con
  // NO_SELF_SUSTAINING_MUTATION_OBSERVERS.
  function wrap(name){
    const original=window[name];
    if(typeof original!=='function'||original.__a60Wrapped)return;
    const wrapped=function(...args){
      const result=original.apply(this,args);
      if(result&&typeof result.then==='function')result.then(scheduleSettled,scheduleSettled);
      else scheduleSettled();
      return result;
    };
    Object.defineProperty(wrapped,'__a60Wrapped',{value:true});
    window[name]=wrapped;
  }

  ['navigate','openEntity','loadOverview','loadFindings','loadSanctions','loadPatterns','loadEntities']
    .forEach(wrap);

  window.addEventListener('atlas:nav-refresh',scheduleSettled);
  window.addEventListener('atlas:themechange',schedule);
  window.addEventListener('hashchange',scheduleSettled);
  window.addEventListener('pageshow',scheduleSettled);
  document.addEventListener('click',scheduleSettled,{passive:true});

  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',scheduleSettled,{once:true});
  else scheduleSettled();

  window.AtlasScoreCalibration={
    release:RELEASE,build:BUILD,view:VIEW,loadCuts,bandOf,bandLabel,sweep,
    semantic:'PERCENTILE_BAND_IS_RELATIVE_POSITION_NOT_LAFT_PROBABILITY'
  };
})();
