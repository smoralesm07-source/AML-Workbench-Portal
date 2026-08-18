'use strict';

/* AML Workbench v0.34.0 · Radar Sanciones v12 integration
 * Presentation contract: accepted v12 UI.
 * Data contract:
 *   - Radar_sanciones docs/data/events.json is authoritative for sanction events.
 *   - aml_v028_sanctions_with_identity enriches those events with governed identity.
 *   - aml_v0205_uaf_sii_reconciliation is authoritative for current UAF registration.
 *   - "Potencial SO" is screening only; never a legal determination.
 *   - IER is recalculated client-side after every refresh/filter from current evidence.
 */
const V034_VERSION='0.34.0';
const V034_SANCTIONS_VIEW='aml_v028_sanctions_with_identity';
const V034_UAF_VIEW='aml_v0205_uaf_sii_reconciliation';
const V034_RADAR_EVENTS='https://raw.githubusercontent.com/smoralesm07-source/Radar_sanciones/main/docs/data/events.json';
const V034_RADAR_META='https://raw.githubusercontent.com/smoralesm07-source/Radar_sanciones/main/docs/data/metadata.json';
const V034_PAGE=1000;
const v034LegacyLoadSanctions=typeof loadSanctions==='function'?loadSanctions:null;
const v034NF=new Intl.NumberFormat('es-CL');
const v034Fmt=n=>v034NF.format(Math.round(Number(n)||0));
const v034Fmt1=n=>(Number(n)||0).toFixed(1).replace('.',',');
const v034Pct=(v,d=1)=>Number.isFinite(v)?`${(v*100).toFixed(d).replace('.',',')}%`:'—';
const v034Esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const v034Norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const v034Date=s=>s?new Date(`${String(s).slice(0,10)}T12:00:00`):null;
const v034Months=(a,b)=>Math.max(0,(b-a)/(1000*60*60*24*30.4375));
const V034_REGIONS=[
 ['Arica y Parinacota',['ARICA','PARINACOTA']],['Tarapacá',['TARAPACA','IQUIQUE','ALTO HOSPICIO']],
 ['Antofagasta',['ANTOFAGASTA','CALAMA','TOCOPILLA','MEJILLONES']],['Atacama',['ATACAMA','COPIAPO','VALLENAR']],
 ['Coquimbo',['COQUIMBO','LA SERENA','OVALLE']],['Valparaíso',['VALPARAISO','VINA DEL MAR','QUILPUE','SAN ANTONIO','QUILLOTA']],
 ['Metropolitana',['METROPOLITANA','SANTIAGO','PROVIDENCIA','LAS CONDES','VITACURA','NUNOA','PUDAHUEL','MAIPU']],
 ['O’Higgins',['OHIGGINS','RANCAGUA','SAN FERNANDO']],['Maule',['MAULE','TALCA','CURICO','LINARES']],
 ['Ñuble',['NUBLE','CHILLAN']],['Biobío',['BIOBIO','CONCEPCION','TALCAHUANO','LOS ANGELES']],
 ['Araucanía',['ARAUCANIA','TEMUCO','VILLARRICA','ANGOL']],['Los Ríos',['LOS RIOS','VALDIVIA']],
 ['Los Lagos',['LOS LAGOS','PUERTO MONTT','OSORNO','CASTRO']],['Aysén',['AYSEN','COYHAIQUE']],
 ['Magallanes',['MAGALLANES','PUNTA ARENAS']]
];
const V034_UAF_SECTOR_PATTERNS=[
 ['Bancos',/\bBANCO\b/],['Compañías de Seguro',/\bSEGUROS?\b/],['Empresas de factoraje (Factoring)',/\bFACTORING\b|\bFACTORAJE\b/],
 ['Casas de cambio',/\bCASA(?:S)? DE CAMBIO\b|\bCAMBIO\b/],['Empresas de leasing',/\bLEASING\b/],
 ['Casinos de Juego',/\bCASINO\b/],['Corredores de seguros',/\bCORREDOR(?:ES)? DE SEGUROS?\b/],
 ['Administradoras generales de fondos',/\bADMINISTRADORA.*FONDOS?\b|\bAGF\b/],
 ['Administradoras de Mutuos Hipotecarios',/\bMUTUOS? HIPOTECARIOS?\b/],
 ['Empresas de transferencia de dinero',/\bTRANSFERENCIA(?:S)? DE DINERO\b|\bREMESAS?\b/],
 ['Notarios',/\bNOTARI[OA]\b/],['Conservadores',/\bCONSERVADOR\b/],
 ['Agentes de aduana',/\bAGENTE(?:S)? DE ADUANA\b/],['Cooperativas de ahorro y crédito',/\bCOOPERATIVA.*AHORRO\b/]
];
const V034_SUPERVISOR_LABELS={UAF:'UAF',CMF:'CMF',SCJ:'SCJ',SP:'SP',SUSESO:'SUSESO',SMA:'SMA'};
let V034=null;

