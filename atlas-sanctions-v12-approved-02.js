  if(/GOBIERNO CORPORATIVO|DIRECTOR|ADMINISTRADOR/.test(n))return 'Gobierno corporativo';
  if(/INFORMACION|REPORT|ENTREGA|REMISION/.test(n))return 'Deberes de información';
  if(/CAPITAL|PATRIMONIO|SOLVENCIA/.test(n))return 'Solvencia / patrimonio';
  if(/CONDUCTA|CLIENTE|MERCADO/.test(n))return 'Conducta de mercado';
  return 'Cumplimiento regulatorio';
}
function sv12InferSector(...parts){
  const n=sv12Norm(parts.join(' '));
  const rules=[['Bancos',/\bBANCO\b/],['Compañías de Seguro',/\bSEGUROS?\b/],['Empresas de factoraje (Factoring)',/FACTORING|FACTORAJE/],['Casas de cambio',/CASA.*CAMBIO|\bCAMBIO\b/],['Empresas de leasing',/LEASING/],['Casinos de Juego',/CASINO/],['Corredores de seguros',/CORREDOR.*SEGURO/],['Administradoras generales de fondos',/ADMINISTRADORA.*FONDO|\bAGF\b/],['Administradoras de Mutuos Hipotecarios',/MUTUO.*HIPOTECARIO/],['Empresas de transferencia de dinero',/TRANSFERENCIA.*DINERO|REMESA/],['Notarios',/NOTARI[OA]/],['Conservadores',/CONSERVADOR/],['Agentes de aduana',/AGENTE.*ADUANA/],['Cooperativas de ahorro y crédito',/COOPERATIVA.*AHORRO/],['Corredores de bolsa de valores',/CORREDOR.*BOLSA/],['Administradores de Fondos de Pensiones',/AFP|FONDO.*PENSION/]];
  for(const [s,re] of rules)if(re.test(n))return s;return null;
}
function sv12CanonId(rut,fallback){const r=sv12Rut(rut);return r?`ENT-RUT-${r}`:(fallback?String(fallback):null);}
async function sv12FetchJson(url){const r=await fetch(`${url}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status} al consultar ${url}`);return r.json();}
async function sv12FetchGoverned(){
  const out=[];let from=0;
  for(;;){
    const {data,error}=await sb.from(SV12_GOV_VIEW).select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,resolution_method,identity_confidence,laft_direct,amount_uf,subject,snapshot_id,updated_at,payload').order('event_date',{ascending:false,nullsFirst:false}).range(from,from+SV12_PAGE-1);
    if(error)throw error;const rows=data||[];out.push(...rows);if(rows.length<SV12_PAGE||from>10000)break;from+=SV12_PAGE;
  }
  return out;
}
async function sv12FetchUaf(entityIds,ruts){
  const rows=[];
  async function chunk(field,values){for(let i=0;i<values.length;i+=120){const vals=values.slice(i,i+120);if(!vals.length)continue;const {data,error}=await sb.from(SV12_UAF_VIEW).select('entity_id,rut,resolved_name,uaf_category_hint,reconciliation_status,main_activity,sii_current_status').in(field,vals);if(error)throw error;rows.push(...(data||[]));}}
  await chunk('entity_id',[...new Set(entityIds.filter(Boolean))]);
  await chunk('rut',[...new Set(ruts.filter(Boolean))]);
  const {count,error}=await sb.from(SV12_UAF_VIEW).select('entity_id',{count:'exact',head:true});if(error)throw error;
  const byEntity=new Map(),byRut=new Map();
  for(const r of rows){if(r.entity_id)byEntity.set(String(r.entity_id),r);const rk=sv12Rut(r.rut);if(rk)byRut.set(rk,r);}
  return {byEntity,byRut,total:count||0};
}
function sv12NormalizeRaw(p){
  p=p&&typeof p==='object'?p:{};const subject=String(p.resumen||p.subject||p.materia||p.reason||p.categoria||'');
  const name=String(p.sujeto_fuente||p.entity_name||p.sancionado||p.nombre||'Entidad no resuelta').replace(/\s+/g,' ').trim();
  const rut=sv12RutFrom(p.rut_fuente,p.rut,p.subject_rut,name,subject);
  const entityId=sv12CanonId(rut,p.entity_id);
  const unit=String(p.unidad||'').toUpperCase();const amount=unit==='UF'&&p.monto!=null?Number(p.monto):p.amount_uf!=null?Number(p.amount_uf):null;
  return {id:String(p.id||p.event_id||p.source_record_id||crypto.randomUUID()),rawId:String(p.id||p.event_id||''),sourceRecordId:String(p.source_record_id||''),evidenceId:String(p.evidence_id||''),date:String(p.fecha||p.date||'').slice(0,10),regulator:String(p.supervisor||p.regulator||p.source_id||'').toUpperCase(),name,entityId,rut,identityStatus:entityId?'SOURCE_IDENTITY':'RAW_PENDING_RECONCILIATION',identityMethod:rut?'RUT_SOURCE':'UNRESOLVED',identityConfidence:rut?1:0,laft:sv12Bool(p.laft_directo),amountUF:Number.isFinite(amount)?amount:null,subject,category:String(p.categoria||sv12Category(subject,p)),resolution:String(p.resolucion||p.resolution||p.resolution_number||''),sourceUrl:sv12SafeUrl(p.resolution_url||p.source_url),updatedAt:'',documentStatus:String(p.document_status||''),documentConfidence:Number.isFinite(Number(p.document_confidence))?Number(p.document_confidence):null,payload:p,source:'RADAR'};
}
function sv12NormalizeGov(r){
