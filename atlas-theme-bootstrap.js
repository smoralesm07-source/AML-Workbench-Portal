(function(){
  'use strict';
  const KEY='atlas-aml:theme:v1';
  let theme='dark';
  try{
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark')theme=saved;
  }catch{}
  const root=document.documentElement;
  if(root.getAttribute('data-atlas-theme')!==theme)root.setAttribute('data-atlas-theme',theme);
  root.style.colorScheme=theme;
  window.__ATLAS_THEME__=theme;
  window.__ATLAS_THEME_BOOTSTRAP__={status:'ready',mode:'FIRST_PAINT_ONLY',theme};
})();

/* ATLAS · Conciliación SII/UAF · corrección de escala de barras sectoriales.
 * El largo exterior expresa volumen relativo de SO; la composición interior
 * conserva Activo / Término / Sin perfil. El parche es idempotente y puede
 * instalarse aunque el runtime de conciliación se cargue después del bootstrap.
 */
(function atlasReconciliationSectorVolumeScale(){
  'use strict';
  const PATCH='20260903-sector-volume-scale';
  let retryTimer=null;

  function install(){
    if(typeof window.v0434SectorRows!=='function'||typeof window.v0434SectorPanel!=='function')return false;
    if(window.v0434SectorRows.__atlasVolumeScale===PATCH)return true;

    function scaledSectorRows(){
      const rows=V0434_CACHE.sectors.slice(0,16);
      const maxSectorTotal=Math.max(1,...rows.map(r=>Math.max(0,v0434N(r.entity_count))));
      return rows.map(r=>{
        const total=Math.max(0,v0434N(r.entity_count));
        const active=Math.max(0,v0434N(r.active_count));
        const terminated=Math.max(0,v0434N(r.terminated_count));
        const missing=Math.max(0,v0434N(r.no_sii_count));
        const statusTotal=Math.max(1,active+terminated+missing);
        const activePct=100*active/statusTotal;
        const terminatedPct=100*terminated/statusTotal;
        const missingPct=100*missing/statusTotal;
        const volumePct=total>0?100*total/maxSectorTotal:0;
        const sector=v0434Esc(r.sector_name);
        const selected=V0434_STATE.sector===r.sector_name?'selected':'';
        const sales=r.avg_sales_band_rank==null?'—':`T${v0434Fmt(r.avg_sales_band_rank,1)}`;
        const label=`${r.sector_name||'Sector UAF'} · ${v0434Fmt(total)} SO · ${volumePct.toLocaleString('es-CL',{maximumFractionDigits:1})}% del mayor sector visible`;
        return `<button class="v0434-sector-row ${selected}" data-v0434-sector="${sector}"><div class="rank"><b>${v0434Esc(v0434Cut(r.sector_name,45))}</b><small>${v0434Fmt(total)} SO · tramo ventas prom. ${sales}</small></div><svg viewBox="0 0 100 8" preserveAspectRatio="none" style="width:${volumePct.toFixed(2)}%;min-width:${total>0?'2px':'0'};justify-self:start" role="img" aria-label="${v0434Esc(label)}"><title>${v0434Esc(label)}</title><rect class="active" x="0" y="0" width="${activePct.toFixed(2)}" height="8"/><rect class="term" x="${activePct.toFixed(2)}" y="0" width="${terminatedPct.toFixed(2)}" height="8"/><rect class="missing" x="${(activePct+terminatedPct).toFixed(2)}" y="0" width="${missingPct.toFixed(2)}" height="8"/></svg><div class="numbers"><span><i class="active"></i>${v0434Fmt(active)}</span><span><i class="term"></i>${v0434Fmt(terminated)}</span><span><i class="missing"></i>${v0434Fmt(missing)}</span></div></button>`;
      }).join('');
    }

    function scaledSectorPanel(){
      return `<section class="v0434-card v0434-sector-card"><div class="v0434-head"><div><span>SECTORES UAF</span><h2>Perfil tributario por actividad obligada</h2><p>El largo de cada barra representa la cantidad de SO del sector; los colores muestran la proporción activa, terminada y sin perfil SII. Una entidad multisegmento puede participar en más de un sector UAF.</p></div><div class="v0434-legend"><span><i class="active"></i>Activo</span><span><i class="term"></i>Término</span><span><i class="missing"></i>Sin perfil</span></div></div><div class="v0434-sector-list">${scaledSectorRows()}</div></section>`;
    }

    scaledSectorRows.__atlasVolumeScale=PATCH;
    scaledSectorPanel.__atlasVolumeScale=PATCH;
    try{v0434SectorRows=scaledSectorRows;v0434SectorPanel=scaledSectorPanel;}catch(_error){}
    window.v0434SectorRows=scaledSectorRows;
    window.v0434SectorPanel=scaledSectorPanel;
    window.__ATLAS_RECONCILIATION_SECTOR_BAR_SCALE__={status:'ready',patch:PATCH,mode:'SECTOR_VOLUME_OUTER+TAX_STATUS_COMPOSITION_INNER',checkedAt:new Date().toISOString()};

    if(document.querySelector('.v0434-sector-card')){
      try{
        const rerender=typeof window.v0434RenderWorkspace==='function'?window.v0434RenderWorkspace:typeof window.v0434RenderPage==='function'?window.v0434RenderPage:null;
        if(rerender)Promise.resolve(rerender()).catch(()=>{});
      }catch(_error){}
    }
    return true;
  }

  function schedule(){
    if(install())return;
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>{if(!install())retryTimer=setTimeout(install,900);},180);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('atlas:nav-refresh',schedule);
  document.addEventListener('click',()=>{
    if(window.v0434SectorRows?.__atlasVolumeScale!==PATCH)schedule();
  },true);
})();
