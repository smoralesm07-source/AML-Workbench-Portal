/* Contrato de la sección Sujetos Obligados (0560).
 *
 * No basta con verificar que los ficheros existan: una plantilla mal cerrada o
 * un campo nulo mal tratado sólo se ven al renderizar. Esta prueba monta un DOM
 * mínimo, ejecuta los dos módulos y dibuja las cinco superficies con filas que
 * tienen la forma exacta de las tablas, incluyendo una persona natural sin
 * perfil tributario y una fila cargada de nulos. Después revisa el marcado
 * producido: nada de "undefined", nada de estilos en línea (la CSP del portal
 * los bloquea), etiquetas balanceadas y ningún atributo SVG numérico inválido.
 */
import fs from 'node:fs';

/* ---- DOM mínimo --------------------------------------------------------- */
const nodes=new Map();
function el(id){
  if(!nodes.has(id))nodes.set(id,{ id, innerHTML:'', outerHTML:'', dataset:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){}, closest(){return null}, querySelector(){return null}, querySelectorAll(){return []},
    insertAdjacentElement(){}, setAttribute(){}, removeAttribute(){}, appendChild(){}, remove(){} });
  return nodes.get(id);
}
const doc={
  querySelector(sel){
    if(sel==='#content')return el('content');
    if(sel==='#so-dossier')return el('so-dossier');
    if(sel==='#so-list')return el('so-list');
    return null;
  },
  querySelectorAll(){return [];},
  createElement(){return el('tmp-'+Math.random());},
  documentElement:{getAttribute(){return 'dark';},setAttribute(){}},
  addEventListener(){}
};
global.document=doc;
global.window={ document:doc, addEventListener(){}, dispatchEvent(){}, clearTimeout(){}, setTimeout(){}, CustomEvent:class{constructor(){}} };
global.CustomEvent=global.window.CustomEvent;
global.sb=null;

function loadModule(path){
  const src=fs.readFileSync(path,'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window','document','sb','CustomEvent',src)(global.window,doc,null,global.CustomEvent);
}
loadModule('assets/atlas-obligated-subjects-0560.js');
loadModule('assets/atlas-obligated-dossier-0560.js');

const CORE=global.window.__ATLAS_OBLIGATED__;
if(!CORE?.active)throw new Error('el módulo principal no quedó activo');
if(typeof CORE.renderDossier!=='function')throw new Error('el expediente no se registró');

