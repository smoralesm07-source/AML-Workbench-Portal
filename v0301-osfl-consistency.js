'use strict';

/* AML Workbench v0.30.1 · OSFL source/canonical reconciliation.
 * Source universe = 37,164 governed Radar_OSFL profiles.
 * Substantive OSFL = profiles whose canonical Entity Hub type remains OSFL.
 * Public bodies stay visible only as data-quality/reclassification context.
 */
const V0301_OSFL='0.30.1';

if(typeof v030Hero==='function'){
  v030Hero=function(){
    const q=V030_CACHE.quality||{},s=V030_CACHE.sourceCoverage||{},src=V030_CACHE.meta?.universe||{},reg=V030_CACHE.meta?.registries||{};
    const source=v030N(src.expanded)||v030N(s.source_profiles),substantive=v030N(q.canonical_entities),linked=v030N(s.linked_entity_hub),pending=v030N(s.pending_entity_hub),reclassified=v030N(q.public_body_reclassified);
    const r8=v030N(s.r8_candidates)||v030N(src.r8_candidates),pub=v030N(s.public_registry_entities)||v030N(reg.law21440_active)+v030N(reg.registro19862);
    return `<section class="v030-hero"><div class="v030-hero-copy"><span class="v030-kicker">INTELIGENCIA OSFL · CHILE</span><h2>Universo, exposición pública y prioridad analítica</h2><p>Explora organizaciones sin fines de lucro desde una mirada nacional hasta la entidad. La condición OSFL y el cribado FATF R.8 son contexto; IPA 3.0 ordena revisión y no representa probabilidad de LA/FT.</p><div class="v030-hero-tags"><span>Entity Hub</span><span>SII 2020–2024</span><span>Registros públicos</span><span>UAF + sanciones</span><span>IPA3 v0.4 shadow</span></div></div><div class="v030-hero-score"><span>OSFL con IPA3 activo</span><b>${v030Fmt(q.ipa3_positive)}</b><small>${v030Pct(q.ipa3_positive,substantive)} de las OSFL sustantivas</small><em>prioridad analítica</em></div><div class="v030-hero-metrics"><div><span>Universo Radar_OSFL</span><b>${v030Fmt(source)}</b><small>snapshot fuente gobernado</small></div><div><span>OSFL sustantivas</span><b>${v030Fmt(substantive)}</b><small>${v030Fmt(reclassified)} reclasificadas por calidad</small></div><div><span>Perfiles enlazados</span><b>${v030Fmt(linked)}</b><small>${pending?`${v030Fmt(pending)} pendientes`:'100% del snapshot en Entity Hub'}</small></div><div><span>R.8 candidatas</span><b>${v030Fmt(r8)}</b><small>cribado · aporte IPA 0</small></div><div><span>Registro público</span><b>${v030Fmt(pub)}</b><small>Ley 21.440 / 19.862</small></div></div></section>`;
  };
}

if(typeof v030PublicContext==='function'){
  v030PublicContext=function(){
    const meta=V030_CACHE.meta||{},reg=meta.registries||{},uaf=meta.uaf_cross||{},q=V030_CACHE.quality||{};
    const reclassified=v030N(q.public_body_reclassified),sourcePublic=v030N(uaf.organismo_publico);
    return `<section class="v030-card v030-public-card"><div class="v030-card-head"><div><span>EXPOSICIÓN PÚBLICA</span><h3>Registros y cruces relevantes</h3><p>Contexto de fuente para orientar análisis, sin inferir conducta adversa.</p></div></div><div class="v030-public-grid"><button type="button" data-v030-flag="public"><span>Ley 21.440</span><b>${v030Fmt(reg.law21440_active)}</b><small>donatarias activas</small></button><button type="button" data-v030-flag="public"><span>Ley 19.862</span><b>${v030Fmt(reg.registro19862)}</b><small>colaboradores del Estado</small></button><button type="button" data-v030-flag="r8"><span>FATF R.8</span><b>${v030Fmt(meta.universe?.r8_candidates)}</b><small>cribado funcional · aporte 0</small></button><button type="button" data-v030-flag="uaf"><span>SO UAF</span><b>${v030Fmt(q.uaf_so)}</b><small>cruce exacto sobre OSFL sustantivas</small></button><button type="button" data-v030-flag="sanctions"><span>Sanciones</span><b>${v030Fmt(q.sanctioned_entities)}</b><small>entidades resueltas actualmente</small></button><div><span>Calidad / reclasificación</span><b>${v030Fmt(reclassified)}</b><small>organismos públicos excluidos del universo sustantivo${sourcePublic!==reclassified?` · snapshot fuente identificaba ${v030Fmt(sourcePublic)}`:''}</small></div></div><div class="v030-context-rule"><b>Regla de lectura:</b> “R.8 candidata”, “donataria” o “colaborador del Estado” describen función/exposición. Para elevar prioridad se requieren marcas IPA3 u otra evidencia independiente.</div></section>`;
  };
}

window.AML_OSFL=Object.assign(window.AML_OSFL||{},{uiConsistencyVersion:V0301_OSFL,sourceUniverseSemantics:'RADAR_OSFL_PROFILE = SUBSTANTIVE_OSFL + CANONICAL_RECLASSIFICATIONS'});
