'use strict';
/* ATLAS AML · ICR sectorial + alineación metodológica de matriz de reportabilidad. */
(function(){
  const ICR_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_UAF/main/docs/data/ros_conversion_sector_2021_2025.json';
  let conversionPromise=null;

  function norm(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/N[°º]/g,'N').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim()
      .replace('ADMINISTRADORAS DE FONDOS DE PENSIONES','ADMINISTRADORES DE FONDOS DE PENSIONES')
      .replace('EMPRESAS DE DEPOSITOS DE VALORES','EMPRESAS DE DEPOSITO DE VALORES')
      .replace(' O CUALQUIER OTRO SISTEMA SIMILAR A LOS REFERIDOS MEDIOS DE PAGO',' U OTRO SIMILAR');
  }
  async function loadConversion(){
    if(conversionPromise)return conversionPromise;
    conversionPromise=fetch(ICR_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`ICR UAF ${r.status}`);return r.json();});
    try{return await conversionPromise;}catch(e){conversionPromise=null;throw e;}
  }
  function buildMap(data){
    const m=new Map();
    for(const r of Array.isArray(data?.sectors)?data.sectors:[])m.set(norm(r.sector_name),r);
    return m;
  }
  function findConversion(row,map){
    const key=norm(row?.sector_name||row?.name);
    if(map.has(key))return map.get(key);
    for(const [k,v] of map){if(k===key||k.includes(key)||key.includes(k))return v;}
    return null;
  }

  try{
    V036_HELP.icr={
      t:'ICR · Índice de Convertibilidad de ROS',
      b:'Mide qué proporción del flujo sectorial de ROS terminó, tras el análisis de la UAF, en ROS con indicios de LA/FT. Se calcula para 2021–2025 como promedio anual de ROS con indicios dividido por promedio anual de ROS enviados a la UAF × 100. Como ambos promedios cubren los mismos cinco años, equivale a total con indicios / total enviado × 100. Es una tasa histórica agregada: no mide la calidad de un ROS individual, riesgo LA/FT ni cumplimiento de un sujeto obligado.'
    };
  }catch{}

  if(typeof v0193LoadUafData==='function'){
    const baseLoad=v0193LoadUafData;
    v0193LoadUafData=async function(...args){
      const uaf=await baseLoad(...args);
      if(!uaf.__atlasIcr){
        try{
          const data=await loadConversion();
          uaf.__atlasIcr={data,map:buildMap(data),status:'ok'};
        }catch(error){
          uaf.__atlasIcr={data:null,map:new Map(),status:'degraded',error:String(error?.message||error)};
          console.warn('[ATLAS] ICR sectorial no disponible',error);
        }
      }
      return uaf;
    };
  }

  if(typeof v036PrepareRows==='function'){
    const basePrepare=v036PrepareRows;
    v036PrepareRows=function(uaf){
      const rows=basePrepare(uaf),map=uaf?.__atlasIcr?.map||new Map();
      for(const row of rows){
        const c=findConversion(row.raw||row,map);
        const sentTotal=Number(row.total)||0;
        const indicationsTotal=Number(c?.ros_con_indicios_total_2021_2025);
        row.rosSentAvg=sentTotal/5;
        row.rosIndicationsTotal=Number.isFinite(indicationsTotal)?indicationsTotal:null;
        row.rosIndicationsAvg=Number.isFinite(indicationsTotal)?indicationsTotal/5:null;
        row.icr=sentTotal>0&&Number.isFinite(indicationsTotal)?100*indicationsTotal/sentTotal:null;
      }
      return rows;
    };
  }

  if(typeof v036Dashboard==='function'){
    const baseDashboard=v036Dashboard;
    v036Dashboard=function(ctx){
      let html=baseDashboard(ctx);
      if(!html.includes('data-v036-sort="icr"')){
        html=html.replace(/(<button data-v036-sort="iir"[^>]*>.*?<\/button>)/,`$1<button data-v036-sort="icr">ICR ${typeof v036Help==='function'?v036Help('icr'):''}</button>`);
      }
      return html;
    };
  }

  function icrCell(row){
    const valid=Number.isFinite(Number(row?.icr));
    if(!valid)return '<div class="v036-mxn strong atlas-icr" data-v036-tip="ICR · Convertibilidad ROS|Sin base|No existen ROS enviados en 2021–2025 o no hay correspondencia sectorial disponible.">—</div>';
    const pct=Number(row.icr);
    const a=Number(row.rosIndicationsAvg)||0,b=Number(row.rosSentAvg)||0;
    return `<div class="v036-mxn strong atlas-icr" data-v036-tip="ICR · Convertibilidad ROS|${v036F(pct,2)}%|Promedio anual: ${v036F(a,2)} ROS con indicios / ${v036F(b,2)} ROS enviados">${v036F(pct,2)}%</div>`;
  }

  if(typeof v036RenderMatrix==='function'){
    const baseRender=v036RenderMatrix;
    v036RenderMatrix=function(){
      const result=baseRender();
      document.querySelectorAll('.v036-mxrow[data-v036-row]').forEach(btn=>{
        if(btn.querySelector('.atlas-icr'))return;
        const row=V036_STATE?.rows?.[Number(btn.dataset.v036Row)];
        const iir=btn.children[4];
        if(iir)iir.insertAdjacentHTML('afterend',icrCell(row));
      });
      return result;
    };
  }

  window.ATLAS_ICR={
    acronym:'ICR',
    name:'Índice de Convertibilidad de ROS',
    period:'2021-2025',
    formula:'avg(ROS con indicios LA/FT) / avg(ROS enviados UAF) * 100',
    source:ICR_URL,
    guardrail:'SECTOR_HISTORICAL_AGGREGATE_NOT_RISK_NOT_INDIVIDUAL_QUALITY'
  };
})();