/* ---- datos con la forma de las tablas ----------------------------------- */
const legal={
  rut:'96806980-2',entity_id:'ENT-RUT-96806980-2',registry_name:'BESALCO INMOBILIARIA SA',
  entity_name:'BESALCO INMOBILIARIA S.A.',entity_type:'Persona jurídica',subject_nature:'PERSONA_JURIDICA',
  uaf_sector:'Empresas dedicadas a la gestión inmobiliaria',uaf_sector_canonical:'Empresas Dedicadas a la Gestión Inmobiliaria',
  uaf_sector_id:36,registry_source_ref:'https://example.invalid/entities.jsonl',registry_document_ids:['DOC-a83252b18f0e'],
  registry_observed_at:'2026-08-19T22:20:25.876204+00:00',region:'Metropolitana de Santiago',commune:'Las Condes',
  territory_basis:'PADRON_ENTIDAD',sii_status:'ACTIVE_AS_PUBLISHED',sii_commercial_year:2024,
  sii_main_activity:'ACTIVIDADES INMOBILIARIAS REALIZADAS A CAMBIO DE UNA RETRIBUCION',
  sii_economic_sector:'Actividades inmobiliarias',sii_economic_subsector:'Servicios inmobiliarios',
  sii_taxpayer_type:'Primera categoría',sii_activity_start_date:'1997-04-15',sii_termination_date:null,
  sii_sales_band:'Grande 2',sii_sales_band_rank:11,sii_workers:412,sii_activity_count:3,sii_address_count:7,
  sii_region_changed:false,sii_activity_changed:false,sii_signal_count:2,entity_age_years:29,
  ownership_edge_count:14,legal_entity_partner_count:4,societies_as_partner_count:9,society_type:'Sociedad anónima',
  activity_peer_share:0.2314,activity_atypicality:0.7686,activity_peer_basis:'PARES_DEL_SECTOR_OBLIGADO',
  sanction_event_count:3,sanction_event_count_5y:2,sanction_last_event_date:'2024-06-11',
  sanction_resolution_refs:['087-2023','028-2024'],sanction_attribution:'CANDIDATO_POR_NOMBRE_NORMALIZADO',
  source_count:4,ipa3_score:31.5,ipa3_band:'BAJA',ipa3_dominant_mark:'MK-SII-DELTA',
  sector_vulnerability:75.0,ipf_supervision_history:64.2,ipf_registry_coherence:23,
  ipf_scale_complexity:71.4,ipf_observability_gap:0,
  ipf_score:49.25,ipf_band:'MUY_ALTA',ipf_credibility_pct:100,ipf_percentile:99.98,ipf_sector_percentile:99.9,
  ipf_flags:['HISTORIAL_SANCIONATORIO_UAF','REITERACION_5_ANIOS','ESTRUCTURA_SOCIETARIA_COMPLEJA'],
  ipf_version:'IPF-1.0',refreshed_at:'2026-08-25T00:01:57.225545+00:00',
  ipf_components:[
    {code:'VSE',label:'Vulnerabilidad sectorial estructural',weight:25,value:75.0,contribution:18.75,
     basis:'MAPA_SECTORIAL_IRG_V1',evidence:{sector:'Empresas dedicadas a la gestión inmobiliaria',sector_canonico:'Empresas Dedicadas a la Gestión Inmobiliaria',escala_origen_1_5:4.0},
     reading:'Describe el sector obligado, no la conducta de la entidad inscrita.'},
    {code:'HSU',label:'Historial de supervisión UAF',weight:25,value:64.2,contribution:16.05,
     basis:'EVENTOS_UAF_ATRIBUIDOS_CANDIDATO_UNICO',evidence:{eventos:3,eventos_5a:2,ultimo_evento:'2024-06-11',resoluciones:['087-2023','028-2024']},
     reading:'Sanción administrativa no es delito.'},
    {code:'CRG',label:'Coherencia registral UAF ↔ SII',weight:20,value:23,contribution:4.6,
     basis:'REGISTROS_PUBLICOS_CONTRASTADOS',evidence:{naturaleza:'PERSONA_JURIDICA',estado_sii:'ACTIVE_AS_PUBLISHED',termino_giro:null,atipicidad_giro:0.7686,base_atipicidad:'PARES_DEL_SECTOR_OBLIGADO',cambio_region:false,cambio_giro:false},
     reading:'Una discrepancia entre dos registros públicos no es incumplimiento acreditado.'},
    {code:'EEC',label:'Escala, exposición y complejidad',weight:18,value:71.4,contribution:12.85,
     basis:'PERFIL_TRIBUTARIO_ULTIMO_CORTE',evidence:{tramo_ventas:'Grande 2',tramo_rank:11,trabajadores:412,aristas_propiedad:14,socias_juridicas:4,participa_en_sociedades:9,antiguedad_anios:29},
     reading:'Tramo de ventas no es monto exacto.'},
    {code:'OBS',label:'Brecha de observabilidad',weight:12,value:0,contribution:0,
     basis:'COBERTURA_DE_FUENTES_DEL_CORTE',evidence:{fuentes:4,territorio:'PADRON_ENTIDAD',perfil_sii:true,corte_padron:'2026-08-19T22:20:25.876204+00:00'},
     reading:'Mide lo que el supervisor no puede ver.'}
  ]
};

