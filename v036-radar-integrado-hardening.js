'use strict';

/* v0.36.0 hardening · exact analytical fidelity to radarintegradoreal.html */
const V036_PROTO_FINANCIAL_ALIAS=new Set(['EMPRESAS DE DEPOSITO DE VALORES REGIDAS POR LA LEY N 18 876']);

/* Preserve the proposal's segmentation, including the only typography variant
 * that differs after normalization from the current Workbench alias list. */
const v036HardBaseSegment=v036Segment;
v036Segment=function(name){
  const n=v036Norm(name);
  if(V036_PROTO_FINANCIAL_ALIAS.has(n))return 'FINANCIERO';
  return v036HardBaseSegment(name);
};

/* Marks match the delivered proposal exactly:
 * - structural: SO >=100 and intensity <5, excluding absolute silence
 * - rise/fall: only when 2024 base >=10
 * - concentrator: >=3% of 2025 ROS and intensity >=100
 */
v036Marks=function(r){
  const out=[];
  const so=v036N(r.so),intensity=v036N(r.int),d=r.delta;
  if(r.nominal)out.push('nominal');
  if(!r.nominal&&so>=100&&intensity<5)out.push('estructural');
  if(d!==null&&Number.isFinite(Number(d))&&r.base>=10&&Number(d)<=-30)out.push('caida');
  if(d!==null&&Number.isFinite(Number(d))&&r.base>=10&&Number(d)>=100)out.push('alza');
  if(v036N(r.shareROS)>=3&&intensity>=100)out.push('concentrador');
  if(!out.length)out.push('proporcional');
  return out;
};

/* Null deltas remain null. Number(null) would otherwise turn an unavailable
 * comparison into a false 0%, distorting exactly the weak-base convention the
 * delivered design protects. */
v036PrepareRows=function(uaf){
  const sectors=v019Array(uaf?.sectors);
  const totalSO=v036N(uaf?.report?.totals?.registered_so_2025)||v036Sum(sectors,'registered_so_2025');
  const totalROS=v036N(uaf?.report?.totals?.ros_2025)||v036Sum(sectors,'ros_2025');
  return sectors.map(r=>{
    const series=V036_YEARS.map(y=>v036N(r[`ros_${y}`]));
    const so=v036N(r.registered_so_2025),ros=v036N(r.ros_2025),base=v036N(r.ros_2024);
    const rawDelta=r.delta_ros_2025_vs_2024_pct;
    const delta=(rawDelta===null||rawDelta===undefined||rawDelta==='')?null:Number(rawDelta);
    const row={
      name:r.sector_name,
      seg:v036Segment(r.sector_name),
      so,ros,
      int:v036N(r.ros_per_100_so_2025),
      shareSO:totalSO?100*so/totalSO:0,
      shareROS:totalROS?100*ros/totalROS:0,
      delta:Number.isFinite(delta)?delta:null,
      base,
      s:series,
      total:series.reduce((a,v)=>a+v,0),
      nominal:Boolean(r.silence_5y),
      raw:r
    };
    row.marks=v036Marks(row);
    return row;
  });
};

/* v024 audit remains useful, but it must behave as a native part of the new
 * command center instead of a passive legacy strip. */
const v036HardBaseBind=v036Bind;
v036Bind=function(ctx){
  v036HardBaseBind(ctx);
  const audit=document.querySelector('[data-v024-audit-toggle]');
  if(audit&&!audit.dataset.v036Bound){
    audit.dataset.v036Bound='1';
    audit.addEventListener('click',()=>{
      const detail=document.querySelector('[data-v024-audit-detail]');
      if(!detail)return;
      const expanded=audit.getAttribute('aria-expanded')==='true';
      audit.setAttribute('aria-expanded',String(!expanded));
      detail.hidden=expanded;
    });
  }
};

/* Public-entity context is asynchronous; keep it inside the dedicated slot
 * even when the registry finishes after Radar Integrado has rendered. */
const v036PublicObserver=new MutationObserver(()=>{
  if(window.state?.view!=='overview')return;
  const strip=document.querySelector('#v0344-public-overview');
  const slot=document.querySelector('.v036-public-slot');
  if(strip&&slot&&strip.parentElement!==slot)slot.appendChild(strip);
});
v036PublicObserver.observe(document.documentElement,{childList:true,subtree:true});

window.__AML_V036_HARDENING__={
  structural:{minSo:100,maxIntensityExclusive:5},
  deltaBaseMin:10,
  concentrator:{minRosSharePct:3,minIntensity:100},
  nullDeltaPreserved:true,
  publicContextSlot:true,
  auditInteractive:true
};
