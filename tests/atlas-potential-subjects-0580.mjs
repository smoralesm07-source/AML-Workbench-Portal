/* Contrato de Potenciales SO (0580).
 *
 * Igual que en 0560, no basta con comprobar que los ficheros existan: una
 * plantilla mal cerrada o un campo nulo mal tratado sólo se ven al renderizar.
 * Esta prueba monta un DOM mínimo, ejecuta los tres módulos de la sección y
 * dibuja la superficie de gestión en sus estados reales -lista, selección
 * múltiple, formulario de descarte, fila ya revisada, fila no incorporable y
 * fila cargada de nulos-, y luego revisa el marcado producido.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

/* ---- DOM mínimo --------------------------------------------------------- */
const nodes=new Map();
function el(id){
  if(!nodes.has(id))nodes.set(id,{ id, innerHTML:'', outerHTML:'', dataset:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){}, closest(){return null}, querySelector(){return null},
    querySelectorAll(){return []}, insertAdjacentElement(){}, setAttribute(){},
    removeAttribute(){}, appendChild(){}, remove(){} });
  return nodes.get(id);
}
const doc={
  querySelector(sel){
    if(sel==='#content')return el('content');
    if(sel==='#so-potential')return el('so-potential');
    if(sel==='#so-dossier')return el('so-dossier');
    return null;
  },
  querySelectorAll(){return [];},
  createElement(){return el('tmp-'+Math.random());},
  documentElement:{getAttribute(){return '0.51.1';},setAttribute(){}},
  addEventListener(){}
};
global.document=doc;
global.window={document:doc,addEventListener(){},dispatchEvent(){},clearTimeout(){},setTimeout(){},
  CustomEvent:class{constructor(){}}};
global.CustomEvent=global.window.CustomEvent;
global.sb=null;

function load(path){
  new Function('window','document','sb','CustomEvent',fs.readFileSync(path,'utf8'))
    (global.window,doc,null,global.CustomEvent);
}
load('assets/atlas-obligated-subjects-0560.js');
load('assets/atlas-obligated-dossier-0560.js');
load('assets/atlas-potential-subjects-0580.js');

const POT=global.window.__ATLAS_OBLIGATED__?.potential;
assert.ok(global.window.__ATLAS_POTENTIAL__?.active,'el módulo de potenciales debe quedar activo');
assert.ok(POT&&typeof POT.render==='function','el núcleo debe recibir el renderizador de potenciales');

/* ---- filas con la forma exacta de aml_v_uaf_potential_current ------------ */
const sancionada={
  rut:'76123456-7',entity_id:'ENT-RUT-76123456-7',entity_name:'HB INVERSIONES S.A.',
  entity_type:'Persona jurídica',subject_nature:'PERSONA_JURIDICA',
  is_actionable:true,actionability_basis:'OPERACION_VIGENTE_EN_EL_CORTE',type_share_in_sector:0.9969,
  implied_sector:'Empresas Dedicadas a la Gestión Inmobiliaria',
  evidence_class:'SANCION_UAF_SIN_INSCRIPCION',
  matched_activity:'COMPRA, VENTA Y ALQUILER (EXCEPTO AMOBLADOS) DE INMUEBLES',
  activity_concentration:0.884,activity_registered_n:1487,activity_universe_n:1683,
  uaf_sanction_events:1,uaf_sanction_last_date:'2024-06-11',uaf_sanction_refs:['087-2023'],
  region:'Metropolitana de Santiago',commune:'Las Condes',sii_status:'ACTIVE_AS_PUBLISHED',
  sii_main_activity:'COMPRA, VENTA Y ALQUILER (EXCEPTO AMOBLADOS) DE INMUEBLES',
  sii_activity_names:'COMPRA, VENTA Y ALQUILER | OTRAS ACTIVIDADES',
  sii_sales_band:'Mediana 1',sii_sales_band_rank:8,sii_workers:24,
  sii_activity_start_date:'2004-03-02',sii_termination_date:null,
  ownership_edge_count:6,legal_entity_partner_count:2,societies_as_partner_count:1,
  source_count:3,ipa3_score:22.4,ipa3_band:'BAJA',
  ivo_regulatory_evidence:100,ivo_activity_match:88.4,ivo_operational_status:100,
  ivo_score:80.28,ivo_band:'MUY_ALTA',ivo_credibility_pct:100,ivo_components:[],
  materiality_score:46.8,materiality_components:{},flags:['SANCIONADO_POR_UAF_SIN_INSCRIPCION'],
  index_version:'IVO-1.0',refreshed_at:'2026-08-25T13:10:35Z',
  review_state:'PENDIENTE',review_reason_code:null,review_rationale:null,
  reviewed_at:null,reviewed_by_user_id:null,reviewed_by_email:null,
  review_count:0,reviewer_count:0
};
const yaRevisada={...sancionada,rut:'77000111-2',entity_name:'MAGICAL ADMINISTRADORA DE FONDOS DE INVERSION S.A.',
  evidence_class:'GIRO_PRINCIPAL_CARACTERISTICO',implied_sector:'Administradoras de Fondos de Inversión',
  uaf_sanction_events:0,uaf_sanction_last_date:null,uaf_sanction_refs:[],
  ivo_score:44.42,ivo_band:'MEDIA',materiality_score:26.58,
  review_state:'SELECCIONADO_PARA_INSCRIPCION',reviewed_at:'2026-08-25T14:00:00Z',
  reviewed_by_email:'fiscalizador@example.cl',review_count:2,reviewer_count:2};
