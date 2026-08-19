'use strict';

/* v0.35.0 patch · preserve non-redundant UAF cross-radar + regional gap readings. */
V035_HELP.gap_region={title:'Brecha supervisiva territorial',body:'Índice IBS de atención territorial para el screening de brecha. Combina densidad de pares candidatos, volumen y amplitud sectorial para ordenar regiones. No es una tasa de incumplimiento ni un score penal.'};
V035_HELP.uaf_cross={title:'Huella UAF en Fusion',body:'Intersección de sujetos observados UAF con otros productores materializados en Entity Hub. “3+ fuentes” expresa convergencia de observación; “con sanción” es un hecho regulatorio separado y ninguno constituye por sí solo un score AML.'};

/* Help indicators are non-button descendants so analytical cards remain valid interactive controls. */
v035Help=function(key){
  const h=V035_HELP[key];
  return h?`<span class="v035-help" data-v035-help="${esc(key)}" aria-label="Ayuda: ${esc(h.title)}" title="Ayuda metodológica">?</span>`:'';
};

const v035PatchBaseGapSectors=v035GapSectors;
v035GapSectors=function(core){
  let html=v035PatchBaseGapSectors(core);
  const regions=v019Array(core?.gaps)
    .filter(r=>r.gap_attention_index!==null&&r.gap_attention_index!==undefined&&v019RegionNorm(r.region)!=='Sin región')
    .slice().sort((a,b)=>v019Num(b.gap_attention_index)-v019Num(a.gap_attention_index));
  const hotspot=regions[0];
  if(!hotspot)return html;
  const block=`<button type="button" class="v035-gap-hotspot" data-v035-gap-region="${esc(hotspot.region)}"><span>Mayor atención territorial ${v035Help('gap_region')}</span><b>${esc(v019RegionShort(hotspot.region))}</b><strong>IBS ${v035Fmt(hotspot.gap_attention_index,1)}</strong><small>${v035Fmt(hotspot.candidate_pairs)} pares candidatos · abrir detalle →</small></button>`;
  return html.replace('<div class="v035-gap-list">',`${block}<div class="v035-gap-list">`);
};

function v035UafFusionFoot(core){
  const labels={RADAR_SII:'SII',RADAR_SANCIONES:'Sanciones',RADAR_OSFL:'OSFL',RADAR_PRENSA:'Prensa',RADAR_CGR:'CGR'};
  const cross=v019Array(core?.uafCross).filter(r=>v019Num(r.uaf_entities)>0).slice().sort((a,b)=>v019Num(b.uaf_entities)-v019Num(a.uaf_entities)).slice(0,5);
  const three=v019Array(core?.uafRegions).reduce((a,r)=>a+v019Num(r.uaf_three_plus_sources),0);
  const sanctioned=v019Array(core?.uafRegions).reduce((a,r)=>a+v019Num(r.uaf_sanctioned),0);
  return `<div class="v035-uaf-fusion-foot"><div><span>Huella UAF en Fusion ${v035Help('uaf_cross')}</span><b>${v035Fmt(three)}</b><small>SO observados en 3+ fuentes · ${v035Fmt(sanctioned)} con sanción materializada</small></div><div class="v035-cross-chips">${cross.length?cross.map(r=>`<span><b>${v035Fmt(r.uaf_entities)}</b>${esc(labels[r.radar_id]||String(r.radar_id||'Fuente').replace('RADAR_',''))}</span>`).join(''):'<span>Sin cruces materializados</span>'}</div></div>`;
}

const v035PatchBaseUafSituation=v035UafSituation;
v035UafSituation=function(core,uaf,counts){
  const html=v035PatchBaseUafSituation(core,uaf,counts);
  const close=html.lastIndexOf('</section>');
  if(close<0)return html;
  return `${html.slice(0,close)}${v035UafFusionFoot(core)}${html.slice(close)}`;
};

const v035PatchBaseBind=v035Bind;
v035Bind=function(core,uaf,analytics){
  v035PatchBaseBind(core,uaf,analytics);
  document.querySelectorAll('[data-v035-gap-region]').forEach(b=>b.addEventListener('click',e=>{
    e.preventDefault();
    if(typeof v019OpenGapRegion==='function')v019OpenGapRegion(b.dataset.v035GapRegion,core);
  }));
};