const natural={...legal,
  rut:'12345678-9',entity_id:null,registry_name:'NANCY DE LA FUENTE HERNANDEZ',entity_name:null,
  subject_nature:'PERSONA_NATURAL',uaf_sector_canonical:'Notarios',uaf_sector:'Notarios',uaf_sector_id:45,
  region:null,commune:null,territory_basis:'NO_OBSERVADO',sii_status:'SIN_PERFIL_SII',
  sii_commercial_year:null,sii_main_activity:null,sii_economic_sector:null,sii_economic_subsector:null,
  sii_taxpayer_type:null,sii_activity_start_date:null,sii_termination_date:null,sii_sales_band:null,
  sii_sales_band_rank:null,sii_workers:null,sii_activity_count:null,sii_address_count:null,
  sii_region_changed:null,sii_activity_changed:null,sii_signal_count:null,entity_age_years:null,
  ownership_edge_count:null,legal_entity_partner_count:null,societies_as_partner_count:null,society_type:null,
  activity_peer_share:null,activity_atypicality:null,activity_peer_basis:'SIN_GIRO_OBSERVADO',
  sanction_event_count:1,sanction_event_count_5y:1,sanction_resolution_refs:['028-2024'],
  ipa3_score:null,ipa3_band:'SIN_MARCA_SHADOW',ipa3_dominant_mark:null,source_count:1,
  sector_vulnerability:66.75,ipf_scale_complexity:null,ipf_observability_gap:40,
  ipf_score:47.8,ipf_band:'ALTA',ipf_credibility_pct:82,ipf_percentile:96.2,ipf_sector_percentile:88,
  ipf_flags:['HISTORIAL_SANCIONATORIO_UAF','SIN_TERRITORIO_OBSERVADO','FUENTE_UNICA','PERSONA_NATURAL_OBLIGADA'],
  ipf_components:legal.ipf_components.map(c=>c.code==='EEC'
    ?{...c,value:null,contribution:null,basis:'PERSONA_NATURAL_SIN_PERFIL_DE_EMPRESA',evidence:{tramo_ventas:null,trabajadores:null}}
    :c)
};

const bare={rut:'77000000-0',registry_name:null,entity_name:null,subject_nature:null,uaf_sector_canonical:null,
  region:null,sii_status:null,ipf_score:null,ipf_band:'NO_CALCULABLE',ipf_percentile:null,ipf_sector_percentile:null,
  ipf_credibility_pct:null,sector_vulnerability:null,ipf_supervision_history:null,ipf_registry_coherence:null,
  ipf_scale_complexity:null,ipf_observability_gap:null,sanction_event_count:0,sanction_event_count_5y:0,
  activity_atypicality:null,ipf_flags:null,ipf_components:null,source_count:null,registry_document_ids:null};

const sector={uaf_sector_canonical:'Empresas Dedicadas a la Gestión Inmobiliaria',uaf_sector_id:36,
  subject_count:2244,vulnerability_index:75.0,ipf_mean:29.4,ipf_p90:40.1,band_muy_alta:12,band_alta:55,
  band_media:280,band_baja:900,band_minima:997,sanctioned_subjects:30,sanction_events:35,
  sanction_rate_per_100:1.56,sii_active:2158,sii_terminated:82,sii_absent:4,sii_coverage_pct:99.82,
  atypical_activity_subjects:511,natural_person_subjects:4,median_sales_band_rank:6.0,
  top_region:'Metropolitana de Santiago',top_region_share_pct:61.2};

