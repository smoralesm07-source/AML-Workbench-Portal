import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const AUD="atlas-osfl-registry-ingest";
const REPO="smoralesm07-source/AML-Workbench-Portal";
const JWKS=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});

async function authorize(req:Request){
  const h=req.headers.get("authorization")||"";
  if(!h.startsWith("Bearer "))throw new Error("OIDC_MISSING");
  const {payload}=await jwtVerify(h.slice(7),JWKS,{issuer:"https://token.actions.githubusercontent.com",audience:AUD,algorithms:["RS256"]});
  if(String(payload.repository||"")!==REPO)throw new Error("OIDC_REPOSITORY_DENIED");
  if(String(payload.ref||"")!=="refs/heads/main")throw new Error("OIDC_REF_DENIED");
  if(!new Set(["push","schedule","workflow_dispatch"]).has(String(payload.event_name||"")))throw new Error("OIDC_EVENT_DENIED");
}
function db(){return createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}})}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{await authorize(req)}catch(e){return json({ok:false,error:String((e as Error).message||e)},401)}
  const body=await req.json().catch(()=>({}));const action=String(body.action||"");const client=db();
  try{
    if(action==="health")return json({ok:true,service:"aml-osfl-registry-ingest",source:"REGISTRO_CIVIL_RNPJSFL",identity_policy:"RUT_VALIDATED_THEN_CONSERVATIVE_NAME"});
    if(action==="probe_status"){
      const blocked=Boolean(body.blocked),detail=String(body.detail||"").slice(0,900),checked=new Date().toISOString();
      const metadata={access_mode:blocked?"protected_portal":"direct_source_available",portal:String(body.portal||""),http_status:body.http_status??null,detail,checked_at:checked};
      const {error}=await client.from("aml_external_source_health").upsert({source_code:"REGISTRO_CIVIL_OSFL",source_name:"Registro Civil · RNPJSFL",source_class:"official_list",integration_mode:"scheduled",authoritative_source:"Servicio de Registro Civil e Identificación",enabled:true,software_status:blocked?"watch":"healthy",data_status:blocked?"unknown":"fresh",last_check_at:checked,notes:blocked?"Fuente oficial disponible; acceso automatizado al archivo vigente requiere interacción web/desafío. El último maestro validado se conserva sin sustitución.":"Fuente oficial accesible por URL directa verificable.",metadata,refreshed_at:checked},{onConflict:"source_code"});if(error)throw error;return json({ok:true,blocked,checked_at:checked});
    }
    if(action==="begin"){
      const r=body.run||{};if(!r.load_id||!r.snapshot_date||!r.source_file_name||!r.source_sha256)return json({ok:false,error:"RUN_KEYS_REQUIRED"},400);
      const row={load_id:String(r.load_id),snapshot_date:String(r.snapshot_date),source_url:r.source_url||null,source_file_name:String(r.source_file_name),source_sha256:String(r.source_sha256),source_bytes:r.source_bytes??null,status:"RECEIVING",expected_active_total:r.expected_active_total??null,quality:r.quality||{},updated_at:new Date().toISOString()};
      const {error}=await client.from("aml_osfl_registry_ingest_run").upsert(row,{onConflict:"load_id"});if(error)throw error;await client.from("aml_osfl_registry_stage").delete().eq("load_id",row.load_id);return json({ok:true,load_id:row.load_id});
    }
    if(action==="stage_batch"){
      const rows=Array.isArray(body.rows)?body.rows:[];if(!rows.length||rows.length>1500)return json({ok:false,error:"INVALID_BATCH_SIZE"},400);
      const clean=rows.map((r:any)=>({load_id:String(r.load_id||""),source_sheet:String(r.source_sheet||"SIN_HOJA").slice(0,160),source_row_number:Number(r.source_row_number||0),registry_number:r.registry_number||null,legal_name:r.legal_name||null,rut_raw:r.rut_raw||null,rut:r.rut||null,rut_is_valid:Boolean(r.rut_is_valid),origin:r.origin||null,commune:r.commune||null,region:r.region||null,address:r.address||null,organization_type:r.organization_type||null,classification:r.classification||null,grant_date:r.grant_date||null,registration_date:r.registration_date||null,legal_status:r.legal_status||null,is_active:r.is_active===null||r.is_active===undefined?null:Boolean(r.is_active),source_record_hash:String(r.source_record_hash||"")}));
      if(clean.some((r:any)=>!r.load_id||!r.source_row_number||!r.source_record_hash))return json({ok:false,error:"STAGE_KEYS_REQUIRED"},400);const {error}=await client.from("aml_osfl_registry_stage").upsert(clean,{onConflict:"load_id,source_sheet,source_row_number"});if(error)throw error;return json({ok:true,rows:clean.length});
    }
    if(action==="stage_complete"){
      const load=String(body.load_id||"");if(!load)return json({ok:false,error:"LOAD_ID_REQUIRED"},400);const {error}=await client.from("aml_osfl_registry_ingest_run").update({status:"STAGED",observed_rows:Number(body.observed_rows||0),accepted_rows:Number(body.accepted_rows||0),active_rows:Number(body.active_rows||0),inactive_rows:Number(body.inactive_rows||0),rows_with_rut:Number(body.rows_with_rut||0),rows_with_valid_rut:Number(body.rows_with_valid_rut||0),duplicate_registry_numbers:Number(body.duplicate_registry_numbers||0),quality:body.quality||{},updated_at:new Date().toISOString()}).eq("load_id",load);if(error)throw error;return json({ok:true,load_id:load,status:"STAGED"});
    }
    if(action==="finalize"){
      const load=String(body.load_id||"");if(!load)return json({ok:false,error:"LOAD_ID_REQUIRED"},400);const {data,error}=await client.rpc("aml_finalize_osfl_registry_load_0940",{p_load_id:load,p_expected_active_total:body.expected_active_total??null});if(error){await client.from("aml_osfl_registry_ingest_run").update({status:"FAILED",error:String(error.message||error).slice(0,1800),finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("load_id",load);throw error;}return json(data||{ok:true,load_id:load});
    }
    if(action==="fail"){
      const load=String(body.load_id||""),msg=String(body.error||"UNKNOWN").slice(0,1800);if(load)await client.from("aml_osfl_registry_ingest_run").update({status:"FAILED",error:msg,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("load_id",load);return json({ok:true,status:"FAILED_RECORDED"});
    }
    return json({ok:false,error:"UNKNOWN_ACTION"},400);
  }catch(e){return json({ok:false,error:String((e as any)?.message||e)},500)}
});
