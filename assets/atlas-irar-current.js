'use strict';

/* ATLAS AML · IRAR current methodology authority
 * IRAR = Índice de Rendimiento Analítico de ROS.
 * The observed ratio is retained for traceability, while the primary comparative
 * value is credibility-adjusted against a leave-one-out peer-family prior.
 * This is a historical aggregate throughput/yield proxy; it is not a cohort
 * conversion probability, individual ROS quality, entity risk, or compliance.
 */
(function atlasIrarCurrent(){
  const VERSION='IRAR-1.0';
  const PERIOD='2021-2025';
  const PRIOR_STRENGTH=100;
  const MIN_PEER_SECTORS=4;
  const MIN_PEER_ROS=100;
  const REPORT_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_UAF/main/docs/data/reportability_sector_2025.json';
  const INDICATIONS_URL='https://raw.githubusercontent.com/smoralesm07-source/Radar_UAF/main/docs/data/ros_conversion_sector_2021_2025.json';
  let loadPromise=null;

  const FAMILIES=[
    {key:'PUBLICO',label:'Sector público',segment:'PUBLICO',patterns:['INSTITUCIONES PUBLICAS']},
    {key:'PAGOS_FX_REMESAS',label:'Pagos, cambio y remesas',segment:'FINANCIERO',patterns:['CASAS DE CAMBIO','TRANSFERENCIA DE DINERO','MONEDA EXTRANJERA','TARJETAS DE CREDITO','TARJETAS DE PAGO','PROVISION DE FONDOS']},
    {key:'INTERMEDIACION_CREDITO',label:'Intermediación y crédito',segment:'FINANCIERO',patterns:['BANCOS','INSTITUCIONES FINANCIERAS','COOPERATIVAS DE AHORRO','CAJAS DE COMPENSACION','FACTORING','FACTORAJE','LEASING','ARRENDAMIENTO FINANCIERO']},
    {key:'MERCADO_CAPITALES',label:'Mercado de capitales e inversión',segment:'FINANCIERO',patterns:['BOLSAS DE VALORES','BOLSAS DE PRODUCTOS','CORREDORES DE BOLSAS','AGENTES DE VALORES','FONDOS DE INVERSION','FONDOS MUTUOS','ADMINISTRADORAS GENERALES DE FONDOS','DEPOSITO DE VALORES','SECURITIZ','MUTUOS HIPOTECARIOS','MERCADOS DE FUTURO','INTERMEDIACION DE INSTRUMENTOS FINANCIEROS','CUSTODIA DE INSTRUMENTOS FINANCIEROS','FINANCIAMIENTO COLECTIVO','SISTEMAS ALTERNATIVOS DE TRANSACCION']},
    {key:'SEGUROS_PREVISION',label:'Seguros y previsión',segment:'FINANCIERO',patterns:['COMPANIAS DE SEGUROS','FONDOS DE PENSIONES','AFP']},
    {key:'INMOBILIARIO_LEGAL',label:'Inmobiliario y fe pública',segment:'APNFD',patterns:['GESTION INMOBILIARIA','CORREDORES DE PROPIEDADES','NOTARIOS','CONSERVADORES']},
    {key:'BIENES_ALTO_VALOR',label:'Bienes de alto valor',segment:'APNFD',patterns:['VEHICULOS','JOYAS','PIEDRAS PRECIOSAS','METALES PRECIOSOS','REMATE','MARTILLO','EQUINOS']},
    {key:'JUEGO_APUESTAS',label:'Juego y apuestas',segment:'APNFD',patterns:['CASINOS','HIPODROMOS']},
    {key:'COMERCIO_FRONTERA',label:'Comercio exterior y frontera',segment:'APNFD',patterns:['ZONAS FRANCAS','AGENTES DE ADUANA']},
    {key:'OTRAS_APNFD',label:'Otras APNFD',segment:'APNFD',patterns:['ARMAS','CLUBES DE CAZA','CLUBES DE PESCA','CLUBES DE TIRO','ORGANIZACIONES DEPORTIVAS','TRANSPORTE DE VALORES']}
  ];

  function norm(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
      .replace(/N[°º]/g,'N').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim()
      .replace(/ADMINISTRADORAS DE FONDOS DE PENSIONES(?: AFP)?/g,'ADMINISTRADORES DE FONDOS DE PENSIONES')
      .replace(/EMPRESAS DE DEPOSITOS DE VALORES/g,'EMPRESAS DE DEPOSITO DE VALORES')
      .replace(/COMPANIAS DE SEGURO$/g,'COMPANIAS DE SEGUROS')
      .replace(/ O CUALQUIER OTRO SISTEMA SIMILAR A LOS REFERIDOS MEDIOS DE PAGO/g,' U OTRO SIMILAR');
  }
  function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
  function clamp(v,a=0,b=100){return finite(v)?Math.max(a,Math.min(b,Number(v))):null;}
  function sum(rows,key){return rows.reduce((a,r)=>a+(finite(r?.[key])?Number(r[key]):0),0);}
  function familyFor(name){
    const n=norm(name);
    for(const f of FAMILIES)if(f.patterns.some(p=>n.includes(norm(p))))return f;
    return {key:'OTRO',label:'Otros sectores',segment:'APNFD',patterns:[]};
  }
  function matchRow(name,rows){
    const key=norm(name),list=Array.isArray(rows)?rows:[];
    let row=list.find(r=>norm(r.sector_name)===key);if(row)return row;
    row=list.find(r=>{const k=norm(r.sector_name);return k.length>8&&key.length>8&&(k.includes(key)||key.includes(k));});
    return row||null;
  }
  function confidenceBand(c){return c>=.80?'alta':c>=.50?'media':'baja';}
  function relativeScore(relative,credibility){
    if(!finite(relative)||Number(relative)<=0)return 50;
    const signal=clamp(50+25*Math.log2(Number(relative)),0,100);
    const c=clamp(Number(credibility)*100,0,100)/100;
    return clamp(50+c*(signal-50),0,100);
  }
  function profileFor(iir,relative,confidence){
    if(!finite(iir)||!finite(relative))return {key:'SIN_BASE',label:'Sin base suficiente'};
    const x=Number(iir),y=Number(relative),limited=Number(confidence)<.25;
    let key='COMPORTAMIENTO_ESPERADO',label='Comportamiento esperado';
    if(x>1.5&&y>1.25){key='INTENSIVO_PRODUCTIVO';label='Intensivo–productivo';}
    else if(x>1.5&&y<.80){key='INTENSIVO_BAJO_RENDIMIENTO';label='Intensivo–bajo rendimiento';}
    else if(x<.75&&y>1.25){key='SELECTIVO_PRODUCTIVO';label='Selectivo–productivo';}
    else if(x<.75&&y<.80){key='BAJA_ACTIVACION';label='Baja activación';}
    return {key,label,limited};
  }
  function profileRead(metric){
    const p=metric?.profile?.key;
    const map={
      INTENSIVO_PRODUCTIVO:'El sector reporta por encima de su peso relativo y su rendimiento analítico ajustado supera al de sus pares. Describe alto flujo y alto rendimiento; no implica mayor riesgo ni mejor cumplimiento.',
      INTENSIVO_BAJO_RENDIMIENTO:'El sector reporta por encima de su peso relativo, pero el rendimiento analítico ajustado queda bajo sus pares. Puede justificar revisar composición, concentración y criterios de reporte; no prueba reporte defensivo.',
      SELECTIVO_PRODUCTIVO:'El sector reporta por debajo de su peso relativo, pero los ROS asociados muestran rendimiento ajustado superior a pares. Puede reflejar selectividad o umbrales de reporte elevados y requiere contexto.',
      BAJA_ACTIVACION:'El sector presenta baja intensidad relativa y bajo rendimiento analítico frente a pares. Puede responder a baja exposición, baja detección o cobertura insuficiente; no prueba subreporte.',
      COMPORTAMIENTO_ESPERADO:'La combinación de intensidad y rendimiento se mantiene en torno a los rangos de referencia. Debe leerse junto con volumen, concentración y contexto sectorial.',
      SIN_BASE:'No existe base suficiente para una lectura combinada IIR × IRAR.'
    };
    return map[p]||map.SIN_BASE;
  }

  function buildDataset(report,indications,options={}){
    const reportRows=Array.isArray(report?.sectors)?report.sectors:[];
    const indicationRows=Array.isArray(indications?.sectors)?indications.sectors:[];
    const priorStrength=finite(options.priorStrength)?Number(options.priorStrength):PRIOR_STRENGTH;
    const minPeerSectors=finite(options.minPeerSectors)?Number(options.minPeerSectors):MIN_PEER_SECTORS;
    const minPeerRos=finite(options.minPeerRos)?Number(options.minPeerRos):MIN_PEER_ROS;
    const totalSO=Number(report?.totals?.registered_so_2025)||sum(reportRows,'registered_so_2025');
    const totalROS2025=Number(report?.totals?.ros_2025)||sum(reportRows,'ros_2025');
    const base=reportRows.map((r,index)=>{
      const indRow=matchRow(r.sector_name,indicationRows);
      const sent=finite(r.ros_total_2021_2025)?Math.max(0,Number(r.ros_total_2021_2025)):0;
      const ind=finite(indRow?.ros_con_indicios_total_2021_2025)?Math.max(0,Number(indRow.ros_con_indicios_total_2021_2025)):null;
      const so=finite(r.registered_so_2025)?Math.max(0,Number(r.registered_so_2025)):0;
      const ros2025=finite(r.ros_2025)?Math.max(0,Number(r.ros_2025)):0;
      const iir=so>0&&totalSO>0&&totalROS2025>0?((ros2025/totalROS2025)/(so/totalSO)):null;
      return {index,name:r.sector_name,key:norm(r.sector_name),family:familyFor(r.sector_name),sent,ind,so,ros2025,iir,raw:r};
    });
    const valid=base.filter(x=>x.sent>0&&x.ind!==null);
    const totalSent=valid.reduce((a,x)=>a+x.sent,0),totalInd=valid.reduce((a,x)=>a+x.ind,0);
    const nationalRate=totalSent>0?totalInd/totalSent:null;
    const metrics=base.map(x=>{
      if(!(x.sent>0)||x.ind===null)return {...x,observed_pct:null,adjusted_pct:null,peer_expected_pct:null,relative_peer:null,confidence_pct:0,confidence_band:'baja',score:50,profile:profileFor(x.iir,null,0),peer_source:'sin_base',peer_count:0,peer_ros:0,ranking_eligible:false};
      const peers=valid.filter(p=>p.key!==x.key&&p.family.key===x.family.key);
      const peerSent=peers.reduce((a,p)=>a+p.sent,0),peerInd=peers.reduce((a,p)=>a+p.ind,0);
      const familySufficient=peers.length>=minPeerSectors&&peerSent>=minPeerRos;
      const natSent=Math.max(0,totalSent-x.sent),natInd=Math.max(0,totalInd-x.ind);
      const fallbackRate=natSent>0?natInd/natSent:nationalRate;
      const peerRate=familySufficient&&peerSent>0?peerInd/peerSent:fallbackRate;
      const observed=x.ind/x.sent;
      const adjusted=finite(peerRate)?(x.ind+priorStrength*peerRate)/(x.sent+priorStrength):observed;
      const credibility=x.sent/(x.sent+priorStrength);
      const relative=finite(peerRate)&&peerRate>0?adjusted/peerRate:null;
      const score=relativeScore(relative,credibility);
      const profile=profileFor(x.iir,relative,credibility);
      return {...x,
        observed_pct:100*observed,
        adjusted_pct:100*adjusted,
        peer_expected_pct:finite(peerRate)?100*peerRate:null,
        relative_peer:relative,
        confidence_pct:100*credibility,
        confidence_band:confidenceBand(credibility),
        score,profile,
        peer_source:familySufficient?'familia_leave_one_out':'nacional_leave_one_out',
        peer_count:familySufficient?peers.length:Math.max(0,valid.length-1),
        peer_ros:familySufficient?peerSent:natSent,
        ranking_eligible:x.sent>=100&&credibility>=.50,
        legacy_icr_pct:100*observed
      };
    });
    const byKey=new Map(metrics.map(m=>[m.key,m]));
    return {schema:'ATLAS_IRAR_V1',version:VERSION,period:PERIOD,prior_strength_ros:priorStrength,min_peer_sectors:minPeerSectors,min_peer_ros:minPeerRos,national_rate_pct:finite(nationalRate)?100*nationalRate:null,total_sent_5y:totalSent,total_indications_5y:totalInd,metrics,byKey};
  }

  function findMetric(name,dataset){
    if(!dataset)return null;const key=norm(name);if(dataset.byKey?.has(key))return dataset.byKey.get(key);
    let best=null;for(const m of dataset.metrics||[]){if(m.key.length>8&&key.length>8&&(m.key.includes(key)||key.includes(m.key))){best=m;break;}}
    return best;
  }
  async function fetchJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`IRAR source ${r.status}`);return r.json();}
  async function load(){
    if(loadPromise)return loadPromise;
    loadPromise=Promise.all([fetchJson(REPORT_URL),fetchJson(INDICATIONS_URL)]).then(([report,indications])=>({report,indications,dataset:buildDataset(report,indications)}));
    try{return await loadPromise;}catch(error){loadPromise=null;throw error;}
  }

  window.ATLAS_IRAR_CURRENT={
    version:VERSION,
    acronym:'IRAR',
    name:'Índice de Rendimiento Analítico de ROS',
    period:PERIOD,
    report_url:REPORT_URL,
    indications_url:INDICATIONS_URL,
    prior_strength_ros:PRIOR_STRENGTH,
    min_peer_sectors:MIN_PEER_SECTORS,
    min_peer_ros:MIN_PEER_ROS,
    families:FAMILIES.map(({key,label,segment})=>({key,label,segment})),
    normalize:norm,familyFor,matchRow,buildDataset,findMetric,relativeScore,profileFor,profileRead,load,
    observed_definition:'ROS con indicios agregados 2021-2025 / ROS enviados agregados 2021-2025',
    adjusted_definition:'(indicios + K * rendimiento esperado de pares) / (ROS enviados + K), K=100',
    guardrail:'HISTORICAL_AGGREGATE_ANALYTICAL_YIELD_PROXY_NOT_COHORT_CONVERSION_NOT_RISK_NOT_COMPLIANCE'
  };
})();
