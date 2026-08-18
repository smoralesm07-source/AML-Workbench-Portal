'use strict';

/* AML Workbench v0.34.1 · sanctions integration hardening
 * - honors the real Radar_sanciones event contract (rut_fuente/entity_id/source_record_id/evidence_id)
 * - canonicalizes RUT entity ids to the shared Entity Hub convention
 * - enriches raw-only events with Radar_sanciones/entity_hub_v1.json
 * - sanitizes external evidence URLs
 * - keeps IER as an entity-level priority calculated from complete evidence; UI filters do not rewrite it
 * - exposes runtime health metadata for operational diagnostics
 */
const V0341_VERSION='0.34.1';
const V0341_RADAR_ENTITY_HUB='https://raw.githubusercontent.com/smoralesm07-source/Radar_sanciones/main/docs/data/entity_hub_v1.json';

function v0341SafeHttpUrl(value){
  const s=String(value||'').trim();
  if(!s)return '';
  try{const u=new URL(s);return (u.protocol==='https:'||u.protocol==='http:')?u.href:'';}catch{return '';}
}
function v0341CanonicalRut(value){
  const rut=v034RutFromText(value);
  return rut?rut.replace(/\./g,'').toUpperCase():null;
}
function v0341CanonicalEntityId(rut,fallback=null){
  const r=v0341CanonicalRut(rut);
  return r?`ENT-RUT-${r}`:(fallback?String(fallback):null);
}
function v0341CleanName(value){
  let s=String(value||'').replace(/\s+/g,' ').trim();
  s=s.replace(/\s+\d+(?:[.,]\d+)?\s*(?:UF|UTM|UTA|CLP|PESOS?)\s*$/i,'').trim();
  return s||'Entidad no resuelta';
}
function v0341WeakName(value){
  const n=v034Norm(value),words=n.split(/\s+/).filter(Boolean);
  if(!n||words.length<2)return true;
  return /^(S A|SPA|LTDA|LIMITADA)$/.test(n)||/^(PREGUNTA|REMITIR|EN EL CASO|MANDATO DE|RESPECTO A|COPIA DEL)/.test(n);
}

const v0341BaseNormalizeRaw=v034NormalizeRaw;
v034NormalizeRaw=function(r){
  const p=r&&typeof r==='object'?r:{};
  const out=v0341BaseNormalizeRaw(p);
  const rut=v0341CanonicalRut(p.rut_fuente||p.rut||p.subject_rut||out.rut||out.subject||out.name);
  out.rut=rut;
  out.entityId=v0341CanonicalEntityId(rut,p.entity_id||out.entityId);
  out.name=v0341CleanName(p.sujeto_fuente||p.entity_name||p.sancionado||p.nombre||out.name);
  out.rawId=String(p.id||p.event_id||out.rawId||'');
  out.sourceRecordId=String(p.source_record_id||'');
  out.evidenceId=String(p.evidence_id||'');
  out.documentStatus=String(p.document_status||'');
  out.documentConfidence=Number.isFinite(Number(p.document_confidence))?Number(p.document_confidence):null;
  out.sourceUrl=v0341SafeHttpUrl(p.resolution_url||p.source_url||out.sourceUrl);
  return out;
};

const v0341BaseNormalizeGoverned=v034NormalizeGoverned;
v034NormalizeGoverned=function(r){
  const out=v0341BaseNormalizeGoverned(r),p=v034Payload(r);
  const rut=v0341CanonicalRut(v034First(p,['rut_fuente','rut','subject_rut','entity_rut'])||out.rut||out.subject||out.name);
  out.rut=rut;
  if(!out.entityId)out.entityId=v0341CanonicalEntityId(rut,null);
  out.name=v0341CleanName(out.name);
  out.sourceRecordId=String(v034First(p,['source_record_id'])||'');
  out.evidenceId=String(v034First(p,['evidence_id'])||'');
  out.documentStatus=String(v034First(p,['document_status'])||'');
  const dc=Number(v034First(p,['document_confidence']));out.documentConfidence=Number.isFinite(dc)?dc:null;
  out.sourceUrl=v0341SafeHttpUrl(out.sourceUrl);
  return out;
};