function v034El(id){return document.getElementById(id);}
function v034Payload(r){const p=r?.payload;return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}
function v034First(obj,keys){for(const k of keys){if(obj&&obj[k]!=null&&String(obj[k]).trim()!=='')return obj[k];}return null;}
function v034RutFromText(...parts){
 const s=parts.filter(Boolean).join(' ');
 const m=s.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]|\d{7,8}-[\dkK])\b/);
 return m?m[1].replace(/\./g,'').toUpperCase():null;
}
function v034InferSector(...parts){
 const n=v034Norm(parts.filter(Boolean).join(' '));
 for(const [sector,re] of V034_UAF_SECTOR_PATTERNS)if(re.test(n))return sector;
 return null;
}
function v034InferRegion(...parts){
 const n=v034Norm(parts.filter(Boolean).join(' '));
 for(const [region,aliases] of V034_REGIONS)if(aliases.some(a=>n.includes(a)))return region;
 return null;
}
function v034Category(subject,payload){
 const explicit=v034First(payload,['categoria','category','materia_categoria','topic']);
 if(explicit)return String(explicit);
 const n=v034Norm(subject);
 if(/LAVADO|19 913|LAFT|LA FT|PREVENCION.*LAVADO|DEBIDA DILIGENCIA|REPORTE.*SOSPECH/.test(n))return 'Prevención LA/FT';
 if(/GOBIERNO CORPORATIVO|DIRECTOR|ADMINISTRADOR/.test(n))return 'Gobierno corporativo';
 if(/INFORMACION|REPORT|ENTREGA|REMISION/.test(n))return 'Deberes de información';
 if(/CAPITAL|PATRIMONIO|SOLVENCIA/.test(n))return 'Solvencia / patrimonio';
 if(/CONDUCTA|CLIENTE|MERCADO/.test(n))return 'Conducta de mercado';
 return 'Cumplimiento regulatorio';
}
function v034Resolution(r,p){
 return String(v034First(p,['resolucion','resolution','resolution_number','numero_resolucion','resolucion_numero'])||r.resolution||'').trim();
}
function v034EventKey(x){
 return [
   String(x.regulator||''),String(x.date||''),v034Norm(x.resolution||''),
   v034Norm(x.name||''),v034Norm(x.subject||'')
 ].join('|');
}
async function v034FetchJson(url){
 const r=await fetch(`${url}${url.includes('?')?'&':'?'}t=${Date.now()}`,{cache:'no-store'});
 if(!r.ok)throw new Error(`HTTP ${r.status} al consultar ${url}`);
 return r.json();
}
async function v034FetchGoverned(){
 const out=[];let from=0;
 for(;;){
   const {data,error}=await sb.from(V034_SANCTIONS_VIEW)
     .select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,resolution_method,identity_confidence,laft_direct,amount_uf,subject,snapshot_id,updated_at,payload')
     .order('event_date',{ascending:false,nullsFirst:false}).range(from,from+V034_PAGE-1);
   if(error)throw error;
   const rows=data||[];out.push(...rows);
   if(rows.length<V034_PAGE)break;from+=V034_PAGE;
   if(from>10000)break;
 }
 return out;
}
async function v034FetchUaf(entityIds,ruts){
 const rows=[];
 const chunk=async(field,values)=>{
   for(let i=0;i<values.length;i+=150){
     const vals=values.slice(i,i+150);
     const {data,error}=await sb.from(V034_UAF_VIEW)
       .select('entity_id,rut,resolved_name,uaf_category_hint,reconciliation_status,main_activity,sii_current_status')
       .in(field,vals);
     if(error)throw error;rows.push(...(data||[]));
   }
 };
 if(entityIds.length)await chunk('entity_id',entityIds);
 if(ruts.length)await chunk('rut',ruts);
 const {count,error}=await sb.from(V034_UAF_VIEW).select('entity_id',{count:'exact',head:true});
 if(error)throw error;
 const byEntity=new Map(),byRut=new Map();
 for(const r of rows){if(r.entity_id)byEntity.set(String(r.entity_id),r);if(r.rut)byRut.set(String(r.rut).replace(/\./g,'').toUpperCase(),r);}
 return {byEntity,byRut,total:count||0};
}
function v034NormalizeGoverned(r){
 const p=v034Payload(r),subject=String(r.subject||v034First(p,['resumen','reason','subject','materia'])||'');
 const name=String(r.entity_name||v034First(p,['sancionado','sanctioned_subject','entity_name','nombre'])||'Entidad no resuelta');
 const rut=v034RutFromText(v034First(p,['rut','subject_rut','entity_rut']),name,subject);
 const resolution=v034Resolution(r,p);
 return {
   id:String(r.sanction_id||v034First(p,['id','event_id','record_key'])||v034EventKey({regulator:r.regulator,date:r.event_date,resolution,name,subject})),
   rawId:String(v034First(p,['id','event_id'])||''),
   date:String(r.event_date||v034First(p,['fecha','date'])||'').slice(0,10),
   regulator:String(r.regulator||v034First(p,['supervisor','source_id'])||'').toUpperCase(),
   name,entityId:r.entity_id?String(r.entity_id):null,rut,
   identityStatus:r.identity_status||'',identityConfidence:Number(r.identity_confidence||0),
   laft:!!r.laft_direct,amountUF:r.amount_uf==null?null:Number(r.amount_uf),
   subject,category:v034Category(subject,p),resolution,
   sourceUrl:String(v034First(p,['resolution_url','source_url','url'])||''),
   updatedAt:r.updated_at||'',payload:p,source:'WORKBENCH'
 };
}
function v034NormalizeRaw(r){
 const p=r&&typeof r==='object'?r:{},subject=String(p.resumen||p.subject||p.materia||p.reason||p.categoria||'');
 const name=String(p.sujeto_fuente||p.entity_name||p.sancionado||p.nombre||'Entidad no resuelta');
 const rut=v034RutFromText(p.rut,p.subject_rut,name,subject);
 const regulator=String(p.supervisor||p.regulator||p.source_id||'').toUpperCase();
 const resolution=String(p.resolucion||p.resolution||p.resolution_number||'');
 return {
   id:String(p.id||p.event_id||v034EventKey({regulator,date:p.fecha||p.date,resolution,name,subject})),
   rawId:String(p.id||p.event_id||''),date:String(p.fecha||p.date||'').slice(0,10),regulator,name,entityId:null,rut,
   identityStatus:'RAW_PENDING_RECONCILIATION',identityConfidence:0,laft:!!p.laft_directo,
   amountUF:String(p.unidad||'').toUpperCase()==='UF'&&p.monto!=null?Number(p.monto):null,
   subject,category:String(p.categoria||v034Category(subject,p)),resolution,
   sourceUrl:String(p.resolution_url||p.source_url||''),updatedAt:'',payload:p,source:'RADAR'
 };
}
function v034MergeEvents(raw,gov){
 const byRaw=new Map(),byKey=new Map();
 for(const g of gov){
   if(g.rawId)byRaw.set(g.rawId,g);
   byKey.set(v034EventKey(g),g);
 }
 const out=[],seen=new Set();
 for(const r of raw){
   const g=(r.rawId&&byRaw.get(r.rawId))||byKey.get(v034EventKey(r));
   const e=g?{...r,...g,id:r.id||g.id,source:'RADAR+WORKBENCH',sourceUrl:g.sourceUrl||r.sourceUrl,payload:{...r.payload,...g.payload}}:r;
   if(seen.has(e.id))continue;seen.add(e.id);out.push(e);
 }
 for(const g of gov){if(!seen.has(g.id)){seen.add(g.id);out.push(g);}}
 return out.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function v034Potential(subject){
 if(subject.isSO)return {yes:false,strength:0,reason:'Inscrito actualmente en UAF'};
 const evs=subject.events,n=v034Norm([subject.name,subject.sector,...evs.map(e=>`${e.subject} ${e.category}`)].join(' '));
 if(evs.some(e=>e.regulator==='UAF'))return {yes:true,strength:1,reason:'Sanción UAF sin coincidencia en el registro UAF vigente; requiere revisar baja histórica o identidad.'};
 if(evs.some(e=>e.laft))return {yes:true,strength:.9,reason:'Evento sancionatorio marcado como materia LA/FT directa sin inscripción UAF vigente observable.'};
 if(subject.sector&&V034_UAF_SECTOR_PATTERNS.some(([s])=>v034Norm(s)===v034Norm(subject.sector)))
   return {yes:true,strength:.72,reason:`Sector analítico «${subject.sector}» compatible con un sector sujeto a obligación; señal de screening.`};
 if(/\bLEY 19 913\b|\bUAF\b|\bPREVENCION.*LAVADO\b/.test(n))
   return {yes:true,strength:.65,reason:'Materia/documento contiene referencia explícita al perímetro UAF/LA-FT.'};
 return {yes:false,strength:0,reason:'Sin evidencia suficiente para marcar Potencial SO.'};
}
function v034Recurrence(n){return n<=1?0:n===2?8:n===3?14:n===4?18:22;}
function v034Severity(uf){return uf>0?Math.min(20,20*Math.log1p(uf)/Math.log1p(10000)):0;}
function v034Ier(s,asOf){
 const recurrence=v034Recurrence(s.events.length);
 const uf=s.events.reduce((a,e)=>a+(Number(e.amountUF)||0),0),severity=v034Severity(uf);
 const direct=s.events.filter(e=>e.laft).length,laft=s.events.length?18*direct/s.events.length:0;
 const convergence=s.supervisors.length<=1?0:s.supervisors.length===2?6:12;
 const latest=s.latest?v034Date(s.latest):null,months=latest?v034Months(latest,asOf):999;
 const recency=15*Math.pow(.5,months/24);
 const network=Math.min(8,(s.degree||0)*2);
 const gap=s.potential?.yes?(s.potential.strength>=.9?15:s.potential.strength>=.7?12:9):0;
 const raw=recurrence+severity+laft+convergence+recency+network+gap,score=Math.min(100,raw);
 const band=score>=70?'Crítico':score>=50?'Alto':score>=30?'Medio':'Bajo';
 return {score,band,uf,factors:[
   ['Recurrencia sancionatoria',recurrence,22],['Severidad / magnitud UF',severity,20],['Materia LA/FT directa',laft,18],
   ['Convergencia supervisora',convergence,12],['Recencia',recency,15],['Vinculación documental',network,8],['Brecha de perímetro',gap,15]
 ]};
}
function v034BuildSubjects(events,uaf){
 const groups=new Map();
 for(const e of events){
   const uafRow=(e.entityId&&uaf.byEntity.get(e.entityId))||(e.rut&&uaf.byRut.get(e.rut));
   if(uafRow){e.entityId=e.entityId||uafRow.entity_id;e.rut=e.rut||uafRow.rut;e.name=e.name==='Entidad no resuelta'?(uafRow.resolved_name||e.name):e.name;}
   const key=e.entityId?`E:${e.entityId}`:e.rut?`R:${e.rut}`:`N:${v034Norm(e.name)}`;
   if(!groups.has(key))groups.set(key,{key,entityId:e.entityId||null,rut:e.rut||null,name:e.name||'Entidad no resuelta',events:[],uafRow:null});
   const s=groups.get(key);s.events.push(e);s.entityId=s.entityId||e.entityId;s.rut=s.rut||e.rut;
   if(uafRow)s.uafRow=uafRow;
 }
 const resolutionGroups=new Map();
 for(const s of groups.values())for(const e of s.events){
   if(!e.resolution)continue;const k=`${e.regulator}|${e.date}|${v034Norm(e.resolution)}`;
   if(!resolutionGroups.has(k))resolutionGroups.set(k,new Set());resolutionGroups.get(k).add(s.key);
 }
 const degree=new Map();
 for(const set of resolutionGroups.values())if(set.size>1)for(const k of set)degree.set(k,(degree.get(k)||0)+(set.size-1));
 const asOf=new Date();
 const subjects=[...groups.values()].map(s=>{
   s.isSO=!!s.uafRow;
   s.sector=String(s.uafRow?.uaf_category_hint||v034First(s.events.map(e=>e.payload).find(Boolean),['sector_analitico','sector','uaf_sector','sector_fuente'])||v034InferSector(s.name,...s.events.map(e=>`${e.subject} ${e.category}`))||'Sin sector');
   s.region=String(v034First(s.events.map(e=>e.payload).find(p=>v034First(p,['region','region_name','region_nombre'])),['region','region_name','region_nombre'])||v034InferRegion(s.name,...s.events.map(e=>`${e.subject} ${JSON.stringify(e.payload||{})}`))||'Sin región observable');
   s.supervisors=[...new Set(s.events.map(e=>e.regulator).filter(Boolean))].sort();
   s.latest=s.events.map(e=>e.date).filter(Boolean).sort().at(-1)||'';
   s.first=s.events.map(e=>e.date).filter(Boolean).sort()[0]||'';
   s.degree=degree.get(s.key)||0;s.potential=v034Potential(s);s.ier=v034Ier(s,asOf);
   return s;
 }).sort((a,b)=>b.ier.score-a.ier.score);
 return subjects;
}
async function v034LoadData(){
 const [rawRes,govRes,metaRes]=await Promise.allSettled([v034FetchJson(V034_RADAR_EVENTS),v034FetchGoverned(),v034FetchJson(V034_RADAR_META)]);
 if(rawRes.status==='rejected'&&govRes.status==='rejected')throw new Error('No fue posible obtener eventos sancionatorios ni desde Radar Sanciones ni desde la materialización gobernada.');
 const raw=(rawRes.status==='fulfilled'&&Array.isArray(rawRes.value)?rawRes.value:[]).map(v034NormalizeRaw);
 const gov=(govRes.status==='fulfilled'?govRes.value:[]).map(v034NormalizeGoverned);
 const merged=v034MergeEvents(raw,gov);
 const entityIds=[...new Set(merged.map(e=>e.entityId).filter(Boolean))];
 const ruts=[...new Set(merged.map(e=>e.rut).filter(Boolean))];
 const uaf=await v034FetchUaf(entityIds,ruts);
 const subjects=v034BuildSubjects(merged,uaf);
 const materializedLatest=gov.map(e=>e.date).filter(Boolean).sort().at(-1)||null;
 const materializedUpdated=gov.map(e=>e.updatedAt).filter(Boolean).sort().at(-1)||null;
 const meta=metaRes.status==='fulfilled'?metaRes.value:null;
 const sourceLatest=meta?.latest_event_date||raw.map(e=>e.date).filter(Boolean).sort().at(-1)||null;
 const sourceGenerated=meta?.generated_at||null;
 const degraded=[];
 if(rawRes.status==='rejected')degraded.push('Radar Sanciones no respondió; se usa la materialización Workbench.');
 if(govRes.status==='rejected')degraded.push('Identidad gobernada de sanciones no disponible; se usan eventos directos del radar.');
 if(metaRes.status==='rejected')degraded.push('No fue posible verificar metadata de actualización del Radar Sanciones.');
 if(sourceLatest&&materializedLatest&&sourceLatest>materializedLatest)degraded.push(`Radar Sanciones contiene eventos hasta ${sourceLatest}; Workbench está materializado hasta ${materializedLatest}.`);
 degraded.push('Potencial SO opera como screening: no existe confirmación jurídica automática por ACTECO/RUT.');
 return {events:merged,subjects,uafTotal:uaf.total,meta:{sourceLatest,sourceGenerated,materializedLatest,materializedUpdated},degraded};
}
