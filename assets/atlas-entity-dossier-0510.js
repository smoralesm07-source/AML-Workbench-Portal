'use strict';

/* ATLAS AML 0.51.0 · build 0510 · Caracterización profunda de la entidad
 *
 * Problema que corrige
 * --------------------
 * El Expediente 360 mostraba seis lentes, pero varias de sus tarjetas se
 * rendían vacías porque leían campos que el esquema nunca materializó:
 * "Benchmark de pares no materializado" se mostraba siempre, aunque el sistema
 * calcula percentiles de pares por año, sector, tamaño y edad; la red se
 * dibujaba desde profile.relaciones, siempre vacío, mientras existía un grafo
 * de vínculos de identidad gobernado; y la descomposición IPA3 por marcas —el
 * único lugar donde el score se explica— no aparecía en la ficha.
 *
 * Qué agrega
 * ----------
 * Lente 01 · procedencia de identidad y vínculos candidatos gobernados.
 * Lente 02 · posición frente a pares, trayectoria observada, estructura
 *            declarada, registro UAF y perfil OSFL/FATF R8 cuando existen.
 * Lente 05 · descomposición IPA3 v0.4-shadow por grupo y por marca, cada una
 *            con su evidencia de cálculo abierta en ficha.
 * Lente 06 · resolución de identidad de cada sanción y transferencia analítica.
 *
 * Semántica deliberada
 * --------------------
 * - Percentil de pares = posición dentro del grupo comparable del año. No es
 *   desempeño, no es anomalía y no es riesgo.
 * - IPA3 v0.4-shadow ordena revisión. Un puntaje cero significa que ninguna
 *   marca se activó y se declara como "—", nunca como prioridad baja.
 * - Un vínculo de identidad con requiere_revision sigue siendo candidato: no
 *   promueve identidad ni transfiere atributos entre entidades.
 * - Todo bloque declara su fuente y su corte. Una entidad ausente de un corte
 *   se lee como no materializada, nunca como cero.
 *
 * Seguridad: sólo lectura bajo la sesión y RLS existentes. No toca Auth, Entra
 * ni refresh tokens. Sin MutationObserver. Sin almacenamiento en el navegador.
 */