function v0341MergeAliases(e){
  const a=[];
  if(e.rawId)a.push(`RAW:${e.rawId}`);
  if(e.sourceRecordId)a.push(`SRC:${e.sourceRecordId}`);
  if(e.evidenceId)a.push(`EVD:${e.evidenceId}`);
  if(e.rut)a.push(`R:${e.regulator}|${e.date}|${e.resolution}|${e.rut}`);
  a.push(`K:${e.regulator}|${e.date}|${v034Norm(e.resolution)}|${v034Norm(e.name)}`);
  return a;
}
v034MergeEvents=function(raw,gov){
  const index=new Map();
  for(const g of gov||[])for(const k of v0341MergeAliases(g))if(!index.has(k))index.set(k,g);
  const out=[],usedGov=new Set(),seen=new Set();
  for(const r of raw||[]){
    let g=null;for(const k of v0341MergeAliases(r)){if(index.has(k)){g=index.get(k);break;}}
    const e=g?{...r,...g,id:r.id||g.id,source:'RADAR+WORKBENCH',sourceUrl:g.sourceUrl||r.sourceUrl,
      payload:{...(r.payload||{}),...(g.payload||{})},rut:g.rut||r.rut,entityId:g.entityId||r.entityId,
      sourceRecordId:g.sourceRecordId||r.sourceRecordId,evidenceId:g.evidenceId||r.evidenceId}:r;
    if(g)usedGov.add(g.id);
    const dedupe=e.id||v034EventKey(e);if(seen.has(dedupe))continue;seen.add(dedupe);out.push(e);
  }
  for(const g of gov||[]){if(usedGov.has(g.id))continue;const dedupe=g.id||v034EventKey(g);if(!seen.has(dedupe)){seen.add(dedupe);out.push(g);}}
  return out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
};

const v0341BaseBuildSubjects=v034BuildSubjects;
v034BuildSubjects=function(events,uaf){
  const subjects=v0341BaseBuildSubjects(events,uaf);
  for(const s of subjects){
    const governed=String(s.uafRow?.resolved_name||'').trim();
    if(governed&&(!s.name||v0341WeakName(s.name)||governed.length>=s.name.length*.55))s.name=v0341CleanName(governed);
    else s.name=v0341CleanName(s.name);
    if((!s.sector||s.sector==='Sin sector')&&s.uafRow?.main_activity){const inferred=v034InferSector(s.uafRow.main_activity);if(inferred)s.sector=inferred;}
  }
  return subjects;
};

function v0341HubLookup(rows){
  const byRut=new Map(),bySource=new Map(),byCanonical=new Map();
  for(const h of Array.isArray(rows)?rows:[]){
    const rut=v0341CanonicalRut(h.rut);if(rut)byRut.set(rut,h);
    if(h.source_entity_id)bySource.set(String(h.source_entity_id),h);
    if(h.entity_id)byCanonical.set(String(h.entity_id),h);
  }
  return {byRut,bySource,byCanonical,count:Array.isArray(rows)?rows.length:0};
}
const v0341BaseLoadData=v034LoadData;
v034LoadData=async function(){
  const hubPromise=v034FetchJson(V0341_RADAR_ENTITY_HUB).then(v0341HubLookup).catch(()=>null);
  const [data,hub]=await Promise.all([v0341BaseLoadData(),hubPromise]);
  if(!hub){data.degraded.push('Entity Hub de Radar Sanciones no respondió; se mantiene identidad gobernada de Workbench/RUT.');return data;}
  data.radarHubCount=hub.count;
  for(const s of data.subjects){
    const h=(s.rut&&hub.byRut.get(v0341CanonicalRut(s.rut)))||hub.byCanonical.get(String(s.entityId||''))||null;
    if(!h)continue;
    s.hubIdentity={entityId:h.entity_id||null,status:h.identity_status||null,method:h.identity_method||null,confidence:h.identity_confidence??null,canonicalName:h.canonical_name||null};
    if(!s.uafRow&&h.canonical_name&&!v0341WeakName(h.canonical_name))s.name=v0341CleanName(h.canonical_name);
    if(!s.entityId&&h.entity_id)s.entityId=String(h.entity_id);
  }
  return data;
};