const overview={schema:'ATLAS_UAF_OBLIGATED_OVERVIEW_V1',index_version:'IPF-1.0',
  registry:{subjects:9782,sectors:49,legal_persons:7672,natural_persons:2110,
    observed_at:'2026-08-19T22:20:25.876204+00:00',source_ref:'https://example.invalid/entities.jsonl',
    refreshed_at:'2026-08-25T00:01:57.225545+00:00'},
  sii:{active:7243,terminated:429,absent:2110,coverage_pct:78.43},
  bands:{MUY_ALTA:99,ALTA:391,MEDIA:1125,BAJA:3274,MINIMA:4893},
  supervision:{events_total:324,events_attributed:243,events_ambiguous:8,events_unmatched:73,
    subjects_with_history:213,subjects_repeat_5y:27,first_event:'2020-01-02',last_event:'2025-09-25'},
  gaps:[{ord:'1',code:'TERMINO_GIRO_VIGENTE_EN_PADRON',label:'Término de giro publicado',count:429,reading:'Discrepancia entre registros.'},
        {ord:'2',code:'GIRO_ATIPICO_EN_SECTOR',label:'Giro atípico',count:1780,reading:'Rareza entre pares.'},
        {ord:'3',code:'SIN_TERRITORIO_OBSERVADO',label:'Sin territorio',count:2166,reading:'Limita asignación.'}],
  regions:[{region:'Metropolitana de Santiago',subjects:4109,priority:260,terminated:180,sanctioned:120},
           {region:'Sin territorio observado',subjects:2166,priority:44,terminated:0,sanctioned:60},
           {region:'Tarapacá',subjects:2078,priority:190,terminated:230,sanctioned:18}],
  sanction_years:[{year:2020,events:85,attributed:56},{year:2023,events:73,attributed:56},
                  {year:2024,events:76,attributed:61},{year:2025,events:48,attributed:39}],
  watchlist:[{rut:legal.rut,name:legal.registry_name,sector:legal.uaf_sector_canonical,region:legal.region,
              ipf:legal.ipf_score,band:legal.ipf_band,percentile:legal.ipf_percentile,events:3,flags:legal.ipf_flags},
             {rut:bare.rut,name:null,sector:null,region:null,ipf:null,band:'NO_CALCULABLE',percentile:null,events:0,flags:null}]};

/* ---- ejecución ---------------------------------------------------------- */
const st=CORE.state;
st.overview=overview; st.overviewAt=overview.registry.refreshed_at;
st.sectors=[sector,{...sector,uaf_sector_canonical:'Usuarios de Zonas Francas',subject_count:2840,
  vulnerability_index:83.25,sanction_rate_per_100:0.74,band_muy_alta:60,band_alta:191},
  {...sector,uaf_sector_canonical:'Empresas de Factoraje (Factoring)',subject_count:195,
   vulnerability_index:58.25,sanction_rate_per_100:16.92},
  {...sector,uaf_sector_canonical:'Sector sin vulnerabilidad',vulnerability_index:null,subject_count:3}];
st.rows=[legal,natural,bare];
st.total=9782; st.loadedAll=false; st.loading=false; st.error=null;

const checks=[];
function run(label,fn){
  try{ const out=fn(); checks.push([label,String(out??'')]); }
  catch(e){ console.error(`FALLO en ${label}: ${e.stack}`); process.exitCode=1; }
}

st.mode='panorama'; run('panorama',()=>{CORE.render();return el('content').innerHTML;});
st.mode='padron';   run('padron',  ()=>{CORE.render();return el('content').innerHTML;});
st.mode='expediente';
st.dossier={rut:legal.rut,loading:false,subject:legal,events:[
  {sanction_id:'EVT-1',event_date:'2024-06-11',source_entity_name:'BESALCO INMOBILIARIA S.A.',
   resolution_ref:'028-2024',event_status:'Ejecutoriada',event_category:'Cumplimiento ALA/CFT/FP',
   resolution_status:'CANDIDATO_UNICO',confidence:0.72},
  {sanction_id:'EVT-2',event_date:null,source_entity_name:null,resolution_ref:null,event_status:null,
   event_category:null,resolution_status:null,confidence:null}
],sector,error:null};
run('expediente · persona jurídica',()=>{CORE.render();return el('so-dossier').innerHTML;});
st.dossier={rut:natural.rut,loading:false,subject:natural,events:[],sector:null,error:null};
run('expediente · persona natural',()=>{CORE.render();return el('so-dossier').innerHTML;});
st.dossier={rut:bare.rut,loading:false,subject:bare,events:[],sector:null,error:null};
run('expediente · fila vacía',()=>{CORE.render();return el('so-dossier').innerHTML;});
st.dossier={rut:'x',loading:false,subject:null,events:[],sector:null,error:'no está en el corte'};
run('expediente · error',()=>{CORE.render();return el('so-dossier').innerHTML;});

