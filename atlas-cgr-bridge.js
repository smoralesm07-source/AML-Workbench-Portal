'use strict';

/* ATLAS AML · current CGR bridge.
 * Extracted from the former v0.35 command-center layer so Radar Integrado can
 * keep opening CGR evidence without loading the historical v0.35 runtime.
 */
(function(){
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=(v,d=0)=>num(v).toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short=(v,n=96)=>{const s=String(v||'');return s.length>n?s.slice(0,n-1)+'…':s;};
  const region=v=>typeof window.v019RegionShort==='function'?window.v019RegionShort(v||'Sin región'):String(v||'Sin región');

  function openCgr(core){
    if(typeof window.v019OpenDrawer!=='function')return false;
    const rows=arr(core?.findings).filter(f=>arr(f?.payload?.producer_ids).includes('RADAR_CGR')).slice(0,12);
    if(!rows.length){
      window.v019OpenDrawer('<div class="ey">CGR</div><h2>Hallazgos Fusion</h2><p class="lead">El productor CGR está materializado, pero el corte visible no contiene filas CGR para desplegar aquí. Usa Entidad 360 o la cola de hallazgos cuando existan entidades vinculadas.</p>');
      return true;
    }
    window.v019OpenDrawer(`<div class="ey">CGR · Fusion</div><h2>Hallazgos CGR en el corte visible</h2><p class="lead">Selecciona un hallazgo para revisar evidencia y entidad vinculada.</p><div class="v019-stack">${rows.map(f=>`<article class="v019-listitem" data-finding="${escHtml(f.finding_key)}"><div><h3>${escHtml(short(f.title||'Hallazgo CGR'))}</h3><p>${escHtml(region(f.region))}</p></div><div class="value"><b>${fmt(f.score_investigate,1)}</b><span>IPA</span></div></article>`).join('')}</div>`);
    return true;
  }

  window.AtlasCgrBridge={open:openCgr};
  /* Temporary compatibility alias consumed by Radar Integrado v036. The
   * implementation is current ATLAS code, not the historical v035 runtime. */
  window.v035OpenCgr=openCgr;
})();
