'use strict';
/* ATLAS AML · Universo SO · Contexto SII 0.83.3
 * Enriquece la Ficha 360 de SO/potenciales con datos registrales SII ya
 * materializados en Atlas. No altera scoring ni semántica de riesgo.
 */
(function atlasUniversoSOSiiContext0833(){
  if(window.__ATLAS_UNIVERSO_SO_SII_0833__)return;
  window.__ATLAS_UNIVERSO_SO_SII_0833__={version:'0.83.3',installedAt:new Date().toISOString()};

  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch{return window.sb||null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=v=>v===null||v===undefined||v===''?'—':String(v);
  const day=v=>v?String(v).slice(0,10):'—';
  const api=()=>window.AtlasUniversoSO0816||window.AtlasUniversoSO0814||null;
  const rowFor=rut=>(api()?.state?.().rows||[]).find(r=>String(r.rut)===String(rut))||null;

  async function siiContext(row){
    const c=db();
    if(!c||!row)return {tax:null,activity:null,stamp:null};
    const taxQ=row.entity_id
      ? c.from('aml_entity_tax_profile')
          .select('commercial_year,sales_band,workers_numeric,region,main_activity,activity_start_date,activity_codes')
          .eq('entity_id',row.entity_id).order('commercial_year',{ascending:false}).limit(1)
      : Promise.resolve({data:[],error:null});
    const activityQ=row.rut
      ? c.from('aml_sii_registry_activity')
          .select('activity_code,activity_name,activity_registration_date,activity_status')
          .eq('rut',row.rut).order('activity_registration_date',{ascending:false,nullsFirst:false}).limit(12)
      : Promise.resolve({data:[],error:null});
    const stampQ=row.rut
      ? c.from('aml_v0449_sii_latest_document_authorization')
          .select('document_type_name,document_type_code,authorization_date,document_date,authorization_status,observed_at')
          .eq('rut',row.rut).limit(1)
      : Promise.resolve({data:[],error:null});
    const [taxR,actR,stampR]=await Promise.all([taxQ,activityQ,stampQ]);
    const activities=actR?.data||[];
    const active=activities.find(x=>String(x.activity_status||'').toUpperCase()==='VIGENTE')||activities[0]||null;
    return {tax:(taxR?.data||[])[0]||null,activity:active,stamp:(stampR?.data||[])[0]||null};
  }

  function acteco(ctx){
    const a=ctx.activity,t=ctx.tax;
    if(a?.activity_code)return `${a.activity_code}${a.activity_name?` · ${a.activity_name}`:''}`;
    if(t?.activity_codes)return `${t.activity_codes}${t.main_activity?` · ${t.main_activity}`:''}`;
    return t?.main_activity||'—';
  }

  function panel(row,ctx){
    const t=ctx.tax||{},s=ctx.stamp||{};
    const region=t.region||row.region||'—';
    const stampDate=s.authorization_date||s.document_date||null;
    const stampMeta=s.document_type_name||s.document_type_code||null;
    return `<section class="uso833-sii" data-uso833-sii="1">
      <header><div><span>SII · CARACTERIZACIÓN</span><h4>Contexto tributario y operacional</h4></div><small>${t.commercial_year?`corte comercial ${esc(t.commercial_year)}`:'último dato materializado'}</small></header>
      <div class="uso833-sii-grid">
        <article><span>Inicio actividades</span><b>${esc(day(t.activity_start_date))}</b></article>
        <article class="wide"><span>ACTECO SII</span><b>${esc(acteco(ctx))}</b></article>
        <article><span>Región</span><b>${esc(text(region))}</b></article>
        <article><span>Rango ventas</span><b>${esc(text(t.sales_band))}</b></article>
        <article><span>N° trabajadores</span><b>${t.workers_numeric===0?'0':esc(text(t.workers_numeric))}</b></article>
        <article><span>Último timbraje</span><b>${esc(day(stampDate))}</b>${stampMeta?`<small>${esc(stampMeta)}</small>`:''}</article>
      </div>
    </section>`;
  }

  async function inject(rut){
    const row=rowFor(rut);if(!row)return;
    let ctx;try{ctx=await siiContext(row)}catch{return}
    for(let i=0;i<24;i++){
      const body=document.querySelector('#u816-body');
      const lenses=body?.querySelector('.uso814-lenses');
      if(body&&lenses&&document.querySelector('#u816-sheet')?.classList.contains('open')){
        body.querySelector('[data-uso833-sii]')?.remove();
        lenses.insertAdjacentHTML('beforebegin',panel(row,ctx));
        lenses.classList.add('uso833-lenses-compact');
        return;
      }
      await new Promise(r=>setTimeout(r,75));
    }
  }

  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('[data-u816-peek]');
    if(!b)return;
    const rut=b.dataset.u816Peek;if(rut)void inject(rut);
  });
})();