v034RenderMethod=function(){
  const m=V034.data.meta,hub=v034Fmt(V034.data.radarHubCount||0);
  v034El('sv12-method').innerHTML=`<div><b>Autoridad de datos.</b> Radar Sanciones gobierna eventos; Entity Hub/RUT y la materialización Workbench gobiernan identidad; la conciliación UAF gobierna la condición “SO inscrito”. “Potencial SO” es sólo screening y no una determinación jurídica.</div><div><b>IER.</b> El Índice de Exposición Relativa se recalcula cuando se actualiza la evidencia del módulo y usa la historia completa de la entidad. Los filtros de pantalla no reescriben el score: sólo cambian lo que se visualiza. Es prioridad analítica, no probabilidad de LA/FT.</div><div><b>Actualización.</b> Fuente sanciones: ${v034Esc(m.sourceGenerated||'fecha no disponible')} · último evento ${v034Esc(m.sourceLatest||'—')}. Materialización Workbench: último evento ${v034Esc(m.materializedLatest||'—')} · actualización ${v034Esc(m.materializedUpdated||'—')}.</div><div><b>Interoperabilidad.</b> Entity Hub de Radar Sanciones: ${hub} identidades disponibles en esta carga. Los RUT se normalizan al identificador canónico ENT-RUT-&lt;RUT&gt;. La actividad SII/ACTECO puede apoyar screening, pero no acredita por sí sola calidad jurídica de sujeto obligado.</div>`;
};

const v0341BaseOpenDrawer=v034OpenDrawer;
v034OpenDrawer=function(key){
  v0341BaseOpenDrawer(key);
  const s=V034?.data?.subjects?.find(x=>x.key===key),body=v034El('sv12-drawer-body');if(!s||!body)return;
  const h=s.hubIdentity,ev=s.events.find(e=>e.evidenceId||e.sourceRecordId||e.documentStatus);
  if(!h&&!ev)return;
  const confidence=h?.confidence==null?'—':`${Math.round(Number(h.confidence)*100)}%`;
  body.insertAdjacentHTML('beforeend',`<h3>Trazabilidad de identidad y evidencia</h3><div class="sv12-status"><b>${h?'Entity Hub':'Evento fuente'}</b><p>${h?`Estado ${v034Esc(h.status||'—')} · método ${v034Esc(h.method||'—')} · confianza ${v034Esc(confidence)} · ID ${v034Esc(h.entityId||'—')}`:`Identidad aún no materializada en Entity Hub.`}</p>${ev?`<p>Registro fuente ${v034Esc(ev.sourceRecordId||'—')} · evidencia ${v034Esc(ev.evidenceId||'—')} · documento ${v034Esc(ev.documentStatus||'—')}${ev.documentConfidence==null?'':` · confianza documental ${Math.round(ev.documentConfidence*100)}%`}</p>`:''}</div>`);
};

const v0341BaseLoadSanctions=loadSanctions;
loadSanctions=async function(){
  const result=await v0341BaseLoadSanctions();
  window.__AML_BUILD__=V0341_VERSION;
  const version=document.querySelector('.v019-brand small');if(version)version.textContent=`Operational Radar · v${V0341_VERSION}`;
  return result;
};
if(window.AML_SANCTIONS_V12){
  window.AML_SANCTIONS_V12.version=V0341_VERSION;
  window.AML_SANCTIONS_V12.reload=loadSanctions;
  window.AML_SANCTIONS_V12.health=()=>({
    version:V0341_VERSION,loaded:!!V034,eventCount:V034?.data?.events?.length||0,entityCount:V034?.data?.subjects?.length||0,
    radarHubCount:V034?.data?.radarHubCount||0,sourceLatest:V034?.data?.meta?.sourceLatest||null,
    materializedLatest:V034?.data?.meta?.materializedLatest||null,degraded:[...(V034?.data?.degraded||[])]
  });
}