(function atlasEntityDossier0510(){
  const RELEASE='0.51.0';
  const BUILD='0510';
  const AUTHORITY='ENTITY360_DEEP_CHARACTERIZATION_0510';
  const BASE_RENDER=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(!BASE_RENDER){
    window.__ATLAS_ENTITY_DOSSIER_0510__={active:false,reason:'entity-renderer-unavailable',installedAt:new Date().toISOString()};
    return;
  }

  const SCORE_SNAPSHOT='aml_ipa3_entity_score_snapshot_v0_4';
  const MARK_SNAPSHOT='aml_ipa3_mark_scores_snapshot_v0_4';
  const PEER_SNAPSHOT='aml_entity_peer_position_snapshot';
  const LINK_SNAPSHOT='aml_entity_identity_link_snapshot';
  const STRUCTURE_VIEW='aml_v_ipa3_structure_peer_benchmark';
  const TRAJECTORY_VIEW='aml_v_ipa3_sii_trajectory_summary';
  const SANCTION_SUMMARY_VIEW='aml_v_ipa3_sanction_entity_summary';
  const SANCTION_IDENTITY_TABLE='aml_sanction_identity_resolution';
  const UAF_PROFILE_TABLE='aml_uaf_entity_profile';
  const OSFL_PROFILE_TABLE='aml_osfl_profile';
  const DISPOSITION_VIEW='aml_v0460_entity_disposition_current';

  const CACHE=new Map();
  const INFLIGHT=new Map();
  const TTL=5*60*1000;
  let drawerBound=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=(v,d=0)=>{const n=num(v);return n==null?'—':n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d});};
  const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
  const soft=q=>Promise.resolve(q).then(v=>v,error=>({data:null,error}));
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_error){return window.sb||null;}};
  const selected=()=>{try{return (typeof state!=='undefined'?state:(window.state||null))?.selectedEntity||null;}catch(_error){return null;}};
  const day=v=>v?String(v).slice(0,10):'—';
  const pctText=v=>{const n=num(v);return n==null?'—':`p${Math.round(n*100)}`;};

  const SIGNAL_LABELS={
    ADDRESS_HISTORY_BREADTH:'Amplitud del historial de domicilios',
    WORKFORCE_DROP_STABLE_SALES:'Caída de dotación con ventas estables',
    MAIN_ACTIVITY_CHANGE:'Cambio de actividad principal',
    REGION_CHANGE:'Cambio de región declarada',
    SALES_BAND_JUMP:'Salto de tramo de ventas',
    SALES_BAND_DROP:'Caída de tramo de ventas',
    ACTIVITY_BREADTH:'Amplitud de giros declarados',
    OWNERSHIP_BREADTH:'Amplitud de la estructura societaria'
  };
  const EVIDENCE_LABELS={
    method:'Método',procedures:'Procedimientos',regulators:'Reguladores',latest_date:'Último evento',
    procedures_36m:'Procedimientos 36 meses',procedures_60m:'Procedimientos 60 meses',
    identity_confidence:'Confianza de identidad',regulator_count_60m:'Reguladores distintos 60 meses',
    region:'Región',sector:'Sector económico',workers:'Trabajadores',driver_year:'Año conductor',
    active_years:'Años activos',prior_workers:'Trabajadores período previo',recency_factor:'Factor de recencia',
    latest_sii_year:'Último año SII',workforce_ratio:'Razón de dotación',sales_band_delta:'Variación de tramo',
    peer_level:'Nivel de comparación',peer_n:'Tamaño del grupo de pares'
  };
  const GROUPS=[
    ['registry','Registral','registry_group_score','registry_driver_mark'],
    ['economic','Económica','economic_group_score','economic_driver_mark'],
    ['sanctions','Sancionatoria','sanctions_group_score','sanctions_driver_mark']
  ];
  const GROUP_CLASS={REGISTRY:'registry',ECONOMIC_TRAJECTORY:'economic',ECONOMIC:'economic',SANCTIONS:'sanctions'};

  function bandClass(band){
    const key=String(band||'').toUpperCase();
    return key==='MUY_ALTA'?'very-high':key==='ALTA'?'high':key==='MEDIA'?'medium':key==='BAJA'?'low':'';
  }
  function bandLabel(band){
    return({MUY_ALTA:'Muy alta',ALTA:'Alta',MEDIA:'Media',BAJA:'Baja'})[String(band||'').toUpperCase()]||'Sin marca activa';
  }

  /* ------------------------------ Datos ------------------------------ */

  async function fetchPackage(entity){
    const client=db();
    const id=entity?.entity_id;
    if(!client||!id)return null;
    const rut=entity?.rut||null;
    const [score,marks,peers,structure,trajectory,sanctionSummary,sanctionIdentity,links,uaf,osfl,disposition]=await Promise.all([
      soft(client.from(SCORE_SNAPSHOT).select('*').eq('entity_id',id).maybeSingle()),
      soft(client.from(MARK_SNAPSHOT).select('*').eq('entity_id',id).order('contribution',{ascending:false,nullsFirst:false}).limit(24)),
      soft(client.from(PEER_SNAPSHOT).select('*').eq('entity_id',id).order('commercial_year',{ascending:false}).limit(8)),
      soft(client.from(STRUCTURE_VIEW).select('commercial_year,peer_level,peer_n,size_bucket,address_peer_percentile,activity_peer_percentile,address_count,current_address_count,activity_count,ownership_edge_count,legal_entity_partner_count,societies_as_partner_count,has_natural_person_aggregate,society_type,society_subtype,current_status,signal_count,signal_types,communes,address_regions').eq('entity_id',id).order('commercial_year',{ascending:false}).limit(1)),
      soft(client.from(TRAJECTORY_VIEW).select('*').eq('entity_id',id).maybeSingle()),
      soft(client.from(SANCTION_SUMMARY_VIEW).select('*').eq('entity_id',id).maybeSingle()),
      soft(client.from(SANCTION_IDENTITY_TABLE).select('sanction_id,regulator,source_entity_name,resolution_status,resolution_method,confidence,candidate_count,source_event_date').eq('resolved_entity_id',id).order('source_event_date',{ascending:false,nullsFirst:false}).limit(20)),
      soft(client.from(LINK_SNAPSHOT).select('*').or(`entidad_origen_id.eq.${id},entidad_destino_id.eq.${id}`).limit(20)),
      rut?soft(client.from(UAF_PROFILE_TABLE).select('*').eq('rut',rut).maybeSingle()):Promise.resolve({data:null}),
      soft(client.from(OSFL_PROFILE_TABLE).select('*').eq('entity_id',id).maybeSingle()),
      soft(client.from(DISPOSITION_VIEW).select('*').eq('entity_id',id).maybeSingle())
    ]);
    const one=r=>r?.data||null;
    const many=r=>Array.isArray(r?.data)?r.data:[];
    return{
      entityId:id,
      score:one(score),
      marks:many(marks),
      peers:many(peers),
      structure:many(structure)[0]||null,
      trajectory:one(trajectory),
      sanctionSummary:one(sanctionSummary),
      sanctionIdentity:many(sanctionIdentity),
      links:many(links),
      uaf:one(uaf),
      osfl:one(osfl),
      disposition:one(disposition),
      errors:[score,marks,peers,structure,trajectory,sanctionSummary,sanctionIdentity,links,uaf,osfl,disposition]
        .map(r=>r?.error?String(r.error.message||r.error):null).filter(Boolean),
      loadedAt:Date.now()
    };
  }

  function packageFor(entity){
    const id=entity?.entity_id;
    if(!id)return null;
    const hit=CACHE.get(id);
    if(hit&&Date.now()-hit.loadedAt<TTL)return hit;
    return null;
  }

  async function hydrate(pkg){
    const entity=pkg?.e;
    const id=entity?.entity_id;
    if(!id)return;
    if(INFLIGHT.has(id))return INFLIGHT.get(id);
    const job=(async()=>{
      const data=await fetchPackage(entity);
      if(data)CACHE.set(id,data);
      if(selected()===id)paint(pkg,data);
      return data;
    })().finally(()=>INFLIGHT.delete(id));
    INFLIGHT.set(id,job);
    return job;
  }

  /* ---------------------------- Fragmentos ---------------------------- */

  function ring(value,band,caption){
    const pct=Math.max(0,Math.min(100,num(value)??0));
    const radius=44,circumference=2*Math.PI*radius;
    const offset=circumference*(1-pct/100);
    return`<div class="aed-ring ${bandClass(band)}">
      <svg viewBox="0 0 104 104" role="img" aria-label="${esc(caption)}">
        <circle class="track" cx="52" cy="52" r="${radius}"></circle>
        <circle class="value" cx="52" cy="52" r="${radius}" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"></circle>
      </svg>
      <div class="aed-ring-label"><b>${num(value)==null?'—':fmt(value,1)}</b><small>IPA3</small></div>
    </div>`;
  }
  function meter(label,value,suffix='%'){
    const pct=Math.max(0,Math.min(100,num(value)??0));
    return`<div class="aed-meter"><span>${esc(label)}</span><em><i style="width:${pct}%"></i></em><b>${num(value)==null?'—':fmt(value,0)+suffix}</b></div>`;
  }
  /* El riel se dibuja con posicionamiento porcentual en HTML y no con un SVG
     estirado: un viewBox sin relacion de aspecto deformaba las etiquetas. */
  function percentileRail(label,value,detail){
    const raw=num(value);
    if(raw==null)return`<div class="aed-peer"><div class="aed-peer-head"><span>${esc(label)}</span><b>—</b></div><p class="aed-note">${esc(detail||'Percentil no materializado en el corte.')}</p></div>`;
    const pct=Math.max(0,Math.min(100,raw*100));
    return`<div class="aed-peer">
      <div class="aed-peer-head"><span>${esc(label)}</span><b>${esc(pctText(raw))}</b></div>
      <div class="aed-rail" role="img" aria-label="${esc(label)}: percentil ${Math.round(pct)} del grupo comparable">
        <span class="aed-rail-track"></span>
        ${[25,50,75].map(t=>`<span class="aed-rail-tick" style="left:${t}%"></span>`).join('')}
        <span class="aed-rail-needle" style="left:${pct.toFixed(1)}%"></span>
      </div>
      <div class="aed-rail-scale"><span>p0</span><span>p50</span><span>p100</span></div>
      <p class="aed-note">${esc(detail||'')}</p>
    </div>`;
  }
  function card(id,title,source,inner){
    return`<article class="aed-card" id="${esc(id)}"><header><h3>${esc(title)}</h3><span class="aed-src">${esc(source)}</span></header>${inner}</article>`;
  }
  function skeleton(){return'<div class="aed-skeleton">Consultando cortes gobernados…</div>';}
  function gap(title,text){return`<div class="aed-empty"><b>${esc(title)}</b>${esc(text)}</div>`;}

  /* ----------------------------- Bloques ----------------------------- */

  function identityProvenance(pkg,data){
    const entity=pkg?.e||{};
    const profile=entity.profile||{};
    const rows=[
      ['Entity ID',entity.entity_id],
      ['RUT',entity.rut||'no materializado'],
      ['Método de identidad',profile.identity_method_es||profile.identity_method||'no declarado'],
      ['Confianza de identidad',profile.identity_confidence==null?'—':fmt(profile.identity_confidence,2)],
      ['Tipo de entidad',profile.tipo_entidad_es||entity.entity_type||'—'],
      ['Territorio',[entity.commune,entity.region].filter(Boolean).join(' · ')||'no materializado'],
      ['Identificador territorial',profile?.ubicacion?.territory_id||'—'],
      ['Confianza geográfica',profile?.ubicacion?.geo_confidence==null?'—':fmt(profile.ubicacion.geo_confidence,2)],
      ['Corte de la entidad',day(entity.updated_at)],
      ['Snapshot',entity.snapshot_id||'—']
    ];
    const roles=arr(profile.roles_es).length?arr(profile.roles_es):arr(profile.roles);
    const sources=arr(profile.fuentes);
    return`<dl class="aed-dl">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v??'—')}</dd>`).join('')}</dl>
      <div><h4 class="aed-note" style="margin-bottom:7px">Roles observados</h4>${roles.length?`<div class="aed-chips">${roles.map(r=>`<span class="aed-chip">${esc(r)}</span>`).join('')}</div>`:'<p class="aed-note">Sin roles materializados.</p>'}</div>
      <div><h4 class="aed-note" style="margin-bottom:7px">Productores que aportan a la identidad</h4>${sources.length?`<div class="aed-chips">${sources.map(r=>`<span class="aed-chip">${esc(r)}</span>`).join('')}</div>`:'<p class="aed-note">Sin productores declarados en el perfil.</p>'}</div>
      <p class="aed-note">La procedencia describe cómo se construyó la identidad canónica. Un método por nombre normalizado conserva su condición de candidato aunque la confianza sea alta.</p>`;
  }

  function identityLinks(pkg,data){
    const id=pkg?.e?.entity_id;
    const links=data?.links||[];
    if(!links.length)return gap('Sin vínculos de identidad materializados','No hay entidades vinculadas a este Entity ID en el corte vigente. Ausencia de vínculo no equivale a inexistencia de la relación.');
    return`<div class="aed-table"><table>
      <thead><tr><th>Contraparte</th><th>Dirección</th><th>Tipo</th><th>Método</th><th>Confianza</th><th>Estado</th></tr></thead>
      <tbody>${links.map(link=>{
        const outgoing=link.entidad_origen_id===id;
        const other=outgoing?link.entidad_destino_id:link.entidad_origen_id;
        const review=link.requiere_revision===true;
        return`<tr>
          <td><b>${esc(other)}</b></td>
          <td><span title="${outgoing?'de esta entidad hacia la contraparte':'de la contraparte hacia esta entidad'}">${outgoing?'saliente':'entrante'}</span></td>
          <td>${esc(String(link.tipo_relacion||'—').replaceAll('_',' ').toLowerCase())}</td>
          <td>${esc(String(link.metodo_relacion||'—').replaceAll('_',' ').toLowerCase())}</td>
          <td>${link.confianza==null?'—':fmt(link.confianza,2)}</td>
          <td><span class="aed-state ${review?'warn':'good'}">${review?'candidato · requiere revisión':'confirmado'}</span></td>
        </tr>`;}).join('')}</tbody></table></div>
      <div class="aed-caution"><b>Un vínculo candidato no promueve identidad.</b> Los vínculos por nombre normalizado exacto quedan marcados para revisión y no habilitan por sí solos la fusión de expedientes ni el traspaso de atributos.</div>`;
  }

  function peerBlock(pkg,data){
    const peers=data?.peers||[];
    const structure=data?.structure||null;
    const latest=peers[0]||null;
    if(!latest&&!structure)return gap('Posición frente a pares no materializada','El corte no tiene grupo comparable para esta entidad. ATLAS no calcula percentiles con grupos incompletos ni los reemplaza por un promedio nacional.');
    const groupLabel=latest?`Grupo ${String(latest.peer_level||'').replaceAll('_',' ').toLowerCase()} · ${fmt(latest.peer_n)} pares · año ${esc(latest.commercial_year)}`:'';
    const structureLabel=structure?`Grupo ${String(structure.peer_level||'').replaceAll('_',' ').toLowerCase()} · ${fmt(structure.peer_n)} pares · año ${esc(structure.commercial_year)}`:'';
    const series=peers.slice().sort((a,b)=>Number(a.commercial_year)-Number(b.commercial_year)).filter(p=>num(p.sales_peer_percentile)!=null);
    return`<div class="aed-peers">
      ${percentileRail('Ventas dentro del grupo comparable',latest?.sales_peer_percentile,groupLabel)}
      ${percentileRail('Amplitud de domicilios frente a pares',structure?.address_peer_percentile,structureLabel)}
      ${percentileRail('Amplitud de giros frente a pares',structure?.activity_peer_percentile,structureLabel)}
    </div>
    ${series.length>1?`<div><h4 class="aed-note" style="margin-bottom:9px">Percentil de ventas por año comercial</h4><div class="aed-year-bars">${series.map(p=>{const v=Math.max(1,Math.round((num(p.sales_peer_percentile)||0)*100));return`<div class="aed-year-bar"><span>${esc(p.commercial_year)}</span><em><i style="width:${v}%"></i></em><b>${esc(pctText(p.sales_peer_percentile))}</b></div>`;}).join('')}</div></div>`:''}
    <p class="aed-note">El percentil ubica a la entidad dentro de su grupo comparable del año (sector, tamaño y edad). Es posición relativa: no describe desempeño, no es anomalía y no es riesgo.</p>`;
  }

  function trajectoryBlock(pkg,data){
    const t=data?.trajectory||null;
    if(!t)return gap('Trayectoria no materializada','No hay serie tributaria consolidada suficiente para describir trayectoria en el corte vigente.');
    const facts=[
      ['Años observados',fmt(t.year_count),`${esc(t.first_year??'—')} – ${esc(t.latest_year??'—')}`,false],
      ['Saltos de tramo',fmt(t.sales_jump_years),'años con alza de tramo de ventas',num(t.sales_jump_years)>0],
      ['Caídas de tramo',fmt(t.sales_drop_years),'años con baja de tramo de ventas',num(t.sales_drop_years)>0],
      ['Dotación a la baja con ventas estables',fmt(t.workforce_drop_stable_sales_years),'años con esa combinación',num(t.workforce_drop_stable_sales_years)>0],
      ['Cambios de actividad principal',fmt(t.main_activity_change_years),'años con cambio declarado',num(t.main_activity_change_years)>0],
      ['Cambios de región',fmt(t.region_change_years),'años con cambio declarado',num(t.region_change_years)>0],
      ['Razón mínima de dotación',t.min_workforce_ratio==null?'—':fmt(t.min_workforce_ratio,2),'dotación observada sobre la previa',false],
      ['Antigüedad',fmt(t.latest_entity_age_years),'años desde inicio de actividades',false]
    ];
    return`<div class="aed-facts">${facts.map(([label,value,detail,hot])=>`<div class="aed-fact ${hot?'hot':''}"><b>${value}</b><span>${esc(label)}<br>${esc(detail)}</span></div>`).join('')}</div>
      <p class="aed-note">Cada conteo describe años en que el hecho fue observable en la serie SII. Un cambio declarado es un hecho registral, no una señal AML por sí mismo.</p>`;
  }

  function structureBlock(pkg,data){
    const s=data?.structure||null;
    if(!s)return gap('Estructura declarada no materializada','El corte estructural no tiene fila para esta entidad.');
    const signals=String(s.signal_types||'').split('|').map(x=>x.trim()).filter(Boolean);
    const rows=[
      ['Estado publicado',s.current_status||'—'],
      ['Forma societaria',[s.society_type,s.society_subtype].filter(Boolean).join(' · ')||'—'],
      ['Domicilios publicados',fmt(s.address_count)],
      ['Domicilios vigentes',fmt(s.current_address_count)],
      ['Giros declarados',fmt(s.activity_count)],
      ['Vínculos de propiedad',fmt(s.ownership_edge_count)],
      ['Socios persona jurídica',fmt(s.legal_entity_partner_count)],
      ['Participación en otras sociedades',fmt(s.societies_as_partner_count)],
      ['Personas naturales agregadas',s.has_natural_person_aggregate===true?'Sí':s.has_natural_person_aggregate===false?'No':'—'],
      ['Regiones de domicilio',s.address_regions||'—']
    ];
    return`<dl class="aed-dl">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${signals.length?`<div><h4 class="aed-note" style="margin-bottom:7px">Señales estructurales observadas</h4><div class="aed-chips">${signals.map(x=>`<span class="aed-chip warn">${esc(SIGNAL_LABELS[x]||x.replaceAll('_',' ').toLowerCase())}</span>`).join('')}</div></div>`:'<p class="aed-note">Sin señales estructurales materializadas en el corte.</p>'}
      <p class="aed-note">La estructura proviene de información publicada por el SII. Amplitud no equivale a opacidad, y la ausencia de un dato no equivale a cero.</p>`;
  }

  function uafBlock(pkg,data){
    const uaf=data?.uaf||null;
    const observed=pkg?.e?.is_uaf_observed===true;
    if(!uaf)return`<div class="aed-empty"><b>${observed?'Registro UAF sin detalle materializado':'Sin registro UAF materializado'}</b>${observed?'La entidad figura como observada, pero el corte no trae sectores ni denominaciones de registro.':'No se afirma pertenencia ni exclusión del perímetro UAF: falta el dato rector.'}</div>`;
    return`<dl class="aed-dl">
      <dt>Sectores en el registro</dt><dd>${esc(arr(uaf.sector_names).join(' · ')||'—')}</dd>
      <dt>Denominaciones registradas</dt><dd>${esc(arr(uaf.registry_names).join(' · ')||'—')}</dd>
      <dt>Documentos fuente</dt><dd>${esc(arr(uaf.source_document_ids).join(' · ')||'—')}</dd>
      <dt>Alcance</dt><dd>${esc(uaf.source_scope||'—')}</dd>
      <dt>Corte</dt><dd>${esc(day(uaf.updated_at))}</dd>
    </dl>
    <p class="aed-note">El registro UAF es el dato rector del perímetro. La compatibilidad sectorial por ACTECO sirve para preselección y no acredita la calidad jurídica de sujeto obligado.</p>`;
  }

  function osflBlock(pkg,data){
    const o=data?.osfl||null;
    if(!o)return'';
    const flags=[
      o.fatf_r8_candidate?['Candidata FATF R8','warn']:null,
      o.law21440_active?['Ley 21.440 vigente','ok']:null,
      o.registro19862?['Registro 19.862','ok']:null,
      o.direct_confirmed?['Confirmación directa','ok']:null,
      o.source_uaf_so?['Coincidencia sujeto obligado UAF','warn']:null,
      o.source_sanction_match?['Coincidencia sancionatoria','warn']:null
    ].filter(Boolean);
    return card('aed-osfl','Perfil OSFL y FATF R8','RADAR OSFL',`<dl class="aed-dl">
      <dt>Grupo de actividad</dt><dd>${esc(o.activity_group||'—')}</dd>
      <dt>Nivel de confirmación</dt><dd>${esc(o.confirmation_level||'—')}</dd>
      <dt>Denominación de origen</dt><dd>${esc(o.source_name||'—')}</dd>
      <dt>Corte</dt><dd>${esc(day(o.updated_at))}</dd>
    </dl>
    ${flags.length?`<div class="aed-chips">${flags.map(([label,tone])=>`<span class="aed-chip ${tone}">${esc(label)}</span>`).join('')}</div>`:'<p class="aed-note">Sin marcas OSFL materializadas.</p>'}
    <div class="aed-caution"><b>Candidata R8 no es una acusación.</b> La recomendación 8 de GAFI define un universo de organizaciones sin fines de lucro a revisar por su exposición estructural; no imputa financiamiento del terrorismo a ninguna entidad concreta.</div>`);
  }

  function ipa3Block(pkg,data){
    const score=data?.score||null;
    if(!score)return gap('IPA3 no materializado para esta entidad','El corte vigente del snapshot IPA3 v0.4-shadow no contiene esta entidad. Ausencia en el corte no equivale a puntaje cero.');
    const value=num(score.ipa3_score);
    const marks=data.marks||[];
    const included=marks.filter(m=>m.included_in_score===true);
    const excluded=marks.filter(m=>m.included_in_score!==true);
    const groupValues=GROUPS.map(([cls,label,field,driver])=>[cls,label,num(score[field])||0,score[driver]]);
    const total=groupValues.reduce((acc,g)=>acc+g[2],0);
    const maxContribution=Math.max(1,...marks.map(m=>num(m.contribution)||0));
    const markMarkup=list=>list.map(m=>{
      const cls=GROUP_CLASS[String(m.score_group||'').toUpperCase()]||'';
      const contribution=num(m.contribution)||0;
      const cap=num(m.standalone_cap);
      return`<button type="button" class="aed-mark ${m.included_in_score===true?'':'excluded'}" data-aed-mark="${esc(m.mark_id)}">
        <span class="aed-mark-head">
          <b><code>${esc(m.mark_id)}</code>${esc(m.mark_name||'Marca')}</b>
          <small>${esc(String(m.primary_dimension||'').replaceAll('_',' ').toLowerCase()||'dimensión no declarada')} · ${esc(String(m.readiness||'').replaceAll('_',' ').toLowerCase()||'madurez no declarada')} · confianza ${m.confidence==null?'—':fmt(m.confidence,2)}</small>
        </span>
        <span class="aed-mark-value"><b>${fmt(contribution,1)}</b><small>${m.included_in_score===true?'aporta al puntaje':'no aporta'}</small></span>
        <span class="aed-mark-track">
          <i class="${cls}" style="width:${Math.max(2,Math.round(contribution/maxContribution*100))}%"></i>
          ${cap!=null?`<i class="cap" style="width:${Math.max(2,Math.min(100,Math.round(cap/maxContribution*100)))}%"></i>`:''}
        </span>
      </button>`;}).join('');
    return`<div class="aed-score">
      <div class="aed-dial">
        ${ring(value&&value>0?value:null,score.priority_band_shadow,'Puntaje IPA3')}
        <div class="aed-meters">
          ${meter('Confianza del cálculo',score.score_confidence_pct)}
          ${meter('Cobertura del cálculo',score.coverage_index_pct)}
          ${meter('Cobertura económica',score.economic_coverage_pct)}
        </div>
      </div>
      <div class="aed-groups">
        <div class="aed-group-bar" role="img" aria-label="Composición del puntaje por grupo">
          ${groupValues.filter(g=>g[2]>0).map(g=>`<i class="${g[0]}" style="width:${total?Math.round(g[2]/total*100):0}%"></i>`).join('')}
        </div>
        <div class="aed-group-rows">
          ${groupValues.map(([cls,label,val,driver])=>`<div class="aed-group-row"><span><i class="${cls}"></i>${esc(label)}</span><b>${val>0?fmt(val,1):'—'}</b><small>${driver?`marca conductora ${esc(driver)}`:'sin marca activa'}</small></div>`).join('')}
        </div>
        <dl class="aed-dl">
          <dt>Banda de prioridad</dt><dd>${value&&value>0?esc(bandLabel(score.priority_band_shadow)):'— · ninguna marca activa'}</dd>
          <dt>Marca dominante</dt><dd>${esc(score.dominant_mark_id||'—')}</dd>
          <dt>Marcas incluidas</dt><dd>${fmt(score.included_mark_count)} de ${fmt(marks.length)} evaluadas</dd>
          <dt>Grupos independientes</dt><dd>${fmt(score.independent_group_count)}</dd>
          <dt>Versión y corte</dt><dd>${esc(score.score_version||'—')} · calculado ${esc(day(score.score_as_of))} · snapshot ${esc(day(score.refreshed_at))}</dd>
          <dt>Estado de producción</dt><dd>${score.production_enabled===true?'habilitado':'sombra: no habilitado para decisión automática'}</dd>
        </dl>
      </div>
    </div>
    ${included.length?`<div><h4 class="aed-note" style="margin-bottom:9px">Marcas que aportan al puntaje</h4><div class="aed-marks">${markMarkup(included)}</div></div>`:'<div class="aed-empty"><b>Ninguna marca activa</b>El puntaje se muestra como "—". Ausencia de marca no equivale a prioridad baja ni a ausencia de riesgo.</div>'}
    ${excluded.length?`<div><h4 class="aed-note" style="margin-bottom:9px">Marcas evaluadas que no aportan</h4><div class="aed-marks">${markMarkup(excluded)}</div></div>`:''}
    <div class="aed-caution"><b>Prioridad analítica, no probabilidad.</b> ${esc(score.semantics||'PRIORIDAD_ANALITICA_NO_PROBABILIDAD_LAFT')}. El puntaje ordena la cola de revisión del corte y no acredita conducta de ninguna entidad.</div>`;
  }

  function sanctionIdentityBlock(pkg,data){
    const summary=data?.sanctionSummary||null;
    const rows=data?.sanctionIdentity||[];
    if(!summary&&!rows.length)return gap('Sin eventos sancionatorios resueltos','Ningún evento del Radar Sanciones quedó resuelto contra este Entity ID en el corte vigente.');
    const facts=summary?`<div class="aed-facts">
      <div class="aed-fact"><b>${fmt(summary.sanction_event_count)}</b><span>eventos resueltos<br>identidad conservadora aparte</span></div>
      <div class="aed-fact ${num(summary.sanction_count_36m)>1?'hot':''}"><b>${fmt(summary.sanction_count_36m)}</b><span>últimos 36 meses<br>recurrencia observable</span></div>
      <div class="aed-fact"><b>${fmt(summary.regulator_count_60m)}</b><span>reguladores distintos<br>en 60 meses</span></div>
      <div class="aed-fact ${num(summary.laft_direct_count)>0?'hot':''}"><b>${fmt(summary.laft_direct_count)}</b><span>eventos con vínculo<br>LA/FT directo declarado</span></div>
    </div>
    <dl class="aed-dl"><dt>Reguladores</dt><dd>${esc(arr(summary.regulators).join(' · ')||'—')}</dd>
    <dt>Último evento</dt><dd>${esc(day(summary.latest_sanction_date))}</dd>
    <dt>Confianza mínima de identidad</dt><dd>${summary.min_identity_confidence==null?'—':fmt(summary.min_identity_confidence,2)}</dd></dl>`:'';
    const table=rows.length?`<div class="aed-table"><table>
      <thead><tr><th>Evento</th><th>Regulador</th><th>Fecha</th><th>Resolución</th><th>Método</th><th>Confianza</th><th>Candidatas</th></tr></thead>
      <tbody>${rows.map(r=>{
        const source=String(r.resolution_status||'').includes('SOURCE');
        return`<tr>
          <td><code>${esc(r.sanction_id||'—')}</code><br><small>${esc(r.source_entity_name||'')}</small></td>
          <td>${esc(r.regulator||'—')}</td>
          <td>${esc(day(r.source_event_date))}</td>
          <td><span class="aed-state ${source?'good':'warn'}">${esc(String(r.resolution_status||'—').replaceAll('_',' ').toLowerCase())}</span></td>
          <td>${esc(String(r.resolution_method||'—').replaceAll('_',' ').toLowerCase())}</td>
          <td>${r.confidence==null?'—':fmt(r.confidence,2)}</td>
          <td>${fmt(r.candidate_count)}</td>
        </tr>`;}).join('')}</tbody></table></div>`:'<p class="aed-note">El corte no trae el detalle de resolución por evento.</p>';
    return`${facts}${table}
    <div class="aed-caution"><b>Identidad resuelta por fuente ≠ identidad resuelta por nombre.</b> Una resolución conservadora por nombre exacto y único conserva su condición candidata; la promoción a identidad firme es una decisión del analista y queda registrada en la auditoría.</div>`;
  }

  function transferBlock(pkg,data){
    const disposition=data?.disposition||null;
    return`${disposition?`<dl class="aed-dl">
      <dt>Última disposición</dt><dd>${esc(String(disposition.verdict||'—').replaceAll('_',' ').toLowerCase())}</dd>
      <dt>Registrada</dt><dd>${esc(day(disposition.created_at))}</dd>
      <dt>Fundamento</dt><dd>${esc(disposition.rationale||'—')}</dd>
    </dl>`:'<p class="aed-note">Sin disposición registrada para esta entidad. El registro es de sólo anexado: una rectificación se expresa anexando una disposición posterior.</p>'}
    <div class="aed-actions">
      <button type="button" class="aed-btn primary" id="aed-export">Exportar caracterización (JSON)</button>
      <button type="button" class="aed-btn" id="aed-method">Cómo se construyó esta ficha</button>
    </div>
    <p class="aed-msg" id="aed-export-msg"></p>
    <p class="aed-note">El paquete conserva identidad, marcas con su evidencia de cálculo, posición frente a pares, trayectoria, estructura, perímetro UAF y resolución de identidad sancionatoria, con el corte de cada bloque.</p>`;
  }

  /* ------------------------------ Ficha ------------------------------ */

  function ensureDrawer(root){
    if(root.querySelector('#aed-drawer'))return;
    const node=document.createElement('div');
    node.innerHTML=`<div class="aed-scrim" id="aed-scrim"></div>
      <aside class="aed-drawer" id="aed-drawer" aria-hidden="true" aria-label="Ficha metodológica">
        <header><div><span>FICHA METODOLÓGICA</span><h3 id="aed-drawer-title">—</h3></div><button type="button" id="aed-drawer-close" aria-label="Cerrar ficha">×</button></header>
        <div class="aed-drawer-body" id="aed-drawer-body"></div>
      </aside>`;
    while(node.firstElementChild)root.appendChild(node.firstElementChild);
    drawerBound=false;
  }
  function openDrawer(title,html){
    const drawer=document.querySelector('#aed-drawer'),scrim=document.querySelector('#aed-scrim');
    if(!drawer)return;
    document.querySelector('#aed-drawer-title').textContent=title;
    document.querySelector('#aed-drawer-body').innerHTML=html;
    drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');scrim?.classList.add('open');
  }
  function closeDrawer(){
    document.querySelector('#aed-drawer')?.classList.remove('open');
    document.querySelector('#aed-drawer')?.setAttribute('aria-hidden','true');
    document.querySelector('#aed-scrim')?.classList.remove('open');
  }
  function markDrawer(data,markId){
    const mark=(data?.marks||[]).find(m=>m.mark_id===markId);
    if(!mark)return;
    const evidence=mark.evidence&&typeof mark.evidence==='object'?mark.evidence:{};
    const entries=Object.entries(evidence).filter(([,v])=>v!==null&&v!=='');
    openDrawer(`${mark.mark_id} · ${mark.mark_name||'Marca'}`,`
      <section><h4>Qué mide</h4><p class="aed-note">Dimensión ${esc(String(mark.primary_dimension||'no declarada').replaceAll('_',' ').toLowerCase())}, grupo ${esc(String(mark.score_group||'no declarado').replaceAll('_',' ').toLowerCase())}. Clase semántica ${esc(String(mark.semantic_class||'no declarada').replaceAll('_',' ').toLowerCase())}.</p></section>
      <section><h4>Cómo se calculó</h4><div class="aed-formula">intensidad_bruta = ${esc(fmt(mark.raw_intensity,2))}