/* ---- verificaciones sobre el marcado producido -------------------------- */
let failures=0;
function bad(label,msg){console.error(`  ✗ ${label}: ${msg}`);failures++;}
for(const [label,html] of checks){
  const floor=label.includes('error')?80:200;
  if(!html||html.length<floor){bad(label,`marcado vacío o demasiado corto (${html.length})`);continue;}
  if(label.includes('error')&&!/so-error/.test(html))bad(label,'la superficie de error no declara el fallo');
  if(/undefined|\[object Object\]|NaN/.test(html)){
    const m=html.match(/.{0,90}(undefined|\[object Object\]|NaN).{0,90}/);
    bad(label,`valor sin resolver → …${m[0]}…`);
  }
  if(/style="/.test(html))bad(label,'estilo en línea: viola la CSP del portal');
  const open=(html.match(/<svg/g)||[]).length,close=(html.match(/<\/svg>/g)||[]).length;
  if(open!==close)bad(label,`SVG desbalanceado (${open} aperturas, ${close} cierres)`);
  const dopen=(html.match(/<div/g)||[]).length,dclose=(html.match(/<\/div>/g)||[]).length;
  if(dopen!==dclose)bad(label,`<div> desbalanceado (${dopen}/${dclose})`);
  const bopen=(html.match(/<button/g)||[]).length,bclose=(html.match(/<\/button>/g)||[]).length;
  if(bopen!==bclose)bad(label,`<button> desbalanceado (${bopen}/${bclose})`);
  if(/(width|height|cx|cy|r|x|y)="(NaN|Infinity|-Infinity|)"/.test(html))bad(label,'atributo SVG numérico inválido');
  console.log(`  ✓ ${label} · ${html.length} caracteres`);
}
console.log(failures?`\n${failures} verificación(es) fallida(s)`:'\nTodas las superficies renderizan sin valores sin resolver.');
if(failures)process.exitCode=1;

/* ---- contrato de integración y semántica -------------------------------- */
import assertStrict from 'node:assert/strict';
const coreSrc=fs.readFileSync('assets/atlas-obligated-subjects-0560.js','utf8');
const dossierSrc=fs.readFileSync('assets/atlas-obligated-dossier-0560.js','utf8');
const cssSrc=fs.readFileSync('assets/atlas-obligated-subjects-0560.css','utf8');
const indexSrc=fs.readFileSync('index.html','utf8');
const uiSrc=fs.readFileSync('atlas-current-ui.js','utf8');
const mobileSrc=fs.readFileSync('assets/atlas-mobile-nav.js','utf8');
const releaseSrc=fs.readFileSync('atlas-release.json','utf8');
const sqlSrc=fs.readFileSync('sql/atlas_v0560_uaf_obligated_subjects.sql','utf8');

/* La sección debe existir como ruta y quedar publicada. */
assertStrict.match(coreSrc,/const VIEW='sujetos-obligados'/);
assertStrict.match(uiSrc,/views:\['sujetos-obligados','sanctions'/,'la autoridad de navegación debe agrupar la ruta');
assertStrict.match(uiSrc,/'sujetos-obligados':\{label:'Sujetos Obligados'/,'la ruta necesita etiqueta e icono');
assertStrict.match(mobileSrc,/RADAR_VIEWS=new Set\(\['sujetos-obligados'/,'la navegación móvil debe ofrecer la ruta');
assertStrict.match(indexSrc,/atlas-obligated-subjects-0560\.css\?v=0560-1/);
assertStrict.match(indexSrc,/atlas-obligated-subjects-0560\.js\?v=0560-1/);
assertStrict.match(indexSrc,/atlas-obligated-dossier-0560\.js\?v=0560-1/);

/* Lee snapshots gobernados, nunca las vistas pesadas. */
assertStrict.match(coreSrc,/aml_uaf_obligated_subject_snapshot/);
assertStrict.match(coreSrc,/aml_uaf_obligated_sector_snapshot/);
assertStrict.match(coreSrc,/aml_uaf_obligated_overview_snapshot/);
assertStrict.match(coreSrc,/aml_uaf_sanction_subject_link_snapshot/);

/* Guardarraíles que no pueden desaparecer de la superficie. */
for(const rule of [
  /IPF ≠ probabilidad de LA\/FT/,
  /La banda es posición/,
  /La vulnerabilidad sectorial describe al sector/,
  /Sanción administrativa ≠ delito/,
  /Término de giro publicado ≠ baja del registro UAF/,
  /Giro atípico ≠ incumplimiento/,
  /Ausencia de dato ≠ cero/
])assertStrict.match(coreSrc,rule,`falta la regla de lectura ${rule}`);
assertStrict.match(dossierSrc,/no promueve identidad canónica/);
assertStrict.match(dossierSrc,/Ausencia de evento atribuido no es constancia de cumplimiento/);
assertStrict.match(dossierSrc,/no le corresponde perfil tributario de empresa/);

/* La CSP del portal prohíbe estilos en línea; los gráficos son SVG. */
assertStrict.doesNotMatch(coreSrc,/style="/,'la sección no puede emitir estilos en línea');
assertStrict.doesNotMatch(dossierSrc,/style="/,'el expediente no puede emitir estilos en línea');
assertStrict.doesNotMatch(coreSrc,/new MutationObserver/);
assertStrict.doesNotMatch(dossierSrc,/new MutationObserver/);
for(const forbidden of [/auth\.setSession\(/,/refresh_token\s*:/,/localStorage/,/sessionStorage/]){
  assertStrict.doesNotMatch(coreSrc,forbidden,`la sección no puede tocar ${forbidden}`);
  assertStrict.doesNotMatch(dossierSrc,forbidden,`el expediente no puede tocar ${forbidden}`);
}

/* Vocabulario gráfico compartido entre las tres superficies. */
for(const cls of ['.so-ipf-bar','.so-signature','.so-flagset','.so-dial','.so-comp-bar','.so-plot','.so-timeline'])
  assertStrict.ok(cssSrc.includes(cls),`falta el objeto gráfico ${cls}`);

/* El índice y su semántica quedan declarados en el release y en el SQL. */
assertStrict.match(releaseSrc,/IPF_1_0_SUPERVISORY_PRIORITIZATION_NOT_LAFT_PROBABILITY/);
assertStrict.match(releaseSrc,/NATURAL_PERSON_WITHOUT_COMPANY_TAX_PROFILE_IS_NOT_A_REGISTRY_GAP/);
assertStrict.match(sqlSrc,/promotes_identity\s+boolean not null default false/);
assertStrict.match(sqlSrc,/PERSONA_NATURAL/);
assertStrict.match(sqlSrc,/percent_rank\(\) over/,'las bandas se anclan en percentiles del padrón');

/* Los cinco componentes y sus pesos suman 100 y están en ambos lados. */
const weights=[...sqlSrc.matchAll(/'code','(VSE|HSU|CRG|EEC|OBS)','label','[^']*','weight',(\d+)/g)];
assertStrict.equal(weights.length,5,'el SQL debe declarar los cinco componentes');
assertStrict.equal(weights.reduce((a,m)=>a+Number(m[2]),0),100,'los pesos del IPF deben sumar 100');
for(const [,code] of weights)assertStrict.ok(coreSrc.includes(`'${code}'`),`la superficie desconoce el componente ${code}`);

console.log('Contrato de la sección Sujetos Obligados 0560 OK');
