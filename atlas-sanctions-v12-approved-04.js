function sv12Mount(B){
  const host=typeof content==='function'?content():document.querySelector('#content');if(!host)throw new Error('Contenedor de Sanciones no disponible.');host.innerHTML=SV12_MARKUP;const root=host.querySelector('.sv12-approved');if(!root)throw new Error('No fue posible montar Sanciones v12.');const y=new Date(`${B.as_of}T12:00:00`).getFullYear()||new Date().getFullYear();const all=root.querySelector('[data-period="all"]');if(all)all.textContent=`2020–${y}`;const current=root.querySelector('[data-period="2026"]');if(current){current.dataset.period=String(y);current.textContent=`${y} YTD`;}const prior=root.querySelector('[data-period="2025"]');if(prior){prior.dataset.period=String(y-1);prior.textContent=String(y-1);}
  (function(B){

const NF=new Intl.NumberFormat('es-CL'); const fmt=n=>NF.format(Math.round(Number(n)||0)); const fmt1=n=>(Number(n)||0).toFixed(1).replace('.',','); const pct=(v,d=1)=>isFinite(v)?(v*100).toFixed(d).replace('.',',')+'%':'—';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId=new Map(B.subjects.map(s=>[s.subject_id,s])), eventById=new Map(B.events.map(e=>[e.id,e])), sectorBase=new Map(B.sectors.map(s=>[s.sector,s]));
const ALL_SUPS=[...new Set(B.events.map(e=>e.supervisor).filter(Boolean))].sort(); const asof=new Date(B.as_of+'T12:00:00');
let ST={period:'all',group:'ALL',sups:new Set(ALL_SUPS),sector:'all',region:'all',category:'all',query:'',sort:'ier',timeMetric:'events',sectorMetric:'events',focusRange:null,focusKey:null};
const colors={so:getCss('--purple'),other:getCss('--slate'),potential:getCss('--teal'),blue:getCss('--blue'),amber:getCss('--amber'),red:getCss('--red'),soft:getCss('--soft')};
function getCss(v){const root=document.querySelector('.sv12-approved');return getComputedStyle(root||document.documentElement).getPropertyValue(v).trim()}
function parseDate(s){return s?new Date(s+'T12:00:00'):null}
const REGION_META=[
 {key:'Arica y Parinacota',abbr:'AP',aliases:['arica','parinacota']},
 {key:'Tarapacá',abbr:'TA',aliases:['tarapac','iquique','alto hospicio']},
 {key:'Antofagasta',abbr:'AN',aliases:['antofagasta','calama','tocopilla','mejillones']},
 {key:'Atacama',abbr:'AT',aliases:['atacama','copiap','vallenar']},
 {key:'Coquimbo',abbr:'CO',aliases:['coquimbo','la serena','ovalle']},
 {key:'Valparaíso',abbr:'VA',aliases:['valpara','viña del mar','vina del mar','quilpu','san antonio','quillota']},
 {key:'Metropolitana',abbr:'RM',aliases:['santiago','metropolitana','providencia','las condes','vitacura','ñuñoa','nunoa']},
 {key:'O’Higgins',abbr:'OH',aliases:['ohiggins','o’higgins','rancagua','san fernando']},
 {key:'Maule',abbr:'MA',aliases:['maule','talca','curic','linares']},
 {key:'Ñuble',abbr:'NU',aliases:['ñuble','nuble','chillán','chillan']},
 {key:'Biobío',abbr:'BI',aliases:['biob','concepción','concepcion','los ángeles','los angeles','talcahuano']},
 {key:'Araucanía',abbr:'AR',aliases:['araucan','temuco','villarrica','angol']},
 {key:'Los Ríos',abbr:'LR',aliases:['los ríos','los rios','valdivia']},
 {key:'Los Lagos',abbr:'LL',aliases:['los lagos','puerto montt','osorno','castro','puelo']},
 {key:'Aysén',abbr:'AY',aliases:['aysén','aysen','coyhaique']},
 {key:'Magallanes',abbr:'MG',aliases:['magallanes','punta arenas']}
];
const REGION_DEFAULT_BY_SUP={CMF:'Metropolitana',UAF:'Metropolitana',SP:'Metropolitana',SUSESO:'Metropolitana'};
function inferRegionForSubject(s){
  const parts=[displayName(s),s.nombre,s.nombre_fuente,s.uaf_razon_social,s.sector_analitico,s.hipotesis_detalle,s.identity_evidence];
  for(const id of (s.event_ids||[])){
    const e=eventById.get(id)||{};
    parts.push(e.sujeto_fuente,e.resumen,e.categoria,e.source_url,e.resolution_url);
  }
  const blob=parts.filter(Boolean).join(' | ').toLowerCase();
  for(const r of REGION_META){ if(r.aliases.some(a=>blob.includes(a))) return r.key; }
  for(const sup of (s.supervisores||[])){ if(REGION_DEFAULT_BY_SUP[sup]) return REGION_DEFAULT_BY_SUP[sup]; }
  return 'Sin región observable';
}
function regionRows(D){
  const M=new Map();
  for(const s of D.subjects){
    const r=inferRegionForSubject(s);
    if(!M.has(r))M.set(r,{region:r,abbr:(REGION_META.find(x=>x.key===r)||{}).abbr||'SR',subjects:0,events:0,so:0,potential:0,uf:0,ier:[],top:[]});
    const row=M.get(r), uf=s._events.reduce((a,e)=>a+(e.unidad==='UF'?Number(e.monto||0):0),0);
    row.subjects+=1; row.events+=s._n; row.uf+=uf; row.ier.push(Number(s.ier||0)); if(isSO(s))row.so+=1; if(isPotential(s))row.potential+=1; row.top.push(s);
  }
  const rows=[...M.values()].map(r=>({...r, ierm:r.ier.length?r.ier.reduce((a,b)=>a+b,0)/r.ier.length:0, potentialShare:r.subjects?r.potential/r.subjects:0}));
  return rows.sort((a,b)=>b.events-a.events||b.subjects-a.subjects);
}
function basePeriodRange(){let end=new Date(asof),start=new Date('2020-01-01T00:00:00');if(ST.period==='24m'){start=new Date(end);start.setMonth(start.getMonth()-24)}if(ST.period==='12m'){start=new Date(end);start.setMonth(start.getMonth()-12)}if(/^20\d\d$/.test(ST.period)){start=new Date(ST.period+'-01-01T00:00:00');end=new Date(ST.period+'-12-31T23:59:59');if(+ST.period===asof.getFullYear())end=new Date(asof)}return[start,end]}
function periodRange(useFocus=true){return useFocus&&ST.focusRange?ST.focusRange:basePeriodRange()}
