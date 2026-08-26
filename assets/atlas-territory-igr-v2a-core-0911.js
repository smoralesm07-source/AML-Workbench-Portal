const GEOJSON='https://raw.githubusercontent.com/fcortes/Chile-GeoJSON/refs/heads/master/comunas.geojson';
const CEAD='https://raw.githubusercontent.com/smoralesm07-source/Radar_delictual/radar-data/data/processed/cead_geographic_score_v1.json';
const CEAD_HISTORY='https://raw.githubusercontent.com/bastianolea/delincuencia_chile/main/datos/procesados/cead_delincuencia_chile.parquet';
const HISTORY_YEARS=[2020,2021,2022,2023,2024,2025];

const map=L.map('map',{zoomControl:true,attributionControl:false,minZoom:3,maxZoom:11}).setView([-33.6,-70.7],4);
let rows=[],geolayer=null,currentLayer='score',selected=null;
let historyData=null,historyPromise=null,historyMode='score',historyCrimeId=null,historyRenderToken=0;

const $=s=>document.querySelector(s);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const band=v=>v>=80?'Muy alto':v>=60?'Alto':v>=40?'Medio':v>=20?'Moderado':'Bajo';
const color=v=>v>=80?'#d54b3d':v>=60?'#bd713a':v>=40?'#8c8750':v>=20?'#3d7080':'#27485b';
const val=r=>currentLayer==='score'?Number(r?.score):Number(r?.layers?.[currentLayer]?.score);

function propName(p){for(const k of ['COMUNA','Comuna','comuna','NOM_COMUNA','NOM_COM','NAME_3','name','Nombre'])if(p?.[k])return p[k];return ''}
function findRow(name){const n=norm(name);return rows.find(r=>norm(r.commune_name)===n)||null}
function mean(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null}
function percentile(arr,v){const s=arr.slice().sort((a,b)=>a-b);return s.length?Math.round(100*s.filter(x=>x<=v).length/s.length):null}
function layerMeta(){return {predicate_direct:['Amenazas precedentes LA',.55],criminal_economy:['Economía criminal / facilitadores',.35],criminogenic_context:['Contexto criminógeno',.10]}}

function styleFeature(f){
  const r=findRow(propName(f.properties)),v=val(r),active=selected&&r&&selected.commune_code===r.commune_code;
  return {color:active?'#fff':'#3a5365',weight:active?2:.55,fillColor:color(v),fillOpacity:r?.score!=null?.78:.10};
}
function onEach(f,l){
  const name=propName(f.properties),r=findRow(name);
  l.bindTooltip(`<b>${esc(name)}</b><br>${r?`${num(val(r),1)} · ${band(val(r))}`:'Sin diagnóstico'}`,{sticky:true});
  l.on({
    mouseover:e=>e.target.setStyle({weight:1.4,color:'#fff',fillOpacity:.93}),
    mouseout:e=>geolayer.resetStyle(e.target),
    click:e=>{if(r){selected=r;renderDetail();geolayer.setStyle(styleFeature);map.fitBounds(e.target.getBounds(),{padding:[20,20],maxZoom:8});}}
  });
}
function comps(r){
  const meta=layerMeta(),out=[];
  for(const [k,l] of Object.entries(r.layers||{})){
    const lw=meta[k]?.[1]||0,ws=(l.components||[]).reduce((s,c)=>s+(Number(c.configured_weight)||0),0)||1;
    for(const c of l.components||[])out.push({...c,points:lw*((Number(c.configured_weight)||0)/ws)*(Number(c.score)||0)});
  }
  return out.sort((a,b)=>b.points-a.points);
}
const SCORE_CFG={
  layerWeights:{predicate_direct:.55,criminal_economy:.35,criminogenic_context:.10},
  layers:{
    predicate_direct:{label:'Amenazas precedentes LA',fallbackAliases:['Delitos asociados a drogas'],components:[
      {id:'drug_traffic',label:'Tráfico de sustancias',weight:.333333,aliases:['Tráfico de sustancias']},
      {id:'drug_microtraffic',label:'Microtráfico de sustancias',weight:.333333,aliases:['Microtráfico de sustancias']},
      {id:'drug_production',label:'Elaboración o producción de sustancias',weight:.333334,aliases:['Elaboración o producción de sustancias']}
    ]},
    criminal_economy:{label:'Economía criminal / facilitadores',components:[
      {id:'reception',label:'Receptación',weight:.25,aliases:['Receptación']},
      {id:'illegal_trade',label:'Comercio ilegal',weight:.20,aliases:['Comercio ilegal']},
      {id:'vehicle_theft',label:'Robo de vehículo motorizado',weight:.20,aliases:['Robo de vehículo motorizado']},
      {id:'violent_vehicle_theft',label:'Robo violento de vehículo motorizado',weight:.15,aliases:['Robo violento de vehículo motorizado']},
      {id:'weapons_possession',label:'Porte / posesión de armas o explosivos',weight:.12,aliases:['Porte / posesión de armas o explosivos']},
      {id:'cattle_theft',label:'Abigeato',weight:.08,aliases:['Abigeato']}
    ]},
    criminogenic_context:{label:'Contexto criminógeno',components:[
      {id:'homicide',label:'Homicidios y femicidios',weight:.25,aliases:['Homicidios y femicidios','Homicidios','Femicidios']},
      {id:'violent_robbery',label:'Robos con violencia o intimidación',weight:.25,aliases:['Robos con violencia o intimidación']},
      {id:'serious_injury',label:'Lesiones graves o gravísimas',weight:.20,aliases:['Lesiones graves o gravísimas']},
      {id:'threats',label:'Amenazas',weight:.15,aliases:['Amenazas']},
      {id:'public_disorder',label:'Desórdenes públicos',weight:.15,aliases:['Desórdenes públicos']}
    ]}
  }
};

