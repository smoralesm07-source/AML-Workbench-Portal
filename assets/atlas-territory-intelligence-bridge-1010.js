'use strict';
/* ATLAS · Territorio · Intelligence Bridge 1.0.0
 * Solo lectura. Reutiliza la sesión Supabase autenticada del portal.
 * Autoridad IGR: public.obs_territory. Prensa: contexto OSINT independiente.
 */
(function atlasTerritoryIntelligenceBridge1010(){
  if(window.AtlasTerritoryIntelligenceBridge)return;
  const VERSION='1.0.0';
  const TERRITORY_VIEW='obs_territory';
  const SO_VIEW='aml_uaf_obligated_commune_sector_summary';
  const PRESS_PRIMARY='https://raw.githubusercontent.com/smoralesm07-source/Monitor/atlas-press-state/atlas_prensa.json';
  const PRESS_FALLBACK='https://raw.githubusercontent.com/smoralesm07-source/Monitor/main/datos.json';
  let territoryCache=null,pressCache=null;
  const subjectCache=new Map();
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);

  async function all({force=false}={}){
    if(territoryCache&&!force)return territoryCache;
    const client=db();
    if(!client)throw new Error('La sesión de datos de ATLAS no está disponible.');
    const {data,error}=await client.from(TERRITORY_VIEW)
      .select('territory_id,region_code,region_name,commune_code,commune_name,year,period,igr_score,igr_level,igr_confidence,layer_weights,layers,interpretation,score_version,ctx_entities,ctx_uaf_observed,ctx_sanctioned,ctx_alerted,ctx_findings,snapshot_id,refreshed_at')
      .order('igr_score',{ascending:false})
      .limit(1000);
    if(error)throw error;
    const rows=(data||[]).map(r=>({
      territory_id:r.territory_id,
      region_code:String(r.region_code||''),
      region_name:String(r.region_name||''),
      commune_code:String(r.commune_code||'').padStart(5,'0'),
      commune_name:String(r.commune_name||''),
      year:Number(r.year||2025),
      period:String(r.period||r.year||''),
      score:n(r.igr_score),
      igr_score:n(r.igr_score),
      level:String(r.igr_level||''),
      confidence:n(r.igr_confidence),
      layer_weights:r.layer_weights&&typeof r.layer_weights==='object'?r.layer_weights:{},
      layers:r.layers&&typeof r.layers==='object'?r.layers:{},
      interpretation:String(r.interpretation||''),
      score_version:String(r.score_version||''),
      ctx_entities:Number(r.ctx_entities||0),
      ctx_uaf_observed:Number(r.ctx_uaf_observed||0),
      ctx_sanctioned:Number(r.ctx_sanctioned||0),
      ctx_alerted:Number(r.ctx_alerted||0),
      ctx_findings:Number(r.ctx_findings||0),
      snapshot_id:String(r.snapshot_id||''),
      refreshed_at:r.refreshed_at||null
    })).filter(r=>r.commune_name&&r.commune_code&&Number.isFinite(r.score));
    territoryCache={rows,source:TERRITORY_VIEW,loadedAt:new Date().toISOString(),snapshotId:rows[0]?.snapshot_id||null,refreshedAt:rows[0]?.refreshed_at||null};
    return territoryCache;
  }

  async function subjects(commune,{force=false}={}){
    const key=norm(commune);
    if(!key)return {total:0,sectorCount:0,sectors:[]};
    if(!force&&subjectCache.has(key))return subjectCache.get(key);
    const client=db();
    if(!client)throw new Error('La sesión de datos de ATLAS no está disponible.');
    const {data,error}=await client.from(SO_VIEW)
      .select('commune,sector,subject_count,commune_key')
      .eq('commune_key',key)
      .order('subject_count',{ascending:false});
    if(error)throw error;
    const sectors=(data||[]).map(r=>({sector:String(r.sector||'Sector no informado'),count:Number(r.subject_count||0)})).filter(r=>r.count>0);
    const payload={commune:String(data?.[0]?.commune||commune),total:sectors.reduce((s,r)=>s+r.count,0),sectorCount:sectors.length,sectors,source:SO_VIEW};
    subjectCache.set(key,payload);return payload;
  }

  function articleFrom(row){
    if(!row||typeof row!=='object')return null;
    return {
      id:String(row.id||row.article_id||row.link||row.url||''),
      date:String(row.date||row.fecha||row.fecha_iso||'').slice(0,10),
      title:String(row.title||row.titulo||'Sin título'),
      media:String(row.media||row.medio||'Medio no informado'),
      url:String(row.url||row.link||''),
      summary:String(row.summary||row.resumen||row.tema||''),
      region:String(row.region||row.region_name||''),
      commune:String(row.commune||row.comuna||row.commune_name||''),
      phenomena:Array.isArray(row.phenomena)?row.phenomena:(Array.isArray(row.fenomenos)?row.fenomenos:[])
    };
  }
  async function fetchJson(url){
    const res=await fetch(`${url}${url.includes('?')?'&':'?'}atlas=${Date.now()}`,{cache:'no-store',credentials:'omit'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const text=await res.text();if(!text.trim())throw new Error('archivo vacío');return JSON.parse(text);
  }
  async function press({force=false}={}){
    if(pressCache&&!force)return pressCache;
    let raw=null,source=null;
    try{raw=await fetchJson(PRESS_PRIMARY);source=PRESS_PRIMARY;}catch(_e){
      try{raw=await fetchJson(PRESS_FALLBACK);source=PRESS_FALLBACK;}catch(_e2){raw={};source=null;}
    }
    let sourceRows=[];
    if(Array.isArray(raw?.articles))sourceRows=raw.articles;
    else if(Array.isArray(raw?.prensa))sourceRows=raw.prensa;
    else if(Array.isArray(raw?.publicaciones))sourceRows=raw.publicaciones;
    const articles=sourceRows.map(articleFrom).filter(Boolean).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    pressCache={articles,source,generatedAt:raw?.generated_at||raw?.generado||null,loadedAt:new Date().toISOString(),semantics:'OSINT_CONTEXT_ONLY_NOT_SCORE_INPUT'};
    return pressCache;
  }
  async function pressFor({commune='',region='',limit=20}={}){
    const payload=await press();
    const cn=norm(commune),rn=norm(region);
    let exact=payload.articles.filter(a=>cn&&norm(a.commune)===cn);
    if(!exact.length&&rn)exact=payload.articles.filter(a=>norm(a.region)===rn);
    return {...payload,articles:exact.slice(0,Math.max(1,limit)),matchLevel:exact.some(a=>cn&&norm(a.commune)===cn)?'COMMUNE':(exact.length?'REGION':'NONE')};
  }

  window.AtlasTerritoryIntelligenceBridge={
    active:true,version:VERSION,territoryView:TERRITORY_VIEW,subjectView:SO_VIEW,
    all,subjects,press,pressFor,
    clear(){territoryCache=null;pressCache=null;subjectCache.clear();},
    installedAt:new Date().toISOString()
  };
})();