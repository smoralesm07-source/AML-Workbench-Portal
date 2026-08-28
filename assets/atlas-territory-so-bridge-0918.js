'use strict';
/* ATLAS · Territorio · cobertura registral SO 0.91.8
 * Puente de solo lectura entre el workspace territorial y la sesión Supabase
 * ya autenticada de ATLAS. No consume ni expone scores de riesgo.
 */
(function atlasTerritorySoBridge0918(){
  if(window.AtlasTerritorySOBridge)return;
  const VIEW='aml_uaf_obligated_commune_sector_summary';
  const cache=new Map();
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();

  async function commune(value,{force=false}={}){
    const key=norm(value);
    if(!key)throw new Error('Comuna no informada.');
    if(!force&&cache.has(key))return cache.get(key);
    const client=db();
    if(!client)throw new Error('La sesión de datos de ATLAS no está disponible.');
    const {data,error}=await client.from(VIEW)
      .select('commune,sector,subject_count,commune_key')
      .eq('commune_key',key)
      .order('subject_count',{ascending:false});
    if(error)throw error;
    const rows=(data||[]).map(r=>({
      commune:String(r.commune||value),
      sector:String(r.sector||'Sector no informado'),
      count:Number(r.subject_count||0)
    })).filter(r=>Number.isFinite(r.count)&&r.count>0);
    const total=rows.reduce((sum,r)=>sum+r.count,0);
    const sectors=rows.map(r=>({sector:r.sector,count:r.count}));
    const payload={
      commune:rows[0]?.commune||String(value||''),
      total,
      sectorCount:sectors.length,
      sectors,
      source:'Padrón UAF · aml_uaf_obligated_subject_snapshot',
      semantics:'REGISTRY_COVERAGE_ONLY_NO_RISK_CHARACTERIZATION',
      loadedAt:new Date().toISOString()
    };
    cache.set(key,payload);
    return payload;
  }

  window.AtlasTerritorySOBridge={
    active:true,
    version:'0.91.8',
    view:VIEW,
    commune,
    clear:()=>cache.clear(),
    installedAt:new Date().toISOString()
  };
})();