tope_individual  = ${esc(fmt(mark.standalone_cap,2))}
confianza        = ${esc(fmt(mark.confidence,2))}
aporte           = min(intensidad_bruta, tope_individual) × confianza = ${esc(fmt(mark.contribution,2))}
incluida         = ${mark.included_in_score===true?'sí':'no'}</div>
      <p class="aed-note">El tope individual impide que una sola marca domine el puntaje. La confianza pondera la calidad de la evidencia disponible, no la gravedad del hecho.</p></section>
      <section><h4>Evidencia del cálculo</h4>${entries.length?`<dl class="aed-dl">${entries.map(([k,v])=>`<dt>${esc(EVIDENCE_LABELS[k]||k.replaceAll('_',' '))}</dt><dd>${esc(Array.isArray(v)?v.join(' · '):typeof v==='object'?JSON.stringify(v):v)}</dd>`).join('')}</dl>`:'<p class="aed-note">La marca no trae detalle de evidencia en este corte.</p>'}</section>
      <section><h4>Procedencia</h4><dl class="aed-dl">
        <dt>Productores</dt><dd>${esc(arr(mark.source_ids).join(' · ')||'—')}</dd>
        <dt>Madurez</dt><dd>${esc(String(mark.readiness||'—').replaceAll('_',' ').toLowerCase())}</dd>
        <dt>Versión</dt><dd>${esc(mark.score_version||'—')}</dd>
        <dt>Corte del snapshot</dt><dd>${esc(day(mark.refreshed_at))}</dd>
      </dl></section>
      <div class="aed-caution"><b>Una marca no es una conclusión.</b> Describe un hecho observable con su intensidad y su confianza; sostener una hipótesis exige evidencia adicional y contrastar los vacíos declarados.</div>`);
  }
  function methodDrawer(data){
    openDrawer('Construcción de la caracterización',`
      <section><h4>Fuentes de esta ficha</h4><dl class="aed-dl">
        <dt>Puntaje y grupos</dt><dd>${esc(SCORE_SNAPSHOT)} · corte ${esc(day(data?.score?.refreshed_at))}</dd>
        <dt>Marcas</dt><dd>${esc(MARK_SNAPSHOT)} · corte ${esc(day(data?.marks?.[0]?.refreshed_at))}</dd>
        <dt>Pares (ventas)</dt><dd>${esc(PEER_SNAPSHOT)} · corte ${esc(day(data?.peers?.[0]?.refreshed_at))}</dd>
        <dt>Pares (estructura)</dt><dd>${esc(STRUCTURE_VIEW)}</dd>
        <dt>Trayectoria</dt><dd>${esc(TRAJECTORY_VIEW)}</dd>
        <dt>Sanciones</dt><dd>${esc(SANCTION_SUMMARY_VIEW)} · ${esc(SANCTION_IDENTITY_TABLE)}</dd>
        <dt>Vínculos de identidad</dt><dd>${esc(LINK_SNAPSHOT)} · corte ${esc(day(data?.links?.[0]?.refreshed_at))}</dd>
        <dt>Perímetro UAF</dt><dd>${esc(UAF_PROFILE_TABLE)}</dd>
        <dt>Perfil OSFL</dt><dd>${esc(OSFL_PROFILE_TABLE)}</dd>
      </dl></section>
      <section><h4>Reglas de lectura</h4><p class="aed-note">hecho → cálculo → evidencia → interpretación. Cada bloque declara su corte y su origen; un bloque ausente se muestra como vacío declarado y nunca se completa por analogía, promedio ni inferencia.</p></section>
      <section><h4>Límites</h4><p class="aed-note">Prioridad analítica no es probabilidad de LA/FT. Percentil de pares no es desempeño. Un vínculo no transfiere riesgo. Una sanción administrativa no acredita delito. Ausencia de dato no es cero.</p></section>
      ${data?.errors?.length?`<section><h4>Bloques no disponibles en esta carga</h4><p class="aed-note">${esc(data.errors.join(' · '))}</p></section>`:''}`);
  }

  function exportPackage(pkg,data){
    const entity=pkg?.e||{};
    return{
      schema:'ATLAS_ENTITY_CHARACTERIZATION_V1',
      release:RELEASE,
      build:BUILD,
      generated_at:new Date().toISOString(),
      entity:{entity_id:entity.entity_id,rut:entity.rut,name:entity.name,entity_type:entity.entity_type,region:entity.region,commune:entity.commune,source_count:entity.source_count,is_uaf_observed:entity.is_uaf_observed,is_sanctioned:entity.is_sanctioned,snapshot_id:entity.snapshot_id,updated_at:entity.updated_at,profile:entity.profile||null},
      ipa3:{score:data?.score||null,marks:data?.marks||[]},
      peer_position:data?.peers||[],
      structure_position:data?.structure||null,
      trajectory:data?.trajectory||null,
      sanctions:{summary:data?.sanctionSummary||null,identity_resolution:data?.sanctionIdentity||[]},
      identity_links:data?.links||[],
      uaf_registry:data?.uaf||null,
      osfl_profile:data?.osfl||null,
      disposition_current:data?.disposition||null,
      guardrails:{
        priority_is_not_probability:true,
        peer_percentile_is_position_not_performance:true,
        relationship_does_not_transfer_risk:true,
        candidate_identity_stays_candidate:true,
        administrative_sanction_is_not_crime:true,
        missing_is_not_zero:true
      }
    };
  }

  function download(name,payload){
    const text=JSON.stringify(payload,null,2);
    if(typeof v17Download==='function'){v17Download(name,text,'application/json;charset=utf-8');return;}
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();
    anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  /* ------------------------------ Montaje ------------------------------ */

  function mount(root,panelName,markup,variant=''){
    const panel=root.querySelector(`[data-a45-panel="${panelName}"]`);
    if(!panel)return null;
    let holder=panel.querySelector(`[data-aed-holder="${panelName}"]`);
    if(!holder){
      holder=document.createElement('div');
      holder.dataset.aedHolder=panelName;
      holder.style.marginTop='16px';
      panel.appendChild(holder);
    }
    holder.className=`aed-grid ${variant}`.trim();
    holder.innerHTML=markup;
    return holder;
  }

  function paint(pkg,data){
    const root=document.querySelector('#content .a45');
    if(!root)return;
    ensureDrawer(root);
    const ready=!!data;
    mount(root,'identity',
      card('aed-provenance','Procedencia de la identidad','FUSION · PERFIL',ready?identityProvenance(pkg,data):skeleton())+
      card('aed-links','Vínculos de identidad gobernados',LINK_SNAPSHOT.toUpperCase(),ready?identityLinks(pkg,data):skeleton()),'g12');
    mount(root,'character',
      card('aed-peer','Posición frente a pares comparables','IPA3 · PARES',ready?peerBlock(pkg,data):skeleton())+
      card('aed-trajectory','Trayectoria observada','IPA3 · TRAYECTORIA',ready?trajectoryBlock(pkg,data):skeleton())+
      card('aed-structure','Estructura declarada','SII · ESTRUCTURA',ready?structureBlock(pkg,data):skeleton())+
      card('aed-uaf','Registro UAF materializado','RADAR UAF',ready?uafBlock(pkg,data):skeleton())+
      (ready?osflBlock(pkg,data):''),'g11');
    mount(root,'signals',
      card('aed-ipa3','Descomposición IPA3 v0.4-shadow','IPA3 · MARCAS',ready?ipa3Block(pkg,data):skeleton()));
    mount(root,'evidence',
      card('aed-sanction-identity','Resolución de identidad en sanciones','SANCIONES · IDENTIDAD',ready?sanctionIdentityBlock(pkg,data):skeleton())+
      card('aed-transfer','Transferencia analítica y disposición','ATLAS 0510',ready?transferBlock(pkg,data):skeleton()),'g21');
    bind(root,pkg,data);
    window.__ATLAS_ENTITY_DOSSIER_0510__={
      active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,
      entityId:pkg?.e?.entity_id||null,hydrated:ready,
      blocks:['provenance','identity-links','peer','trajectory','structure','uaf','osfl','ipa3','sanction-identity','transfer'],
      errors:data?.errors||[],renderedAt:new Date().toISOString()
    };
  }

  function bind(root,pkg,data){
    if(!drawerBound){
      document.querySelector('#aed-drawer-close')?.addEventListener('click',closeDrawer);
      document.querySelector('#aed-scrim')?.addEventListener('click',closeDrawer);
      drawerBound=true;
    }
    root.querySelectorAll('[data-aed-mark]').forEach(button=>{
      if(button.dataset.aedBound==='1')return;
      button.dataset.aedBound='1';
      button.addEventListener('click',()=>markDrawer(data,button.dataset.aedMark));
    });
    const method=root.querySelector('#aed-method');
    if(method&&method.dataset.aedBound!=='1'){method.dataset.aedBound='1';method.addEventListener('click',()=>methodDrawer(data));}
    const exporter=root.querySelector('#aed-export');
    if(exporter&&exporter.dataset.aedBound!=='1'){
      exporter.dataset.aedBound='1';
      exporter.addEventListener('click',async()=>{
        const message=root.querySelector('#aed-export-msg');
        try{
          const entity=pkg?.e||{};
          const name=`atlas_caracterizacion_${String(entity.rut||entity.entity_id||'entidad').replace(/[^0-9A-Za-zKk-]/g,'_')}_${new Date().toISOString().slice(0,10)}.json`;
          if(typeof audit==='function')await audit('EXPORT',{objectType:'entity_characterization',objectId:entity.entity_id,payload:{format:'json',schema:'ATLAS_ENTITY_CHARACTERIZATION_V1',build:BUILD}}).catch(()=>{});
          download(name,exportPackage(pkg,data));
          if(message){message.textContent='Paquete de caracterización descargado y registrado en la auditoría.';message.className='aed-msg ok';}
        }catch(error){
          if(message){message.textContent='No fue posible exportar: '+String(error?.message||error);message.className='aed-msg error';}
        }
      });
    }
  }

  function decorate(pkg){
    if(!pkg?.e?.entity_id)return;
    const data=packageFor(pkg.e);
    paint(pkg,data);
    if(!data)void hydrate(pkg);
  }

  function render(pkg,preserve=false){
    const result=BASE_RENDER(pkg,preserve);
    try{decorate(pkg);}catch(_error){}
    return result;
  }

  try{v0203RenderEntity=render;}catch(_error){}
  window.v0203RenderEntity=render;

  window.__ATLAS_ENTITY_DOSSIER_0510__={
    active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,
    sources:[SCORE_SNAPSHOT,MARK_SNAPSHOT,PEER_SNAPSHOT,LINK_SNAPSHOT,STRUCTURE_VIEW,TRAJECTORY_VIEW,SANCTION_SUMMARY_VIEW,SANCTION_IDENTITY_TABLE,UAF_PROFILE_TABLE,OSFL_PROFILE_TABLE,DISPOSITION_VIEW],
    cachePolicy:'MEMORY_ONLY',
    authMutation:false,
    installedAt:new Date().toISOString()
  };
})();
