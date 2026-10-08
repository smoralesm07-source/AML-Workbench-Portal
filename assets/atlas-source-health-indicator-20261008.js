/* ATLAS · Salud de fuentes · indicador pasivo, sin consultas a base de datos */
(function(){
'use strict';
if(window.__atlasSourceHealthIndicatorInstalled)return;
window.__atlasSourceHealthIndicatorInstalled=true;
const SOURCES=[
 {name:'Radar UAF',url:'/Radar_UAF/data/dashboard.json',scope:'Reportabilidad y padrón (archivo publicado)'},
 {name:'SII',url:'/Radar_SII/data/snapshot_manifest.json',scope:'Snapshot de actividades económicas'},
 {name:'Prensa',scope:'Cobertura de noticias y vinculaciones'},
 {name:'Presupuesto Abierto',scope:'Ejecución y cobertura municipal'},
 {name:'Mercado Público',scope:'Compras y proveedores'},
 {name:'CEAD',scope:'Indicadores territoriales'},
 {name:'OSFL',scope:'Organizaciones sin fines de lucro'}
];
let records=SOURCES.map(s=>({...s,status:'unknown',detail:'Sin comprobación automática configurada',checked:null,metrics:[]}));
let running=false, lastRun=0, open=false;
function css(){if(document.getElementById('atlas-source-health-style'))return;let s=document.createElement('style');s.id='atlas-source-health-style';s.textContent=`
#atlas-source-health-button{position:fixed;right:17px;top:12px;z-index:9000;display:flex;align-items:center;gap:7px;border:1px solid var(--border,#64748b55);border-radius:999px;background:var(--surface,#19222f);color:var(--text,#eef2f7);padding:6px 11px;font:600 11px/1.3 Inter,system-ui,sans-serif;box-shadow:0 3px 12px #0002;cursor:pointer}
#atlas-source-health-button .ash-dot{width:8px;height:8px;border-radius:100%;background:#94a3b8}
#atlas-source-health-button[data-state="ok"] .ash-dot{background:#34c58b}
#atlas-source-health-button[data-state="warn"] .ash-dot{background:#f6ad55}
#atlas-source-health-button[data-state="error"] .ash-dot{background:#ed7070}
#atlas-source-health-panel{position:fixed;z-index:9001;right:16px;top:49px;width:min(425px,calc(100vw - 32px));max-height:min(75vh,680px);overflow:auto;background:var(--surface,#172331);color:var(--text,#f2f5f9);border:1px solid #8794a455;border-radius:14px;box-shadow:0 20px 55px #0006;padding:17px;font:12px/1.45 Inter,system-ui,sans-serif}
#atlas-source-health-panel h3{font-size:15px;margin:0 0 5px}
#atlas-source-health-panel .ash-muted{opacity:.72;font-size:11px}
#atlas-source-health-panel .ash-line{padding:10px 0;border-top:1px solid #8292a430;display:flex;justify-content:space-between;gap:12px}
#atlas-source-health-panel .ash-line strong{font-size:12px}
#atlas-source-health-panel .ash-status{white-space:nowrap;font-size:11px}
#atlas-source-health-panel button{border:1px solid #8391a466;border-radius:7px;padding:5px 9px;background:transparent;color:inherit;cursor:pointer}
@media(max-width:650px){#atlas-source-health-button{right:8px;top:7px;padding:5px 8px;font-size:10px}#atlas-source-health-panel{top:43px;right:8px}}
`;document.head.appendChild(s)}
function status(){return records.some(x=>x.status==='error')?'error':records.every(x=>x.status==='ok')?'ok':'warn'}
function draw(){const b=document.getElementById('atlas-source-health-button');if(b){b.dataset.state=status();b.querySelector('.ash-label').textContent=records.some(x=>x.status==='error')?'Fuentes · incidencia':records.every(x=>x.status==='ok')?'Fuentes · operativas':'Fuentes · atención';b.setAttribute('aria-expanded',String(open))}
const panel=document.getElementById('atlas-source-health-panel');if(!panel)return;
panel.hidden=!open;if(!open)return;
panel.replaceChildren();
const h=document.createElement('h3');h.textContent='Salud de las fuentes';panel.appendChild(h);
const p=document.createElement('p');p.className='ash-muted';p.textContent='Diagnóstico de disponibilidad, vigencia, estructura y cobertura cuando el origen aporta metadatos suficientes. Sin verificación no significa fuente caída.';panel.appendChild(p);
const action=document.createElement('button');action.textContent=running?'Comprobando…':'Actualizar comprobación';action.disabled=running;action.addEventListener('click',()=>check(true));panel.appendChild(action);
for(const r of records){const row=document.createElement('div');row.className='ash-line';const left=document.createElement('div');const name=document.createElement('strong');name.textContent=r.name;const sub=document.createElement('div');sub.className='ash-muted';sub.textContent=r.scope;const detail=document.createElement('div');detail.className='ash-muted';detail.textContent=r.detail;left.append(name,sub,detail);for(const metric of r.metrics||[]){const el=document.createElement('div');el.className='ash-muted';el.textContent=metric;left.appendChild(el)}const st=document.createElement('span');st.className='ash-status';st.textContent=r.status==='ok'?'● Validada':r.status==='error'?'● Incidencia':r.status==='warn'?'● Atención':'○ Sin verificar';st.style.color=r.status==='ok'?'#46bd8c':r.status==='error'?'#ee8989':r.status==='warn'?'#f5b65c':'inherit';row.append(left,st);panel.appendChild(row)}
const footer=document.createElement('p');footer.className='ash-muted';footer.textContent='Comprobación: '+(lastRun?new Date(lastRun).toLocaleString('es-CL'):'pendiente')+' · Sin universo esperado verificable no se informa porcentaje de cobertura.';panel.appendChild(footer)}
function pickDate(data){const keys=['generated_at','generatedAt','updated_at','updatedAt','snapshot_date','snapshotDate','snapshot_at','last_updated','lastUpdated','fecha_actualizacion','fecha_corte','as_of'];for(const key of keys){let value=data&&data[key];if(typeof value==='string'&&/^\\d{4}-\\d\\d-\\d\\d/.test(value))return {key,value}}return null}
function pickCoverage(data){const candidate=data&&typeof data.coverage==='object'?data.coverage:data;const actual=Number(candidate&& (candidate.records_loaded??candidate.loaded_count??candidate.observed_count));const expected=Number(candidate&&(candidate.records_expected??candidate.expected_count??candidate.expected_universe));if(Number.isFinite(actual)&&Number.isFinite(expected)&&expected>0&&actual>=0&&actual<=expected)return {actual,expected,ratio:actual/expected};return null}
function analyze(rec,data){const metrics=[];let level='ok';const keys=Object.keys(data);if(!keys.length)return {...rec,status:'error',detail:'Archivo vacío: sin campos verificables',metrics};
metrics.push('Estructura: '+keys.length+' campos en raíz');
if(rec.name==='Radar UAF'){if(!data.kpis||typeof data.kpis!=='object'||!Object.keys(data.kpis).length){level='error';metrics.push('Integridad: faltan indicadores KPI')}else{metrics.push('Integridad: indicadores KPI presentes');const cut=data.kpis.registered_total_as_of||data.kpis.registered_private_as_of;if(cut)metrics.push('Corte padrón: '+cut+' (referencia, no actualización)')}}
if(rec.name==='SII'&&!keys.some(k=>/date|at|snapshot|version|count|total|file|source|fecha/i.test(k))){level='warn';metrics.push('Integridad: formato de manifiesto no reconocido')}
const dated=pickDate(data);if(dated){const parsed=Date.parse(dated.value);if(Number.isFinite(parsed)&&parsed<=Date.now()+86400000){const age=Math.floor((Date.now()-parsed)/86400000);metrics.push('Última generación declarada: '+dated.value.slice(0,10)+' ('+age+' días)');if(age>45){if(level==='ok')level='warn';metrics.push('Vigencia: requiere revisión (>45 días)')}else metrics.push('Vigencia: dentro de umbral informativo de 45 días')}else{level='warn';metrics.push('Vigencia: fecha futura o inválida')}}else{if(level==='ok')level='warn';metrics.push('Vigencia: fecha inválida')}}else{if(level==='ok')level='warn';metrics.push('Vigencia: no publicada en los metadatos')}
const coverage=pickCoverage(data);if(coverage){metrics.push('Cobertura: '+coverage.actual.toLocaleString('es-CL')+' / '+coverage.expected.toLocaleString('es-CL')+' ('+(coverage.ratio*100).toFixed(1)+'%)');if(coverage.ratio<.95&&level==='ok')level='warn'}else{metrics.push('Cobertura: no evaluable, falta universo esperado homogéneo')}
return {...rec,status:level,detail:'Archivo accesible y JSON válido',metrics,checked:Date.now()}}
async function probe(rec){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);try{const response=await fetch(rec.url,{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('HTTP '+response.status);const ct=response.headers.get('content-type')||'';if(!ct.includes('json'))throw Error('El recurso no devuelve JSON');const data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Se esperaba un objeto JSON');return analyze(rec,data)}catch(err){const message=String(err&&err.message||err).slice(0,80);const unavailable=/Failed to fetch|NetworkError|HTTP 404/i.test(message);return {...rec,status:unavailable?'unknown':'error',detail:(unavailable?'No verificable desde este sitio: ':'Error de recurso: ')+message,metrics:['La respuesta no permite determinar salud del origen'],checked:Date.now()}}finally{clearTimeout(timer)}}
async function check(force){if(running||(!force&&Date.now()-lastRun<300000))return;running=true;draw();const updates=await Promise.all(records.map(r=>r.url?probe(r):Promise.resolve(r)));records=updates;running=false;lastRun=Date.now();draw()}
function mount(){css();if(!document.body)return;if(!document.getElementById('atlas-source-health-button')){let b=document.createElement('button');b.type='button';b.id='atlas-source-health-button';b.setAttribute('aria-label','Abrir salud de fuentes');b.setAttribute('aria-controls','atlas-source-health-panel');b.innerHTML='<span class="ash-dot" aria-hidden="true"></span><span class="ash-label">Fuentes · verificando</span>';b.addEventListener('click',()=>{open=!open;draw()});document.body.appendChild(b)}
if(!document.getElementById('atlas-source-health-panel')){let p=document.createElement('section');p.id='atlas-source-health-panel';p.setAttribute('role','dialog');p.setAttribute('aria-label','Detalle de salud de fuentes');p.hidden=true;document.body.appendChild(p)}
draw();check(false)}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){open=false;draw()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.addEventListener('pageshow',mount);
window.AtlasSourceHealthIndicator={refresh:()=>check(true),getSnapshot:()=>records.map(x=>({...x}))};
})();
