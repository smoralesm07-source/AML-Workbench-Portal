'use strict';
/* ATLAS AML · Radar Integrado · IRAR-E primary sector-risk lens 0.96.1
 * Replaces the visible IRAR column/profile-map with IRAR-E while keeping IRAR/ICE
 * as secondary reportability diagnostics in the sector dossier.
 */
(function atlasRadarIrarE0961(){
  if(window.AtlasRadarIrarE0961)return;
  const core=window.ATLAS_IRAR_E_CURRENT;
  if(!core){console.warn('[ATLAS] IRAR-E authority unavailable');return;}
  const VERSION='0.96.1';
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const fmt=(v,d=1)=>finite(v)?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  let dataset=null;

  function help(){
    try{
      V036_HELP.irar_e={t:'IRAR-E · Riesgo inherente sectorial',b:'IRAR-E = 40% vulnerabilidad estructural + 30% materialidad + 30% amenaza LA/FT/FP. Los tres componentes son obligatorios. Un faltante se muestra como “—”: no se imputa cero ni se redistribuyen pesos. IRAR/ICE quedan como diagnóstico separado de reportabilidad.'};
    }catch{}
  }
  function metricFor(row){return core.findMetric(row?.raw?.sector_name||row?.sector_name||row?.name,dataset);}
  function attach(row){
    const m=metricFor(row);row.irarE=m?.score??null;row.irarEVulnerability=m?.vulnerability??null;row.irarEMateriality=m?.materiality??null;row.irarEThreat=m?.threat??null;row.irarEStatus=m?.status||'UNAVAILABLE';row.irarEMissing=m?.missing||['vulnerabilidad','materialidad','amenaza'];
    if(Array.isArray(row.marks))row.marks=row.marks.filter(x=>!String(x).startsWith('perfil_'));
    return row;
  }
  async function ensureData(){
    if(dataset)return dataset;
    const loaded=await core.load();dataset=loaded.dataset;return dataset;
  }
  function cell(row){
    const ready=finite(row?.irarE);
    const title=ready?`IRAR-E|${fmt(row.irarE,1)}/100|V ${fmt(row.irarEVulnerability,0)} · M ${fmt(row.irarEMateriality,0)} · T ${fmt(row.irarEThreat,0)}`:`IRAR-E|No calculable aún|V ${fmt(row?.irarEVulnerability,0)} · M ${fmt(row?.irarEMateriality,0)} · T ${fmt(row?.irarEThreat,0)}. Missing ≠ 0; no se renormalizan pesos.`;
    return `<div class="v036-mxn strong atlas-irar atlas-irar-e ${ready?'ready':'pending'}" data-v036-tip="${typeof esc==='function'?esc(title):title}"><span>${ready?fmt(row.irarE,1):'—'}</span>${ready?'<small>/100</small>':'<small>incompleto</small>'}</div>`;
  }
  function addStatusPanel(){
    const matrix=document.querySelector('.v036-matrix');if(!matrix)return;
    let panel=document.querySelector('#atlas-irar-e-status');
    if(!panel){matrix.insertAdjacentHTML('afterend','<div id="atlas-irar-e-status" class="atlas-irar-e-status"></div>');panel=document.querySelector('#atlas-irar-e-status');}
    const c=dataset?.coverage||{};
    panel.innerHTML=`<div><b>IRAR-E · riesgo inherente sectorial</b><span>Vulnerabilidad ${c.vulnerability_structural??0}/${c.sector_catalog??55} · Materialidad ${c.materiality??0}/${c.sector_catalog??55} · Amenaza ${c.threat_laft_fp??0}/${c.sector_catalog??55}</span></div><p>ATLAS no fabrica un score incompleto: hasta materializar M y T, IRAR-E se muestra como “—”. IRAR e ICE permanecen disponibles sólo como diagnóstico de reportabilidad.</p>`;
  }
  function decorateMatrix(){
    document.querySelector('#atlas-irar-profile-map')?.remove();
    const head=document.querySelector('.v036-mxhead [data-v036-sort="irarAdjusted"],.v036-mxhead [data-v036-sort="irarE"]');
    if(head){head.dataset.v036Sort='irarE';head.innerHTML=`IRAR-E ${typeof v036Help==='function'?v036Help('irar_e'):''}`;head.title='Riesgo inherente sectorial; requiere V + M + T completos.';}
    document.querySelectorAll('.v036-mxrow[data-v036-row]').forEach(btn=>{
      const row=V036_STATE?.rows?.[Number(btn.dataset.v036Row)];if(!row)return;
      const old=btn.querySelector('.atlas-irar');
      if(old)old.outerHTML=cell(row);
    });
    addStatusPanel();
  }
  function hydrateState(){
    if(!dataset||!Array.isArray(V036_STATE?.rows))return;
    V036_STATE.rows.forEach(attach);
  }

  help();
  if(typeof v0193LoadUafData==='function'){
    const base=v0193LoadUafData;
    v0193LoadUafData=async function(...args){
      const [uaf]=await Promise.all([base(...args),ensureData().catch(error=>{console.warn('[ATLAS] IRAR-E snapshot unavailable',error);return null;})]);
      uaf.__atlasIrarE={dataset,status:dataset?'ok':'degraded'};return uaf;
    };
  }
  if(typeof v036PrepareRows==='function'){
    const base=v036PrepareRows;
    v036PrepareRows=function atlasIrarEPrepareRows(uaf){const rows=base(uaf);dataset=uaf?.__atlasIrarE?.dataset||dataset;return rows.map(attach);};
  }
  if(typeof v036Dashboard==='function'){
    const base=v036Dashboard;
    v036Dashboard=function atlasIrarEDashboard(ctx){
      let html=base(ctx);
      html=html.replace(/data-v036-sort="irarAdjusted"/g,'data-v036-sort="irarE"');
      html=html.replace(/>IRAR\s*(<span[^>]*class="v036-help"[\s\S]*?<\/span>)?<\/button>/,`>IRAR-E ${typeof v036Help==='function'?v036Help('irar_e'):''}</button>`);
      html=html.replace('Análisis de reportabilidad · intensidad, rendimiento y evidencia','Reportabilidad y riesgo sectorial · intensidad y exposición inherente');
      html=html.replace('Los filtros gobiernan la matriz; IIR, IRAR e ICE construyen una señal de revisión de reportabilidad. IRAR-E, IGR, IPA e IVO conservan sus dominios propios y no se mezclan en esta posición. Cada sector abre un dossier explicativo en el mismo lugar.','IIR describe intensidad de reportabilidad. IRAR-E ocupa la capa sectorial de riesgo inherente y sólo se calcula con vulnerabilidad, materialidad y amenaza completas. IRAR e ICE quedan como diagnóstico secundario de reportabilidad.');
      return html;
    };
  }
  if(typeof v036RenderMatrix==='function'){
    const base=v036RenderMatrix;
    v036RenderMatrix=function atlasIrarERenderMatrix(){const out=base();hydrateState();decorateMatrix();return out;};
  }
  if(typeof v036Dossier==='function'){
    const base=v036Dossier;
    v036Dossier=function atlasIrarEDossier(row,ctx){
      attach(row);let html=base(row,ctx);
      html=html.replace('Intensidad, rendimiento y evidencia','Diagnóstico de reportabilidad · secundario');
      const ready=finite(row.irarE);
      const block=`<div class="atlas-irar-e-dossier"><h4>IRAR-E · Riesgo inherente sectorial ${typeof v036Help==='function'?v036Help('irar_e'):''}</h4><div class="atlas-irar-e-dossier-grid"><div><span>IRAR-E</span><b>${ready?fmt(row.irarE,1):'—'}</b><small>${ready?'score 0–100':'no calculable con insumos incompletos'}</small></div><div><span>Vulnerabilidad estructural</span><b>${fmt(row.irarEVulnerability,0)}</b><small>5 dimensiones inherentes</small></div><div><span>Materialidad</span><b>${fmt(row.irarEMateriality,0)}</b><small>escala económica sectorial</small></div><div><span>Amenaza LA/FT/FP</span><b>${fmt(row.irarEThreat,0)}</b><small>evidencia sectorial gobernada</small></div></div><p>${ready?'IRAR-E está materializado para este sector.':'ATLAS mantiene el score bloqueado hasta completar Materialidad y Amenaza. Un faltante no equivale a cero y no redistribuye pesos.'}</p></div>`;
      html=html.replace('<div class="atlas-irar-dossier">',`${block}<div class="atlas-irar-dossier">`);
      return html;
    };
  }
  function sync(){ensureData().then(()=>{hydrateState();try{if(typeof v036RenderMatrix==='function'&&document.querySelector('.v036-matrix'))v036RenderMatrix();}catch{decorateMatrix();}}).catch(()=>decorateMatrix());}
  window.addEventListener('atlas:nav-refresh',sync);
  window.AtlasRadarIrarE0961={version:VERSION,refresh:sync,core};
  window.ATLAS_IRAR_E_UI={version:VERSION,primary:'IRAR_E',secondaryReportability:['IRAR','ICE'],profileMap:'RETIRED_FROM_PRIMARY_RADAR',policy:'ALL_COMPONENTS_REQUIRED_MISSING_NOT_ZERO'};
  sync();
})();
