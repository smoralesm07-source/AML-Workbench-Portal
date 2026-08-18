'use strict';

/* AML Workbench v0.32.1 · OSFL final consistency polish. */
const V0321='0.32.1';

/* Keep one substantive analytical universe in every visible OSFL KPI. */
v030Hero=function(){
  const q=V030_CACHE.quality||{},src=V030_CACHE.meta?.universe||{},all=V032_CACHE.regionDash?.get('__ALL__');
  const universe=v030N(all?.entity_count)||v030N(q.canonical_entities);
  const r8=v030N(all?.r8_count)||v030N(src.r8_candidates);
  const pub=v030N(all?.law21440_count)+v030N(all?.registro19862_count)-v030N(all?.dual_public_registry_count);
  const so=v030N(all?.uaf_so_count)||v030N(q.uaf_so);
  const ipa=v030N(all?.ipa3_positive_count)||v030N(q.ipa3_positive);
  return `<section class="v030-hero v032-hero"><div class="v030-hero-copy"><span class="v030-kicker">INTELIGENCIA OSFL · CHILE</span><h2>Universo, exposición pública y prioridad analítica</h2><p>Explora organizaciones sin fines de lucro desde el panorama nacional hasta la entidad. El mapa y las tarjetas comparten filtro regional; IPA 3.0 orienta revisión y no representa probabilidad de LA/FT.</p><div class="v030-hero-tags"><span>Entity Hub</span><span>SII 2020–2024</span><span>Registros públicos</span><span>Presupuesto Abierto</span><span>UAF + sanciones</span><span>IPA3 v0.4 shadow</span></div></div><div class="v030-hero-score"><span>OSFL con IPA3 activo</span><b>${v030Fmt(ipa)}</b><small>${v030Pct(ipa,universe)} del universo analizado</small><em>prioridad analítica</em></div><div class="v030-hero-metrics v032-hero-metrics"><div><span>Universo OSFL analizado</span><b>${v030Fmt(universe)}</b><small>identidad canónica · Radar_OSFL</small></div><div class="uaf"><span>También son SO UAF</span><b>${v030Fmt(so)}</b><small>cruce exacto por identidad</small></div><div><span>R.8 candidatas</span><b>${v030Fmt(r8)}</b><small>cribado funcional · aporte IPA 0</small></div><div><span>Registro público</span><b>${v030Fmt(pub)}</b><small>Ley 21.440 y/o 19.862</small></div></div></section>`;
};

/* Top-IPA rows are intentionally lean. OSFL 360 must always hydrate a complete entity record. */
v032GetEntity=async function(id){
  const cached=V030_CACHE.rows.get(id);
  const complete=cached&&Object.prototype.hasOwnProperty.call(cached,'activity_group')&&Object.prototype.hasOwnProperty.call(cached,'sales_band')&&Object.prototype.hasOwnProperty.call(cached,'sii_year_count')&&Object.prototype.hasOwnProperty.call(cached,'law21440_active');
  if(complete)return cached;
  const {data,error}=await sb.from(V032_ENTITY_RUNTIME).select('*').eq('entity_id',id).maybeSingle();
  if(error)throw error;
  if(data)V030_CACHE.rows.set(id,data);
  return data||cached||null;
};

function v0321SyncPublicSelection(){
  document.querySelectorAll('[data-v032-public]').forEach(el=>el.classList.toggle('selected',el.dataset.v032Public===V030_STATE.publicFilter));
}

/* "Ver todo IPA3 > 0" must mean all positive IPA, not an old exact band left in state. */
document.addEventListener('click',e=>{
  const allIpa=e.target.closest?.('[data-v030-flag="ipa"]');
  if(allIpa){V030_STATE.ipaBand='';setTimeout(()=>{v0321SyncPublicSelection();void v032HydrateIpaTop();},0);return;}
  if(e.target.closest?.('[data-v032-public]'))setTimeout(v0321SyncPublicSelection,0);
  if(e.target.closest?.('[data-v030-map-region],[data-v030-region],[data-v030-clear-region]'))setTimeout(v0321SyncPublicSelection,0);
},true);

const v0321BaseSync=v030SyncMapAndCharts;
v030SyncMapAndCharts=function(){v0321BaseSync();setTimeout(v0321SyncPublicSelection,0);};

window.AML_OSFL=Object.assign(window.AML_OSFL||{},{finalConsistencyVersion:V0321,visibleUniverse:'SUBSTANTIVE_CANONICAL_OSFL',entityHydration:'FULL_ON_360_OPEN'});
