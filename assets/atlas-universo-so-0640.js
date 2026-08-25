'use strict';
(function atlasUniversoSO0640(){
  const core=window.__ATLAS_OBLIGATED__;
  if(!core){window.__ATLAS_UNIVERSO_SO_0640__={active:false,reason:'obligated-core-unavailable'};return;}
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const fmt=core.fmt||((v)=>Number(v||0).toLocaleString('es-CL'));
  let tierCache=null,loading=false;

  function cleanLegacyCards(){document.querySelectorAll('.uso61-truth,.uso63-scope').forEach(n=>n.remove());}
  function humanizePendingSector(){document.querySelectorAll('.so-row .label, option').forEach(n=>{if((n.textContent||'').trim()==='SIN_SECTOR_MATERIALIZADO')n.textContent='Sector UAF pendiente de materialización';});}
  async function loadTiers(){
    if(tierCache||loading)return tierCache;const client=db();if(!client)return null;loading=true;
    try{const {data,error}=await client.from('aml_uaf_potential_subject_snapshot').select('detection_tier,is_actionable');if(error)throw error;const rows=data||[];const out={total:rows.length,actionable:0,A_ALTA:0,B_MEDIA:0,C_EXPLORATORIA:0};for(const r of rows){if(r.is_actionable)out.actionable++;if(out[r.detection_tier]!==undefined)out[r.detection_tier]++;}tierCache=out;return out;}catch(_e){return null;}finally{loading=false;}
  }
  function tierHtml(t){return `<section class="uso64-tier-strip"><h3>Universo ampliado de potenciales SO</h3><p>El motor 0.64 privilegia cobertura: el tipo de entidad dejó de ser un filtro excluyente y pasa a ponderar la evidencia.</p><div class="uso64-tiers"><div class="uso64-tier total"><b>${fmt(t.total)}</b><span>Potenciales detectados · ${fmt(t.actionable)} accionables</span></div><div class="uso64-tier"><b>${fmt(t.A_ALTA)}</b><span>Nivel A · evidencia alta</span></div><div class="uso64-tier"><b>${fmt(t.B_MEDIA)}</b><span>Nivel B · evidencia media</span></div><div class="uso64-tier"><b>${fmt(t.C_EXPLORATORIA)}</b><span>Nivel C · exploración</span></div></div><div class="uso64-note">Potencial SO = hipótesis de fiscalización. No equivale a sujeto obligado no inscrito ni a incumplimiento.</div></section>`;}
  async function patchPotential(){const host=document.querySelector('#so-potential');if(!host||host.querySelector('.uso64-tier-strip'))return;const t=await loadTiers();if(!t||!document.contains(host))return;const kpis=host.querySelector('.so-kpis');if(kpis)kpis.insertAdjacentHTML('afterend',tierHtml(t));else host.insertAdjacentHTML('afterbegin',tierHtml(t));}
  function patchPanoramaCopy(){const root=document.querySelector('.so-root');if(!root)return;const firstKpi=root.querySelector('.so-kpis .so-kpi:first-child b');const firstLabel=root.querySelector('.so-kpis .so-kpi:first-child span');if(firstKpi&&core.state?.overview?.registry?.subjects!=null)firstKpi.textContent=fmt(core.state.overview.registry.subjects);if(firstLabel)firstLabel.textContent='Sujetos obligados inscritos';}
  async function patch(){cleanLegacyCards();humanizePendingSector();patchPanoramaCopy();await patchPotential();}
  const obs=new MutationObserver(()=>{void patch();});
  const start=()=>{const c=document.querySelector('#content')||document.body;obs.observe(c,{childList:true,subtree:true});void patch();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__ATLAS_UNIVERSO_SO_0640__={active:true,version:'0.64.0',operationalSO:10294,potentialEngine:'IVO-2.0_RECALL_TIERS',patch};
})();

(function loadAtlasSiiRegistry0650(){
  const load=(src,key)=>{if(document.querySelector(`script[data-${key}]`))return;const s=document.createElement('script');s.src=src;s.async=false;s.dataset[key]='1';document.head.appendChild(s);};
  load('./assets/atlas-entity-federation-0650.js?v=0650-1','atlasEntityFederation0650');
  load('./assets/atlas-universo-so-0650.js?v=0650-1','atlasUniversoSo0650');
})();