const descartada={...yaRevisada,rut:'78222333-4',entity_name:'INMOBILIARIA YUGOSLAVA S A',
  review_state:'DESCARTADO',review_reason_code:'YA_INSCRITO_EN_REGISTRO_VIGENTE',
  review_rationale:'Aparece inscrita en el registro vigente consultado directamente.',
  reviewer_count:1,review_count:1};
const noIncorporable={...sancionada,rut:'97004000-5',entity_name:'BANCO SECURITY',
  is_actionable:false,actionability_basis:'TERMINO_DE_GIRO_PUBLICADO_NO_INCORPORABLE',
  sii_status:'TERMINATED_AS_PUBLISHED',sii_termination_date:'2025-01-31',
  ivo_score:76.43,ivo_band:'MUY_ALTA',materiality_score:87.62,
  flags:['SANCIONADO_POR_UAF_SIN_INSCRIPCION','TERMINO_DE_GIRO_PUBLICADO']};
const vacia={rut:'79999999-9',entity_id:null,entity_name:null,entity_type:null,subject_nature:null,
  is_actionable:null,actionability_basis:null,type_share_in_sector:null,implied_sector:null,
  evidence_class:'GIRO_SECUNDARIO_CARACTERISTICO',matched_activity:null,activity_concentration:null,
  activity_registered_n:null,activity_universe_n:null,uaf_sanction_events:0,uaf_sanction_last_date:null,
  uaf_sanction_refs:null,region:null,commune:null,sii_status:null,sii_main_activity:null,
  sii_activity_names:null,sii_sales_band:null,sii_sales_band_rank:null,sii_workers:null,
  sii_activity_start_date:null,sii_termination_date:null,ownership_edge_count:null,
  legal_entity_partner_count:null,societies_as_partner_count:null,source_count:null,
  ipa3_score:null,ipa3_band:null,ivo_regulatory_evidence:null,ivo_activity_match:null,
  ivo_operational_status:null,ivo_score:null,ivo_band:'NO_CALCULABLE',ivo_credibility_pct:null,
  ivo_components:null,materiality_score:null,materiality_components:null,flags:null,
  index_version:null,refreshed_at:null,review_state:'PENDIENTE',review_reason_code:null,
  review_rationale:null,reviewed_at:null,reviewed_by_user_id:null,reviewed_by_email:null,
  review_count:0,reviewer_count:0};