function nkey(s){return norm(s)}
function median(a){if(!a.length)return 0;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2}
function quantile(a,q){if(!a.length)return 0;const x=[...a].sort((a,b)=>a-b);if(x.length===1)return x[0];const pos=(x.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?x[lo]:x[lo]+(x[hi]-x[lo])*(pos-lo)}
function pctRank(a,v){if(!a.length)return 50;if(a.length===1)return 50;let lower=0,equal=0;for(const x of a){if(x<v)lower++;else if(x===v)equal++}return 100*(lower+.5*equal)/a.length}
function trendScore(current,history){if(!history.length)return 50;const h=history.slice(-3),baseline=h.reduce((s,v)=>s+v,0)/h.length;if(baseline<=0)return current>0?75:50;return 50+50*Math.tanh((current-baseline)/baseline)}
function anomalyScores(values){const med=median(values),dev=values.map(x=>Math.abs(x-med)),mad=median(dev);return values.map(v=>{if(values.length<3)return 50;if(mad===0)return v===med?50:(v>med?75:25);const z=.6745*(v-med)/mad;return 50+50*Math.tanh(z/3)})}
function yearOf(v){
  if(v instanceof Date)return v.getUTCFullYear();
  if(typeof v==='string'){const m=v.match(/(20\d{2})/);return m?Number(m[1]):NaN}
  const n=Number(v);if(!Number.isFinite(n))return NaN;
  if(n>100000000000)return new Date(n).getUTCFullYear();
  if(n>1000000000)return new Date(n*1000).getUTCFullYear();
  if(n>15000&&n<40000)return new Date(n*86400000).getUTCFullYear();
  return NaN;
}
function annualArray(){return new Float64Array(HISTORY_YEARS.length)}
function sourceHas(annualByCrime,aliases){return aliases.some(a=>annualByCrime.has(nkey(a)))}
function compArray(annualByCrime,comp,code){
  const out=annualArray();
  for(const alias of comp.aliases){const byCode=annualByCrime.get(nkey(alias)),arr=byCode?.get(code);if(arr)for(let i=0;i<out.length;i++)out[i]+=Number(arr[i]||0)}
  return out;
}
function prepareLayers(annualByCrime){
  const out={};
  for(const [lid,layer] of Object.entries(SCORE_CFG.layers)){
    let comps=(layer.components||[]).filter(c=>sourceHas(annualByCrime,c.aliases));
    if(lid==='predicate_direct'&&!comps.length){
      const alias=(layer.fallbackAliases||[]).find(a=>annualByCrime.has(nkey(a)));
      if(alias)comps=[{id:'drug_family_fallback',label:'Delitos asociados a drogas',weight:1,aliases:[alias]}];
    }
    out[lid]=comps;
  }
  return out;
}
function computeHistoricalScores(annualByCrime,codes,prepared){
  const componentScores={},componentSeries={},componentDefs=[];
  for(const [lid,comps] of Object.entries(prepared)){
    componentScores[lid]={};componentSeries[lid]={};
    for(const comp of comps){
      componentDefs.push({...comp,layerId:lid,layerLabel:SCORE_CFG.layers[lid].label});
      const seriesByCode=new Map(codes.map(code=>[code,compArray(annualByCrime,comp,code)]));
      componentSeries[lid][comp.id]=seriesByCode;
      const scoreByCode=new Map(codes.map(code=>[code,new Float64Array(HISTORY_YEARS.length)]));
      const q75=[];
      for(let yi=0;yi<HISTORY_YEARS.length;yi++)q75[yi]=quantile(codes.map(c=>Number(seriesByCode.get(c)?.[yi]||0)),.75);
      for(let yi=0;yi<HISTORY_YEARS.length;yi++){
        const vals=codes.map(c=>Number(seriesByCode.get(c)?.[yi]||0));
        const anomalies=anomalyScores(vals);
        codes.forEach((code,ci)=>{
          const arr=seriesByCode.get(code),current=Number(arr?.[yi]||0);
          const intensity=pctRank(vals,current);
          let high=0;for(let j=0;j<=yi;j++)if(Number(arr?.[j]||0)>=q75[j])high++;
          const persistence=100*high/(yi+1);
          const history=Array.from(arr||[]).slice(0,yi);
          const trend=trendScore(current,history),anomaly=anomalies[ci];
          scoreByCode.get(code)[yi]=.40*intensity+.25*persistence+.20*trend+.15*anomaly;
        });
      }
      componentScores[lid][comp.id]=scoreByCode;
    }
  }
  const scores=new Map();
  for(const code of codes){
    const arr=[];
    for(let yi=0;yi<HISTORY_YEARS.length;yi++){
      let total=0,availLayer=0,confidenceN=0;
      const layerScores={};
      for(const [lid,lw] of Object.entries(SCORE_CFG.layerWeights)){
        const comps=prepared[lid]||[],configuredAll=(SCORE_CFG.layers[lid].components||[]).reduce((s,c)=>s+Number(c.weight||0),0)||1;
        let wsum=0,weighted=0;
        for(const comp of comps){const sc=Number(componentScores[lid][comp.id].get(code)[yi]);if(Number.isFinite(sc)){wsum+=Number(comp.weight||0);weighted+=Number(comp.weight||0)*sc}}
        const lscore=wsum?weighted/wsum:null;
        const coverage=Math.min(1,wsum/configuredAll);
        layerScores[lid]=lscore;
        if(lscore!=null){availLayer+=lw;total+=lw*lscore;confidenceN+=lw*coverage}
      }
      arr.push({year:HISTORY_YEARS[yi],score:availLayer?total/availLayer:null,confidence:100*confidenceN,Object:layerScores});
    }
    scores.set(code,arr);
  }
  return {scores,componentSeries,componentDefs};
}
async function loadHistoricalData(){
  if(historyData)return historyData;if(historyPromise)return historyPromise;
  historyPromise=(async()=>{
    const [{parquetReadObjects},{compressors}]=await Promise.all([
      import('https://cdn.jsdelivr.net/npm/hyparquet/src/hyparquet.min.js'),
      import('https://cdn.jsdelivr.net/npm/hyparquet-compressors/+esm')
    ]);
    const res=await fetch(CEAD_HISTORY);if(!res.ok)throw new Error(`CEAD histórico HTTP ${res.status}`);
    const file=await res.arrayBuffer();
    const data=await parquetReadObjects({file,compressors,columns:['comuna','cut_comuna','region','fecha','delito','delito_n']});
    const aliases=new Set();
    for(const layer of Object.values(SCORE_CFG.layers)){
      for(const c of layer.components||[])for(const a of c.aliases)aliases.add(nkey(a));
      for(const a of layer.fallbackAliases||[])aliases.add(nkey(a));
    }
    const annualByCrime=new Map(),names=new Map(),codesSet=new Set();
    for(const row of data){
      const year=yearOf(row.fecha);if(!HISTORY_YEARS.includes(year))continue;
      const crime=nkey(row.delito);if(!aliases.has(crime))continue;
      const raw=String(row.cut_comuna??'').replace(/\.0$/,'').replace(/\D/g,'');if(!raw)continue;
      const code=raw.padStart(5,'0');codesSet.add(code);names.set(code,String(row.comuna??code));
      let byCode=annualByCrime.get(crime);if(!byCode){byCode=new Map();annualByCrime.set(crime,byCode)}
      let arr=byCode.get(code);if(!arr){arr=annualArray();byCode.set(code,arr)}
      const yi=HISTORY_YEARS.indexOf(year);arr[yi]+=Number(row.delito_n||0);
    }
    data.length=0;
    for(const r of rows){const code=String(r.commune_code||'').padStart(5,'0');if(code){codesSet.add(code);names.set(code,r.commune_name||code)}}
    const codes=[...codesSet].sort(),prepared=prepareLayers(annualByCrime);
    const built=computeHistoricalScores(annualByCrime,codes,prepared);
    historyData={...built,annualByCrime,codes,names,prepared,loadedAt:new Date()};
    return historyData;
  })().catch(e=>{historyPromise=null;throw e});
  return historyPromise;
}
function chooseCrimeFor(r,h){
  const available=h.componentDefs||[];if(!available.length)return null;
  if(historyCrimeId&&available.some(c=>c.id===historyCrimeId))return available.find(c=>c.id===historyCrimeId);
  const top=comps(r)[0];const found=available.find(c=>c.id===top?.id)||available[0];historyCrimeId=found?.id||null;return found;
}
function seriesForCrime(h,comp,code){
  if(!comp)return HISTORY_YEARS.map(year=>({year,value:null}));
  const arr=h.componentSeries?.[comp.layerId]?.[comp.id]?.get(code);
  return HISTORY_YEARS.map((year,i)=>({year,value:arr?Number(arr[i]):null}));
}
function seriesForScore(h,code){
  const arr=h.scores.get(code)||[];return arr.map(d=>({year:d.year,value:Number.isFinite(d.score)?d.score:null}));
}
