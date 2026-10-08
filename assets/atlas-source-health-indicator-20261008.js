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
let records=SOURCES.map(s=>({...s,status:'unknown',detail:'Sin comprobación automática configurada',checked:null}));
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
function status(){let tested=records.filter(x=>x.url),bad=tested.filter(x=>x.status==='error').length,ok=tested.filter(x=>x.status==='ok').length;return bad?'error':ok===tested.length&&ok?'warn':'warn'}
function draw(){const b=document.getElementById('atlas-source-health-button');if(b){b.dataset.state=status();b.querySelector('.ash-label').textContent=records.some(x=>x.status==='error')?'Fuentes · incidencia':'Fuentes · parcial';b.setAttribute('aria-expanded',String(open))}
const panel=document.getElementById('atlas-source-health-panel');if(!panel)return;
panel.hidden=!open;if(!open)return;
panel.replaceChildren();
const h=document.createElement('h3');h.textContent='Salud de las fuentes';panel.appendChild(h);
const p=document.createElement('p');p.className='ash-muted';p.textContent='Disponibilidad del archivo publicado, no certificación de cobertura ni calidad. Sin comprobación no significa fuente caída.';panel.appendChild(p);
const action=document.createElement('button');action.textContent=running?'Comprobando…':'Actualizar comprobación';action.disabled=running;action.addEventListener('click',()=>check(true));panel.appendChild(action);
for(const r of records){const row=document.createElement('div');row.className='ash-line';const left=document.createElement('div');const name=document.createElement('strong');name.textContent=r.name;const sub=document.createElement('div');sub.className='ash-muted';sub.textContent=r.scope;const detail=document.createElement('div');detail.className='ash-muted';detail.textContent=r.detail;left.append(name,sub,detail);const st=document.createElement('span');st.className='ash-status';st.textContent=r.status==='ok'?'● Accesible':r.status==='error'?'● No disponible':'○ Sin verificar';st.style.color=r.status==='ok'?'#46bd8c':r.status==='error'?'#ee8989':'inherit';row.append(left,st);panel.appendChild(row)}
const footer=document.createElement('p');footer.className='ash-muted';footer.textContent='Comprobación: '+(lastRun?new Date(lastRun).toLocaleString('es-CL'):'pendiente')+' · La vigencia y completitud requieren controles específicos por origen.';panel.appendChild(footer)}
async function probe(rec){let controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);try{let response=await fetch(rec.url,{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('HTTP '+response.status);const ct=response.headers.get('content-type')||'';if(!ct.includes('json'))throw Error('El recurso no devuelve JSON');const data=await response.json();if(!data||typeof data!=='object')throw Error('Respuesta sin datos estructurados');return {...rec,status:'ok',detail:'Archivo JSON accesible; cobertura y vigencia no verificadas',checked:Date.now()}}catch(err){return {...rec,status:'error',detail:'Comprobación fallida: '+String(err&&err.message||err).slice(0,75),checked:Date.now()}}finally{clearTimeout(timer)}}
async function check(force){if(running||(!force&&Date.now()-lastRun<300000))return;running=true;draw();const updates=await Promise.all(records.map(r=>r.url?probe(r):Promise.resolve(r)));records=updates;running=false;lastRun=Date.now();draw()}
function mount(){css();if(!document.body)return;if(!document.getElementById('atlas-source-health-button')){let b=document.createElement('button');b.type='button';b.id='atlas-source-health-button';b.setAttribute('aria-label','Abrir salud de fuentes');b.setAttribute('aria-controls','atlas-source-health-panel');b.innerHTML='<span class="ash-dot" aria-hidden="true"></span><span class="ash-label">Fuentes · verificando</span>';b.addEventListener('click',()=>{open=!open;draw()});document.body.appendChild(b)}
if(!document.getElementById('atlas-source-health-panel')){let p=document.createElement('section');p.id='atlas-source-health-panel';p.setAttribute('role','dialog');p.setAttribute('aria-label','Detalle de salud de fuentes');p.hidden=true;document.body.appendChild(p)}
draw();check(false)}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){open=false;draw()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.addEventListener('pageshow',mount);
window.AtlasSourceHealthIndicator={refresh:()=>check(true),getSnapshot:()=>records.map(x=>({...x}))};
})();