/* El panorama que alimenta la franja de avance y las facetas. */
global.window.__ATLAS_OBLIGATED__.state.overview={potential:{
  universe:{candidates:64,actionable:62,sectors:6,characteristic_activities:21,refreshed_at:'2026-08-25T13:10:35Z'},
  evidence:{SANCION_UAF_SIN_INSCRIPCION:2,GIRO_PRINCIPAL_CARACTERISTICO:49,GIRO_SECUNDARIO_CARACTERISTICO:13},
  bands:{MUY_ALTA:1,MEDIA:48,BAJA:13},
  triage:{pendiente:59,revisado:1,seleccionado:1,descartado:1,revisores:2},
  sectors:[{sector:'Empresas Dedicadas a la Gestión Inmobiliaria',candidates:30,actionable:29,mean_ivo:50.1,mean_materiality:24.4},
           {sector:'Administradoras de Fondos de Inversión',candidates:17,actionable:17,mean_ivo:44.4,mean_materiality:19.4}],
  regions:[{region:'Metropolitana de Santiago',candidates:41},{region:'Sin territorio observado',candidates:5}]
}};

const st=POT.state;
st.rows=[sancionada,yaRevisada,descartada,noIncorporable,vacia];
st.loadedAll=true; st.loading=false; st.error=null;

const checks=[];
async function run(label,prepare){
  prepare();
  await POT.render();
  checks.push([label, el('so-potential').innerHTML]);
}

await run('lista de gestión',()=>{st.selection.clear();st.discarding=null;st.notice=null;});
await run('selección múltiple',()=>{st.selection=new Set([sancionada.rut,yaRevisada.rut]);});
await run('descarte masivo',()=>{st.discarding='__bulk__';});
await run('descarte de una fila',()=>{st.selection.clear();st.discarding=sancionada.rut;});
await run('aviso tras anexar',()=>{st.discarding=null;st.notice={text:'2 candidatas quedaron en «revisado».',tone:'ok'};});
await run('error de escritura',()=>{st.notice=null;st.error='new row violates row-level security policy';});
await run('sin resultados',()=>{st.error=null;st.rows=[];});

