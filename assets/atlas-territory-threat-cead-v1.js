'use strict';

/* ATLAS AML · Territory threat CEAD bridge v1
 * Replaces the legacy territorial threat input (70% intensity + 30% positive trend)
 * with Radar_delictual's governed cead_geographic_score_v1 signal.
 * IRG top-level weights remain unchanged: threat contributes 15%.
 */
(function atlasTerritoryThreatCeadV1(){
  const SOURCE_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_delictual/radar-data/data/processed/cead_geographic_score_v1.json';
  const SOURCE_ID='cead_geographic_score_v1';
  const EXPECTED_SCORE_VERSION='1.0.0';
  const baseLoadRaw=window.v022LoadRaw;
  const baseBuildCead=window.v022BuildCead;

  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();

  async function fetchThreat(){
    const response=await fetch(SOURCE_URL,{cache:'no-store'});
    if(!response.ok)throw new Error(`CEAD threat ${response.status}`);
    const rows=await response.json();
    if(!Array.isArray(rows)||!rows.length)throw new Error('CEAD threat sin registros');
    return rows.filter(r=>finite(r?.score));
  }

  if(typeof baseLoadRaw==='function'){
    window.v022LoadRaw=async function atlasLoadRawWithThreat(...args){
      const raw=await baseLoadRaw.apply(this,args);
      if(raw?.__atlasCeadThreatV1Loaded)return raw;
      try{
        raw.ceadThreatV1=await fetchThreat();
        raw.sourceStatus={...(raw.sourceStatus||{}),ceadThreatV1:raw.ceadThreatV1.length>0};
        raw.ceadThreatV1Meta={
          source:SOURCE_ID,
          score_version:raw.ceadThreatV1.find(r=>r?.score_version)?.score_version||EXPECTED_SCORE_VERSION,
          period:raw.ceadThreatV1.find(r=>r?.period)?.period||null,
          fetched_at:new Date().toISOString()
        };
      }catch(error){
        console.warn('ATLAS Territory · CEAD threat v1 fallback',error);
        raw.ceadThreatV1=[];
        raw.sourceStatus={...(raw.sourceStatus||{}),ceadThreatV1:false};
        raw.ceadThreatV1Meta={source:SOURCE_ID,error:String(error?.message||error)};
      }
      raw.__atlasCeadThreatV1Loaded=true;
      return raw;
    };
  }

  function communeThreat(rows,index){
    const out=new Map();
    for(const r of rows){
      const region=typeof window.v022RegionName==='function'?window.v022RegionName(r.region_name):r.region_name;
      if(!region||!finite(r.score))continue;
      let territory=null;
      if(typeof window.v022ResolveCommune==='function')territory=window.v022ResolveCommune(index,region,r.commune_name,r.commune_code);
      const id=territory?.territory_id||r.territory_id;
      if(!id)continue;
      out.set(id,{
        region,
        name:territory?.canonical_name||r.commune_name,
        score:Number(r.score),
        year:Number(r.year)||Number(r.period)||null,
        period:r.period||String(r.year||''),
        score_version:r.score_version||EXPECTED_SCORE_VERSION,
        confidence:finite(r.confidence)?Number(r.confidence):null,
        level:r.level||null,
        threat_source:SOURCE_ID,
        source_method:'direct_commune_score',
        layers:r.layers||null,
        cases:null
      });
    }
    return out;
  }

  function regionThreat(rows){
    const groups=new Map();
    for(const r of rows){
      const region=typeof window.v022RegionName==='function'?window.v022RegionName(r.region_name):r.region_name;
      if(!region||!finite(r.score))continue;
      if(!groups.has(region))groups.set(region,[]);
      groups.get(region).push(r);
    }
    const out=new Map();
    for(const [region,items] of groups){
      let weighted=0,totalWeight=0;
      for(const r of items){
        const confidence=finite(r.confidence)?Math.max(1,Number(r.confidence)):1;
        weighted+=Number(r.score)*confidence;
        totalWeight+=confidence;
      }
      const score=totalWeight>0?weighted/totalWeight:null;
      if(!finite(score))continue;
      const confidences=items.map(r=>Number(r.confidence)).filter(Number.isFinite);
      const confidence=confidences.length?confidences.reduce((a,b)=>a+b,0)/confidences.length:null;
      const years=items.map(r=>Number(r.year)||Number(r.period)).filter(Number.isFinite);
      out.set(region,{
        region,
        name:region,
        score:Number(score),
        year:years.length?Math.max(...years):null,
        period:items.find(r=>r?.period)?.period||null,
        score_version:items.find(r=>r?.score_version)?.score_version||EXPECTED_SCORE_VERSION,
        confidence,
        threat_source:SOURCE_ID,
        source_method:'confidence_weighted_commune_mean',
        communes_observed:items.length,
        cases:null
      });
    }
    return out;
  }

  if(typeof baseBuildCead==='function'){
    window.v022BuildCead=function atlasBuildCeadThreatV1(raw,level,index,economy){
      const rows=Array.isArray(raw?.ceadThreatV1)?raw.ceadThreatV1.filter(r=>finite(r?.score)):[];
      if(!rows.length)return baseBuildCead(raw,level,index,economy);
      return level==='commune'?communeThreat(rows,index):regionThreat(rows);
    };
  }

  function decorateThreatUi(){
    try{
      document.querySelectorAll('.v032-source-strip span').forEach(el=>{
        if(norm(el.textContent)==='CEAD'){
          const meta=window.AML_IRG_TERRITORY?.state?.raw?.ceadThreatV1Meta||{};
          el.textContent=`CEAD Score v1${meta.period?` · ${meta.period}`:''}`;
          el.classList.remove('miss','partial','context');
          el.classList.add(window.AML_IRG_TERRITORY?.state?.raw?.sourceStatus?.ceadThreatV1?'ok':'miss');
        }
      });
      document.querySelectorAll('.v032-components article').forEach(card=>{
        const label=card.querySelector('header span');
        if(norm(label?.textContent)==='AMENAZA TERRITORIAL'){
          const small=card.querySelector('small');
          if(small)small.textContent='CEAD Score v1: 55% delito base directo + 35% economía criminal y facilitadores + 10% contexto criminógeno.';
          card.dataset.ceadThreatVersion='1.0.0';
        }
      });
      document.querySelectorAll('.v032-insights button').forEach(card=>{
        const label=card.querySelector('span');
        if(norm(label?.textContent)==='MAYOR AMENAZA CEAD'){
          const small=card.querySelector('small');
          if(small){
            const value=(small.textContent||'').split('·')[0].trim();
            const period=window.AML_IRG_TERRITORY?.state?.raw?.ceadThreatV1Meta?.period;
            small.textContent=`${value} · CEAD Score v1${period?` · ${period}`:''}`;
          }
        }
      });
      document.querySelectorAll('.v032-comparator table tbody tr').forEach(row=>{
        const cells=row.querySelectorAll('td');
        if(cells.length>=7){
          const small=cells[6].querySelector('small');
          if(small)small.textContent='CEAD v1';
        }
      });
    }catch(error){console.warn('ATLAS Territory · decorate CEAD threat v1',error);}
  }

  function installPostRenderHook(){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts+=1;
      const api=window.AML_IRG_TERRITORY;
      if(api?.state?.raw?.sourceStatus?.ceadThreatV1)decorateThreatUi();
      if(api&&typeof window.v019LoadTerritory==='function'&&!window.v019LoadTerritory.__atlasThreatCeadV1){
        const base=window.v019LoadTerritory;
        const wrapped=async function(...args){const result=await base.apply(this,args);queueMicrotask(decorateThreatUi);return result;};
        wrapped.__atlasThreatCeadV1=true;
        window.v019LoadTerritory=wrapped;
        try{window.loadTerritory=wrapped;}catch{}
      }
      if(attempts>=40||(api&&window.v019LoadTerritory?.__atlasThreatCeadV1))clearInterval(timer);
    },250);
  }

  installPostRenderHook();
  window.ATLAS_TERRITORY_THREAT_CEAD_V1={source:SOURCE_URL,scoreVersion:EXPECTED_SCORE_VERSION,topLevelWeight:0.15,aggregation:'confidence_weighted_commune_mean'};
})();