/* ---- verificaciones sobre el marcado ------------------------------------ */
let fallos=0;
function mal(label,msg){console.error(`  ✗ ${label}: ${msg}`);fallos++;}
for(const [label,html] of checks){
  if(!html||html.length<200){mal(label,`marcado vacío o demasiado corto (${html.length})`);continue;}
  if(/undefined|\[object Object\]|NaN/.test(html)){
    const m=html.match(/.{0,90}(undefined|\[object Object\]|NaN).{0,90}/);
    mal(label,`valor sin resolver → …${m[0]}…`);
  }
  if(/style="/.test(html))mal(label,'estilo en línea: viola la CSP del portal');
  for(const [open,close,nombre] of [[/<svg/g,/<\/svg>/g,'SVG'],[/<div/g,/<\/div>/g,'div'],
                                    [/<button/g,/<\/button>/g,'button'],[/<span/g,/<\/span>/g,'span']]){
    const a=(html.match(open)||[]).length,b=(html.match(close)||[]).length;
    if(a!==b)mal(label,`${nombre} desbalanceado (${a}/${b})`);
  }
  if(/(width|height|cx|cy|r)="(NaN|Infinity|-Infinity|)"/.test(html))mal(label,'atributo SVG numérico inválido');
  console.log(`  ✓ ${label} · ${html.length} caracteres`);
}

/* ---- contrato de gestión y guardarraíles -------------------------------- */
const js=fs.readFileSync('assets/atlas-potential-subjects-0580.js','utf8');
const css=fs.readFileSync('assets/atlas-potential-subjects-0580.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('atlas-current-ui.js','utf8');
const core=fs.readFileSync('assets/atlas-obligated-subjects-0560.js','utf8');
const sql=fs.readFileSync('sql/atlas_v0580_uaf_potential_subjects.sql','utf8');

/* La sección cambia de nombre y de grupo. */
assert.match(ui,/views:\['overview','entities','sujetos-obligados','territory'\]/,'Universo SO debe vivir en Explorar');
assert.doesNotMatch(ui,/\{label:'Radares',views:\['sujetos-obligados'/,'ya no puede seguir en Radares');
assert.match(ui,/'sujetos-obligados':\{label:'Universo SO'/,'la etiqueta debe ser Universo SO');
assert.match(core,/button\.textContent='Universo SO'/);
assert.match(core,/\['potenciales','Potenciales SO'\]/,'el modo de potenciales debe estar en la barra');

/* Lee la vista con el estado vigente y anexa en la tabla de sólo anexado. */
assert.match(js,/aml_v_uaf_potential_current/);
assert.match(js,/aml_uaf_potential_review/);
assert.doesNotMatch(js,/user_id\s*:/,'el usuario nunca viaja en el payload: lo pone auth.uid() en la base');
assert.match(js,/\.insert\(payload\)/,'la gestión anexa, nunca actualiza');
/* El verbo que la gestión aplica sobre una tabla sólo puede ser leer o anexar.
   Se mira la cadena .from(TABLA).verbo( y no el texto suelto, porque
   state.selection.delete() es un Set de JavaScript y no una escritura. */
const verbos=new Set([...js.matchAll(/\.from\([A-Z_]+\)\s*\.\s*(\w+)\(/g)].map(m=>m[1]));
assert.ok(verbos.size>0,'la gestión debe consultar la base');
for(const v of verbos)
  assert.ok(v==='select'||v==='insert',`la gestión no puede aplicar .${v}() sobre una tabla: sólo leer y anexar`);

/* Guardarraíles que no pueden desaparecer de la superficie. */
for(const regla of [
  /Ausencia del corte público ≠ no inscrito/,
  /describe al giro, no a la entidad/,
  /Verosimilitud no es materialidad/,
  /Plausible no es incorporable/,
  /no es una decisión institucional/,
  /sólo anexado/
])assert.match(js,regla,`falta la regla de lectura ${regla}`);
assert.match(js,/El fundamento del descarte es obligatorio/,'el descarte exige fundamento también en la interfaz');

/* Sin estilos en línea, sin observadores, sin almacenamiento local. */
for(const prohibido of [/style="/,/new MutationObserver/,/localStorage/,/sessionStorage/,/auth\.setSession\(/])
  assert.doesNotMatch(js,prohibido,`la gestión no puede usar ${prohibido}`);

/* Vocabulario gráfico propio. */
for(const cls of ['.pot-meter','.pot-quadrant','.pot-bulk','.pot-discard','.pot-row','.pot-state'])
  assert.ok(css.includes(cls),`falta el objeto gráfico ${cls}`);

/* Publicación. */
assert.match(index,/atlas-potential-subjects-0580\.css\?v=0580-1/);
assert.match(index,/atlas-potential-subjects-0580\.js\?v=0580-1/);

/* La capa SQL declara su semántica, su disciplina y las tres pruebas de calibración. */
assert.match(sql,/REGISTRATION_HYPOTHESIS_NOT_PROVEN_NON_COMPLIANCE/);
assert.match(sql,/aml_uaf_potential_review_descarte_motivado/,'un descarte sin motivo debe ser imposible en la base');
assert.match(sql,/revoke update, delete on public\.aml_uaf_potential_review from authenticated/,
  'el sólo anexado tiene que ser estructural, no depender de que exista una política');
assert.match(sql,/user_id = \(select auth\.uid\(\)\)/,'sólo se puede anexar bajo la propia identidad');
assert.match(sql,/co\.cuota_dominante >= 0\.35/,'prueba de coherencia de actividad del sector');
assert.match(sql,/st\.subject_count >= 0\.05/,'prueba de soporte del giro dentro del sector');
assert.match(sql,/ts\.cuota >= 0\.05/,'prueba de coherencia de tipo de entidad');

/* Los tres pesos del IVO suman 100 en el SQL y en la superficie. */
const pesos=[...sql.matchAll(/'code','(EVR|CGA|VIG)','label','[^']*','weight',(\d+)/g)];
assert.equal(pesos.length,3,'el SQL debe declarar los tres componentes del IVO');
assert.equal(pesos.reduce((a,m)=>a+Number(m[2]),0),100,'los pesos del IVO deben sumar 100');

console.log(fallos?`\n${fallos} verificación(es) fallida(s)`:'\nTodas las superficies de gestión renderizan sin valores sin resolver.');
console.log('Contrato de Potenciales SO 0580 OK');
if(fallos)process.exitCode=1;
